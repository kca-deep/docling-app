"""
RBAC (Role-Based Access Control) 모델
역할, 권한, 역할별 권한, 사용자 역할 할당, 사용자별 권한 오버라이드 테이블 정의
"""
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, UniqueConstraint
from sqlalchemy.orm import relationship
from backend.database import Base


class Role(Base):
    """역할 테이블 (admin, operator, user)"""
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    role_permissions = relationship("RolePermission", back_populates="role", cascade="all, delete-orphan")
    user_roles = relationship("UserRole", back_populates="role", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Role(id={self.id}, name='{self.name}')>"


class Permission(Base):
    """권한 테이블 (category.action 형태)"""
    __tablename__ = "permissions"

    id = Column(Integer, primary_key=True, index=True)
    category = Column(String(50), nullable=False, index=True)
    action = Column(String(50), nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        UniqueConstraint("category", "action", name="uq_permissions_category_action"),
    )

    role_permissions = relationship("RolePermission", back_populates="permission", cascade="all, delete-orphan")
    user_overrides = relationship("UserPermissionOverride", back_populates="permission", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Permission(id={self.id}, category='{self.category}', action='{self.action}')>"


class RolePermission(Base):
    """역할별 기본 권한 매핑"""
    __tablename__ = "role_permissions"

    id = Column(Integer, primary_key=True, index=True)
    role_id = Column(Integer, ForeignKey("roles.id", ondelete="CASCADE"), nullable=False, index=True)
    permission_id = Column(Integer, ForeignKey("permissions.id", ondelete="CASCADE"), nullable=False, index=True)
    granted = Column(Boolean, nullable=False, default=False)

    __table_args__ = (
        UniqueConstraint("role_id", "permission_id", name="uq_role_permissions"),
    )

    role = relationship("Role", back_populates="role_permissions")
    permission = relationship("Permission", back_populates="role_permissions")

    def __repr__(self):
        return f"<RolePermission(role_id={self.role_id}, permission_id={self.permission_id}, granted={self.granted})>"


class UserRole(Base):
    """사용자-역할 매핑 (사용자당 하나의 역할)"""
    __tablename__ = "user_roles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    role_id = Column(Integer, ForeignKey("roles.id", ondelete="CASCADE"), nullable=False, index=True)
    assigned_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    assigned_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    __table_args__ = (
        UniqueConstraint("user_id", name="uq_user_roles_user_id"),
    )

    role = relationship("Role", back_populates="user_roles", foreign_keys=[role_id])

    def __repr__(self):
        return f"<UserRole(user_id={self.user_id}, role_id={self.role_id})>"


class UserPermissionOverride(Base):
    """사용자별 권한 오버라이드 (역할 기본값 덮어쓰기)"""
    __tablename__ = "user_permission_overrides"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    permission_id = Column(Integer, ForeignKey("permissions.id", ondelete="CASCADE"), nullable=False, index=True)
    granted = Column(Boolean, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    __table_args__ = (
        UniqueConstraint("user_id", "permission_id", name="uq_user_permission_overrides"),
    )

    permission = relationship("Permission", back_populates="user_overrides")

    def __repr__(self):
        return f"<UserPermissionOverride(user_id={self.user_id}, permission_id={self.permission_id}, granted={self.granted})>"
