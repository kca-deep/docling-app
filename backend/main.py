"""
FastAPI 메인 애플리케이션
"""
import logging
from fastapi import FastAPI, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from backend.config.settings import settings
from backend.api.routes import document, dify, qdrant, chat
from backend.database import init_db
from backend.models import document as document_model  # Import to register models
from backend.models import dify_upload_history, dify_config  # Import Dify models
from backend.models import qdrant_upload_history  # Import Qdrant models

# 로거 설정
logger = logging.getLogger(__name__)

# FastAPI 앱 생성
app = FastAPI(
    title=settings.API_TITLE,
    version=settings.API_VERSION,
    description="Docling Serve를 활용한 문서 파싱 API"
)


# 앱 시작 시 DB 초기화
@app.on_event("startup")
async def startup_event():
    """앱 시작 시 실행되는 이벤트 핸들러"""
    init_db()
    print("[OK] Database initialized successfully")

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
