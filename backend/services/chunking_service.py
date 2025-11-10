"""
Docling Serve 청킹 서비스
"""
import httpx
import tempfile
import os
from typing import List, Dict, Any


class ChunkingService:
    """Docling Serve 청킹 API와의 통신을 담당하는 서비스"""

    def __init__(self, base_url: str):
        """
        ChunkingService 초기화

        Args:
            base_url: Docling Serve 기본 URL
        """
        self.base_url = base_url
        self.client = httpx.AsyncClient(timeout=60.0)

    async def chunk_markdown(
        self,
        markdown_content: str,
        max_tokens: int = 500,
        filename: str = "document.md"
    ) -> List[Dict[str, Any]]:
        """
        Markdown 텍스트를 청킹

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
            # 임시 파일에 markdown 저장
            with tempfile.NamedTemporaryFile(
                mode='w',
                suffix='.md',
                delete=False,
                encoding='utf-8'
            ) as tmp_file:
                tmp_file.write(markdown_content)
                tmp_path = tmp_file.name

            try:
                # Docling Serve API 호출
                url = f"{self.base_url}/v1/chunk/hybrid/file"

                with open(tmp_path, 'rb') as f:
                    files = {'files': (filename, f, 'text/markdown')}
                    data = {
                        'chunking_max_tokens': str(max_tokens)
                    }

                    response = await self.client.post(url, files=files, data=data)
                    response.raise_for_status()

                result = response.json()

                # chunks 추출
                chunks = result.get('chunks', [])

                print(f"[INFO] Successfully chunked document into {len(chunks)} chunks")
                return chunks

            finally:
                # 임시 파일 삭제
                if os.path.exists(tmp_path):
                    os.unlink(tmp_path)

        except Exception as e:
            print(f"[ERROR] Failed to chunk markdown: {e}")
            raise Exception(f"Markdown 청킹 실패: {str(e)}")

    async def close(self):
        """클라이언트 연결 종료"""
        await self.client.aclose()
