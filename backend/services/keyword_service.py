"""
키워드 추출 서비스
kiwipiepy 형태소 분석기를 사용하여 쿼리와 문서 간의 관련 키워드를 추출
"""
import re
import logging
from typing import List, Set

logger = logging.getLogger(__name__)

# kiwipiepy 초기화 (싱글톤)
_kiwi = None

def get_kiwi():
    """Kiwi 인스턴스 반환 (싱글톤 패턴)"""
    global _kiwi
    if _kiwi is None:
        from kiwipiepy import Kiwi
        _kiwi = Kiwi()
        logger.info("Kiwipiepy 형태소 분석기 초기화 완료")
    return _kiwi


# 키워드로 추출할 품사 태그
# NNG: 일반명사, NNP: 고유명사, NNB: 의존명사
KEYWORD_POS_TAGS: Set[str] = {"NNG", "NNP"}

# 제외할 단어 (의문사, 대명사 등)
EXCLUDE_WORDS: Set[str] = {
    # 의문사
    "무엇", "뭐", "뭘", "어떻게", "왜", "언제", "어디", "누구", "어떤",
    # 대명사
    "이거", "저거", "그거", "이것", "저것", "그것",
    # 의존명사
    "것", "수", "때", "곳", "데",
    # 기타 불용어
    "등", "및"
}

# 최소 키워드 길이
MIN_KEYWORD_LENGTH = 2


def extract_keywords_from_query(query: str) -> List[str]:
    """
    쿼리에서 키워드 추출 (kiwipiepy 형태소 분석 사용)

    Args:
        query: 사용자 쿼리

    Returns:
        List[str]: 추출된 키워드 리스트
    """
    try:
        kiwi = get_kiwi()
        tokens = kiwi.tokenize(query)

        keywords = []
        for token in tokens:
            # 키워드 품사인지 확인
            if token.tag not in KEYWORD_POS_TAGS:
                continue

            # 제외 단어인지 확인
            if token.form in EXCLUDE_WORDS:
                continue

            # 최소 길이 확인
            if len(token.form) < MIN_KEYWORD_LENGTH:
                continue

            keywords.append(token.form)

        # 중복 제거하면서 순서 유지
        seen = set()
        unique_keywords = []
        for kw in keywords:
            if kw not in seen:
                seen.add(kw)
                unique_keywords.append(kw)

        logger.debug(f"Extracted keywords from query '{query}': {unique_keywords}")
        return unique_keywords

    except Exception as e:
        logger.error(f"키워드 추출 실패: {e}")
        return []


def find_matching_keywords(text: str, query_keywords: List[str]) -> List[str]:
    """
    문서 텍스트에서 쿼리 키워드와 매칭되는 키워드 찾기

    Args:
        text: 문서 텍스트
        query_keywords: 쿼리에서 추출된 키워드 리스트

    Returns:
        List[str]: 매칭된 키워드 리스트
    """
    if not text or not query_keywords:
        return []

    matched = []

    for kw in query_keywords:
        # 키워드가 문서에 포함되어 있는지 확인 (조사 변형 포함)
        # 예: "환불" -> "환불", "환불을", "환불이" 등
        pattern = rf'{re.escape(kw)}[은는이가을를에서로의와과도만으]?'

        if re.search(pattern, text, re.IGNORECASE):
            matched.append(kw)

    return matched


def extract_keywords_for_documents(
    query: str,
    documents: List[dict]
) -> List[dict]:
    """
    검색된 문서들에 대해 관련 키워드 추출

    Args:
        query: 사용자 쿼리
        documents: 검색된 문서 리스트 (각 문서는 payload.text 포함)

    Returns:
        List[dict]: 각 문서에 keywords 필드가 추가된 리스트
    """
    # 쿼리에서 키워드 추출
    query_keywords = extract_keywords_from_query(query)

    if not query_keywords:
        logger.debug(f"No keywords extracted from query: {query}")
        # 키워드가 없어도 빈 리스트로 설정
        for doc in documents:
            doc["keywords"] = []
        return documents

    logger.debug(f"Extracted keywords from query: {query_keywords}")

    # 각 문서에 대해 매칭 키워드 찾기
    for doc in documents:
        payload = doc.get("payload", {})
        text = payload.get("text", "")

        if text:
            matched_keywords = find_matching_keywords(text, query_keywords)
            doc["keywords"] = matched_keywords
        else:
            doc["keywords"] = []

    return documents
