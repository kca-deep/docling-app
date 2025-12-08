"""
Qdrant 컬렉션 마이그레이션 수동 실행 스크립트

사용법:
    cd backend
    python -m scripts.run_migration
"""
import asyncio
import sys
import os

# 프로젝트 루트를 path에 추가
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from backend.database import SessionLocal, init_db
from backend.scripts.migrate_collections import migrate_existing_collections


async def main():
    print("=" * 50)
    print("Qdrant -> SQLite 컬렉션 마이그레이션")
    print("=" * 50)

    # DB 초기화
    init_db()

    db = SessionLocal()
    try:
        result = await migrate_existing_collections(db)

        print(f"\n총 컬렉션: {result['total']}")
        print(f"마이그레이션 완료: {result['migrated']}")
        print(f"건너뜀 (이미 존재): {result['skipped']}")
        print(f"오류: {result['errors']}")

        if result['details']:
            print("\n상세:")
            for detail in result['details']:
                print(f"  - {detail}")

    finally:
        db.close()

    print("\n" + "=" * 50)
    print("마이그레이션 완료")
    print("=" * 50)


if __name__ == "__main__":
    asyncio.run(main())
