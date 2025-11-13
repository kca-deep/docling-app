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

                result.append(
                    QdrantCollectionInfo(
                        name=collection.name,
                        vectors_count=collection_info.vectors_count or 0,
                        points_count=collection_info.points_count or 0,
                        vector_size=vector_size,
                        distance=distance
                    )
                )

            return result

        except Exception as e:
            print(f"[ERROR] Failed to get collections from Qdrant: {e}")
            raise Exception(f"Qdrant collection 조회 실패: {str(e)}")

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
            # Qdrant 검색 수행
            search_results = await self.client.search(
                collection_name=collection_name,
                query_vector=query_vector,
                limit=limit,
                score_threshold=score_threshold,
                with_payload=True,
                with_vectors=False
            )

            # 결과 포맷팅
            results = []
            for result in search_results:
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

    async def close(self):
        """클라이언트 연결 종료"""
        await self.client.close()
