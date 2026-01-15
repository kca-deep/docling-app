"""
채팅 PDF 내보내기 서비스
LLM 응답 데이터를 PDF 파일로 변환합니다.
마크다운 형식의 콘텐츠를 구조화된 PDF로 변환합니다.
"""

import logging
import re
from io import BytesIO
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Tuple
from dataclasses import dataclass
from enum import Enum

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph,
    Spacer, Preformatted, ListFlowable, ListItem
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

from backend.services.tool_executor_service import (
    ToolResult,
    file_storage,
    FileSizeExceededError,
    StorageCapacityExceededError
)
from backend.utils.text_normalizer import normalize_spaces

logger = logging.getLogger("uvicorn")

# 한글 폰트 경로 (pdf_service.py와 동일)
FONT_PATHS = [
    Path(__file__).parent.parent / "fonts" / "NanumGothic.ttf",
    Path("/usr/share/fonts/truetype/nanum/NanumGothic.ttf"),
    Path("/usr/share/fonts/nanum/NanumGothic.ttf"),
    Path("C:/Windows/Fonts/malgun.ttf"),
]


class ElementType(Enum):
    """PDF 요소 타입"""
    HEADING1 = "h1"
    HEADING2 = "h2"
    HEADING3 = "h3"
    HEADING4 = "h4"
    PARAGRAPH = "paragraph"
    LIST_ITEM = "list"
    NUMBERED_LIST = "numbered"
    CODE_BLOCK = "code"
    BLOCKQUOTE = "quote"
    TABLE = "table"
    HORIZONTAL_RULE = "hr"
    EMPTY = "empty"


@dataclass
class ParsedElement:
    """파싱된 요소"""
    element_type: ElementType
    content: str
    level: int = 0
    cells: List[List[str]] = None
    number: int = 0  # 순서 목록 번호


class ChatPDFExportService:
    """
    채팅 데이터를 PDF로 내보내는 서비스
    마크다운 형식의 콘텐츠를 구조화된 PDF로 변환합니다.
    """

    def __init__(self):
        self.font_name = "NanumGothic"
        self.font_registered = False
        self._register_korean_font()
        self._styles = None

    def _register_korean_font(self):
        """한글 폰트 등록"""
        if self.font_registered:
            return

        for font_path in FONT_PATHS:
            if font_path.exists():
                try:
                    pdfmetrics.registerFont(TTFont(self.font_name, str(font_path)))
                    self.font_registered = True
                    logger.info(f"[PDFExport] Korean font registered: {font_path}")
                    return
                except Exception as e:
                    logger.warning(f"[PDFExport] Failed to register font {font_path}: {e}")

        logger.warning("[PDFExport] Korean font not found, using default font")
        self.font_name = "Helvetica"

    def _get_styles(self) -> dict:
        """PDF 스타일 정의"""
        if self._styles:
            return self._styles

        base_styles = getSampleStyleSheet()

        self._styles = {
            "title": ParagraphStyle(
                "title",
                parent=base_styles["Title"],
                fontName=self.font_name,
                fontSize=16,
                spaceAfter=12,
                alignment=1
            ),
            "h1": ParagraphStyle(
                "h1",
                parent=base_styles["Heading1"],
                fontName=self.font_name,
                fontSize=14,
                spaceBefore=12,
                spaceAfter=8,
                textColor=colors.HexColor("#1e3a5f")
            ),
            "h2": ParagraphStyle(
                "h2",
                parent=base_styles["Heading2"],
                fontName=self.font_name,
                fontSize=12,
                spaceBefore=10,
                spaceAfter=6,
                textColor=colors.HexColor("#2c5282")
            ),
            "h3": ParagraphStyle(
                "h3",
                parent=base_styles["Heading3"],
                fontName=self.font_name,
                fontSize=11,
                spaceBefore=8,
                spaceAfter=4,
                textColor=colors.HexColor("#3182ce")
            ),
            "h4": ParagraphStyle(
                "h4",
                parent=base_styles["Heading4"],
                fontName=self.font_name,
                fontSize=10,
                spaceBefore=6,
                spaceAfter=4,
                textColor=colors.HexColor("#4299e1")
            ),
            "normal": ParagraphStyle(
                "normal",
                parent=base_styles["Normal"],
                fontName=self.font_name,
                fontSize=10,
                spaceAfter=6,
                leading=14
            ),
            "code": ParagraphStyle(
                "code",
                parent=base_styles["Code"],
                fontName="Courier",
                fontSize=9,
                backColor=colors.HexColor("#f5f5f5"),
                borderColor=colors.HexColor("#e0e0e0"),
                borderWidth=1,
                borderPadding=5,
                spaceAfter=8
            ),
            "quote": ParagraphStyle(
                "quote",
                parent=base_styles["Normal"],
                fontName=self.font_name,
                fontSize=10,
                leftIndent=20,
                textColor=colors.HexColor("#666666"),
                backColor=colors.HexColor("#fff8e1"),
                borderPadding=8,
                spaceAfter=8
            ),
            "list": ParagraphStyle(
                "list",
                parent=base_styles["Normal"],
                fontName=self.font_name,
                fontSize=10,
                leftIndent=15,
                spaceAfter=3
            ),
            "footer": ParagraphStyle(
                "footer",
                parent=base_styles["Normal"],
                fontName=self.font_name,
                fontSize=8,
                textColor=colors.gray,
                alignment=1
            )
        }

        return self._styles

    def _clean_text_for_pdf(self, text: str) -> str:
        """PDF용 텍스트 정리 (특수문자 이스케이프)"""
        # XML 특수문자 이스케이프
        text = text.replace('&', '&amp;')
        text = text.replace('<', '&lt;')
        text = text.replace('>', '&gt;')

        # 인라인 마크다운 서식 변환
        # 볼드
        text = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', text)
        # 이탤릭
        text = re.sub(r'\*(.+?)\*', r'<i>\1</i>', text)
        # 인라인 코드 - 한글 지원을 위해 배경색만 적용 (Courier는 한글 미지원)
        text = re.sub(
            r'`([^`]+)`',
            rf'<font backColor="#e8e8e8" fontName="{self.font_name}">\1</font>',
            text
        )
        # 링크 - 텍스트만 추출
        text = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', text)

        return text

    def _parse_markdown_content(self, content: str) -> List[ParsedElement]:
        """마크다운 콘텐츠를 요소 리스트로 파싱"""
        elements = []
        lines = content.strip().split('\n')
        in_code_block = False
        code_block_content = []
        in_table = False
        table_rows = []

        i = 0
        while i < len(lines):
            line = lines[i]
            stripped = line.strip()

            # 코드 블록 처리
            if stripped.startswith('```'):
                if in_code_block:
                    # 코드 블록 종료
                    if code_block_content:
                        elements.append(ParsedElement(
                            element_type=ElementType.CODE_BLOCK,
                            content='\n'.join(code_block_content)
                        ))
                    code_block_content = []
                    in_code_block = False
                else:
                    # 코드 블록 시작
                    in_code_block = True
                i += 1
                continue

            if in_code_block:
                code_block_content.append(line)
                i += 1
                continue

            # 테이블 종료 체크
            if in_table and (not stripped or not '|' in stripped):
                if table_rows:
                    elements.append(ParsedElement(
                        element_type=ElementType.TABLE,
                        content="",
                        cells=table_rows
                    ))
                table_rows = []
                in_table = False

            # 빈 줄
            if not stripped:
                elements.append(ParsedElement(element_type=ElementType.EMPTY, content=""))
                i += 1
                continue

            # 수평선
            if re.match(r'^[-*_]{3,}\s*$', stripped):
                elements.append(ParsedElement(element_type=ElementType.HORIZONTAL_RULE, content=""))
                i += 1
                continue

            # 테이블 구분선 스킵 (|---|---|---| 형식)
            if re.match(r'^\|[\s\-:|\s]+\|$', stripped) and '-' in stripped:
                # 구분선인지 확인: 셀 내용이 모두 - 또는 : 로만 구성
                cells = [c.strip() for c in stripped.split('|')]
                cells = [c for c in cells if c]
                if all(re.match(r'^[\-:]+$', cell) for cell in cells):
                    i += 1
                    continue

            # 테이블 행
            if '|' in stripped and stripped.startswith('|'):
                in_table = True
                cells = [c.strip() for c in stripped.split('|')]
                cells = [c for c in cells if c]
                if cells:
                    table_rows.append(cells)
                i += 1
                continue

            # 제목
            heading_match = re.match(r'^(#{1,4})\s+(.+)$', stripped)
            if heading_match:
                level = len(heading_match.group(1))
                text = heading_match.group(2).strip()
                element_type = {
                    1: ElementType.HEADING1,
                    2: ElementType.HEADING2,
                    3: ElementType.HEADING3,
                    4: ElementType.HEADING4
                }.get(level, ElementType.HEADING4)
                elements.append(ParsedElement(element_type=element_type, content=text))
                i += 1
                continue

            # 인용
            if stripped.startswith('>'):
                text = stripped.lstrip('>').strip()
                elements.append(ParsedElement(element_type=ElementType.BLOCKQUOTE, content=text))
                i += 1
                continue

            # 순서 없는 목록
            list_match = re.match(r'^(\s*)([-*+])\s+(.+)$', line)
            if list_match:
                indent = len(list_match.group(1))
                level = indent // 2
                text = list_match.group(3).strip()
                elements.append(ParsedElement(
                    element_type=ElementType.LIST_ITEM,
                    content=text,
                    level=level
                ))
                i += 1
                continue

            # 순서 있는 목록
            numbered_match = re.match(r'^(\s*)(\d+)\.\s+(.+)$', line)
            if numbered_match:
                indent = len(numbered_match.group(1))
                level = indent // 2
                number = int(numbered_match.group(2))  # 번호 추출
                text = numbered_match.group(3).strip()
                elements.append(ParsedElement(
                    element_type=ElementType.NUMBERED_LIST,
                    content=text,
                    level=level,
                    number=number  # 번호 저장
                ))
                i += 1
                continue

            # 일반 단락
            elements.append(ParsedElement(element_type=ElementType.PARAGRAPH, content=stripped))
            i += 1

        # 코드 블록이 닫히지 않은 경우
        if code_block_content:
            elements.append(ParsedElement(
                element_type=ElementType.CODE_BLOCK,
                content='\n'.join(code_block_content)
            ))

        # 테이블이 끝나지 않은 경우
        if table_rows:
            elements.append(ParsedElement(
                element_type=ElementType.TABLE,
                content="",
                cells=table_rows
            ))

        return elements

    def _create_table(self, rows: List[List[str]]) -> Table:
        """테이블 생성"""
        if not rows:
            return None

        styles = self._get_styles()
        col_count = max(len(row) for row in rows)

        # 데이터 정규화 (모든 행의 열 수 맞추기)
        normalized_rows = []
        for row in rows:
            normalized_row = row + [''] * (col_count - len(row))
            # 셀 내용을 Paragraph로 변환
            para_row = [
                Paragraph(self._clean_text_for_pdf(cell), styles["normal"])
                for cell in normalized_row
            ]
            normalized_rows.append(para_row)

        # 테이블 생성
        col_width = (170 * mm - 40 * mm) / col_count
        table = Table(normalized_rows, colWidths=[col_width] * col_count)

        # 테이블 스타일
        style_commands = [
            ("FONTNAME", (0, 0), (-1, -1), self.font_name),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e0e0e0")),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ]

        # 첫 행은 헤더 스타일
        if len(normalized_rows) > 1:
            style_commands.extend([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#3182ce")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), self.font_name),
            ])

        table.setStyle(TableStyle(style_commands))
        return table

    def export_to_pdf(
        self,
        content: str,
        filename: str = "export",
        title: Optional[str] = None
    ) -> bytes:
        """
        마크다운 콘텐츠를 PDF로 변환

        Args:
            content: 마크다운 형식의 텍스트
            filename: 파일명 (확장자 제외)
            title: 문서 제목 (선택사항)

        Returns:
            bytes: PDF 파일 바이너리
        """
        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=20 * mm,
            leftMargin=20 * mm,
            topMargin=20 * mm,
            bottomMargin=20 * mm
        )

        styles = self._get_styles()
        elements = []

        # 제목 추가
        if title:
            elements.append(Paragraph(title, styles["title"]))
            elements.append(Spacer(1, 10))

        # 특수 공백 정규화 후 마크다운 파싱
        content = normalize_spaces(content)
        parsed_elements = self._parse_markdown_content(content)
        logger.info(f"[PDFExport] Parsed {len(parsed_elements)} elements")

        # 요소별 PDF 변환
        for elem in parsed_elements:
            if elem.element_type == ElementType.EMPTY:
                elements.append(Spacer(1, 6))

            elif elem.element_type == ElementType.HORIZONTAL_RULE:
                from reportlab.platypus import HRFlowable
                elements.append(HRFlowable(width="100%", thickness=1, color=colors.gray))

            elif elem.element_type == ElementType.HEADING1:
                clean_text = self._clean_text_for_pdf(elem.content)
                elements.append(Paragraph(clean_text, styles["h1"]))

            elif elem.element_type == ElementType.HEADING2:
                clean_text = self._clean_text_for_pdf(elem.content)
                elements.append(Paragraph(clean_text, styles["h2"]))

            elif elem.element_type == ElementType.HEADING3:
                clean_text = self._clean_text_for_pdf(elem.content)
                elements.append(Paragraph(clean_text, styles["h3"]))

            elif elem.element_type == ElementType.HEADING4:
                clean_text = self._clean_text_for_pdf(elem.content)
                elements.append(Paragraph(clean_text, styles["h4"]))

            elif elem.element_type == ElementType.CODE_BLOCK:
                elements.append(Preformatted(elem.content, styles["code"]))

            elif elem.element_type == ElementType.BLOCKQUOTE:
                clean_text = self._clean_text_for_pdf(elem.content)
                elements.append(Paragraph(clean_text, styles["quote"]))

            elif elem.element_type == ElementType.LIST_ITEM:
                indent = "    " * elem.level
                bullet = "•"
                clean_text = self._clean_text_for_pdf(elem.content)
                list_style = ParagraphStyle(
                    f"list_{elem.level}",
                    parent=styles["list"],
                    leftIndent=15 + (elem.level * 15)
                )
                elements.append(Paragraph(f"{bullet} {clean_text}", list_style))

            elif elem.element_type == ElementType.NUMBERED_LIST:
                clean_text = self._clean_text_for_pdf(elem.content)
                list_style = ParagraphStyle(
                    f"numbered_{elem.level}",
                    parent=styles["list"],
                    leftIndent=15 + (elem.level * 15)
                )
                # 번호 포함하여 출력
                elements.append(Paragraph(f"{elem.number}. {clean_text}", list_style))

            elif elem.element_type == ElementType.TABLE:
                if elem.cells:
                    table = self._create_table(elem.cells)
                    if table:
                        elements.append(table)
                        elements.append(Spacer(1, 8))

            elif elem.element_type == ElementType.PARAGRAPH:
                clean_text = self._clean_text_for_pdf(elem.content)
                elements.append(Paragraph(clean_text, styles["normal"]))

        # 푸터 추가
        elements.append(Spacer(1, 20))
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        elements.append(Paragraph(f"생성일시: {now}", styles["footer"]))

        # 페이지 번호 콜백 함수
        def add_page_number(canvas, doc):
            """페이지 하단에 페이지 번호 추가"""
            canvas.saveState()
            canvas.setFont(self.font_name, 8)
            page_num = canvas.getPageNumber()
            text = f"- {page_num} -"
            canvas.drawCentredString(A4[0] / 2, 15 * mm, text)
            canvas.restoreState()

        # PDF 생성 (페이지 번호 포함)
        doc.build(elements, onFirstPage=add_page_number, onLaterPages=add_page_number)
        logger.info(f"[PDFExport] PDF generated: {buffer.tell()} bytes")

        return buffer.getvalue()

    async def handle_export_to_pdf(
        self,
        tool_call_id: str,
        arguments: dict
    ) -> ToolResult:
        """
        export_to_pdf 도구 핸들러

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
                    tool_name="export_to_pdf",
                    success=False,
                    action_type="message",
                    error="내보낼 내용이 없습니다."
                )

            filename = arguments.get("filename", "export")
            title = arguments.get("title")

            # PDF 생성
            pdf_bytes = self.export_to_pdf(content, filename, title)

            # 파일 저장소에 저장
            if filename.lower().endswith('.pdf'):
                full_filename = filename
            else:
                full_filename = f"{filename}.pdf"

            file_id = file_storage.store(
                filename=full_filename,
                content=pdf_bytes,
                content_type="application/pdf"
            )

            return ToolResult(
                tool_call_id=tool_call_id,
                tool_name="export_to_pdf",
                success=True,
                action_type="download",
                file_id=file_id,
                filename=full_filename,
                content_type="application/pdf",
                message=f"PDF 파일 '{full_filename}'이(가) 생성되었습니다."
            )

        except FileSizeExceededError as e:
            logger.warning(f"[PDFExport] File size exceeded: {e}")
            return ToolResult(
                tool_call_id=tool_call_id,
                tool_name="export_to_pdf",
                success=False,
                action_type="message",
                error=str(e)
            )

        except StorageCapacityExceededError as e:
            logger.warning(f"[PDFExport] Storage capacity exceeded: {e}")
            return ToolResult(
                tool_call_id=tool_call_id,
                tool_name="export_to_pdf",
                success=False,
                action_type="message",
                error=str(e)
            )

        except Exception as e:
            logger.error(f"[PDFExport] PDF export failed: {e}")
            return ToolResult(
                tool_call_id=tool_call_id,
                tool_name="export_to_pdf",
                success=False,
                action_type="message",
                error=f"PDF 파일 생성 중 오류가 발생했습니다: {str(e)}"
            )


# 싱글톤 인스턴스
chat_pdf_export_service = ChatPDFExportService()
