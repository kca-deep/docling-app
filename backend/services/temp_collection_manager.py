"""
Qdrant 임시 컬렉션 관리 서비스
- 컬렉션명: temp_{session_id}_{unix_timestamp}
- TTL 기반 자동 정리
"""
import time
import logging
from typing import List, Dict, Optional, Any

from backend.services.qdrant_service import QdrantService
from backend.config.settings import settings

logger = logging.getLogger(__name__)


class TempCollectionManager:
    """Qdrant 임시 컬렉션 관리자"""

    COLLECTION_PREFIX = "temp_"

    def __init__(self, qdrant_service: QdrantService):
        self.qdrant_service = qdrant_service

    def generate_collection_name(self, session_id: str) -> str:
        """
        임시 컬렉션명 생성: temp_{session_id}_{timestamp}

        Args:
            session_id: 세션 ID

        Returns:
            str: 생성된 컬렉션명
        """
        timestamp = int(time.time())
        return f"{self.COLLECTION_PREFIX}{session_id}_{timestamp}"

    def parse_timestamp(self, collection_name: str) -> Optional[int]:
        """
        컬렉션명에서 타임스탬프 파싱

        Args:
            collection_name: 컬렉션명

        Returns:
            Optional[int]: 타임스탬프 (파싱 실패 시 None)
        """
        if not collection_name.startswith(self.COLLECTION_PREFIX):
            return None
        try:
            parts = collection_name.split("_")
            return int(parts[-1])
        except (ValueError, IndexError):
            return None

    def is_expired(self, collection_name: str, ttl_minutes: int = 60) -> bool:
        """
        컬렉션 만료 여부 확인

        Args:
            collection_name: 컬렉션명
            ttl_minutes: TTL (분)

        Returns:
            bool: 만료 여부
        """
        timestamp = self.parse_timestamp(collection_name)
        if timestamp is None:
            return False
        age_seconds = time.time() - timestamp
        return age_seconds > (ttl_minutes * 60)

    async def create_collection(self, session_id: str, max_retries: int = 3) -> str:
        """
        임시 컬렉션 생성 (실패 시 재시도)

        Args:
            session_id: 세션 ID
            max_retries: 최대 재시도 횟수

        Returns:
            str: 생성된 컬렉션명

        Raises:
            Exception: 모든 재시도 실패 시
        """
        last_error = None

        for attempt in range(max_retries):
            collection_name = self.generate_collection_name(session_id)

            try:
                # 1. 기존 컬렉션이 있으면 삭제 시도 (손상된 컬렉션 정리)
                try:
                    exists = await self.qdrant_service.collection_exists(collection_name)
                    if exists:
                        logger.warning(f"Temp collection already exists, deleting: {collection_name}")
                        await self.qdrant_service.delete_collection(collection_name)
                except Exception as e:
                    logger.warning(f"Failed to check/delete existing collection: {e}")

                # 2. 컬렉션 생성
                await self.qdrant_service.create_collection(
                    collection_name=collection_name,
                    vector_size=settings.EMBEDDING_DIMENSION,
                    distance="Cosine"
                )

                logger.info(f"Created temp collection: {collection_name}")
                return collection_name

            except Exception as e:
                last_error = e
                logger.warning(f"Failed to create temp collection (attempt {attempt + 1}/{max_retries}): {e}")

                # 손상된 컬렉션 강제 삭제 시도
                try:
                    await self.qdrant_service.delete_collection(collection_name)
                except Exception:
                    pass

                # 다음 시도 전 잠시 대기 (다른 타임스탬프 생성)
                if attempt < max_retries - 1:
                    import asyncio
                    await asyncio.sleep(1)

        raise Exception(f"Collection 생성 실패 ({max_retries}회 시도): {last_error}")

    async def add_documents(
        self,
        collection_name: str,
        chunks: List[str],
        embeddings: List[List[float]],
        metadata: List[Dict[str, Any]]
    ) -> int:
        """
        임시 컬렉션에 문서 추가

        Args:
            collection_name: 컬렉션명
            chunks: 청크 텍스트 리스트
            embeddings: 임베딩 벡터 리스트
            metadata: 메타데이터 리스트

        Returns:
            int: 추가된 문서 수
        """
        await self.qdrant_service.upsert_vectors(
            collection_name=collection_name,
            vectors=embeddings,
            texts=chunks,
            metadata_list=metadata
        )

        logger.info(f"Added {len(chunks)} chunks to temp collection: {collection_name}")
        return len(chunks)

    async def search(
        self,
        collection_name: str,
        query_embedding: List[float],
        top_k: int = 5,
        score_threshold: Optional[float] = None
    ) -> List[Dict[str, Any]]:
        """
        임시 컬렉션에서 검색

        Args:
            collection_name: 컬렉션명
            query_embedding: 쿼리 임베딩 벡터
            top_k: 반환할 최대 결과 수
            score_threshold: 최소 유사도 점수

        Returns:
            List[Dict]: 검색 결과
        """
        results = await self.qdrant_service.search(
            collection_name=collection_name,
            query_vector=query_embedding,
            limit=top_k,
            score_threshold=score_threshold
        )
        return results

    async def delete_collection(self, collection_name: str) -> bool:
        """
        임시 컬렉션 삭제

        Args:
            collection_name: 컬렉션명

        Returns:
            bool: 삭제 성공 여부
        """
        try:
            await self.qdrant_service.delete_collection(collection_name)
            logger.info(f"Deleted temp collection: {collection_name}")
            return True
        except Exception as e:
            logger.error(f"Failed to delete temp collection {collection_name}: {e}")
            return False

    async def cleanup_expired(self, ttl_minutes: int = 60) -> int:
        """
        만료된 임시 컬렉션 정리

        Args:
            ttl_minutes: TTL (분)

        Returns:
            int: 삭제된 컬렉션 수
        """
        try:
            collections = await self.qdrant_service.get_collections()
            deleted_count = 0

            for col_info in collections:
                col_name = col_info.name
                if col_name.startswith(self.COLLECTION_PREFIX):
                    if self.is_expired(col_name, ttl_minutes):
                        success = await self.delete_collection(col_name)
                        if success:
                            deleted_count += 1

            if deleted_count > 0:
                logger.info(f"Cleaned up {deleted_count} expired temp collections")

            return deleted_count
        except Exception as e:
            logger.error(f"Failed to cleanup expired temp collections: {e}")
            return 0

    async def list_temp_collections(self) -> List[Dict[str, Any]]:
        """
        모든 임시 컬렉션 목록 조회 (디버깅용)

        Returns:
            List[Dict]: 임시 컬렉션 정보 리스트
        """
        try:
            collections = await self.qdrant_service.get_collections()
            temp_collections = []

            for col_info in collections:
                col_name = col_info.name
                if col_name.startswith(self.COLLECTION_PREFIX):
                    timestamp = self.parse_timestamp(col_name)
                    if timestamp:
                        age_minutes = (time.time() - timestamp) / 60
                        temp_collections.append({
                            "name": col_name,
                            "created_at": timestamp,
                            "age_minutes": round(age_minutes, 1),
                            "points_count": col_info.points_count
                        })

            return temp_collections
        except Exception as e:
            logger.error(f"Failed to list temp collections: {e}")
            return []


# 싱글톤 인스턴스
_temp_collection_manager: Optional[TempCollectionManager] = None


def get_temp_collection_manager() -> TempCollectionManager:
    """
    TempCollectionManager 싱글톤 반환

    Returns:
        TempCollectionManager: 관리자 인스턴스
    """
    global _temp_collection_manager
    if _temp_collection_manager is None:
        qdrant_service = QdrantService(
            url=settings.QDRANT_URL,
            api_key=settings.QDRANT_API_KEY
        )
        _temp_collection_manager = TempCollectionManager(qdrant_service)
    return _temp_collection_manager
