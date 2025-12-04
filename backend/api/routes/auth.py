"""
인증 API 라우터
로그인, 로그아웃, 사용자 정보 조회
"""
import logging
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.config.settings import settings
from backend.services.auth_service import auth_service
from backend.dependencies.auth import (
    get_current_user,
    get_current_active_user,
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
    role: str
    is_active: bool

    class Config:
        from_attributes = True


class AuthStatusResponse(BaseModel):
    """인증 상태 응답"""
    authenticated: bool
    user: UserResponse | None = None


class MessageResponse(BaseModel):
    """메시지 응답"""
    message: str


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
    user = auth_service.authenticate_user(
        db=db,
        username=request.username,
        password=request.password
    )

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password"
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

    # 쿠키에 토큰 설정
    response.set_cookie(
        key=ACCESS_TOKEN_COOKIE_KEY,
        value=access_token,
        httponly=True,
        secure=False,  # 프로덕션에서는 True로 변경 (HTTPS 필수)
        samesite="lax",
        max_age=settings.SESSION_EXPIRE_HOURS * 3600
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
        samesite="lax"
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
