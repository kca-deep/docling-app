"""
애플리케이션 설정
.env 파일에서 환경변수를 읽어옵니다.
"""
from pydantic_settings import BaseSettings
from typing import List, Optional


class Settings(BaseSettings):
    """애플리케이션 설정"""

    # Database 설정
    DATABASE_URL: str = "sqlite:///./docling.db"

    # Docling Serve API 설정
    DOCLING_BASE_URL: str = "http://kca-ai.kro.kr:8007"

    # API 설정
    API_TITLE: str = "Docling Parse API"
    API_VERSION: str = "1.0.0"

    # CORS 설정 (JSON 배열로 파싱됨)
    ALLOWED_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:3001"]

    # 파일 업로드 설정
    MAX_UPLOAD_SIZE_MB: int = 50  # MB 단위
    ALLOWED_EXTENSIONS: List[str] = [".pdf", ".docx", ".doc", ".pptx", ".ppt"]

    # 폴링 설정
    POLL_INTERVAL: int = 2  # 초

    # Qdrant Vector DB 설정
    QDRANT_URL: str = "http://kca-ai.kro.kr:6333"
    QDRANT_API_KEY: Optional[str] = None
    DEFAULT_COLLECTION_NAME: str = "documents"

    # Docling Serve 청킹 서버 설정
    DOCLING_CHUNKING_URL: str = "http://kca-ai.kro.kr:8007"
    DEFAULT_CHUNK_SIZE: int = 500
    DEFAULT_CHUNK_OVERLAP: int = 50

    # BGE-M3 임베딩 서버 설정
    EMBEDDING_URL: str = "http://kca-ai.kro.kr:8080"
    EMBEDDING_MODEL: str = "bge-m3-korean"
    EMBEDDING_DIMENSION: int = 1024

    # === Computed Properties ===

    @property
    def MAX_UPLOAD_SIZE(self) -> int:
        """바이트 단위로 변환된 최대 업로드 크기"""
        return self.MAX_UPLOAD_SIZE_MB * 1024 * 1024

    @property
    def ALLOWED_EXTENSIONS_SET(self) -> set:
        """Set 형태로 변환된 허용 확장자"""
        return set(self.ALLOWED_EXTENSIONS)

    @property
    def DOCLING_ASYNC_API_URL(self) -> str:
        """Docling Serve 비동기 변환 API URL"""
        return f"{self.DOCLING_BASE_URL}/v1/convert/file/async"

    @property
    def DOCLING_STATUS_API_URL(self) -> str:
        """Docling Serve 상태 조회 API URL"""
        return f"{self.DOCLING_BASE_URL}/v1/status/poll"

    @property
    def DOCLING_RESULT_API_URL(self) -> str:
        """Docling Serve 결과 조회 API URL"""
        return f"{self.DOCLING_BASE_URL}/v1/result"

    class Config:
        env_file = "backend/.env"
        case_sensitive = True


settings = Settings()
