"""
컬렉션 메타데이터에 category 필드 추가 마이그레이션 스크립트
"""
import sqlite3
import json
import sys

# 컬렉션별 카테고리 매핑
COLLECTION_CATEGORIES = {
    # HR 관련 (파란색)
    "kca-hr-all": "hr",

    # 복리후생 관련 (녹색)
    "kca-welfare-all": "welfare",

    # 관리/행정 관련 (주황색)
    "kca-admin": "admin",
    "kca-audit": "admin",
    "kca-finance": "admin",
    "kca-ict-reguration": "admin",

    # 일반 (회색)
    "kca-research": "general",
    "kca-cert-domain-faq": "general",
}


def migrate_categories(db_path: str = "docling.db", dry_run: bool = False):
    """컬렉션 메타데이터에 category 필드 추가"""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # 모든 컬렉션 조회
    cursor.execute("SELECT id, collection_name, description FROM qdrant_collections")
    rows = cursor.fetchall()

    updated_count = 0
    skipped_count = 0

    for row_id, collection_name, description in rows:
        # 시스템 컬렉션 스킵
        if collection_name == "selfcheck" or collection_name.startswith("temp_") or collection_name.startswith("selfcheck"):
            print(f"[SKIP] {collection_name} (system collection)")
            skipped_count += 1
            continue

        # 카테고리 매핑 확인
        category = COLLECTION_CATEGORIES.get(collection_name, "general")

        # 기존 description 파싱
        try:
            if description:
                metadata = json.loads(description)
            else:
                metadata = {}
        except json.JSONDecodeError:
            # JSON이 아니면 plainDescription으로 처리
            metadata = {"plainDescription": description}

        # 이미 category가 있으면 스킵
        if metadata.get("category"):
            print(f"[SKIP] {collection_name} (already has category: {metadata['category']})")
            skipped_count += 1
            continue

        # category 추가
        metadata["category"] = category
        new_description = json.dumps(metadata, ensure_ascii=False)

        print(f"[UPDATE] {collection_name}")
        print(f"  category: {category}")
        print(f"  new description: {new_description[:100]}...")

        if not dry_run:
            cursor.execute(
                "UPDATE qdrant_collections SET description = ? WHERE id = ?",
                (new_description, row_id)
            )
            updated_count += 1

    if not dry_run:
        conn.commit()
        print(f"\n마이그레이션 완료: {updated_count}개 업데이트, {skipped_count}개 스킵")
    else:
        print(f"\n[DRY RUN] 실행 시 {len(rows) - skipped_count}개 업데이트 예정")

    conn.close()


if __name__ == "__main__":
    dry_run = "--dry-run" in sys.argv
    db_path = "docling.db"

    # 인자로 DB 경로 지정 가능
    for arg in sys.argv[1:]:
        if arg.endswith(".db"):
            db_path = arg

    print(f"DB: {db_path}")
    print(f"Mode: {'DRY RUN' if dry_run else 'EXECUTE'}\n")

    migrate_categories(db_path, dry_run)
