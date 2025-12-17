"""
FastAPI 메인 애플리케이션
"""
import logging
import asyncio
from contextlib import asynccontextmanager
from datetime import date, timedelta
from fastapi import FastAPI, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, StreamingResponse
import json

from backend.config.settings import settings

# 로깅 포맷 표준화
LOG_FORMAT = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
LOG_DATE_FORMAT = "%Y-%m-%d %H:%M:%S"

# 루트 로거 설정
logging.basicConfig(
    format=LOG_FORMAT,
    datefmt=LOG_DATE_FORMAT,
    level=logging.INFO
)
from backend.api.routes import document, dify, qdrant, chat, analytics, auth, prompts, selfcheck
from backend.database import init_db, get_db, SessionLocal
from backend.models import document as document_model  # Import to register models
from backend.models import dify_upload_history, dify_config  # Import Dify models
from backend.models import qdrant_upload_history  # Import Qdrant models
from backend.models import qdrant_collection as qdrant_collection_model  # Import QdrantCollection model
from backend.models import chat_session, chat_statistics  # Import Chat models
from backend.models import user as user_model  # Import User model for auth
from backend.models import selfcheck as selfcheck_model  # Import SelfCheck models
from backend.services.hybrid_logging_service import hybrid_logging_service
from backend.services.statistics_service import statistics_service
from backend.services.auth_service import auth_service
from backend.middleware.request_tracking import RequestTrackingMiddleware
from backend.middleware.rate_limit import limiter, rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from backend.services.health_service import health_service
from backend.services.http_client import http_manager
# Qdrant 서비스 인스턴스 import (연결 종료용)
from backend.api.routes.qdrant import qdrant_service as qdrant_service_main
from backend.api.routes.chat import qdrant_service as qdrant_service_chat

# 로거 설정
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    애플리케이션 수명 주기 관리 (FastAPI 권장 패턴)

    - yield 전: startup 로직
    - yield 후: shutdown 로직
    """
    # ========== STARTUP ==========
    # 데이터베이스 초기화
    init_db()
    print("[OK] Database initialized successfully")

    # 기본 관리자 계정 생성
    db = SessionLocal()
    try:
        auth_service.ensure_admin_exists(db)
        print("[OK] Admin user verified")
    finally:
        db.close()

    # 기존 Qdrant 컬렉션 마이그레이션 (백그라운드에서 실행)
    asyncio.create_task(migrate_qdrant_collections())

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

    yield  # 애플리케이션 실행

    # ========== SHUTDOWN ==========
    # 로깅 서비스 중지 및 큐 플러시
    try:
        await hybrid_logging_service.flush()
        await hybrid_logging_service.stop()
        print("[OK] Hybrid logging service stopped successfully")
    except Exception as e:
        print(f"[WARN] Hybrid logging service shutdown error: {e}")

    # Qdrant 클라이언트 연결 종료
    try:
        await qdrant_service_main.close()
        await qdrant_service_chat.close()
        print("[OK] Qdrant client connections closed successfully")
    except Exception as e:
        print(f"[WARN] Qdrant client shutdown error: {e}")

    # HTTP 클라이언트 연결 정리
    try:
        await http_manager.close_all()
        print("[OK] HTTP client connections closed successfully")
    except Exception as e:
        print(f"[WARN] HTTP client shutdown error: {e}")


# FastAPI 앱 생성 (lifespan 컨텍스트 매니저 사용)
app = FastAPI(
    title=settings.API_TITLE,
    version=settings.API_VERSION,
    description="Docling Serve를 활용한 문서 파싱 API",
    lifespan=lifespan
)

# Rate Limiting 설정
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)


async def migrate_qdrant_collections():
    """기존 Qdrant 컬렉션을 SQLite로 마이그레이션"""
    try:
        # 잠시 대기 (서버 시작 완료 후 실행)
        await asyncio.sleep(3)

        from backend.scripts.migrate_collections import run_migration_if_needed

        db = SessionLocal()
        try:
            migrated = await run_migration_if_needed(db)
            if migrated:
                print("[OK] Qdrant collections migrated to SQLite")
            else:
                print("[OK] Qdrant collections already synced with SQLite")
        finally:
            db.close()

    except Exception as e:
        logger.error(f"Failed to migrate Qdrant collections: {e}")
        print(f"[WARN] Qdrant collection migration skipped: {e}")


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


# 보안 헤더 미들웨어
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    """보안 헤더 추가 미들웨어"""
    response = await call_next(request)

    # XSS, Clickjacking, MIME 스니핑 방지
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"

    # 추가 보안 헤더
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"

    return response

# 잘못된 요청 처리 미들웨어
@app.middleware("http")
async def catch_exceptions_middleware(request: Request, call_next):
    """HTTP 예외 및 잘못된 요청을 처리하는 미들웨어"""
    try:
        response = await call_next(request)
        return response
    except Exception as e:
        logger.error(f"Unhandled exception for {request.method} {request.url.path}: {str(e)}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={
                "error_code": "INTERNAL_ERROR",
                "message": "서버 내부 오류가 발생했습니다."
            }
        )


# 전역 예외 핸들러: 내부 에러 메시지 숨김
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """모든 예외를 캐치하여 내부 정보 노출 방지"""
    logger.error(f"Global exception for {request.method} {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "error_code": "INTERNAL_ERROR",
            "message": "서버 내부 오류가 발생했습니다. 잠시 후 다시 시도해주세요."
        }
    )


# ValidationError 핸들러
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """요청 검증 실패 처리 (내부 정보 최소화)"""
    logger.warning(f"Validation error for {request.method} {request.url.path}: {exc.errors()}")
    return JSONResponse(
        status_code=422,
        content={
            "error_code": "VALIDATION_ERROR",
            "message": "요청 데이터가 올바르지 않습니다.",
            "detail": [{"field": e.get("loc", [])[-1] if e.get("loc") else "unknown", "message": e.get("msg", "")} for e in exc.errors()]
        }
    )


# 라우터 등록
app.include_router(auth.router)  # 인증 라우터 (가장 먼저 등록)
app.include_router(document.router)
app.include_router(dify.router)
app.include_router(qdrant.router)
app.include_router(chat.router)
app.include_router(analytics.router)
app.include_router(prompts.router)  # 프롬프트 자동 생성
app.include_router(selfcheck.router)  # 셀프진단


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
    """간단한 헬스 체크 (Liveness probe)"""
    return await health_service.get_simple_health()


@app.get("/health/live")
async def health_live():
    """Liveness probe - 앱 자체 상태 확인"""
    return await health_service.get_simple_health()


@app.get("/health/ready")
async def health_ready():
    """
    Readiness probe - 모든 의존성 서비스 확인

    Returns:
        200: 모든 서비스 정상
        503: 필수 서비스 장애
    """
    result = await health_service.get_full_health()
    status_code = 200 if result["status"] in ["healthy", "degraded"] else 503
    return JSONResponse(content=result, status_code=status_code)


@app.get("/health/llm-models")
@app.get("/api/health/llm-models")
async def health_llm_models():
    """
    LLM 모델별 상태 확인

    Returns:
        각 LLM 모델의 상태 (healthy/unhealthy/unconfigured)
    """
    result = await health_service.check_llm_models()
    return result


@app.get("/api/health/llm-models/stream")
async def health_llm_models_stream():
    """
    LLM 모델 상태 실시간 스트리밍 (SSE)

    Server-Sent Events로 모델 상태 변경을 실시간 전송합니다.
    - 연결 시 즉시 현재 상태 전송
    - 상태 변경 시에만 이벤트 전송
    - 30초마다 heartbeat로 연결 유지
    """
    async def event_generator():
        previous_status = None
        check_interval = 5  # 5초마다 상태 체크
        heartbeat_counter = 0

        try:
            while True:
                try:
                    # 현재 상태 확인
                    current = await health_service.check_llm_models()
                    current_json = json.dumps(current, ensure_ascii=False)

                    # 상태 변경 시 또는 첫 연결 시 전송
                    if current_json != previous_status:
                        yield f"data: {current_json}\n\n"
                        previous_status = current_json
                        heartbeat_counter = 0
                    else:
                        heartbeat_counter += 1
                        # 6번 체크 (30초)마다 heartbeat 전송
                        if heartbeat_counter >= 6:
                            yield ": heartbeat\n\n"
                            heartbeat_counter = 0

                    await asyncio.sleep(check_interval)

                except asyncio.CancelledError:
                    logger.debug("LLM models SSE stream cancelled by client")
                    break
                except Exception as e:
                    logger.error(f"LLM models SSE error: {e}")
                    yield f"data: {json.dumps({'error': str(e)})}\n\n"
                    await asyncio.sleep(check_interval)
        finally:
            logger.debug("LLM models SSE stream closed")

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # nginx 버퍼링 비활성화
        }
    )


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
