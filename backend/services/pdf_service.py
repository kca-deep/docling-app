"""
PDF 생성 서비스
셀프진단 결과 PDF 리포트 생성
"""
import logging
from io import BytesIO
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Optional

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph,
    Spacer, PageBreak, HRFlowable
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

from backend.models.schemas import SelfCheckDetailResponse, SelfCheckItemResult

logger = logging.getLogger(__name__)

# 한글 폰트 경로 (시스템 폰트 또는 프로젝트 폰트)
FONT_PATHS = [
    Path(__file__).parent.parent / "fonts" / "NanumGothic.ttf",
    Path("/usr/share/fonts/truetype/nanum/NanumGothic.ttf"),
    Path("/usr/share/fonts/nanum/NanumGothic.ttf"),
    Path("C:/Windows/Fonts/malgun.ttf"),  # Windows
]


class PDFService:
    """셀프진단 결과 PDF 생성 서비스"""

    def __init__(self):
        self.font_name = "NanumGothic"
        self.font_registered = False
        self._register_korean_font()

    def _register_korean_font(self):
        """한글 폰트 등록"""
        if self.font_registered:
            return

        for font_path in FONT_PATHS:
            if font_path.exists():
                try:
                    pdfmetrics.registerFont(TTFont(self.font_name, str(font_path)))
                    self.font_registered = True
                    logger.info(f"Korean font registered: {font_path}")
                    return
                except Exception as e:
                    logger.warning(f"Failed to register font {font_path}: {e}")

        # 폰트를 찾지 못한 경우 기본 폰트 사용
        logger.warning("Korean font not found, using default font")
        self.font_name = "Helvetica"

    def _get_styles(self) -> Dict[str, ParagraphStyle]:
        """PDF 스타일 정의"""
        base_styles = getSampleStyleSheet()

        return {
            "title": ParagraphStyle(
                "title",
                parent=base_styles["Title"],
                fontName=self.font_name,
                fontSize=18,
                spaceAfter=20,
                alignment=1  # Center
            ),
            "subtitle": ParagraphStyle(
                "subtitle",
                parent=base_styles["Normal"],
                fontName=self.font_name,
                fontSize=12,
                textColor=colors.gray,
                spaceAfter=30,
                alignment=1
            ),
            "heading1": ParagraphStyle(
                "heading1",
                parent=base_styles["Heading1"],
                fontName=self.font_name,
                fontSize=14,
                spaceBefore=20,
                spaceAfter=10,
                textColor=colors.HexColor("#1a365d")
            ),
            "heading2": ParagraphStyle(
                "heading2",
                parent=base_styles["Heading2"],
                fontName=self.font_name,
                fontSize=12,
                spaceBefore=15,
                spaceAfter=8,
                textColor=colors.HexColor("#2c5282")
            ),
            "normal": ParagraphStyle(
                "normal",
                parent=base_styles["Normal"],
                fontName=self.font_name,
                fontSize=10,
                spaceAfter=6
            ),
            "small": ParagraphStyle(
                "small",
                parent=base_styles["Normal"],
                fontName=self.font_name,
                fontSize=8,
                textColor=colors.gray
            ),
            "warning": ParagraphStyle(
                "warning",
                parent=base_styles["Normal"],
                fontName=self.font_name,
                fontSize=11,
                textColor=colors.HexColor("#c53030"),
                spaceBefore=10,
                spaceAfter=10
            ),
            "success": ParagraphStyle(
                "success",
                parent=base_styles["Normal"],
                fontName=self.font_name,
                fontSize=11,
                textColor=colors.HexColor("#276749"),
                spaceBefore=10,
                spaceAfter=10
            )
        }

    def _answer_to_korean(self, answer: Optional[str]) -> str:
        """답변 값을 한국어로 변환"""
        mapping = {
            "yes": "예",
            "no": "아니오",
            "unknown": "모름",
            "need_check": "확인필요"
        }
        return mapping.get(answer, "-") if answer else "-"

    def _get_match_status_text(self, status: str) -> str:
        """일치 상태 텍스트"""
        mapping = {
            "match": "일치",
            "mismatch": "불일치",
            "reference": "AI참조",
            "keep": "유지"
        }
        return mapping.get(status, status)

    def _get_match_status_color(self, status: str) -> colors.Color:
        """일치 상태 색상"""
        mapping = {
            "match": colors.HexColor("#276749"),      # 녹색
            "mismatch": colors.HexColor("#c53030"),   # 빨간색
            "reference": colors.HexColor("#2b6cb0"),  # 파란색
            "keep": colors.gray
        }
        return mapping.get(status, colors.black)

    async def generate_selfcheck_report(
        self,
        submission: SelfCheckDetailResponse
    ) -> bytes:
        """
        셀프진단 결과 PDF 생성

        Args:
            submission: 셀프진단 상세 정보

        Returns:
            bytes: PDF 파일 바이트
        """
        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=20*mm,
            leftMargin=20*mm,
            topMargin=20*mm,
            bottomMargin=20*mm
        )

        styles = self._get_styles()
        elements = []

        # === 1. 제목 ===
        elements.append(Paragraph(
            "AI 과제 보안성 검토 셀프진단 결과",
            styles["title"]
        ))
        elements.append(Paragraph(
            "한국방송통신전파진흥원",
            styles["subtitle"]
        ))
        elements.append(Spacer(1, 10))

        # === 2. 과제 기본정보 ===
        elements.append(Paragraph("1. 과제 기본정보", styles["heading1"]))

        info_data = [
            ["항목", "내용"],
            ["과제명", submission.project_name],
            ["담당부서", submission.department],
            ["담당자", submission.manager_name],
            ["연락처", submission.contact or "-"],
            ["이메일", submission.email or "-"],
            ["진단일시", submission.created_at[:19].replace("T", " ") if submission.created_at else "-"],
        ]

        info_table = Table(info_data, colWidths=[80, 350])
        info_table.setStyle(TableStyle([
            ("FONTNAME", (0, 0), (-1, -1), self.font_name),
            ("FONTSIZE", (0, 0), (-1, -1), 10),
            ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#f7fafc")),
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2c5282")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("ALIGN", (0, 0), (0, -1), "LEFT"),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 8),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ]))
        elements.append(info_table)
        elements.append(Spacer(1, 15))

        # === 2. 사용자 입력 과제 내용 ===
        if submission.project_description:
            elements.append(Paragraph("2. 사용자 입력 과제 내용", styles["heading1"]))

            # 과제 내용을 줄바꿈 처리하여 표시
            desc_lines = submission.project_description.split('\n')
            for line in desc_lines:
                if line.strip():
                    # 특수문자 이스케이프 처리
                    safe_line = line.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
                    elements.append(Paragraph(safe_line, styles["normal"]))
                else:
                    elements.append(Spacer(1, 4))

            elements.append(Spacer(1, 15))

        # 섹션 번호 (project_description 유무에 따라 조정)
        section_num = 2 if submission.project_description else 2

        # === 상위기관 검토 대상 여부 ===
        if submission.project_description:
            section_num = 3
        elements.append(Paragraph(f"{section_num}. 상위기관 보안성 검토 대상 여부", styles["heading1"]))

        if submission.requires_review:
            elements.append(Paragraph(
                "검토 대상: 예 (상위기관 보안성 검토 필요)",
                styles["warning"]
            ))
            if submission.review_reason:
                elements.append(Paragraph(
                    f"사유: {submission.review_reason}",
                    styles["normal"]
                ))
        else:
            elements.append(Paragraph(
                "검토 대상: 아니오 (과제 추진 가능)",
                styles["success"]
            ))
        elements.append(Spacer(1, 15))

        # === 점검 항목 상세 ===
        section_num += 1
        elements.append(Paragraph(f"{section_num}. 점검 항목 상세", styles["heading1"]))

        # 필수 항목
        elements.append(Paragraph(f"{section_num}.1 필수 항목 (1~4번)", styles["heading2"]))

        required_items = [item for item in submission.items if item.item_category == "required"]
        if required_items:
            elements.append(self._create_items_table(required_items, styles))
        elements.append(Spacer(1, 15))

        # 선택 항목
        elements.append(Paragraph(f"{section_num}.2 선택 항목 (5~10번)", styles["heading2"]))

        optional_items = [item for item in submission.items if item.item_category == "optional"]
        if optional_items:
            elements.append(self._create_items_table(optional_items, styles))
        elements.append(Spacer(1, 20))

        # === 다음 단계 안내 ===
        section_num += 1
        elements.append(Paragraph(f"{section_num}. 다음 단계 안내", styles["heading1"]))

        if submission.requires_review:
            steps = [
                "1. 보안성 검토 서류 6종 작성",
                "2. 정보보호팀 제출 (security@kca.kr)",
                "3. CAIO/BAIO 추진과제 선정 회의 상정"
            ]
        else:
            steps = [
                "1. 과제 추진 가능",
                "2. 필요 시 정보보호팀 사전 상담 권장"
            ]

        for step in steps:
            elements.append(Paragraph(f"  {step}", styles["normal"]))

        elements.append(Spacer(1, 30))

        # === 6. 푸터 ===
        elements.append(HRFlowable(width="100%", color=colors.HexColor("#e2e8f0")))
        elements.append(Spacer(1, 10))

        footer_text = (
            f"본 문서는 AI가 자동 분석한 결과이며, 최종 판단은 정보보호팀의 검토를 거쳐야 합니다.\n"
            f"생성일시: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} | "
            f"분석모델: {submission.used_model or 'N/A'}"
        )
        elements.append(Paragraph(footer_text, styles["small"]))

        # PDF 생성
        doc.build(elements)
        return buffer.getvalue()

    def _create_items_table(
        self,
        items: List[SelfCheckItemResult],
        styles: Dict[str, ParagraphStyle]
    ) -> Table:
        """체크리스트 항목 테이블 생성"""
        # 헤더
        data = [["#", "점검 항목", "내 선택", "AI 분석", "신뢰도", "상태"]]

        for item in items:
            # 상태에 따른 색상 표시를 위해 Paragraph 사용
            status_style = ParagraphStyle(
                "status",
                fontName=self.font_name,
                fontSize=9,
                textColor=self._get_match_status_color(item.match_status)
            )

            data.append([
                str(item.item_number),
                Paragraph(item.short_label, styles["normal"]),
                self._answer_to_korean(item.user_answer),
                self._answer_to_korean(item.llm_answer),
                f"{int(item.llm_confidence * 100)}%",
                Paragraph(self._get_match_status_text(item.match_status), status_style)
            ])

        table = Table(data, colWidths=[25, 140, 55, 55, 45, 50])
        table.setStyle(TableStyle([
            ("FONTNAME", (0, 0), (-1, -1), self.font_name),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2c5282")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("ALIGN", (0, 0), (-1, 0), "CENTER"),
            ("ALIGN", (0, 1), (0, -1), "CENTER"),
            ("ALIGN", (2, 1), (-1, -1), "CENTER"),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f7fafc")])
        ]))

        return table


# 싱글톤 인스턴스
pdf_service = PDFService()
