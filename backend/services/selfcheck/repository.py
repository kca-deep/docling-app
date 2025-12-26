"""
셀프진단 DB CRUD 작업
"""
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from backend.config.settings import settings
from backend.models.selfcheck import SelfCheckSubmission, SelfCheckItem
from backend.models.schemas import (
    SelfCheckHistoryItem,
    SelfCheckHistoryResponse,
    SelfCheckDetailResponse,
    SelfCheckItemResult,
    SimilarProject,
)
from .llm_analyzer import CHECKLIST_ITEMS

logger = logging.getLogger(__name__)


class SelfCheckRepository:
    """셀프진단 DB CRUD 작업"""

    def _determine_match_status(self, user_answer: Optional[str], llm_answer: str) -> str:
        """사용자 선택과 LLM 분석 결과 비교"""
        if user_answer is None or user_answer == "unknown":
            return "reference"
        if llm_answer == "need_check":
            return "keep"
        if user_answer == llm_answer:
            return "match"
        return "mismatch"

    def get_history(
        self,
        db: Session,
        user_id: Optional[int] = None,
        skip: int = 0,
        limit: int = 20,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> SelfCheckHistoryResponse:
        """사용자의 진단 이력 조회"""
        query = db.query(SelfCheckSubmission)

        if user_id is not None:
            query = query.filter(SelfCheckSubmission.user_id == user_id)

        if start_date:
            query = query.filter(SelfCheckSubmission.created_at >= start_date)
        if end_date:
            end_date_inclusive = end_date.replace(hour=23, minute=59, second=59)
            query = query.filter(SelfCheckSubmission.created_at <= end_date_inclusive)

        query = query.order_by(SelfCheckSubmission.created_at.desc())

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

    def get_submissions_by_ids(
        self,
        db: Session,
        submission_ids: List[str],
        user_id: Optional[int] = None
    ) -> List[SelfCheckDetailResponse]:
        """여러 submission을 ID로 조회"""
        results = []
        for submission_id in submission_ids:
            try:
                detail = self.get_submission(db, submission_id, user_id)
                results.append(detail)
            except HTTPException:
                logger.warning(f"[SelfCheck] Submission not found: {submission_id}")
                continue
        return results

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

        db_items = db.query(SelfCheckItem).filter(
            SelfCheckItem.submission_id == submission_id
        ).order_by(SelfCheckItem.item_number).all()

        # analysis_result JSON에서 확장 필드 추출
        extended_fields_map = {}
        if submission.analysis_result and isinstance(submission.analysis_result, dict):
            analysis_items = submission.analysis_result.get("items", [])
            for ai in analysis_items:
                item_num = ai.get("item_number")
                if item_num:
                    extended_fields_map[item_num] = {
                        "llm_judgment": ai.get("llm_judgment"),
                        "llm_quote": ai.get("llm_quote"),
                        "llm_reasoning": ai.get("llm_reasoning"),
                        "llm_user_comparison": ai.get("llm_user_comparison")
                    }

        items = []
        for item in db_items:
            ext = extended_fields_map.get(item.item_number, {})

            items.append(SelfCheckItemResult(
                item_number=item.item_number,
                item_category=item.item_category,
                question=item.question,
                short_label=CHECKLIST_ITEMS[item.item_number - 1]["short_label"],
                user_answer=item.user_answer,
                user_details=item.user_details,
                llm_answer=item.llm_answer or "need_check",
                llm_confidence=item.llm_confidence or settings.SELFCHECK_DEFAULT_CONFIDENCE,
                llm_evidence=item.llm_evidence or "",
                llm_risk_level=item.llm_risk_level or "medium",
                match_status=self._determine_match_status(item.user_answer, item.llm_answer or "need_check"),
                final_answer=item.final_answer,
                llm_judgment=ext.get("llm_judgment"),
                llm_quote=ext.get("llm_quote"),
                llm_reasoning=ext.get("llm_reasoning"),
                llm_user_comparison=ext.get("llm_user_comparison")
            ))

        # similar_projects 추출
        similar_projects: List[SimilarProject] = []
        if submission.analysis_result and isinstance(submission.analysis_result, dict):
            similar_projects_data = submission.analysis_result.get("similar_projects", [])
            similar_projects = [
                SimilarProject(
                    submission_id=sp.get("submission_id", ""),
                    project_name=sp.get("project_name", ""),
                    department=sp.get("department", ""),
                    manager_name=sp.get("manager_name", ""),
                    similarity_score=sp.get("similarity_score", 0),
                    similarity_reason=sp.get("similarity_reason", ""),
                    created_at=sp.get("created_at", "")
                )
                for sp in similar_projects_data
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
            summary=submission.summary,
            used_model=submission.used_model,
            analysis_time_ms=submission.analysis_time_ms,
            status=submission.status,
            created_at=submission.created_at.isoformat() if submission.created_at else "",
            items=items,
            similar_projects=similar_projects
        )

    def save_submission(
        self,
        db: Session,
        submission_id: str,
        request: Any,
        result_items: List[SelfCheckItemResult],
        similar_projects: List[SimilarProject],
        requires_review: bool,
        review_reason: Optional[str],
        summary_msg: str,
        model_key: str,
        analysis_time_ms: int,
        user_id: int
    ) -> bool:
        """분석 결과 DB 저장"""
        try:
            analysis_result_json = {
                "items": [
                    {
                        "item_number": item.item_number,
                        "llm_answer": item.llm_answer,
                        "llm_evidence": item.llm_evidence,
                        "llm_confidence": item.llm_confidence,
                        "llm_risk_level": item.llm_risk_level,
                        "llm_judgment": item.llm_judgment,
                        "llm_quote": item.llm_quote,
                        "llm_reasoning": item.llm_reasoning,
                        "llm_user_comparison": item.llm_user_comparison
                    }
                    for item in result_items
                ],
                "similar_projects": [
                    {
                        "submission_id": sp.submission_id,
                        "project_name": sp.project_name,
                        "department": sp.department,
                        "manager_name": sp.manager_name,
                        "similarity_score": sp.similarity_score,
                        "similarity_reason": sp.similarity_reason,
                        "created_at": sp.created_at
                    }
                    for sp in similar_projects
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
                summary=summary_msg,
                used_model=model_key,
                analysis_time_ms=analysis_time_ms,
                user_id=user_id,
                status="completed"
            )
            db.add(submission)

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
            logger.info(f"[SelfCheck] Submission saved: {submission_id}")
            return True

        except Exception as e:
            db.rollback()
            logger.error(f"[SelfCheck] Failed to save submission: {e}")
            return False

    def delete_submission(
        self,
        db: Session,
        submission_id: str
    ) -> Dict[str, Any]:
        """셀프진단 결과 DB에서 삭제"""
        result = {
            "success": False,
            "db_deleted": False,
            "error": None
        }

        try:
            submission = db.query(SelfCheckSubmission).filter(
                SelfCheckSubmission.submission_id == submission_id
            ).first()

            if not submission:
                result["error"] = f"Submission not found: {submission_id}"
                return result

            db.delete(submission)
            db.commit()
            result["db_deleted"] = True
            result["success"] = True
            logger.info(f"[SelfCheck] Deleted submission from DB: {submission_id}")
            return result

        except Exception as e:
            db.rollback()
            logger.error(f"[SelfCheck] Failed to delete submission {submission_id}: {e}")
            result["error"] = str(e)
            return result

    def delete_submissions_bulk(
        self,
        db: Session,
        submission_ids: List[str]
    ) -> Dict[str, Any]:
        """셀프진단 결과 일괄 삭제 (DB만)"""
        result = {
            "total": len(submission_ids),
            "success": 0,
            "failed": 0,
            "details": []
        }

        for submission_id in submission_ids:
            delete_result = self.delete_submission(db, submission_id)
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


# 싱글톤 인스턴스
repository = SelfCheckRepository()
