"""
API 요청/응답 스키마
"""
from pydantic import BaseModel
from typing import Optional, Any, List
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


# Dify 연동 관련 스키마
class DifyConfigRequest(BaseModel):
    """Dify 설정 요청"""
    api_key: str
    base_url: str = "https://api.dify.ai/v1"
    dataset_id: Optional[str] = None


class DifyDatasetResponse(BaseModel):
    """Dify 데이터셋 응답 (실제 API 응답 기준)"""
    # 필수 필드
    id: str
    name: str
    provider: str
    permission: str
    app_count: int
    document_count: int
    word_count: int
    created_by: str
    created_at: int
    updated_by: str
    updated_at: int

    # nullable 필드
    description: Optional[str] = None
    data_source_type: Optional[str] = None
    indexing_technique: Optional[str] = None
    embedding_model: Optional[str] = None
    embedding_model_provider: Optional[str] = None
    embedding_available: Optional[bool] = None

    # 실제 API에서 반환되는 추가 필드들 (모두 Optional)
    retrieval_model_dict: Optional[dict] = None
    tags: Optional[list] = None
    doc_form: Optional[str] = None
    external_knowledge_info: Optional[dict] = None
    external_retrieval_model: Optional[dict] = None
    doc_metadata: Optional[list] = None
    built_in_field_enabled: Optional[bool] = None
    pipeline_id: Optional[str] = None
    runtime_mode: Optional[str] = None
    chunk_structure: Optional[str] = None
    icon_info: Optional[dict] = None
    is_published: Optional[bool] = None
    total_documents: Optional[int] = None
    total_available_documents: Optional[int] = None
    enable_api: Optional[bool] = None

    class Config:
        extra = "ignore"  # 혹시 모를 추가 필드 무시


class DifyDatasetListResponse(BaseModel):
    """Dify 데이터셋 목록 응답 (Dify API 문서 기준)"""
    data: List[DifyDatasetResponse]
    has_more: bool
    limit: int
    total: int
    page: int

    class Config:
        extra = "ignore"  # 추가 필드 무시


class DifyUploadRequest(BaseModel):
    """Dify 문서 업로드 요청"""
    api_key: str
    base_url: str
    dataset_id: str
    dataset_name: Optional[str] = None  # 데이터셋 이름 (이력 저장용)
    document_ids: List[int]  # DB에 저장된 문서 ID 목록


class DifyUploadResult(BaseModel):
    """Dify 문서 업로드 결과 (개별)"""
    document_id: int
    filename: str
    success: bool
    dify_document_id: Optional[str] = None
    error: Optional[str] = None


class DifyUploadResponse(BaseModel):
    """Dify 문서 업로드 응답 (전체)"""
    total: int
    success_count: int
    failure_count: int
    results: List[DifyUploadResult]


# Dify 업로드 이력 관련 스키마
class DifyUploadHistoryResponse(BaseModel):
    """Dify 업로드 이력 응답"""
    id: int
    document_id: int
    original_filename: str
    dify_dataset_id: str
    dify_dataset_name: Optional[str]
    dify_document_id: Optional[str]
    upload_status: str
    error_message: Optional[str]
    uploaded_at: str

    class Config:
        from_attributes = True


# Dify 설정 저장 관련 스키마
class DifyConfigSaveRequest(BaseModel):
    """Dify 설정 저장 요청"""
    config_name: str
    api_key: str
    base_url: str = "https://api.dify.ai/v1"
    default_dataset_id: Optional[str] = None
    default_dataset_name: Optional[str] = None
    description: Optional[str] = None


class DifyConfigUpdateRequest(BaseModel):
    """Dify 설정 업데이트 요청"""
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    default_dataset_id: Optional[str] = None
    default_dataset_name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class DifyConfigListResponse(BaseModel):
    """Dify 설정 응답"""
    id: int
    config_name: str
    base_url: str
    default_dataset_id: Optional[str]
    default_dataset_name: Optional[str]
    is_active: bool
    description: Optional[str]
    created_at: str
    last_used_at: Optional[str]

    class Config:
        from_attributes = True
