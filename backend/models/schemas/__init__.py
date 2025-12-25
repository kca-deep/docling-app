"""
API 스키마 패키지
도메인별로 분리된 스키마들을 하나의 네임스페이스로 제공

사용법:
    from backend.models.schemas import ChatRequest, ChatResponse
    from backend.models.schemas import QdrantCollectionInfo
"""
from typing import TypeVar

# 제네릭 타입 변수 (공통에서 가져옴)
T = TypeVar("T")

# Common schemas
from backend.models.schemas.common import (
    ErrorResponse,
    SimpleErrorResponse,
    ProgressStatus,
    ProgressResponse,
    ApiResponse,
    PaginationMeta,
    PaginatedResponse,
)

# Document schemas
from backend.models.schemas.document import (
    TargetType,
    TaskStatus,
    ConvertRequest,
    TaskResponse,
    TaskStatusResponse,
    DocumentInfo,
    ConvertResult,
    DocumentSaveRequest,
    DocumentListResponse,
    DocumentDetailResponse,
    DocumentSaveResponse,
    CategoryUpdateRequest,
    CategoryStat,
    CategoryStatsResponse,
    URLConvertRequest,
)

# Dify schemas
from backend.models.schemas.dify import (
    DifyConfigRequest,
    DifyDatasetResponse,
    DifyDatasetListResponse,
    DifyUploadRequest,
    DifyUploadResult,
    DifyUploadResponse,
    DifyUploadHistoryResponse,
    DifyConfigSaveRequest,
    DifyConfigUpdateRequest,
    DifyConfigListResponse,
)

# Qdrant schemas
from backend.models.schemas.qdrant import (
    QdrantCollectionInfo,
    QdrantCollectionCreateRequest,
    QdrantCollectionSettingsRequest,
    QdrantCollectionResponse,
    QdrantCollectionsResponse,
    QdrantUploadRequest,
    QdrantUploadResult,
    QdrantUploadResponse,
    QdrantUploadProgressEvent,
    QdrantConfigResponse,
    DuplicateCheckRequest,
    DuplicateInfo,
    DuplicateCheckResponse,
    CollectionDocumentInfo,
    CollectionDocumentsResponse,
    DeleteDocumentRequest,
    DeleteDocumentResponse,
)

# Chat schemas
from backend.models.schemas.chat import (
    ChatMessage,
    ChatRequest,
    RetrievedDocument,
    ChatResponse,
    RegenerateRequest,
    DefaultSettingsResponse,
)

# Excel schemas
from backend.models.schemas.excel import (
    QAPreviewRow,
    QAPreviewResponse,
    QAEmbeddingRequest,
    QAEmbeddingResult,
    QAEmbeddingResponse,
    ExcelPreviewRow,
    ExcelPreviewResponse,
    ColumnMapping,
    DynamicEmbeddingRequest,
    DynamicEmbeddingResult,
    DynamicEmbeddingResponse,
)

# SelfCheck schemas
from backend.models.schemas.selfcheck import (
    SelfCheckItemInput,
    SelfCheckAnalyzeRequest,
    SelfCheckItemResult,
    LLMModelStatus,
    LLMStatusResponse,
    SimilarProject,
    SelfCheckAnalyzeResponse,
    SelfCheckSubmitRequest,
    SelfCheckHistoryItem,
    SelfCheckHistoryResponse,
    SelfCheckDetailResponse,
    ExportPdfMode,
    SelfCheckExportRequest,
    SelfCheckExportPdfRequest,
)

# Export all schemas for backwards compatibility
__all__ = [
    # Common
    "T",
    "ErrorResponse",
    "SimpleErrorResponse",
    "ProgressStatus",
    "ProgressResponse",
    "ApiResponse",
    "PaginationMeta",
    "PaginatedResponse",
    # Document
    "TargetType",
    "TaskStatus",
    "ConvertRequest",
    "TaskResponse",
    "TaskStatusResponse",
    "DocumentInfo",
    "ConvertResult",
    "DocumentSaveRequest",
    "DocumentListResponse",
    "DocumentDetailResponse",
    "DocumentSaveResponse",
    "CategoryUpdateRequest",
    "CategoryStat",
    "CategoryStatsResponse",
    "URLConvertRequest",
    # Dify
    "DifyConfigRequest",
    "DifyDatasetResponse",
    "DifyDatasetListResponse",
    "DifyUploadRequest",
    "DifyUploadResult",
    "DifyUploadResponse",
    "DifyUploadHistoryResponse",
    "DifyConfigSaveRequest",
    "DifyConfigUpdateRequest",
    "DifyConfigListResponse",
    # Qdrant
    "QdrantCollectionInfo",
    "QdrantCollectionCreateRequest",
    "QdrantCollectionSettingsRequest",
    "QdrantCollectionResponse",
    "QdrantCollectionsResponse",
    "QdrantUploadRequest",
    "QdrantUploadResult",
    "QdrantUploadResponse",
    "QdrantUploadProgressEvent",
    "QdrantConfigResponse",
    "DuplicateCheckRequest",
    "DuplicateInfo",
    "DuplicateCheckResponse",
    "CollectionDocumentInfo",
    "CollectionDocumentsResponse",
    "DeleteDocumentRequest",
    "DeleteDocumentResponse",
    # Chat
    "ChatMessage",
    "ChatRequest",
    "RetrievedDocument",
    "ChatResponse",
    "RegenerateRequest",
    "DefaultSettingsResponse",
    # Excel
    "QAPreviewRow",
    "QAPreviewResponse",
    "QAEmbeddingRequest",
    "QAEmbeddingResult",
    "QAEmbeddingResponse",
    "ExcelPreviewRow",
    "ExcelPreviewResponse",
    "ColumnMapping",
    "DynamicEmbeddingRequest",
    "DynamicEmbeddingResult",
    "DynamicEmbeddingResponse",
    # SelfCheck
    "SelfCheckItemInput",
    "SelfCheckAnalyzeRequest",
    "SelfCheckItemResult",
    "LLMModelStatus",
    "LLMStatusResponse",
    "SimilarProject",
    "SelfCheckAnalyzeResponse",
    "SelfCheckSubmitRequest",
    "SelfCheckHistoryItem",
    "SelfCheckHistoryResponse",
    "SelfCheckDetailResponse",
    "ExportPdfMode",
    "SelfCheckExportRequest",
    "SelfCheckExportPdfRequest",
]
