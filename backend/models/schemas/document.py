"""
문서 관련 스키마
문서 변환, 저장, 카테고리 관리
"""
from pydantic import BaseModel, ConfigDict
from typing import Optional, List
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


class DocumentSaveRequest(BaseModel):
    """문서 저장 요청"""
    task_id: str
    original_filename: str
    file_size: Optional[int] = None
    file_type: Optional[str] = None
    md_content: str
    processing_time: Optional[float] = None
    parse_options: Optional[dict] = None
    category: Optional[str] = None  # Qdrant Collection 이름 (카테고리)


class DocumentListResponse(BaseModel):
    """문서 목록 응답 (메타데이터만)"""
    id: int
    task_id: str
    original_filename: str
    content_length: Optional[int]
    content_preview: Optional[str]
    processing_time: Optional[float]
    created_at: str
    category: Optional[str] = None  # 카테고리 (Qdrant Collection 이름)

    model_config = ConfigDict(from_attributes=True)


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
    category: Optional[str] = None  # 카테고리

    model_config = ConfigDict(from_attributes=True)


class DocumentSaveResponse(BaseModel):
    """문서 저장 응답"""
    id: int
    task_id: str
    original_filename: str
    message: str

    model_config = ConfigDict(from_attributes=True)


class CategoryUpdateRequest(BaseModel):
    """문서 카테고리 변경 요청"""
    document_ids: List[int]
    category: Optional[str] = None  # None이면 미분류로 변경


class CategoryStat(BaseModel):
    """카테고리 통계 항목"""
    name: Optional[str]  # None = 미분류
    count: int


class CategoryStatsResponse(BaseModel):
    """카테고리 통계 응답"""
    categories: List[CategoryStat]
    total: int


class URLConvertRequest(BaseModel):
    """URL 문서 변환 요청"""
    url: str
    target_type: str = "inbody"
    to_formats: str = "md"
    do_ocr: bool = True
    do_table_structure: bool = True
    include_images: bool = True
    table_mode: str = "accurate"
    image_export_mode: str = "embedded"
    page_range_start: int = 1
    page_range_end: int = 9223372036854776000
    do_formula_enrichment: bool = False
    pipeline: str = "standard"
    vlm_pipeline_model: Optional[str] = None
