"""
FastAPI 메인 애플리케이션
"""
import logging
import asyncio
from datetime import date, timedelta
from fastapi import FastAPI, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from backend.config.settings import settings
from backend.api.routes import document, dify, qdrant, chat, analytics
from backend.database import init_db, get_db, SessionLocal
from backend.models import document as document_model  # Import to register models
from backend.models import dify_upload_history, dify_config  # Import Dify models
from backend.models import qdrant_upload_history  # Import Qdrant models
from backend.models import chat_session, chat_statistics  # Import Chat models
from backend.services.hybrid_logging_service import hybrid_logging_service
from backend.services.statistics_service import statistics_service
from backend.middleware.request_tracking import RequestTrackingMiddleware

# 로거 설정
logger = logging.getLogger(__name__)

# FastAPI 앱 생성
app = FastAPI(
    title=settings.API_TITLE,
    version=settings.API_VERSION,
    description="Docling Serve를 활용한 문서 파싱 API"
)


async def aggregate_pending_statistics():
    """미집계 통계 자동 집계 (최근 7일)"""
    try:
        # 잠시 대기 (서버 시작 완료 후 실행)
        await asyncio.sleep(5)

        db = SessionLocal()
        try:
            today = date.today()
            # 최근 7일간의 통계 집계
            for days_ago in range(7, 0, -1):
                target_date = today - timedelta(days=days_ago)
                result = await statistics_service.aggregate_daily_stats(target_date, db)
                if result.get("status") == "success":
                    logger.info(f"Statistics aggregated for {target_date}")
                elif result.get("status") == "no_data":
                    logger.debug(f"No data to aggregate for {target_date}")
        finally:
            db.close()

        print("[OK] Pending statistics aggregation completed")

    except Exception as e:
        logger.error(f"Failed to aggregate pending statistics: {e}")


# 앱 시작 시 DB 초기화
@app.on_event("startup")
async def startup_event():
    """앱 시작 시 실행되는 이벤트 핸들러"""
    # 데이터베이스 초기화
    init_db()
    print("[OK] Database initialized successfully")

    # SQLite 최적화 설정 적용
    try:
        from sqlalchemy import text
        from backend.database import engine

        with engine.connect() as conn:
            # WAL 모드 활성화 (동시성 개선)
            conn.execute(text("PRAGMA journal_mode = WAL"))
            # 쓰기 성능 향상
            conn.execute(text("PRAGMA synchronous = NORMAL"))
            # 캐시 크기 증가 (128MB)
            conn.execute(text("PRAGMA cache_size = -128000"))
            # 메모리 매핑
            conn.execute(text("PRAGMA mmap_size = 10737418240"))  # 10GB
            # 임시 테이블 메모리 사용
            conn.execute(text("PRAGMA temp_store = MEMORY"))
            conn.commit()

        print("[OK] SQLite optimizations applied successfully")
    except Exception as e:
        logger.error(f"Failed to apply SQLite optimizations: {e}")

    # 로깅 서비스 시작
    await hybrid_logging_service.start()
    print("[OK] Hybrid logging service started successfully")

    # 자동 통계 집계 (백그라운드에서 실행)
    asyncio.create_task(aggregate_pending_statistics())


# 앱 종료 시 정리 작업
@app.on_event("shutdown")
async def shutdown_event():
    """앱 종료 시 실행되는 이벤트 핸들러"""
    # 로깅 서비스 중지 및 큐 플러시
    await hybrid_logging_service.flush()
    await hybrid_logging_service.stop()
    print("[OK] Hybrid logging service stopped successfully")

# 요청 추적 미들웨어 추가 (CORS보다 먼저 등록)
app.add_middleware(RequestTrackingMiddleware)

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 잘못된 요청 처리 미들웨어
@app.middleware("http")
async def catch_exceptions_middleware(request: Request, call_next):
    """HTTP 예외 및 잘못된 요청을 처리하는 미들웨어"""
    try:
        response = await call_next(request)
        return response
    except Exception as e:
        logger.error(f"Unhandled exception for {request.method} {request.url.path}: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error"}
        )


# 라우터 등록
app.include_router(document.router)
app.include_router(dify.router)
app.include_router(qdrant.router)
app.include_router(chat.router)
app.include_router(analytics.router)


@app.get("/")
async def root():
    """루트 엔드포인트"""
    return {
        "service": settings.API_TITLE,
        "version": settings.API_VERSION,
        "status": "running"
    }


@app.get("/health")
async def health():
    """헬스 체크"""
    return {"status": "ok"}


@app.get("/favicon.ico")
async def favicon():
    """파비콘 요청 처리 (204 No Content 반환)"""
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.exception_handler(404)
async def custom_404_handler(request: Request, exc):
    """커스텀 404 핸들러 - 의심스러운 요청 로깅"""
    path = request.url.path

    # 의심스러운 경로 패턴 감지
    suspicious_patterns = [
        "/images/", "/js/", "/admin/", "/wp-", "/phpmyadmin/",
        ".php", ".asp", ".jsp", "/cgi-bin/", "/scripts/"
    ]

    is_suspicious = any(pattern in path.lower() for pattern in suspicious_patterns)

    if is_suspicious:
        logger.warning(f"Suspicious 404 request detected: {request.method} {path} from {request.client.host}")

    return JSONResponse(
        status_code=404,
        content={"detail": "Not Found", "path": path}
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "backend.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
