"""
정규화 유틸리티 함수들
"""
from typing import Optional


def normalize_collection(collection_name: Optional[str]) -> Optional[str]:
    """
    컬렉션 이름 정규화

    Args:
        collection_name: 원본 컬렉션 이름

    Returns:
        Optional[str]: 정규화된 컬렉션 이름
            - "ALL", 빈 문자열(""), None → None (전체 조회)
            - 그 외 → 그대로 반환

    Examples:
        >>> normalize_collection("ALL")
        None
        >>> normalize_collection("")
        None
        >>> normalize_collection(None)
        None
        >>> normalize_collection("my_collection")
        'my_collection'
    """
    if collection_name in ("ALL", "", None):
        return None
    return collection_name
