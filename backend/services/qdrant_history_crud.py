"""
Qdrant Upload History CRUD operations
"""
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from datetime import datetime
import json

from backend.models.qdrant_upload_history import QdrantUploadHistory
from backend.models.document import Document


def create_upload_history(
    db: Session,
    document_id: int,
    collection_name: str,
    chunk_count: int,
    vector_ids: List[str],
    qdrant_url: str,
    upload_status: str,
    error_message: Optional[str] = None
) -> QdrantUploadHistory:
    """
    Qdrant 업로드 이력 생성

    Args:
        db: DB 세션
        document_id: 문서 ID
        collection_name: Qdrant Collection 이름
        chunk_count: 청크 개수
        vector_ids: 벡터 ID 리스트
        qdrant_url: Qdrant URL
        upload_status: 업로드 상태 (success/failure)
        error_message: 에러 메시지 (실패 시)

    Returns:
        QdrantUploadHistory: 생성된 업로드 이력
    """
    history = QdrantUploadHistory(
        document_id=document_id,
        collection_name=collection_name,
        chunk_count=chunk_count,
        vector_ids_json=json.dumps(vector_ids) if vector_ids else None,
        qdrant_url=qdrant_url,
        upload_status=upload_status,
        error_message=error_message,
        uploaded_at=datetime.utcnow()
    )

    db.add(history)
    db.commit()
    db.refresh(history)

    return history


def get_upload_histories(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    document_id: Optional[int] = None,
    collection_name: Optional[str] = None
) -> List[QdrantUploadHistory]:
    """
    업로드 이력 목록 조회

    Args:
        db: DB 세션
        skip: 건너뛸 개수
        limit: 가져올 최대 개수
        document_id: 문서 ID 필터 (선택적)
        collection_name: Collection 이름 필터 (선택적)

    Returns:
        List[QdrantUploadHistory]: 업로드 이력 목록
    """
    query = db.query(QdrantUploadHistory).options(joinedload(QdrantUploadHistory.document))

    if document_id:
        query = query.filter(QdrantUploadHistory.document_id == document_id)

    if collection_name:
        query = query.filter(QdrantUploadHistory.collection_name == collection_name)

    return query.order_by(QdrantUploadHistory.uploaded_at.desc()).offset(skip).limit(limit).all()


def get_upload_history_by_id(db: Session, history_id: int) -> Optional[QdrantUploadHistory]:
    """
    ID로 업로드 이력 조회

    Args:
        db: DB 세션
        history_id: 이력 ID

    Returns:
        Optional[QdrantUploadHistory]: 업로드 이력 (없으면 None)
    """
    return db.query(QdrantUploadHistory).filter(QdrantUploadHistory.id == history_id).first()


def check_document_uploaded_to_collection(
    db: Session,
    document_id: int,
    collection_name: str
) -> Optional[QdrantUploadHistory]:
    """
    특정 문서가 특정 Collection에 이미 업로드되었는지 확인

    Args:
        db: DB 세션
        document_id: 문서 ID
        collection_name: Qdrant Collection 이름

    Returns:
        Optional[QdrantUploadHistory]: 업로드 이력 (성공한 경우만, 없으면 None)
    """
    return db.query(QdrantUploadHistory).filter(
        QdrantUploadHistory.document_id == document_id,
        QdrantUploadHistory.collection_name == collection_name,
        QdrantUploadHistory.upload_status == "success"
    ).order_by(QdrantUploadHistory.uploaded_at.desc()).first()


def get_upload_stats(db: Session) -> dict:
    """
    업로드 통계 조회

    Args:
        db: DB 세션

    Returns:
        dict: 업로드 통계 정보
    """
    total = db.query(QdrantUploadHistory).count()
    success = db.query(QdrantUploadHistory).filter(
        QdrantUploadHistory.upload_status == "success"
    ).count()
    failure = db.query(QdrantUploadHistory).filter(
        QdrantUploadHistory.upload_status == "failure"
    ).count()

    return {
        "total": total,
        "success": success,
        "failure": failure
    }


def delete_by_document_and_collection(
    db: Session,
    document_id: int,
    collection_name: str
) -> int:
    """
    document_id와 collection_name으로 업로드 이력 삭제

    Args:
        db: DB 세션
        document_id: 문서 ID
        collection_name: Collection 이름

    Returns:
        int: 삭제된 이력 수
    """
    deleted_count = db.query(QdrantUploadHistory).filter(
        QdrantUploadHistory.document_id == document_id,
        QdrantUploadHistory.collection_name == collection_name
    ).delete()

    db.commit()
    return deleted_count


def delete_by_collection(db: Session, collection_name: str) -> int:
    """
    collection_name으로 모든 업로드 이력 삭제

    Args:
        db: DB 세션
        collection_name: Collection 이름

    Returns:
        int: 삭제된 이력 수
    """
    deleted_count = db.query(QdrantUploadHistory).filter(
        QdrantUploadHistory.collection_name == collection_name
    ).delete()

    db.commit()
    return deleted_count
