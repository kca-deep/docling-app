"""
PDF 생성 서비스
셀프진단 결과 PDF 리포트 생성
"""
import logging
from io import BytesIO
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo
from typing import Dict, Any, List, Optional

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph,
    Spacer, PageBreak, HRFlowable, KeepTogether
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
                spaceAfter=12,
                alignment=1  # Center
            ),
            "subtitle": ParagraphStyle(
                "subtitle",
                parent=base_styles["Normal"],
                fontName=self.font_name,
                fontSize=12,
                textColor=colors.gray,
                spaceAfter=20,
                alignment=1
            ),
            "heading1": ParagraphStyle(
                "heading1",
                parent=base_styles["Heading1"],
                fontName=self.font_name,
                fontSize=12,
                spaceBefore=10,
                spaceAfter=6,
                textColor=colors.HexColor("#0f172a"),
                borderPadding=(0, 0, 0, 6),
                leftIndent=0
            ),
            "heading2": ParagraphStyle(
                "heading2",
                parent=base_styles["Heading2"],
                fontName=self.font_name,
                fontSize=11,
                spaceBefore=12,
                spaceAfter=8,
                textColor=colors.HexColor("#334155")
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
                fontSize=10,
                textColor=colors.HexColor("#b45309"),
                spaceBefore=8,
                spaceAfter=8,
                leftIndent=5
            ),
            "success": ParagraphStyle(
                "success",
                parent=base_styles["Normal"],
                fontName=self.font_name,
                fontSize=10,
                textColor=colors.HexColor("#059669"),
                spaceBefore=8,
                spaceAfter=8,
                leftIndent=5
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

        # === 1. 제목 (디자인 적용 - 프로덕션 색상) ===
        # 타이틀 박스 스타일 (컴팩트)
        title_style = ParagraphStyle(
            "title_box",
            parent=styles["title"],
            fontName=self.font_name,
            fontSize=16,
            textColor=colors.white,
            alignment=1,
            spaceAfter=0
        )
        sub_info_style = ParagraphStyle(
            "sub_info",
            fontName=self.font_name,
            fontSize=8,
            textColor=colors.HexColor("#e2e8f0"),
            alignment=1,
            spaceBefore=4
        )

        # 타이틀 박스 내용
        title_content = Paragraph("AI활용 아이디어 셀프진단 결과서", title_style)
        korea_time = datetime.now(ZoneInfo("Asia/Seoul")).strftime('%Y-%m-%d %H:%M:%S')
        sub_info_text = (
            f"본 문서는 AI가 자동 분석한 결과이며, 최종 판단은 정보보호팀의 검토를 거쳐야 합니다.<br/>"
            f"생성일시: {korea_time} | "
            f"분석모델: {submission.used_model or 'N/A'}"
        )
        sub_info_content = Paragraph(sub_info_text, sub_info_style)

        # 타이틀 테이블 (박스 디자인 - 프로덕션 blue-600)
        title_data = [[title_content], [sub_info_content]]
        title_table = Table(title_data, colWidths=[450])
        title_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#2563eb")),  # blue-600 프로덕션 컬러
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (0, 0), 12),
            ("BOTTOMPADDING", (0, 0), (0, 0), 2),
            ("TOPPADDING", (0, 1), (0, 1), 0),
            ("BOTTOMPADDING", (0, 1), (0, 1), 10),
            ("LEFTPADDING", (0, 0), (-1, -1), 15),
            ("RIGHTPADDING", (0, 0), (-1, -1), 15),
            ("BOX", (0, 0), (-1, -1), 1.5, colors.HexColor("#1d4ed8")),  # blue-700 테두리
        ]))
        elements.append(title_table)
        elements.append(Spacer(1, 12))

        # === 2. 과제 기본정보 (2열 컴팩트 레이아웃) ===
        elements.append(Paragraph("1. 과제 기본정보", styles["heading1"]))

        # 컴팩트 2열 레이아웃: 과제명은 전체 너비, 나머지는 2열 배치
        info_data = [
            ["과제명", submission.project_name, "", ""],
            ["담당부서", submission.department, "담당자", submission.manager_name],
            ["연락처", submission.contact or "-", "이메일", submission.email or "-"],
            ["진단일시", submission.created_at[:19].replace("T", " ") if submission.created_at else "-", "", ""],
        ]

        info_table = Table(info_data, colWidths=[55, 165, 55, 155])
        info_table.setStyle(TableStyle([
            ("FONTNAME", (0, 0), (-1, -1), self.font_name),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#f1f5f9")),
            ("BACKGROUND", (2, 0), (2, -1), colors.HexColor("#f1f5f9")),
            ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#475569")),
            ("TEXTCOLOR", (2, 0), (2, -1), colors.HexColor("#475569")),
            ("ALIGN", (0, 0), (0, -1), "LEFT"),
            ("ALIGN", (2, 0), (2, -1), "LEFT"),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            # 과제명 행: 2~4열 병합
            ("SPAN", (1, 0), (3, 0)),
            # 진단일시 행: 2~4열 병합
            ("SPAN", (1, 3), (3, 3)),
        ]))
        elements.append(info_table)
        elements.append(Spacer(1, 8))

        # === 2. 사용자 입력 과제 내용 (컴팩트 박스 스타일) ===
        if submission.project_description:
            elements.append(Paragraph("2. 사용자 입력 과제 내용", styles["heading1"]))

            # 과제 내용을 박스 안에 표시
            safe_desc = submission.project_description.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
            safe_desc = safe_desc.replace('\n', '<br/>')

            desc_box_style = ParagraphStyle(
                "desc_box",
                parent=styles["normal"],
                fontName=self.font_name,
                fontSize=9,
                leading=12,
                leftIndent=3,
                rightIndent=3,
            )

            desc_data = [[Paragraph(safe_desc, desc_box_style)]]
            desc_table = Table(desc_data, colWidths=[430])
            desc_table.setStyle(TableStyle([
                ("FONTNAME", (0, 0), (-1, -1), self.font_name),
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
                ("BOX", (0, 0), (-1, -1), 0.75, colors.HexColor("#cbd5e1")),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ]))
            elements.append(desc_table)
            elements.append(Spacer(1, 8))

        # 섹션 번호 (project_description 유무에 따라 조정)
        section_num = 2 if submission.project_description else 2

        # === 상위기관 검토 + 중복성 + AI종합의견을 같은 페이지에 출력 ===
        # KeepTogether로 묶을 요소들을 수집
        summary_section_elements = []

        # === 상위기관 검토 대상 여부 (카드 박스 스타일) ===
        if submission.project_description:
            section_num = 3
        summary_section_elements.append(Paragraph(f"{section_num}. 상위기관 보안성 검토 대상 여부", styles["heading1"]))

        # 카드 박스 스타일 적용 (미니 사이즈)
        if submission.requires_review:
            review_bg = colors.HexColor("#fef3c7")  # amber-100
            review_border = colors.HexColor("#f59e0b")  # amber-500
            review_text = "검토 대상: 예 (상위기관 보안성 검토 필요)"
            review_text_color = colors.HexColor("#b45309")  # amber-700
        else:
            review_bg = colors.HexColor("#dcfce7")  # green-100
            review_border = colors.HexColor("#22c55e")  # green-500
            review_text = "검토 대상: 아니오 (과제 추진 가능)"
            review_text_color = colors.HexColor("#166534")  # green-700

        review_inline_style = ParagraphStyle(
            "review_inline",
            fontName=self.font_name,
            fontSize=10,
            textColor=review_text_color,
            alignment=1
        )
        card_content = [[Paragraph(f"<b>{review_text}</b>", review_inline_style)]]

        # 카드 테이블 생성 (미니)
        review_card = Table(card_content, colWidths=[430])
        review_card.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), review_bg),
            ("BOX", (0, 0), (-1, -1), 1, review_border),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("LEFTPADDING", (0, 0), (-1, -1), 10),
            ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ]))
        summary_section_elements.append(review_card)
        summary_section_elements.append(Spacer(1, 6))

        # === 중복성 검토 결과 (같은 KeepTogether 그룹) ===
        if hasattr(submission, 'similar_projects') and submission.similar_projects:
            section_num += 1
            summary_section_elements.append(Paragraph(f"{section_num}. 중복성 검토 결과", styles["heading1"]))

            summary_section_elements.append(Paragraph(
                f"유사 과제 {len(submission.similar_projects)}건이 검출되었습니다.",
                styles["warning"]
            ))
            summary_section_elements.append(Spacer(1, 6))

            # 유사과제 테이블
            similar_data = [["과제명", "부서", "담당자", "유사도", "유사 사유"]]
            for sp in submission.similar_projects:
                project_name = sp.project_name[:20] + "..." if len(sp.project_name) > 20 else sp.project_name
                reason = sp.similarity_reason[:25] + "..." if len(sp.similarity_reason) > 25 else sp.similarity_reason
                similar_data.append([
                    Paragraph(project_name, styles["small"]),
                    sp.department[:6],
                    sp.manager_name[:4],
                    f"{sp.similarity_score}%",
                    Paragraph(reason, styles["small"])
                ])

            similar_table = Table(similar_data, colWidths=[110, 55, 40, 40, 185])
            similar_table.setStyle(TableStyle([
                ("FONTNAME", (0, 0), (-1, -1), self.font_name),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#c53030")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("ALIGN", (0, 0), (-1, 0), "CENTER"),
                ("ALIGN", (3, 1), (3, -1), "CENTER"),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#fff5f5")])
            ]))
            summary_section_elements.append(similar_table)
            summary_section_elements.append(Spacer(1, 8))

        # === AI 종합의견 (같은 KeepTogether 그룹) ===
        if hasattr(submission, 'summary') and submission.summary:
            section_num += 1
            summary_section_elements.append(Paragraph(f"{section_num}. AI 종합의견", styles["heading1"]))

            # 종합의견 박스 스타일 (컴팩트)
            summary_box_style = ParagraphStyle(
                "summary_box",
                parent=styles["normal"],
                fontName=self.font_name,
                fontSize=9,
                leading=13,
                leftIndent=5,
                rightIndent=5,
                textColor=colors.HexColor("#1e293b")
            )

            # 줄바꿈 처리
            safe_summary = submission.summary.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
            safe_summary = safe_summary.replace('\n', '<br/>')

            summary_data = [[Paragraph(safe_summary, summary_box_style)]]
            summary_table = Table(summary_data, colWidths=[430])
            summary_table.setStyle(TableStyle([
                ("FONTNAME", (0, 0), (-1, -1), self.font_name),
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f0f9ff")),  # blue-50
                ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#3b82f6")),   # blue-500
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 10),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
            ]))
            summary_section_elements.append(summary_table)

        # KeepTogether로 묶어서 같은 페이지에 출력
        elements.append(KeepTogether(summary_section_elements))
        elements.append(Spacer(1, 10))

        # === 점검 항목 상세 ===
        section_num += 1
        elements.append(Paragraph(f"{section_num}. 점검 항목 상세", styles["heading1"]))

        # 필수 항목
        elements.append(Paragraph(f"{section_num}.1 필수 항목 (1~5번)", styles["heading2"]))

        required_items = [item for item in submission.items if item.item_category == "required"]
        if required_items:
            elements.extend(self._create_items_table(required_items, styles))
        elements.append(Spacer(1, 15))

        # 선택 항목
        elements.append(Paragraph(f"{section_num}.2 선택 항목 (6~10번)", styles["heading2"]))

        optional_items = [item for item in submission.items if item.item_category == "optional"]
        if optional_items:
            elements.extend(self._create_items_table(optional_items, styles))
        elements.append(Spacer(1, 15))

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

        elements.append(Spacer(1, 20))

        # PDF 생성
        doc.build(elements)
        return buffer.getvalue()

    def _create_items_table(
        self,
        items: List[SelfCheckItemResult],
        styles: Dict[str, ParagraphStyle]
    ) -> List:
        """체크리스트 항목 테이블 및 상세 정보 생성 (웹 UI 스타일)"""
        elements = []

        # 스타일 정의
        item_header_style = ParagraphStyle(
            "item_header",
            fontName=self.font_name,
            fontSize=10,
            textColor=colors.HexColor("#1e293b"),
            spaceAfter=2
        )
        detail_label_style = ParagraphStyle(
            "detail_label",
            fontName=self.font_name,
            fontSize=8,
            textColor=colors.HexColor("#2563eb"),
            leftIndent=5
        )
        detail_text_style = ParagraphStyle(
            "detail_text",
            fontName=self.font_name,
            fontSize=9,
            textColor=colors.HexColor("#334155"),
            leftIndent=5,
            rightIndent=5
        )
        quote_text_style = ParagraphStyle(
            "quote_text",
            fontName=self.font_name,
            fontSize=9,
            textColor=colors.HexColor("#64748b"),
            leftIndent=5,
            rightIndent=5
        )
        warning_text_style = ParagraphStyle(
            "warning_text",
            fontName=self.font_name,
            fontSize=9,
            textColor=colors.HexColor("#b45309"),
            leftIndent=5,
            rightIndent=5
        )

        for item in items:
            # 상태에 따른 색상
            status_color = self._get_match_status_color(item.match_status)
            status_text = self._get_match_status_text(item.match_status)
            status_bg = {
                "match": colors.HexColor("#dcfce7"),      # green-100
                "mismatch": colors.HexColor("#fef3c7"),   # amber-100
                "reference": colors.HexColor("#dbeafe"),  # blue-100
                "keep": colors.HexColor("#f1f5f9")        # slate-100
            }.get(item.match_status, colors.HexColor("#f1f5f9"))

            # === 항목 카드 헤더 ===
            header_data = [[
                Paragraph(f"<b>[{item.item_number}] {item.short_label}</b>", item_header_style),
                Paragraph(f"<b>{status_text}</b>", ParagraphStyle(
                    "status_badge",
                    fontName=self.font_name,
                    fontSize=9,
                    textColor=status_color,
                    alignment=2  # Right align
                ))
            ]]
            header_table = Table(header_data, colWidths=[350, 80])
            header_table.setStyle(TableStyle([
                ("FONTNAME", (0, 0), (-1, -1), self.font_name),
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f1f5f9")),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                ("LEFTPADDING", (0, 0), (0, -1), 10),
                ("RIGHTPADDING", (-1, 0), (-1, -1), 10),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LINEBELOW", (0, 0), (-1, -1), 1, colors.HexColor("#e2e8f0")),
            ]))
            elements.append(header_table)

            # === 사용자/AI 비교 행 ===
            user_answer = self._answer_to_korean(item.user_answer)
            llm_answer = self._answer_to_korean(item.llm_answer)
            confidence = f"{int(item.llm_confidence * 100)}%"

            # 답변 색상
            user_color = colors.HexColor("#dc2626") if item.user_answer == "yes" else colors.HexColor("#16a34a") if item.user_answer == "no" else colors.gray
            llm_color = colors.HexColor("#dc2626") if item.llm_answer == "yes" else colors.HexColor("#16a34a") if item.llm_answer == "no" else colors.gray

            compare_data = [[
                Paragraph("내 선택:", ParagraphStyle("lbl", fontName=self.font_name, fontSize=8, textColor=colors.gray)),
                Paragraph(f"<b>{user_answer}</b>", ParagraphStyle("val", fontName=self.font_name, fontSize=9, textColor=user_color)),
                Paragraph("AI 분석:", ParagraphStyle("lbl", fontName=self.font_name, fontSize=8, textColor=colors.gray)),
                Paragraph(f"<b>{llm_answer}</b>", ParagraphStyle("val", fontName=self.font_name, fontSize=9, textColor=llm_color)),
                Paragraph(f"신뢰도: {confidence}", ParagraphStyle("conf", fontName=self.font_name, fontSize=8, textColor=colors.HexColor("#64748b")))
            ]]
            compare_table = Table(compare_data, colWidths=[50, 50, 50, 50, 80])
            compare_table.setStyle(TableStyle([
                ("FONTNAME", (0, 0), (-1, -1), self.font_name),
                ("BACKGROUND", (0, 0), (-1, -1), colors.white),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("LEFTPADDING", (0, 0), (0, -1), 10),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ]))
            elements.append(compare_table)

            # === AI 상세 분석 (있는 경우) ===
            detail_elements = []

            if item.llm_judgment:
                safe_judgment = item.llm_judgment.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
                detail_elements.append([
                    Paragraph("📌 판단:", detail_label_style),
                    Paragraph(safe_judgment, detail_text_style)
                ])

            if item.llm_quote and item.llm_quote != "관련 언급 없음":
                safe_quote = item.llm_quote.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
                detail_elements.append([
                    Paragraph("📝 인용:", ParagraphStyle("q_lbl", fontName=self.font_name, fontSize=8, textColor=colors.HexColor("#2563eb"), leftIndent=5)),
                    Paragraph(f'"{safe_quote}"', quote_text_style)
                ])

            if item.llm_reasoning:
                safe_reasoning = item.llm_reasoning.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
                detail_elements.append([
                    Paragraph("💡 분석:", ParagraphStyle("a_lbl", fontName=self.font_name, fontSize=8, textColor=colors.HexColor("#16a34a"), leftIndent=5)),
                    Paragraph(safe_reasoning, detail_text_style)
                ])

            if item.llm_user_comparison:
                safe_comparison = item.llm_user_comparison.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
                detail_elements.append([
                    Paragraph("⚠️ 비교:", ParagraphStyle("w_lbl", fontName=self.font_name, fontSize=8, textColor=colors.HexColor("#d97706"), leftIndent=5)),
                    Paragraph(safe_comparison, warning_text_style)
                ])

            if detail_elements:
                detail_table = Table(detail_elements, colWidths=[55, 375])
                detail_table.setStyle(TableStyle([
                    ("FONTNAME", (0, 0), (-1, -1), self.font_name),
                    ("BACKGROUND", (0, 0), (-1, -1), status_bg),
                    ("TOPPADDING", (0, 0), (-1, -1), 4),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                    ("LEFTPADDING", (0, 0), (-1, -1), 8),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ]))
                elements.append(detail_table)

            # 항목 간 간격
            elements.append(Spacer(1, 8))

        return elements

    async def generate_merged_pdf(
        self,
        submissions: List[SelfCheckDetailResponse]
    ) -> bytes:
        """
        여러 셀프진단 결과를 하나의 PDF로 병합

        Args:
            submissions: 셀프진단 상세 정보 목록

        Returns:
            bytes: 병합된 PDF 파일 바이트
        """
        from PyPDF2 import PdfMerger

        merger = PdfMerger()

        for submission in submissions:
            # 각 submission의 PDF 생성
            pdf_bytes = await self.generate_selfcheck_report(submission)
            pdf_buffer = BytesIO(pdf_bytes)
            merger.append(pdf_buffer)

        # 병합된 PDF 출력
        output_buffer = BytesIO()
        merger.write(output_buffer)
        merger.close()

        return output_buffer.getvalue()

    async def generate_individual_pdfs_zip(
        self,
        submissions: List[SelfCheckDetailResponse]
    ) -> bytes:
        """
        여러 셀프진단 결과를 개별 PDF로 생성하여 ZIP 압축

        Args:
            submissions: 셀프진단 상세 정보 목록

        Returns:
            bytes: ZIP 파일 바이트
        """
        import zipfile

        zip_buffer = BytesIO()

        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            for submission in submissions:
                # 각 submission의 PDF 생성
                pdf_bytes = await self.generate_selfcheck_report(submission)

                # 파일명 생성 (안전한 문자만 사용)
                safe_project_name = "".join(
                    c for c in submission.project_name
                    if c.isalnum() or c in " _-"
                )[:30] or "project"
                filename = f"{safe_project_name}_{submission.submission_id[:8]}.pdf"

                # ZIP에 추가
                zip_file.writestr(filename, pdf_bytes)

        return zip_buffer.getvalue()


# 싱글톤 인스턴스
pdf_service = PDFService()
