"""
전체 기간 통계 일괄 집계 스크립트

Usage:
    python scripts/aggregate_all_stats.py
"""

import sys
import asyncio
from pathlib import Path
from datetime import datetime, timedelta

# 프로젝트 루트 설정
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from sqlalchemy.orm import Session
from backend.database import SessionLocal, engine
from backend.models.chat_statistics import ChatStatistics
from backend.services.statistics_service import StatisticsService

async def aggregate_all_dates():
    """모든 로그 파일에 대해 통계 집계 실행"""

    log_dir = PROJECT_ROOT / "logs" / "data"

    if not log_dir.exists():
        print(f"로그 디렉토리가 없습니다: {log_dir}")
        return

    # 모든 JSONL 파일 찾기
    log_files = sorted(log_dir.glob("*.jsonl"))

    if not log_files:
        print("집계할 로그 파일이 없습니다.")
        return

    print(f"총 {len(log_files)}개 로그 파일 발견")
    print()

    # 통계 서비스 초기화
    stats_service = StatisticsService()

    # DB 세션 생성
    db = SessionLocal()

    try:
        success_count = 0
        error_count = 0

        for log_file in log_files:
            # 파일명에서 날짜 추출 (2025-11-04.jsonl -> 2025-11-04)
            date_str = log_file.stem
            try:
                target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
            except ValueError:
                print(f"  [SKIP] 잘못된 파일명: {log_file.name}")
                continue

            # 기존 통계 삭제 (해당 날짜)
            deleted = db.query(ChatStatistics).filter(
                ChatStatistics.date == target_date
            ).delete()
            db.commit()

            # 통계 집계 실행
            result = await stats_service.aggregate_daily_stats(target_date, db)

            if result.get("status") == "success":
                collections = result.get("collections", [])
                total_queries = sum(c.get("total_queries", 0) for c in collections)
                print(f"  [OK] {date_str}: {len(collections)}개 컬렉션, 총 {total_queries}건")
                success_count += 1
            elif result.get("status") == "no_data":
                print(f"  [SKIP] {date_str}: 데이터 없음")
            elif result.get("status") == "empty":
                print(f"  [SKIP] {date_str}: 빈 파일")
            else:
                print(f"  [ERROR] {date_str}: {result.get('error', 'Unknown error')}")
                error_count += 1

        print()
        print(f"집계 완료: 성공 {success_count}건, 오류 {error_count}건")

        # 최종 통계 확인
        print()
        print("=== DB 저장 결과 확인 ===")
        stats = db.query(ChatStatistics).filter(
            ChatStatistics.collection_name.like("%ICT%")
        ).order_by(ChatStatistics.date).all()

        for stat in stats:
            print(f"  {stat.date} | {stat.collection_name} | 쿼리: {stat.total_queries}")

    finally:
        db.close()

if __name__ == "__main__":
    print("통계 일괄 집계 시작...")
    print()
    asyncio.run(aggregate_all_dates())
