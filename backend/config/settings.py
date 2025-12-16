"""
애플리케이션 설정
.env 파일에서 환경변수를 읽어옵니다.
"""
from pydantic_settings import BaseSettings
from typing import List, Optional
from pathlib import Path


class Settings(BaseSettings):
    """애플리케이션 설정"""

    # 타임존 설정
    TIMEZONE: str = "Asia/Seoul"

    # ===========================================
    # 인증 설정 (Authentication)
    # ===========================================
    # 관리자 사용자명
    ADMIN_USERNAME: str = "admin"
    # 관리자 비밀번호 (첫 실행 시 해시 처리)
    ADMIN_PASSWORD: str = "changeme"
    # JWT 토큰 서명 비밀 키
    SESSION_SECRET: str = "your-secret-key-change-in-production"
    # 세션 만료 시간 (시간 단위)
    SESSION_EXPIRE_HOURS: int = 24

    # ===========================================
    # 회원가입 설정 (Registration)
    # ===========================================
    # 회원가입 활성화 여부
    REGISTRATION_ENABLED: bool = True
    # 허용 이메일 도메인 (빈 리스트면 모든 도메인 허용)
    ALLOWED_EMAIL_DOMAINS: List[str] = ["kca.kr"]
    # 비밀번호 최소 길이
    PASSWORD_MIN_LENGTH: int = 8
    # 비밀번호 대문자 필수
    PASSWORD_REQUIRE_UPPERCASE: bool = True
    # 비밀번호 소문자 필수
    PASSWORD_REQUIRE_LOWERCASE: bool = True
    # 비밀번호 숫자 필수
    PASSWORD_REQUIRE_DIGIT: bool = True
    # 비밀번호 특수문자 필수
    PASSWORD_REQUIRE_SPECIAL: bool = True

    # Database 설정
    DATABASE_URL: str = "sqlite:///./docling.db"

    # Docling Serve API 설정
    DOCLING_BASE_URL: str = "http://ai.kca.kr:8007"

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
    QDRANT_URL: str = "http://ai.kca.kr:6333"
    QDRANT_API_KEY: Optional[str] = None
    DEFAULT_COLLECTION_NAME: str = "documents"

    # Docling Serve 청킹 서버 설정
    DOCLING_CHUNKING_URL: str = "http://ai.kca.kr:8007"
    DEFAULT_CHUNK_SIZE: int = 500
    DEFAULT_CHUNK_OVERLAP: int = 50

    # BGE-M3 임베딩 서버 설정
    EMBEDDING_URL: str = "http://ai.kca.kr:8083"
    EMBEDDING_MODEL: str = "bge-m3-korean"
    EMBEDDING_DIMENSION: int = 1024

    # LLM API 설정 (다중 모델 지원)
    LLM_BASE_URL: str = "http://ai.kca.kr:8080"
    LLM_MODEL: str = "gpt-oss-20b"

    # GPT-OSS 20B 설정
    GPT_OSS_20B_URL: str = "http://ai.kca.kr:8080"
    GPT_OSS_20B_MODEL: str = "gpt-oss-20b"

    # EXAONE Deep 7.8B 설정 (공식 권장값 적용)
    EXAONE_DEEP_URL: str = "http://localhost:8085"
    EXAONE_DEEP_MODEL: str = "exaone-deep-7.8b"
    EXAONE_DEEP_TEMPERATURE: float = 0.6  # 공식 권장값
    EXAONE_DEEP_TOP_P: float = 0.95  # 공식 권장값
    EXAONE_DEEP_MAX_TOKENS: int = 8192  # reasoning 토큰 포함
    EXAONE_DEEP_REPETITION_PENALTY: float = 1.0  # 1.0 초과 금지 (공식 권장)

    # EXAONE 4.0 32B 설정
    EXAONE_4_0_32B_URL: str = "http://localhost:8081"
    EXAONE_4_0_32B_MODEL: str = "exaone-4.0-32b"
    EXAONE_4_0_32B_TEMPERATURE: float = 0.7
    EXAONE_4_0_32B_TOP_P: float = 0.9
    EXAONE_4_0_32B_MAX_TOKENS: int = 8192

    LLM_DEFAULT_TEMPERATURE: float = 0.7
    LLM_DEFAULT_MAX_TOKENS: int = 4096
    LLM_DEFAULT_TOP_P: float = 0.9

    # RAG 설정
    RAG_DEFAULT_TOP_K: int = 5
    # BGE-M3 Cosine 유사도 기준, 0.4 이상만 검색 (저품질 문서 필터링)
    RAG_DEFAULT_SCORE_THRESHOLD: Optional[float] = 0.4
    RAG_DEFAULT_REASONING_LEVEL: str = "medium"
    RAG_DEEP_THINKING_LEVEL: str = "medium"  # low, medium, high

    # 프롬프트 설정
    PROMPTS_DIR: Optional[str] = None  # None이면 backend/prompts/ 사용

    # 프롬프트 자동 생성 설정
    PROMPT_GEN_MAX_TOKENS: int = 4096  # 시스템 프롬프트 생성 시 최대 출력 토큰
    PROMPT_GEN_QUESTIONS_MAX_TOKENS: int = 4096  # 추천 질문 생성 시 최대 출력 토큰 (reasoning 모드 고려)
    PROMPT_GEN_SAMPLE_LIMIT: int = 4096  # 문서 샘플 최대 문자수 (입력 토큰 절약)

    # 셀프진단 설정
    SELFCHECK_MAX_TOKENS: int = 4000  # 셀프진단 LLM 분석 최대 토큰
    SELFCHECK_BATCH_MAX_TOKENS: int = 2000  # 배치 호출 최대 토큰
    SELFCHECK_RECOVERY_MAX_TOKENS: int = 300  # 복구 호출 최대 토큰
    SELFCHECK_TEMPERATURE: float = 0.3  # 셀프진단 LLM 온도
    SELFCHECK_TIMEOUT: int = 60  # 배치 호출 타임아웃 (초)
    SELFCHECK_RECOVERY_TIMEOUT: int = 30  # 복구 호출 타임아웃 (초)

    # 셀프진단 유사과제 검토 설정
    SELFCHECK_SIMILARITY_ENABLED: bool = True  # 유사과제 검토 활성화
    SELFCHECK_SIMILARITY_THRESHOLD: int = 70  # 유사도 임계값 (%)
    SELFCHECK_SIMILARITY_HIGH_THRESHOLD: int = 85  # 높은 유사도 임계값 (%)
    SELFCHECK_SIMILARITY_MAX_RESULTS: int = 3  # 최대 유사과제 수
    SELFCHECK_SIMILARITY_DAYS: int = 180  # 검토 대상 기간 (일)
    SELFCHECK_SIMILARITY_MAX_TOKENS: int = 1000  # 유사성 판단 LLM 최대 토큰

    # BGE Reranker v2-m3 설정
    RERANKER_URL: str = "http://ai.kca.kr:8006"
    RERANKER_MODEL: str = "BAAI/bge-reranker-v2-m3"
    RERANKER_TIMEOUT: int = 30
    USE_RERANKING: bool = True
    # 기존 5배에서 3배로 축소하여 속도 30% 향상 (top_k=5 → 15개 검색)
    RERANK_TOP_K_MULTIPLIER: int = 3
    # BGE Reranker 점수 분포: 관련 문서 0.2~0.5, 비관련 0.01 이하
    # 0.5는 너무 높아 대부분 문서가 필터링되므로 0.15로 설정
    RERANK_SCORE_THRESHOLD: float = 0.15

    # 하이브리드 검색 설정 (벡터 + BM25)
    USE_HYBRID_SEARCH: bool = True  # 하이브리드 검색 활성화
    HYBRID_VECTOR_WEIGHT: float = 0.7  # 벡터 검색 가중치
    HYBRID_BM25_WEIGHT: float = 0.3  # BM25 키워드 검색 가중치
    HYBRID_RRF_K: int = 60  # RRF (Reciprocal Rank Fusion) 상수

    # 대화 로깅 및 히스토리 설정
    CONVERSATION_SAMPLE_RATE: float = 1.0  # 100% 저장 (기본값)
    CONVERSATION_RETENTION_DAYS: int = 30  # 30일 보존
    CONVERSATION_COMPRESS_AFTER_DAYS: int = 7  # 7일 후 압축

    # ===========================================
    # Rate Limiting 설정
    # ===========================================
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_DEFAULT: str = "100/minute"
    RATE_LIMIT_AUTH: str = "5/minute"
    RATE_LIMIT_CHAT: str = "30/minute"
    RATE_LIMIT_UPLOAD: str = "10/minute"
    RATE_LIMIT_SEARCH: str = "60/minute"
    RATE_LIMIT_STORAGE_URI: str = "memory://"

    # ===========================================
    # HTTP Client 설정
    # ===========================================
    HTTP_MAX_CONNECTIONS: int = 100
    HTTP_MAX_KEEPALIVE: int = 20
    HTTP_TIMEOUT_DEFAULT: float = 30.0
    HTTP_ENABLE_HTTP2: bool = True

    # Qwen3 VL OCR 설정
    QWEN3_VL_BASE_URL: str = "http://localhost:8084"
    QWEN3_VL_MODEL: str = "qwen3-vl-8b"
    QWEN3_VL_TIMEOUT: int = 120
    QWEN3_VL_MAX_PAGES: int = 50
    QWEN3_VL_MAX_TOKENS: int = 8192
    QWEN3_VL_TEMPERATURE: float = 0.1
    QWEN3_VL_CONCURRENCY: int = 2  # Qwen3-VL 페이지별 병렬 처리 수
    QWEN3_VL_OCR_PROMPT: str = "이미지에 있는 모든 텍스트를 정확하게 추출해주세요. 표, 날짜, 숫자 등 모든 내용을 원본 형식 그대로 보존하여 추출해주세요. Extract all text from this image accurately, preserving tables, dates, numbers, and formatting."

    # ===========================================
    # 배치 처리 설정
    # ===========================================
    UPLOAD_BATCH_SIZE: int = 10  # Qdrant 업로드 배치 크기
    LOGGING_BATCH_SIZE: int = 20  # 로깅 배치 크기

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

    @property
    def QWEN3_VL_API_URL(self) -> str:
        """Qwen3 VL API URL"""
        return f"{self.QWEN3_VL_BASE_URL}/v1/chat/completions"

    def get_llm_config(self, model_key: str) -> dict:
        """
        모델 키를 기반으로 LLM 설정 반환

        Args:
            model_key: 모델 키 (예: "gpt-oss-20b", "exaone-deep-7.8b", "exaone-4.0-32b")

        Returns:
            dict: {
                "base_url": str,
                "model": str,
                "temperature": float,
                "top_p": float,
                "max_tokens": int,
                "is_exaone_deep": bool
            }
        """
        model_configs = {
            "gpt-oss-20b": {
                "base_url": self.GPT_OSS_20B_URL,
                "model": self.GPT_OSS_20B_MODEL,
                "temperature": self.LLM_DEFAULT_TEMPERATURE,
                "top_p": self.LLM_DEFAULT_TOP_P,
                "max_tokens": self.LLM_DEFAULT_MAX_TOKENS,
                "is_exaone_deep": False
            },
            "exaone-deep-7.8b": {
                "base_url": self.EXAONE_DEEP_URL,
                "model": self.EXAONE_DEEP_MODEL,
                "temperature": self.EXAONE_DEEP_TEMPERATURE,
                "top_p": self.EXAONE_DEEP_TOP_P,
                "max_tokens": self.EXAONE_DEEP_MAX_TOKENS,
                "repetition_penalty": self.EXAONE_DEEP_REPETITION_PENALTY,
                "is_exaone_deep": True
            },
            "exaone-4.0-32b": {
                "base_url": self.EXAONE_4_0_32B_URL,
                "model": self.EXAONE_4_0_32B_MODEL,
                "temperature": self.EXAONE_4_0_32B_TEMPERATURE,
                "top_p": self.EXAONE_4_0_32B_TOP_P,
                "max_tokens": self.EXAONE_4_0_32B_MAX_TOKENS,
                "is_exaone_deep": False
            }
        }

        # 요청된 모델이 있으면 반환, 없으면 기본값
        return model_configs.get(model_key, {
            "base_url": self.LLM_BASE_URL,
            "model": self.LLM_MODEL,
            "temperature": self.LLM_DEFAULT_TEMPERATURE,
            "top_p": self.LLM_DEFAULT_TOP_P,
            "max_tokens": self.LLM_DEFAULT_MAX_TOKENS,
            "is_exaone_deep": False
        })

    def get_available_llm_models(self) -> list:
        """
        사용 가능한 LLM 모델 목록 반환 (프론트엔드용)

        Returns:
            list: 모델 정보 리스트
        """
        return [
            {
                "key": "gpt-oss-20b",
                "label": "GPT-OSS 20B",
                "description": "빠른 응답, 범용",
                "url": self.GPT_OSS_20B_URL
            },
            {
                "key": "exaone-4.0-32b",
                "label": "EXAONE 32B",
                "description": "고성능, 장문 처리",
                "url": self.EXAONE_4_0_32B_URL
            }
        ]

    class Config:
        # settings.py 파일의 위치를 기준으로 .env 파일의 절대 경로 계산
        # backend/config/settings.py -> backend/.env
        env_file = str(Path(__file__).parent.parent / ".env")
        case_sensitive = True


settings = Settings()
