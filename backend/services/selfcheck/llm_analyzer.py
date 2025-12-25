"""
셀프진단 LLM 분석 서비스
개별 항목 분석 및 종합의견 생성
"""
import asyncio
import json
import logging
import re
from pathlib import Path
from typing import Any, Dict, List, Optional, TYPE_CHECKING

from fastapi import HTTPException

from backend.config.settings import settings
from backend.services.health_service import health_service
from backend.services.llm_service import LLMService
from .json_parser import SelfCheckJsonParser

if TYPE_CHECKING:
    from backend.models.schemas import SelfCheckItemResult, SimilarProject

logger = logging.getLogger(__name__)

# LLM 모델 우선순위
LLM_PRIORITY_ORDER = ["gpt-oss-20b", "exaone-4.0-32b"]

# 체크리스트 항목 정의
CHECKLIST_ITEMS = [
    {"number": 1, "category": "required", "question": "내부 정보시스템(업무포털, 무선국검사, 자격검정 등)과 연계 필요 여부", "short_label": "내부시스템 연계"},
    {"number": 2, "category": "required", "question": "개인정보(성명, 주민등록번호, 연락처 등) 수집/처리/저장 여부", "short_label": "개인정보 처리"},
    {"number": 3, "category": "required", "question": "민감정보(건강정보, 사상/신념, 정치적 견해 등) 활용 여부", "short_label": "민감정보 활용"},
    {"number": 4, "category": "required", "question": "비공개 업무자료(내부문서, 대외비 등) AI 서비스 입력 여부", "short_label": "비공개자료 AI입력"},
    {"number": 5, "category": "required", "question": "대국민 서비스 제공 예정 여부", "short_label": "대국민 서비스"},
    {"number": 6, "category": "optional", "question": "외부 클라우드 기반 AI 서비스(ChatGPT, Claude 등) 활용 여부", "short_label": "외부 클라우드 AI"},
    {"number": 7, "category": "optional", "question": "자체 AI 모델 구축/학습 계획 여부", "short_label": "자체 AI 모델"},
    {"number": 8, "category": "optional", "question": "외부 API 연동(OpenAI API, 외부 데이터 수집 등) 필요 여부", "short_label": "외부 API 연동"},
    {"number": 9, "category": "optional", "question": "생성 결과물의 정확성/윤리성 검증 절차 마련 여부", "short_label": "검증 절차"},
    {"number": 10, "category": "optional", "question": "AI 서비스 이용약관 및 저작권 관련 사항 확인 여부", "short_label": "이용약관 확인"},
]


class LLMAnalyzer:
    """LLM 기반 셀프진단 분석기"""

    def __init__(
        self,
        http_client: Any,
        llm_service: LLMService,
        prompts_dir: Path
    ):
        self.client = http_client
        self.llm_service = llm_service
        self.prompts_dir = prompts_dir
        self.json_parser = SelfCheckJsonParser()
        self._individual_prompt: Optional[str] = None
        self._summary_prompt: Optional[str] = None

    def _load_prompt(self, filename: str) -> str:
        """프롬프트 파일 로드"""
        path = self.prompts_dir / filename
        if path.exists():
            return path.read_text(encoding="utf-8")
        logger.warning(f"Prompt not found: {path}")
        return ""

    @property
    def individual_prompt(self) -> str:
        """개별 항목 분석용 프롬프트"""
        if self._individual_prompt is None:
            self._individual_prompt = self._load_prompt("selfcheck_individual.md")
        return self._individual_prompt

    @property
    def summary_prompt(self) -> str:
        """종합의견 생성용 프롬프트"""
        if self._summary_prompt is None:
            self._summary_prompt = self._load_prompt("selfcheck_summary.md")
        return self._summary_prompt

    async def get_available_llm(self) -> Dict[str, Any]:
        """
        Health check 기반으로 사용 가능한 LLM 선택
        """
        health_result = await health_service.check_llm_models()
        models = health_result.get("models", [])

        healthy_models = {
            m["key"]: m for m in models
            if m.get("status") == "healthy"
        }

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

        raise HTTPException(
            status_code=503,
            detail="현재 사용 가능한 AI 모델이 없습니다. 잠시 후 다시 시도해주세요."
        )

    async def get_llm_status(self):
        """LLM 상태 조회"""
        from backend.models.schemas import LLMStatusResponse, LLMModelStatus

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

        try:
            selected = await self.get_available_llm()
            return LLMStatusResponse(
                selected_model=selected["key"],
                selected_model_label=selected["label"],
                latency_ms=selected.get("latency_ms"),
                all_models=all_models
            )
        except HTTPException:
            return LLMStatusResponse(
                selected_model="none",
                selected_model_label="사용 불가",
                latency_ms=None,
                all_models=all_models
            )

    def _format_user_answer(self, answer: Optional[str]) -> str:
        """사용자 답변을 한국어로 변환"""
        if answer == "yes":
            return "예"
        elif answer == "no":
            return "아니오"
        elif answer == "unknown" or answer is None:
            return "모름"
        return "모름"

    async def call_llm_individual(
        self,
        url: str,
        model: str,
        item_number: int,
        question: str,
        project_content: str,
        user_answer: Optional[str] = None,
        user_details: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        개별 항목 LLM 분석 (교차검증 통합)
        """
        user_info = ""
        if user_answer:
            user_info = f"\n\nUSER'S ANSWER: \"{self._format_user_answer(user_answer)}\""
            if user_details:
                user_info += f"\nUSER'S REASON: \"{user_details}\""
            user_info += "\n\n주의: 사용자 답변과 AI 분석이 다를 경우 반드시 user_comparison 필드를 작성하세요."

        user_prompt = f"""Analyze and respond with JSON ONLY.

ITEM: {item_number}
QUESTION: {question}
{user_info}

PROJECT:
{project_content[:2000]}

RESPOND WITH THIS EXACT JSON FORMAT (use short field names):
{{"n":{item_number},"a":"yes","c":0.9,"j":"판단요약","q":"인용문","r":"분석이유","uc":""}}

RULES:
- a: "yes", "no", or "unknown"
- j: 판단 요약 (한국어, 15-25자)
- q: 과제내용에서 인용 또는 "관련 언급 없음"
- r: 분석 이유 (한국어, 50-150자)
- uc: 사용자와 다르면 비교 설명, 같으면 ""
- Start with {{ end with }}"""

        messages = [
            {"role": "system", "content": self.individual_prompt},
            {"role": "user", "content": user_prompt}
        ]

        payload = {
            "model": model,
            "messages": messages,
            "temperature": settings.SELFCHECK_TEMPERATURE,
            "max_tokens": settings.SELFCHECK_INDIVIDUAL_MAX_TOKENS,
            "top_p": 0.9,
        }

        max_retries = settings.SELFCHECK_MAX_RETRIES
        for attempt in range(max_retries + 1):
            try:
                response = await self.client.post(url, json=payload, timeout=float(settings.SELFCHECK_TIMEOUT))
                response.raise_for_status()
                result = response.json()
                message = result["choices"][0]["message"]
                raw_content = (message.get("content") or message.get("reasoning_content") or "").strip()

                content = self.json_parser.sanitize_llm_response(raw_content)

                if len(content) < 15 or content == "{" or not content.startswith("{"):
                    if attempt < max_retries:
                        logger.warning(f"[SelfCheck] Item {item_number} empty/invalid response, retry {attempt + 1}")
                        await asyncio.sleep(settings.SELFCHECK_RETRY_DELAY)
                        continue
                    else:
                        logger.error(f"[SelfCheck] Item {item_number} failed after {max_retries} retries")
                        return None

                logger.info(f"[SelfCheck] Item {item_number} raw response: {content[:300]}")

                parsed = self.json_parser.parse_individual_response(content, item_number, user_answer)
                if parsed:
                    is_truncated = (
                        not parsed.get("judgment") or
                        not parsed.get("reasoning") or
                        (parsed.get("judgment", "").endswith(("...", "…")) if parsed.get("judgment") else False)
                    )

                    if is_truncated and attempt < max_retries:
                        logger.warning(f"[SelfCheck] Item {item_number} truncated response, retry {attempt + 1}")
                        await asyncio.sleep(settings.SELFCHECK_RETRY_DELAY)
                        continue

                    return parsed

                if attempt < max_retries:
                    logger.warning(f"[SelfCheck] Item {item_number} parse failed, retry {attempt + 1}")
                    await asyncio.sleep(settings.SELFCHECK_RETRY_DELAY)
                    continue

            except Exception as e:
                if attempt < max_retries:
                    logger.warning(f"[SelfCheck] Item {item_number} request error, retry {attempt + 1}: {e}")
                    await asyncio.sleep(settings.SELFCHECK_RETRY_DELAY)
                    continue
                logger.error(f"[SelfCheck] Item {item_number} request failed after {max_retries} retries: {e}")

        return None

    async def generate_summary_with_llm(
        self,
        model: str,
        project_name: str,
        project_description: str,
        department: str,
        requires_review: bool,
        review_reason: Optional[str],
        result_items: List["SelfCheckItemResult"],
        similar_projects: List["SimilarProject"]
    ) -> str:
        """
        LLM을 사용하여 종합의견 생성
        """
        checklist_summary = []
        for item in result_items:
            short_label = next(
                (c["short_label"] for c in CHECKLIST_ITEMS if c["number"] == item.item_number),
                f"항목{item.item_number}"
            )
            checklist_summary.append({
                "item_number": item.item_number,
                "category": item.item_category,
                "short_label": short_label,
                "user_answer": item.user_answer,
                "llm_answer": item.llm_answer,
                "match_status": item.match_status,
                "llm_evidence": item.llm_evidence[:200] if item.llm_evidence else ""
            })

        similar_summary = [
            {
                "project_name": sp.project_name,
                "department": sp.department,
                "similarity_score": sp.similarity_score,
                "similarity_reason": sp.similarity_reason
            }
            for sp in similar_projects
        ]

        mismatch_items = [item for item in checklist_summary if item["match_status"] == "mismatch"]
        mismatch_summary = ", ".join([f"{item['item_number']}번({item['short_label']})" for item in mismatch_items]) if mismatch_items else "없음"

        required_yes = [item for item in checklist_summary if item["category"] == "required" and item["llm_answer"] == "yes"]
        required_summary = ", ".join([f"{item['item_number']}번({item['short_label']})" for item in required_yes]) if required_yes else "해당없음"

        review_status = "필요" if requires_review else "불필요"
        user_prompt = f"""다음 셀프진단 결과를 바탕으로 5줄 이상의 종합의견을 작성하세요.

[과제 정보]
- 과제명: {project_name}
- 부서: {department or "미지정"}
- 과제 설명: {project_description[:1000] if project_description else "설명 없음"}

[보안성 검토 판정]
- 검토 필요: {review_status}
- 사유: {review_reason or "해당 없음"}

[불일치 항목]
{mismatch_summary}

[필수항목 중 해당 사항]
{required_summary}

[전체 체크리스트 분석 결과]
{json.dumps(checklist_summary, ensure_ascii=False, indent=2)}

[유사과제]
{json.dumps(similar_summary, ensure_ascii=False, indent=2) if similar_summary else "없음"}

위 정보를 바탕으로 아래 5개 내용을 포함한 종합의견을 작성하세요:
1. 보안성 검토 필요 여부와 핵심 사유
2. 사용자 응답과 AI 분석 결과 비교
3. 필수항목(1~5번) 점검 결과 요약
4. 선택항목(6~10번) 주요 사항
5. 다음 단계 권고사항

최소 5줄 이상으로 작성하고, 영어나 분석 과정 없이 최종 의견만 출력하세요."""

        messages = [
            {"role": "system", "content": self.summary_prompt},
            {"role": "user", "content": user_prompt}
        ]

        try:
            result = await self.llm_service.chat_completion(
                messages=messages,
                model=model,
                temperature=0.5,
                max_tokens=settings.SELFCHECK_SUMMARY_MAX_TOKENS,
                top_p=0.9
            )

            message = result["choices"][0]["message"]
            content = message.get("content", "").strip()
            reasoning_content = message.get("reasoning_content", "")

            if reasoning_content:
                logger.info(f"[SelfCheck] Summary reasoning detected ({len(reasoning_content)} chars)")

            content = re.sub(r'^```[a-z]*\n?', '', content)
            content = re.sub(r'\n?```$', '', content)
            content = content.strip()

            if content and len(content) >= 20:
                logger.info(f"[SelfCheck] Summary generated: {content[:100]}...")
                return content
            else:
                logger.warning(f"[SelfCheck] Summary too short or empty")
                return self.generate_fallback_summary(requires_review, review_reason, len(result_items))

        except Exception as e:
            logger.error(f"[SelfCheck] Summary generation failed: {e}")
            return self.generate_fallback_summary(requires_review, review_reason, len(result_items))

    def generate_fallback_summary(
        self,
        requires_review: bool,
        review_reason: Optional[str],
        item_count: int
    ) -> str:
        """LLM 실패 시 폴백 종합의견 생성"""
        if requires_review:
            return f"본 과제는 {review_reason or '필수 항목 해당'}으로 인해 보안성 검토가 필요합니다. 정보보호팀에 검토를 요청하시기 바랍니다."
        else:
            return f"총 {item_count}개 항목 분석 결과, 현재 보안성 검토 대상에 해당하지 않습니다. 다만, 과제 내용 변경 시 재검토가 필요할 수 있습니다."
