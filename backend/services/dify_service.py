"""
Dify API 연동 서비스
"""
import logging
from typing import List, Dict, Any
from backend.models.schemas import (
    DifyDatasetListResponse,
    DifyDatasetResponse,
    DifyUploadResult
)
from backend.services.http_client import http_manager

logger = logging.getLogger(__name__)


class DifyService:
    """Dify API와의 통신을 담당하는 서비스"""

    def __init__(self):
        # 싱글톤 HTTP 클라이언트 매니저 사용
        self.client = http_manager.get_client("dify")

    async def get_datasets(
        self,
        api_key: str,
        base_url: str,
        page: int = 1,
        limit: int = 20
    ) -> DifyDatasetListResponse:
        """
        Dify 데이터셋 목록 조회

        Args:
            api_key: Dify API 키
            base_url: Dify API 기본 URL
            page: 페이지 번호
            limit: 페이지당 항목 수

        Returns:
            DifyDatasetListResponse: 데이터셋 목록

        Raises:
            httpx.HTTPStatusError: API 호출 실패 시
        """
        url = f"{base_url}/datasets"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        params = {
            "page": page,
            "limit": limit
        }

        try:
            response = await self.client.get(url, headers=headers, params=params)
            logger.debug(f"Dify API Status Code: {response.status_code}")
            logger.debug(f"Dify API URL: {url}")

            response.raise_for_status()

            data = response.json()

            # 디버깅: 실제 응답 로깅
            logger.debug(f"Dify API Response Keys: {data.keys() if isinstance(data, dict) else 'Not a dict'}")

            # 응답 데이터를 Pydantic 모델로 변환
            try:
                result = DifyDatasetListResponse(**data)
                logger.debug(f"Successfully parsed {len(result.data)} datasets")
                return result
            except Exception as parse_error:
                logger.error(f"Pydantic Validation Error: {parse_error}")
                logger.error("Failed field validation. Checking each dataset...")

                # 각 데이터셋을 개별적으로 확인
                if isinstance(data, dict) and 'data' in data:
                    for idx, dataset in enumerate(data['data']):
                        logger.debug(f"Dataset {idx}: {dataset}")
                        try:
                            DifyDatasetResponse(**dataset)
                            logger.debug(f"Dataset {idx} validation OK")
                        except Exception as dataset_error:
                            logger.error(f"Dataset {idx} validation failed: {dataset_error}")

                raise parse_error

        except Exception as e:
            logger.error(f"Dify API Exception: {type(e).__name__} - {str(e)}")
            raise

    async def upload_document_to_dataset(
        self,
        api_key: str,
        base_url: str,
        dataset_id: str,
        document_name: str,
        document_text: str
    ) -> Dict[str, Any]:
        """
        Dify 데이터셋에 문서 업로드

        Args:
            api_key: Dify API 키
            base_url: Dify API 기본 URL
            dataset_id: 데이터셋 ID
            document_name: 문서 이름
            document_text: 문서 내용 (마크다운 텍스트)

        Returns:
            Dict: Dify API 응답 (document_id 포함)

        Raises:
            httpx.HTTPStatusError: API 호출 실패 시
        """
        url = f"{base_url}/datasets/{dataset_id}/document/create_by_text"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "name": document_name,
            "text": document_text,
            "indexing_technique": "high_quality",
            "process_rule": {
                "mode": "automatic"
            }
        }

        response = await self.client.post(url, headers=headers, json=payload)
        response.raise_for_status()

        return response.json()

    async def close(self):
        """
        HTTP 클라이언트 종료

        Note: HTTP 클라이언트 매니저가 관리하므로 개별 종료 불필요
        앱 종료 시 http_manager.close_all()에서 일괄 처리됨
        """
        pass  # HTTP 클라이언트 매니저에서 관리
