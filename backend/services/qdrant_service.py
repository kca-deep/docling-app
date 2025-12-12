"""
Qdrant Vector DB 연동 서비스
"""
from typing import List, Optional, Dict, Any
import uuid
from qdrant_client import AsyncQdrantClient, models
from qdrant_client.http.exceptions import UnexpectedResponse
from backend.models.schemas import QdrantCollectionInfo


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

    async def get_collections(self) -> List[QdrantCollectionInfo]:
        """
        모든 Collection 목록 조회

        Returns:
            List[QdrantCollectionInfo]: Collection 정보 리스트

        Raises:
            Exception: Qdrant API 호출 실패 시
        """
        try:
            # Qdrant에서 모든 collection 정보 가져오기
            collections = await self.client.get_collections()

            result = []
            for collection in collections.collections:
                # 각 collection의 상세 정보 조회
                collection_info = await self.client.get_collection(collection.name)

                # Distance metric 추출
                distance_map = {
                    models.Distance.COSINE: "Cosine",
                    models.Distance.EUCLID: "Euclidean",
                    models.Distance.DOT: "Dot"
                }

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

                # 고유 문서 수 집계 (document_id 메타데이터 기반)
                documents_count = await self._count_unique_documents(collection.name)

                result.append(
                    QdrantCollectionInfo(
                        name=collection.name,
                        documents_count=documents_count,
                        points_count=points,
                        vector_size=vector_size,
                        distance=distance
                    )
                )

            return result

        except Exception as e:
            print(f"[ERROR] Failed to get collections from Qdrant: {e}")
            raise Exception(f"Qdrant collection 조회 실패: {str(e)}")

    async def _count_unique_documents(self, collection_name: str) -> int:
        """
        컬렉션 내 고유 문서 수 집계

        Args:
            collection_name: Collection 이름

        Returns:
            int: 고유 문서 수
        """
        try:
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

        except Exception as e:
            print(f"[WARN] Failed to count unique documents in '{collection_name}': {e}")
            return 0  # 실패 시 0 반환

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

            print(f"[INFO] Successfully created collection: {collection_name}")
            return True

        except Exception as e:
            print(f"[ERROR] Failed to create collection: {e}")
            raise Exception(f"Collection 생성 실패: {str(e)}")

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
            print(f"[ERROR] Failed to check collection existence: {e}")
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

            print(f"[INFO] Successfully deleted collection: {collection_name}")
            return True

        except Exception as e:
            print(f"[ERROR] Failed to delete collection: {e}")
            raise Exception(f"Collection 삭제 실패: {str(e)}")

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

            print(f"[INFO] Successfully upserted {len(points)} vectors to collection '{collection_name}'")
            return vector_ids

        except Exception as e:
            print(f"[ERROR] Failed to upsert vectors: {e}")
            raise Exception(f"벡터 업로드 실패: {str(e)}")

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

            print(f"[INFO] Found {len(results)} results in collection '{collection_name}'")
            return results

        except Exception as e:
            print(f"[ERROR] Failed to search vectors: {e}")
            raise Exception(f"벡터 검색 실패: {str(e)}")

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
            - source_file: str (Excel의 경우)
        """
        try:
            documents = {}
            offset = None

            while True:
                results, next_offset = await self.client.scroll(
                    collection_name=collection_name,
                    limit=1000,
                    offset=offset,
                    with_payload=["document_id", "filename", "source_file"],
                    with_vectors=False
                )

                for point in results:
                    payload = point.payload or {}
                    doc_id = payload.get("document_id")

                    # document_id가 없는 경우 source_file로 그룹핑 (Excel 데이터)
                    if doc_id is None:
                        source = payload.get("source_file", "unknown")
                        key = f"excel:{source}"
                        source_type = "excel"
                    else:
                        key = f"doc:{doc_id}"
                        source_type = "document"

                    if key not in documents:
                        documents[key] = {
                            "document_id": doc_id,
                            "filename": payload.get("filename") or payload.get("source_file", "Unknown"),
                            "chunk_count": 0,
                            "source_type": source_type,
                            "source_file": payload.get("source_file")
                        }
                    documents[key]["chunk_count"] += 1

                if next_offset is None:
                    break
                offset = next_offset

            return list(documents.values())

        except Exception as e:
            print(f"[ERROR] Failed to get documents in collection '{collection_name}': {e}")
            raise Exception(f"문서 목록 조회 실패: {str(e)}")

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
            print(f"[WARN] Failed to count points for document_id {document_id}: {e}")
            return 0

    async def _count_points_by_source_file(
        self,
        collection_name: str,
        source_file: str
    ) -> int:
        """
        source_file 기준 포인트 수 조회

        Args:
            collection_name: Collection 이름
            source_file: 소스 파일명

        Returns:
            int: 포인트 수
        """
        try:
            count_result = await self.client.count(
                collection_name=collection_name,
                count_filter=models.Filter(
                    must=[
                        models.FieldCondition(
                            key="source_file",
                            match=models.MatchValue(value=source_file)
                        )
                    ]
                )
            )
            return count_result.count
        except Exception as e:
            print(f"[WARN] Failed to count points for source_file {source_file}: {e}")
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
                print(f"[INFO] No points found for document_id {document_id}")
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

            print(f"[INFO] Deleted {count_before} points for document_id {document_id} from '{collection_name}'")
            return count_before

        except Exception as e:
            print(f"[ERROR] Failed to delete points for document_id {document_id}: {e}")
            raise Exception(f"문서 포인트 삭제 실패: {str(e)}")

    async def delete_excel_points(
        self,
        collection_name: str,
        source_file: str
    ) -> int:
        """
        source_file로 해당 Excel 데이터의 모든 포인트 삭제

        Args:
            collection_name: Collection 이름
            source_file: 삭제할 Excel 파일명

        Returns:
            int: 삭제된 포인트 수
        """
        try:
            # 삭제 전 포인트 수 확인
            count_before = await self._count_points_by_source_file(collection_name, source_file)

            if count_before == 0:
                print(f"[INFO] No points found for source_file {source_file}")
                return 0

            # 필터 기반 삭제
            await self.client.delete(
                collection_name=collection_name,
                points_selector=models.FilterSelector(
                    filter=models.Filter(
                        must=[
                            models.FieldCondition(
                                key="source_file",
                                match=models.MatchValue(value=source_file)
                            )
                        ]
                    )
                )
            )

            print(f"[INFO] Deleted {count_before} points for source_file '{source_file}' from '{collection_name}'")
            return count_before

        except Exception as e:
            print(f"[ERROR] Failed to delete points for source_file {source_file}: {e}")
            raise Exception(f"Excel 포인트 삭제 실패: {str(e)}")

    async def close(self):
        """클라이언트 연결 종료"""
        await self.client.close()
