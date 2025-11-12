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
from typing import Optional

from backend.config.settings import settings
from backend.models.schemas import TaskStatus, ConvertResult, DocumentInfo


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
        **kwargs
    ) -> ConvertResult:
        """
        PDF 문서를 OCR로 변환 (Qwen3 VL 사용)

        Args:
            file_content: 파일 내용 (바이트)
            filename: 파일명
            **kwargs: 추가 옵션 (호환성을 위해 무시됨)

        Returns:
            ConvertResult: 변환 결과
        """
        start_time = time.time()
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

                    # API 부하 방지를 위한 짧은 대기
                    if i < len(images):
                        await asyncio.sleep(1)

            # 전체 마크다운 통합
            md_content = self._combine_results(filename, page_results)

            processing_time = time.time() - start_time

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
            return ConvertResult(
                task_id=task_id,
                status=TaskStatus.FAILURE,
                error="API 요청 타임아웃"
            )
        except Exception as e:
            return ConvertResult(
                task_id=task_id,
                status=TaskStatus.FAILURE,
                error=f"예상치 못한 오류: {str(e)}"
            )

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

            lines.append(f"## 페이지 {page_num}")
            lines.append("")
            lines.append(content)
            lines.append("")
            lines.append("---")
            lines.append("")

        return "\n".join(lines)


# 싱글톤 인스턴스
qwen3_service = Qwen3Service()
