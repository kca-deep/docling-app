"""
컬렉션 관련 유틸리티 함수
[P1-4] 임시 컬렉션 감지 로직 공통화
"""
import logging
from typing import List, Dict, Any, Optional

logger = logging.getLogger("uvicorn")


def is_temp_collection(
    collection_name: Optional[str],
    retrieved_docs: Optional[List[Dict[str, Any]]] = None,
    log_detection: bool = True
) -> bool:
    """
    임시 컬렉션 여부 판별

    임시 컬렉션 판별 조건:
    1. collection_name이 "temp_"로 시작
    2. collection_name이 None이고 retrieved_docs가 있음 (일상대화 + 문서 업로드)
    3. retrieved_docs[0]의 source_collection이 "temp_"로 시작

    Args:
        collection_name: 컬렉션 이름
        retrieved_docs: 검색된 문서 목록
        log_detection: 감지 시 로그 출력 여부 (기본값: True)

    Returns:
        bool: 임시 컬렉션이면 True
    """
    # 1. collection_name이 "temp_"로 시작
    if collection_name and collection_name.startswith("temp_"):
        return True

    # 2. collection_name이 None이고 문서가 있으면 임시 컬렉션
    # (일상대화 모드에서 사용자가 직접 업로드한 문서)
    if not collection_name and retrieved_docs:
        if log_detection:
            logger.info(f"[CollectionUtils] Detected temp collection: collection_name=None but has {len(retrieved_docs)} docs")
        return True

    # 3. 문서의 source_collection이 "temp_"로 시작
    if retrieved_docs:
        source_col = retrieved_docs[0].get("source_collection", "")
        if source_col and source_col.startswith("temp_"):
            if log_detection:
                logger.info(f"[CollectionUtils] Detected temp collection from source_collection: {source_col}")
            return True

    return False


def is_doc_from_temp_collection(
    doc: Dict[str, Any],
    is_temp_collection_mode: bool = False
) -> bool:
    """
    개별 문서가 임시 컬렉션에서 온 것인지 판별

    Args:
        doc: 문서 딕셔너리
        is_temp_collection_mode: 전체가 임시 컬렉션 모드인지 여부

    Returns:
        bool: 임시 컬렉션 문서면 True
    """
    if is_temp_collection_mode:
        return True

    doc_source = doc.get("source_collection", "")
    return doc_source.startswith("temp_")
