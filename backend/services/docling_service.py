"""
Docling Serve API 호출 서비스
VRAM 최적화를 위한 동시성 제어 및 캐시 정리 기능 포함
"""
import time
import asyncio
import logging
import httpx
from typing import Optional, Dict, Any
from pathlib import Path

from backend.config.settings import settings
from backend.models.schemas import TaskStatus, ConvertResult, DocumentInfo

logger = logging.getLogger(__name__)


class DoclingService:
    """Docling Serve API 서비스 (VRAM 최적화)"""

    def __init__(self):
        self.base_url = settings.DOCLING_BASE_URL
        self.async_api_url = f"{self.base_url}/v1/convert/file/async"
        self.source_async_api_url = f"{self.base_url}/v1/convert/source/async"
        self.status_api_url = f"{self.base_url}/v1/status/poll"
        self.result_api_url = f"{self.base_url}/v1/result"
        self.poll_interval = settings.POLL_INTERVAL

        # 동시성 제어 (VRAM 관리)
        self._semaphore = asyncio.Semaphore(settings.DOCLING_CONCURRENCY)

        # 싱글톤 HTTP 클라이언트 (Lazy 초기화)
        self._client: Optional[httpx.AsyncClient] = None

        # 캐시 정리 카운터
        self._convert_count: int = 0
        self._convert_lock: asyncio.Lock = asyncio.Lock()

    async def _get_client(self, timeout: float = 120.0) -> httpx.AsyncClient:
        """
        공유 HTTP 클라이언트 반환 (Lazy 초기화)

        Args:
            timeout: 요청 타임아웃 (초)

        Returns:
            httpx.AsyncClient: 공유 클라이언트 인스턴스
        """
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                timeout=httpx.Timeout(timeout, connect=10.0),
                limits=httpx.Limits(
                    max_connections=settings.DOCLING_CONCURRENCY * 2,
                    max_keepalive_connections=settings.DOCLING_CONCURRENCY
                )
            )
        return self._client

    async def close(self):
        """서비스 종료 시 클라이언트 정리"""
        if self._client and not self._client.is_closed:
            await self._client.aclose()
            self._client = None
            logger.info("DoclingService HTTP 클라이언트 종료 완료")

    async def clear_converters(self) -> bool:
        """
        Docling Serve 변환기 캐시 정리
        GPU 메모리 해제를 위해 호출

        Returns:
            bool: 성공 여부
        """
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    f"{self.base_url}/v1/clear/converters"
                )
                if response.status_code == 200:
                    logger.info("Docling Serve 변환기 캐시 정리 완료")
                    return True
                else:
                    logger.warning(f"캐시 정리 응답 코드: {response.status_code}")
                    return False
        except Exception as e:
            # 캐시 정리 실패는 무시 (변환 성공이 더 중요)
            logger.warning(f"캐시 정리 실패 (무시됨): {e}")
            return False

    async def _maybe_clear_cache(self):
        """설정된 간격에 따라 캐시 정리 수행"""
        if not settings.DOCLING_CLEAR_CACHE_AFTER_CONVERT:
            return

        async with self._convert_lock:
            self._convert_count += 1
            if settings.DOCLING_CLEAR_CACHE_INTERVAL == 0 or \
               self._convert_count >= settings.DOCLING_CLEAR_CACHE_INTERVAL:
                await self.clear_converters()
                self._convert_count = 0

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
        pipeline: str = "standard",
        vlm_pipeline_model: Optional[str] = None
    ) -> ConvertResult:
        """
        문서 변환 (비동기 방식, VRAM 최적화 적용)

        동시성 제어: DOCLING_USE_SEMAPHORE=true 시 DOCLING_CONCURRENCY 개수만큼만 동시 처리
        캐시 정리: DOCLING_CLEAR_CACHE_AFTER_CONVERT=true 시 변환 후 GPU 캐시 정리

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
        # Semaphore로 동시 요청 제어 (VRAM 관리)
        if settings.DOCLING_USE_SEMAPHORE:
            async with self._semaphore:
                logger.debug(f"Semaphore 획득: {filename} (동시 요청 제한: {settings.DOCLING_CONCURRENCY})")
                result = await self._convert_document_impl(
                    file_content, filename, target_type, to_formats,
                    do_ocr, do_table_structure, include_images, table_mode,
                    image_export_mode, page_range_start, page_range_end,
                    do_formula_enrichment, pipeline, vlm_pipeline_model
                )
                # 변환 후 캐시 정리
                await self._maybe_clear_cache()
                return result
        else:
            result = await self._convert_document_impl(
                file_content, filename, target_type, to_formats,
                do_ocr, do_table_structure, include_images, table_mode,
                image_export_mode, page_range_start, page_range_end,
                do_formula_enrichment, pipeline, vlm_pipeline_model
            )
            await self._maybe_clear_cache()
            return result

    async def _convert_document_impl(
        self,
        file_content: bytes,
        filename: str,
        target_type: str,
        to_formats: str,
        do_ocr: bool,
        do_table_structure: bool,
        include_images: bool,
        table_mode: str,
        image_export_mode: str,
        page_range_start: int,
        page_range_end: int,
        do_formula_enrichment: bool,
        pipeline: str,
        vlm_pipeline_model: Optional[str]
    ) -> ConvertResult:
        """문서 변환 실제 구현 (내부 메서드)"""
        # VLM 파이프라인은 더 긴 타임아웃 필요
        timeout_value = 300.0 if pipeline == "vlm" else 120.0
        client = await self._get_client(timeout_value)
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

            # VLM 파이프라인 사용 시 모델 지정
            if pipeline == "vlm" and vlm_pipeline_model:
                data["vlm_pipeline_model"] = vlm_pipeline_model

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
            await self._wait_for_task_completion(client, task_id, pipeline)

            # 3단계: 결과 조회
            result = await self._get_task_result(client, task_id, pipeline)

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
        task_id: str,
        pipeline: str = "standard"
    ) -> None:
        """Task 완료 대기"""
        # VLM 파이프라인은 더 긴 폴링 시간 필요
        poll_timeout = 30 if pipeline == "vlm" else self.poll_interval + 5
        while True:
            status_response = await client.get(
                f"{self.status_api_url}/{task_id}",
                params={"wait": self.poll_interval},
                timeout=poll_timeout
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
        task_id: str,
        pipeline: str = "standard"
    ) -> ConvertResult:
        """Task 결과 조회"""
        # VLM 파이프라인은 더 긴 결과 조회 타임아웃 필요
        result_timeout = 60 if pipeline == "vlm" else 30
        result_response = await client.get(
            f"{self.result_api_url}/{task_id}",
            timeout=result_timeout
        )

        if result_response.status_code != 200:
            return ConvertResult(
                task_id=task_id,
                status=TaskStatus.FAILURE,
                error=f"결과 조회 실패: {result_response.status_code}"
            )

        result_data = result_response.json()

        # 에러 정보 수집
        errors = result_data.get("errors", [])
        error_messages = [e.get("error_message", "") for e in errors] if errors else []

        if "document" in result_data:
            doc = result_data["document"]
            md_content = doc.get("md_content")

            # md_content가 없거나 빈 경우 실패로 처리
            if not md_content or (isinstance(md_content, str) and not md_content.strip()):
                error_detail = "; ".join(error_messages) if error_messages else "변환 결과가 비어있습니다"
                return ConvertResult(
                    task_id=task_id,
                    status=TaskStatus.FAILURE,
                    error=f"Docling 변환 실패: {error_detail}"
                )

            document_info = DocumentInfo(
                filename=doc.get("filename", "unknown"),
                md_content=md_content,
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

    async def convert_url(
        self,
        url: str,
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
        pipeline: str = "standard",
        vlm_pipeline_model: Optional[str] = None
    ) -> ConvertResult:
        """
        URL 문서 변환 (비동기 방식, VRAM 최적화 적용)

        Args:
            url: 파싱할 URL
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
        # Semaphore로 동시 요청 제어 (VRAM 관리)
        if settings.DOCLING_USE_SEMAPHORE:
            async with self._semaphore:
                logger.debug(f"Semaphore 획득 (URL): {url} (동시 요청 제한: {settings.DOCLING_CONCURRENCY})")
                result = await self._convert_url_impl(
                    url, target_type, to_formats, do_ocr, do_table_structure,
                    include_images, table_mode, image_export_mode,
                    page_range_start, page_range_end, do_formula_enrichment,
                    pipeline, vlm_pipeline_model
                )
                await self._maybe_clear_cache()
                return result
        else:
            result = await self._convert_url_impl(
                url, target_type, to_formats, do_ocr, do_table_structure,
                include_images, table_mode, image_export_mode,
                page_range_start, page_range_end, do_formula_enrichment,
                pipeline, vlm_pipeline_model
            )
            await self._maybe_clear_cache()
            return result

    async def _convert_url_impl(
        self,
        url: str,
        target_type: str,
        to_formats: str,
        do_ocr: bool,
        do_table_structure: bool,
        include_images: bool,
        table_mode: str,
        image_export_mode: str,
        page_range_start: int,
        page_range_end: int,
        do_formula_enrichment: bool,
        pipeline: str,
        vlm_pipeline_model: Optional[str]
    ) -> ConvertResult:
        """URL 문서 변환 실제 구현 (내부 메서드)"""
        # VLM 파이프라인은 더 긴 타임아웃 필요
        timeout_value = 300.0 if pipeline == "vlm" else 120.0
        client = await self._get_client(timeout_value)
        try:
            # 1단계: 비동기 변환 작업 시작 (JSON 형식)
            options = {
                "to_formats": [to_formats],
                "image_export_mode": image_export_mode,
                "do_ocr": do_ocr,
                "do_table_structure": do_table_structure,
                "include_images": include_images,
                "table_mode": table_mode,
                "page_range": [page_range_start, page_range_end],
                "do_formula_enrichment": do_formula_enrichment,
                "pipeline": pipeline
            }

            # VLM 파이프라인 사용 시 모델 지정
            if pipeline == "vlm" and vlm_pipeline_model:
                options["vlm_pipeline_model"] = vlm_pipeline_model

            request_body = {
                "options": options,
                "sources": [
                    {
                        "kind": "http",
                        "url": url
                    }
                ],
                "target": {
                    "kind": target_type
                }
            }

            response = await client.post(
                self.source_async_api_url,
                json=request_body
            )

            if response.status_code != 200:
                return ConvertResult(
                    task_id="",
                    status=TaskStatus.FAILURE,
                    error=f"API 호출 실패: {response.status_code} - {response.text}"
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
            await self._wait_for_task_completion(client, task_id, pipeline)

            # 3단계: 결과 조회
            result = await self._get_task_result(client, task_id, pipeline)

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

    def get_active_count(self) -> int:
        """
        현재 진행 중인 변환 작업 수 반환

        Returns:
            int: 사용 중인 Semaphore 슬롯 수 (동시 진행 중인 작업 수)
        """
        # Semaphore의 현재 값 = 남은 슬롯 수
        # 진행 중인 작업 수 = 전체 슬롯 - 남은 슬롯
        return settings.DOCLING_CONCURRENCY - self._semaphore._value

    async def safe_clear_converters(self) -> bool:
        """
        안전한 캐시 정리 (진행 중인 작업이 없을 때만)

        Returns:
            bool: 정리 실행 여부
        """
        if self.get_active_count() == 0:
            return await self.clear_converters()
        else:
            logger.debug(f"Skipping cache clear: {self.get_active_count()} active conversions")
            return False


# 싱글톤 인스턴스
_docling_service: Optional[DoclingService] = None


def get_docling_service() -> DoclingService:
    """
    DoclingService 싱글톤 반환

    Returns:
        DoclingService: 공유 인스턴스
    """
    global _docling_service
    if _docling_service is None:
        _docling_service = DoclingService()
        logger.info("DoclingService 싱글톤 인스턴스 생성")
    return _docling_service
