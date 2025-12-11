"""
Docling Serve 청킹 서비스
"""
import httpx
import time
from typing import List, Dict, Any


class ChunkingService:
    """Docling Serve 청킹 API와의 통신을 담당하는 서비스"""

    def __init__(self, base_url: str, poll_interval: int = 2):
        """
        ChunkingService 초기화

        Args:
            base_url: Docling Serve 기본 URL
            poll_interval: 상태 폴링 간격 (초)
        """
        self.base_url = base_url
        self.poll_interval = poll_interval
        self.client = httpx.AsyncClient(timeout=60.0)

    async def chunk_markdown(
        self,
        markdown_content: str,
        max_tokens: int = 500,
        filename: str = "document.md"
    ) -> List[Dict[str, Any]]:
        """
        Markdown 텍스트를 청킹 (비동기 방식)

        Args:
            markdown_content: 청킹할 markdown 텍스트
            max_tokens: 최대 토큰 수
            filename: 파일명 (메타데이터용)

        Returns:
            List[Dict]: 청크 리스트 (각 청크는 text, num_tokens, headings 포함)

        Raises:
            Exception: 청킹 실패 시
        """
        try:
            # 1단계: 비동기 청킹 작업 제출
            async_url = f"{self.base_url}/v1/chunk/hybrid/source/async"

            # Markdown content를 base64로 인코딩
            import base64
            base64_content = base64.b64encode(markdown_content.encode('utf-8')).decode('utf-8')

            # filename을 .md로 변경 (원본이 .pdf여도 markdown 텍스트임)
            import os
            base_filename = os.path.splitext(filename)[0]  # 확장자 제거
            md_filename = f"{base_filename}.md"

            payload = {
                "sources": [
                    {
                        "base64_string": base64_content,
                        "filename": md_filename,
                        "kind": "file"
                    }
                ],
                "convert_options": {
                    "from_formats": ["md"],
                    "to_formats": ["md"],
                    "do_ocr": False,  # Markdown 청킹에는 OCR 불필요
                    "do_table_structure": False  # 이미 파싱된 Markdown이므로 불필요
                },
                "chunking_options": {
                    "chunker": "hybrid",
                    "max_tokens": max_tokens,
                    "tokenizer": "sentence-transformers/all-MiniLM-L6-v2",
                    "merge_peers": True,
                    "use_markdown_tables": False,
                    "include_raw_text": False
                },
                "include_converted_doc": False,
                "target": {
                    "kind": "inbody"
                }
            }

            print(f"[INFO] Submitting chunking task for {filename}")
            print(f"[DEBUG] Request URL: {async_url}")
            print(f"[DEBUG] Request payload keys: {list(payload.keys())}")
            print(f"[DEBUG] Chunking options: {payload['chunking_options']}")

            response = await self.client.post(
                async_url,
                json=payload,
                headers={"Content-Type": "application/json"}
            )
            response.raise_for_status()

            task_response = response.json()
            print(f"[DEBUG] Task submission response: {task_response}")

            task_id = task_response.get('task_id')

            if not task_id:
                raise Exception(f"Task ID를 받지 못했습니다: {task_response}")

            print(f"[INFO] Chunking task submitted. Task ID: {task_id}")

            # 2단계: Task 상태 폴링
            status_url = f"{self.base_url}/v1/status/poll/{task_id}"
            elapsed = 0
            max_wait = 300  # 5분 최대 대기

            while elapsed < max_wait:
                status_response = await self.client.get(
                    status_url,
                    params={'wait': self.poll_interval},
                    timeout=self.poll_interval + 10
                )
                status_response.raise_for_status()

                status_data = status_response.json()
                task_status = status_data.get('task_status', 'unknown')

                print(f"[INFO] Chunking task status: {task_status} (elapsed: {elapsed}s)")
                print(f"[DEBUG] Full status response: {status_data}")

                if task_status == 'success':
                    print(f"[INFO] Chunking task completed successfully")
                    break
                elif task_status == 'failure':
                    # 실패 시 result 엔드포인트에서 상세 에러 확인
                    print(f"[ERROR] Task failure detected. Fetching detailed error from result endpoint...")
                    result_url_error = f"{self.base_url}/v1/result/{task_id}"
                    try:
                        result_response_error = await self.client.get(result_url_error, timeout=30)
                        if result_response_error.status_code == 200:
                            error_result = result_response_error.json()
                            print(f"[ERROR] Detailed error from result: {error_result}")
                            error_msg = error_result.get('error', error_result.get('message', str(error_result)))
                        else:
                            error_msg = f"Status: {result_response_error.status_code}, Body: {result_response_error.text[:500]}"
                    except Exception as e:
                        error_msg = f"Failed to fetch error details: {str(e)}"

                    print(f"[ERROR] Task failure details: {status_data}")
                    raise Exception(f"Chunking task failed: {error_msg}")

                await self._async_sleep(self.poll_interval)
                elapsed += self.poll_interval

            if elapsed >= max_wait:
                raise Exception(f"Chunking task timeout after {max_wait} seconds")

            # 3단계: 결과 조회
            result_url = f"{self.base_url}/v1/result/{task_id}"
            print(f"[INFO] Retrieving chunking results...")

            result_response = await self.client.get(result_url, timeout=30)
            result_response.raise_for_status()

            result = result_response.json()

            # chunks 추출
            chunks = result.get('chunks', [])

            if not chunks:
                raise Exception("청킹 결과가 비어 있습니다")

            print(f"[INFO] Successfully chunked document into {len(chunks)} chunks")
            return chunks

        except httpx.HTTPStatusError as e:
            print(f"[ERROR] HTTP error during chunking: {e.response.status_code} - {e.response.text}")
            raise Exception(f"Markdown 청킹 실패: {e.response.status_code} {e.response.text}")
        except Exception as e:
            print(f"[ERROR] Failed to chunk markdown: {e}")
            raise Exception(f"Markdown 청킹 실패: {str(e)}")

    async def _async_sleep(self, seconds: int):
        """비동기 sleep 헬퍼 함수"""
        import asyncio
        await asyncio.sleep(seconds)

    async def close(self):
        """클라이언트 연결 종료"""
        await self.client.aclose()
