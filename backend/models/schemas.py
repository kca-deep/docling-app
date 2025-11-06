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
