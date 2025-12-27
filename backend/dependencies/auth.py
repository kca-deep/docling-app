"""
인증 의존성
FastAPI 라우터에서 사용할 인증 의존성 함수
"""
import logging
from typing import Optional

from fastapi import Depends, HTTPException, status, Request
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models.user import User
from backend.services.auth_service import auth_service

logger = logging.getLogger(__name__)

# 쿠키에서 토큰을 읽을 키 이름
ACCESS_TOKEN_COOKIE_KEY = "access_token"


async def get_current_user(
    request: Request,
    db: Session = Depends(get_db)
) -> Optional[User]:
    """
    현재 인증된 사용자 조회 (Optional)

    쿠키에서 JWT 토큰을 읽어 사용자 정보 반환
    인증되지 않은 경우 None 반환 (예외 발생 안 함)

    Args:
        request: FastAPI Request 객체
        db: 데이터베이스 세션

    Returns:
        User: 인증된 사용자 또는 None
    """
    token = request.cookies.get(ACCESS_TOKEN_COOKIE_KEY)

    if not token:
        return None

    payload = auth_service.decode_token(token)
    if payload is None:
        return None

    user_id = payload.get("sub")
    if user_id is None:
        return None

    try:
        user_id = int(user_id)
    except (ValueError, TypeError):
        return None

    user = auth_service.get_user_by_id(db, user_id)
    if user is None or not user.is_active:
        return None

    return user


async def get_current_active_user(
    request: Request,
    db: Session = Depends(get_db)
) -> User:
    """
    현재 활성 사용자 조회 (필수)

    인증되지 않았거나 비활성 사용자인 경우 401 예외 발생

    Args:
        request: FastAPI Request 객체
        db: 데이터베이스 세션

    Returns:
        User: 인증된 활성 사용자

    Raises:
        HTTPException: 401 Unauthorized
    """
    user = await get_current_user(request, db)

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


async def require_admin(
    user: User = Depends(get_current_active_user)
) -> User:
    """
    관리자 권한 필수 의존성

    admin 역할이 아닌 경우 403 예외 발생

    Args:
        user: 현재 인증된 사용자

    Returns:
        User: 관리자 사용자

    Raises:
        HTTPException: 403 Forbidden
    """
    if user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )

    return user


def require_permission(category: str, action: str):
    """
    특정 권한 필수 의존성 팩토리

    Args:
        category: 권한 카테고리 (documents, qdrant, dify 등)
        action: 권한 액션 (parse, upload, view 등)

    Returns:
        Dependency function that checks the permission

    Usage:
        @router.post("/parse")
        async def parse_document(
            user: User = Depends(require_permission("documents", "parse"))
        ):
            ...
    """
    async def permission_checker(
        user: User = Depends(get_current_active_user)
    ) -> User:
        if not user.has_permission(category, action):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied: {category}:{action}"
            )
        return user

    return permission_checker


async def get_current_user_with_permissions(
    request: Request,
    db: Session = Depends(get_db)
) -> Optional[User]:
    """
    현재 인증된 사용자와 권한 정보 조회 (Optional)

    쿠키에서 JWT 토큰을 읽어 사용자 정보와 권한을 함께 반환
    인증되지 않은 경우 None 반환 (예외 발생 안 함)

    Args:
        request: FastAPI Request 객체
        db: 데이터베이스 세션

    Returns:
        User: 인증된 사용자 또는 None (권한 정보 포함)
    """
    user = await get_current_user(request, db)
    return user


# Alias for get_current_user to make optional authentication explicit
get_current_user_optional = get_current_user
