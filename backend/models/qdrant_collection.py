"""
QdrantCollection SQLAlchemy Model
컬렉션 메타데이터 및 접근 제어 관리
"""
from datetime import datetime
from typing import Optional, List
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from backend.database import Base


class QdrantCollection(Base):
    """
    Qdrant 컬렉션 메타데이터 테이블

    컬렉션의 공개/비공개 설정 및 접근 권한 관리
    """
    __tablename__ = "qdrant_collections"

    # 기본 필드
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    collection_name = Column(String(255), unique=True, nullable=False, index=True)

    # 소유자 정보 (User 테이블과 연결)
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # 공개 설정: public, private, shared
    visibility = Column(String(20), nullable=False, default="public", index=True)

    # 설명
    description = Column(Text, nullable=True)

    # 공유 사용자 목록 (visibility="shared"일 때 사용)
    # JSON 배열로 사용자 ID 저장: [1, 2, 3]
    allowed_users = Column(JSON, nullable=True, default=list)

    # 타임스탬프
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    def __repr__(self):
        return f"<QdrantCollection(id={self.id}, name='{self.collection_name}', visibility='{self.visibility}')>"

    def can_access(self, user_id: Optional[int]) -> bool:
        """
        사용자가 이 컬렉션에 접근 가능한지 확인

        Args:
            user_id: 사용자 ID (None이면 비로그인 사용자)

        Returns:
            접근 가능 여부
        """
        # public: 모든 사용자 접근 가능
        if self.visibility == "public":
            return True

        # 비로그인 사용자는 public만 접근 가능
        if user_id is None:
            return False

        # 소유자는 항상 접근 가능
        if self.owner_id == user_id:
            return True

        # shared: allowed_users에 포함된 사용자만 접근 가능
        if self.visibility == "shared":
            allowed = self.allowed_users or []
            return user_id in allowed

        # private: 소유자만 접근 가능 (위에서 이미 체크됨)
        return False

    def can_modify(self, user_id: Optional[int]) -> bool:
        """
        사용자가 이 컬렉션을 수정할 수 있는지 확인

        Args:
            user_id: 사용자 ID (None이면 비로그인 사용자)

        Returns:
            수정 가능 여부
        """
        # 비로그인 사용자는 수정 불가
        if user_id is None:
            return False

        # 소유자만 수정 가능
        return self.owner_id == user_id

    def get_allowed_user_ids(self) -> List[int]:
        """
        공유 허용된 사용자 ID 목록 반환

        Returns:
            사용자 ID 리스트
        """
        return self.allowed_users or []

    def set_allowed_users(self, user_ids: List[int]) -> None:
        """
        공유 허용 사용자 설정

        Args:
            user_ids: 사용자 ID 리스트
        """
        self.allowed_users = user_ids or []
