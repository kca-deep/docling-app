"""
인증(Auth) API 스키마
로그인, 회원가입, 사용자 관리, 권한 관리 관련 Pydantic 모델
"""
from typing import Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field


# === 로그인/로그아웃 스키마 ===

class LoginRequest(BaseModel):
    """로그인 요청"""
    username: str
    password: str


class UserResponse(BaseModel):
    """사용자 정보 응답"""
    id: int
    username: str
    email: Optional[str] = None
    name: Optional[str] = None
    team_name: Optional[str] = None
    role: str
    status: str = "approved"
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


class AuthStatusResponse(BaseModel):
    """인증 상태 응답"""
    authenticated: bool
    user: UserResponse | None = None


class MessageResponse(BaseModel):
    """메시지 응답"""
    message: str


# === 회원가입 스키마 ===

class RegisterRequest(BaseModel):
    """회원가입 요청"""
    username: str = Field(..., min_length=4, max_length=50, pattern=r"^[a-zA-Z0-9_]+$")
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    password_confirm: str
    name: str = Field(..., min_length=2, max_length=100)
    team_name: Optional[str] = Field(None, max_length=100)


class RegisterResponse(BaseModel):
    """회원가입 응답"""
    id: int
    username: str
    email: str
    name: str
    status: str
    message: str


class AuthDuplicateCheckRequest(BaseModel):
    """중복 체크 요청"""
    field: str  # "username" or "email"
    value: str


class AuthDuplicateCheckResponse(BaseModel):
    """중복 체크 응답"""
    is_duplicate: bool
    field: str
    message: str


# === 관리자 스키마 ===

class UserListResponse(BaseModel):
    """사용자 목록 응답"""
    id: int
    username: str
    email: Optional[str] = None
    name: Optional[str] = None
    team_name: Optional[str] = None
    role: str
    status: str
    is_active: bool
    created_at: Optional[str] = None
    last_login: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class ShareableUserResponse(BaseModel):
    """공유 가능 사용자 응답 (컬렉션 공유용)"""
    id: int
    username: str
    name: Optional[str] = None
    team_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class ApproveRequest(BaseModel):
    """승인 요청"""
    user_id: int


class RejectRequest(BaseModel):
    """거절 요청"""
    user_id: int
    reason: Optional[str] = None


class ApproveRejectResponse(BaseModel):
    """승인/거절 응답"""
    success: bool
    user_id: int
    status: str
    message: str


class PendingCountResponse(BaseModel):
    """승인 대기 카운트 응답"""
    pending_count: int


# === 권한 스키마 ===

class PermissionCategory(BaseModel):
    """권한 카테고리"""
    model_config = ConfigDict(extra='allow')


class UserPermissions(BaseModel):
    """사용자 권한"""
    selfcheck: Optional[dict] = None
    documents: Optional[dict] = None
    qdrant: Optional[dict] = None
    dify: Optional[dict] = None
    chat: Optional[dict] = None
    analytics: Optional[dict] = None
    excel: Optional[dict] = None
    admin: Optional[dict] = None

    model_config = ConfigDict(extra='forbid')


class PermissionsResponse(BaseModel):
    """권한 응답"""
    user_id: int
    username: str
    role: str
    permissions: dict


class UpdatePermissionsRequest(BaseModel):
    """권한 업데이트 요청"""
    permissions: dict


class PasswordResetRequest(BaseModel):
    """비밀번호 초기화 요청"""
    new_password: str = Field(..., min_length=8, max_length=128)
    new_password_confirm: str


class PasswordResetResponse(BaseModel):
    """비밀번호 초기화 응답"""
    success: bool
    user_id: int
    username: str
    message: str


class PermissionsUpdateResponse(BaseModel):
    """권한 업데이트 응답"""
    success: bool
    user_id: int
    message: str
    permissions: dict
