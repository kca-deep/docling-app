"""
채팅 엑셀 내보내기 서비스
LLM 응답 데이터를 엑셀 파일로 변환합니다.
"""

import logging
import re
from io import BytesIO
from typing import List, Tuple, Optional
from datetime import datetime

from openpyxl import Workbook
from openpyxl.styles import Font, Alignment, Border, Side, PatternFill
from openpyxl.utils import get_column_letter

from backend.services.tool_executor_service import (
    ToolResult,
    file_storage,
    FileSizeExceededError,
    StorageCapacityExceededError
)

logger = logging.getLogger("uvicorn")


class ChatExcelExportService:
    """
    채팅 데이터를 엑셀로 내보내는 서비스
    CSV, 테이블 형식, 줄바꿈 구분 텍스트 등을 지원합니다.
    """

    # 스타일 상수
    HEADER_FILL = PatternFill(start_color="4472C4", end_color="4472C4", fill_type="solid")
    HEADER_FONT = Font(bold=True, color="FFFFFF")
    BORDER = Border(
        left=Side(style='thin'),
        right=Side(style='thin'),
        top=Side(style='thin'),
        bottom=Side(style='thin')
    )

    def __init__(self):
        pass

    def _parse_csv_data(self, data: str) -> List[List[str]]:
        """CSV 형식 데이터 파싱"""
        rows = []
        for line in data.strip().split('\n'):
            if line.strip():
                # 쉼표로 분리하되, 따옴표 내 쉼표는 보존
                cells = []
                current = ""
                in_quotes = False
                for char in line:
                    if char == '"':
                        in_quotes = not in_quotes
                    elif char == ',' and not in_quotes:
                        cells.append(current.strip().strip('"'))
                        current = ""
                    else:
                        current += char
                cells.append(current.strip().strip('"'))
                rows.append(cells)
        return rows

    def _parse_markdown_table(self, data: str) -> List[List[str]]:
        """마크다운 테이블 형식 파싱 (| 구분)"""
        rows = []
        for line in data.strip().split('\n'):
            line = line.strip()
            if not line or line.startswith('|--') or line.startswith('| --') or re.match(r'^\|[\s\-:]+\|$', line):
                # 구분선 스킵
                continue
            if '|' in line:
                # | 로 분리
                cells = [cell.strip() for cell in line.split('|')]
                # 앞뒤 빈 셀 제거
                cells = [c for c in cells if c or cells.index(c) not in [0, len(cells)-1]]
                if cells:
                    rows.append(cells)
        return rows

    def _parse_line_data(self, data: str) -> List[List[str]]:
        """줄바꿈 구분 데이터 파싱 (단일 컬럼)"""
        rows = []
        for line in data.strip().split('\n'):
            if line.strip():
                rows.append([line.strip()])
        return rows

    def _detect_and_parse(self, data: str) -> Tuple[List[List[str]], str]:
        """
        데이터 형식 자동 감지 및 파싱

        Returns:
            Tuple[rows, format_type]
        """
        data = data.strip()

        # 마크다운 테이블 감지
        if '|' in data and data.count('|') >= 2:
            rows = self._parse_markdown_table(data)
            if rows and len(rows[0]) > 1:
                return rows, "markdown_table"

        # CSV 형식 감지
        lines = data.split('\n')
        if len(lines) > 0 and ',' in lines[0]:
            rows = self._parse_csv_data(data)
            if rows and len(rows[0]) > 1:
                return rows, "csv"

        # 기본: 줄바꿈 구분
        rows = self._parse_line_data(data)
        return rows, "lines"

    def _apply_header_style(self, ws, row_num: int, col_count: int):
        """헤더 행 스타일 적용"""
        for col in range(1, col_count + 1):
            cell = ws.cell(row=row_num, column=col)
            cell.fill = self.HEADER_FILL
            cell.font = self.HEADER_FONT
            cell.alignment = Alignment(horizontal='center', vertical='center')
            cell.border = self.BORDER

    def _apply_cell_style(self, ws, row_num: int, col_count: int):
        """일반 셀 스타일 적용"""
        for col in range(1, col_count + 1):
            cell = ws.cell(row=row_num, column=col)
            cell.border = self.BORDER
            cell.alignment = Alignment(vertical='center', wrap_text=True)

    def _auto_adjust_column_width(self, ws):
        """컬럼 너비 자동 조정"""
        for column in ws.columns:
            max_length = 0
            column_letter = get_column_letter(column[0].column)
            for cell in column:
                try:
                    if cell.value:
                        cell_length = len(str(cell.value))
                        # 한글은 2배 너비
                        korean_count = len(re.findall(r'[\uac00-\ud7af]', str(cell.value)))
                        cell_length += korean_count
                        if cell_length > max_length:
                            max_length = cell_length
                except:
                    pass
            adjusted_width = min(max_length + 2, 50)  # 최대 50
            ws.column_dimensions[column_letter].width = max(adjusted_width, 10)

    def export_to_excel(
        self,
        data: str,
        filename: str = "export",
        sheet_name: str = "Sheet1"
    ) -> bytes:
        """
        데이터를 엑셀 파일로 변환

        Args:
            data: 변환할 데이터 (CSV, 마크다운 테이블, 또는 줄바꿈 텍스트)
            filename: 파일명 (확장자 제외)
            sheet_name: 시트 이름

        Returns:
            bytes: 엑셀 파일 바이너리
        """
        wb = Workbook()
        ws = wb.active
        ws.title = sheet_name

        # 데이터 파싱
        rows, format_type = self._detect_and_parse(data)
        logger.info(f"[ExcelExport] Detected format: {format_type}, rows: {len(rows)}")

        if not rows:
            # 빈 데이터인 경우 기본 메시지
            ws.cell(row=1, column=1, value="데이터가 없습니다.")
        else:
            col_count = max(len(row) for row in rows)

            for row_idx, row_data in enumerate(rows, 1):
                for col_idx, cell_value in enumerate(row_data, 1):
                    ws.cell(row=row_idx, column=col_idx, value=cell_value)

                # 첫 번째 행은 헤더로 스타일링
                if row_idx == 1:
                    self._apply_header_style(ws, row_idx, col_count)
                else:
                    self._apply_cell_style(ws, row_idx, col_count)

            # 컬럼 너비 자동 조정
            self._auto_adjust_column_width(ws)

        # 바이너리로 저장
        buffer = BytesIO()
        wb.save(buffer)
        buffer.seek(0)

        return buffer.getvalue()

    async def handle_export_to_excel(
        self,
        tool_call_id: str,
        arguments: dict
    ) -> ToolResult:
        """
        export_to_excel 도구 핸들러

        Args:
            tool_call_id: 도구 호출 ID
            arguments: 도구 인자
                - data: 내보낼 데이터
                - filename: 파일명 (선택)
                - sheet_name: 시트 이름 (선택)

        Returns:
            ToolResult: 실행 결과
        """
        try:
            data = arguments.get("data", "")
            if not data:
                return ToolResult(
                    tool_call_id=tool_call_id,
                    tool_name="export_to_excel",
                    success=False,
                    action_type="message",
                    error="내보낼 데이터가 없습니다."
                )

            filename = arguments.get("filename", "export")
            sheet_name = arguments.get("sheet_name", "Sheet1")

            # 엑셀 생성
            excel_bytes = self.export_to_excel(data, filename, sheet_name)

            # 파일 저장소에 저장 (중복 확장자 방지)
            if filename.lower().endswith('.xlsx'):
                full_filename = filename
            else:
                full_filename = f"{filename}.xlsx"
            file_id = file_storage.store(
                filename=full_filename,
                content=excel_bytes,
                content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            )

            return ToolResult(
                tool_call_id=tool_call_id,
                tool_name="export_to_excel",
                success=True,
                action_type="download",
                file_id=file_id,
                filename=full_filename,
                content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                message=f"엑셀 파일 '{full_filename}'이(가) 생성되었습니다."
            )

        except FileSizeExceededError as e:
            logger.warning(f"[ExcelExport] File size exceeded: {e}")
            return ToolResult(
                tool_call_id=tool_call_id,
                tool_name="export_to_excel",
                success=False,
                action_type="message",
                error=str(e)
            )

        except StorageCapacityExceededError as e:
            logger.warning(f"[ExcelExport] Storage capacity exceeded: {e}")
            return ToolResult(
                tool_call_id=tool_call_id,
                tool_name="export_to_excel",
                success=False,
                action_type="message",
                error=str(e)
            )

        except Exception as e:
            logger.error(f"[ExcelExport] Export failed: {e}")
            return ToolResult(
                tool_call_id=tool_call_id,
                tool_name="export_to_excel",
                success=False,
                action_type="message",
                error=f"엑셀 파일 생성 중 오류가 발생했습니다: {str(e)}"
            )


# 싱글톤 인스턴스
chat_excel_export_service = ChatExcelExportService()
