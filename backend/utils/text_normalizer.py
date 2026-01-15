"""
텍스트 정규화 유틸리티

Unicode 카테고리 기반으로 특수 공백 문자를 일반 공백으로 변환하고,
Zero-width 문자를 제거합니다.

처리되는 문자:
- Zs (Space Separator): U+00A0, U+202F, U+3000 등 → 일반 공백
- Cf (Format): U+FEFF, U+200B, U+200C, U+200D 등 → 제거
"""

import unicodedata
from typing import Set


def _build_category_charset(category: str) -> Set[str]:
    """
    지정된 Unicode 카테고리에 해당하는 문자 집합 생성

    Args:
        category: Unicode 카테고리 (예: "Zs", "Cf")

    Returns:
        Set[str]: 해당 카테고리의 문자 집합
    """
    # BMP (Basic Multilingual Plane) 범위만 처리 (0x0000 ~ 0xFFFF)
    # 대부분의 특수 공백/포맷 문자는 BMP에 위치
    return {
        chr(codepoint)
        for codepoint in range(0x10000)
        if unicodedata.category(chr(codepoint)) == category
    }


# 모듈 로드 시 문자 집합 사전 계산 (성능 최적화)
_SPACE_SEPARATOR_CHARS: Set[str] = _build_category_charset("Zs")
_FORMAT_CHARS: Set[str] = _build_category_charset("Cf")

# 일반 공백은 변환 대상에서 제외
_SPACE_SEPARATOR_CHARS.discard(' ')


def normalize_spaces(text: str) -> str:
    """
    Unicode 카테고리 기반 텍스트 정규화

    - Zs (Space Separator) 카테고리 문자 → 일반 공백 (U+0020)
    - Cf (Format) 카테고리 문자 → 제거

    처리되는 대표 문자:
    - U+00A0 (No-Break Space) → 공백
    - U+202F (Narrow No-Break Space) → 공백
    - U+3000 (Ideographic Space) → 공백
    - U+FEFF (BOM) → 제거
    - U+200B (Zero Width Space) → 제거

    Args:
        text: 정규화할 텍스트

    Returns:
        str: 정규화된 텍스트
    """
    if not text:
        return text

    result = []
    for char in text:
        if char in _SPACE_SEPARATOR_CHARS:
            # 특수 공백 → 일반 공백
            result.append(' ')
        elif char in _FORMAT_CHARS:
            # Format 문자 → 제거
            continue
        else:
            result.append(char)

    return ''.join(result)


def normalize_spaces_simple(text: str) -> str:
    """
    간단한 정규화 (사전 계산 없이 실시간 카테고리 확인)

    소량의 텍스트 처리 시 사용.
    대량 텍스트는 normalize_spaces() 권장.

    Args:
        text: 정규화할 텍스트

    Returns:
        str: 정규화된 텍스트
    """
    if not text:
        return text

    result = []
    for char in text:
        category = unicodedata.category(char)
        if category == "Zs" and char != ' ':
            result.append(' ')
        elif category == "Cf":
            continue
        else:
            result.append(char)

    return ''.join(result)
