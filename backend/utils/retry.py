"""
Retry utilities with exponential backoff for async functions
"""
import asyncio
import random
import logging
from functools import wraps
from typing import Callable, Type, Tuple, Optional

import httpx

logger = logging.getLogger(__name__)

# 재시도 가능한 예외 타입들
RETRYABLE_EXCEPTIONS: Tuple[Type[Exception], ...] = (
    httpx.ConnectError,
    httpx.ConnectTimeout,
    httpx.ReadTimeout,
    httpx.WriteTimeout,
    httpx.PoolTimeout,
    ConnectionError,
    TimeoutError,
)


def async_retry(
    max_attempts: int = 3,
    base_delay: float = 1.0,
    max_delay: float = 30.0,
    exponential_base: float = 2.0,
    jitter: bool = True,
    retryable_exceptions: Optional[Tuple[Type[Exception], ...]] = None
):
    """
    비동기 함수를 위한 지수 백오프 재시도 데코레이터

    Args:
        max_attempts: 최대 시도 횟수 (기본값: 3)
        base_delay: 기본 대기 시간 (초) (기본값: 1.0)
        max_delay: 최대 대기 시간 (초) (기본값: 30.0)
        exponential_base: 지수 백오프 베이스 (기본값: 2.0)
        jitter: 지터 추가 여부 (기본값: True)
        retryable_exceptions: 재시도 가능한 예외 타입들

    Usage:
        @async_retry(max_attempts=3, base_delay=1.0)
        async def my_api_call():
            ...
    """
    if retryable_exceptions is None:
        retryable_exceptions = RETRYABLE_EXCEPTIONS

    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            last_exception = None

            for attempt in range(max_attempts):
                try:
                    return await func(*args, **kwargs)
                except retryable_exceptions as e:
                    last_exception = e

                    if attempt == max_attempts - 1:
                        logger.error(
                            f"All {max_attempts} retry attempts failed for {func.__name__}: {str(e)}"
                        )
                        raise

                    # 지수 백오프 계산
                    delay = min(base_delay * (exponential_base ** attempt), max_delay)

                    # 지터 추가 (0.5 ~ 1.5 배)
                    if jitter:
                        delay = delay * (0.5 + random.random())

                    logger.warning(
                        f"Retry {attempt + 1}/{max_attempts} for {func.__name__} "
                        f"after {delay:.2f}s due to: {type(e).__name__}: {str(e)}"
                    )
                    await asyncio.sleep(delay)

            # 여기 도달하면 안되지만 안전을 위해
            if last_exception:
                raise last_exception

        return wrapper
    return decorator


async def retry_async(
    func: Callable,
    *args,
    max_attempts: int = 3,
    base_delay: float = 1.0,
    max_delay: float = 30.0,
    retryable_exceptions: Optional[Tuple[Type[Exception], ...]] = None,
    **kwargs
):
    """
    함수형 스타일의 비동기 재시도

    Args:
        func: 실행할 비동기 함수
        *args: 함수 인자
        max_attempts: 최대 시도 횟수
        base_delay: 기본 대기 시간 (초)
        max_delay: 최대 대기 시간 (초)
        retryable_exceptions: 재시도 가능한 예외 타입들
        **kwargs: 함수 키워드 인자

    Returns:
        함수 실행 결과

    Usage:
        result = await retry_async(my_api_call, arg1, arg2, max_attempts=3)
    """
    if retryable_exceptions is None:
        retryable_exceptions = RETRYABLE_EXCEPTIONS

    last_exception = None

    for attempt in range(max_attempts):
        try:
            return await func(*args, **kwargs)
        except retryable_exceptions as e:
            last_exception = e

            if attempt == max_attempts - 1:
                logger.error(
                    f"All {max_attempts} retry attempts failed for {func.__name__}: {str(e)}"
                )
                raise

            delay = min(base_delay * (2 ** attempt), max_delay)
            delay = delay * (0.5 + random.random())  # jitter

            logger.warning(
                f"Retry {attempt + 1}/{max_attempts} for {func.__name__} "
                f"after {delay:.2f}s due to: {type(e).__name__}: {str(e)}"
            )
            await asyncio.sleep(delay)

    if last_exception:
        raise last_exception
