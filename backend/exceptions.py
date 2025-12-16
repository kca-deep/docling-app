"""
커스텀 예외 클래스 정의

도메인별 예외를 구분하여 더 명확한 에러 핸들링 지원
"""


class DoclingAppError(Exception):
    """애플리케이션 기본 예외 클래스"""

    def __init__(self, message: str, detail: str = None):
        self.message = message
        self.detail = detail
        super().__init__(self.message)


class QdrantServiceError(DoclingAppError):
    """Qdrant Vector DB 서비스 관련 예외"""
    pass


class RAGServiceError(DoclingAppError):
    """RAG 서비스 관련 예외"""
    pass


class LLMServiceError(DoclingAppError):
    """LLM API 서비스 관련 예외"""
    pass


class EmbeddingServiceError(DoclingAppError):
    """임베딩 서비스 관련 예외"""
    pass


class RerankerServiceError(DoclingAppError):
    """리랭커 서비스 관련 예외"""
    pass


class DifyServiceError(DoclingAppError):
    """Dify API 서비스 관련 예외"""
    pass


class DocumentServiceError(DoclingAppError):
    """문서 처리 서비스 관련 예외"""
    pass


class AuthenticationError(DoclingAppError):
    """인증 관련 예외"""
    pass


class AuthorizationError(DoclingAppError):
    """권한 관련 예외"""
    pass


class ValidationError(DoclingAppError):
    """데이터 검증 관련 예외"""
    pass


class ConfigurationError(DoclingAppError):
    """설정 관련 예외"""
    pass


class ExternalServiceError(DoclingAppError):
    """외부 서비스 연동 관련 예외"""
    pass
