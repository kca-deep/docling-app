"""
Dify Upload History CRUD operations
"""
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from datetime import datetime, timezone

from backend.models.dify_upload_history import DifyUploadHistory
from backend.models.document import Document


def create_upload_history(
    db: Session,
    document_id: int,
    dify_dataset_id: str,
    dify_dataset_name: Optional[str],
    dify_document_id: Optional[str],
    dify_base_url: str,
    upload_status: str,
    error_message: Optional[str] = None
) -> DifyUploadHistory:
    """
    Dify 업로드 이력 생성

    Args:
        db: DB 세션
        document_id: 문서 ID
        dify_dataset_id: Dify 데이터셋 ID
        dify_dataset_name: Dify 데이터셋 이름
        dify_document_id: Dify 문서 ID
        dify_base_url: Dify Base URL
        upload_status: 업로드 상태 (success/failure)
        error_message: 에러 메시지 (실패 시)

    Returns:
        DifyUploadHistory: 생성된 업로드 이력
    """
    history = DifyUploadHistory(
        document_id=document_id,
        dify_dataset_id=dify_dataset_id,
        dify_dataset_name=dify_dataset_name,
        dify_document_id=dify_document_id,
        dify_base_url=dify_base_url,
        upload_status=upload_status,
        error_message=error_message,
        uploaded_at=datetime.now(timezone.utc)
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
    dataset_id: Optional[str] = None
) -> List[DifyUploadHistory]:
    """
    업로드 이력 목록 조회

    Args:
        db: DB 세션
        skip: 건너뛸 개수
        limit: 가져올 최대 개수
        document_id: 문서 ID 필터 (선택적)
        dataset_id: 데이터셋 ID 필터 (선택적)

    Returns:
        List[DifyUploadHistory]: 업로드 이력 목록
    """
    query = db.query(DifyUploadHistory).options(joinedload(DifyUploadHistory.document))

    if document_id:
        query = query.filter(DifyUploadHistory.document_id == document_id)

    if dataset_id:
        query = query.filter(DifyUploadHistory.dify_dataset_id == dataset_id)

    return query.order_by(DifyUploadHistory.uploaded_at.desc()).offset(skip).limit(limit).all()


def get_upload_history_by_id(db: Session, history_id: int) -> Optional[DifyUploadHistory]:
    """
    ID로 업로드 이력 조회

    Args:
        db: DB 세션
        history_id: 이력 ID

    Returns:
        Optional[DifyUploadHistory]: 업로드 이력 (없으면 None)
    """
    return db.query(DifyUploadHistory).filter(DifyUploadHistory.id == history_id).first()


def check_document_uploaded_to_dataset(
    db: Session,
    document_id: int,
    dataset_id: str
) -> Optional[DifyUploadHistory]:
    """
    특정 문서가 특정 데이터셋에 이미 업로드되었는지 확인

    Args:
        db: DB 세션
        document_id: 문서 ID
        dataset_id: Dify 데이터셋 ID

    Returns:
        Optional[DifyUploadHistory]: 업로드 이력 (성공한 경우만, 없으면 None)
    """
    return db.query(DifyUploadHistory).filter(
        DifyUploadHistory.document_id == document_id,
        DifyUploadHistory.dify_dataset_id == dataset_id,
        DifyUploadHistory.upload_status == "success"
    ).order_by(DifyUploadHistory.uploaded_at.desc()).first()


def get_upload_stats(db: Session) -> dict:
    """
    업로드 통계 조회

    Args:
        db: DB 세션

    Returns:
        dict: 업로드 통계 정보
    """
    total = db.query(DifyUploadHistory).count()
    success = db.query(DifyUploadHistory).filter(
        DifyUploadHistory.upload_status == "success"
    ).count()
    failure = db.query(DifyUploadHistory).filter(
        DifyUploadHistory.upload_status == "failure"
    ).count()

    return {
        "total": total,
        "success": success,
        "failure": failure
    }
