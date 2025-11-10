"""
FastAPI 메인 애플리케이션
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.config.settings import settings
from backend.api.routes import document, dify, qdrant
from backend.database import init_db
from backend.models import document as document_model  # Import to register models
from backend.models import dify_upload_history, dify_config  # Import Dify models
from backend.models import qdrant_upload_history  # Import Qdrant models

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
    print("✅ Database initialized successfully")

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 라우터 등록
app.include_router(document.router)
app.include_router(dify.router)
app.include_router(qdrant.router)


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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "backend.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
