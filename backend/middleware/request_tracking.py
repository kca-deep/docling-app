"""
요청 추적 미들웨어
모든 API 요청에 대한 request_id와 trace_id 생성 및 관리
"""

import uuid
import time
from typing import Optional
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp
import logging

logger = logging.getLogger(__name__)


class RequestTrackingMiddleware(BaseHTTPMiddleware):
    """요청 추적 미들웨어"""

    async def dispatch(self, request: Request, call_next):
        """각 요청에 대한 추적 ID 생성 및 관리"""

        # request_id 생성 (각 요청마다 고유)
        request_id = str(uuid.uuid4())

        # trace_id 처리 (클라이언트가 제공하거나 새로 생성)
        trace_id = request.headers.get("X-Trace-Id", str(uuid.uuid4()))

        # Request 객체에 추적 정보 저장
        request.state.request_id = request_id
        request.state.trace_id = trace_id

        # 요청 시작 시간 기록
        request.state.start_time = time.time()

        # 로그에 추적 정보 추가
        logger.info(f"Request started - request_id: {request_id}, trace_id: {trace_id}, "
                   f"method: {request.method}, path: {request.url.path}")

        try:
            # 요청 처리
            response = await call_next(request)

            # 응답 헤더에 추적 ID 추가
            response.headers["X-Request-Id"] = request_id
            response.headers["X-Trace-Id"] = trace_id

            # 처리 시간 계산
            process_time = time.time() - request.state.start_time
            response.headers["X-Process-Time"] = str(process_time)

            logger.info(f"Request completed - request_id: {request_id}, "
                       f"status: {response.status_code}, "
                       f"process_time: {process_time:.3f}s")

            return response

        except Exception as e:
            # 에러 발생 시에도 추적 정보 로깅
            process_time = time.time() - request.state.start_time
            logger.error(f"Request failed - request_id: {request_id}, "
                        f"error: {str(e)}, process_time: {process_time:.3f}s")
            raise


def get_request_id(request: Request) -> Optional[str]:
    """Request 객체에서 request_id 추출"""
    return getattr(request.state, "request_id", None)


def get_trace_id(request: Request) -> Optional[str]:
    """Request 객체에서 trace_id 추출"""
    return getattr(request.state, "trace_id", None)


def get_tracking_ids(request: Request) -> dict:
    """Request 객체에서 추적 ID들을 추출"""
    return {
        "request_id": get_request_id(request),
        "trace_id": get_trace_id(request)
    }