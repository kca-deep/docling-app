"""
검색 결과 변환 유틸리티
Qdrant 검색 결과를 프론트엔드/로깅용 형식으로 변환
"""
from typing import Dict, Any, List


def extract_document_name(doc: Dict[str, Any]) -> str:
    """
    문서에서 문서명 추출

    우선순위: filename > document_name > source > "Unknown"

    Args:
        doc: Qdrant 검색 결과 문서

    Returns:
        추출된 문서명
    """
    payload = doc.get("payload") or {}
    metadata = doc.get("metadata") or {}
    # payload 우선, metadata 보조
    merged = {**metadata, **payload}

    return (
        merged.get("filename") or
        merged.get("document_name") or
        merged.get("source") or
        "Unknown"
    )


def extract_page_number(doc: Dict[str, Any]) -> int:
    """
    문서에서 페이지 번호 추출

    우선순위: headings[1]에서 "페이지 N" 파싱 > page_number > page > 0

    Args:
        doc: Qdrant 검색 결과 문서

    Returns:
        추출된 페이지 번호 (없으면 0)
    """
    payload = doc.get("payload") or {}
    metadata = doc.get("metadata") or {}
    merged = {**metadata, **payload}

    # headings에서 페이지 번호 추출 시도
    headings = merged.get("headings") or []
    if len(headings) >= 2:
        page_str = headings[1]
        if isinstance(page_str, str) and "페이지" in page_str:
            try:
                return int(page_str.replace("페이지", "").strip())
            except ValueError:
                pass
        elif isinstance(page_str, (int, float)):
            return int(page_str)

    # 다른 필드에서 추출 시도
    return merged.get("page_number") or merged.get("page", 0)


def convert_to_source_data(doc: Dict[str, Any]) -> Dict[str, Any]:
    """
    Qdrant 검색 결과를 프론트엔드용 source 데이터로 변환

    Args:
        doc: Qdrant 검색 결과 문서
            - id: 문서 ID
            - score: 유사도 점수
            - payload: 문서 내용 및 메타데이터

    Returns:
        프론트엔드용 source 데이터:
            - id: 문서 ID (문자열)
            - score: 유사도 점수
            - text: 문서 텍스트
            - metadata: text를 제외한 메타데이터
    """
    payload = doc.get("payload", {})
    return {
        "id": str(doc.get("id", "")),
        "score": doc.get("score", 0.0),
        "text": payload.get("text", ""),
        "metadata": {k: v for k, v in payload.items() if k != "text"}
    }


def convert_to_source_info(doc: Dict[str, Any]) -> Dict[str, Any]:
    """
    로깅용 소스 정보 추출

    Args:
        doc: Qdrant 검색 결과 문서

    Returns:
        로깅용 소스 정보:
            - document_name: 문서명
            - page_number: 페이지 번호
            - score: 유사도 점수
    """
    return {
        "document_name": extract_document_name(doc),
        "page_number": extract_page_number(doc),
        "score": doc.get("score", 0)
    }


def convert_docs_to_sources(docs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    문서 리스트를 프론트엔드용 source 데이터 리스트로 변환

    Args:
        docs: Qdrant 검색 결과 문서 리스트

    Returns:
        프론트엔드용 source 데이터 리스트
    """
    return [convert_to_source_data(doc) for doc in docs]


def extract_sources_info(docs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    문서 리스트에서 로깅용 소스 정보 추출

    Args:
        docs: Qdrant 검색 결과 문서 리스트

    Returns:
        로깅용 소스 정보 리스트
    """
    return [convert_to_source_info(doc) for doc in docs]
