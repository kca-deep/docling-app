"""
사용자 모델
인증 및 권한 관리를 위한 User 테이블 정의
"""
from datetime import datetime, timezone
from enum import Enum
from typing import Dict, Any
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from backend.database import Base


# user 역할 기본 권한 (Phase 2에서 DB 조회로 대체)
_USER_ROLE_DEFAULTS: Dict[str, Dict[str, bool]] = {
    "chat":      {"use": True,  "all_collections": False},
    "selfcheck": {"execute": True, "history": True, "feedback": False},
    "documents": {"parse": True, "view": True, "delete": False},
    "qdrant":    {"upload": True, "collections": False},
    "excel":     {"upload": True},
    "dify":      {"upload": True, "config": False},
    "analytics": {"view": False},
    "admin":     {"users": False, "system": False},
}

# operator 역할 기본 권한
_OPERATOR_ROLE_DEFAULTS: Dict[str, Dict[str, bool]] = {
    "chat":      {"use": False, "all_collections": False},
    "selfcheck": {"execute": False, "history": False, "feedback": False},
    "documents": {"parse": True, "view": True, "delete": True},
    "qdrant":    {"upload": True, "collections": True},
    "excel":     {"upload": True},
    "dify":      {"upload": False, "config": False},
    "analytics": {"view": False},
    "admin":     {"users": False, "system": False},
}


class UserStatus(str, Enum):
    """사용자 승인 상태"""
    PENDING = "pending"      # 승인 대기
    APPROVED = "approved"    # 승인됨
    REJECTED = "rejected"    # 거절됨


class User(Base):
    """사용자 모델 (확장성을 고려한 설계)"""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=True, index=True)  # nullable for migration
    password_hash = Column(String(255), nullable=False)
    name = Column(String(100), nullable=True)  # nullable for migration
    team_name = Column(String(100), nullable=True)
    role = Column(String(20), nullable=False, default="user")  # admin, user
    status = Column(String(20), nullable=False, default=UserStatus.PENDING.value, index=True)
    is_active = Column(Boolean, default=False)  # 승인 전까지 비활성
    rejected_reason = Column(Text, nullable=True)
    approved_at = Column(DateTime, nullable=True)
    approved_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    last_login = Column(DateTime, nullable=True)

    # 브루트포스 공격 방어 필드
    failed_login_attempts = Column(Integer, default=0, nullable=False)
    locked_until = Column(DateTime, nullable=True)  # 계정 잠금 해제 시간

    def __repr__(self):
        return f"<User(id={self.id}, username='{self.username}', email='{self.email}', status='{self.status}')>"

    def is_pending(self) -> bool:
        """승인 대기 상태인지 확인"""
        return self.status == UserStatus.PENDING.value

    def is_approved(self) -> bool:
        """승인된 상태인지 확인"""
        return self.status == UserStatus.APPROVED.value

    def is_rejected(self) -> bool:
        """거절된 상태인지 확인"""
        return self.status == UserStatus.REJECTED.value

    def can_login(self) -> bool:
        """로그인 가능한지 확인"""
        return self.is_approved() and self.is_active

    def is_locked(self) -> bool:
        """계정이 잠겨있는지 확인"""
        if self.locked_until is None:
            return False
        # timezone-aware 비교를 위해 naive datetime 처리
        now = datetime.now(timezone.utc)
        locked = self.locked_until
        if locked.tzinfo is None:
            locked = locked.replace(tzinfo=timezone.utc)
        return now < locked

    def get_remaining_lockout_seconds(self) -> int:
        """남은 잠금 시간(초) 반환"""
        if self.locked_until is None:
            return 0
        now = datetime.now(timezone.utc)
        locked = self.locked_until
        if locked.tzinfo is None:
            locked = locked.replace(tzinfo=timezone.utc)
        remaining = (locked - now).total_seconds()
        return max(0, int(remaining))

    def get_permissions(self) -> Dict[str, Any]:
        """역할별 기본 권한 반환 (Phase 2에서 DB 조회로 대체)"""
        if self.role == "admin":
            return {cat: {act: True for act in actions} for cat, actions in _USER_ROLE_DEFAULTS.items()}
        if self.role == "operator":
            return _OPERATOR_ROLE_DEFAULTS
        return _USER_ROLE_DEFAULTS

    def has_permission(self, category: str, action: str) -> bool:
        """특정 권한 보유 여부 확인 (Phase 2에서 rbac_service DB 조회로 대체)"""
        if self.role == "admin":
            return True
        defaults = _OPERATOR_ROLE_DEFAULTS if self.role == "operator" else _USER_ROLE_DEFAULTS
        return defaults.get(category, {}).get(action, False)
