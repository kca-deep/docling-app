"""
에러 처리 유틸리티
프로덕션 환경에서 안전한 에러 메시지 반환
"""
import json
import logging
from typing import Optional
from backend.config.settings import settings

logger = logging.getLogger("uvicorn")

# 에러 컨텍스트별 일반화된 메시지 매핑
ERROR_MESSAGES = {
    "chat": "채팅 처리 중 오류가 발생했습니다.",
    "stream": "스트리밍 처리 중 오류가 발생했습니다.",
    "regenerate": "응답 재생성 중 오류가 발생했습니다.",
    "collection": "컬렉션 조회 중 오류가 발생했습니다.",
    "prompts": "추천 질문 조회 중 오류가 발생했습니다.",
    "settings": "설정 조회 중 오류가 발생했습니다.",
    "timeout": "응답 시간이 초과되었습니다.",
    "not_found": "관련된 문서를 찾을 수 없습니다.",
    "default": "일시적인 오류가 발생했습니다."
}


def get_safe_error_message(
    error: Exception,
    context: str = "default",
    prefix: Optional[str] = None
) -> str:
    """
    프로덕션 환경에서 안전한 에러 메시지 반환

    Args:
        error: 발생한 예외
        context: 에러 컨텍스트 키 (ERROR_MESSAGES 키)
        prefix: 메시지 앞에 붙일 접두사 (예: "채팅 처리 실패")

    Returns:
        DEBUG=True: 원본 에러 메시지 포함
        DEBUG=False: 일반화된 메시지만
    """
    if settings.DEBUG:
        # 개발 모드: 상세 에러 메시지 포함
        if prefix:
            return f"{prefix}: {str(error)}"
        return str(error)

    # 프로덕션 모드: 일반화된 메시지
    return ERROR_MESSAGES.get(context, ERROR_MESSAGES["default"])


def get_http_error_detail(
    error: Exception,
    context: str = "default",
    prefix: Optional[str] = None
) -> str:
    """
    HTTPException용 detail 메시지 반환

    Args:
        error: 발생한 예외
        context: 에러 컨텍스트 키
        prefix: 메시지 앞에 붙일 접두사

    Returns:
        HTTPException에 사용할 detail 문자열
    """
    # 로그에는 항상 상세 에러 기록
    logger.error(f"[{context.upper()}] Error: {error}")

    return get_safe_error_message(error, context, prefix)


def get_sse_error_response(
    error: Exception,
    context: str = "default"
) -> str:
    """
    SSE 에러 응답 포맷 생성

    Args:
        error: 발생한 예외
        context: 에러 컨텍스트 키

    Returns:
        SSE 형식의 에러 응답 문자열
    """
    # 로그에는 항상 상세 에러 기록
    logger.error(f"[{context.upper()}] SSE Error: {error}")

    message = get_safe_error_message(error, context)
    return f'data: {json.dumps({"error": message}, ensure_ascii=False)}\n\n'
