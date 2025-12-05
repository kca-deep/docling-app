"""
BGE Reranker v2-m3 서비스

Cross-encoder 기반 문서 재순위 기능을 제공합니다.
벡터 검색 결과를 더 정확한 관련도 점수로 재정렬하여
RAG 시스템의 검색 정확도를 향상시킵니다.
"""
import logging
from typing import List, Dict, Any, Optional, Union

import httpx

from backend.config.settings import settings
from backend.services.http_client import http_manager

logger = logging.getLogger(__name__)


class RerankResult:
    """Reranking 결과를 담는 데이터 클래스"""

    def __init__(self, index: int, relevance_score: float, document: Optional[str] = None):
        self.index = index
        self.relevance_score = relevance_score
        self.document = document

    def __repr__(self):
        return f"RerankResult(index={self.index}, score={self.relevance_score:.4f})"


class RerankerService:
    """BGE Reranker v2-m3 서비스 클래스"""

    def __init__(self):
        """Reranker 서비스 초기화"""
        self.base_url = settings.RERANKER_URL
        self.model = settings.RERANKER_MODEL
        self.timeout = settings.RERANKER_TIMEOUT
        # 싱글톤 HTTP 클라이언트 매니저 사용
        self.client = http_manager.get_client("reranker")
        logger.info(f"RerankerService initialized: {self.base_url}, model={self.model}")

    async def rerank(
        self,
        query: str,
        documents: List[Union[str, Dict[str, Any]]],
        top_n: Optional[int] = None,
        return_documents: bool = False
    ) -> List[RerankResult]:
        """
        문서를 재순위하여 관련도가 높은 순서로 정렬

        Args:
            query: 사용자 질문
            documents: 재순위할 문서 리스트 (문자열 또는 객체)
            top_n: 반환할 상위 문서 수 (None이면 모두 반환)
            return_documents: 문서 텍스트 포함 여부

        Returns:
            RerankResult 객체 리스트 (relevance_score 내림차순 정렬)

        Raises:
            httpx.TimeoutException: API 타임아웃 발생
            httpx.HTTPStatusError: HTTP 에러 응답
            httpx.RequestError: 네트워크 에러
        """
        if not documents:
            logger.warning("Rerank called with empty documents")
            return []

        url = f"{self.base_url}/v1/rerank"

        payload = {
            "model": self.model,
            "query": query,
            "documents": documents,
            "return_documents": return_documents
        }

        if top_n is not None:
            payload["top_n"] = top_n

        try:
            logger.debug(f"Reranking {len(documents)} documents for query: {query[:50]}...")
            response = await self.client.post(url, json=payload)
            response.raise_for_status()
            result = response.json()

            # 결과를 RerankResult 객체로 변환
            rerank_results = [
                RerankResult(
                    index=item["index"],
                    relevance_score=item["relevance_score"],
                    document=item.get("document")
                )
                for item in result.get("results", [])
            ]

            top_score = rerank_results[0].relevance_score if rerank_results else 0
            logger.info(
                f"Reranking completed: {len(rerank_results)} results, "
                f"top score: {top_score:.4f}"
            )

            return rerank_results

        except httpx.TimeoutException as e:
            logger.error(f"Reranker API timeout: {e}")
            raise
        except httpx.HTTPStatusError as e:
            logger.error(f"Reranker API HTTP error: {e.response.status_code} - {e.response.text}")
            raise
        except httpx.RequestError as e:
            logger.error(f"Reranker API request error: {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error during reranking: {e}")
            raise

    async def rerank_with_fallback(
        self,
        query: str,
        documents: List[Union[str, Dict[str, Any]]],
        top_n: Optional[int] = None,
        return_documents: bool = False
    ) -> Optional[List[RerankResult]]:
        """
        Reranking을 시도하고 실패 시 None 반환 (Fallback 지원)

        Args:
            query: 사용자 질문
            documents: 재순위할 문서 리스트
            top_n: 반환할 상위 문서 수
            return_documents: 문서 텍스트 포함 여부

        Returns:
            성공 시 RerankResult 리스트, 실패 시 None
        """
        try:
            return await self.rerank(query, documents, top_n, return_documents)
        except Exception as e:
            logger.warning(f"Reranking failed, using fallback: {e}")
            return None

    def is_available(self) -> bool:
        """
        Reranker 서비스 사용 가능 여부 확인

        Returns:
            설정에서 USE_RERANKING이 True이면 True, 아니면 False
        """
        return settings.USE_RERANKING


# 싱글톤 인스턴스
reranker_service = RerankerService()
