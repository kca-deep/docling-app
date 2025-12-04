"""
FastAPI 의존성 모듈
"""
from backend.dependencies.auth import get_current_user, get_current_active_user

__all__ = ["get_current_user", "get_current_active_user"]
