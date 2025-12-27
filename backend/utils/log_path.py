"""
로그 파일 경로 유틸리티
yyyy/mm 하이라키 구조 지원 및 하위 호환성 유지
"""

from datetime import date, timedelta
from pathlib import Path
from typing import Iterator, Optional, List
import logging

logger = logging.getLogger(__name__)


def get_date_directory(base_dir: Path, target_date: date) -> Path:
    """
    날짜 기반 디렉토리 경로 반환 (yyyy/mm)

    Args:
        base_dir: 기본 디렉토리 (예: ./logs/data)
        target_date: 대상 날짜

    Returns:
        Path: 날짜 기반 디렉토리 경로 (예: ./logs/data/2025/12)
    """
    return base_dir / str(target_date.year) / f"{target_date.month:02d}"


def ensure_date_directory(base_dir: Path, target_date: date) -> Path:
    """
    날짜 기반 디렉토리 생성 및 경로 반환

    Args:
        base_dir: 기본 디렉토리
        target_date: 대상 날짜

    Returns:
        Path: 생성된 디렉토리 경로
    """
    date_dir = get_date_directory(base_dir, target_date)
    date_dir.mkdir(parents=True, exist_ok=True)
    return date_dir


def get_file_path_for_date(
    base_dir: Path,
    target_date: date,
    filename_format: str = "{date}.jsonl"
) -> Path:
    """
    특정 날짜의 로그 파일 경로 반환 (새 hierarchy 구조)

    Args:
        base_dir: 기본 디렉토리
        target_date: 대상 날짜
        filename_format: 파일명 포맷 (예: "{date}.jsonl", "overflow_{date}.jsonl")

    Returns:
        Path: 파일 경로
    """
    date_dir = get_date_directory(base_dir, target_date)
    filename = filename_format.format(date=target_date.isoformat())
    return date_dir / filename


def find_file_for_date(
    base_dir: Path,
    target_date: date,
    filename_format: str = "{date}.jsonl"
) -> Optional[Path]:
    """
    특정 날짜의 로그 파일 찾기 (hierarchy 우선, flat fallback)

    Args:
        base_dir: 기본 디렉토리
        target_date: 대상 날짜
        filename_format: 파일명 포맷

    Returns:
        Optional[Path]: 파일 경로 (없으면 None)
    """
    date_str = target_date.isoformat()
    filename = filename_format.format(date=date_str)

    # 1. hierarchy 구조 먼저 확인 (yyyy/mm/filename)
    hierarchy_path = get_date_directory(base_dir, target_date) / filename
    if hierarchy_path.exists():
        return hierarchy_path

    # 2. flat 구조 fallback (base_dir/filename)
    flat_path = base_dir / filename
    if flat_path.exists():
        return flat_path

    return None


def find_file_for_date_with_extensions(
    base_dir: Path,
    target_date: date,
    filename_format: str = "{date}.jsonl",
    extensions: List[str] = None
) -> Optional[Path]:
    """
    특정 날짜의 로그 파일 찾기 (확장자 변형 포함)

    Args:
        base_dir: 기본 디렉토리
        target_date: 대상 날짜
        filename_format: 파일명 포맷
        extensions: 추가 확장자 목록 (예: [".gz"])

    Returns:
        Optional[Path]: 파일 경로 (없으면 None)
    """
    if extensions is None:
        extensions = [".gz"]

    # 기본 확장자로 먼저 찾기
    result = find_file_for_date(base_dir, target_date, filename_format)
    if result:
        return result

    # 추가 확장자로 찾기 (예: .jsonl.gz)
    for ext in extensions:
        extended_format = filename_format + ext
        result = find_file_for_date(base_dir, target_date, extended_format)
        if result:
            return result

    return None


def iter_all_files(
    base_dir: Path,
    pattern: str = "*.jsonl*",
    include_flat: bool = True
) -> Iterator[Path]:
    """
    모든 로그 파일 순회 (flat + hierarchy 구조 모두)

    Args:
        base_dir: 기본 디렉토리
        pattern: 파일 패턴 (예: "*.jsonl*")
        include_flat: flat 구조 파일도 포함할지 여부

    Yields:
        Path: 로그 파일 경로
    """
    # 1. 직접 파일 (flat 구조 - 하위 호환성)
    if include_flat:
        for f in base_dir.glob(pattern):
            if f.is_file():
                yield f

    # 2. 하위 디렉토리 파일 (hierarchy 구조: yyyy/mm/file)
    for f in base_dir.glob(f"*/*/{pattern}"):
        if f.is_file():
            yield f


def iter_files_in_date_range(
    base_dir: Path,
    start_date: date,
    end_date: date,
    filename_format: str = "{date}.jsonl",
    include_compressed: bool = True
) -> Iterator[Path]:
    """
    날짜 범위의 로그 파일 순회

    Args:
        base_dir: 기본 디렉토리
        start_date: 시작 날짜
        end_date: 종료 날짜
        filename_format: 파일명 포맷
        include_compressed: 압축 파일도 포함할지 여부

    Yields:
        Path: 로그 파일 경로
    """
    current_date = start_date

    while current_date <= end_date:
        # 일반 파일 찾기
        file_path = find_file_for_date(base_dir, current_date, filename_format)
        if file_path:
            yield file_path
        elif include_compressed:
            # 압축 파일 찾기
            gz_path = find_file_for_date(base_dir, current_date, filename_format + ".gz")
            if gz_path:
                yield gz_path

        current_date += timedelta(days=1)


def cleanup_empty_directories(base_dir: Path) -> int:
    """
    빈 yyyy/mm 디렉토리 정리

    Args:
        base_dir: 기본 디렉토리

    Returns:
        int: 삭제된 디렉토리 수
    """
    deleted = 0

    try:
        # mm 디렉토리 먼저 정리 (하위 → 상위 순서)
        for year_dir in sorted(base_dir.glob("*/")):
            if not year_dir.is_dir():
                continue

            # 숫자로 된 년도 디렉토리만 처리
            if not year_dir.name.isdigit():
                continue

            for month_dir in sorted(year_dir.glob("*/")):
                if not month_dir.is_dir():
                    continue

                # 숫자로 된 월 디렉토리만 처리
                if not month_dir.name.isdigit():
                    continue

                # 빈 디렉토리인지 확인
                if not any(month_dir.iterdir()):
                    month_dir.rmdir()
                    deleted += 1
                    logger.debug(f"빈 월 디렉토리 삭제: {month_dir}")

            # 년도 디렉토리도 비어있으면 삭제
            if not any(year_dir.iterdir()):
                year_dir.rmdir()
                deleted += 1
                logger.debug(f"빈 년도 디렉토리 삭제: {year_dir}")

    except Exception as e:
        logger.error(f"빈 디렉토리 정리 오류: {e}")

    if deleted > 0:
        logger.info(f"총 {deleted}개 빈 디렉토리 삭제됨")

    return deleted


def parse_date_from_filename(filename: str) -> Optional[date]:
    """
    파일명에서 날짜 파싱

    Args:
        filename: 파일명 (예: "2025-12-27.jsonl", "overflow_2025-12-27.jsonl")

    Returns:
        Optional[date]: 파싱된 날짜 (실패 시 None)
    """
    from datetime import datetime

    try:
        # 파일명에서 날짜 부분 추출
        name = filename

        # 확장자 제거
        for ext in [".jsonl.gz", ".jsonl", ".gz"]:
            if name.endswith(ext):
                name = name[:-len(ext)]
                break

        # 접두어 제거 (overflow_, emergency_ 등)
        prefixes = ["overflow_", "emergency_"]
        for prefix in prefixes:
            if name.startswith(prefix):
                name = name[len(prefix):]
                break

        # 날짜 파싱 시도
        # YYYY-MM-DD 형식
        if len(name) == 10 and name.count("-") == 2:
            return datetime.strptime(name, "%Y-%m-%d").date()

        # YYYYMMDD_HHMMSS 형식 (emergency 파일)
        if "_" in name:
            date_part = name.split("_")[0]
            if len(date_part) == 8 and date_part.isdigit():
                return datetime.strptime(date_part, "%Y%m%d").date()

        return None

    except Exception:
        return None
