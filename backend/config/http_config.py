"""
HTTP 클라이언트 설정
서비스별 HTTP 클라이언트 구성을 정의합니다.
"""
from dataclasses import dataclass
from backend.config.settings import settings


@dataclass
class ClientConfig:
    """HTTP 클라이언트 설정"""
    timeout: float
    max_connections: int
    max_keepalive: int


# 서비스별 HTTP 클라이언트 설정
HTTP_CLIENT_CONFIGS = {
    "docling": ClientConfig(
        timeout=120.0,  # 문서 변환은 오래 걸릴 수 있음
        max_connections=10,
        max_keepalive=5
    ),
    "docling_vlm": ClientConfig(
        timeout=300.0,  # VLM 파이프라인은 더 오래 걸림
        max_connections=5,
        max_keepalive=3
    ),
    "embedding": ClientConfig(
        timeout=60.0,
        max_connections=50,
        max_keepalive=20
    ),
    "llm": ClientConfig(
        timeout=180.0,  # LLM 응답은 오래 걸릴 수 있음
        max_connections=20,
        max_keepalive=10
    ),
    "qdrant": ClientConfig(
        timeout=30.0,
        max_connections=50,
        max_keepalive=20
    ),
    "dify": ClientConfig(
        timeout=30.0,
        max_connections=20,
        max_keepalive=10
    ),
    "reranker": ClientConfig(
        timeout=60.0,
        max_connections=20,
        max_keepalive=10
    ),
    "qwen3_vl": ClientConfig(
        timeout=float(settings.QWEN3_VL_TIMEOUT),
        max_connections=10,
        max_keepalive=5
    ),
    "default": ClientConfig(
        timeout=settings.HTTP_TIMEOUT_DEFAULT,
        max_connections=settings.HTTP_MAX_CONNECTIONS,
        max_keepalive=settings.HTTP_MAX_KEEPALIVE
    ),
}


def get_client_config(name: str) -> ClientConfig:
    """
    서비스 이름으로 클라이언트 설정 가져오기

    Args:
        name: 서비스 이름 (docling, embedding, llm 등)

    Returns:
        ClientConfig: 해당 서비스의 클라이언트 설정
    """
    return HTTP_CLIENT_CONFIGS.get(name, HTTP_CLIENT_CONFIGS["default"])
