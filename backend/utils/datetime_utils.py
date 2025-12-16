"""
날짜/시간 변환 유틸리티 함수

반복되는 날짜 변환 로직을 통합
"""
from datetime import date, datetime, time
from typing import Tuple, Optional


def date_to_datetime_range(d: date) -> Tuple[datetime, datetime]:
    """
    date를 해당 날짜의 시작과 끝 datetime 범위로 변환

    Args:
        d: 변환할 date 객체

    Returns:
        Tuple[datetime, datetime]: (시작 datetime, 끝 datetime)
            - 시작: 00:00:00.000000
            - 끝: 23:59:59.999999
    """
    start = datetime.combine(d, time.min)
    end = datetime.combine(d, time.max)
    return start, end


def date_to_start_datetime(d: Optional[date]) -> Optional[datetime]:
    """
    date를 해당 날짜의 시작 datetime으로 변환

    Args:
        d: 변환할 date 객체 (None 가능)

    Returns:
        Optional[datetime]: 시작 datetime (00:00:00) 또는 None
    """
    if d is None:
        return None
    return datetime.combine(d, time.min)


def date_to_end_datetime(d: Optional[date]) -> Optional[datetime]:
    """
    date를 해당 날짜의 끝 datetime으로 변환

    Args:
        d: 변환할 date 객체 (None 가능)

    Returns:
        Optional[datetime]: 끝 datetime (23:59:59.999999) 또는 None
    """
    if d is None:
        return None
    return datetime.combine(d, time.max)


def safe_parse_datetime(value: str, default: Optional[datetime] = None) -> Optional[datetime]:
    """
    문자열을 datetime으로 안전하게 파싱

    Args:
        value: 파싱할 문자열 (ISO 형식)
        default: 파싱 실패 시 반환할 기본값

    Returns:
        Optional[datetime]: 파싱된 datetime 또는 기본값
    """
    if not value:
        return default

    try:
        # ISO 형식 (Z suffix 처리)
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except (ValueError, TypeError):
        return default


def format_datetime_display(dt: Optional[datetime], format_str: str = "%Y-%m-%d %H:%M") -> str:
    """
    datetime을 표시용 문자열로 포맷

    Args:
        dt: 포맷할 datetime 객체
        format_str: 출력 포맷 (기본: "YYYY-MM-DD HH:MM")

    Returns:
        str: 포맷된 문자열 또는 빈 문자열
    """
    if dt is None:
        return ""
    try:
        return dt.strftime(format_str)
    except (ValueError, TypeError):
        return str(dt)
