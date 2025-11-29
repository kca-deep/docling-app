"""
클라이언트 정보 추출 유틸리티
IP 주소, User-Agent, Referer 등의 정보를 안전하게 추출하고 해시화
"""

import hashlib
from typing import Optional, Dict, Any
from fastapi import Request
import logging

logger = logging.getLogger(__name__)


def get_client_ip(request: Request) -> Optional[str]:
    """
    클라이언트 IP 주소 추출
    프록시를 고려하여 실제 클라이언트 IP 반환
    """
    # X-Forwarded-For 헤더 확인 (프록시 환경)
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        # 첫 번째 IP가 원본 클라이언트 IP
        client_ip = forwarded_for.split(",")[0].strip()
    else:
        # X-Real-IP 헤더 확인
        client_ip = request.headers.get("X-Real-IP")
        if not client_ip:
            # 직접 연결인 경우
            client_ip = request.client.host if request.client else None

    return client_ip


def hash_ip(ip_address: Optional[str]) -> Optional[str]:
    """
    IP 주소를 SHA256으로 해시화
    개인정보 보호를 위해 원본 IP를 저장하지 않음
    """
    if not ip_address:
        return None

    try:
        # 일관된 해시를 위한 salt 추가 (환경변수로 관리 가능)
        salt = "docling-app-2024"
        hashed = hashlib.sha256(f"{ip_address}{salt}".encode()).hexdigest()
        return hashed[:16]  # 16자로 축약
    except Exception as e:
        logger.error(f"IP 해시화 실패: {e}")
        return None


def get_user_agent(request: Request) -> Optional[str]:
    """User-Agent 헤더 추출"""
    return request.headers.get("User-Agent")


def get_referer(request: Request) -> Optional[str]:
    """Referer 헤더 추출"""
    return request.headers.get("Referer")


def get_accept_language(request: Request) -> Optional[str]:
    """Accept-Language 헤더 추출 (사용자 언어 선호도)"""
    return request.headers.get("Accept-Language")


def extract_client_info(request: Request) -> Dict[str, Any]:
    """
    Request 객체에서 클라이언트 정보 추출

    Returns:
        dict: 클라이언트 정보
            - ip_hash: 해시화된 IP 주소
            - ip_country: IP 국가 (추후 구현 가능)
            - user_agent: 브라우저/앱 정보
            - referer: 요청 출처
            - accept_language: 언어 선호도
    """
    client_ip = get_client_ip(request)

    client_info = {
        "ip_hash": hash_ip(client_ip),
        "user_agent": get_user_agent(request),
        "referer": get_referer(request),
        "accept_language": get_accept_language(request),
    }

    # None 값 제거 (로그 크기 최적화)
    return {k: v for k, v in client_info.items() if v is not None}


def parse_user_agent(user_agent: Optional[str]) -> Dict[str, Any]:
    """
    User-Agent 문자열 파싱 (간단한 버전)

    Returns:
        dict: 파싱된 정보
            - browser: 브라우저 이름
            - os: 운영 체제
            - is_mobile: 모바일 여부
    """
    if not user_agent:
        return {}

    result = {
        "is_mobile": False,
        "browser": "unknown",
        "os": "unknown"
    }

    ua_lower = user_agent.lower()

    # 모바일 체크
    if any(mobile in ua_lower for mobile in ["mobile", "android", "iphone", "ipad"]):
        result["is_mobile"] = True

    # 브라우저 감지
    if "chrome" in ua_lower and "edg" not in ua_lower:
        result["browser"] = "Chrome"
    elif "firefox" in ua_lower:
        result["browser"] = "Firefox"
    elif "safari" in ua_lower and "chrome" not in ua_lower:
        result["browser"] = "Safari"
    elif "edg" in ua_lower:
        result["browser"] = "Edge"

    # OS 감지
    if "windows" in ua_lower:
        result["os"] = "Windows"
    elif "mac" in ua_lower:
        result["os"] = "macOS"
    elif "linux" in ua_lower:
        result["os"] = "Linux"
    elif "android" in ua_lower:
        result["os"] = "Android"
    elif "iphone" in ua_lower or "ipad" in ua_lower:
        result["os"] = "iOS"

    return result


def get_client_type(request: Request) -> str:
    """
    클라이언트 타입 판별

    Returns:
        str: "web", "mobile", "api"
    """
    user_agent = get_user_agent(request)

    if not user_agent:
        return "api"

    ua_info = parse_user_agent(user_agent)

    if ua_info.get("is_mobile"):
        return "mobile"
    elif any(keyword in user_agent.lower() for keyword in ["curl", "postman", "insomnia", "python", "axios"]):
        return "api"
    else:
        return "web"