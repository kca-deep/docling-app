"""
셀프진단 서비스
AI 과제 보안성 검토 셀프진단 비즈니스 로직
"""
import json
import logging
import re
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple

from fastapi import HTTPException
from sqlalchemy.orm import Session

from backend.config.settings import settings
from backend.models.selfcheck import SelfCheckSubmission, SelfCheckItem
from backend.models.schemas import (
    SelfCheckAnalyzeRequest,
    SelfCheckAnalyzeResponse,
    SelfCheckItemResult,
    SelfCheckItemInput,
    LLMStatusResponse,
    LLMModelStatus,
    SelfCheckHistoryItem,
    SelfCheckHistoryResponse,
    SelfCheckDetailResponse,
    SimilarProject,
)
from backend.services.health_service import health_service
from backend.services.http_client import http_manager
from backend.services.embedding_service import EmbeddingService

logger = logging.getLogger(__name__)

# 체크리스트 항목 정의
CHECKLIST_ITEMS = [
    {"number": 1, "category": "required", "question": "내부 정보시스템(업무포털, 무선국검사, 자격검정 등)과 연계 필요 여부", "short_label": "내부시스템 연계"},
    {"number": 2, "category": "required", "question": "개인정보(성명, 주민등록번호, 연락처 등) 수집/처리/저장 여부", "short_label": "개인정보 처리"},
    {"number": 3, "category": "required", "question": "민감정보(건강정보, 사상/신념, 정치적 견해 등) 활용 여부", "short_label": "민감정보 활용"},
    {"number": 4, "category": "required", "question": "비공개 업무자료(내부문서, 대외비 등) AI 서비스 입력 여부", "short_label": "비공개자료 AI입력"},
    {"number": 5, "category": "optional", "question": "외부 클라우드 기반 AI 서비스(ChatGPT, Claude 등) 활용 여부", "short_label": "외부 클라우드 AI"},
    {"number": 6, "category": "optional", "question": "자체 AI 모델 구축/학습 계획 여부", "short_label": "자체 AI 모델"},
    {"number": 7, "category": "optional", "question": "대국민 서비스 제공 예정 여부", "short_label": "대국민 서비스"},
    {"number": 8, "category": "optional", "question": "외부 API 연동(OpenAI API, 외부 데이터 수집 등) 필요 여부", "short_label": "외부 API 연동"},
    {"number": 9, "category": "optional", "question": "생성 결과물의 정확성/윤리성 검증 절차 마련 여부", "short_label": "검증 절차"},
    {"number": 10, "category": "optional", "question": "AI 서비스 이용약관 및 저작권 관련 사항 확인 여부", "short_label": "이용약관 확인"},
]

# LLM 모델 우선순위
LLM_PRIORITY_ORDER = ["gpt-oss-20b", "exaone-4.0-32b"]


class SelfCheckService:
    """셀프진단 서비스"""

    def __init__(self):
        self.prompts_dir = Path(__file__).parent.parent / "prompts"
        self._prompt_1_5 = None
        self._prompt_6_10 = None
        self._similarity_prompt = None
        self.client = http_manager.get_client("llm")
        # 임베딩 서비스 (유사과제 검토용)
        self.embedding_service = EmbeddingService(
            base_url=settings.EMBEDDING_URL,
            model=settings.EMBEDDING_MODEL
        )

    def _load_prompt(self, filename: str) -> str:
        """프롬프트 파일 로드"""
        path = self.prompts_dir / filename
        if path.exists():
            return path.read_text(encoding="utf-8")
        logger.warning(f"Prompt not found: {path}")
        return ""

    @property
    def prompt_1_5(self) -> str:
        """항목 1-5 프롬프트"""
        if self._prompt_1_5 is None:
            self._prompt_1_5 = self._load_prompt("selfcheck_prompt_1_5.txt")
        return self._prompt_1_5

    @property
    def prompt_6_10(self) -> str:
        """항목 6-10 프롬프트"""
        if self._prompt_6_10 is None:
            self._prompt_6_10 = self._load_prompt("selfcheck_prompt_6_10.txt")
        return self._prompt_6_10

    @property
    def similarity_prompt(self) -> str:
        """유사과제 판단 프롬프트"""
        if self._similarity_prompt is None:
            self._similarity_prompt = self._load_prompt("selfcheck_similarity.txt")
        return self._similarity_prompt

    def _cosine_similarity(self, vec1: List[float], vec2: List[float]) -> float:
        """코사인 유사도 계산"""
        import math
        dot_product = sum(a * b for a, b in zip(vec1, vec2))
        norm1 = math.sqrt(sum(a * a for a in vec1))
        norm2 = math.sqrt(sum(b * b for b in vec2))
        if norm1 == 0 or norm2 == 0:
            return 0.0
        return dot_product / (norm1 * norm2)

    async def _find_similar_projects(
        self,
        db: Session,
        current_project_text: str,
        exclude_submission_id: Optional[str] = None
    ) -> List[Tuple[SelfCheckSubmission, float]]:
        """
        유사 과제 검색 (임베딩 기반)

        Args:
            db: 데이터베이스 세션
            current_project_text: 현재 과제 텍스트 (과제명 + 과제내용)
            exclude_submission_id: 제외할 submission_id (자기 자신)

        Returns:
            List of (SelfCheckSubmission, similarity_score) tuples
        """
        if not settings.SELFCHECK_SIMILARITY_ENABLED:
            return []

        try:
            # 검토 기간 계산
            cutoff_date = datetime.utcnow() - timedelta(days=settings.SELFCHECK_SIMILARITY_DAYS)

            # 기존 과제 조회 (기간 내, completed 상태)
            query = db.query(SelfCheckSubmission).filter(
                SelfCheckSubmission.status == "completed",
                SelfCheckSubmission.created_at >= cutoff_date
            )
            if exclude_submission_id:
                query = query.filter(SelfCheckSubmission.submission_id != exclude_submission_id)

            existing_projects = query.order_by(SelfCheckSubmission.created_at.desc()).limit(100).all()

            if not existing_projects:
                logger.info("[SelfCheck] No existing projects found for similarity check")
                return []

            # 현재 과제 임베딩 생성
            current_embeddings = await self.embedding_service.get_embeddings(current_project_text)
            if not current_embeddings:
                logger.warning("[SelfCheck] Failed to generate embedding for current project")
                return []
            current_embedding = current_embeddings[0]

            # 기존 과제들 텍스트 준비 및 임베딩 생성
            project_texts = []
            for proj in existing_projects:
                text = f"{proj.project_name}\n{proj.project_description or ''}"
                project_texts.append(text)

            existing_embeddings = await self.embedding_service.get_embeddings(project_texts)
            if len(existing_embeddings) != len(existing_projects):
                logger.warning("[SelfCheck] Embedding count mismatch")
                return []

            # 유사도 계산
            candidates = []
            threshold = settings.SELFCHECK_SIMILARITY_THRESHOLD / 100.0
            for proj, emb in zip(existing_projects, existing_embeddings):
                similarity = self._cosine_similarity(current_embedding, emb)
                if similarity >= threshold:
                    candidates.append((proj, similarity))

            # 유사도 높은 순 정렬
            candidates.sort(key=lambda x: x[1], reverse=True)

            # 최대 결과 수 제한
            candidates = candidates[:settings.SELFCHECK_SIMILARITY_MAX_RESULTS * 2]  # LLM 검증 위해 여유분

            logger.info(f"[SelfCheck] Found {len(candidates)} similar project candidates")
            return candidates

        except Exception as e:
            logger.error(f"[SelfCheck] Similarity search failed: {e}")
            return []

    async def _verify_similarity_with_llm(
        self,
        url: str,
        model: str,
        current_project_name: str,
        current_project_desc: str,
        candidates: List[Tuple[SelfCheckSubmission, float]]
    ) -> List[SimilarProject]:
        """
        LLM을 사용하여 유사과제 최종 검증

        Args:
            url: LLM API URL
            model: LLM 모델명
            current_project_name: 현재 과제명
            current_project_desc: 현재 과제 내용
            candidates: 임베딩 기반 후보 과제들

        Returns:
            List[SimilarProject]: 검증된 유사 과제 목록
        """
        if not candidates:
            return []

        # 후보 과제 정보 구성
        candidate_info = []
        for i, (proj, score) in enumerate(candidates, 1):
            candidate_info.append(
                f"[후보 {i}]\n"
                f"- 과제명: {proj.project_name}\n"
                f"- 부서: {proj.department}\n"
                f"- 담당자: {proj.manager_name}\n"
                f"- 내용: {(proj.project_description or '')[:300]}\n"
                f"- 유사도: {int(score * 100)}%"
            )

        candidates_text = "\n\n".join(candidate_info)

        # 프롬프트 구성
        system_prompt = self.similarity_prompt or """당신은 과제 유사성 판단 전문가입니다.
현재 과제와 후보 과제들을 비교하여 실제로 유사한지 판단해주세요.

출력 형식 (JSON만 출력):
{"similar": [{"idx": 1, "reason": "유사 사유"}, {"idx": 2, "reason": "유사 사유"}]}

- idx: 후보 번호 (1부터 시작)
- reason: 유사하다고 판단한 구체적 이유 (20-50자)
- 유사하지 않으면 빈 배열: {"similar": []}"""

        user_prompt = f"""[현재 과제]
과제명: {current_project_name}
내용: {current_project_desc[:500]}

[후보 과제들]
{candidates_text}

위 후보들 중 현재 과제와 목적/기능/대상이 실질적으로 유사한 과제를 선별해주세요.
단순히 키워드가 겹치는 것이 아니라, 실제 중복 추진으로 볼 수 있는 과제만 선별합니다."""

        try:
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ]
            payload = {
                "model": model,
                "messages": messages,
                "temperature": settings.SELFCHECK_TEMPERATURE,
                "max_tokens": settings.SELFCHECK_SIMILARITY_MAX_TOKENS,
                "top_p": 0.9
            }

            response = await self.client.post(url, json=payload, timeout=float(settings.SELFCHECK_TIMEOUT))
            response.raise_for_status()
            result = response.json()

            # content가 비어있으면 reasoning_content 사용 (일부 모델 동작 방식)
            message = result["choices"][0]["message"]
            content = (message.get("content") or message.get("reasoning_content") or "").strip()

            logger.info(f"[SelfCheck] Similarity LLM response: {content[:300]}")

            # JSON 파싱
            json_match = re.search(r'\{[^{}]*"similar"[^{}]*\[.*?\][^{}]*\}', content, re.DOTALL)
            if not json_match:
                logger.warning("[SelfCheck] No valid JSON in similarity response")
                # LLM 검증 실패 시 임베딩 유사도만으로 결과 반환
                return self._fallback_similar_projects(candidates)

            parsed = json.loads(json_match.group(0))
            similar_items = parsed.get("similar", [])

            # 검증된 유사 과제 목록 생성
            verified = []
            for item in similar_items:
                idx = item.get("idx", 0) - 1  # 0-indexed
                reason = item.get("reason", "유사과제로 판단됨")
                if 0 <= idx < len(candidates):
                    proj, score = candidates[idx]
                    verified.append(SimilarProject(
                        submission_id=proj.submission_id,
                        project_name=proj.project_name,
                        department=proj.department,
                        manager_name=proj.manager_name,
                        similarity_score=int(score * 100),
                        similarity_reason=reason,
                        created_at=proj.created_at.isoformat() if proj.created_at else ""
                    ))

            # 최대 결과 수 제한
            verified = verified[:settings.SELFCHECK_SIMILARITY_MAX_RESULTS]
            logger.info(f"[SelfCheck] Verified {len(verified)} similar projects")
            return verified

        except Exception as e:
            logger.error(f"[SelfCheck] Similarity LLM verification failed: {e}")
            return self._fallback_similar_projects(candidates)

    def _fallback_similar_projects(
        self,
        candidates: List[Tuple[SelfCheckSubmission, float]]
    ) -> List[SimilarProject]:
        """LLM 검증 실패 시 임베딩 유사도만으로 유사과제 반환"""
        result = []
        high_threshold = settings.SELFCHECK_SIMILARITY_HIGH_THRESHOLD / 100.0
        for proj, score in candidates[:settings.SELFCHECK_SIMILARITY_MAX_RESULTS]:
            if score >= high_threshold:
                result.append(SimilarProject(
                    submission_id=proj.submission_id,
                    project_name=proj.project_name,
                    department=proj.department,
                    manager_name=proj.manager_name,
                    similarity_score=int(score * 100),
                    similarity_reason="높은 텍스트 유사도 기반 판단",
                    created_at=proj.created_at.isoformat() if proj.created_at else ""
                ))
        return result

    async def get_available_llm(self) -> Dict[str, Any]:
        """
        Health check 기반으로 사용 가능한 LLM 선택

        Returns:
            dict: {"key": str, "label": str, "url": str, "latency_ms": float}

        Raises:
            HTTPException: 사용 가능한 LLM이 없을 경우
        """
        health_result = await health_service.check_llm_models()
        models = health_result.get("models", [])

        # healthy 모델 필터링
        healthy_models = {
            m["key"]: m for m in models
            if m.get("status") == "healthy"
        }

        # 우선순위에 따라 선택
        for model_key in LLM_PRIORITY_ORDER:
            if model_key in healthy_models:
                model = healthy_models[model_key]
                llm_config = settings.get_llm_config(model_key)
                return {
                    "key": model_key,
                    "label": model.get("label", model_key),
                    "url": llm_config["base_url"],
                    "latency_ms": model.get("latency_ms")
                }

        # 모두 unhealthy
        raise HTTPException(
            status_code=503,
            detail="현재 사용 가능한 AI 모델이 없습니다. 잠시 후 다시 시도해주세요."
        )

    async def get_llm_status(self) -> LLMStatusResponse:
        """LLM 상태 조회"""
        health_result = await health_service.check_llm_models()
        models = health_result.get("models", [])

        all_models = [
            LLMModelStatus(
                key=m["key"],
                label=m.get("label", m["key"]),
                description=m.get("description", ""),
                status=m.get("status", "unknown"),
                latency_ms=m.get("latency_ms"),
                error=m.get("error")
            )
            for m in models
        ]

        # 선택된 모델 결정
        try:
            selected = await self.get_available_llm()
            return LLMStatusResponse(
                selected_model=selected["key"],
                selected_model_label=selected["label"],
                latency_ms=selected.get("latency_ms"),
                all_models=all_models
            )
        except HTTPException:
            # 모두 unhealthy인 경우
            return LLMStatusResponse(
                selected_model="none",
                selected_model_label="사용 불가",
                latency_ms=None,
                all_models=all_models
            )

    def _build_analysis_prompt(self, request: SelfCheckAnalyzeRequest) -> str:
        """분석 요청 프롬프트 생성"""
        return f"""## 과제 정보
- 과제명: {request.project_name}
- 담당부서: {request.department}
- 담당자: {request.manager_name}

## 과제 내용
{request.project_description}

위 과제에 대해 보안성 검토 체크리스트를 분석해주세요."""

    def _fix_json_string(self, json_str: str) -> str:
        """
        LLM이 생성한 불완전한 JSON 수정

        Args:
            json_str: 원본 JSON 문자열

        Returns:
            str: 수정된 JSON 문자열
        """
        # 0. LLM이 중간에 삽입한 주석/독백 제거
        # 패턴: "answer":"", "?? Wait..." 또는 "answer":"no", "Wait I need to..."
        json_str = re.sub(r'"\s*,?\s*"\?\?[^"]*"', '"', json_str)
        json_str = re.sub(r'"\s*,?\s*"Wait[^"]*"', '"', json_str)
        json_str = re.sub(r'"\s*,?\s*"Hold on[^"]*"', '"', json_str)
        json_str = re.sub(r'"\s*,?\s*"Let me[^"]*"', '"', json_str)

        # 0-1. 중복된 JSON 시작 제거 (LLM이 다시 시작한 경우)
        # {"items":...{"items": 패턴 찾아서 첫 번째만 유지
        if json_str.count('{"items"') > 1:
            first_items = json_str.find('{"items"')
            second_items = json_str.find('{"items"', first_items + 1)
            if second_items > 0:
                # 두 번째 시작 전까지만 사용
                json_str = json_str[:second_items]

        # 1. 유니코드 따옴표/특수문자 정규화
        quote_replacements = {
            '「': '"', '」': '"', '『': '"', '』': '"',
            '"': '"', '"': '"', ''': "'", ''': "'",
            '„': '"', '‟': '"', '«': '"', '»': '"',
            '‹': "'", '›': "'",
            '：': ':', '，': ',', '；': ';',
            '０': '0', '１': '1', '２': '2', '３': '3', '４': '4',
            '５': '5', '６': '6', '７': '7', '８': '8', '９': '9',
            '．': '.', '｛': '{', '｝': '}', '［': '[', '］': ']',
            '\u3000': ' ', '　': ' ',
        }
        for old, new in quote_replacements.items():
            json_str = json_str.replace(old, new)

        # 2. 제어 문자 제거 (탭, 줄바꿈 제외)
        json_str = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f]', '', json_str)

        # 3. 후행 쉼표 제거 (배열/객체 닫기 전)
        json_str = re.sub(r',\s*([}\]])', r'\1', json_str)

        # 4. 빈 answer 값 수정 ("answer":"" -> "answer":"need_check")
        json_str = re.sub(r'"answer"\s*:\s*""', '"answer":"need_check"', json_str)

        # 5. 잘린 JSON 복구 시도 - 마지막 완전한 항목까지 유지
        if '"items"' in json_str:
            # 완전한 항목 패턴: "risk_level":"xxx"}
            complete_items = list(re.finditer(r'"risk_level"\s*:\s*"[^"]+"\s*}', json_str))
            if complete_items:
                last_complete_end = complete_items[-1].end()
                # 마지막 완전한 항목 이후 내용 제거
                remaining = json_str[last_complete_end:]
                if ']' not in remaining or '}' not in remaining:
                    json_str = json_str[:last_complete_end]
                    json_str += '],"requires_review":false,"review_reason":"","summary":"부분 분석 완료"}'

        return json_str

    def _extract_items_from_corrupted(self, text: str) -> Dict[str, Any]:
        """
        손상된 JSON에서 유효한 항목만 추출하여 재구성

        Args:
            text: 손상된 JSON 텍스트

        Returns:
            dict: 재구성된 결과
        """
        # 완전한 항목 패턴: {"item_number":N,"answer":"X","confidence":N,"evidence":"X","risk_level":"X"}
        item_pattern = r'\{\s*"item_number"\s*:\s*(\d+)\s*,\s*"answer"\s*:\s*"([^"]*)"\s*,\s*"confidence"\s*:\s*([0-9.]+)\s*,\s*"evidence"\s*:\s*"([^"]*)"\s*,\s*"risk_level"\s*:\s*"([^"]+)"\s*\}'

        matches = re.findall(item_pattern, text)
        if not matches:
            logger.warning("[SelfCheck] No valid items found in corrupted JSON")
            raise ValueError("유효한 항목을 찾을 수 없습니다.")

        items = []
        seen_numbers = set()
        for match in matches:
            item_num = int(match[0])
            # 중복 항목 무시 (첫 번째 것만 사용)
            if item_num in seen_numbers:
                continue
            seen_numbers.add(item_num)

            answer = match[1] if match[1] in ("yes", "no", "need_check") else "need_check"
            items.append({
                "item_number": item_num,
                "answer": answer,
                "confidence": float(match[2]) if match[2] else 0.5,
                "evidence": match[3] or "분석 내용 없음",
                "risk_level": match[4] if match[4] in ("high", "medium", "low") else "medium"
            })

        # item_number로 정렬
        items.sort(key=lambda x: x["item_number"])

        # requires_review 결정: 필수항목(1-4) 중 yes가 있으면 true
        requires_review = any(
            item["item_number"] <= 4 and item["answer"] == "yes"
            for item in items
        )

        logger.info(f"[SelfCheck] Extracted {len(items)} valid items from corrupted JSON: {[i['item_number'] for i in items]}")

        return {
            "items": items,
            "requires_review": requires_review,
            "review_reason": "필수 항목 중 '예' 응답이 있어 검토 필요" if requires_review else "",
            "summary": f"{len(items)}개 항목 분석 완료"
        }

    def _parse_llm_response(self, response_text: str) -> Dict[str, Any]:
        """
        LLM 응답 파싱

        Args:
            response_text: LLM 응답 텍스트

        Returns:
            dict: 파싱된 결과
        """
        # JSON 블록 추출
        json_match = re.search(r'```json\s*([\s\S]*?)\s*```', response_text)
        if json_match:
            json_str = json_match.group(1)
        else:
            # JSON 블록이 없으면 전체 텍스트에서 JSON 찾기
            json_match = re.search(r'\{[\s\S]*\}', response_text)
            if json_match:
                json_str = json_match.group(0)
            else:
                json_str = response_text

        # 1차 시도: 원본 파싱
        try:
            result = json.loads(json_str)
            if "items" in result and len(result["items"]) > 0:
                return result
        except json.JSONDecodeError:
            pass

        # 2차 시도: JSON 수정 후 파싱
        try:
            fixed_json = self._fix_json_string(json_str)
            result = json.loads(fixed_json)
            if "items" in result and len(result["items"]) > 0:
                logger.info(f"[SelfCheck] Parsed fixed JSON successfully")
                return result
        except json.JSONDecodeError as e:
            logger.warning(f"[SelfCheck] JSON fix failed: {e}")

        # 3차 시도: 손상된 JSON에서 항목 직접 추출
        try:
            logger.info("[SelfCheck] Attempting to extract items from corrupted JSON")
            return self._extract_items_from_corrupted(response_text)
        except ValueError as e:
            logger.error(f"[SelfCheck] All parsing methods failed: {e}")
            logger.error(f"[SelfCheck] Original response: {response_text[:1500]}")
            raise ValueError(f"LLM 응답 파싱 실패: {e}")

    def _determine_match_status(self, user_answer: Optional[str], llm_answer: str) -> str:
        """
        사용자 선택과 LLM 분석 결과 비교하여 일치 상태 결정

        Returns:
            str: match, mismatch, reference, keep
        """
        if user_answer is None or user_answer == "unknown":
            # 사용자가 "모름" 선택 -> LLM 결과 참조
            return "reference"
        if llm_answer == "need_check":
            # LLM이 확인 필요로 판단 -> 사용자 선택 유지
            return "keep"
        if user_answer == llm_answer:
            return "match"
        return "mismatch"

    def _safe_float(self, val: Any, default: float = 0.8) -> float:
        """안전한 float 변환"""
        if val is None:
            return default
        try:
            return float(val)
        except (ValueError, TypeError):
            return default

    async def _call_llm_batch(
        self,
        url: str,
        model: str,
        system_prompt: str,
        user_prompt: str,
        batch_name: str
    ) -> List[Dict[str, Any]]:
        """단일 배치 LLM 호출"""
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]
        payload = {
            "model": model,
            "messages": messages,
            "temperature": settings.SELFCHECK_TEMPERATURE,
            "max_tokens": settings.SELFCHECK_BATCH_MAX_TOKENS,
            "top_p": 0.9,
        }

        try:
            response = await self.client.post(url, json=payload, timeout=float(settings.SELFCHECK_TIMEOUT))
            response.raise_for_status()
            result = response.json()
            message = result["choices"][0]["message"]
            # content가 비어있으면 reasoning_content 사용 (일부 모델 동작 방식)
            content = message.get("content") or message.get("reasoning_content") or ""
            logger.info(f"[SelfCheck] {batch_name} raw response ({len(content)} chars): {content[:500]}")

            # JSON 파싱 시도
            converted = self._parse_batch_response(content, batch_name)
            if converted:
                return converted

        except Exception as e:
            logger.error(f"[SelfCheck] {batch_name} request failed: {e}")

        return []

    def _parse_batch_response(self, content: str, batch_name: str) -> List[Dict[str, Any]]:
        """배치 응답 파싱"""
        # 1차 시도: 전체 JSON 파싱
        try:
            json_match = re.search(r'\{[\s\S]*\}', content)
            if json_match:
                parsed = json.loads(json_match.group(0))
                items = parsed.get("items", [])
                if items:
                    return self._convert_items(items, batch_name)
        except json.JSONDecodeError as e:
            logger.warning(f"[SelfCheck] {batch_name} JSON parse failed: {e}")

        # 2차 시도: 개별 항목 추출 (정규식)
        try:
            # {"n":1,"a":"no","c":0.9,"e":"..."} 패턴
            item_pattern = r'\{\s*"n"\s*:\s*(\d+)\s*,\s*"a"\s*:\s*"([^"]*)"\s*,\s*"c"\s*:\s*([0-9.]+)\s*,\s*"e"\s*:\s*"([^"]*)"\s*\}'
            matches = re.findall(item_pattern, content)
            if matches:
                converted = []
                for match in matches:
                    converted.append({
                        "item_number": int(match[0]),
                        "answer": self._normalize_answer(match[1]),
                        "confidence": self._safe_float(match[2]),
                        "evidence": match[3] or "분석 완료",
                        "risk_level": "medium"
                    })
                logger.info(f"[SelfCheck] {batch_name} regex extracted {len(converted)} items")
                return converted
        except Exception as e:
            logger.warning(f"[SelfCheck] {batch_name} regex extraction failed: {e}")

        # 3차 시도: 더 유연한 패턴
        try:
            # 각 필드를 개별적으로 찾기
            items = []
            n_matches = re.findall(r'"n"\s*:\s*(\d+)', content)
            a_matches = re.findall(r'"a"\s*:\s*"([^"]*)"', content)
            e_matches = re.findall(r'"e"\s*:\s*"([^"]*)"', content)

            for i, n in enumerate(n_matches):
                items.append({
                    "item_number": int(n),
                    "answer": self._normalize_answer(a_matches[i] if i < len(a_matches) else ""),
                    "confidence": 0.8,
                    "evidence": e_matches[i] if i < len(e_matches) else "분석 완료",
                    "risk_level": "medium"
                })
            if items:
                logger.info(f"[SelfCheck] {batch_name} flexible extraction got {len(items)} items")
                return items
        except Exception as e:
            logger.warning(f"[SelfCheck] {batch_name} flexible extraction failed: {e}")

        logger.error(f"[SelfCheck] {batch_name} all parsing methods failed. Content: {content[:1000]}")
        return []

    def _convert_items(self, items: List[Dict], batch_name: str) -> List[Dict[str, Any]]:
        """항목 변환"""
        converted = []
        for item in items:
            try:
                # 축약 필드명(n,a,c,e) 또는 정식 필드명 지원
                item_num = item.get("n") or item.get("item_number")
                answer = item.get("a") or item.get("answer") or ""
                confidence = item.get("c") or item.get("confidence")
                evidence = item.get("e") or item.get("evidence") or ""
                risk = item.get("r") or item.get("risk_level") or "medium"

                if item_num is not None:
                    converted.append({
                        "item_number": int(item_num),
                        "answer": self._normalize_answer(answer),
                        "confidence": self._safe_float(confidence),
                        "evidence": evidence if evidence else "분석 완료",
                        "risk_level": risk
                    })
            except Exception as e:
                logger.warning(f"[SelfCheck] {batch_name} item conversion error: {e}, item: {item}")
                continue

        logger.info(f"[SelfCheck] {batch_name} converted {len(converted)} items")
        return converted

    def _normalize_answer(self, answer: str) -> str:
        """답변 정규화"""
        if not answer:
            return "need_check"
        answer = answer.lower().strip()
        if answer in ("yes", "y", "예"):
            return "yes"
        if answer in ("no", "n", "아니오", "아니요"):
            return "no"
        if answer in ("unknown", "?", "모름"):
            return "need_check"
        return "need_check"

    async def _recover_missing_items(
        self,
        url: str,
        model: str,
        user_prompt: str,
        missing_items: List[int]
    ) -> List[Dict[str, Any]]:
        """누락된 항목을 개별 호출로 보완"""
        import asyncio

        # 체크리스트 질문 매핑
        questions = {
            1: "내부시스템 연계 필요 여부",
            2: "개인정보(성명, 연락처) 수집 여부",
            3: "민감정보(건강, 정치) 활용 여부",
            4: "비공개자료 AI 입력 여부",
            5: "외부 클라우드 AI(ChatGPT 등) 사용 여부",
            6: "자체 AI 모델 구축/학습 계획 여부",
            7: "대국민 서비스 제공 예정 여부",
            8: "외부 API 연동 필요 여부",
            9: "생성 결과물 검증 절차 마련 여부",
            10: "AI 이용약관/저작권 확인 여부",
        }

        async def recover_single(item_num: int) -> Optional[Dict[str, Any]]:
            """단일 항목 복구"""
            question = questions.get(item_num, "")
            messages = [
                {"role": "system", "content": "You are a JSON generator. Output ONLY valid JSON."},
                {"role": "user", "content": f"""다음 과제를 분석하고 질문에 답하세요.

과제 내용:
{user_prompt}

질문 {item_num}번: {question}

답변 형식 (이 형식으로만 출력):
{{"n":{item_num},"a":"yes","c":0.85,"e":"분석근거"}}

규칙:
- a: "yes", "no", "unknown" 중 하나
- e: 한국어 10-20자"""}
            ]
            payload = {
                "model": model,
                "messages": messages,
                "temperature": settings.SELFCHECK_TEMPERATURE,
                "max_tokens": settings.SELFCHECK_RECOVERY_MAX_TOKENS,
                "top_p": 0.9,
            }
            try:
                response = await self.client.post(url, json=payload, timeout=float(settings.SELFCHECK_RECOVERY_TIMEOUT))
                response.raise_for_status()
                result = response.json()
                message = result["choices"][0]["message"]
                # content가 비어있으면 reasoning_content 사용
                content = (message.get("content") or message.get("reasoning_content") or "").strip()
                logger.info(f"[SelfCheck] Recovery item {item_num} response: [{content[:150]}]")

                # 파싱
                json_match = re.search(r'\{[^}]+\}', content)
                if json_match:
                    parsed = json.loads(json_match.group(0))
                    return {
                        "item_number": int(parsed.get("n", item_num)),
                        "answer": self._normalize_answer(parsed.get("a", "")),
                        "confidence": self._safe_float(parsed.get("c")),
                        "evidence": parsed.get("e", "보완 분석 완료"),
                        "risk_level": "medium"
                    }
            except Exception as e:
                logger.warning(f"[SelfCheck] Recovery failed for item {item_num}: {e}")
            return None

        # 병렬로 누락 항목 복구
        tasks = [recover_single(n) for n in missing_items]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        recovered = []
        for r in results:
            if isinstance(r, dict):
                recovered.append(r)

        logger.info(f"[SelfCheck] Recovered {len(recovered)}/{len(missing_items)} items")
        return recovered

    async def analyze(
        self,
        request: SelfCheckAnalyzeRequest,
        user_id: Optional[int] = None,
        db: Optional[Session] = None
    ) -> SelfCheckAnalyzeResponse:
        """
        셀프진단 분석 실행 (두 번의 병렬 LLM 호출)
        """
        import asyncio
        start_time = datetime.now()
        submission_id = str(uuid.uuid4())

        # 1. 사용 가능한 LLM 선택
        selected_llm = await self.get_available_llm()
        model_key = selected_llm["key"]
        llm_config = settings.get_llm_config(model_key)
        url = f"{llm_config['base_url']}/v1/chat/completions"
        model = llm_config["model"]

        # 2. 사용자 프롬프트 생성
        user_prompt = self._build_analysis_prompt(request)

        logger.info(f"[SelfCheck] Starting parallel LLM calls: {model_key}")

        # 3. 두 배치 병렬 호출
        batch1_task = self._call_llm_batch(url, model, self.prompt_1_5, user_prompt, "Batch1(1-5)")
        batch2_task = self._call_llm_batch(url, model, self.prompt_6_10, user_prompt, "Batch2(6-10)")

        results = await asyncio.gather(batch1_task, batch2_task, return_exceptions=True)

        # 4. 결과 병합
        all_items = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                logger.error(f"[SelfCheck] Batch {i+1} raised exception: {result}")
            elif isinstance(result, list):
                all_items.extend(result)

        # 5. 결과 매핑
        llm_items = {item["item_number"]: item for item in all_items}
        user_items = {item.item_number: item for item in request.checklist_items}

        # 로그: LLM이 반환한 항목 수 확인
        logger.info(f"[SelfCheck] LLM returned {len(llm_items)} items: {list(llm_items.keys())}")

        # 5-1. 누락 항목 보완 (개별 호출)
        missing_items = [i for i in range(1, 11) if i not in llm_items]
        if missing_items:
            logger.info(f"[SelfCheck] Missing items detected: {missing_items}, attempting recovery...")
            recovered = await self._recover_missing_items(
                url, model, user_prompt, missing_items
            )
            for item in recovered:
                llm_items[item["item_number"]] = item
            logger.info(f"[SelfCheck] After recovery: {len(llm_items)} items")

        result_items: List[SelfCheckItemResult] = []
        for checklist_item in CHECKLIST_ITEMS:
            num = checklist_item["number"]
            user_input = user_items.get(num)
            llm_result = llm_items.get(num, {})

            user_answer = user_input.user_answer if user_input else None
            llm_answer = llm_result.get("answer", "need_check")

            # Evidence 처리: LLM이 반환하지 않은 경우 기본 메시지 제공
            evidence = llm_result.get("evidence", "")
            if not evidence:
                if num not in llm_items:
                    evidence = "AI가 해당 항목을 분석하지 못했습니다. 담당자 확인이 필요합니다."
                else:
                    evidence = "분석 근거가 제공되지 않았습니다."

            result_items.append(SelfCheckItemResult(
                item_number=num,
                item_category=checklist_item["category"],
                question=checklist_item["question"],
                short_label=checklist_item["short_label"],
                user_answer=user_answer,
                user_details=user_input.user_details if user_input else None,
                llm_answer=llm_answer,
                llm_confidence=llm_result.get("confidence", 0.5),
                llm_evidence=evidence,
                llm_risk_level=llm_result.get("risk_level", "medium"),
                match_status=self._determine_match_status(user_answer, llm_answer),
                final_answer=None
            ))

        # 6. 상위기관 검토 대상 여부 결정 (필수항목 1-4 중 yes가 있으면)
        requires_review = False
        review_reason = None
        for item in result_items:
            if item.item_category == "required" and item.llm_answer == "yes":
                requires_review = True
                review_reason = f"필수 항목 {item.item_number}번({item.short_label})이 '예'로 판정됨"
                break

        # 7. 다음 단계 안내
        if requires_review:
            next_steps = [
                "보안성 검토 서류 6종 작성",
                "정보보호팀 제출 (security@kca.kr)",
                "CAIO/BAIO 추진과제 선정 회의 상정"
            ]
        else:
            next_steps = [
                "과제 추진 가능",
                "필요 시 정보보호팀 사전 상담 권장"
            ]

        # 7. 분석 시간 계산
        analysis_time_ms = int((datetime.now() - start_time).total_seconds() * 1000)

        # 8. DB 저장 (로그인한 경우)
        is_saved = False
        if db and user_id:
            try:
                # 분석 결과를 JSON으로 저장
                analysis_result_json = {
                    "items": [
                        {
                            "item_number": item.item_number,
                            "llm_answer": item.llm_answer,
                            "llm_evidence": item.llm_evidence,
                            "llm_confidence": item.llm_confidence,
                            "llm_risk_level": item.llm_risk_level
                        }
                        for item in result_items
                    ]
                }
                submission = SelfCheckSubmission(
                    submission_id=submission_id,
                    project_name=request.project_name,
                    department=request.department,
                    manager_name=request.manager_name,
                    contact=request.contact,
                    email=request.email,
                    project_description=request.project_description,
                    analysis_result=analysis_result_json,
                    requires_review=requires_review,
                    review_reason=review_reason,
                    used_model=model_key,
                    analysis_time_ms=analysis_time_ms,
                    user_id=user_id,
                    status="completed"
                )
                db.add(submission)

                # 체크리스트 항목 저장
                for item in result_items:
                    db_item = SelfCheckItem(
                        submission_id=submission_id,
                        item_number=item.item_number,
                        item_category=item.item_category,
                        question=item.question,
                        user_answer=item.user_answer,
                        user_details=item.user_details,
                        llm_answer=item.llm_answer,
                        llm_confidence=item.llm_confidence,
                        llm_evidence=item.llm_evidence,
                        llm_risk_level=item.llm_risk_level,
                        final_answer=item.final_answer
                    )
                    db.add(db_item)

                db.commit()
                is_saved = True
                logger.info(f"[SelfCheck] Submission saved: {submission_id}")
            except Exception as e:
                db.rollback()
                logger.error(f"[SelfCheck] Failed to save submission: {e}")
                # 저장 실패해도 분석 결과는 반환

        # 요약 메시지 생성
        analyzed_count = len([i for i in result_items if i.llm_evidence and "분석하지 못했습니다" not in i.llm_evidence])
        summary_msg = f"총 {len(result_items)}개 항목 중 {analyzed_count}개 항목 AI 분석 완료"

        # 9. 유사 과제 검토 (DB 세션이 있는 경우에만)
        similar_projects: List[SimilarProject] = []
        if db and settings.SELFCHECK_SIMILARITY_ENABLED:
            try:
                # 현재 과제 텍스트 구성
                current_project_text = f"{request.project_name}\n{request.project_description or ''}"

                # 유사 과제 후보 검색
                candidates = await self._find_similar_projects(
                    db=db,
                    current_project_text=current_project_text,
                    exclude_submission_id=submission_id
                )

                # LLM으로 유사성 검증
                if candidates:
                    similar_projects = await self._verify_similarity_with_llm(
                        url=url,
                        model=model,
                        current_project_name=request.project_name,
                        current_project_desc=request.project_description or "",
                        candidates=candidates
                    )
                    logger.info(f"[SelfCheck] Found {len(similar_projects)} similar projects")
            except Exception as e:
                logger.error(f"[SelfCheck] Similar project check failed: {e}")
                # 유사과제 검토 실패해도 분석 결과는 반환

        return SelfCheckAnalyzeResponse(
            submission_id=submission_id,
            requires_review=requires_review,
            review_reason=review_reason,
            items=result_items,
            summary=summary_msg,
            next_steps=next_steps,
            used_model=model_key,
            analysis_time_ms=analysis_time_ms,
            is_saved=is_saved,
            similar_projects=similar_projects
        )

    def get_history(
        self,
        db: Session,
        user_id: int,
        skip: int = 0,
        limit: int = 20
    ) -> SelfCheckHistoryResponse:
        """사용자의 진단 이력 조회"""
        query = db.query(SelfCheckSubmission).filter(
            SelfCheckSubmission.user_id == user_id
        ).order_by(SelfCheckSubmission.created_at.desc())

        total = query.count()
        submissions = query.offset(skip).limit(limit).all()

        items = [
            SelfCheckHistoryItem(
                id=s.id,
                submission_id=s.submission_id,
                project_name=s.project_name,
                department=s.department,
                manager_name=s.manager_name,
                requires_review=s.requires_review,
                status=s.status,
                used_model=s.used_model,
                created_at=s.created_at.isoformat() if s.created_at else ""
            )
            for s in submissions
        ]

        return SelfCheckHistoryResponse(total=total, items=items)

    def get_submission(
        self,
        db: Session,
        submission_id: str,
        user_id: Optional[int] = None
    ) -> SelfCheckDetailResponse:
        """특정 진단 상세 조회"""
        query = db.query(SelfCheckSubmission).filter(
            SelfCheckSubmission.submission_id == submission_id
        )

        if user_id:
            query = query.filter(SelfCheckSubmission.user_id == user_id)

        submission = query.first()
        if not submission:
            raise HTTPException(status_code=404, detail="진단 결과를 찾을 수 없습니다.")

        # 체크리스트 항목 조회
        db_items = db.query(SelfCheckItem).filter(
            SelfCheckItem.submission_id == submission_id
        ).order_by(SelfCheckItem.item_number).all()

        items = [
            SelfCheckItemResult(
                item_number=item.item_number,
                item_category=item.item_category,
                question=item.question,
                short_label=CHECKLIST_ITEMS[item.item_number - 1]["short_label"],
                user_answer=item.user_answer,
                user_details=item.user_details,
                llm_answer=item.llm_answer or "need_check",
                llm_confidence=item.llm_confidence or 0.5,
                llm_evidence=item.llm_evidence or "",
                llm_risk_level=item.llm_risk_level or "medium",
                match_status=self._determine_match_status(item.user_answer, item.llm_answer or "need_check"),
                final_answer=item.final_answer
            )
            for item in db_items
        ]

        return SelfCheckDetailResponse(
            id=submission.id,
            submission_id=submission.submission_id,
            project_name=submission.project_name,
            department=submission.department,
            manager_name=submission.manager_name,
            contact=submission.contact,
            email=submission.email,
            project_description=submission.project_description,
            requires_review=submission.requires_review,
            review_reason=submission.review_reason,
            used_model=submission.used_model,
            analysis_time_ms=submission.analysis_time_ms,
            status=submission.status,
            created_at=submission.created_at.isoformat() if submission.created_at else "",
            items=items
        )


# 싱글톤 인스턴스
selfcheck_service = SelfCheckService()
