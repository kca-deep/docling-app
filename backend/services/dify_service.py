"""
Dify API 연동 서비스
"""
import httpx
from typing import List, Dict, Any
from backend.models.schemas import (
    DifyDatasetListResponse,
    DifyDatasetResponse,
    DifyUploadResult
)


class DifyService:
    """Dify API와의 통신을 담당하는 서비스"""

    def __init__(self):
        self.client = httpx.AsyncClient(timeout=30.0)

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
            print(f"[DEBUG] Dify API Status Code: {response.status_code}")
            print(f"[DEBUG] Dify API URL: {url}")

            response.raise_for_status()

            data = response.json()

            # 디버깅: 실제 응답 로깅
            print(f"[DEBUG] Dify API Response Keys: {data.keys() if isinstance(data, dict) else 'Not a dict'}")
            print(f"[DEBUG] Dify API Response: {data}")

            # 응답 데이터를 Pydantic 모델로 변환
            try:
                result = DifyDatasetListResponse(**data)
                print(f"[DEBUG] Successfully parsed {len(result.data)} datasets")
                return result
            except Exception as parse_error:
                print(f"[ERROR] Pydantic Validation Error: {parse_error}")
                print(f"[ERROR] Failed field validation. Checking each dataset...")

                # 각 데이터셋을 개별적으로 확인
                if isinstance(data, dict) and 'data' in data:
                    for idx, dataset in enumerate(data['data']):
                        print(f"[DEBUG] Dataset {idx}: {dataset}")
                        try:
                            DifyDatasetResponse(**dataset)
                            print(f"[DEBUG] Dataset {idx} validation OK")
                        except Exception as dataset_error:
                            print(f"[ERROR] Dataset {idx} validation failed: {dataset_error}")

                raise parse_error

        except httpx.HTTPStatusError as e:
            print(f"[ERROR] HTTP Error: {e.response.status_code}")
            print(f"[ERROR] Response Text: {e.response.text}")
            raise
        except Exception as e:
            print(f"[ERROR] Exception Type: {type(e).__name__}")
            print(f"[ERROR] Exception Message: {str(e)}")
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
        """HTTP 클라이언트 종료"""
        await self.client.aclose()
