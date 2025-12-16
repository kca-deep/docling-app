"""
사용자 모델
인증 및 권한 관리를 위한 User 테이블 정의
"""
from datetime import datetime, timezone
from enum import Enum
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from backend.database import Base


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
