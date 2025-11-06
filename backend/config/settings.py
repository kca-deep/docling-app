"""
애플리케이션 설정
"""
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """애플리케이션 설정"""

    # Docling Serve API 설정
    DOCLING_BASE_URL: str = "http://kca-ai.kro.kr:8007"
    DOCLING_ASYNC_API_URL: str = f"{DOCLING_BASE_URL}/v1/convert/file/async"
    DOCLING_STATUS_API_URL: str = f"{DOCLING_BASE_URL}/v1/status/poll"
    DOCLING_RESULT_API_URL: str = f"{DOCLING_BASE_URL}/v1/result"

    # API 설정
    API_TITLE: str = "Docling Parse API"
    API_VERSION: str = "1.0.0"

    # CORS 설정
    ALLOWED_ORIGINS: list = ["http://localhost:3000", "http://localhost:3001"]

    # 파일 업로드 설정
    MAX_UPLOAD_SIZE: int = 50 * 1024 * 1024  # 50MB
    ALLOWED_EXTENSIONS: set = {".pdf", ".docx", ".doc", ".pptx", ".ppt"}

    # 폴링 설정
    POLL_INTERVAL: int = 2  # 초

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
