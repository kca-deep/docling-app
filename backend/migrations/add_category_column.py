"""
문서 테이블에 category 컬럼 추가 마이그레이션

실행 방법:
    cd /data/docling-app
    python -m backend.migrations.add_category_column
"""
import sqlite3
import os


def migrate():
    """documents 테이블에 category 컬럼 추가"""
    # DB 경로 (프로젝트 루트의 docling.db)
    db_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "docling.db")

    if not os.path.exists(db_path):
        print(f"DB 파일이 존재하지 않습니다: {db_path}")
        print("앱을 먼저 실행하여 DB를 생성해주세요.")
        return False

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # 컬럼이 이미 존재하는지 확인
        cursor.execute("PRAGMA table_info(documents)")
        columns = [col[1] for col in cursor.fetchall()]

        if "category" in columns:
            print("category 컬럼이 이미 존재합니다.")
            return True

        # 컬럼 추가
        cursor.execute("ALTER TABLE documents ADD COLUMN category VARCHAR(100)")

        # 인덱스 생성
        cursor.execute("CREATE INDEX IF NOT EXISTS ix_documents_category ON documents(category)")

        conn.commit()
        print("category 컬럼이 성공적으로 추가되었습니다.")
        return True

    except Exception as e:
        print(f"마이그레이션 실패: {e}")
        conn.rollback()
        return False

    finally:
        conn.close()


if __name__ == "__main__":
    migrate()
