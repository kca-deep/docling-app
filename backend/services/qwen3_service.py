"""
Qwen3 VL OCR API 호출 서비스
"""
import time
import base64
import asyncio
import httpx
import fitz  # PyMuPDF
from PIL import Image
import io
import re
from typing import Optional

from backend.config.settings import settings
from backend.models.schemas import TaskStatus, ConvertResult, DocumentInfo
from backend.services.progress_tracker import progress_tracker


class Qwen3Service:
    """Qwen3 VL OCR 서비스"""

    def __init__(self):
        self.base_url = settings.QWEN3_VL_BASE_URL
        self.api_url = settings.QWEN3_VL_API_URL
        self.model = settings.QWEN3_VL_MODEL
        self.timeout = settings.QWEN3_VL_TIMEOUT
        self.max_pages = settings.QWEN3_VL_MAX_PAGES
        self.max_tokens = settings.QWEN3_VL_MAX_TOKENS
        self.temperature = settings.QWEN3_VL_TEMPERATURE
        self.ocr_prompt = settings.QWEN3_VL_OCR_PROMPT

    def _image_to_base64(self, image: Image.Image) -> str:
        """PIL Image를 base64 문자열로 변환"""
        buffered = io.BytesIO()
        image.save(buffered, format="PNG")
        return base64.b64encode(buffered.getvalue()).decode('utf-8')

    def _pdf_to_images(self, file_content: bytes) -> list[Image.Image]:
        """PyMuPDF를 사용하여 PDF를 PIL Image 리스트로 변환"""
        images = []
        pdf_document = fitz.open(stream=file_content, filetype="pdf")

        # 최대 페이지 수 제한
        page_count = min(pdf_document.page_count, self.max_pages)

        for page_num in range(page_count):
            page = pdf_document[page_num]
            # 200 DPI로 렌더링 (zoom factor = 200/72 ≈ 2.78)
            mat = fitz.Matrix(2.78, 2.78)
            pix = page.get_pixmap(matrix=mat)

            # PIL Image로 변환
            img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
            images.append(img)

        pdf_document.close()
        return images

    async def _perform_ocr(
        self,
        client: httpx.AsyncClient,
        image_base64: str,
        page_num: int
    ) -> str:
        """Qwen3 VL 모델로 OCR 수행"""
        headers = {
            "Content-Type": "application/json"
        }

        payload = {
            "model": self.model,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/png;base64,{image_base64}"
                            }
                        },
                        {
                            "type": "text",
                            "text": self.ocr_prompt
                        }
                    ]
                }
            ],
            "max_tokens": self.max_tokens,
            "temperature": self.temperature
        }

        try:
            response = await client.post(
                self.api_url,
                headers=headers,
                json=payload,
                timeout=self.timeout
            )
            response.raise_for_status()
            result = response.json()

            if 'choices' in result and len(result['choices']) > 0:
                ocr_text = result['choices'][0]['message']['content']
                return ocr_text
            else:
                return f"오류: 응답에서 텍스트를 찾을 수 없습니다. 응답: {result}"

        except Exception as e:
            return f"오류 발생: {str(e)}"

    async def convert_document(
        self,
        file_content: bytes,
        filename: str,
        task_id: Optional[str] = None,
        **kwargs
    ) -> ConvertResult:
        """
        PDF 문서를 OCR로 변환 (Qwen3 VL 사용)

        Args:
            file_content: 파일 내용 (바이트)
            filename: 파일명
            task_id: 작업 ID (지정하지 않으면 자동 생성)
            **kwargs: 추가 옵션 (호환성을 위해 무시됨)

        Returns:
            ConvertResult: 변환 결과
        """
        start_time = time.time()
        if task_id is None:
            task_id = f"qwen3-{int(time.time() * 1000)}"

        try:
            # PDF를 이미지로 변환
            images = self._pdf_to_images(file_content)

            if not images:
                return ConvertResult(
                    task_id=task_id,
                    status=TaskStatus.FAILURE,
                    error="PDF에서 이미지를 추출할 수 없습니다"
                )

            # 진행률 추적 시작
            progress_tracker.create_progress(
                task_id=task_id,
                total_pages=len(images),
                filename=filename
            )

            # 각 페이지 OCR 처리
            page_results = []

            async with httpx.AsyncClient(timeout=self.timeout) as client:
                for i, image in enumerate(images, 1):
                    # 이미지를 base64로 변환
                    image_base64 = self._image_to_base64(image)

                    # OCR 수행
                    ocr_result = await self._perform_ocr(client, image_base64, i)
                    page_results.append({
                        'page': i,
                        'content': ocr_result
                    })

                    # 진행률 업데이트
                    progress_tracker.update_progress(task_id, i)

                    # API 부하 방지를 위한 짧은 대기
                    if i < len(images):
                        await asyncio.sleep(1)

            # 전체 마크다운 통합
            md_content = self._combine_results(filename, page_results)

            processing_time = time.time() - start_time

            # 진행률 완료 처리 (md_content와 processing_time 포함)
            progress_tracker.mark_completed(task_id, md_content, processing_time)

            return ConvertResult(
                task_id=task_id,
                status=TaskStatus.SUCCESS,
                document=DocumentInfo(
                    filename=filename,
                    md_content=md_content,
                    processing_time=processing_time
                ),
                processing_time=processing_time
            )

        except httpx.TimeoutException:
            error_msg = "API 요청 타임아웃"
            progress_tracker.mark_failed(task_id, error_msg)
            return ConvertResult(
                task_id=task_id,
                status=TaskStatus.FAILURE,
                error=error_msg
            )
        except Exception as e:
            error_msg = f"예상치 못한 오류: {str(e)}"
            progress_tracker.mark_failed(task_id, error_msg)
            return ConvertResult(
                task_id=task_id,
                status=TaskStatus.FAILURE,
                error=error_msg
            )

    def _clean_html_tags(self, text: str) -> str:
        """
        HTML 태그를 제거하여 순수 마크다운으로 정리
        단, 한글/숫자가 포함된 <개정>, <신설>, <삭제> 등은 보존
        표 안의 <br> 태그는 줄바꿈을 위해 보존

        Args:
            text: 정리할 텍스트

        Returns:
            HTML 태그가 제거된 텍스트 (<br> 태그는 보존)
        """
        # <br> 태그를 임시로 플레이스홀더로 치환 (보존하기 위해)
        text = re.sub(r'<br\s*/?\s*>', '___BR___', text, flags=re.IGNORECASE)

        # 다른 HTML 태그만 제거 (영문자로 시작하는 태그만)
        # 예: <p>, <div>, <span> 등은 제거
        # 예: <개정 2010. 12. 28.>, <신설>, <삭제> 등은 보존
        text = re.sub(r'</?[a-zA-Z][^>]*>', '', text)

        # 플레이스홀더를 <br>로 복원
        text = text.replace('___BR___', '<br>')

        # 연속된 공백을 하나로 축소 (단, 줄바꿈은 유지)
        text = re.sub(r' +', ' ', text)

        # 각 줄의 앞뒤 공백 제거 (단, 표 안의 내용은 주의)
        lines = [line.strip() for line in text.split('\n')]
        text = '\n'.join(lines)

        return text

    def _combine_results(self, filename: str, page_results: list) -> str:
        """페이지별 OCR 결과를 하나의 마크다운으로 통합"""
        lines = []
        lines.append(f"# {filename}")
        lines.append("")
        lines.append(f"**총 페이지:** {len(page_results)}페이지")
        lines.append("")
        lines.append("---")
        lines.append("")

        for result in page_results:
            page_num = result['page']
            content = result['content']

            # HTML 태그 제거
            cleaned_content = self._clean_html_tags(content)

            lines.append(f"## 페이지 {page_num}")
            lines.append("")
            lines.append(cleaned_content)
            lines.append("")
            lines.append("---")
            lines.append("")

        return "\n".join(lines)


# 싱글톤 인스턴스
qwen3_service = Qwen3Service()
