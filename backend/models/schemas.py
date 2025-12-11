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
    updated_by: Optional[str] = None  # None 허용 (새로 생성된 데이터셋의 경우 None일 수 있음)
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


# URL 파싱 관련 스키마
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


# Qdrant Vector DB 관련 스키마
class QdrantCollectionInfo(BaseModel):
    """Qdrant Collection 정보"""
    name: str
    documents_count: int  # 고유 문서 수
    points_count: int  # 청크(chunks) 수
    vector_size: int
    distance: str
    # 메타데이터 필드 (SQLite에서 조회)
    visibility: str = "public"  # public, private, shared
    description: Optional[str] = None
    owner_id: Optional[int] = None
    is_owner: bool = False  # 현재 사용자가 소유자인지 여부


class QdrantCollectionCreateRequest(BaseModel):
    """Qdrant Collection 생성 요청"""
    collection_name: str
    vector_size: int = 1024
    distance: str = "Cosine"  # Cosine, Euclidean, Dot
    visibility: str = "public"  # public, private, shared
    description: Optional[str] = None


class QdrantCollectionSettingsRequest(BaseModel):
    """컬렉션 설정 변경 요청"""
    visibility: Optional[str] = None  # public, private, shared
    description: Optional[str] = None
    allowed_users: Optional[List[int]] = None  # visibility=shared일 때 사용


class QdrantCollectionResponse(BaseModel):
    """Qdrant Collection 생성/삭제 응답"""
    success: bool
    collection_name: str
    message: str


class QdrantCollectionsResponse(BaseModel):
    """Qdrant Collection 목록 응답"""
    collections: List[QdrantCollectionInfo]


class QdrantUploadRequest(BaseModel):
    """Qdrant 문서 업로드 요청"""
    collection_name: str
    document_ids: List[int]
    chunk_size: int = 500
    chunk_overlap: int = 50


class QdrantUploadResult(BaseModel):
    """Qdrant 문서 업로드 결과 (개별)"""
    document_id: int
    filename: str
    success: bool
    chunk_count: int = 0
    vector_ids: List[str] = []
    error: Optional[str] = None


class QdrantUploadResponse(BaseModel):
    """Qdrant 문서 업로드 응답 (전체)"""
    total: int
    success_count: int
    failure_count: int
    results: List[QdrantUploadResult]


class QdrantConfigResponse(BaseModel):
    """Qdrant 청킹 설정 응답"""
    default_chunk_size: int
    default_chunk_overlap: int


# ==================== Chat API Schemas ====================

class ChatMessage(BaseModel):
    """채팅 메시지"""
    role: str  # "user" or "assistant"
    content: str


class ChatRequest(BaseModel):
    """채팅 요청"""
    conversation_id: Optional[str] = None  # 대화 ID (선택적)
    collection_name: Optional[str] = None  # 컬렉션 이름 (None이면 일상대화 모드)
    message: str
    model: str = "gpt-oss-20b"  # LLM 모델 선택
    reasoning_level: str = "medium"  # "low", "medium", "high"
    temperature: float = 0.7
    max_tokens: int = 2000
    top_p: float = 0.9
    frequency_penalty: float = 0.0
    presence_penalty: float = 0.0
    top_k: int = 5
    score_threshold: Optional[float] = None
    chat_history: Optional[List[ChatMessage]] = None
    stream: bool = False
    use_reranking: bool = False  # Reranking 사용 여부


class RetrievedDocument(BaseModel):
    """검색된 문서"""
    id: str
    score: float
    text: str
    metadata: Optional[dict] = None


class ChatResponse(BaseModel):
    """채팅 응답"""
    conversation_id: Optional[str] = None  # 대화 ID
    answer: str
    retrieved_docs: List[RetrievedDocument]
    usage: Optional[dict] = None


class RegenerateRequest(BaseModel):
    """응답 재생성 요청"""
    query: str
    collection_name: Optional[str] = None  # 컬렉션 이름 (None이면 일상대화 모드)
    retrieved_docs: List[RetrievedDocument]
    model: str = "gpt-oss-20b"  # LLM 모델 선택
    reasoning_level: str = "medium"
    temperature: float = 0.7
    max_tokens: int = 2000
    top_p: float = 0.9
    frequency_penalty: float = 0.0
    presence_penalty: float = 0.0
    chat_history: Optional[List[ChatMessage]] = None


# ==================== Progress Tracking Schemas ====================

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


# ==================== Default Settings Schemas ====================

class DefaultSettingsResponse(BaseModel):
    """기본 설정 응답 (.env 파일 값 제공)"""
    model: str
    reasoning_level: str
    temperature: float
    max_tokens: int
    top_p: float
    top_k: int
    use_reranking: bool


# ==================== Q&A Excel Embedding Schemas ====================

class QAPreviewRow(BaseModel):
    """Q&A 미리보기 행"""
    row_index: int
    faq_id: str
    question: str
    answer_text: str
    tags: List[str]
    policy_anchor: Optional[str] = None
    source: Optional[str] = None


class QAPreviewResponse(BaseModel):
    """Q&A Excel 미리보기 응답"""
    total_rows: int
    headers: List[str]
    preview_rows: List[QAPreviewRow]
    file_name: str


class QAEmbeddingRequest(BaseModel):
    """Q&A 임베딩 요청"""
    collection_name: str
    rows: List[QAPreviewRow]


class QAEmbeddingResult(BaseModel):
    """Q&A 임베딩 결과 (개별)"""
    row_index: int
    faq_id: str
    success: bool
    vector_id: Optional[str] = None
    error: Optional[str] = None


class QAEmbeddingResponse(BaseModel):
    """Q&A 임베딩 응답 (전체)"""
    total: int
    success_count: int
    failure_count: int
    results: List[QAEmbeddingResult]


# ==================== Dynamic Excel Embedding Schemas ====================

class ExcelPreviewRow(BaseModel):
    """Excel 미리보기 행 (동적)"""
    row_index: int
    data: dict  # 컬럼명: 값


class ExcelPreviewResponse(BaseModel):
    """Excel 미리보기 응답"""
    total_rows: int
    headers: List[str]
    preview_rows: List[ExcelPreviewRow]
    file_name: str
    detected_mapping: Optional[dict] = None  # 자동 감지된 컬럼 매핑


class ColumnMapping(BaseModel):
    """컬럼 매핑 설정"""
    id_column: Optional[str] = None  # ID로 사용할 컬럼
    text_columns: List[str]  # 임베딩 텍스트로 사용할 컬럼들
    text_template: Optional[str] = None  # 텍스트 템플릿 (예: "{question}\n{answer}")
    tag_column: Optional[str] = None  # 태그 컬럼
    metadata_columns: List[str] = []  # 메타데이터로 저장할 컬럼들
    heading_columns: List[str] = []  # headings로 사용할 컬럼들 (참조문서 표시용, 예: ["source", "page"])


class DynamicEmbeddingRequest(BaseModel):
    """동적 Excel 임베딩 요청"""
    collection_name: str
    file_name: str
    rows: List[ExcelPreviewRow]
    mapping: ColumnMapping


class DynamicEmbeddingResult(BaseModel):
    """동적 임베딩 결과 (개별)"""
    row_index: int
    id_value: Optional[str] = None
    success: bool
    vector_id: Optional[str] = None
    error: Optional[str] = None


class DynamicEmbeddingResponse(BaseModel):
    """동적 임베딩 응답 (전체)"""
    total: int
    success_count: int
    failure_count: int
    results: List[DynamicEmbeddingResult]
