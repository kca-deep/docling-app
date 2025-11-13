"""
Qdrant Vector DB 연동 API 라우트
"""
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import List

from backend.services.qdrant_service import QdrantService
from backend.services.chunking_service import ChunkingService
from backend.services.embedding_service import EmbeddingService
from backend.services import document_crud, qdrant_history_crud
from backend.database import get_db
from backend.config.settings import settings
from backend.models.schemas import (
    QdrantCollectionsResponse,
    QdrantCollectionCreateRequest,
    QdrantCollectionResponse,
    QdrantCollectionInfo,
    QdrantUploadRequest,
    QdrantUploadResponse,
    QdrantUploadResult,
    QdrantConfigResponse
)

router = APIRouter(prefix="/api/qdrant", tags=["qdrant"])

# 서비스 인스턴스 생성
qdrant_service = QdrantService(
    url=settings.QDRANT_URL,
    api_key=settings.QDRANT_API_KEY
)
chunking_service = ChunkingService(base_url=settings.DOCLING_CHUNKING_URL)
embedding_service = EmbeddingService(
    base_url=settings.EMBEDDING_URL,
    model=settings.EMBEDDING_MODEL
)


@router.get("/config", response_model=QdrantConfigResponse)
async def get_qdrant_config():
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
async def get_collections():
    """
    Qdrant Collection 목록 조회 API

    Returns:
        QdrantCollectionsResponse: Collection 목록

    Raises:
        HTTPException: Qdrant 서버 연결 실패 시
    """
    try:
        collections = await qdrant_service.get_collections()

        return QdrantCollectionsResponse(
            collections=collections
        )

    except Exception as e:
        print(f"[ERROR] Failed to get collections: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Qdrant collection 목록 조회 실패: {str(e)}"
        )


@router.post("/collections", response_model=QdrantCollectionResponse)
async def create_collection(request: QdrantCollectionCreateRequest):
    """
    Qdrant Collection 생성 API

    Args:
        request: Collection 생성 요청

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

        # Collection 생성
        await qdrant_service.create_collection(
            collection_name=request.collection_name,
            vector_size=request.vector_size,
            distance=request.distance
        )

        return QdrantCollectionResponse(
            success=True,
            collection_name=request.collection_name,
            message=f"Collection '{request.collection_name}'이 성공적으로 생성되었습니다"
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] Failed to create collection: {e}")

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
async def delete_collection(collection_name: str):
    """
    Qdrant Collection 삭제 API

    Args:
        collection_name: 삭제할 Collection 이름

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

        # Collection 삭제
        await qdrant_service.delete_collection(collection_name)

        return QdrantCollectionResponse(
            success=True,
            collection_name=collection_name,
            message=f"Collection '{collection_name}'이 성공적으로 삭제되었습니다"
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] Failed to delete collection: {e}")

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


@router.post("/upload", response_model=QdrantUploadResponse)
async def upload_documents(
    request: QdrantUploadRequest,
    db: Session = Depends(get_db)
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

                print(f"[INFO] Processing document {document_id}: {document.original_filename}")

                # 2. Markdown 청킹
                chunks = await chunking_service.chunk_markdown(
                    markdown_content=document.md_content,
                    max_tokens=request.chunk_size,
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

                # 3. 청크 텍스트 추출
                chunk_texts = [chunk.get('text', '') for chunk in chunks]

                # 4. 임베딩 생성
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

                # 5. 메타데이터 생성
                metadata_list = []
                for i, chunk in enumerate(chunks):
                    metadata_list.append({
                        "document_id": document_id,
                        "filename": document.original_filename,
                        "chunk_index": i,
                        "num_tokens": chunk.get('num_tokens', 0),
                        "headings": chunk.get('headings', [])
                    })

                # 6. Qdrant에 벡터 업로드
                vector_ids = await qdrant_service.upsert_vectors(
                    collection_name=request.collection_name,
                    vectors=embeddings,
                    texts=chunk_texts,
                    metadata_list=metadata_list
                )

                # 7. 업로드 이력 저장
                qdrant_history_crud.create_upload_history(
                    db=db,
                    document_id=document_id,
                    collection_name=request.collection_name,
                    chunk_count=len(chunks),
                    vector_ids=vector_ids,
                    qdrant_url=settings.QDRANT_URL,
                    upload_status="success"
                )

                # 성공 결과 추가
                results.append(QdrantUploadResult(
                    document_id=document_id,
                    filename=document.original_filename,
                    success=True,
                    chunk_count=len(chunks),
                    vector_ids=vector_ids
                ))
                success_count += 1

                print(f"[INFO] Successfully uploaded document {document_id} with {len(chunks)} chunks")

            except Exception as e:
                print(f"[ERROR] Failed to upload document {document_id}: {e}")

                # 실패 이력 저장
                try:
                    document = document_crud.get_document_by_id(db, document_id)
                    qdrant_history_crud.create_upload_history(
                        db=db,
                        document_id=document_id,
                        collection_name=request.collection_name,
                        chunk_count=0,
                        vector_ids=[],
                        qdrant_url=settings.QDRANT_URL,
                        upload_status="failure",
                        error_message=str(e)
                    )
                except:
                    pass

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
        print(f"[ERROR] Upload process failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"업로드 프로세스 실패: {str(e)}"
        )
