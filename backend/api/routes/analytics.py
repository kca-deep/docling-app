"""
Analytics API 라우터
채팅 로그 및 통계 조회 엔드포인트
"""

import logging
from datetime import datetime, date, timedelta
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Depends, Query, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, desc

from backend.database import get_db
from backend.models.chat_session import ChatSession
from backend.models.chat_statistics import ChatStatistics
from backend.services.statistics_service import statistics_service
from backend.services.conversation_service import conversation_service
from backend.services.hybrid_logging_service import hybrid_logging_service

# 로거 설정
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/summary")
async def get_analytics_summary(
    collection_name: Optional[str] = Query(None, description="컬렉션 이름"),
    date_from: Optional[date] = Query(None, description="시작 날짜"),
    date_to: Optional[date] = Query(None, description="종료 날짜"),
    db: Session = Depends(get_db)
):
    """
    컬렉션별 통계 요약 조회

    Args:
        collection_name: 특정 컬렉션 필터 (선택)
        date_from: 시작 날짜 (선택)
        date_to: 종료 날짜 (선택)
        db: 데이터베이스 세션

    Returns:
        dict: 통계 요약
            - total_queries: 총 쿼리 수
            - unique_sessions: 고유 세션 수
            - total_tokens: 총 토큰 사용량
            - error_count: 에러 횟수
            - avg_response_time_ms: 평균 응답 시간
            - period: 조회 기간 정보
            - collections: 컬렉션 목록
            - top_queries: 인기 쿼리 목록
    """
    try:
        summary = await statistics_service.get_summary(
            collection_name=collection_name,
            date_from=date_from,
            date_to=date_to,
            db=db
        )
        return summary

    except Exception as e:
        logger.error(f"통계 요약 조회 실패: {e}")
        raise HTTPException(status_code=500, detail=f"통계 요약 조회 실패: {str(e)}")


@router.get("/timeline")
async def get_timeline_data(
    collection_name: str = Query(..., description="컬렉션 이름"),
    period: str = Query("daily", description="집계 주기 (daily/hourly)"),
    days: int = Query(7, description="최근 N일간 데이터"),
    db: Session = Depends(get_db)
):
    """
    시계열 데이터 조회

    Args:
        collection_name: 컬렉션 이름
        period: 집계 주기 ("daily" 또는 "hourly")
        days: 조회할 일수 (기본: 7일)
        db: 데이터베이스 세션

    Returns:
        list: 시계열 데이터
            - date: 날짜
            - hour: 시간 (hourly인 경우)
            - queries: 쿼리 수
            - sessions: 세션 수
            - avg_response_time: 평균 응답 시간
            - errors: 에러 수
    """
    try:
        if period not in ["daily", "hourly"]:
            raise ValueError(f"Invalid period: {period}")

        if days < 1 or days > 90:
            raise ValueError(f"Days must be between 1 and 90")

        timeline = await statistics_service.get_timeline(
            collection_name=collection_name,
            period=period,
            days=days,
            db=db
        )
        return {"data": timeline, "collection_name": collection_name, "period": period}

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"타임라인 조회 실패: {e}")
        raise HTTPException(status_code=500, detail=f"타임라인 조회 실패: {str(e)}")


@router.get("/sessions")
async def get_sessions(
    collection_name: Optional[str] = Query(None, description="컬렉션 이름"),
    date_from: Optional[date] = Query(None, description="시작 날짜"),
    date_to: Optional[date] = Query(None, description="종료 날짜"),
    has_error: Optional[bool] = Query(None, description="에러 포함 여부"),
    skip: int = Query(0, ge=0, description="건너뛸 항목 수"),
    limit: int = Query(20, ge=1, le=100, description="조회할 항목 수"),
    db: Session = Depends(get_db)
):
    """
    채팅 세션 목록 조회

    Args:
        collection_name: 컬렉션 필터
        date_from: 시작 날짜
        date_to: 종료 날짜
        has_error: 에러 세션만 필터
        skip: 페이지네이션 오프셋
        limit: 조회 개수
        db: 데이터베이스 세션

    Returns:
        dict: 세션 목록과 메타데이터
            - sessions: 세션 리스트
            - total: 전체 개수
            - skip: 오프셋
            - limit: 조회 개수
    """
    try:
        query = db.query(ChatSession)

        # 필터 적용
        if collection_name:
            query = query.filter(ChatSession.collection_name == collection_name)
        if date_from:
            query = query.filter(ChatSession.started_at >= datetime.combine(date_from, datetime.min.time()))
        if date_to:
            query = query.filter(ChatSession.started_at <= datetime.combine(date_to, datetime.max.time()))
        if has_error is not None:
            query = query.filter(ChatSession.has_error == (1 if has_error else 0))

        # 전체 카운트
        total = query.count()

        # 페이지네이션과 정렬
        sessions = query.order_by(desc(ChatSession.started_at)).offset(skip).limit(limit).all()

        return {
            "sessions": [session.to_dict() for session in sessions],
            "total": total,
            "skip": skip,
            "limit": limit
        }

    except Exception as e:
        logger.error(f"세션 목록 조회 실패: {e}")
        raise HTTPException(status_code=500, detail=f"세션 목록 조회 실패: {str(e)}")


@router.get("/conversations")
async def get_conversations(
    collection_name: Optional[str] = Query(None, description="컬렉션 이름"),
    date_from: Optional[date] = Query(None, description="시작 날짜"),
    date_to: Optional[date] = Query(None, description="종료 날짜"),
    limit: int = Query(20, ge=1, le=100, description="조회할 항목 수")
):
    """
    저장된 대화 내역 조회 (관리자용)

    Args:
        collection_name: 컬렉션 필터
        date_from: 시작 날짜
        date_to: 종료 날짜
        limit: 조회 개수

    Returns:
        dict: 대화 목록
            - conversations: 대화 리스트
            - total: 조회된 개수
    """
    try:
        # 날짜 변환
        start_date = datetime.combine(date_from, datetime.min.time()) if date_from else None
        end_date = datetime.combine(date_to, datetime.max.time()) if date_to else None

        conversations = await conversation_service.read_conversations(
            start_date=start_date,
            end_date=end_date,
            collection_name=collection_name,
            limit=limit
        )

        return {
            "conversations": conversations,
            "total": len(conversations)
        }

    except Exception as e:
        logger.error(f"대화 내역 조회 실패: {e}")
        raise HTTPException(status_code=500, detail=f"대화 내역 조회 실패: {str(e)}")


@router.get("/logs")
async def get_logs(
    collection_name: Optional[str] = Query(None, description="컬렉션 이름"),
    session_id: Optional[str] = Query(None, description="세션 ID"),
    date_from: Optional[date] = Query(None, description="시작 날짜"),
    date_to: Optional[date] = Query(None, description="종료 날짜"),
    limit: int = Query(100, ge=1, le=1000, description="조회할 항목 수")
):
    """
    원시 로그 데이터 조회

    Args:
        collection_name: 컬렉션 필터
        session_id: 세션 ID 필터
        date_from: 시작 날짜
        date_to: 종료 날짜
        limit: 조회 개수

    Returns:
        dict: 로그 데이터
            - logs: 로그 리스트
            - total: 조회된 개수
    """
    try:
        # 날짜 변환
        start_date = datetime.combine(date_from, datetime.min.time()) if date_from else None
        end_date = datetime.combine(date_to, datetime.max.time()) if date_to else None

        logs = await hybrid_logging_service.read_logs(
            start_date=start_date,
            end_date=end_date,
            collection_name=collection_name,
            session_id=session_id,
            limit=limit
        )

        return {
            "logs": logs,
            "total": len(logs)
        }

    except Exception as e:
        logger.error(f"로그 조회 실패: {e}")
        raise HTTPException(status_code=500, detail=f"로그 조회 실패: {str(e)}")


@router.post("/aggregate")
async def trigger_aggregation(
    background_tasks: BackgroundTasks,
    target_date: date = Query(..., description="집계할 날짜"),
    db: Session = Depends(get_db)
):
    """
    특정 날짜의 통계 집계 트리거 (관리자용)

    Args:
        target_date: 집계할 날짜
        background_tasks: 백그라운드 태스크
        db: 데이터베이스 세션

    Returns:
        dict: 집계 작업 상태
    """
    try:
        # 백그라운드로 집계 실행
        async def run_aggregation():
            result = await statistics_service.aggregate_daily_stats(target_date, db)
            logger.info(f"집계 완료: {result}")

        background_tasks.add_task(run_aggregation)

        return {
            "message": f"통계 집계 작업이 시작되었습니다: {target_date}",
            "date": target_date.isoformat(),
            "status": "started"
        }

    except Exception as e:
        logger.error(f"집계 트리거 실패: {e}")
        raise HTTPException(status_code=500, detail=f"집계 트리거 실패: {str(e)}")


@router.get("/report")
async def generate_report(
    date_from: date = Query(..., description="시작 날짜"),
    date_to: date = Query(..., description="종료 날짜"),
    db: Session = Depends(get_db)
):
    """
    종합 리포트 생성

    Args:
        date_from: 시작 날짜
        date_to: 종료 날짜
        db: 데이터베이스 세션

    Returns:
        dict: 종합 리포트
            - period: 조회 기간
            - overview: 전체 개요
            - performance: 성능 메트릭
            - quality: 품질 메트릭
            - usage_patterns: 사용 패턴
            - collections: 컬렉션별 통계
    """
    try:
        if date_to < date_from:
            raise ValueError("종료 날짜는 시작 날짜 이후여야 합니다")

        if (date_to - date_from).days > 90:
            raise ValueError("리포트 기간은 최대 90일까지 가능합니다")

        report = await statistics_service.generate_report(
            date_from=date_from,
            date_to=date_to,
            db=db
        )

        return report

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"리포트 생성 실패: {e}")
        raise HTTPException(status_code=500, detail=f"리포트 생성 실패: {str(e)}")


@router.post("/cleanup")
async def cleanup_old_data(
    background_tasks: BackgroundTasks,
    retention_days: int = Query(30, ge=7, le=365, description="보존 기간 (일)")
):
    """
    오래된 데이터 정리 (관리자용)

    Args:
        retention_days: 보존 기간 (기본: 30일)
        background_tasks: 백그라운드 태스크

    Returns:
        dict: 정리 작업 상태
    """
    try:
        # 백그라운드로 정리 실행
        async def run_cleanup():
            deleted_count = await conversation_service.cleanup_old_conversations(retention_days)
            logger.info(f"정리 완료: {deleted_count}개 파일 삭제")

        background_tasks.add_task(run_cleanup)

        return {
            "message": f"{retention_days}일 이상 된 대화 파일 정리 작업이 시작되었습니다",
            "retention_days": retention_days,
            "status": "started"
        }

    except Exception as e:
        logger.error(f"정리 작업 시작 실패: {e}")
        raise HTTPException(status_code=500, detail=f"정리 작업 시작 실패: {str(e)}")


@router.get("/collections")
async def get_collection_stats(db: Session = Depends(get_db)):
    """
    컬렉션별 통계 개요

    Returns:
        dict: 컬렉션별 통계
    """
    try:
        # 각 컬렉션의 최신 통계 조회
        collections = db.query(ChatStatistics.collection_name).distinct().all()

        collection_stats = []
        for (collection_name,) in collections:
            # 최신 통계 가져오기
            latest_stat = db.query(ChatStatistics).filter(
                ChatStatistics.collection_name == collection_name
            ).order_by(desc(ChatStatistics.date)).first()

            if latest_stat:
                collection_stats.append({
                    "collection_name": collection_name,
                    "latest_date": latest_stat.date.isoformat(),
                    "total_queries": latest_stat.total_queries,
                    "unique_sessions": latest_stat.unique_sessions,
                    "avg_response_time_ms": latest_stat.avg_response_time_ms
                })

        return {
            "collections": collection_stats,
            "total_collections": len(collection_stats)
        }

    except Exception as e:
        logger.error(f"컬렉션 통계 조회 실패: {e}")
        raise HTTPException(status_code=500, detail=f"컬렉션 통계 조회 실패: {str(e)}")