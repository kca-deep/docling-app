"""
Docling Serve API 호출 서비스
"""
import time
import httpx
from typing import Optional, Dict, Any
from pathlib import Path

from backend.config.settings import settings
from backend.models.schemas import TaskStatus, ConvertResult, DocumentInfo


class DoclingService:
    """Docling Serve API 서비스"""

    def __init__(self):
        self.base_url = settings.DOCLING_BASE_URL
        self.async_api_url = f"{self.base_url}/v1/convert/file/async"
        self.status_api_url = f"{self.base_url}/v1/status/poll"
        self.result_api_url = f"{self.base_url}/v1/result"
        self.poll_interval = settings.POLL_INTERVAL

    async def convert_document(
        self,
        file_content: bytes,
        filename: str,
        target_type: str = "inbody",
        to_formats: str = "md",
        do_ocr: bool = True,
        do_table_structure: bool = True,
        include_images: bool = True,
        table_mode: str = "accurate",
        image_export_mode: str = "embedded",
        page_range_start: int = 1,
        page_range_end: int = 9223372036854776000,
        do_formula_enrichment: bool = False,
        pipeline: str = "standard"
    ) -> ConvertResult:
        """
        문서 변환 (비동기 방식)

        Args:
            file_content: 파일 내용 (바이트)
            filename: 파일명
            target_type: 변환 타겟 타입 (inbody, zip)
            to_formats: 출력 형식 (md, json, html, text, doctags)
            do_ocr: OCR 인식 활성화
            do_table_structure: 테이블 구조 인식
            include_images: 이미지 포함
            table_mode: 테이블 모드 (fast, accurate)
            image_export_mode: 이미지 내보내기 모드 (placeholder, embedded, referenced)
            page_range_start: 페이지 시작
            page_range_end: 페이지 끝
            do_formula_enrichment: 수식 인식
            pipeline: 처리 파이프라인 (legacy, standard, vlm, asr)

        Returns:
            ConvertResult: 변환 결과
        """
        async with httpx.AsyncClient(timeout=120.0) as client:
            try:
                # 1단계: 비동기 변환 작업 시작
                files = {"files": (filename, file_content, "application/pdf")}
                data = {
                    "target_type": target_type,
                    "to_formats": [to_formats],
                    "do_ocr": do_ocr,
                    "do_table_structure": do_table_structure,
                    "include_images": include_images,
                    "table_mode": table_mode,
                    "image_export_mode": image_export_mode,
                    "page_range": [page_range_start, page_range_end],
                    "do_formula_enrichment": do_formula_enrichment,
                    "pipeline": pipeline
                }

                response = await client.post(
                    self.async_api_url,
                    files=files,
                    data=data
                )

                if response.status_code != 200:
                    return ConvertResult(
                        task_id="",
                        status=TaskStatus.FAILURE,
                        error=f"API 호출 실패: {response.status_code}"
                    )

                task_response = response.json()

                if "task_id" not in task_response:
                    return ConvertResult(
                        task_id="",
                        status=TaskStatus.FAILURE,
                        error="Task ID를 받지 못했습니다"
                    )

                task_id = task_response["task_id"]

                # 2단계: Task 상태 폴링
                await self._wait_for_task_completion(client, task_id)

                # 3단계: 결과 조회
                result = await self._get_task_result(client, task_id)

                return result

            except httpx.TimeoutException:
                return ConvertResult(
                    task_id="",
                    status=TaskStatus.FAILURE,
                    error="API 요청 타임아웃"
                )
            except Exception as e:
                return ConvertResult(
                    task_id="",
                    status=TaskStatus.FAILURE,
                    error=f"예상치 못한 오류: {str(e)}"
                )

    async def _wait_for_task_completion(
        self,
        client: httpx.AsyncClient,
        task_id: str
    ) -> None:
        """Task 완료 대기"""
        while True:
            status_response = await client.get(
                f"{self.status_api_url}/{task_id}",
                params={"wait": self.poll_interval},
                timeout=self.poll_interval + 5
            )

            if status_response.status_code == 200:
                status_data = status_response.json()
                status = status_data.get("task_status", "unknown")

                if status == "success":
                    break
                elif status == "failure":
                    raise Exception(f"Task 실패: {status_data}")

            time.sleep(self.poll_interval)

    async def _get_task_result(
        self,
        client: httpx.AsyncClient,
        task_id: str
    ) -> ConvertResult:
        """Task 결과 조회"""
        result_response = await client.get(
            f"{self.result_api_url}/{task_id}",
            timeout=30
        )

        if result_response.status_code != 200:
            return ConvertResult(
                task_id=task_id,
                status=TaskStatus.FAILURE,
                error=f"결과 조회 실패: {result_response.status_code}"
            )

        result_data = result_response.json()

        if "document" in result_data:
            doc = result_data["document"]
            document_info = DocumentInfo(
                filename=doc.get("filename", "unknown"),
                md_content=doc.get("md_content"),
                processing_time=result_data.get("processing_time")
            )

            return ConvertResult(
                task_id=task_id,
                status=TaskStatus.SUCCESS,
                document=document_info,
                processing_time=result_data.get("processing_time")
            )
        else:
            return ConvertResult(
                task_id=task_id,
                status=TaskStatus.FAILURE,
                error="문서 정보를 찾을 수 없습니다"
            )

    async def get_task_status(self, task_id: str) -> Dict[str, Any]:
        """Task 상태 조회"""
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{self.status_api_url}/{task_id}",
                params={"wait": 0}
            )

            if response.status_code == 200:
                return response.json()
            else:
                return {
                    "task_status": "unknown",
                    "error": f"상태 조회 실패: {response.status_code}"
                }
