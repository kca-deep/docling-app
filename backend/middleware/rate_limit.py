"""
Rate Limiting 미들웨어
slowapi를 사용하여 API 요청 제한을 구현합니다.
"""
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from fastapi import Request
from fastapi.responses import JSONResponse

from backend.config.settings import settings


def get_rate_limit_key(request: Request) -> str:
    """
    Rate Limit 키 생성
    인증된 사용자는 user_id 기반, 비인증 사용자는 IP 기반
    """
    # Authorization 헤더에서 사용자 정보 추출 시도
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        # 토큰에서 사용자 ID 추출 (간단한 구현)
        # 실제로는 JWT 디코딩이 필요하지만, rate limiting에서는 토큰 자체를 키로 사용
        return f"user:{auth_header[7:20]}"  # 토큰 앞부분만 사용

    # IP 기반 키
    return get_remote_address(request)


# Limiter 인스턴스 생성
limiter = Limiter(
    key_func=get_rate_limit_key,
    default_limits=[settings.RATE_LIMIT_DEFAULT],
    storage_uri=settings.RATE_LIMIT_STORAGE_URI,
    enabled=settings.RATE_LIMIT_ENABLED
)


def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    """
    Rate Limit 초과 시 응답 핸들러
    """
    return JSONResponse(
        status_code=429,
        content={
            "detail": "요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.",
            "error": "rate_limit_exceeded",
            "retry_after": exc.detail
        },
        headers={
            "Retry-After": str(getattr(exc, 'retry_after', 60)),
            "X-RateLimit-Limit": str(getattr(exc, 'limit', 'N/A'))
        }
    )


# Rate Limit 데코레이터 헬퍼
def limit_auth():
    """인증 엔드포인트용 Rate Limit (5/minute)"""
    return limiter.limit(settings.RATE_LIMIT_AUTH)


def limit_chat():
    """채팅 엔드포인트용 Rate Limit (30/minute)"""
    return limiter.limit(settings.RATE_LIMIT_CHAT)


def limit_upload():
    """업로드 엔드포인트용 Rate Limit (10/minute)"""
    return limiter.limit(settings.RATE_LIMIT_UPLOAD)


def limit_search():
    """검색 엔드포인트용 Rate Limit (60/minute)"""
    return limiter.limit(settings.RATE_LIMIT_SEARCH)


def limit_default():
    """기본 Rate Limit (100/minute)"""
    return limiter.limit(settings.RATE_LIMIT_DEFAULT)
