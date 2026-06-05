"""
쇼케이스 문서 업로드 자동 추출 서비스

흐름: 업로드 검증 → kordoc 마크다운 파싱 → LLM 항목 추출 → 검증/정규화(보정) → 제안 반환.
DB는 변경하지 않는다(제안 JSON만 반환). 실제 생성은 기존 create_item이 담당.

설계 원칙:
- LLM/파싱 실패는 "기본 시나리오"로 간주하고 항상 부분 채움 + 경고로 degrade한다.
- 카테고리 목록은 DB에서 동적 주입(하드코딩 금지). item_type/difficulty enum은
  도메인 코드 상수로 단일 출처에서 관리한다.
"""
import json
import logging
import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from fastapi import HTTPException, UploadFile
from sqlalchemy.orm import Session

from backend.config.settings import settings
from backend.models.schemas.showcase import ShowcaseExtractResponse, ShowcaseSuggestion
from backend.services import kordoc_parser
from backend.services.kordoc_parser import KordocParseError
from backend.services.llm_service import llm_service
from backend.services.showcase_crud import showcase_crud

logger = logging.getLogger("uvicorn")

PROMPT_PATH = Path(__file__).parent.parent / "prompts" / "showcase_extract.md"

# === 도메인 enum 단일 출처 (ShowcaseItemCreate 제약과 일치) ===
# key: 유형, value: 프롬프트에 주입할 한 줄 설명
ITEM_TYPE_DESCRIPTIONS: Dict[str, str] = {
    "prompt": "재사용 가능한 AI 프롬프트",
    "code": "실행 가능한 코드/스크립트",
    "guide": "단계별 설명 가이드/튜토리얼",
    "workflow": "여러 단계를 연결한 자동화 워크플로",
    "snippet": "짧은 코드 조각/스니펫",
}
VALID_ITEM_TYPES = tuple(ITEM_TYPE_DESCRIPTIONS.keys())
VALID_DIFFICULTIES = ("beginner", "intermediate", "advanced")
DEFAULT_DIFFICULTY = "beginner"

# === 길이/개수 제약 (ShowcaseItemCreate 와 동일) ===
TITLE_MIN, TITLE_MAX = 2, 200
SUMMARY_MIN, SUMMARY_MAX = 10, 500
CONTENT_MIN = 10
TAGS_MAX = 10
TAG_MAX_LEN = 30

PARSER_NAME = "kordoc"


# ---------------------------------------------------------------------------
# 텍스트 추출 헬퍼 (폴백/보정용)
# ---------------------------------------------------------------------------
def _first_heading(markdown: str) -> str:
    """마크다운에서 첫 번째 제목(또는 의미 있는 첫 줄)을 추출."""
    for raw in markdown.splitlines():
        line = raw.strip()
        if not line:
            continue
        m = re.match(r"^#{1,6}\s+(.*)$", line)
        if m and m.group(1).strip():
            return m.group(1).strip()
        # 제목이 평문화된 경우(HWPX 등): 첫 비어있지 않은 줄 사용
        return re.sub(r"[#>*_`~-]", "", line).strip()
    return ""


def _first_paragraph(markdown: str) -> str:
    """마크다운에서 제목/목록을 제외한 첫 본문 문단을 추출."""
    for raw in markdown.splitlines():
        line = raw.strip()
        if not line:
            continue
        if re.match(r"^(#{1,6}\s+|[-*+]\s+|\d+[.)]\s+|```|>|\|)", line):
            continue
        text = re.sub(r"[#>*_`~]", "", line).strip()
        if len(text) >= 2:
            return text
    return ""


# ---------------------------------------------------------------------------
# LLM 응답 파싱
# ---------------------------------------------------------------------------
def _extract_llm_content(result: Dict[str, Any]) -> str:
    """chat_completion 응답 dict에서 텍스트 추출 (content 우선, 없으면 reasoning_content)."""
    message = (result.get("choices") or [{}])[0].get("message", {})
    content = (message.get("content") or "").strip()
    if not content:
        content = (message.get("reasoning_content") or "").strip()
    return content


def _strip_code_fence(text: str) -> str:
    """코드펜스(```json ... ```)를 제거하고 내부만 반환."""
    text = text.strip()
    fence = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if fence:
        return fence.group(1).strip()
    return text


def _parse_json_object(text: str) -> Optional[Dict[str, Any]]:
    """LLM 출력에서 JSON 객체 1개를 파싱. 실패 시 None."""
    candidate = _strip_code_fence(text)
    # 1차: 그대로 파싱
    try:
        parsed = json.loads(candidate)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass
    # 2차: 첫 { ... 마지막 } 구간 추출 후 파싱
    start = candidate.find("{")
    end = candidate.rfind("}")
    if start != -1 and end != -1 and end > start:
        try:
            parsed = json.loads(candidate[start : end + 1])
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError:
            pass
    return None


def _load_prompt(categories: List[Any], markdown: str) -> str:
    """프롬프트 템플릿에 카테고리/유형/문서를 동적 주입."""
    template = PROMPT_PATH.read_text(encoding="utf-8")

    cat_lines = "\n".join(
        f"- {c.key} — {c.name} — {(c.description or '').strip()}" for c in categories
    ) or "- (등록된 카테고리 없음)"

    type_lines = "\n".join(
        f"- {key}: {desc}" for key, desc in ITEM_TYPE_DESCRIPTIONS.items()
    )

    truncated = markdown[: settings.SHOWCASE_EXTRACT_MD_CHAR_LIMIT]

    return (
        template.replace("{categories}", cat_lines)
        .replace("{item_types}", type_lines)
        .replace("{document_markdown}", truncated)
    )


async def _llm_extract(db: Session, markdown: str) -> Dict[str, Any]:
    """LLM으로 추출 JSON(raw dict)을 얻는다. 실패 시 예외 전파(상위에서 폴백)."""
    categories = showcase_crud.get_categories(db)
    prompt = _load_prompt(categories, markdown)

    messages = [
        {"role": "system", "content": prompt},
        {
            "role": "user",
            "content": "위 문서를 분석해 쇼케이스 항목 JSON 객체 하나만 출력하세요. 설명/코드펜스 금지.",
        },
    ]

    model = settings.SHOWCASE_EXTRACT_MODEL or None
    result = await llm_service.chat_completion(
        messages=messages,
        model=model,
        temperature=settings.SHOWCASE_EXTRACT_TEMPERATURE,
        max_tokens=settings.SHOWCASE_EXTRACT_MAX_TOKENS,
    )

    content = _extract_llm_content(result)
    parsed = _parse_json_object(content)
    if parsed is None:
        raise ValueError("LLM 응답에서 JSON을 파싱하지 못했습니다.")
    return parsed


# ---------------------------------------------------------------------------
# 검증/정규화 (보정 레이어)
# ---------------------------------------------------------------------------
def _clamp(text: str, lo: int, hi: int) -> Optional[str]:
    """길이 보정: hi 초과 시 자르고, lo 미만이면 None 반환."""
    text = (text or "").strip()
    if len(text) > hi:
        text = text[:hi].strip()
    return text if len(text) >= lo else None


def _normalize_category(
    raw_key: str, raw_title: str, categories: List[Any], warnings: List[str]
) -> Optional[str]:
    """category_key를 DB 존재 key로 보정. key 직매칭 → name 매칭 → 실패 시 None+경고."""
    key = (raw_key or "").strip()
    by_key = {c.key: c.key for c in categories}
    if key in by_key:
        return key

    # name 매칭 (대소문자/공백 무시)
    if key:
        norm = key.replace(" ", "").lower()
        for c in categories:
            if c.name.replace(" ", "").lower() == norm:
                return c.key

    warnings.append("분류를 자동 판별하지 못했어요. 카테고리를 직접 선택해 주세요.")
    return None


def _normalize_item_type(raw_type: str, warnings: List[str]) -> Optional[str]:
    """item_type을 enum으로 보정. 밖이면 None+경고."""
    t = (raw_type or "").strip().lower()
    if t in VALID_ITEM_TYPES:
        return t
    if t:
        warnings.append("유형을 자동 판별하지 못했어요. 유형을 직접 선택해 주세요.")
    return None


def _normalize_tags(raw_tags: Any) -> List[str]:
    """tags 정규화: 문자열만, 공백/중복 제거, 길이/개수 상한."""
    if not isinstance(raw_tags, list):
        return []
    seen = set()
    result: List[str] = []
    for t in raw_tags:
        if not isinstance(t, str):
            continue
        tag = t.strip()[:TAG_MAX_LEN].strip()
        if not tag or tag.lower() in seen:
            continue
        seen.add(tag.lower())
        result.append(tag)
        if len(result) >= TAGS_MAX:
            break
    return result


def _normalize(
    db: Session, raw: Dict[str, Any], markdown: str, warnings: List[str]
) -> ShowcaseSuggestion:
    """LLM raw dict → 검증/보정된 ShowcaseSuggestion."""
    categories = showcase_crud.get_categories(db)

    title = _clamp(str(raw.get("title", "")), TITLE_MIN, TITLE_MAX)
    if not title:
        title = _clamp(_first_heading(markdown), TITLE_MIN, TITLE_MAX)

    summary = _clamp(str(raw.get("summary", "")), SUMMARY_MIN, SUMMARY_MAX)

    content = (str(raw.get("content", "")) or "").strip()
    if len(content) < CONTENT_MIN:
        # 본문이 부실하면 파싱 원문 마크다운으로 대체
        content = markdown.strip()
        warnings.append("본문을 충분히 추출하지 못해 원문을 채웠어요. 검토 후 다듬어 주세요.")
    content = content or None

    difficulty = str(raw.get("difficulty", "")).strip().lower()
    if difficulty not in VALID_DIFFICULTIES:
        difficulty = DEFAULT_DIFFICULTY

    return ShowcaseSuggestion(
        category_key=_normalize_category(
            str(raw.get("category_key", "")), title or "", categories, warnings
        ),
        title=title,
        summary=summary,
        content=content,
        item_type=_normalize_item_type(str(raw.get("item_type", "")), warnings),
        difficulty=difficulty,
        tags=_normalize_tags(raw.get("tags")),
    )


def _rule_based_suggestion(markdown: str, warnings: List[str]) -> ShowcaseSuggestion:
    """LLM 불가 시 규칙 기반 부분 채움 (파싱 마크다운 활용)."""
    return ShowcaseSuggestion(
        category_key=None,
        title=_clamp(_first_heading(markdown), TITLE_MIN, TITLE_MAX),
        summary=_clamp(_first_paragraph(markdown), SUMMARY_MIN, SUMMARY_MAX),
        content=markdown.strip() or None,
        item_type=None,
        difficulty=DEFAULT_DIFFICULTY,
        tags=[],
    )


# ---------------------------------------------------------------------------
# 진입점
# ---------------------------------------------------------------------------
async def extract_from_upload(
    db: Session, file: UploadFile, return_markdown: bool = False
) -> ShowcaseExtractResponse:
    """업로드 파일에서 쇼케이스 제안값을 추출한다. DB 미변경."""
    filename = file.filename or ""
    ext = Path(filename).suffix.lower()

    # 1. 입력 검증 (서버 방어)
    if ext not in settings.SHOWCASE_EXTRACT_ALLOWED_EXTENSIONS_SET:
        allowed = ", ".join(sorted(settings.SHOWCASE_EXTRACT_ALLOWED_EXTENSIONS_SET))
        raise HTTPException(
            status_code=400,
            detail=f"지원하지 않는 파일 형식입니다. ({allowed})",
        )

    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="빈 파일입니다.")
    if len(data) > settings.SHOWCASE_EXTRACT_MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"파일 크기는 {settings.SHOWCASE_EXTRACT_MAX_UPLOAD_SIZE_MB}MB 이하여야 합니다.",
        )

    warnings: List[str] = []
    filename_stem = _clamp(Path(filename).stem, TITLE_MIN, TITLE_MAX)

    # 2. 파싱 (kordoc 단일)
    # 보조 기능이므로 어떤 파서 오류(KordocParseError 및 환경 의존 예외 등)도
    # 500으로 끊지 않고 "파싱 실패" 폴백(200)으로 degrade한다.
    try:
        markdown = await kordoc_parser.parse_to_markdown(data, ext)
    except KordocParseError as e:
        logger.warning(f"[showcase-extract] 파싱 실패: {e}")
        warnings.append("문서 파싱에 실패했습니다. 직접 입력해 주세요.")
        return ShowcaseExtractResponse(
            suggestion=ShowcaseSuggestion(title=filename_stem, difficulty=DEFAULT_DIFFICULTY),
            warnings=warnings,
            parser_used=PARSER_NAME,
            llm_used=False,
            source_markdown=None,
        )
    except Exception as e:  # 예상 외 오류(환경/런타임)도 폴백으로 안전 처리
        logger.exception(f"[showcase-extract] 파싱 중 예기치 못한 오류: {e}")
        warnings.append("문서 파싱에 실패했습니다. 직접 입력해 주세요.")
        return ShowcaseExtractResponse(
            suggestion=ShowcaseSuggestion(title=filename_stem, difficulty=DEFAULT_DIFFICULTY),
            warnings=warnings,
            parser_used=PARSER_NAME,
            llm_used=False,
            source_markdown=None,
        )

    # 3. LLM 추출 → 4. 보정 (실패 시 규칙 기반 폴백)
    llm_used = True
    try:
        raw = await _llm_extract(db, markdown)
        suggestion = _normalize(db, raw, markdown, warnings)
    except Exception as e:
        logger.warning(f"[showcase-extract] LLM 추출 실패, 규칙 기반 폴백: {e}")
        llm_used = False
        warnings.append("AI 자동 추출에 실패해 문서 내용으로 부분만 채웠어요. 검토 후 보완해 주세요.")
        suggestion = _rule_based_suggestion(markdown, warnings)

    # title이 끝내 비면 파일명으로 보완
    if not suggestion.title and filename_stem:
        suggestion.title = filename_stem

    # 5. 응답 조립 (200, DB 변경 없음)
    return ShowcaseExtractResponse(
        suggestion=suggestion,
        warnings=warnings,
        parser_used=PARSER_NAME,
        llm_used=llm_used,
        source_markdown=markdown if return_markdown else None,
    )
