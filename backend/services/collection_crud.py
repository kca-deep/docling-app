"""
QdrantCollection CRUD operations
컬렉션 메타데이터 관리를 위한 데이터베이스 작업
"""
from sqlalchemy.orm import Session
from sqlalchemy import or_
from backend.models.qdrant_collection import QdrantCollection
from typing import List, Optional
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


def create_collection(
    db: Session,
    collection_name: str,
    owner_id: int,
    visibility: str = "public",
    description: Optional[str] = None,
    allowed_users: Optional[List[int]] = None
) -> QdrantCollection:
    """
    컬렉션 메타데이터 생성

    Args:
        db: DB 세션
        collection_name: 컬렉션 이름
        owner_id: 소유자 사용자 ID
        visibility: 공개 설정 (public, private, shared)
        description: 컬렉션 설명
        allowed_users: 공유 허용 사용자 ID 목록 (visibility="shared"일 때)

    Returns:
        생성된 QdrantCollection 객체
    """
    db_collection = QdrantCollection(
        collection_name=collection_name,
        owner_id=owner_id,
        visibility=visibility,
        description=description,
        allowed_users=allowed_users or []
    )

    db.add(db_collection)
    db.commit()
    db.refresh(db_collection)

    logger.info(f"Created collection metadata: {collection_name} (owner={owner_id}, visibility={visibility})")
    return db_collection


def get_by_name(db: Session, collection_name: str) -> Optional[QdrantCollection]:
    """
    컬렉션명으로 조회

    Args:
        db: DB 세션
        collection_name: 컬렉션 이름

    Returns:
        QdrantCollection 객체 또는 None
    """
    return db.query(QdrantCollection).filter(
        QdrantCollection.collection_name == collection_name
    ).first()


def get_by_id(db: Session, collection_id: int) -> Optional[QdrantCollection]:
    """
    ID로 컬렉션 조회

    Args:
        db: DB 세션
        collection_id: 컬렉션 ID

    Returns:
        QdrantCollection 객체 또는 None
    """
    return db.query(QdrantCollection).filter(
        QdrantCollection.id == collection_id
    ).first()


def get_all_collections(db: Session) -> List[QdrantCollection]:
    """
    모든 컬렉션 조회

    Args:
        db: DB 세션

    Returns:
        QdrantCollection 리스트
    """
    return db.query(QdrantCollection).order_by(
        QdrantCollection.collection_name
    ).all()


def get_accessible_collections(
    db: Session,
    user_id: Optional[int],
    qdrant_collection_names: Optional[List[str]] = None
) -> List[QdrantCollection]:
    """
    사용자가 접근 가능한 컬렉션 목록 조회

    Args:
        db: DB 세션
        user_id: 사용자 ID (None이면 비로그인 사용자)
        qdrant_collection_names: Qdrant에 실제 존재하는 컬렉션명 목록 (필터링용)

    Returns:
        접근 가능한 QdrantCollection 리스트
    """
    query = db.query(QdrantCollection)

    # Qdrant에 실제 존재하는 컬렉션만 필터링
    if qdrant_collection_names is not None:
        query = query.filter(
            QdrantCollection.collection_name.in_(qdrant_collection_names)
        )

    if user_id is None:
        # 비로그인: public만
        query = query.filter(QdrantCollection.visibility == "public")
    else:
        # 로그인: public OR 소유자 OR shared에 포함
        # SQLite에서 JSON 배열 검색은 복잡하므로, 조회 후 Python에서 필터링
        query = query.filter(
            or_(
                QdrantCollection.visibility == "public",
                QdrantCollection.owner_id == user_id,
                QdrantCollection.visibility == "shared"  # shared는 후처리에서 필터링
            )
        )

    collections = query.order_by(QdrantCollection.collection_name).all()

    # shared 컬렉션 중 user_id가 allowed_users에 없는 것 제외
    if user_id is not None:
        collections = [
            col for col in collections
            if col.visibility != "shared"
            or col.owner_id == user_id
            or user_id in (col.allowed_users or [])
        ]

    return collections


def get_collections_by_owner(db: Session, owner_id: int) -> List[QdrantCollection]:
    """
    소유자의 컬렉션 목록 조회

    Args:
        db: DB 세션
        owner_id: 소유자 사용자 ID

    Returns:
        소유한 QdrantCollection 리스트
    """
    return db.query(QdrantCollection).filter(
        QdrantCollection.owner_id == owner_id
    ).order_by(QdrantCollection.collection_name).all()


def update_visibility(
    db: Session,
    collection_name: str,
    visibility: str,
    allowed_users: Optional[List[int]] = None
) -> Optional[QdrantCollection]:
    """
    컬렉션 공개 설정 변경

    Args:
        db: DB 세션
        collection_name: 컬렉션 이름
        visibility: 새 공개 설정 (public, private, shared)
        allowed_users: 공유 허용 사용자 ID 목록 (visibility="shared"일 때)

    Returns:
        업데이트된 QdrantCollection 객체 또는 None
    """
    collection = get_by_name(db, collection_name)
    if not collection:
        return None

    collection.visibility = visibility
    if allowed_users is not None:
        collection.allowed_users = allowed_users

    db.commit()
    db.refresh(collection)

    logger.info(f"Updated visibility for {collection_name}: {visibility}")
    return collection


def update_settings(
    db: Session,
    collection_name: str,
    description: Optional[str] = None,
    visibility: Optional[str] = None,
    allowed_users: Optional[List[int]] = None
) -> Optional[QdrantCollection]:
    """
    컬렉션 설정 변경

    Args:
        db: DB 세션
        collection_name: 컬렉션 이름
        description: 새 설명 (None이면 변경 안함)
        visibility: 새 공개 설정 (None이면 변경 안함)
        allowed_users: 공유 허용 사용자 ID 목록 (None이면 변경 안함)

    Returns:
        업데이트된 QdrantCollection 객체 또는 None
    """
    collection = get_by_name(db, collection_name)
    if not collection:
        return None

    if description is not None:
        collection.description = description
    if visibility is not None:
        collection.visibility = visibility
    if allowed_users is not None:
        collection.allowed_users = allowed_users

    db.commit()
    db.refresh(collection)

    logger.info(f"Updated settings for {collection_name}")
    return collection


def delete_collection(db: Session, collection_name: str) -> bool:
    """
    컬렉션 메타데이터 삭제

    Args:
        db: DB 세션
        collection_name: 컬렉션 이름

    Returns:
        삭제 성공 여부
    """
    collection = get_by_name(db, collection_name)
    if not collection:
        return False

    db.delete(collection)
    db.commit()

    logger.info(f"Deleted collection metadata: {collection_name}")
    return True


def check_ownership(db: Session, collection_name: str, user_id: int) -> bool:
    """
    컬렉션 소유권 확인

    Args:
        db: DB 세션
        collection_name: 컬렉션 이름
        user_id: 사용자 ID

    Returns:
        소유권 여부
    """
    collection = get_by_name(db, collection_name)
    return collection is not None and collection.owner_id == user_id


def exists(db: Session, collection_name: str) -> bool:
    """
    컬렉션 메타데이터 존재 여부 확인

    Args:
        db: DB 세션
        collection_name: 컬렉션 이름

    Returns:
        존재 여부
    """
    return get_by_name(db, collection_name) is not None


def get_or_create(
    db: Session,
    collection_name: str,
    owner_id: int,
    visibility: str = "public",
    description: Optional[str] = None
) -> tuple[QdrantCollection, bool]:
    """
    컬렉션 조회 또는 생성

    Args:
        db: DB 세션
        collection_name: 컬렉션 이름
        owner_id: 소유자 사용자 ID
        visibility: 공개 설정
        description: 설명

    Returns:
        (QdrantCollection 객체, 새로 생성되었는지 여부)
    """
    collection = get_by_name(db, collection_name)
    if collection:
        return collection, False

    collection = create_collection(
        db=db,
        collection_name=collection_name,
        owner_id=owner_id,
        visibility=visibility,
        description=description
    )
    return collection, True
