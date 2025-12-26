"""
셀프진단 메인 서비스
AI 과제 보안성 검토 셀프진단 비즈니스 로직 오케스트레이션
"""
import asyncio
import logging
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from backend.config.settings import settings
from backend.models.schemas import (
    SelfCheckAnalyzeRequest,
    SelfCheckAnalyzeResponse,
    SelfCheckItemResult,
    SelfCheckHistoryResponse,
    SelfCheckDetailResponse,
    SimilarProject,
    LLMStatusResponse,
)
from backend.services.embedding_service import EmbeddingService
from backend.services.qdrant_service import QdrantService
from backend.services.llm_service import LLMService
from backend.services.http_client import http_manager

from .llm_analyzer import LLMAnalyzer, CHECKLIST_ITEMS
from .similarity import SimilarityService
from .repository import SelfCheckRepository

logger = logging.getLogger(__name__)


class SelfCheckService:
    """셀프진단 메인 서비스 (Facade 패턴)"""

    def __init__(self):
        self.prompts_dir = Path(__file__).parent.parent.parent / "prompts"
        self.client = http_manager.get_client("llm")

        # 하위 서비스 초기화
        self.embedding_service = EmbeddingService(
            base_url=settings.EMBEDDING_URL,
            model=settings.EMBEDDING_MODEL
        )
        self.qdrant_service = QdrantService(
            url=settings.QDRANT_URL,
            api_key=settings.QDRANT_API_KEY
        )
        self.llm_service = LLMService(
            base_url=settings.LLM_BASE_URL,
            model=settings.LLM_MODEL
        )

        # 모듈화된 서비스들
        self.llm_analyzer = LLMAnalyzer(
            http_client=self.client,
            llm_service=self.llm_service,
            prompts_dir=self.prompts_dir
        )
        self.similarity_service = SimilarityService(
            embedding_service=self.embedding_service,
            qdrant_service=self.qdrant_service,
            http_client=self.client
        )
        self.repository = SelfCheckRepository()

        # 유사과제 프롬프트 설정
        self._similarity_prompt = None

    def _load_prompt(self, filename: str) -> str:
        """프롬프트 파일 로드"""
        path = self.prompts_dir / filename
        if path.exists():
            return path.read_text(encoding="utf-8")
        logger.warning(f"Prompt not found: {path}")
        return ""

    @property
    def similarity_prompt(self) -> str:
        """유사과제 판단 프롬프트"""
        if self._similarity_prompt is None:
            self._similarity_prompt = self._load_prompt("selfcheck_similarity.md")
            self.similarity_service.set_similarity_prompt(self._similarity_prompt)
        return self._similarity_prompt

    # === LLM 관련 위임 메서드 ===

    async def get_available_llm(self) -> Dict[str, Any]:
        """사용 가능한 LLM 선택"""
        return await self.llm_analyzer.get_available_llm()

    async def get_llm_status(self) -> LLMStatusResponse:
        """LLM 상태 조회"""
        return await self.llm_analyzer.get_llm_status()

    # === DB CRUD 위임 메서드 ===

    def get_history(
        self,
        db: Session,
        user_id: Optional[int] = None,
        skip: int = 0,
        limit: int = 20,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> SelfCheckHistoryResponse:
        """진단 이력 조회"""
        return self.repository.get_history(db, user_id, skip, limit, start_date, end_date)

    def get_submissions_by_ids(
        self,
        db: Session,
        submission_ids: List[str],
        user_id: Optional[int] = None
    ) -> List[SelfCheckDetailResponse]:
        """여러 submission 조회 (user_id=None이면 전체 조회)"""
        return self.repository.get_submissions_by_ids(db, submission_ids, user_id)

    def get_submission(
        self,
        db: Session,
        submission_id: str,
        user_id: Optional[int] = None
    ) -> SelfCheckDetailResponse:
        """특정 진단 상세 조회"""
        return self.repository.get_submission(db, submission_id, user_id)

    # === Qdrant 관련 위임 메서드 ===

    async def get_qdrant_collection_stats(self) -> Dict[str, Any]:
        """Qdrant 컬렉션 통계"""
        return await self.similarity_service.get_qdrant_collection_stats()

    async def migrate_projects_to_qdrant(
        self,
        db: Session,
        batch_size: int = 20
    ) -> Dict[str, Any]:
        """기존 DB 프로젝트를 Qdrant로 마이그레이션"""
        return await self.similarity_service.migrate_projects_to_qdrant(db, batch_size)

    # === 삭제 관련 메서드 ===

    async def delete_submission(
        self,
        submission_id: str,
        db: Session
    ) -> Dict[str, Any]:
        """셀프진단 결과 삭제 (DB + Qdrant)"""
        result = {
            "success": False,
            "db_deleted": False,
            "qdrant_deleted": False,
            "error": None
        }

        # DB 삭제
        db_result = self.repository.delete_submission(db, submission_id)
        result["db_deleted"] = db_result["db_deleted"]

        if not db_result["success"]:
            result["error"] = db_result["error"]
            return result

        # Qdrant 삭제
        qdrant_deleted = await self.similarity_service.delete_from_qdrant(submission_id)
        result["qdrant_deleted"] = qdrant_deleted
        result["success"] = True

        return result

    async def delete_submissions_bulk(
        self,
        submission_ids: List[str],
        db: Session
    ) -> Dict[str, Any]:
        """셀프진단 결과 일괄 삭제"""
        result = {
            "total": len(submission_ids),
            "success": 0,
            "failed": 0,
            "details": []
        }

        for submission_id in submission_ids:
            delete_result = await self.delete_submission(submission_id, db)
            detail = {
                "submission_id": submission_id,
                **delete_result
            }
            result["details"].append(detail)

            if delete_result["success"]:
                result["success"] += 1
            else:
                result["failed"] += 1

        logger.info(f"[SelfCheck] Bulk delete completed: {result['success']}/{result['total']} succeeded")
        return result

    # === 유틸리티 메서드 ===

    def _determine_match_status(self, user_answer: Optional[str], llm_answer: str) -> str:
        """사용자 선택과 LLM 분석 결과 비교"""
        if user_answer is None or user_answer == "unknown":
            return "reference"
        if llm_answer == "need_check":
            return "keep"
        if user_answer == llm_answer:
            return "match"
        return "mismatch"

    # === 메인 분석 메서드 ===

    async def analyze(
        self,
        request: SelfCheckAnalyzeRequest,
        user_id: Optional[int] = None,
        db: Optional[Session] = None
    ) -> SelfCheckAnalyzeResponse:
        """
        셀프진단 분석 실행 (10개 항목 개별 순차 처리 + 교차검증)
        """
        start_time = datetime.now()
        submission_id = str(uuid.uuid4())

        # 1. 사용 가능한 LLM 선택
        selected_llm = await self.get_available_llm()
        model_key = selected_llm["key"]
        llm_config = settings.get_llm_config(model_key)
        url = f"{llm_config['base_url']}/v1/chat/completions"
        model = llm_config["model"]

        # 2. 사용자 입력 매핑
        user_items = {item.item_number: item for item in request.checklist_items}

        logger.info(f"[SelfCheck] Starting parallel LLM calls (10 items): {model_key}")

        # 3. 10개 항목 병렬 처리
        async def process_item(checklist_item):
            num = checklist_item["number"]
            user_input = user_items.get(num)
            return await self.llm_analyzer.call_llm_individual(
                url=url,
                model=model,
                item_number=num,
                question=checklist_item["question"],
                project_content=request.project_description,
                user_answer=user_input.user_answer if user_input else None,
                user_details=user_input.user_details if user_input else None
            )

        tasks = [process_item(item) for item in CHECKLIST_ITEMS]
        all_results = await asyncio.gather(*tasks, return_exceptions=True)

        # 예외를 None으로 변환
        failed_count = sum(1 for r in all_results if isinstance(r, Exception))
        all_results = [
            r if not isinstance(r, Exception) else None
            for r in all_results
        ]
        logger.info(f"[SelfCheck] Parallel execution completed: {10 - failed_count}/10 succeeded")

        # 4. 결과 매핑
        llm_items = {}
        for result in all_results:
            if result is not None:
                llm_items[result["item_number"]] = result

        logger.info(f"[SelfCheck] LLM returned {len(llm_items)} items: {list(llm_items.keys())}")

        # 5. 결과 조합
        result_items: List[SelfCheckItemResult] = []
        for checklist_item in CHECKLIST_ITEMS:
            num = checklist_item["number"]
            user_input = user_items.get(num)
            llm_result = llm_items.get(num, {})

            user_answer = user_input.user_answer if user_input else None
            llm_answer = llm_result.get("answer", "need_check")

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
                llm_confidence=llm_result.get("confidence", settings.SELFCHECK_DEFAULT_CONFIDENCE),
                llm_evidence=evidence,
                llm_risk_level=llm_result.get("risk_level", "medium"),
                match_status=self._determine_match_status(user_answer, llm_answer),
                final_answer=None,
                llm_judgment=llm_result.get("judgment"),
                llm_quote=llm_result.get("quote"),
                llm_reasoning=llm_result.get("reasoning"),
                llm_user_comparison=llm_result.get("user_comparison")
            ))

        # 6. 상위기관 검토 대상 여부 결정
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

        analysis_time_ms = int((datetime.now() - start_time).total_seconds() * 1000)

        # 8. 유사 과제 검토
        similar_projects: List[SimilarProject] = []
        if db and settings.SELFCHECK_SIMILARITY_ENABLED:
            try:
                # 프롬프트 로드 보장
                _ = self.similarity_prompt

                current_project_text = f"{request.project_name}\n{request.project_description or ''}"
                candidates = await self.similarity_service.find_similar_projects(
                    db=db,
                    current_project_text=current_project_text,
                    exclude_submission_id=submission_id
                )

                if candidates:
                    similar_projects = await self.similarity_service.verify_similarity_with_llm(
                        url=url,
                        model=model,
                        current_project_name=request.project_name,
                        current_project_desc=request.project_description or "",
                        candidates=candidates
                    )
                    logger.info(f"[SelfCheck] Found {len(similar_projects)} similar projects")
            except Exception as e:
                logger.error(f"[SelfCheck] Similar project check failed: {e}")

        # 9. AI 종합의견 생성 + Qdrant 임베딩 생성 (병렬 처리)
        project_text = f"{request.project_name}\n{request.project_description or ''}"
        qdrant_embedding = None

        async def generate_summary():
            return await self.llm_analyzer.generate_summary_with_llm(
                model=model,
                project_name=request.project_name,
                project_description=request.project_description or "",
                department=request.department,
                requires_review=requires_review,
                review_reason=review_reason,
                result_items=result_items,
                similar_projects=similar_projects
            )

        async def generate_embedding():
            if settings.SELFCHECK_QDRANT_ENABLED and project_text.strip():
                embeddings = await self.embedding_service.get_embeddings(project_text)
                return embeddings[0] if embeddings else None
            return None

        results = await asyncio.gather(
            generate_summary(),
            generate_embedding(),
            return_exceptions=True
        )

        if isinstance(results[0], Exception):
            logger.error(f"[SelfCheck] AI summary generation failed: {results[0]}")
            summary_msg = self.llm_analyzer.generate_fallback_summary(requires_review, review_reason, len(result_items))
        else:
            summary_msg = results[0]
            logger.info("[SelfCheck] AI summary generated successfully")

        if not isinstance(results[1], Exception):
            qdrant_embedding = results[1]

        # 10. DB 저장
        is_saved = False
        if db and user_id:
            is_saved = self.repository.save_submission(
                db=db,
                submission_id=submission_id,
                request=request,
                result_items=result_items,
                similar_projects=similar_projects,
                requires_review=requires_review,
                review_reason=review_reason,
                summary_msg=summary_msg,
                model_key=model_key,
                analysis_time_ms=analysis_time_ms,
                user_id=user_id
            )

            # 11. Qdrant에 프로젝트 저장
            if is_saved and settings.SELFCHECK_QDRANT_ENABLED:
                try:
                    await self.similarity_service.save_project_to_qdrant(
                        submission_id=submission_id,
                        project_name=request.project_name,
                        project_description=request.project_description or "",
                        department=request.department or "",
                        manager_name=request.manager_name or "",
                        created_at=datetime.now().isoformat(),
                        embedding=qdrant_embedding
                    )
                except Exception as e:
                    logger.warning(f"[SelfCheck] Failed to save to Qdrant (non-blocking): {e}")

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


# 싱글톤 인스턴스
selfcheck_service = SelfCheckService()
