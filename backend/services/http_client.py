"""
HTTP 클라이언트 매니저
싱글톤 패턴으로 HTTP 클라이언트 연결 풀을 관리합니다.
"""
import logging
from typing import Optional, Dict

import httpx

from backend.config.settings import settings
from backend.config.http_config import get_client_config

logger = logging.getLogger(__name__)


class HTTPClientManager:
    """
    싱글톤 HTTP 클라이언트 매니저

    각 서비스별로 연결 풀을 관리하여 리소스를 효율적으로 사용합니다.
    """

    _instance: Optional["HTTPClientManager"] = None
    _clients: Dict[str, httpx.AsyncClient] = {}

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._clients = {}
        return cls._instance

    def get_client(
        self,
        name: str,
        timeout: Optional[float] = None,
        max_connections: Optional[int] = None,
        max_keepalive_connections: Optional[int] = None,
    ) -> httpx.AsyncClient:
        """
        이름별 HTTP 클라이언트 반환 (없으면 생성)

        Args:
            name: 클라이언트 이름 (docling, embedding, llm 등)
            timeout: 타임아웃 (초) - None이면 설정에서 가져옴
            max_connections: 최대 연결 수 - None이면 설정에서 가져옴
            max_keepalive_connections: Keep-Alive 연결 수 - None이면 설정에서 가져옴

        Returns:
            httpx.AsyncClient: HTTP 클라이언트 인스턴스
        """
        if name not in self._clients:
            config = get_client_config(name)

            # 파라미터가 없으면 설정에서 가져옴
            _timeout = timeout or config.timeout
            _max_connections = max_connections or config.max_connections
            _max_keepalive = max_keepalive_connections or config.max_keepalive

            limits = httpx.Limits(
                max_connections=_max_connections,
                max_keepalive_connections=_max_keepalive,
            )

            self._clients[name] = httpx.AsyncClient(
                timeout=httpx.Timeout(_timeout),
                limits=limits,
                http2=settings.HTTP_ENABLE_HTTP2,
                headers={"Accept-Charset": "utf-8"}
            )

            logger.info(
                f"Created HTTP client '{name}' "
                f"(timeout={_timeout}s, max_conn={_max_connections}, keepalive={_max_keepalive})"
            )

        return self._clients[name]

    async def close_all(self) -> None:
        """모든 클라이언트 종료"""
        for name, client in list(self._clients.items()):
            try:
                await client.aclose()
                logger.info(f"Closed HTTP client '{name}'")
            except Exception as e:
                logger.error(f"Error closing HTTP client '{name}': {e}")
        self._clients.clear()

    async def close(self, name: str) -> None:
        """특정 클라이언트 종료"""
        if name in self._clients:
            try:
                await self._clients[name].aclose()
                del self._clients[name]
                logger.info(f"Closed HTTP client '{name}'")
            except Exception as e:
                logger.error(f"Error closing HTTP client '{name}': {e}")

    def get_client_info(self) -> Dict[str, Dict]:
        """현재 활성화된 클라이언트 정보 반환"""
        info = {}
        for name, client in self._clients.items():
            config = get_client_config(name)
            info[name] = {
                "timeout": config.timeout,
                "max_connections": config.max_connections,
                "max_keepalive": config.max_keepalive,
                "http2": settings.HTTP_ENABLE_HTTP2
            }
        return info


# 싱글톤 인스턴스
http_manager = HTTPClientManager()
