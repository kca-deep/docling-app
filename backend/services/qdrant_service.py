"""
Qdrant Vector DB 연동 서비스
"""
import asyncio
import logging
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any, Tuple
import uuid
from qdrant_client import AsyncQdrantClient, models
from qdrant_client.http.exceptions import UnexpectedResponse
from backend.models.schemas import QdrantCollectionInfo
from backend.exceptions import QdrantServiceError

# 로거 설정
logger = logging.getLogger(__name__)

# 캐시 TTL 설정 (5분)
CACHE_TTL = timedelta(minutes=5)


class QdrantService:
    """Qdrant Vector DB와의 통신을 담당하는 서비스"""

    def __init__(self, url: str, api_key: Optional[str] = None):
        """
        QdrantService 초기화

        Args:
            url: Qdrant 서버 URL
            api_key: Qdrant API 키 (선택사항)
        """
        self.url = url
        self.api_key = api_key
        self.client = AsyncQdrantClient(
            url=url,
            api_key=api_key,
            timeout=30.0
        )
        # 문서 수 캐시: {collection_name: (count, expires_at)}
        self._doc_count_cache: Dict[str, Tuple[int, datetime]] = {}

    async def get_collections(self) -> List[QdrantCollectionInfo]:
        """
        모든 Collection 목록 조회 (병렬 처리로 최적화)

        Returns:
            List[QdrantCollectionInfo]: Collection 정보 리스트

        Raises:
            Exception: Qdrant API 호출 실패 시
        """
        try:
            # Qdrant에서 모든 collection 정보 가져오기
            collections = await self.client.get_collections()

            if not collections.collections:
                return []

            # 각 컬렉션 정보를 병렬로 조회
            tasks = [
                self._get_collection_info(collection.name)
                for collection in collections.collections
            ]
            results = await asyncio.gather(*tasks, return_exceptions=True)

            # 성공한 결과만 반환 (예외 발생한 컬렉션은 제외)
            collection_infos = []
            for result in results:
                if isinstance(result, QdrantCollectionInfo):
                    collection_infos.append(result)
                elif isinstance(result, Exception):
                    logger.warning(f"Failed to get collection info: {result}")

            return collection_infos

        except Exception as e:
            logger.error(f"Failed to get collections from Qdrant: {e}")
            raise QdrantServiceError(f"Qdrant collection 조회 실패: {str(e)}") from e

    async def _get_collection_info(self, collection_name: str) -> QdrantCollectionInfo:
        """
        개별 컬렉션의 상세 정보 조회 (병렬 처리용 헬퍼)

        Args:
            collection_name: 컬렉션 이름

        Returns:
            QdrantCollectionInfo: 컬렉션 정보
        """
        # Distance metric 매핑
        distance_map = {
            models.Distance.COSINE: "Cosine",
            models.Distance.EUCLID: "Euclidean",
            models.Distance.DOT: "Dot"
        }

        # 컬렉션 상세 정보와 문서 수를 병렬로 조회
        collection_info, documents_count = await asyncio.gather(
            self.client.get_collection(collection_name),
            self._count_unique_documents(collection_name)
        )

        # vectors_config에서 정보 추출
        vector_config = collection_info.config.params.vectors

        # VectorParams인 경우 (단일 벡터)
        if isinstance(vector_config, models.VectorParams):
            vector_size = vector_config.size
            distance = distance_map.get(vector_config.distance, "Unknown")
        else:
            # 여러 벡터 설정이 있는 경우 (named vectors)
            # 첫 번째 벡터 설정 사용
            first_vector = next(iter(vector_config.values()))
            vector_size = first_vector.size
            distance = distance_map.get(first_vector.distance, "Unknown")

        points = collection_info.points_count or 0

        return QdrantCollectionInfo(
            name=collection_name,
            documents_count=documents_count,
            points_count=points,
            vector_size=vector_size,
            distance=distance
        )

    async def _count_unique_documents(self, collection_name: str) -> int:
        """
        컬렉션 내 고유 문서 수 집계 (TTL 캐싱 적용)

        [P0-3] Qdrant facet API 사용으로 효율화
        - 기존: scroll로 모든 포인트 순회 (O(n))
        - 개선: facet API로 서버 측 집계 (O(1) 네트워크 호출)

        Args:
            collection_name: Collection 이름

        Returns:
            int: 고유 문서 수
        """
        try:
            # 캐시 확인
            cached = self._doc_count_cache.get(collection_name)
            if cached:
                count, expires_at = cached
                if datetime.now() < expires_at:
                    return count

            # 캐시 미스 또는 만료: 새로 계산
            count = await self._count_unique_documents_facet(collection_name)

            # 캐시 업데이트
            self._doc_count_cache[collection_name] = (count, datetime.now() + CACHE_TTL)

            return count

        except Exception as e:
            logger.warning(f"Failed to count unique documents in '{collection_name}': {e}")
            return 0  # 실패 시 0 반환

    async def _count_unique_documents_facet(self, collection_name: str) -> int:
        """
        Qdrant facet API를 사용하여 고유 문서 수 계산

        Args:
            collection_name: Collection 이름

        Returns:
            int: 고유 문서 수
        """
        try:
            # facet API로 document_id 고유값 집계
            result = await self.client.facet(
                collection_name=collection_name,
                key="document_id",
                exact=True,
                limit=100000  # 충분히 큰 값 (실제 문서 수보다 크게)
            )
            return len(result.hits)
        except Exception as e:
            # facet API 실패 시 scroll 방식으로 fallback
            logger.debug(f"Facet API failed for '{collection_name}', falling back to scroll: {e}")
            return await self._count_unique_documents_scroll(collection_name)

    async def _count_unique_documents_scroll(self, collection_name: str) -> int:
        """
        scroll API를 사용하여 고유 문서 수 계산 (fallback)

        Args:
            collection_name: Collection 이름

        Returns:
            int: 고유 문서 수
        """
        unique_doc_ids = set()
        offset = None

        # scroll API로 모든 포인트의 document_id를 수집
        while True:
            results, next_offset = await self.client.scroll(
                collection_name=collection_name,
                limit=1000,
                offset=offset,
                with_payload=["document_id"],  # document_id만 가져오기
                with_vectors=False
            )

            for point in results:
                if point.payload and "document_id" in point.payload:
                    unique_doc_ids.add(point.payload["document_id"])

            if next_offset is None:
                break
            offset = next_offset

        return len(unique_doc_ids)

    def invalidate_cache(self, collection_name: Optional[str] = None) -> None:
        """
        캐시 무효화

        Args:
            collection_name: 특정 컬렉션만 무효화 (None이면 전체)
        """
        if collection_name:
            self._doc_count_cache.pop(collection_name, None)
        else:
            self._doc_count_cache.clear()

    async def create_collection(
        self,
        collection_name: str,
        vector_size: int = 1024,
        distance: str = "Cosine"
    ) -> bool:
        """
        새로운 Collection 생성

        Args:
            collection_name: 생성할 Collection 이름
            vector_size: 벡터 차원 수
            distance: Distance metric ("Cosine", "Euclidean", "Dot")

        Returns:
            bool: 생성 성공 여부

        Raises:
            Exception: Collection 생성 실패 시
        """
        try:
            # Distance 문자열을 qdrant-client의 Distance enum으로 변환
            distance_map = {
                "Cosine": models.Distance.COSINE,
                "Euclidean": models.Distance.EUCLID,
                "Dot": models.Distance.DOT
            }

            if distance not in distance_map:
                raise ValueError(f"Invalid distance metric: {distance}. Must be one of: Cosine, Euclidean, Dot")

            qdrant_distance = distance_map[distance]

            # Collection이 이미 존재하는지 확인
            exists = await self.client.collection_exists(collection_name)
            if exists:
                raise Exception(f"Collection '{collection_name}'이 이미 존재합니다")

            # Collection 생성
            await self.client.create_collection(
                collection_name=collection_name,
                vectors_config=models.VectorParams(
                    size=vector_size,
                    distance=qdrant_distance
                )
            )

            # [P0-3] Facet API 지원을 위한 document_id 인덱스 자동 생성
            try:
                await self.client.create_payload_index(
                    collection_name=collection_name,
                    field_name="document_id",
                    field_schema=models.PayloadSchemaType.INTEGER,
                    field_index_params=models.IntegerIndexParams(
                        type=models.IntegerIndexType.INTEGER,
                        lookup=True,  # Facet API 지원의 핵심
                        range=False
                    )
                )
                logger.info(f"Created document_id index for facet support: {collection_name}")
            except Exception as idx_err:
                logger.warning(f"Failed to create document_id index (non-critical): {idx_err}")

            logger.info(f"Successfully created collection: {collection_name}")
            return True

        except Exception as e:
            logger.error(f"Failed to create collection: {e}")
            raise QdrantServiceError(f"Collection 생성 실패: {str(e)}") from e

    async def collection_exists(self, collection_name: str) -> bool:
        """
        Collection 존재 여부 확인

        Args:
            collection_name: 확인할 Collection 이름

        Returns:
            bool: 존재 여부
        """
        try:
            return await self.client.collection_exists(collection_name)
        except Exception as e:
            logger.error(f"Failed to check collection existence: {e}")
            return False

    async def delete_collection(self, collection_name: str) -> bool:
        """
        Collection 삭제

        Args:
            collection_name: 삭제할 Collection 이름

        Returns:
            bool: 삭제 성공 여부

        Raises:
            Exception: Collection 삭제 실패 시
        """
        try:
            # Collection 존재 여부 확인
            exists = await self.client.collection_exists(collection_name)
            if not exists:
                raise Exception(f"Collection '{collection_name}'이 존재하지 않습니다")

            # Collection 삭제
            await self.client.delete_collection(collection_name=collection_name)

            logger.info(f"Successfully deleted collection: {collection_name}")
            return True

        except Exception as e:
            logger.error(f"Failed to delete collection: {e}")
            raise QdrantServiceError(f"Collection 삭제 실패: {str(e)}") from e

    async def upsert_vectors(
        self,
        collection_name: str,
        vectors: List[List[float]],
        texts: List[str],
        metadata_list: List[Dict[str, Any]]
    ) -> List[str]:
        """
        벡터를 Qdrant에 업로드

        Args:
            collection_name: Collection 이름
            vectors: 임베딩 벡터 리스트
            texts: 원본 텍스트 리스트
            metadata_list: 메타데이터 리스트

        Returns:
            List[str]: 생성된 벡터 ID 리스트

        Raises:
            Exception: 업로드 실패 시
        """
        try:
            if len(vectors) != len(texts) or len(vectors) != len(metadata_list):
                raise ValueError("vectors, texts, metadata_list의 길이가 동일해야 합니다")

            # UUID 생성
            vector_ids = [str(uuid.uuid4()) for _ in range(len(vectors))]

            # PointStruct 생성
            points = []
            for i, (vector, text, metadata) in enumerate(zip(vectors, texts, metadata_list)):
                # 메타데이터에 텍스트 추가
                payload = {
                    **metadata,
                    "text": text
                }

                points.append(
                    models.PointStruct(
                        id=vector_ids[i],
                        vector=vector,
                        payload=payload
                    )
                )

            # Qdrant에 upsert
            await self.client.upsert(
                collection_name=collection_name,
                points=points,
                wait=True
            )

            logger.info(f"Successfully upserted {len(points)} vectors to collection '{collection_name}'")
            return vector_ids

        except Exception as e:
            logger.error(f"Failed to upsert vectors: {e}")
            raise QdrantServiceError(f"벡터 업로드 실패: {str(e)}") from e

    async def search(
        self,
        collection_name: str,
        query_vector: List[float],
        limit: int = 5,
        score_threshold: Optional[float] = None
    ) -> List[Dict[str, Any]]:
        """
        벡터 유사도 검색

        Args:
            collection_name: Collection 이름
            query_vector: 검색 쿼리 벡터
            limit: 반환할 최대 결과 수
            score_threshold: 최소 유사도 점수 (None이면 제한 없음)

        Returns:
            List[Dict[str, Any]]: 검색 결과 리스트
                - id: 벡터 ID
                - score: 유사도 점수
                - payload: 메타데이터 (text 포함)

        Raises:
            Exception: 검색 실패 시
        """
        try:
            # Qdrant 검색 수행 (qdrant-client 1.16+에서는 query_points 사용)
            search_response = await self.client.query_points(
                collection_name=collection_name,
                query=query_vector,
                limit=limit,
                score_threshold=score_threshold,
                with_payload=True,
            )

            # 결과 포맷팅
            results = []
            for result in search_response.points:
                results.append({
                    "id": result.id,
                    "score": result.score,
                    "payload": result.payload
                })

            logger.info(f"Found {len(results)} results in collection '{collection_name}'")
            return results

        except Exception as e:
            logger.error(f"Failed to search vectors: {e}")
            raise QdrantServiceError(f"벡터 검색 실패: {str(e)}") from e

    async def get_documents_in_collection(
        self,
        collection_name: str
    ) -> List[Dict[str, Any]]:
        """
        컬렉션 내 문서 목록 조회 (document_id 기준 그룹핑)

        Args:
            collection_name: Collection 이름

        Returns:
            List[Dict]: 문서 정보 리스트
            - document_id: int (일반 문서) 또는 None (Excel)
            - filename: str
            - chunk_count: int
            - source_type: str ("document" or "excel")
        """
        try:
            documents = {}
            offset = None

            while True:
                results, next_offset = await self.client.scroll(
                    collection_name=collection_name,
                    limit=1000,
                    offset=offset,
                    # filename 통일, source_file은 하위호환용
                    with_payload=["document_id", "filename", "source_file"],
                    with_vectors=False
                )

                for point in results:
                    payload = point.payload or {}
                    doc_id = payload.get("document_id")
                    # filename 우선, 없으면 source_file (하위호환)
                    file_name = payload.get("filename") or payload.get("source_file", "unknown")

                    # document_id가 없는 경우 filename으로 그룹핑 (Excel 데이터)
                    if doc_id is None:
                        key = f"excel:{file_name}"
                        source_type = "excel"
                    else:
                        key = f"doc:{doc_id}"
                        source_type = "document"

                    if key not in documents:
                        documents[key] = {
                            "document_id": doc_id,
                            "filename": file_name,
                            "chunk_count": 0,
                            "source_type": source_type
                        }
                    documents[key]["chunk_count"] += 1

                if next_offset is None:
                    break
                offset = next_offset

            return list(documents.values())

        except Exception as e:
            logger.error(f"Failed to get documents in collection '{collection_name}': {e}")
            raise QdrantServiceError(f"문서 목록 조회 실패: {str(e)}") from e

    async def _count_points_by_document_id(
        self,
        collection_name: str,
        document_id: int
    ) -> int:
        """
        document_id 기준 포인트 수 조회

        Args:
            collection_name: Collection 이름
            document_id: 문서 ID

        Returns:
            int: 포인트 수
        """
        try:
            count_result = await self.client.count(
                collection_name=collection_name,
                count_filter=models.Filter(
                    must=[
                        models.FieldCondition(
                            key="document_id",
                            match=models.MatchValue(value=document_id)
                        )
                    ]
                )
            )
            return count_result.count
        except Exception as e:
            logger.warning(f"Failed to count points for document_id {document_id}: {e}")
            return 0

    async def _count_points_by_filename(
        self,
        collection_name: str,
        filename: str
    ) -> int:
        """
        filename 기준 포인트 수 조회 (source_file 하위호환 포함)

        Args:
            collection_name: Collection 이름
            filename: 파일명

        Returns:
            int: 포인트 수
        """
        try:
            # filename 또는 source_file(하위호환)로 검색
            count_result = await self.client.count(
                collection_name=collection_name,
                count_filter=models.Filter(
                    should=[
                        models.FieldCondition(
                            key="filename",
                            match=models.MatchValue(value=filename)
                        ),
                        models.FieldCondition(
                            key="source_file",
                            match=models.MatchValue(value=filename)
                        )
                    ]
                )
            )
            return count_result.count
        except Exception as e:
            logger.warning(f"Failed to count points for filename {filename}: {e}")
            return 0

    async def delete_document_points(
        self,
        collection_name: str,
        document_id: int
    ) -> int:
        """
        document_id로 해당 문서의 모든 포인트 삭제

        Args:
            collection_name: Collection 이름
            document_id: 삭제할 문서 ID

        Returns:
            int: 삭제된 포인트 수
        """
        try:
            # 삭제 전 포인트 수 확인
            count_before = await self._count_points_by_document_id(collection_name, document_id)

            if count_before == 0:
                logger.info(f"No points found for document_id {document_id}")
                return 0

            # 필터 기반 삭제
            await self.client.delete(
                collection_name=collection_name,
                points_selector=models.FilterSelector(
                    filter=models.Filter(
                        must=[
                            models.FieldCondition(
                                key="document_id",
                                match=models.MatchValue(value=document_id)
                            )
                        ]
                    )
                )
            )

            logger.info(f"Deleted {count_before} points for document_id {document_id} from '{collection_name}'")
            return count_before

        except Exception as e:
            logger.error(f"Failed to delete points for document_id {document_id}: {e}")
            raise QdrantServiceError(f"문서 포인트 삭제 실패: {str(e)}") from e

    async def delete_excel_points(
        self,
        collection_name: str,
        filename: str
    ) -> int:
        """
        filename으로 해당 Excel 데이터의 모든 포인트 삭제 (source_file 하위호환)

        Args:
            collection_name: Collection 이름
            filename: 삭제할 Excel 파일명

        Returns:
            int: 삭제된 포인트 수
        """
        try:
            # 삭제 전 포인트 수 확인
            count_before = await self._count_points_by_filename(collection_name, filename)

            if count_before == 0:
                logger.info(f"No points found for filename {filename}")
                return 0

            # 필터 기반 삭제 (filename 또는 source_file 하위호환)
            await self.client.delete(
                collection_name=collection_name,
                points_selector=models.FilterSelector(
                    filter=models.Filter(
                        should=[
                            models.FieldCondition(
                                key="filename",
                                match=models.MatchValue(value=filename)
                            ),
                            models.FieldCondition(
                                key="source_file",
                                match=models.MatchValue(value=filename)
                            )
                        ]
                    )
                )
            )

            logger.info(f"Deleted {count_before} points for filename '{filename}' from '{collection_name}'")
            return count_before

        except Exception as e:
            logger.error(f"Failed to delete points for filename {filename}: {e}")
            raise QdrantServiceError(f"Excel 포인트 삭제 실패: {str(e)}") from e

    async def close(self):
        """클라이언트 연결 종료"""
        await self.client.close()


# 싱글톤 인스턴스 (모듈 로드 시 1회 생성)
from backend.config.settings import settings

qdrant_service = QdrantService(
    url=settings.QDRANT_URL,
    api_key=settings.QDRANT_API_KEY
)
