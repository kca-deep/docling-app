"""
인증 API 라우터
로그인, 로그아웃, 사용자 정보 조회, 회원가입, 사용자 관리
"""
import logging
import asyncio
import json
from datetime import timedelta
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.config.settings import settings
from backend.services.auth_service import auth_service, AuthenticationError
from backend.dependencies.auth import (
    get_current_user,
    get_current_active_user,
    require_admin,
    ACCESS_TOKEN_COOKIE_KEY
)
from backend.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["auth"])


# === Pydantic 스키마 ===

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


class DuplicateCheckRequest(BaseModel):
    """중복 체크 요청"""
    field: str  # "username" or "email"
    value: str


class DuplicateCheckResponse(BaseModel):
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


# === 엔드포인트 ===

@router.post("/login", response_model=UserResponse)
async def login(
    request: LoginRequest,
    response: Response,
    db: Session = Depends(get_db)
):
    """
    로그인

    사용자명과 비밀번호로 인증 후 JWT 토큰을 쿠키에 설정

    Returns:
        UserResponse: 로그인된 사용자 정보
    """
    try:
        user = auth_service.authenticate_user(
            db=db,
            username=request.username,
            password=request.password
        )
    except AuthenticationError as e:
        # 상태별 에러 코드 매핑
        status_code_map = {
            "PENDING_APPROVAL": status.HTTP_403_FORBIDDEN,
            "REJECTED": status.HTTP_403_FORBIDDEN,
            "INACTIVE": status.HTTP_403_FORBIDDEN,
            "INVALID_CREDENTIALS": status.HTTP_401_UNAUTHORIZED,
        }
        http_status = status_code_map.get(e.error_code, status.HTTP_401_UNAUTHORIZED)
        raise HTTPException(
            status_code=http_status,
            detail={"message": e.message, "error_code": e.error_code}
        )

    # JWT 토큰 생성
    access_token = auth_service.create_access_token(
        data={
            "sub": str(user.id),
            "username": user.username,
            "role": user.role
        },
        expires_delta=timedelta(hours=settings.SESSION_EXPIRE_HOURS)
    )

    # 쿠키에 토큰 설정 (path="/"로 전체 경로에서 유효하도록 설정)
    response.set_cookie(
        key=ACCESS_TOKEN_COOKIE_KEY,
        value=access_token,
        httponly=True,
        secure=False,  # 프로덕션에서는 True로 변경 (HTTPS 필수)
        samesite="lax",
        max_age=settings.SESSION_EXPIRE_HOURS * 3600,
        path="/"  # 전체 경로에서 쿠키 유효
    )

    logger.info(f"User '{user.username}' logged in successfully")

    return UserResponse.model_validate(user)


@router.post("/logout", response_model=MessageResponse)
async def logout(response: Response):
    """
    로그아웃

    쿠키에서 JWT 토큰 삭제
    """
    response.delete_cookie(
        key=ACCESS_TOKEN_COOKIE_KEY,
        httponly=True,
        secure=False,  # 프로덕션에서는 True로 변경
        samesite="lax",
        path="/"  # 설정 시와 동일한 path 사용
    )

    logger.info("User logged out")

    return MessageResponse(message="Logged out successfully")


@router.get("/me", response_model=UserResponse)
async def get_me(
    user: User = Depends(get_current_active_user)
):
    """
    현재 사용자 정보 조회

    인증 필수

    Returns:
        UserResponse: 현재 로그인된 사용자 정보
    """
    return UserResponse.model_validate(user)


@router.get("/verify", response_model=AuthStatusResponse)
async def verify_auth(
    request: Request,
    db: Session = Depends(get_db)
):
    """
    인증 상태 확인

    토큰 유효성 검증 (인증되지 않아도 예외 발생 안 함)

    Returns:
        AuthStatusResponse: 인증 상태 및 사용자 정보
    """
    user = await get_current_user(request, db)

    if user is None:
        return AuthStatusResponse(authenticated=False, user=None)

    return AuthStatusResponse(
        authenticated=True,
        user=UserResponse.model_validate(user)
    )


# =========================================
# 회원가입 엔드포인트
# =========================================

@router.post("/register", response_model=RegisterResponse)
async def register(
    request: RegisterRequest,
    db: Session = Depends(get_db)
):
    """
    회원가입

    새 사용자를 승인 대기 상태로 등록합니다.
    관리자 승인 후 로그인 가능합니다.

    Returns:
        RegisterResponse: 등록 결과
    """
    # 비밀번호 확인
    if request.password != request.password_confirm:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"message": "비밀번호가 일치하지 않습니다.", "error_code": "PASSWORD_MISMATCH"}
        )

    try:
        user = auth_service.register_user(
            db=db,
            username=request.username,
            email=request.email,
            password=request.password,
            name=request.name,
            team_name=request.team_name
        )
    except AuthenticationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"message": e.message, "error_code": e.error_code}
        )

    logger.info(f"New user registered: {user.username}")

    return RegisterResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        name=user.name,
        status=user.status,
        message="회원가입이 완료되었습니다. 관리자 승인 후 로그인할 수 있습니다."
    )


@router.post("/check-duplicate", response_model=DuplicateCheckResponse)
async def check_duplicate(
    request: DuplicateCheckRequest,
    db: Session = Depends(get_db)
):
    """
    중복 체크

    아이디 또는 이메일 중복 여부를 확인합니다.

    Returns:
        DuplicateCheckResponse: 중복 여부
    """
    if request.field not in ["username", "email"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="field는 'username' 또는 'email'이어야 합니다."
        )

    is_duplicate = False
    message = ""

    if request.field == "username":
        is_duplicate = auth_service.check_duplicate_username(db, request.value)
        message = "이미 사용 중인 아이디입니다." if is_duplicate else "사용 가능한 아이디입니다."
    elif request.field == "email":
        is_duplicate = auth_service.check_duplicate_email(db, request.value)
        message = "이미 사용 중인 이메일입니다." if is_duplicate else "사용 가능한 이메일입니다."

    return DuplicateCheckResponse(
        is_duplicate=is_duplicate,
        field=request.field,
        message=message
    )


# =========================================
# 관리자 엔드포인트
# =========================================

@router.get("/pending-count", response_model=PendingCountResponse)
async def get_pending_count(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """
    승인 대기 사용자 수 조회 (관리자 전용)

    네비게이션 뱃지 표시용 간단한 카운트 API

    Returns:
        PendingCountResponse: 대기 중인 사용자 수
    """
    users = auth_service.get_pending_users(db)
    return PendingCountResponse(pending_count=len(users))


@router.get("/pending-count/stream")
async def get_pending_count_stream(
    request: Request,
    db: Session = Depends(get_db)
):
    """
    승인 대기 사용자 수 실시간 스트리밍 (SSE)

    관리자 네비게이션 배지 실시간 업데이트용
    - 5초마다 상태 체크
    - 변경 시에만 이벤트 전송
    - 30초마다 heartbeat
    """
    async def event_generator():
        previous_count = None
        check_interval = 5
        heartbeat_counter = 0

        try:
            while True:
                try:
                    # DB 세션 새로 생성 (long-running connection)
                    from backend.database import SessionLocal
                    local_db = SessionLocal()
                    try:
                        users = auth_service.get_pending_users(local_db)
                        current_count = len(users)
                    finally:
                        local_db.close()

                    # 변경 시 또는 첫 연결 시 전송
                    if current_count != previous_count:
                        data = json.dumps({"pending_count": current_count})
                        yield f"data: {data}\n\n"
                        previous_count = current_count
                        heartbeat_counter = 0
                    else:
                        heartbeat_counter += 1
                        if heartbeat_counter >= 6:
                            yield ": heartbeat\n\n"
                            heartbeat_counter = 0

                    await asyncio.sleep(check_interval)

                except asyncio.CancelledError:
                    logger.debug("Pending count SSE stream cancelled")
                    break
                except Exception as e:
                    logger.error(f"Pending count SSE error: {e}")
                    yield f"data: {json.dumps({'error': str(e)})}\n\n"
                    await asyncio.sleep(check_interval)
        finally:
            logger.debug("Pending count SSE stream closed")

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )


def _user_to_list_response(user: User) -> UserListResponse:
    """User 모델을 UserListResponse로 변환"""
    return UserListResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        name=user.name,
        team_name=user.team_name,
        role=user.role,
        status=user.status,
        is_active=user.is_active,
        created_at=user.created_at.isoformat() if user.created_at else None,
        last_login=user.last_login.isoformat() if user.last_login else None
    )


@router.get("/users", response_model=List[UserListResponse])
async def list_users(
    status_filter: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """
    사용자 목록 조회 (관리자 전용)

    Args:
        status_filter: 상태 필터 (pending, approved, rejected)
        skip: 건너뛸 개수
        limit: 최대 개수

    Returns:
        List[UserListResponse]: 사용자 목록
    """
    users = auth_service.get_all_users(
        db=db,
        skip=skip,
        limit=limit,
        status_filter=status_filter
    )

    return [_user_to_list_response(user) for user in users]


@router.get("/users/shareable", response_model=List[ShareableUserResponse])
async def list_shareable_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    공유 가능한 사용자 목록 조회 (컬렉션 공유용)

    - 승인된(approved) 활성 사용자만 반환
    - 본인은 목록에서 제외
    - 민감 정보 제외 (id, username, name, team_name만)

    Returns:
        List[ShareableUserResponse]: 공유 가능한 사용자 목록
    """
    users = auth_service.get_shareable_users(
        db=db,
        exclude_user_id=current_user.id
    )

    return [
        ShareableUserResponse(
            id=user.id,
            username=user.username,
            name=user.name,
            team_name=user.team_name
        )
        for user in users
    ]


@router.get("/users/pending", response_model=List[UserListResponse])
async def list_pending_users(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """
    승인 대기 사용자 목록 조회 (관리자 전용)

    Returns:
        List[UserListResponse]: 대기 중인 사용자 목록
    """
    users = auth_service.get_pending_users(db)
    return [_user_to_list_response(user) for user in users]


@router.post("/users/approve", response_model=ApproveRejectResponse)
async def approve_user(
    request: ApproveRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """
    사용자 승인 (관리자 전용)

    Returns:
        ApproveRejectResponse: 승인 결과
    """
    try:
        user = auth_service.approve_user(
            db=db,
            user_id=request.user_id,
            admin_id=admin.id
        )
    except AuthenticationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"message": e.message, "error_code": e.error_code}
        )

    logger.info(f"User {user.username} approved by admin {admin.username}")

    return ApproveRejectResponse(
        success=True,
        user_id=user.id,
        status=user.status,
        message=f"사용자 '{user.username}'이(가) 승인되었습니다."
    )


@router.post("/users/reject", response_model=ApproveRejectResponse)
async def reject_user(
    request: RejectRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """
    사용자 거절 (관리자 전용)

    Returns:
        ApproveRejectResponse: 거절 결과
    """
    try:
        user = auth_service.reject_user(
            db=db,
            user_id=request.user_id,
            admin_id=admin.id,
            reason=request.reason
        )
    except AuthenticationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"message": e.message, "error_code": e.error_code}
        )

    logger.info(f"User {user.username} rejected by admin {admin.username}. Reason: {request.reason}")

    return ApproveRejectResponse(
        success=True,
        user_id=user.id,
        status=user.status,
        message=f"사용자 '{user.username}'이(가) 거절되었습니다."
    )


@router.delete("/users/{user_id}", response_model=MessageResponse)
async def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """
    사용자 삭제 (관리자 전용)

    Returns:
        MessageResponse: 삭제 결과
    """
    # 자기 자신 삭제 방지
    if user_id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="자기 자신은 삭제할 수 없습니다."
        )

    success = auth_service.delete_user(db, user_id)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="사용자를 찾을 수 없습니다."
        )

    logger.info(f"User ID {user_id} deleted by admin {admin.username}")

    return MessageResponse(message="사용자가 삭제되었습니다.")
