"""
테스트용 PDF 파일 생성 스크립트
"""
try:
    from reportlab.pdfgen import canvas
    from reportlab.lib.pagesizes import A4
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
except ImportError:
    print("reportlab이 설치되어 있지 않습니다.")
    print("설치: pip install reportlab")
    exit(1)


def create_test_pdf(filename="test_sample.pdf", num_pages=3):
    """간단한 테스트 PDF 생성"""

    c = canvas.Canvas(filename, pagesize=A4)
    width, height = A4

    for page_num in range(1, num_pages + 1):
        # 제목
        c.setFont("Helvetica-Bold", 24)
        c.drawString(100, height - 100, f"Test Document - Page {page_num}")

        # 내용
        c.setFont("Helvetica", 12)
        y_position = height - 150

        lines = [
            f"This is page {page_num} of {num_pages}.",
            "",
            "Sample Content:",
            "- Line 1: Testing Docling API progress tracking",
            "- Line 2: Checking if API returns progress information",
            "- Line 3: Multiple pages to simulate longer processing",
            "",
            "Numbers: 123, 456, 789",
            "Date: 2025-11-13",
            "",
            "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
            "Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
        ]

        for line in lines:
            c.drawString(100, y_position, line)
            y_position -= 20

        # 페이지 번호
        c.setFont("Helvetica", 10)
        c.drawString(width / 2 - 20, 30, f"Page {page_num}/{num_pages}")

        # 다음 페이지 (마지막 페이지가 아니면)
        if page_num < num_pages:
            c.showPage()

    c.save()
    print(f"[OK] PDF 생성 완료: {filename}")
    print(f"     페이지 수: {num_pages}")


if __name__ == "__main__":
    import sys

    pages = 3  # 기본 3페이지
    if len(sys.argv) > 1:
        try:
            pages = int(sys.argv[1])
        except ValueError:
            print("페이지 수는 숫자여야 합니다")
            sys.exit(1)

    filename = "test_sample.pdf"
    if len(sys.argv) > 2:
        filename = sys.argv[2]

    create_test_pdf(filename, pages)
