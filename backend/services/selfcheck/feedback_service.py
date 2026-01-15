"""
셀프진단 피드백 서비스
피드백 CRUD 및 AI 초안 생성
"""
import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, Any, List

from sqlalchemy.orm import Session

from backend.config.settings import settings
from backend.models.user import User  # User 모델 먼저 import (ForeignKey 참조 해결용)
from backend.models.selfcheck import SelfCheckSubmission, SelfCheckItem, SelfCheckFeedback
from backend.models.schemas.selfcheck import (
    FeedbackDraftResponse,
    FeedbackResponse,
    FeedbackViewResponse,
    FeedbackUpdateRequest,
)
from backend.services.health_service import health_service
from backend.services.llm_service import LLMService
from backend.utils.timezone import now_naive

logger = logging.getLogger(__name__)

# LLM 모델 우선순위
LLM_PRIORITY_ORDER = ["gpt-oss-20b", "exaone-4.0-32b"]


class FeedbackService:
    """피드백 서비스"""

    def __init__(self, llm_service: LLMService, prompts_dir: Path):
        self.llm_service = llm_service
        self.prompts_dir = prompts_dir
        self._feedback_prompt: Optional[str] = None

    def _load_prompt(self, filename: str) -> str:
        """프롬프트 파일 로드"""
        path = self.prompts_dir / filename
        if path.exists():
            return path.read_text(encoding="utf-8")
        logger.warning(f"Prompt not found: {path}")
        return ""

    @property
    def feedback_prompt(self) -> str:
        """피드백 초안 생성용 프롬프트"""
        if self._feedback_prompt is None:
            self._feedback_prompt = self._load_prompt("selfcheck_feedback.md")
        return self._feedback_prompt

    async def get_available_llm(self) -> Dict[str, Any]:
        """Health check 기반으로 사용 가능한 LLM 선택"""
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

        raise Exception("사용 가능한 LLM이 없습니다")

    def get_feedback(self, db: Session, submission_id: str) -> Optional[SelfCheckFeedback]:
        """submission_id로 피드백 조회"""
        return db.query(SelfCheckFeedback).filter(
            SelfCheckFeedback.submission_id == submission_id
        ).first()

    def get_or_create_feedback(
        self,
        db: Session,
        submission_id: str,
        user_id: int
    ) -> SelfCheckFeedback:
        """피드백 조회 또는 생성"""
        feedback = self.get_feedback(db, submission_id)
        if feedback:
            return feedback

        # 새 피드백 생성
        feedback = SelfCheckFeedback(
            submission_id=submission_id,
            status="draft",
            created_by=user_id,
        )
        db.add(feedback)
        db.commit()
        db.refresh(feedback)
        return feedback

    def get_submission_with_items(
        self,
        db: Session,
        submission_id: str
    ) -> tuple[Optional[SelfCheckSubmission], List[SelfCheckItem]]:
        """submission과 관련 items 조회"""
        submission = db.query(SelfCheckSubmission).filter(
            SelfCheckSubmission.submission_id == submission_id
        ).first()

        if not submission:
            return None, []

        items = db.query(SelfCheckItem).filter(
            SelfCheckItem.submission_id == submission_id
        ).order_by(SelfCheckItem.item_number).all()

        return submission, items

    async def generate_draft(
        self,
        db: Session,
        submission_id: str,
        user_id: int
    ) -> FeedbackDraftResponse:
        """AI 피드백 초안 생성"""
        # 1. submission과 items 조회
        submission, items = self.get_submission_with_items(db, submission_id)
        if not submission:
            raise Exception(f"제출 건을 찾을 수 없습니다: {submission_id}")

        # 2. 사용 가능한 LLM 선택
        llm_info = await self.get_available_llm()
        llm_url = llm_info["url"]
        llm_model = llm_info["key"]

        # 3. 프롬프트 준비
        system_prompt = self.feedback_prompt
        if not system_prompt:
            raise Exception("피드백 프롬프트를 찾을 수 없습니다")

        # 4. 분석 데이터 구성
        items_data = []
        for item in items:
            items_data.append({
                "item_number": item.item_number,
                "question": item.question,
                "user_answer": item.user_answer,
                "user_details": item.user_details,
                "llm_answer": item.llm_answer,
                "llm_evidence": item.llm_evidence,
                "llm_risk_level": item.llm_risk_level,
                "llm_confidence": item.llm_confidence,
            })

        user_prompt = f"""# 분석 대상 과제

## 기본 정보
- 과제명: {submission.project_name}
- 담당부서: {submission.department}
- 담당자: {submission.manager_name}

## 과제 내용
{submission.project_description or "내용 없음"}

## AI 판정 결과
- 상위기관 검토 필요: {"예" if submission.requires_review else "아니오"}
- 검토 필요 사유: {submission.review_reason or "없음"}

## 기존 AI 종합의견
{submission.summary or "없음"}

## 체크리스트 항목별 분석 결과
{json.dumps(items_data, ensure_ascii=False, indent=2)}

위 정보를 바탕으로 보안 피드백 초안을 JSON 형식으로 작성해주세요."""

        # 5. LLM 호출
        logger.info(f"Generating feedback draft for {submission_id} using {llm_model}")

        try:
            response = await self.llm_service.chat_completion(
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                model=llm_model,
                temperature=0.3,
                max_tokens=4000,
            )
            # 응답에서 텍스트 추출
            response_text = response.get("choices", [{}])[0].get("message", {}).get("content", "")
            if not response_text:
                raise Exception("LLM 응답이 비어있습니다")
        except Exception as e:
            logger.error(f"LLM call failed: {e}")
            raise Exception(f"AI 초안 생성 실패: {str(e)}")

        # 6. JSON 파싱
        try:
            # JSON 블록 추출
            json_match = None
            if "```json" in response_text:
                import re
                json_match = re.search(r"```json\s*([\s\S]*?)\s*```", response_text)
            elif "```" in response_text:
                import re
                json_match = re.search(r"```\s*([\s\S]*?)\s*```", response_text)

            if json_match:
                json_str = json_match.group(1)
            else:
                json_str = response_text

            result = json.loads(json_str)

            administrative = result.get("administrative_security", "")
            technical = result.get("technical_security", "")
            overall = result.get("overall_opinion", "")

        except json.JSONDecodeError as e:
            logger.error(f"JSON parse error: {e}\nResponse: {response_text[:500]}")
            # JSON 파싱 실패 시 전체 응답을 종합의견으로 사용
            administrative = ""
            technical = ""
            overall = response_text

        # 7. 피드백 레코드 업데이트
        feedback = self.get_or_create_feedback(db, submission_id, user_id)
        feedback.ai_draft_administrative = administrative
        feedback.ai_draft_technical = technical
        feedback.ai_draft_overall = overall
        feedback.updated_by = user_id
        feedback.updated_at = now_naive()

        if feedback.status == "draft":
            feedback.status = "in_progress"

        db.commit()

        return FeedbackDraftResponse(
            administrative_security=administrative,
            technical_security=technical,
            overall_opinion=overall
        )

    def update_feedback(
        self,
        db: Session,
        submission_id: str,
        user_id: int,
        request: FeedbackUpdateRequest
    ) -> FeedbackResponse:
        """피드백 수정"""
        feedback = self.get_or_create_feedback(db, submission_id, user_id)

        # 필드 업데이트
        if request.security_review_required is not None:
            feedback.security_review_required = request.security_review_required
        if request.administrative_security is not None:
            feedback.administrative_security = request.administrative_security
        if request.technical_security is not None:
            feedback.technical_security = request.technical_security
        if request.overall_opinion is not None:
            feedback.overall_opinion = request.overall_opinion

        feedback.updated_by = user_id
        feedback.updated_at = now_naive()

        if feedback.status == "draft":
            feedback.status = "in_progress"

        db.commit()
        db.refresh(feedback)

        return self._to_response(feedback)

    def complete_feedback(
        self,
        db: Session,
        submission_id: str,
        user_id: int
    ) -> FeedbackResponse:
        """피드백 완료 처리"""
        feedback = self.get_feedback(db, submission_id)
        if not feedback:
            raise Exception(f"피드백을 찾을 수 없습니다: {submission_id}")

        feedback.status = "completed"
        feedback.completed_by = user_id
        feedback.completed_at = now_naive()
        feedback.updated_by = user_id
        feedback.updated_at = now_naive()

        db.commit()
        db.refresh(feedback)

        return self._to_response(feedback)

    def get_feedback_for_writer(
        self,
        db: Session,
        submission_id: str
    ) -> Optional[FeedbackResponse]:
        """작성자용 피드백 조회"""
        feedback = self.get_feedback(db, submission_id)
        if not feedback:
            return None
        return self._to_response(feedback)

    def get_feedback_for_user(
        self,
        db: Session,
        submission_id: str,
        user_id: Optional[int]
    ) -> Optional[FeedbackViewResponse]:
        """
        사용자용 피드백 조회 (완료된 건만)

        Args:
            db: DB 세션
            submission_id: 제출 ID
            user_id: 사용자 ID (None이면 본인 확인 생략 - 관리자용)

        Returns:
            FeedbackViewResponse: 피드백 응답 (완료된 경우만)
        """
        # 제출건 조회
        submission = db.query(SelfCheckSubmission).filter(
            SelfCheckSubmission.submission_id == submission_id
        ).first()

        if not submission:
            return None

        # user_id가 주어진 경우에만 본인 확인 (None이면 관리자 조회)
        if user_id is not None and submission.user_id != user_id:
            raise Exception("본인의 제출건만 조회할 수 있습니다")

        feedback = self.get_feedback(db, submission_id)
        if not feedback:
            return None

        if feedback.status != "completed":
            raise Exception("피드백이 아직 완료되지 않았습니다")

        return FeedbackViewResponse(
            submission_id=feedback.submission_id,
            security_review_required=feedback.security_review_required or False,
            administrative_security=feedback.administrative_security or "",
            technical_security=feedback.technical_security or "",
            overall_opinion=feedback.overall_opinion or "",
            completed_at=feedback.completed_at.isoformat() if feedback.completed_at else ""
        )

    def _to_response(self, feedback: SelfCheckFeedback) -> FeedbackResponse:
        """피드백을 응답 모델로 변환"""
        return FeedbackResponse(
            id=feedback.id,
            submission_id=feedback.submission_id,
            security_review_required=feedback.security_review_required,
            administrative_security=feedback.administrative_security,
            technical_security=feedback.technical_security,
            overall_opinion=feedback.overall_opinion,
            ai_draft_administrative=feedback.ai_draft_administrative,
            ai_draft_technical=feedback.ai_draft_technical,
            ai_draft_overall=feedback.ai_draft_overall,
            status=feedback.status,
            created_at=feedback.created_at.isoformat() if feedback.created_at else None,
            updated_at=feedback.updated_at.isoformat() if feedback.updated_at else None,
            completed_at=feedback.completed_at.isoformat() if feedback.completed_at else None,
        )


# 서비스 인스턴스
from backend.services.llm_service import llm_service

# prompts_dir: backend/prompts/
PROMPTS_DIR = Path(__file__).parent.parent.parent / "prompts"

feedback_service = FeedbackService(
    llm_service=llm_service,
    prompts_dir=PROMPTS_DIR
)
