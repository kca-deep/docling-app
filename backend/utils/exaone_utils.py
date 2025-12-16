"""
EXAONE 모델 응답 처리 유틸리티

EXAONE Deep 모델의 thought 태그 및 특수 태그 처리
"""
import re
from typing import List, Tuple

# EXAONE Deep 모델의 태그 정리용 패턴 (컴파일하여 재사용)
_EXAONE_CLEANUP_PATTERNS: List[re.Pattern] = [
    re.compile(r'</?thought[^>]*>', re.IGNORECASE),
    re.compile(r'</?think[^>]*>', re.IGNORECASE),
    re.compile(r'</?ref[^>]*>', re.IGNORECASE),
    re.compile(r'</?span[^>]*>', re.IGNORECASE),
    re.compile(r'\[?\|?endofturn\|?\]?', re.IGNORECASE),
    re.compile(r'<[^>]*\d*\?*>', re.IGNORECASE),
]


def clean_exaone_tags(content: str) -> str:
    """
    EXAONE 응답에서 특수 태그 제거

    처리되는 태그:
    - <thought>...</thought>
    - <think>...</think>
    - <ref>...</ref>
    - <span>...</span>
    - [|endofturn|]

    Args:
        content: 정리할 텍스트

    Returns:
        str: 태그가 제거된 텍스트
    """
    if not content:
        return content

    for pattern in _EXAONE_CLEANUP_PATTERNS:
        content = pattern.sub('', content)

    return content.strip()


def clean_thought_tags_simple(content: str) -> str:
    """
    간단한 thought/think 태그 제거 (스트리밍용)

    Args:
        content: 정리할 텍스트

    Returns:
        str: 태그가 제거된 텍스트
    """
    if not content:
        return content

    return (content
            .replace('<thought>', '')
            .replace('</thought>', '')
            .replace('<think>', '')
            .replace('</think>', ''))


def extract_thought_and_answer(content: str) -> Tuple[str, str]:
    """
    EXAONE 응답에서 thought 블록과 실제 답변 분리

    EXAONE Deep 응답 구조:
    <thought>
    [추론 내용]
    </thought>
    [실제 답변]

    Args:
        content: LLM 응답 텍스트

    Returns:
        Tuple[str, str]: (추론 내용, 실제 답변)
            - thought 태그가 없으면 ("", 원본 텍스트)
    """
    if not content:
        return "", ""

    # </thought> 기준으로 분리
    if '</thought>' in content:
        parts = content.split('</thought>', 1)
        if len(parts) > 1:
            thought_part = parts[0]
            answer_part = parts[1]

            # thought_part에서 <thought> 태그 제거
            if '<thought>' in thought_part:
                thought_part = thought_part.split('<thought>', 1)[-1]

            # 남은 태그 정리
            thought_content = clean_exaone_tags(thought_part).strip()
            answer_content = clean_exaone_tags(answer_part).strip()

            return thought_content, answer_content

    # thought 태그가 없으면 전체가 답변
    return "", clean_exaone_tags(content).strip()


def is_exaone_model(model_key: str) -> bool:
    """
    EXAONE 모델 여부 확인

    Args:
        model_key: 모델 키 (예: "exaone-deep-7.8b")

    Returns:
        bool: EXAONE 모델 여부
    """
    if not model_key:
        return False
    return "exaone" in model_key.lower()


def add_virtual_thought_tag(content: str) -> str:
    """
    가상 <thought> 태그 추가

    llama.cpp API 응답에는 chat_template의 generation_prompt로 추가된
    <thought> 태그가 포함되지 않으므로 가상으로 복원

    Args:
        content: LLM 응답 텍스트

    Returns:
        str: <thought> 태그가 추가된 텍스트
    """
    if not content:
        return content

    if '</thought>' in content and '<thought>' not in content:
        return '<thought>\n' + content

    return content
