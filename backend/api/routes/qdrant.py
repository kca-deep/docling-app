"""
Qdrant Vector DB 연동 API 라우트
컬렉션 가시성(visibility) 기반 접근 제어:
- public: 모든 사용자 접근 가능
- private: 소유자만 접근 가능
- shared: 소유자 + 허용된 사용자 접근 가능
"""
import logging
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional, AsyncGenerator

from backend.services.qdrant_service import qdrant_service
from backend.services.chunking_service import ChunkingService
from backend.services.embedding_service import embedding_service
from backend.services import document_crud, qdrant_history_crud, collection_crud
from backend.database import get_db
from backend.config.settings import settings
from backend.dependencies.auth import get_current_active_user, get_current_user_optional
from backend.models.user import User
from backend.models.document import Document
from backend.models.qdrant_upload_history import QdrantUploadHistory
from backend.models.schemas import (
    QdrantCollectionsResponse,
    QdrantCollectionCreateRequest,
    QdrantCollectionResponse,
    QdrantCollectionInfo,
    QdrantCollectionSettingsRequest,
    QdrantUploadRequest,
    QdrantUploadResponse,
    QdrantUploadResult,
    QdrantUploadProgressEvent,
    QdrantConfigResponse,
    DuplicateCheckRequest,
    DuplicateCheckResponse,
    DuplicateInfo,
    CollectionDocumentInfo,
    CollectionDocumentsResponse,
    DeleteDocumentRequest,
    DeleteDocumentResponse
)

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/qdrant",
    tags=["qdrant"]
    # 인증은 엔드포인트별로 처리
)

# 싱글톤 서비스 사용 (중복 인스턴스 제거)
# qdrant_service, embedding_service는 import로 가져옴
chunking_service = ChunkingService(base_url=settings.DOCLING_CHUNKING_URL)


def _build_chunk_metadata(document_id: int, filename: str, chunks: list) -> list:
    """청크별 메타데이터 리스트 생성 (upload/upload_stream 공통)"""
    return [
        {
            "document_id": document_id,
            "filename": filename,
            "chunk_index": i,
            "num_tokens": chunk.get('num_tokens', 0),
            "headings": chunk.get('headings') or []
        }
        for i, chunk in enumerate(chunks)
    ]


def _record_upload_history(
    db: Session,
    document_id: int,
    collection_name: str,
    chunk_count: int,
    vector_ids: list,
    upload_status: str,
    error_message: Optional[str] = None
):
    """업로드 이력 저장 (성공/실패 공통)"""
    try:
        qdrant_history_crud.create_upload_history(
            db=db,
            document_id=document_id,
            collection_name=collection_name,
            chunk_count=chunk_count,
            vector_ids=vector_ids,
            qdrant_url=settings.QDRANT_URL,
            upload_status=upload_status,
            error_message=error_message
        )
    except Exception:
        pass


@router.get("/config", response_model=QdrantConfigResponse)
async def get_qdrant_config(
    current_user: User = Depends(get_current_active_user)
):
    """
    Qdrant 청킹 설정값 조회 API

    Returns:
        QdrantConfigResponse: 기본 chunk_size 및 chunk_overlap 설정값
    """
    return QdrantConfigResponse(
        default_chunk_size=settings.DEFAULT_CHUNK_SIZE,
        default_chunk_overlap=settings.DEFAULT_CHUNK_OVERLAP
    )


@router.get("/collections", response_model=QdrantCollectionsResponse)
async def get_collections(
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """
    Qdrant Collection 목록 조회 API

    사용자 권한에 따라 접근 가능한 컬렉션만 반환:
    - 비로그인: public 컬렉션만
    - 로그인: public + 소유 + 공유된(allowed) 컬렉션

    Returns:
        QdrantCollectionsResponse: Collection 목록

    Raises:
        HTTPException: Qdrant 서버 연결 실패 시
    """
    try:
        # 1. Qdrant에서 모든 컬렉션 조회
        qdrant_collections = await qdrant_service.get_collections()
        qdrant_names = [col.name for col in qdrant_collections]

        # 2. SQLite에서 접근 가능한 컬렉션 메타데이터 조회
        user_id = current_user.id if current_user else None
        accessible_metadata = collection_crud.get_accessible_collections(
            db=db,
            user_id=user_id,
            qdrant_collection_names=qdrant_names
        )

        # 3. 메타데이터를 딕셔너리로 변환 (빠른 조회용)
        metadata_map = {col.collection_name: col for col in accessible_metadata}

        # 4. Qdrant 데이터와 SQLite 메타데이터 병합
        result_collections = []
        for qdrant_col in qdrant_collections:
            if qdrant_col.name in metadata_map:
                meta = metadata_map[qdrant_col.name]
                result_collections.append(QdrantCollectionInfo(
                    name=qdrant_col.name,
                    documents_count=qdrant_col.documents_count,
                    points_count=qdrant_col.points_count,
                    vector_size=qdrant_col.vector_size,
                    distance=qdrant_col.distance,
                    visibility=meta.visibility,
                    description=meta.description,
                    owner_id=meta.owner_id,
                    is_owner=user_id is not None and meta.owner_id == user_id,
                    allowed_users=meta.allowed_users if meta.visibility == "shared" else None
                ))

        return QdrantCollectionsResponse(
            collections=result_collections
        )

    except Exception as e:
        logger.error(f"Failed to get collections: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Qdrant collection 목록 조회 실패: {str(e)}"
        )


@router.post("/collections", response_model=QdrantCollectionResponse)
async def create_collection(
    request: QdrantCollectionCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Qdrant Collection 생성 API

    Args:
        request: Collection 생성 요청 (visibility, description 포함)
        db: DB 세션
        current_user: 현재 로그인 사용자 (소유자로 지정)

    Returns:
        QdrantCollectionResponse: 생성 결과

    Raises:
        HTTPException: Collection 생성 실패 시
    """
    try:
        # Collection 이름 검증
        if not request.collection_name or not request.collection_name.strip():
            raise HTTPException(
                status_code=400,
                detail="Collection 이름은 필수입니다"
            )

        # Vector size 검증
        if request.vector_size <= 0:
            raise HTTPException(
                status_code=400,
                detail="Vector size는 양수여야 합니다"
            )

        # Distance metric 검증
        valid_distances = ["Cosine", "Euclidean", "Dot"]
        if request.distance not in valid_distances:
            raise HTTPException(
                status_code=400,
                detail=f"Distance metric은 {valid_distances} 중 하나여야 합니다"
            )

        # Visibility 검증
        valid_visibilities = ["public", "private", "shared"]
        if request.visibility not in valid_visibilities:
            raise HTTPException(
                status_code=400,
                detail=f"Visibility는 {valid_visibilities} 중 하나여야 합니다"
            )

        # 1. Qdrant에 Collection 생성
        await qdrant_service.create_collection(
            collection_name=request.collection_name,
            vector_size=request.vector_size,
            distance=request.distance
        )

        # 2. SQLite에 메타데이터 저장
        try:
            collection_crud.create_collection(
                db=db,
                collection_name=request.collection_name,
                owner_id=current_user.id,
                visibility=request.visibility,
                description=request.description
            )
            logger.info(f"Created collection metadata: {request.collection_name} (owner={current_user.id})")
        except Exception as e:
            # SQLite 저장 실패 시에도 Qdrant에는 생성되었으므로 경고만 로깅
            logger.warning(f"Failed to save collection metadata to SQLite: {e}")

        return QdrantCollectionResponse(
            success=True,
            collection_name=request.collection_name,
            message=f"Collection '{request.collection_name}'이 성공적으로 생성되었습니다"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create collection: {e}")

        # 이미 존재하는 경우
        if "이미 존재합니다" in str(e):
            raise HTTPException(
                status_code=409,
                detail=str(e)
            )

        raise HTTPException(
            status_code=500,
            detail=f"Collection 생성 실패: {str(e)}"
        )


@router.delete("/collections/{collection_name}", response_model=QdrantCollectionResponse)
async def delete_collection(
    collection_name: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Qdrant Collection 삭제 API

    소유자 또는 관리자만 삭제 가능

    Args:
        collection_name: 삭제할 Collection 이름
        db: DB 세션
        current_user: 현재 로그인 사용자

    Returns:
        QdrantCollectionResponse: 삭제 결과

    Raises:
        HTTPException: Collection 삭제 실패 시
    """
    try:
        # Collection 이름 검증
        if not collection_name or not collection_name.strip():
            raise HTTPException(
                status_code=400,
                detail="Collection 이름은 필수입니다"
            )

        # 소유권 확인 (관리자는 모든 컬렉션 삭제 가능)
        collection_meta = collection_crud.get_by_name(db, collection_name)
        if collection_meta:
            is_owner = collection_meta.owner_id == current_user.id
            is_admin = current_user.role == "admin"
            if not is_owner and not is_admin:
                raise HTTPException(
                    status_code=403,
                    detail="컬렉션 삭제 권한이 없습니다. 소유자만 삭제할 수 있습니다."
                )

        # 1. Qdrant에서 Collection 삭제
        await qdrant_service.delete_collection(collection_name)

        # 2. 해당 컬렉션에 속한 문서들의 category를 NULL(미분류)로 변경
        try:
            updated_docs = db.query(Document).filter(
                Document.category == collection_name
            ).update(
                {"category": None},
                synchronize_session=False
            )
            db.commit()
            logger.info(f"Reset category to NULL for {updated_docs} documents (collection: {collection_name})")
        except Exception as e:
            logger.warning(f"Failed to reset document categories: {e}")

        # 3. SQLite에서 해당 컬렉션의 업로드 이력 삭제
        try:
            deleted_count = db.query(QdrantUploadHistory).filter(
                QdrantUploadHistory.collection_name == collection_name
            ).delete(synchronize_session=False)
            db.commit()
            logger.info(f"Deleted {deleted_count} upload history records for collection: {collection_name}")
        except Exception as e:
            logger.warning(f"Failed to delete upload history for collection: {e}")

        # 4. SQLite에서 메타데이터 삭제
        try:
            collection_crud.delete_collection(db, collection_name)
            logger.info(f"Deleted collection metadata: {collection_name}")
        except Exception as e:
            # SQLite 삭제 실패 시에도 Qdrant에서는 삭제되었으므로 경고만 로깅
            logger.warning(f"Failed to delete collection metadata from SQLite: {e}")

        return QdrantCollectionResponse(
            success=True,
            collection_name=collection_name,
            message=f"Collection '{collection_name}'이 성공적으로 삭제되었습니다"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete collection: {e}")

        # 존재하지 않는 경우
        if "존재하지 않습니다" in str(e):
            raise HTTPException(
                status_code=404,
                detail=str(e)
            )

        raise HTTPException(
            status_code=500,
            detail=f"Collection 삭제 실패: {str(e)}"
        )


@router.patch("/collections/{collection_name}/settings", response_model=QdrantCollectionResponse)
async def update_collection_settings(
    collection_name: str,
    request: QdrantCollectionSettingsRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    컬렉션 설정 변경 API

    소유자만 설정 변경 가능

    Args:
        collection_name: 컬렉션 이름
        request: 설정 변경 요청 (visibility, description, allowed_users)
        db: DB 세션
        current_user: 현재 로그인 사용자

    Returns:
        QdrantCollectionResponse: 변경 결과

    Raises:
        HTTPException: 설정 변경 실패 시
    """
    try:
        # 컬렉션 메타데이터 조회
        collection_meta = collection_crud.get_by_name(db, collection_name)
        if not collection_meta:
            raise HTTPException(
                status_code=404,
                detail=f"컬렉션 '{collection_name}'의 메타데이터를 찾을 수 없습니다"
            )

        # 소유권 확인
        if collection_meta.owner_id != current_user.id:
            raise HTTPException(
                status_code=403,
                detail="컬렉션 설정 변경 권한이 없습니다. 소유자만 변경할 수 있습니다."
            )

        # Visibility 검증
        if request.visibility:
            valid_visibilities = ["public", "private", "shared"]
            if request.visibility not in valid_visibilities:
                raise HTTPException(
                    status_code=400,
                    detail=f"Visibility는 {valid_visibilities} 중 하나여야 합니다"
                )

        # 설정 업데이트
        updated = collection_crud.update_settings(
            db=db,
            collection_name=collection_name,
            description=request.description,
            visibility=request.visibility,
            allowed_users=request.allowed_users
        )

        if not updated:
            raise HTTPException(
                status_code=500,
                detail="설정 변경에 실패했습니다"
            )

        logger.info(f"Updated collection settings: {collection_name}")

        return QdrantCollectionResponse(
            success=True,
            collection_name=collection_name,
            message=f"Collection '{collection_name}' 설정이 변경되었습니다"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update collection settings: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"설정 변경 실패: {str(e)}"
        )


@router.get("/collections/{collection_name}/documents", response_model=CollectionDocumentsResponse)
async def get_collection_documents(
    collection_name: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    컬렉션 내 문서 목록 조회 API

    소유자 또는 관리자만 조회 가능

    Args:
        collection_name: Collection 이름
        db: DB 세션
        current_user: 현재 로그인 사용자

    Returns:
        CollectionDocumentsResponse: 문서 목록
    """
    try:
        # 컬렉션 존재 확인
        exists = await qdrant_service.collection_exists(collection_name)
        if not exists:
            raise HTTPException(
                status_code=404,
                detail=f"Collection '{collection_name}'이 존재하지 않습니다"
            )

        # 권한 확인 (소유자 또는 관리자)
        collection_meta = collection_crud.get_by_name(db, collection_name)
        if collection_meta:
            is_owner = collection_meta.owner_id == current_user.id
            is_admin = current_user.role == "admin"
            if not is_owner and not is_admin:
                raise HTTPException(
                    status_code=403,
                    detail="문서 목록 조회 권한이 없습니다"
                )

        # Qdrant에서 문서 목록 조회
        documents = await qdrant_service.get_documents_in_collection(collection_name)

        return CollectionDocumentsResponse(
            collection_name=collection_name,
            total_documents=len(documents),
            documents=[CollectionDocumentInfo(**doc) for doc in documents]
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get collection documents: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"문서 목록 조회 실패: {str(e)}"
        )


@router.delete("/collections/{collection_name}/documents", response_model=DeleteDocumentResponse)
async def delete_collection_documents(
    collection_name: str,
    request: DeleteDocumentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    컬렉션에서 문서 삭제 API

    document_ids 또는 filenames 중 하나 이상 필수
    소유자 또는 관리자만 삭제 가능

    Args:
        collection_name: Collection 이름
        request: 삭제 요청 (document_ids 또는 filenames)
        db: DB 세션
        current_user: 현재 로그인 사용자

    Returns:
        DeleteDocumentResponse: 삭제 결과
    """
    try:
        # filenames 또는 source_files (하위호환) 통합
        target_filenames = request.filenames or request.source_files

        # 요청 유효성 검사
        if not request.document_ids and not target_filenames:
            raise HTTPException(
                status_code=400,
                detail="document_ids 또는 filenames 중 하나 이상 필요합니다"
            )

        # 컬렉션 존재 확인
        exists = await qdrant_service.collection_exists(collection_name)
        if not exists:
            raise HTTPException(
                status_code=404,
                detail=f"Collection '{collection_name}'이 존재하지 않습니다"
            )

        # 권한 확인 (소유자 또는 관리자)
        collection_meta = collection_crud.get_by_name(db, collection_name)
        if collection_meta:
            is_owner = collection_meta.owner_id == current_user.id
            is_admin = current_user.role == "admin"
            if not is_owner and not is_admin:
                raise HTTPException(
                    status_code=403,
                    detail="문서 삭제 권한이 없습니다"
                )

        total_deleted = 0

        # document_id로 삭제 (일반 문서)
        if request.document_ids:
            for doc_id in request.document_ids:
                deleted = await qdrant_service.delete_document_points(collection_name, doc_id)
                total_deleted += deleted

                # SQLite 업로드 이력도 삭제
                qdrant_history_crud.delete_by_document_and_collection(
                    db, doc_id, collection_name
                )

        # filename으로 삭제 (Excel)
        if target_filenames:
            for filename in target_filenames:
                deleted = await qdrant_service.delete_excel_points(collection_name, filename)
                total_deleted += deleted

        logger.info(f"Deleted {total_deleted} points from collection '{collection_name}'")

        return DeleteDocumentResponse(
            success=True,
            deleted_count=total_deleted,
            message=f"{total_deleted}개의 벡터가 삭제되었습니다"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete collection documents: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"문서 삭제 실패: {str(e)}"
        )


@router.post("/check-duplicates", response_model=DuplicateCheckResponse)
async def check_duplicates(
    request: DuplicateCheckRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    문서 중복 업로드 확인 API

    지정한 문서들이 이미 해당 Collection에 업로드되었는지 확인합니다.

    Args:
        request: 중복 확인 요청
        db: DB 세션

    Returns:
        DuplicateCheckResponse: 중복 문서 목록
    """
    duplicates = []
    new_documents = []

    for document_id in request.document_ids:
        # 이미 업로드된 이력 확인
        existing = qdrant_history_crud.check_document_uploaded_to_collection(
            db=db,
            document_id=document_id,
            collection_name=request.collection_name
        )

        if existing:
            # 중복 문서
            document = document_crud.get_document_by_id(db, document_id)
            duplicates.append(DuplicateInfo(
                document_id=document_id,
                filename=document.original_filename if document else "Unknown",
                uploaded_at=existing.uploaded_at.isoformat()
            ))
        else:
            # 신규 문서
            new_documents.append(document_id)

    return DuplicateCheckResponse(
        has_duplicates=len(duplicates) > 0,
        duplicates=duplicates,
        new_documents=new_documents
    )


@router.post("/upload", response_model=QdrantUploadResponse)
async def upload_documents(
    request: QdrantUploadRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    문서를 Qdrant에 임베딩 및 업로드

    Args:
        request: 업로드 요청
        db: DB 세션

    Returns:
        QdrantUploadResponse: 업로드 결과

    Raises:
        HTTPException: 업로드 실패 시
    """
    results = []
    success_count = 0
    failure_count = 0

    try:
        # Collection 존재 확인
        collection_exists = await qdrant_service.collection_exists(request.collection_name)
        if not collection_exists:
            raise HTTPException(
                status_code=404,
                detail=f"Collection '{request.collection_name}'이 존재하지 않습니다"
            )

        # 각 문서 처리
        for document_id in request.document_ids:
            try:
                # 1. DB에서 문서 조회
                document = document_crud.get_document_by_id(db, document_id)
                if not document or not document.md_content:
                    results.append(QdrantUploadResult(
                        document_id=document_id,
                        filename=document.original_filename if document else "Unknown",
                        success=False,
                        error="문서를 찾을 수 없거나 markdown 내용이 없습니다"
                    ))
                    failure_count += 1
                    continue

                logger.info(f"Processing document {document_id}: {document.original_filename}")

                # 2. Markdown 청킹
                chunks = await chunking_service.chunk_markdown(
                    markdown_content=document.md_content,
                    max_tokens=request.chunk_size,
                    overlap_tokens=request.chunk_overlap,
                    filename=document.original_filename
                )

                if not chunks:
                    results.append(QdrantUploadResult(
                        document_id=document_id,
                        filename=document.original_filename,
                        success=False,
                        error="청킹 결과가 없습니다"
                    ))
                    failure_count += 1
                    continue

                # 3. 청크 텍스트 추출 및 임베딩 생성
                chunk_texts = [chunk.get('text', '') for chunk in chunks]
                embeddings = await embedding_service.get_embeddings(chunk_texts)

                if len(embeddings) != len(chunk_texts):
                    results.append(QdrantUploadResult(
                        document_id=document_id,
                        filename=document.original_filename,
                        success=False,
                        error="임베딩 개수와 청크 개수가 일치하지 않습니다"
                    ))
                    failure_count += 1
                    continue

                # 4. 메타데이터 생성 및 Qdrant 업로드
                metadata_list = _build_chunk_metadata(document_id, document.original_filename, chunks)
                vector_ids = await qdrant_service.upsert_vectors(
                    collection_name=request.collection_name,
                    vectors=embeddings,
                    texts=chunk_texts,
                    metadata_list=metadata_list
                )

                # 5. 업로드 이력 저장
                _record_upload_history(
                    db, document_id, request.collection_name,
                    len(chunks), vector_ids, "success"
                )

                results.append(QdrantUploadResult(
                    document_id=document_id,
                    filename=document.original_filename,
                    success=True,
                    chunk_count=len(chunks),
                    vector_ids=vector_ids
                ))
                success_count += 1
                logger.info(f"Successfully uploaded document {document_id} with {len(chunks)} chunks")

            except Exception as e:
                logger.error(f"Failed to upload document {document_id}: {e}")
                document = document_crud.get_document_by_id(db, document_id)
                _record_upload_history(
                    db, document_id, request.collection_name,
                    0, [], "failure", error_message=str(e)
                )
                results.append(QdrantUploadResult(
                    document_id=document_id,
                    filename=document.original_filename if document else "Unknown",
                    success=False,
                    error=str(e)
                ))
                failure_count += 1

        return QdrantUploadResponse(
            total=len(request.document_ids),
            success_count=success_count,
            failure_count=failure_count,
            results=results
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Upload process failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"업로드 프로세스 실패: {str(e)}"
        )


@router.post("/upload/stream")
async def upload_documents_stream(
    request: QdrantUploadRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    문서를 Qdrant에 임베딩 및 업로드 (SSE 스트리밍)

    실시간 진행률을 SSE(Server-Sent Events)로 전송합니다.

    Args:
        request: 업로드 요청
        db: DB 세션

    Returns:
        StreamingResponse: SSE 이벤트 스트림
    """

    async def generate_events() -> AsyncGenerator[str, None]:
        """SSE 이벤트 생성기"""
        results = []
        success_count = 0
        failure_count = 0
        total_docs = len(request.document_ids)

        def send_event(event: QdrantUploadProgressEvent) -> str:
            """SSE 포맷으로 이벤트 전송"""
            return f"data: {event.model_dump_json()}\n\n"

        try:
            # Collection 존재 확인
            collection_exists = await qdrant_service.collection_exists(request.collection_name)
            if not collection_exists:
                yield send_event(QdrantUploadProgressEvent(
                    event_type="error",
                    error=f"Collection '{request.collection_name}'이 존재하지 않습니다",
                    total_docs=total_docs
                ))
                return

            # 각 문서 처리
            for doc_index, document_id in enumerate(request.document_ids):
                try:
                    # 1. DB에서 문서 조회
                    document = document_crud.get_document_by_id(db, document_id)
                    if not document or not document.md_content:
                        yield send_event(QdrantUploadProgressEvent(
                            event_type="error",
                            document_id=document_id,
                            filename=document.original_filename if document else "Unknown",
                            error="문서를 찾을 수 없거나 markdown 내용이 없습니다",
                            current_doc_index=doc_index + 1,
                            total_docs=total_docs,
                            success_count=success_count,
                            failure_count=failure_count + 1
                        ))
                        failure_count += 1
                        results.append(QdrantUploadResult(
                            document_id=document_id,
                            filename=document.original_filename if document else "Unknown",
                            success=False,
                            error="문서를 찾을 수 없거나 markdown 내용이 없습니다"
                        ))
                        continue

                    filename = document.original_filename

                    # 2. 청킹 시작
                    yield send_event(QdrantUploadProgressEvent(
                        event_type="progress",
                        document_id=document_id,
                        filename=filename,
                        phase="chunking",
                        progress=10,
                        current_doc_index=doc_index + 1,
                        total_docs=total_docs,
                        success_count=success_count,
                        failure_count=failure_count
                    ))

                    chunks = await chunking_service.chunk_markdown(
                        markdown_content=document.md_content,
                        max_tokens=request.chunk_size,
                        overlap_tokens=request.chunk_overlap,
                        filename=filename
                    )

                    if not chunks:
                        yield send_event(QdrantUploadProgressEvent(
                            event_type="error",
                            document_id=document_id,
                            filename=filename,
                            error="청킹 결과가 없습니다",
                            current_doc_index=doc_index + 1,
                            total_docs=total_docs,
                            success_count=success_count,
                            failure_count=failure_count + 1
                        ))
                        failure_count += 1
                        results.append(QdrantUploadResult(
                            document_id=document_id,
                            filename=filename,
                            success=False,
                            error="청킹 결과가 없습니다"
                        ))
                        continue

                    chunk_texts = [chunk.get('text', '') for chunk in chunks]

                    # 3. 임베딩 시작
                    yield send_event(QdrantUploadProgressEvent(
                        event_type="progress",
                        document_id=document_id,
                        filename=filename,
                        phase="embedding",
                        progress=40,
                        current_doc_index=doc_index + 1,
                        total_docs=total_docs,
                        chunk_count=len(chunks),
                        success_count=success_count,
                        failure_count=failure_count
                    ))

                    embeddings = await embedding_service.get_embeddings(chunk_texts)

                    if len(embeddings) != len(chunk_texts):
                        yield send_event(QdrantUploadProgressEvent(
                            event_type="error",
                            document_id=document_id,
                            filename=filename,
                            error="임베딩 개수와 청크 개수가 일치하지 않습니다",
                            current_doc_index=doc_index + 1,
                            total_docs=total_docs,
                            success_count=success_count,
                            failure_count=failure_count + 1
                        ))
                        failure_count += 1
                        results.append(QdrantUploadResult(
                            document_id=document_id,
                            filename=filename,
                            success=False,
                            error="임베딩 개수와 청크 개수가 일치하지 않습니다"
                        ))
                        continue

                    # 4. Qdrant 업로드 시작
                    yield send_event(QdrantUploadProgressEvent(
                        event_type="progress",
                        document_id=document_id,
                        filename=filename,
                        phase="uploading",
                        progress=70,
                        current_doc_index=doc_index + 1,
                        total_docs=total_docs,
                        chunk_count=len(chunks),
                        success_count=success_count,
                        failure_count=failure_count
                    ))

                    metadata_list = _build_chunk_metadata(document_id, filename, chunks)
                    vector_ids = await qdrant_service.upsert_vectors(
                        collection_name=request.collection_name,
                        vectors=embeddings,
                        texts=chunk_texts,
                        metadata_list=metadata_list
                    )

                    _record_upload_history(
                        db, document_id, request.collection_name,
                        len(chunks), vector_ids, "success"
                    )

                    success_count += 1
                    results.append(QdrantUploadResult(
                        document_id=document_id,
                        filename=filename,
                        success=True,
                        chunk_count=len(chunks),
                        vector_ids=vector_ids
                    ))

                    # 문서 완료 이벤트
                    yield send_event(QdrantUploadProgressEvent(
                        event_type="document_complete",
                        document_id=document_id,
                        filename=filename,
                        phase="completed",
                        progress=100,
                        current_doc_index=doc_index + 1,
                        total_docs=total_docs,
                        chunk_count=len(chunks),
                        vector_ids=vector_ids,
                        success_count=success_count,
                        failure_count=failure_count
                    ))

                except Exception as e:
                    logger.error(f"Failed to upload document {document_id}: {e}")
                    document = document_crud.get_document_by_id(db, document_id)
                    _record_upload_history(
                        db, document_id, request.collection_name,
                        0, [], "failure", error_message=str(e)
                    )

                    failure_count += 1
                    results.append(QdrantUploadResult(
                        document_id=document_id,
                        filename=document.original_filename if document else "Unknown",
                        success=False,
                        error=str(e)
                    ))

                    yield send_event(QdrantUploadProgressEvent(
                        event_type="error",
                        document_id=document_id,
                        filename=document.original_filename if document else "Unknown",
                        error=str(e),
                        current_doc_index=doc_index + 1,
                        total_docs=total_docs,
                        success_count=success_count,
                        failure_count=failure_count
                    ))

            # 완료 이벤트
            yield send_event(QdrantUploadProgressEvent(
                event_type="done",
                progress=100,
                current_doc_index=total_docs,
                total_docs=total_docs,
                success_count=success_count,
                failure_count=failure_count
            ))

        except Exception as e:
            logger.error(f"Upload stream failed: {e}")
            yield send_event(QdrantUploadProgressEvent(
                event_type="error",
                error=f"업로드 프로세스 실패: {str(e)}",
                total_docs=total_docs,
                success_count=success_count,
                failure_count=failure_count
            ))

    return StreamingResponse(
        generate_events(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )
