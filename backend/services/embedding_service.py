"""
BGE-M3 임베딩 서비스
"""
import httpx
from typing import List, Union


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
        self.client = httpx.AsyncClient(timeout=60.0)

    async def get_embeddings(
        self,
        texts: Union[str, List[str]]
    ) -> List[List[float]]:
        """
        텍스트를 벡터로 임베딩

        Args:
            texts: 임베딩할 텍스트 (단일 문자열 또는 리스트)

        Returns:
            List[List[float]]: 임베딩 벡터 리스트

        Raises:
            Exception: 임베딩 실패 시
        """
        try:
            # 단일 텍스트를 리스트로 변환
            if isinstance(texts, str):
                texts = [texts]

            url = f"{self.base_url}/v1/embeddings"
            payload = {
                "input": texts,
                "model": self.model
            }

            response = await self.client.post(url, json=payload)
            response.raise_for_status()

            result = response.json()

            # 임베딩 벡터 추출
            embeddings = []
            for item in result.get('data', []):
                embeddings.append(item.get('embedding', []))

            print(f"[INFO] Successfully generated {len(embeddings)} embeddings")
            return embeddings

        except Exception as e:
            print(f"[ERROR] Failed to generate embeddings: {e}")
            raise Exception(f"임베딩 생성 실패: {str(e)}")

    async def get_embedding_dimension(self) -> int:
        """
        임베딩 벡터 차원 반환 (BGE-M3는 1024차원)

        Returns:
            int: 벡터 차원
        """
        return 1024

    async def close(self):
        """클라이언트 연결 종료"""
        await self.client.aclose()
