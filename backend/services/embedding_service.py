"""
BGE-M3 임베딩 서비스
"""
import logging
from typing import List, Union

from backend.services.http_client import http_manager
from backend.utils.retry import async_retry

logger = logging.getLogger(__name__)


class EmbeddingService:
    """BGE-M3 임베딩 서버와의 통신을 담당하는 서비스"""

    def __init__(self, base_url: str, model: str = "bge-m3-korean"):
        """
        EmbeddingService 초기화

        Args:
            base_url: 임베딩 서버 기본 URL
            model: 임베딩 모델 이름
        """
        self.base_url = base_url
        self.model = model
        # 싱글톤 HTTP 클라이언트 매니저 사용
        self.client = http_manager.get_client("embedding")

    # 배치 크기 (VRAM 오버부킹 방지)
    BATCH_SIZE = 32

    @async_retry(max_attempts=3, base_delay=1.0, max_delay=10.0)
    async def _get_embeddings_batch(
        self,
        texts: List[str]
    ) -> List[List[float]]:
        """
        단일 배치에 대한 임베딩 생성 (내부용)
        """
        url = f"{self.base_url}/v1/embeddings"
        payload = {
            "input": texts,
            "model": self.model
        }

        response = await self.client.post(url, json=payload)
        response.raise_for_status()

        result = response.json()

        embeddings = []
        for item in result.get('data', []):
            embeddings.append(item.get('embedding', []))

        return embeddings

    async def get_embeddings(
        self,
        texts: Union[str, List[str]]
    ) -> List[List[float]]:
        """
        텍스트를 벡터로 임베딩 (배치 처리 지원)

        Args:
            texts: 임베딩할 텍스트 (단일 문자열 또는 리스트)

        Returns:
            List[List[float]]: 임베딩 벡터 리스트

        Raises:
            Exception: 임베딩 실패 시 (재시도 후에도 실패한 경우)
        """
        try:
            # 단일 텍스트를 리스트로 변환
            if isinstance(texts, str):
                texts = [texts]

            # 배치 크기 이하면 한번에 처리
            if len(texts) <= self.BATCH_SIZE:
                embeddings = await self._get_embeddings_batch(texts)
                logger.info(f"Successfully generated {len(embeddings)} embeddings")
                return embeddings

            # 배치 처리
            all_embeddings = []
            total_batches = (len(texts) + self.BATCH_SIZE - 1) // self.BATCH_SIZE

            for i in range(0, len(texts), self.BATCH_SIZE):
                batch = texts[i:i + self.BATCH_SIZE]
                batch_num = i // self.BATCH_SIZE + 1
                logger.info(f"Processing embedding batch {batch_num}/{total_batches} ({len(batch)} texts)")

                batch_embeddings = await self._get_embeddings_batch(batch)
                all_embeddings.extend(batch_embeddings)

            logger.info(f"Successfully generated {len(all_embeddings)} embeddings in {total_batches} batches")
            return all_embeddings

        except Exception as e:
            logger.error(f"Failed to generate embeddings: {e}")
            raise Exception(f"임베딩 생성 실패: {str(e)}")

    async def get_embedding_dimension(self) -> int:
        """
        임베딩 벡터 차원 반환 (BGE-M3는 1024차원)

        Returns:
            int: 벡터 차원
        """
        return 1024

    async def close(self):
        """
        클라이언트 연결 종료

        Note: HTTP 클라이언트 매니저가 관리하므로 개별 종료 불필요
        앱 종료 시 http_manager.close_all()에서 일괄 처리됨
        """
        pass  # HTTP 클라이언트 매니저에서 관리
