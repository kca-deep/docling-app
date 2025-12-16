"""
하이브리드 검색 서비스
벡터 검색(Dense) + 키워드 검색(BM25 Sparse)을 결합한 검색
"""
import re
import logging
from typing import List, Dict, Any, Optional, Tuple
from collections import defaultdict
from rank_bm25 import BM25Okapi

from backend.services.qdrant_service import QdrantService
from backend.config.settings import settings

logger = logging.getLogger("uvicorn")


class HybridSearchService:
    """하이브리드 검색 (벡터 + BM25) 서비스"""

    def __init__(self, qdrant_service: QdrantService):
        """
        HybridSearchService 초기화

        Args:
            qdrant_service: Qdrant 서비스
        """
        self.qdrant_service = qdrant_service
        # 컬렉션별 BM25 인덱스 캐시
        # {collection_name: {"texts": [...], "ids": [...], "bm25": BM25Okapi, "point_map": {...}}}
        self._collection_cache: Dict[str, Dict[str, Any]] = {}

    def _tokenize(self, text: str) -> List[str]:
        """
        텍스트를 토큰으로 분리 (한국어 + 영어 지원)

        Args:
            text: 입력 텍스트

        Returns:
            List[str]: 토큰 리스트
        """
        # 소문자 변환
        text = text.lower()
        # 특수문자 제거 (한글, 영문, 숫자만 유지)
        text = re.sub(r'[^\w\s가-힣]', ' ', text)
        # 공백으로 분리
        tokens = text.split()
        # 빈 토큰 제거
        tokens = [t.strip() for t in tokens if t.strip()]
        return tokens

    async def _load_collection_texts(self, collection_name: str) -> None:
        """
        컬렉션의 모든 텍스트를 로드하고 BM25 인덱스 생성

        Args:
            collection_name: Qdrant 컬렉션 이름
        """
        if collection_name in self._collection_cache:
            logger.info(f"[Hybrid] Using cached BM25 index for '{collection_name}'")
            return

        logger.info(f"[Hybrid] Loading texts from collection '{collection_name}' for BM25 indexing")

        texts = []
        ids = []
        point_map = {}  # {point_id: index}

        try:
            offset = None
            while True:
                results, next_offset = await self.qdrant_service.client.scroll(
                    collection_name=collection_name,
                    limit=1000,
                    offset=offset,
                    with_payload=["text"],
                    with_vectors=False
                )

                for point in results:
                    point_id = str(point.id)
                    text = point.payload.get("text", "") if point.payload else ""
                    if text:
                        point_map[point_id] = len(texts)
                        texts.append(text)
                        ids.append(point_id)

                if next_offset is None:
                    break
                offset = next_offset

            if not texts:
                logger.warning(f"[Hybrid] No texts found in collection '{collection_name}'")
                self._collection_cache[collection_name] = {
                    "texts": [],
                    "ids": [],
                    "bm25": None,
                    "point_map": {}
                }
                return

            # 텍스트 토크나이즈
            tokenized_texts = [self._tokenize(t) for t in texts]

            # BM25 인덱스 생성
            bm25 = BM25Okapi(tokenized_texts)

            self._collection_cache[collection_name] = {
                "texts": texts,
                "ids": ids,
                "bm25": bm25,
                "point_map": point_map
            }

            logger.info(f"[Hybrid] BM25 index created for '{collection_name}' with {len(texts)} documents")

        except Exception as e:
            logger.error(f"[Hybrid] Failed to load collection texts: {e}")
            raise

    def _bm25_search(
        self,
        collection_name: str,
        query: str,
        top_k: int
    ) -> List[Tuple[str, float]]:
        """
        BM25 키워드 검색

        Args:
            collection_name: 컬렉션 이름
            query: 검색 쿼리
            top_k: 반환할 결과 수

        Returns:
            List[Tuple[str, float]]: (point_id, score) 리스트
        """
        cache = self._collection_cache.get(collection_name)
        if not cache or not cache.get("bm25"):
            return []

        bm25 = cache["bm25"]
        ids = cache["ids"]

        # 쿼리 토크나이즈
        query_tokens = self._tokenize(query)
        if not query_tokens:
            return []

        # BM25 점수 계산
        scores = bm25.get_scores(query_tokens)

        # 점수와 ID를 함께 정렬
        scored_docs = [(ids[i], scores[i]) for i in range(len(scores))]
        scored_docs.sort(key=lambda x: x[1], reverse=True)

        # top_k 반환
        return scored_docs[:top_k]

    def _rrf_fusion(
        self,
        vector_results: List[Dict[str, Any]],
        bm25_results: List[Tuple[str, float]],
        k: int = 60
    ) -> List[Dict[str, Any]]:
        """
        RRF (Reciprocal Rank Fusion)로 두 검색 결과 병합

        RRF score = sum(1 / (k + rank_i))

        Args:
            vector_results: 벡터 검색 결과 리스트 [{id, score, payload}, ...]
            bm25_results: BM25 검색 결과 [(id, score), ...]
            k: RRF 상수 (기본값 60)

        Returns:
            List[Dict[str, Any]]: 병합된 결과 리스트
        """
        rrf_scores = defaultdict(float)
        doc_data = {}  # {id: {score, payload}}

        # 벡터 검색 결과 처리
        for rank, doc in enumerate(vector_results, 1):
            doc_id = str(doc.get("id", ""))
            rrf_scores[doc_id] += 1.0 / (k + rank)
            doc_data[doc_id] = {
                "id": doc_id,
                "vector_score": doc.get("score", 0),
                "payload": doc.get("payload", {})
            }

        # BM25 검색 결과 처리
        for rank, (doc_id, bm25_score) in enumerate(bm25_results, 1):
            rrf_scores[doc_id] += 1.0 / (k + rank)
            if doc_id not in doc_data:
                # BM25에서만 발견된 문서 (벡터 검색에 없음)
                # 이 경우 payload를 가져와야 함 (캐시에서)
                doc_data[doc_id] = {
                    "id": doc_id,
                    "vector_score": 0,
                    "payload": {}
                }
            doc_data[doc_id]["bm25_score"] = bm25_score

        # RRF 점수로 정렬
        sorted_docs = sorted(rrf_scores.items(), key=lambda x: x[1], reverse=True)

        # 결과 포맷팅
        results = []
        for doc_id, rrf_score in sorted_docs:
            data = doc_data.get(doc_id, {})
            results.append({
                "id": doc_id,
                "score": rrf_score,  # RRF 점수 사용
                "vector_score": data.get("vector_score", 0),
                "bm25_score": data.get("bm25_score", 0),
                "payload": data.get("payload", {})
            })

        return results

    async def hybrid_search(
        self,
        collection_name: str,
        query: str,
        query_vector: List[float],
        top_k: int = 5,
        score_threshold: Optional[float] = None,
        vector_weight: float = 0.7,
        bm25_weight: float = 0.3
    ) -> List[Dict[str, Any]]:
        """
        하이브리드 검색 수행 (벡터 + BM25)

        Args:
            collection_name: Qdrant 컬렉션 이름
            query: 검색 쿼리 텍스트
            query_vector: 쿼리 임베딩 벡터
            top_k: 반환할 결과 수
            score_threshold: 최소 유사도 점수 (벡터 검색용)
            vector_weight: 벡터 검색 가중치
            bm25_weight: BM25 검색 가중치

        Returns:
            List[Dict[str, Any]]: 검색 결과 리스트
        """
        # BM25 인덱스 로드 (캐시된 경우 스킵)
        await self._load_collection_texts(collection_name)

        # 확장된 top_k로 검색 (RRF 병합을 위해)
        expanded_top_k = top_k * 3

        # 1. 벡터 검색
        logger.info(f"[Hybrid] Vector search with top_k={expanded_top_k}")
        vector_results = await self.qdrant_service.search(
            collection_name=collection_name,
            query_vector=query_vector,
            limit=expanded_top_k,
            score_threshold=score_threshold
        )

        # 2. BM25 검색
        logger.info(f"[Hybrid] BM25 search with top_k={expanded_top_k}")
        bm25_results = self._bm25_search(collection_name, query, expanded_top_k)

        # BM25 결과가 없으면 벡터 검색 결과만 반환
        if not bm25_results:
            logger.info(f"[Hybrid] No BM25 results, returning vector results only")
            return vector_results[:top_k]

        # 3. RRF로 결과 병합
        logger.info(f"[Hybrid] Fusing {len(vector_results)} vector + {len(bm25_results)} BM25 results")
        fused_results = self._rrf_fusion(vector_results, bm25_results, k=settings.HYBRID_RRF_K)

        # BM25에서만 발견된 문서의 payload 보완
        cache = self._collection_cache.get(collection_name, {})
        point_map = cache.get("point_map", {})
        texts = cache.get("texts", [])

        for result in fused_results:
            if not result.get("payload"):
                # 캐시에서 텍스트 가져오기
                idx = point_map.get(result["id"])
                if idx is not None and idx < len(texts):
                    result["payload"] = {"text": texts[idx]}

        # top_k 반환
        final_results = fused_results[:top_k]
        logger.info(f"[Hybrid] Returning {len(final_results)} results after fusion")

        return final_results

    def invalidate_cache(self, collection_name: Optional[str] = None) -> None:
        """
        BM25 캐시 무효화

        Args:
            collection_name: 특정 컬렉션만 무효화 (None이면 전체)
        """
        if collection_name:
            if collection_name in self._collection_cache:
                del self._collection_cache[collection_name]
                logger.info(f"[Hybrid] Cache invalidated for '{collection_name}'")
        else:
            self._collection_cache.clear()
            logger.info("[Hybrid] All cache invalidated")
