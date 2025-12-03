"""
타임존 유틸리티
애플리케이션 전역에서 일관된 타임존을 사용하기 위한 헬퍼 함수
"""
from datetime import datetime
from zoneinfo import ZoneInfo
from backend.config.settings import settings


def get_timezone() -> ZoneInfo:
    """설정된 타임존 객체 반환"""
    return ZoneInfo(settings.TIMEZONE)


def now() -> datetime:
    """현재 시간을 설정된 타임존으로 반환 (timezone-aware datetime)"""
    return datetime.now(get_timezone())


def now_iso() -> str:
    """현재 시간을 ISO 8601 형식 문자열로 반환"""
    return now().isoformat()


def now_naive() -> datetime:
    """현재 시간을 설정된 타임존 기준으로 반환 (timezone-naive datetime)

    SQLite 등 timezone을 지원하지 않는 DB와의 호환성을 위해 사용
    """
    return now().replace(tzinfo=None)


def format_date(dt: datetime = None, fmt: str = "%Y-%m-%d") -> str:
    """날짜를 지정된 포맷으로 반환

    Args:
        dt: datetime 객체 (None이면 현재 시간)
        fmt: strftime 포맷 문자열

    Returns:
        포맷된 날짜 문자열
    """
    if dt is None:
        dt = now()
    return dt.strftime(fmt)


def format_datetime(dt: datetime = None, fmt: str = "%Y-%m-%d %H:%M:%S") -> str:
    """날짜/시간을 지정된 포맷으로 반환

    Args:
        dt: datetime 객체 (None이면 현재 시간)
        fmt: strftime 포맷 문자열

    Returns:
        포맷된 날짜/시간 문자열
    """
    if dt is None:
        dt = now()
    return dt.strftime(fmt)
