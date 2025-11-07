"""
API 요청/응답 스키마
"""
from pydantic import BaseModel
from typing import Optional, Any
from enum import Enum


class TargetType(str, Enum):
    """변환 타겟 타입"""
    INBODY = "inbody"
    MARKDOWN = "markdown"
    JSON = "json"


class TaskStatus(str, Enum):
    """Task 상태"""
    PENDING = "pending"
    PROCESSING = "processing"
    SUCCESS = "success"
    FAILURE = "failure"
    UNKNOWN = "unknown"


class ConvertRequest(BaseModel):
    """문서 변환 요청"""
    target_type: TargetType = TargetType.INBODY


class TaskResponse(BaseModel):
    """Task 생성 응답"""
    task_id: str
    status: str


class TaskStatusResponse(BaseModel):
    """Task 상태 응답"""
    task_id: str
    task_status: TaskStatus
    message: Optional[str] = None


class DocumentInfo(BaseModel):
    """문서 정보"""
    filename: str
    md_content: Optional[str] = None
    processing_time: Optional[float] = None


class ConvertResult(BaseModel):
    """변환 결과"""
    task_id: str
    status: TaskStatus
    document: Optional[DocumentInfo] = None
    error: Optional[str] = None
    processing_time: Optional[float] = None


class ErrorResponse(BaseModel):
    """에러 응답"""
    error: str
    detail: Optional[str] = None


# Document 저장 관련 스키마
class DocumentSaveRequest(BaseModel):
    """문서 저장 요청"""
    task_id: str
    original_filename: str
    file_size: Optional[int] = None
    file_type: Optional[str] = None
    md_content: str
    processing_time: Optional[float] = None
    parse_options: Optional[dict] = None


class DocumentListResponse(BaseModel):
    """문서 목록 응답 (메타데이터만)"""
    id: int
    task_id: str
    original_filename: str
    content_length: Optional[int]
    content_preview: Optional[str]
    processing_time: Optional[float]
    created_at: str

    class Config:
        from_attributes = True


class DocumentDetailResponse(BaseModel):
    """문서 상세 응답 (전체 내용 포함)"""
    id: int
    task_id: str
    original_filename: str
    file_size: Optional[int]
    file_type: Optional[str]
    md_content: str
    processing_time: Optional[float]
    content_length: Optional[int]
    download_count: int
    created_at: str

    class Config:
        from_attributes = True


class DocumentSaveResponse(BaseModel):
    """문서 저장 응답"""
    id: int
    task_id: str
    original_filename: str
    message: str

    class Config:
        from_attributes = True
