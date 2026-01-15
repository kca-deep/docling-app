"""
채팅 텍스트 내보내기 서비스
LLM 응답 데이터를 마크다운(MD) 또는 텍스트(TXT) 파일로 변환합니다.
"""

import logging
import re
import unicodedata
from datetime import datetime
from typing import Optional

from backend.services.tool_executor_service import (
    ToolResult,
    file_storage,
    FileSizeExceededError,
    StorageCapacityExceededError
)
from backend.utils.text_normalizer import normalize_spaces

logger = logging.getLogger("uvicorn")


class ChatTextExportService:
    """
    채팅 데이터를 마크다운 또는 텍스트로 내보내는 서비스
    """

    def __init__(self):
        pass

    def _get_display_width(self, text: str) -> int:
        """
        텍스트의 디스플레이 너비 계산

        한글 및 동아시아 문자(CJK)는 모노스페이스 폰트에서 2칸으로 표시됩니다.
        ASCII 문자는 1칸으로 표시됩니다.

        Args:
            text: 너비를 계산할 텍스트

        Returns:
            int: 디스플레이 너비
        """
        width = 0
        for char in text:
            ea_width = unicodedata.east_asian_width(char)
            # W (Wide), F (Fullwidth) = 2칸
            # N (Neutral), Na (Narrow), H (Halfwidth), A (Ambiguous) = 1칸
            if ea_width in ('W', 'F'):
                width += 2
            else:
                width += 1
        return width

    def _remove_markdown_formatting(self, content: str) -> str:
        """
        마크다운 서식을 제거하여 순수 텍스트로 변환

        Args:
            content: 마크다운 형식의 텍스트

        Returns:
            str: 서식이 제거된 텍스트
        """
        text = content

        # 코드 블록 처리 (```...``` → 내용만 유지)
        text = re.sub(r'```[\w]*\n?(.*?)```', r'\1', text, flags=re.DOTALL)

        # 인라인 코드 (`code` → code)
        text = re.sub(r'`([^`]+)`', r'\1', text)

        # 볼드 (**text** 또는 __text__ → text)
        text = re.sub(r'\*\*(.+?)\*\*', r'\1', text)
        text = re.sub(r'__(.+?)__', r'\1', text)

        # 이탤릭 (*text* 또는 _text_ → text)
        text = re.sub(r'\*(.+?)\*', r'\1', text)
        text = re.sub(r'(?<!\w)_(.+?)_(?!\w)', r'\1', text)

        # 취소선 (~~text~~ → text)
        text = re.sub(r'~~(.+?)~~', r'\1', text)

        # 링크 ([text](url) → text)
        text = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', text)

        # 이미지 (![alt](url) → [이미지: alt])
        text = re.sub(r'!\[([^\]]*)\]\([^)]+\)', r'[이미지: \1]', text)

        # 제목 (# ~ ###### → 제목 텍스트)
        text = re.sub(r'^#{1,6}\s+(.+)$', r'\1', text, flags=re.MULTILINE)

        # 수평선 (---, ***, ___ → 구분선)
        text = re.sub(r'^[-*_]{3,}\s*$', '─' * 40, text, flags=re.MULTILINE)

        # 인용 (> text → text)
        text = re.sub(r'^>\s*(.*)$', r'  \1', text, flags=re.MULTILINE)

        # 순서 없는 목록 (- 또는 * → •)
        text = re.sub(r'^(\s*)[-*+]\s+', r'\1• ', text, flags=re.MULTILINE)

        # 테이블 구분선 제거 (|---|---|)
        text = re.sub(r'^\|[\s\-:]+\|$', '', text, flags=re.MULTILINE)

        # 테이블 파이프 정리 (| cell | → cell)
        lines = text.split('\n')
        cleaned_lines = []
        for line in lines:
            if '|' in line and line.strip().startswith('|'):
                # 테이블 행: 파이프를 탭으로 변환
                cells = [c.strip() for c in line.split('|')]
                cells = [c for c in cells if c]
                if cells:
                    cleaned_lines.append('\t'.join(cells))
            else:
                cleaned_lines.append(line)
        text = '\n'.join(cleaned_lines)

        # 연속된 빈 줄 정리
        text = re.sub(r'\n{3,}', '\n\n', text)

        return text.strip()

    def export_to_markdown(
        self,
        content: str,
        filename: str = "export",
        title: Optional[str] = None
    ) -> bytes:
        """
        콘텐츠를 마크다운 파일로 변환

        Args:
            content: 마크다운 형식의 텍스트
            filename: 파일명 (확장자 제외)
            title: 문서 제목 (선택사항)

        Returns:
            bytes: 마크다운 파일 바이너리
        """
        output_lines = []

        # 제목 추가 (선택사항)
        if title:
            output_lines.append(f"# {title}")
            output_lines.append("")

        # 생성 정보 추가
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        output_lines.append(f"<!-- 생성일시: {now} -->")
        output_lines.append("")

        # 원본 콘텐츠 추가 (특수 공백 정규화)
        normalized_content = normalize_spaces(content)
        output_lines.append(normalized_content)

        result = '\n'.join(output_lines)
        logger.info(f"[TextExport] Markdown export: {len(result)} chars")

        return result.encode('utf-8')

    def export_to_text(
        self,
        content: str,
        filename: str = "export",
        title: Optional[str] = None
    ) -> bytes:
        """
        콘텐츠를 텍스트 파일로 변환 (마크다운 서식 제거)

        Args:
            content: 마크다운 형식의 텍스트
            filename: 파일명 (확장자 제외)
            title: 문서 제목 (선택사항)

        Returns:
            bytes: 텍스트 파일 바이너리
        """
        output_lines = []

        # 제목 추가 (선택사항)
        if title:
            output_lines.append(title)
            # 디스플레이 너비 기준으로 밑줄 생성 (한글은 2칸)
            output_lines.append("=" * self._get_display_width(title))
            output_lines.append("")

        # 특수 공백 정규화 후 마크다운 서식 제거
        normalized_content = normalize_spaces(content)
        clean_content = self._remove_markdown_formatting(normalized_content)
        output_lines.append(clean_content)

        # 생성 정보 추가
        output_lines.append("")
        output_lines.append("-" * 40)
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        output_lines.append(f"생성일시: {now}")

        result = '\n'.join(output_lines)
        logger.info(f"[TextExport] Text export: {len(result)} chars")

        return result.encode('utf-8')

    async def handle_export_to_markdown(
        self,
        tool_call_id: str,
        arguments: dict
    ) -> ToolResult:
        """
        export_to_md 도구 핸들러

        Args:
            tool_call_id: 도구 호출 ID
            arguments: 도구 인자
                - content: 내보낼 내용
                - filename: 파일명 (선택)
                - title: 문서 제목 (선택)

        Returns:
            ToolResult: 실행 결과
        """
        try:
            content = arguments.get("content", "")
            if not content:
                return ToolResult(
                    tool_call_id=tool_call_id,
                    tool_name="export_to_md",
                    success=False,
                    action_type="message",
                    error="내보낼 내용이 없습니다."
                )

            filename = arguments.get("filename", "export")
            title = arguments.get("title")

            # 마크다운 생성
            md_bytes = self.export_to_markdown(content, filename, title)

            # 파일 저장소에 저장
            if filename.lower().endswith('.md'):
                full_filename = filename
            else:
                full_filename = f"{filename}.md"

            file_id = file_storage.store(
                filename=full_filename,
                content=md_bytes,
                content_type="text/markdown; charset=utf-8"
            )

            return ToolResult(
                tool_call_id=tool_call_id,
                tool_name="export_to_md",
                success=True,
                action_type="download",
                file_id=file_id,
                filename=full_filename,
                content_type="text/markdown; charset=utf-8",
                message=f"마크다운 파일 '{full_filename}'이(가) 생성되었습니다."
            )

        except FileSizeExceededError as e:
            logger.warning(f"[TextExport] File size exceeded: {e}")
            return ToolResult(
                tool_call_id=tool_call_id,
                tool_name="export_to_md",
                success=False,
                action_type="message",
                error=str(e)
            )

        except StorageCapacityExceededError as e:
            logger.warning(f"[TextExport] Storage capacity exceeded: {e}")
            return ToolResult(
                tool_call_id=tool_call_id,
                tool_name="export_to_md",
                success=False,
                action_type="message",
                error=str(e)
            )

        except Exception as e:
            logger.error(f"[TextExport] Markdown export failed: {e}")
            return ToolResult(
                tool_call_id=tool_call_id,
                tool_name="export_to_md",
                success=False,
                action_type="message",
                error=f"마크다운 파일 생성 중 오류가 발생했습니다: {str(e)}"
            )

    async def handle_export_to_text(
        self,
        tool_call_id: str,
        arguments: dict
    ) -> ToolResult:
        """
        export_to_txt 도구 핸들러

        Args:
            tool_call_id: 도구 호출 ID
            arguments: 도구 인자
                - content: 내보낼 내용
                - filename: 파일명 (선택)
                - title: 문서 제목 (선택)

        Returns:
            ToolResult: 실행 결과
        """
        try:
            content = arguments.get("content", "")
            if not content:
                return ToolResult(
                    tool_call_id=tool_call_id,
                    tool_name="export_to_txt",
                    success=False,
                    action_type="message",
                    error="내보낼 내용이 없습니다."
                )

            filename = arguments.get("filename", "export")
            title = arguments.get("title")

            # 텍스트 생성
            txt_bytes = self.export_to_text(content, filename, title)

            # 파일 저장소에 저장
            if filename.lower().endswith('.txt'):
                full_filename = filename
            else:
                full_filename = f"{filename}.txt"

            file_id = file_storage.store(
                filename=full_filename,
                content=txt_bytes,
                content_type="text/plain; charset=utf-8"
            )

            return ToolResult(
                tool_call_id=tool_call_id,
                tool_name="export_to_txt",
                success=True,
                action_type="download",
                file_id=file_id,
                filename=full_filename,
                content_type="text/plain; charset=utf-8",
                message=f"텍스트 파일 '{full_filename}'이(가) 생성되었습니다."
            )

        except FileSizeExceededError as e:
            logger.warning(f"[TextExport] File size exceeded: {e}")
            return ToolResult(
                tool_call_id=tool_call_id,
                tool_name="export_to_txt",
                success=False,
                action_type="message",
                error=str(e)
            )

        except StorageCapacityExceededError as e:
            logger.warning(f"[TextExport] Storage capacity exceeded: {e}")
            return ToolResult(
                tool_call_id=tool_call_id,
                tool_name="export_to_txt",
                success=False,
                action_type="message",
                error=str(e)
            )

        except Exception as e:
            logger.error(f"[TextExport] Text export failed: {e}")
            return ToolResult(
                tool_call_id=tool_call_id,
                tool_name="export_to_txt",
                success=False,
                action_type="message",
                error=f"텍스트 파일 생성 중 오류가 발생했습니다: {str(e)}"
            )


# 싱글톤 인스턴스
chat_text_export_service = ChatTextExportService()
