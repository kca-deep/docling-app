"""
공통 API 스키마
에러 응답, 페이지네이션, 진행률 등
"""
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Generic, TypeVar
from enum import Enum

# 제네릭 타입 변수
T = TypeVar("T")


class ErrorResponse(BaseModel):
    """구조화된 에러 응답 (보안 강화)"""
    error_code: str = Field(..., description="에러 코드 (예: VALIDATION_ERROR, AUTH_ERROR)")
    message: str = Field(..., description="사용자에게 표시할 에러 메시지")
    detail: Optional[str] = Field(None, description="상세 정보 (개발 환경에서만 포함)")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="에러 발생 시간")
    request_id: Optional[str] = Field(None, description="요청 추적 ID")

    model_config = ConfigDict(json_schema_extra={
        "example": {
            "error_code": "VALIDATION_ERROR",
            "message": "요청 데이터가 올바르지 않습니다.",
            "detail": None,
            "timestamp": "2025-12-16T10:30:00Z",
            "request_id": "req_abc123"
        }
    })


class SimpleErrorResponse(BaseModel):
    """간단한 에러 응답 (기존 호환성 유지)"""
    error: str
    detail: Optional[str] = None


class ProgressStatus(str, Enum):
    """진행률 상태"""
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class ProgressResponse(BaseModel):
    """진행률 조회 응답"""
    task_id: str
    filename: str
    status: ProgressStatus
    current_page: int
    total_pages: int
    progress_percentage: float
    elapsed_time: float
    estimated_remaining_time: Optional[float] = None
    error_message: Optional[str] = None
    updated_at: str
    md_content: Optional[str] = None
    processing_time: Optional[float] = None


class ApiResponse(BaseModel, Generic[T]):
    """공통 API 응답 래퍼"""
    success: bool = True
    message: Optional[str] = None
    data: Optional[T] = None
    error_code: Optional[str] = None


class PaginationMeta(BaseModel):
    """페이지네이션 메타데이터"""
    total: int  # 전체 항목 수
    page: int  # 현재 페이지 (1부터 시작)
    page_size: int  # 페이지당 항목 수
    total_pages: int  # 전체 페이지 수
    has_next: bool  # 다음 페이지 존재 여부
    has_prev: bool  # 이전 페이지 존재 여부


class PaginatedResponse(BaseModel, Generic[T]):
    """페이지네이션 응답"""
    items: List[T]
    pagination: PaginationMeta

    @classmethod
    def create(
        cls,
        items: List[T],
        total: int,
        page: int = 1,
        page_size: int = 20
    ) -> "PaginatedResponse[T]":
        """
        페이지네이션 응답 생성 헬퍼

        Args:
            items: 현재 페이지의 항목 리스트
            total: 전체 항목 수
            page: 현재 페이지 번호 (1부터 시작)
            page_size: 페이지당 항목 수

        Returns:
            PaginatedResponse: 페이지네이션 응답
        """
        total_pages = (total + page_size - 1) // page_size if page_size > 0 else 0

        return cls(
            items=items,
            pagination=PaginationMeta(
                total=total,
                page=page,
                page_size=page_size,
                total_pages=total_pages,
                has_next=page < total_pages,
                has_prev=page > 1
            )
        )
