"""
Document id=6 조회 스크립트
"""
import sqlite3
import json

# 데이터베이스 연결
conn = sqlite3.connect('docling.db')
cursor = conn.cursor()

# id=6 문서 조회
cursor.execute("""
    SELECT id, original_filename, status, created_at, md_content, parse_options, file_type, processing_time
    FROM documents
    WHERE id = 6
""")

row = cursor.fetchone()

if row:
    doc_id, filename, status, created_at, markdown_content, metadata, file_type, processing_time = row

    print("=" * 80)
    print(f"Document ID: {doc_id}")
    print(f"Filename: {filename}")
    print(f"File Type: {file_type}")
    print(f"Status: {status}")
    print(f"Processing Time: {processing_time}s" if processing_time else "N/A")
    print(f"Created At: {created_at}")
    print(f"Markdown Length: {len(markdown_content) if markdown_content else 0} characters")
    print("=" * 80)

    # 파싱 결과 저장
    with open('parsed_result_id6.txt', 'w', encoding='utf-8') as f:
        f.write(markdown_content if markdown_content else "")

    print(f"\n파싱 결과를 'parsed_result_id6.txt'에 저장했습니다.")

    # Parse Options 출력
    if metadata:
        print("\nParse Options:")
        print(json.dumps(json.loads(metadata), indent=2, ensure_ascii=False))

    # 마크다운 내용 미리보기 (처음 2000자)
    print("\n" + "=" * 80)
    print("파싱 결과 미리보기 (처음 2000자):")
    print("=" * 80)
    print(markdown_content[:2000] if markdown_content else "No content")
else:
    print("Document id=6을 찾을 수 없습니다.")

conn.close()
