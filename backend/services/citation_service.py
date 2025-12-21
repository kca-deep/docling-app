"""
인용 추출 서비스
LLM 응답에서 인용된 구절을 추출하고 참조문서와 매칭
"""
import re
import logging
from typing import List, Dict, Any, Set

logger = logging.getLogger(__name__)

# 최소 매칭 문자열 길이
MIN_MATCH_LENGTH = 10

# 조항 패턴 (제X조, 제X항, 제X호 등)
ARTICLE_PATTERN = re.compile(
    r'제\s*(\d+)\s*조(?:\s*제?\s*(\d+)\s*항)?(?:\s*제?\s*(\d+)\s*호)?'
)

# 따옴표 인용 패턴
QUOTE_PATTERN = re.compile(r'["""\'\'](.*?)["""\'\']')


def extract_article_references(text: str) -> List[str]:
    """
    텍스트에서 조항 참조 추출 (제X조 제X항 형식)

    Args:
        text: LLM 응답 텍스트

    Returns:
        List[str]: 추출된 조항 참조 리스트 (예: ["제10조", "제3조 제2항"])
    """
    references = []

    for match in ARTICLE_PATTERN.finditer(text):
        article = match.group(1)
        paragraph = match.group(2)
        clause = match.group(3)

        ref = f"제{article}조"
        if paragraph:
            ref += f" 제{paragraph}항"
        if clause:
            ref += f" 제{clause}호"

        if ref not in references:
            references.append(ref)

    return references


def extract_quoted_phrases(text: str) -> List[str]:
    """
    텍스트에서 따옴표로 인용된 구절 추출

    Args:
        text: LLM 응답 텍스트

    Returns:
        List[str]: 인용된 구절 리스트
    """
    phrases = []

    for match in QUOTE_PATTERN.finditer(text):
        phrase = match.group(1).strip()
        if len(phrase) >= MIN_MATCH_LENGTH and phrase not in phrases:
            phrases.append(phrase)

    return phrases


def find_matching_sentences(
    response_text: str,
    source_text: str,
    min_length: int = MIN_MATCH_LENGTH
) -> List[str]:
    """
    응답과 소스 텍스트 사이에서 공통 구절 찾기 (N-gram 매칭)

    Args:
        response_text: LLM 응답 텍스트
        source_text: 참조문서 텍스트
        min_length: 최소 매칭 길이

    Returns:
        List[str]: 매칭된 구절 리스트
    """
    matched_phrases = []

    # 응답 텍스트를 정규화
    response_normalized = re.sub(r'\s+', ' ', response_text).strip()
    source_normalized = re.sub(r'\s+', ' ', source_text).strip()

    # N-gram 방식으로 공통 구절 찾기
    # 응답에서 min_length 이상의 연속 문자열이 소스에 있는지 확인
    response_len = len(response_normalized)

    i = 0
    while i < response_len - min_length:
        # 가능한 가장 긴 매칭 찾기
        best_match = ""
        for end in range(i + min_length, min(i + 200, response_len) + 1):
            substring = response_normalized[i:end]
            if substring in source_normalized:
                best_match = substring
            else:
                break

        if len(best_match) >= min_length:
            # 공백이나 구두점으로 시작/끝나지 않도록 정리
            best_match = best_match.strip()
            if len(best_match) >= min_length and best_match not in matched_phrases:
                matched_phrases.append(best_match)
            i += len(best_match)
        else:
            i += 1

    return matched_phrases


def find_article_in_source(
    article_ref: str,
    source_text: str
) -> List[str]:
    """
    참조문서에서 해당 조항이 포함된 문장 찾기

    Args:
        article_ref: 조항 참조 (예: "제10조 제2항")
        source_text: 참조문서 텍스트

    Returns:
        List[str]: 해당 조항이 포함된 문장들
    """
    sentences = []

    # 조항 번호에서 숫자 추출
    match = ARTICLE_PATTERN.search(article_ref)
    if not match:
        return sentences

    article_num = match.group(1)
    paragraph_num = match.group(2)

    # 다양한 형식의 조항 패턴 생성
    patterns = [
        rf'제\s*{article_num}\s*조',
    ]
    if paragraph_num:
        patterns.append(rf'제\s*{paragraph_num}\s*항')

    # 소스를 문장 단위로 분리
    # 마침표, 물음표, 느낌표로 분리하되, 숫자 뒤의 마침표는 제외
    sentence_pattern = re.compile(r'(?<![0-9])[\.\?\!]\s+')
    source_sentences = sentence_pattern.split(source_text)

    for sentence in source_sentences:
        sentence = sentence.strip()
        if not sentence:
            continue

        # 모든 패턴이 문장에 포함되어 있는지 확인
        if all(re.search(p, sentence) for p in patterns):
            if len(sentence) >= MIN_MATCH_LENGTH and sentence not in sentences:
                sentences.append(sentence)

    return sentences


def extract_citations_for_sources(
    llm_response: str,
    sources: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """
    LLM 응답에서 인용을 추출하고 각 소스 문서에 매칭

    Args:
        llm_response: LLM 응답 텍스트
        sources: 소스 문서 리스트 (각 문서는 payload.text 포함)

    Returns:
        List[Dict[str, Any]]: cited_phrases 필드가 추가된 소스 리스트
    """
    if not llm_response or not sources:
        return sources

    try:
        # 1. 조항 참조 추출
        article_refs = extract_article_references(llm_response)
        logger.debug(f"Extracted article references: {article_refs}")

        # 2. 따옴표 인용 추출
        quoted_phrases = extract_quoted_phrases(llm_response)
        logger.debug(f"Extracted quoted phrases: {len(quoted_phrases)}")

        # 3. 각 소스에 대해 인용 매칭
        for source in sources:
            payload = source.get("payload", {})
            source_text = payload.get("text", "")

            if not source_text:
                source["cited_phrases"] = []
                continue

            cited_phrases: List[str] = []

            # 3.1 조항 매칭
            for article_ref in article_refs:
                matched_sentences = find_article_in_source(article_ref, source_text)
                for sentence in matched_sentences:
                    if sentence not in cited_phrases:
                        cited_phrases.append(sentence)

            # 3.2 따옴표 인용 매칭
            for phrase in quoted_phrases:
                if phrase in source_text and phrase not in cited_phrases:
                    cited_phrases.append(phrase)

            # 3.3 N-gram 매칭 (조항 참조나 따옴표 인용이 전혀 없는 경우에만)
            # 성능 이유로 조건부 실행 - N-gram은 O(n*m) 복잡도로 느림
            if not cited_phrases and not article_refs and not quoted_phrases:
                matched = find_matching_sentences(llm_response, source_text, min_length=15)
                for phrase in matched[:2]:  # 최대 2개로 제한
                    if phrase not in cited_phrases:
                        cited_phrases.append(phrase)

            # 결과 저장 (최대 5개로 제한)
            source["cited_phrases"] = cited_phrases[:5]

            if cited_phrases:
                logger.debug(f"Found {len(cited_phrases)} citations for source")

        return sources

    except Exception as e:
        logger.error(f"Citation extraction failed: {e}")
        # 실패해도 원본 반환
        for source in sources:
            if "cited_phrases" not in source:
                source["cited_phrases"] = []
        return sources
