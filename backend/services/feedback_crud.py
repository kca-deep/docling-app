"""
피드백 CRUD 서비스
피드백 생성, 조회, 통계 집계
"""

import logging
from datetime import datetime, date, timedelta
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, and_

from backend.models.feedback import Feedback
from backend.utils.timezone import now_naive

logger = logging.getLogger(__name__)


class FeedbackCRUD:
    """피드백 CRUD 서비스"""

    async def create_feedback(
        self,
        db: Session,
        message_id: str,
        session_id: str,
        collection_name: str,
        rating: str,
        user_query: str,
        category: Optional[str] = None,
        comment: Optional[str] = None,
        assistant_response: Optional[str] = None,
        llm_model: Optional[str] = None,
        reasoning_level: Optional[str] = None,
        retrieved_docs_count: Optional[int] = None,
        user_hash: Optional[str] = None,
        client_ip_hash: Optional[str] = None,
    ) -> Feedback:
        """
        피드백 생성

        Args:
            db: 데이터베이스 세션
            message_id: 메시지 ID
            session_id: 세션 ID
            collection_name: 컬렉션명
            rating: 평가 ("positive" | "negative")
            user_query: 사용자 질문
            category: 부정 피드백 카테고리 (선택)
            comment: 추가 의견 (선택)
            assistant_response: AI 응답 (선택)
            llm_model: LLM 모델명 (선택)
            reasoning_level: 추론 레벨 (선택)
            retrieved_docs_count: 참조 문서 수 (선택)
            user_hash: 사용자 해시 (선택)
            client_ip_hash: IP 해시 (선택)

        Returns:
            생성된 Feedback 객체
        """
        # 중복 피드백 체크
        existing = db.query(Feedback).filter(
            Feedback.message_id == message_id
        ).first()

        if existing:
            logger.warning(f"중복 피드백 시도: message_id={message_id}")
            # 기존 피드백 업데이트
            existing.rating = rating
            existing.category = category
            existing.comment = comment
            db.commit()
            db.refresh(existing)
            return existing

        # AI 응답 길이 제한 (500자)
        if assistant_response and len(assistant_response) > 500:
            assistant_response = assistant_response[:500]

        feedback = Feedback(
            message_id=message_id,
            session_id=session_id,
            collection_name=collection_name,
            rating=rating,
            category=category,
            comment=comment,
            user_query=user_query,
            assistant_response=assistant_response,
            llm_model=llm_model,
            reasoning_level=reasoning_level,
            retrieved_docs_count=retrieved_docs_count,
            user_hash=user_hash,
            client_ip_hash=client_ip_hash,
        )

        db.add(feedback)
        db.commit()
        db.refresh(feedback)

        logger.info(f"피드백 생성: feedback_id={feedback.feedback_id}, rating={rating}")
        return feedback

    async def get_feedback_summary(
        self,
        db: Session,
        collection_name: Optional[str] = None,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
    ) -> Dict[str, Any]:
        """
        피드백 요약 통계 조회

        Args:
            db: 데이터베이스 세션
            collection_name: 컬렉션 필터 (선택)
            date_from: 시작 날짜 (선택)
            date_to: 종료 날짜 (선택)

        Returns:
            피드백 요약 통계
        """
        query = db.query(Feedback)

        # 필터 적용
        if collection_name:
            query = query.filter(Feedback.collection_name == collection_name)
        if date_from:
            query = query.filter(Feedback.created_at >= datetime.combine(date_from, datetime.min.time()))
        if date_to:
            query = query.filter(Feedback.created_at <= datetime.combine(date_to, datetime.max.time()))

        # 전체 카운트
        total_count = query.count()

        if total_count == 0:
            return {
                "total_count": 0,
                "positive_count": 0,
                "negative_count": 0,
                "positive_rate": 0.0,
                "category_distribution": {},
                "daily_trend": [],
            }

        # 긍정/부정 카운트
        positive_count = query.filter(Feedback.rating == "positive").count()
        negative_count = query.filter(Feedback.rating == "negative").count()
        positive_rate = round((positive_count / total_count) * 100, 1) if total_count > 0 else 0.0

        # 부정 피드백 카테고리 분포
        category_query = db.query(
            Feedback.category,
            func.count(Feedback.feedback_id).label("count")
        ).filter(
            Feedback.rating == "negative"
        )
        if collection_name:
            category_query = category_query.filter(Feedback.collection_name == collection_name)
        if date_from:
            category_query = category_query.filter(Feedback.created_at >= datetime.combine(date_from, datetime.min.time()))
        if date_to:
            category_query = category_query.filter(Feedback.created_at <= datetime.combine(date_to, datetime.max.time()))

        category_results = category_query.group_by(Feedback.category).all()
        category_distribution = {
            cat or "unknown": count for cat, count in category_results
        }

        # 일별 트렌드 (최근 7일)
        seven_days_ago = now_naive() - timedelta(days=7)
        trend_query = db.query(
            func.date(Feedback.created_at).label("date"),
            Feedback.rating,
            func.count(Feedback.feedback_id).label("count")
        ).filter(
            Feedback.created_at >= seven_days_ago
        )
        if collection_name:
            trend_query = trend_query.filter(Feedback.collection_name == collection_name)

        trend_results = trend_query.group_by(
            func.date(Feedback.created_at),
            Feedback.rating
        ).order_by(func.date(Feedback.created_at)).all()

        # 트렌드 데이터 가공
        trend_dict: Dict[str, Dict[str, int]] = {}
        for row in trend_results:
            date_str = row.date.isoformat() if hasattr(row.date, 'isoformat') else str(row.date)
            if date_str not in trend_dict:
                trend_dict[date_str] = {"positive": 0, "negative": 0}
            trend_dict[date_str][row.rating] = row.count

        daily_trend = [
            {"date": d, "positive": v["positive"], "negative": v["negative"]}
            for d, v in sorted(trend_dict.items())
        ]

        return {
            "total_count": total_count,
            "positive_count": positive_count,
            "negative_count": negative_count,
            "positive_rate": positive_rate,
            "category_distribution": category_distribution,
            "daily_trend": daily_trend,
        }

    async def get_feedback_list(
        self,
        db: Session,
        collection_name: Optional[str] = None,
        rating: Optional[str] = None,
        category: Optional[str] = None,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
        skip: int = 0,
        limit: int = 20,
    ) -> Dict[str, Any]:
        """
        피드백 목록 조회

        Args:
            db: 데이터베이스 세션
            collection_name: 컬렉션 필터 (선택)
            rating: 평가 필터 (선택)
            category: 카테고리 필터 (선택)
            date_from: 시작 날짜 (선택)
            date_to: 종료 날짜 (선택)
            skip: 건너뛸 항목 수
            limit: 조회할 항목 수

        Returns:
            피드백 목록과 메타데이터
        """
        query = db.query(Feedback)

        # 필터 적용
        if collection_name:
            query = query.filter(Feedback.collection_name == collection_name)
        if rating:
            query = query.filter(Feedback.rating == rating)
        if category:
            query = query.filter(Feedback.category == category)
        if date_from:
            query = query.filter(Feedback.created_at >= datetime.combine(date_from, datetime.min.time()))
        if date_to:
            query = query.filter(Feedback.created_at <= datetime.combine(date_to, datetime.max.time()))

        # 전체 카운트
        total = query.count()

        # 페이지네이션 및 정렬
        feedbacks = query.order_by(desc(Feedback.created_at)).offset(skip).limit(limit).all()

        return {
            "feedbacks": [f.to_dict() for f in feedbacks],
            "total": total,
            "skip": skip,
            "limit": limit,
        }

    async def get_recent_negative_feedbacks(
        self,
        db: Session,
        collection_name: Optional[str] = None,
        limit: int = 10,
    ) -> List[Dict[str, Any]]:
        """
        최근 부정 피드백 조회

        Args:
            db: 데이터베이스 세션
            collection_name: 컬렉션 필터 (선택)
            limit: 조회할 항목 수

        Returns:
            최근 부정 피드백 목록
        """
        query = db.query(Feedback).filter(Feedback.rating == "negative")

        if collection_name:
            query = query.filter(Feedback.collection_name == collection_name)

        feedbacks = query.order_by(desc(Feedback.created_at)).limit(limit).all()

        return [f.to_dict() for f in feedbacks]

    async def check_feedback_exists(
        self,
        db: Session,
        message_id: str,
    ) -> Optional[str]:
        """
        메시지에 대한 피드백 존재 여부 확인

        Args:
            db: 데이터베이스 세션
            message_id: 메시지 ID

        Returns:
            피드백이 있으면 rating, 없으면 None
        """
        feedback = db.query(Feedback).filter(
            Feedback.message_id == message_id
        ).first()

        return feedback.rating if feedback else None


# 싱글톤 인스턴스
feedback_crud = FeedbackCRUD()
