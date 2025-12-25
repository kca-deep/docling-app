"""
Qdrant Vector DB 스키마
벡터 데이터베이스 관련
"""
from pydantic import BaseModel, ConfigDict
from typing import Optional, List


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
    allowed_users: Optional[List[int]] = None  # 공유 허용 사용자 ID 목록 (visibility=shared일 때)


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


class QdrantUploadProgressEvent(BaseModel):
    """Qdrant 업로드 진행률 이벤트 (SSE용)"""
    event_type: str  # "progress" | "document_complete" | "error" | "done"
    document_id: Optional[int] = None
    filename: Optional[str] = None
    phase: Optional[str] = None  # "chunking" | "embedding" | "uploading"
    progress: int = 0  # 0-100
    current_doc_index: int = 0
    total_docs: int = 0
    chunk_count: Optional[int] = None
    vector_ids: Optional[List[str]] = None
    error: Optional[str] = None
    success_count: int = 0
    failure_count: int = 0


class QdrantConfigResponse(BaseModel):
    """Qdrant 청킹 설정 응답"""
    default_chunk_size: int
    default_chunk_overlap: int


class DuplicateCheckRequest(BaseModel):
    """중복 확인 요청"""
    collection_name: str
    document_ids: List[int]


class DuplicateInfo(BaseModel):
    """중복 문서 정보"""
    document_id: int
    filename: str
    uploaded_at: str


class DuplicateCheckResponse(BaseModel):
    """중복 확인 응답"""
    has_duplicates: bool
    duplicates: List[DuplicateInfo]
    new_documents: List[int]


class CollectionDocumentInfo(BaseModel):
    """컬렉션 내 문서 정보"""
    document_id: Optional[int] = None  # 일반 문서의 경우 ID, Excel의 경우 None
    filename: str
    chunk_count: int
    source_type: str  # "document" or "excel"
    source_file: Optional[str] = None  # Excel의 경우 파일명


class CollectionDocumentsResponse(BaseModel):
    """컬렉션 문서 목록 응답"""
    collection_name: str
    total_documents: int
    documents: List[CollectionDocumentInfo]


class DeleteDocumentRequest(BaseModel):
    """문서 삭제 요청"""
    document_ids: Optional[List[int]] = None  # 일반 문서 ID 목록
    source_files: Optional[List[str]] = None  # Excel 파일명 목록


class DeleteDocumentResponse(BaseModel):
    """문서 삭제 응답"""
    success: bool
    deleted_count: int
    message: str
