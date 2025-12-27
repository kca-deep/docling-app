#!/usr/bin/env python3
"""
로그 파일 구조 마이그레이션 스크립트
flat 구조 -> yyyy/mm hierarchy 구조로 변환

사용법:
    python scripts/migrate_log_structure.py [--dry-run]

옵션:
    --dry-run: 실제 이동 없이 계획만 출력
"""

import sys
import shutil
from pathlib import Path
from datetime import datetime
from typing import List, Tuple, Optional

# 프로젝트 루트 추가
project_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(project_root))

from backend.utils.log_path import get_date_directory, parse_date_from_filename


def find_flat_files(base_dir: Path) -> List[Tuple[Path, Optional[datetime]]]:
    """flat 구조의 파일 찾기"""
    files = []

    for pattern in ["*.jsonl", "*.jsonl.gz"]:
        for file_path in base_dir.glob(pattern):
            if file_path.is_file():
                file_date = parse_date_from_filename(file_path.name)
                files.append((file_path, file_date))

    return files


def migrate_directory(base_dir: Path, dry_run: bool = False) -> Tuple[int, int]:
    """디렉토리 내 flat 파일들을 yyyy/mm 구조로 마이그레이션

    Returns:
        (성공 수, 실패 수)
    """
    if not base_dir.exists():
        print(f"  디렉토리 없음: {base_dir}")
        return 0, 0

    files = find_flat_files(base_dir)

    if not files:
        print(f"  마이그레이션할 파일 없음: {base_dir}")
        return 0, 0

    success_count = 0
    error_count = 0

    for file_path, file_date in files:
        if file_date is None:
            print(f"  [SKIP] 날짜 파싱 실패: {file_path}")
            error_count += 1
            continue

        # 대상 디렉토리 및 파일 경로
        target_dir = get_date_directory(base_dir, file_date)
        target_path = target_dir / file_path.name

        if dry_run:
            print(f"  [DRY-RUN] {file_path} -> {target_path}")
            success_count += 1
        else:
            try:
                # 대상 디렉토리 생성
                target_dir.mkdir(parents=True, exist_ok=True)

                # 파일 이동
                shutil.move(str(file_path), str(target_path))
                print(f"  [OK] {file_path} -> {target_path}")
                success_count += 1

            except Exception as e:
                print(f"  [ERROR] {file_path}: {e}")
                error_count += 1

    return success_count, error_count


def main():
    dry_run = "--dry-run" in sys.argv

    if dry_run:
        print("=" * 60)
        print("DRY-RUN 모드: 실제 파일 이동 없이 계획만 출력합니다")
        print("=" * 60)
    else:
        print("=" * 60)
        print("로그 파일 구조 마이그레이션")
        print("flat 구조 -> yyyy/mm hierarchy 구조")
        print("=" * 60)

    print()

    # 대상 디렉토리 목록
    log_dirs = [
        Path("./logs/data"),
        Path("./logs/conversations"),
        Path("./logs/overflow"),
    ]

    total_success = 0
    total_error = 0

    for log_dir in log_dirs:
        print(f"처리 중: {log_dir}")
        success, error = migrate_directory(log_dir, dry_run)
        total_success += success
        total_error += error
        print()

    print("=" * 60)
    print(f"완료: 성공={total_success}, 실패={total_error}")
    print("=" * 60)

    if not dry_run and total_success > 0:
        print()
        print("마이그레이션 완료! 기존 파일들이 yyyy/mm 구조로 이동되었습니다.")
        print("예: ./logs/data/2025-12-27.jsonl -> ./logs/data/2025/12/2025-12-27.jsonl")


if __name__ == "__main__":
    main()
