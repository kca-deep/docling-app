"""
토큰 수 계산 유틸리티

tiktoken 라이브러리를 사용하여 정확한 토큰 수를 계산합니다.
tiktoken이 설치되지 않은 경우 개선된 추정 방식으로 fallback합니다.
"""
import logging
import re
from typing import List, Optional

logger = logging.getLogger(__name__)

# tiktoken lazy loading
_encoder: Optional[object] = None
_tiktoken_available: Optional[bool] = None


def _init_tiktoken() -> bool:
    """tiktoken 초기화 (lazy loading)"""
    global _encoder, _tiktoken_available

    if _tiktoken_available is not None:
        return _tiktoken_available

    try:
        import tiktoken
        _encoder = tiktoken.get_encoding("cl100k_base")
        _tiktoken_available = True
        logger.info("[TOKEN_COUNTER] tiktoken initialized with cl100k_base encoding")
    except ImportError:
        _tiktoken_available = False
        logger.warning("[TOKEN_COUNTER] tiktoken not installed, using fallback estimation")
    except Exception as e:
        _tiktoken_available = False
        logger.warning(f"[TOKEN_COUNTER] tiktoken initialization failed: {e}, using fallback")

    return _tiktoken_available


def is_tiktoken_available() -> bool:
    """tiktoken 사용 가능 여부 확인"""
    return _init_tiktoken()


def _estimate_tokens_fallback(text: str) -> int:
    """
    tiktoken 없을 때 개선된 토큰 추정

    실제 측정 기반 추정치:
    - 한글: 약 0.7~1.0 토큰/글자 (평균 0.8)
    - 영어 단어: 약 1.3 토큰/단어 (약 0.25 토큰/글자)
    - 숫자: 약 0.3 토큰/글자
    - 공백/특수문자: 낮은 비율
    """
    if not text:
        return 0

    # 문자 유형별 분류
    korean_chars = len(re.findall(r'[가-힣]', text))
    english_chars = len(re.findall(r'[a-zA-Z]', text))
    digit_chars = len(re.findall(r'[0-9]', text))
    other_chars = len(text) - korean_chars - english_chars - digit_chars

    # 가중치 기반 토큰 추정
    estimated = (
        korean_chars * 0.8 +      # 한글: 0.8 토큰/글자
        english_chars * 0.25 +    # 영어: 0.25 토큰/글자
        digit_chars * 0.3 +       # 숫자: 0.3 토큰/글자
        other_chars * 0.2         # 기타: 0.2 토큰/글자
    )

    return max(1, int(estimated))


def count_tokens(text: str) -> int:
    """
    텍스트의 토큰 수를 계산합니다.

    tiktoken이 사용 가능하면 정확한 토큰 수를 반환하고,
    그렇지 않으면 개선된 추정치를 반환합니다.

    Args:
        text: 토큰 수를 계산할 텍스트

    Returns:
        토큰 수 (최소 1)
    """
    if not text:
        return 0

    if _init_tiktoken() and _encoder is not None:
        try:
            return len(_encoder.encode(text))
        except Exception as e:
            logger.warning(f"[TOKEN_COUNTER] tiktoken encoding failed: {e}, using fallback")
            return _estimate_tokens_fallback(text)

    return _estimate_tokens_fallback(text)


def count_tokens_batch(texts: List[str]) -> List[int]:
    """
    여러 텍스트의 토큰 수를 한 번에 계산합니다.

    Args:
        texts: 토큰 수를 계산할 텍스트 리스트

    Returns:
        각 텍스트의 토큰 수 리스트
    """
    if not texts:
        return []

    if _init_tiktoken() and _encoder is not None:
        try:
            return [len(_encoder.encode(text)) if text else 0 for text in texts]
        except Exception as e:
            logger.warning(f"[TOKEN_COUNTER] tiktoken batch encoding failed: {e}, using fallback")

    return [_estimate_tokens_fallback(text) for text in texts]


def count_chat_tokens(
    message: str,
    retrieved_docs: Optional[List[dict]] = None,
    answer: Optional[str] = None
) -> dict:
    """
    채팅 상호작용의 토큰 수를 계산합니다.

    Args:
        message: 사용자 메시지
        retrieved_docs: 검색된 문서 리스트 (각각 'text' 키 포함)
        answer: AI 응답 텍스트

    Returns:
        {
            "input_tokens": int,      # 입력 토큰 수 (메시지 + 검색 문서)
            "output_tokens": int,     # 출력 토큰 수 (응답)
            "total_tokens": int,      # 총 토큰 수
            "is_estimated": bool      # 추정치 여부 (tiktoken 미사용 시 True)
        }
    """
    # 입력 텍스트 구성
    input_text = message or ""
    if retrieved_docs:
        for doc in retrieved_docs:
            if isinstance(doc, dict):
                input_text += doc.get("text", "")

    # 토큰 수 계산
    input_tokens = count_tokens(input_text)
    output_tokens = count_tokens(answer) if answer else 0

    return {
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "total_tokens": input_tokens + output_tokens,
        "is_estimated": not is_tiktoken_available()
    }
