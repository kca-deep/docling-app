"""
Excel 컬럼 감지 유틸리티
qdrant.py에서 분리된 Excel 데이터 처리 헬퍼
"""
from typing import Dict, List

# 스마트 컬럼 감지 규칙
TEXT_CANDIDATES = ['full_text', 'content', 'text', 'answer_text', 'body', 'description']
ID_CANDIDATES = ['id', 'faq_id', 'law_id', 'doc_id', 'item_id', 'code']
TAG_CANDIDATES = ['tag', 'tags', 'category', 'categories', 'label', 'labels']
QA_QUESTION_CANDIDATES = ['question', 'q', 'query', 'title']
QA_ANSWER_CANDIDATES = ['answer', 'answer_text', 'a', 'response', 'content']
# headings 컬럼 후보 (문서명, 페이지 등 참조문서 표시에 사용)
HEADING_SOURCE_CANDIDATES = ['source', 'document', 'doc_name', 'file', 'filename', 'document_name', 'ref', 'reference']
HEADING_PAGE_CANDIDATES = ['page', 'page_number', 'page_no', 'pg', 'section', 'chapter']


def detect_column_mapping(headers: List[str]) -> Dict:
    """헤더를 분석하여 컬럼 매핑 자동 감지"""
    headers_lower = [h.lower() if h else '' for h in headers]

    detected = {
        "id_column": None,
        "text_columns": [],
        "tag_column": None,
        "is_qa_format": False,
        "question_column": None,
        "answer_column": None,
        "heading_columns": []  # 참조문서 표시용 컬럼들
    }

    # ID 컬럼 감지
    for candidate in ID_CANDIDATES:
        for i, h in enumerate(headers_lower):
            if candidate in h:
                detected["id_column"] = headers[i]
                break
        if detected["id_column"]:
            break

    # Q&A 패턴 감지
    for q_candidate in QA_QUESTION_CANDIDATES:
        for i, h in enumerate(headers_lower):
            if q_candidate == h or h.endswith(q_candidate):
                detected["question_column"] = headers[i]
                break
        if detected["question_column"]:
            break

    for a_candidate in QA_ANSWER_CANDIDATES:
        for i, h in enumerate(headers_lower):
            if a_candidate == h or h.endswith(a_candidate):
                detected["answer_column"] = headers[i]
                break
        if detected["answer_column"]:
            break

    if detected["question_column"] and detected["answer_column"]:
        detected["is_qa_format"] = True
        detected["text_columns"] = [detected["question_column"], detected["answer_column"]]
    else:
        # 일반 텍스트 컬럼 감지
        for candidate in TEXT_CANDIDATES:
            for i, h in enumerate(headers_lower):
                if candidate in h:
                    detected["text_columns"].append(headers[i])

    # 태그 컬럼 감지
    for candidate in TAG_CANDIDATES:
        for i, h in enumerate(headers_lower):
            if candidate == h:
                detected["tag_column"] = headers[i]
                break
        if detected["tag_column"]:
            break

    # headings 컬럼 감지 (소스/문서명 + 페이지/섹션 순서로)
    heading_source = None
    heading_page = None

    for candidate in HEADING_SOURCE_CANDIDATES:
        for i, h in enumerate(headers_lower):
            if candidate == h or candidate in h:
                heading_source = headers[i]
                break
        if heading_source:
            break

    for candidate in HEADING_PAGE_CANDIDATES:
        for i, h in enumerate(headers_lower):
            if candidate == h or candidate in h:
                heading_page = headers[i]
                break
        if heading_page:
            break

    # 감지된 컬럼들을 heading_columns에 추가 (소스 먼저, 페이지 다음)
    if heading_source:
        detected["heading_columns"].append(heading_source)
    if heading_page:
        detected["heading_columns"].append(heading_page)

    return detected
