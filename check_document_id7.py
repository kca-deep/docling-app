"""
Document id=7 조회 및 품질 검증 스크립트
"""
import sqlite3
import json
import re

# 데이터베이스 연결
conn = sqlite3.connect('docling.db')
cursor = conn.cursor()

# id=7 문서 조회
cursor.execute("""
    SELECT id, original_filename, status, created_at, md_content, parse_options,
           file_type, processing_time, content_length
    FROM documents
    WHERE id = 7
""")

row = cursor.fetchone()

if row:
    doc_id, filename, status, created_at, markdown_content, metadata, file_type, processing_time, content_length = row

    print("=" * 80)
    print(f"Document ID: {doc_id}")
    print(f"Filename: {filename}")
    print(f"File Type: {file_type}")
    print(f"Status: {status}")
    print(f"Processing Time: {processing_time:.2f}s" if processing_time else "N/A")
    print(f"Created At: {created_at}")
    print(f"Content Length: {content_length} characters" if content_length else "N/A")
    print(f"Markdown Length: {len(markdown_content) if markdown_content else 0} characters")
    print("=" * 80)

    # 파싱 결과 저장
    with open('parsed_result_id7.txt', 'w', encoding='utf-8') as f:
        f.write(markdown_content if markdown_content else "")

    print(f"\n파싱 결과를 'parsed_result_id7.txt'에 저장했습니다.")

    # Parse Options 출력
    if metadata:
        print("\nParse Options:")
        try:
            options = json.loads(metadata)
            print(json.dumps(options, indent=2, ensure_ascii=False))
        except:
            print(metadata)

    # 품질 검증
    print("\n" + "=" * 80)
    print("품질 검증 결과:")
    print("=" * 80)

    if markdown_content:
        # 한글 비율
        korean_chars = len(re.findall(r'[가-힣]', markdown_content))
        total_chars = len(markdown_content.strip())
        korean_ratio = korean_chars / total_chars if total_chars > 0 else 0

        # 깨진 문자 감지
        garbled_chars = len(re.findall(r'[�]', markdown_content))

        # 영문/숫자
        english_chars = len(re.findall(r'[a-zA-Z]', markdown_content))
        digit_chars = len(re.findall(r'[0-9]', markdown_content))

        # 특수 한글 문자
        circle_numbers = len(re.findall(r'[①②③④⑤⑥⑦⑧⑨⑩]', markdown_content))
        korean_brackets = len(re.findall(r'[「」『』〈〉《》]', markdown_content))

        # 표 감지
        table_rows = len(re.findall(r'\|.*\|', markdown_content))
        table_separators = len(re.findall(r'\|\s*---\s*\|', markdown_content))

        # 페이지 구분
        page_markers = len(re.findall(r'##\s*페이지\s*\d+', markdown_content))

        print(f"총 문자 수: {total_chars:,}")
        print(f"한글 문자: {korean_chars:,} ({korean_ratio*100:.1f}%)")
        print(f"영문 문자: {english_chars:,}")
        print(f"숫자: {digit_chars:,}")
        print(f"깨진 문자(�): {garbled_chars:,}")
        print(f"\n특수 문자:")
        print(f"  - 원 숫자(①②③): {circle_numbers}")
        print(f"  - 한글 괄호(「」『』): {korean_brackets}")
        print(f"\n구조:")
        print(f"  - 페이지 마커: {page_markers}개")
        print(f"  - 표 행: {table_rows}개")
        print(f"  - 표 구분선: {table_separators}개")

        # 품질 점수 계산
        quality_score = 0
        if garbled_chars == 0:
            quality_score += 40  # 인코딩 정상
        if korean_ratio > 0.3:
            quality_score += 30  # 한글 비율 적절
        if page_markers > 0:
            quality_score += 15  # 페이지 구조 유지
        if table_rows > 0 and table_separators > 0:
            quality_score += 15  # 표 형식 정상

        print(f"\n종합 품질 점수: {quality_score}/100")

        if quality_score >= 80:
            print("✅ 우수 - 프로덕션 사용 가능")
        elif quality_score >= 60:
            print("⚠️ 양호 - 일부 개선 필요")
        elif quality_score >= 40:
            print("❌ 미흡 - 상당한 개선 필요")
        else:
            print("❌ 불량 - 사용 불가능")

    # 마크다운 내용 미리보기 (처음 2000자)
    print("\n" + "=" * 80)
    print("파싱 결과 미리보기 (처음 2000자):")
    print("=" * 80)
    print(markdown_content[:2000] if markdown_content else "No content")

    # 표 예시 혼입 검사
    print("\n" + "=" * 80)
    print("프롬프트 예시 혼입 검사:")
    print("=" * 80)

    suspect_patterns = [
        ("Header 1", "프롬프트 예시 표 헤더"),
        ("Data Cell", "프롬프트 예시 데이터"),
        ("Column1", "프롬프트 예시 컬럼"),
    ]

    found_issues = []
    for pattern, description in suspect_patterns:
        if pattern in markdown_content:
            count = markdown_content.count(pattern)
            found_issues.append(f"⚠️ '{pattern}' 발견 ({count}회) - {description}")

    if found_issues:
        print("문제 발견:")
        for issue in found_issues:
            print(f"  {issue}")
    else:
        print("✅ 프롬프트 예시 혼입 없음")

else:
    print("Document id=7을 찾을 수 없습니다.")

conn.close()
