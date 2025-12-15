"""
User registration columns migration

이 마이그레이션은 회원가입 기능을 위해 users 테이블에 새 컬럼을 추가합니다.

추가되는 컬럼:
- email: 사용자 이메일 (unique)
- name: 실명
- team_name: 팀명
- status: 승인 상태 (pending/approved/rejected)
- rejected_reason: 거절 사유
- approved_at: 승인 시간
- approved_by: 승인한 관리자 ID

실행 방법:
    cd /data/docling-app
    python -m backend.migrations.add_user_registration_columns
"""
import sqlite3
import os
from datetime import datetime


def migrate():
    """users 테이블에 회원가입 관련 컬럼 추가"""
    # DB 파일 경로
    db_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
        "docling.db"
    )

    if not os.path.exists(db_path):
        print(f"[ERROR] DB 파일이 존재하지 않습니다: {db_path}")
        return False

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # 기존 컬럼 조회
        cursor.execute("PRAGMA table_info(users)")
        existing_columns = [col[1] for col in cursor.fetchall()]
        print(f"[INFO] 기존 컬럼: {existing_columns}")

        # 추가할 컬럼 정의 (컬럼명, 타입, 기본값)
        new_columns = [
            ("email", "VARCHAR(255)", None),
            ("name", "VARCHAR(100)", None),
            ("team_name", "VARCHAR(100)", None),
            ("status", "VARCHAR(20)", "'approved'"),  # 기존 사용자는 approved
            ("rejected_reason", "TEXT", None),
            ("approved_at", "DATETIME", None),
            ("approved_by", "INTEGER", None),
        ]

        # 컬럼 추가
        added_columns = []
        for col_name, col_type, default_value in new_columns:
            if col_name not in existing_columns:
                if default_value:
                    sql = f"ALTER TABLE users ADD COLUMN {col_name} {col_type} DEFAULT {default_value}"
                else:
                    sql = f"ALTER TABLE users ADD COLUMN {col_name} {col_type}"
                cursor.execute(sql)
                added_columns.append(col_name)
                print(f"[OK] 컬럼 추가: {col_name}")
            else:
                print(f"[SKIP] 이미 존재하는 컬럼: {col_name}")

        # 기존 사용자 데이터 업데이트 (email, name이 비어있는 경우)
        cursor.execute("""
            UPDATE users
            SET email = username || '@kca.kr',
                name = username,
                status = 'approved',
                is_active = 1
            WHERE email IS NULL OR email = ''
        """)
        updated_count = cursor.rowcount
        if updated_count > 0:
            print(f"[OK] 기존 사용자 {updated_count}명 데이터 업데이트 완료")

        # 인덱스 생성 (UNIQUE 인덱스는 기존 데이터 중복 시 실패할 수 있으므로 예외 처리)
        try:
            cursor.execute("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_email ON users(email)")
            print("[OK] 인덱스 생성: ix_users_email (UNIQUE)")
        except sqlite3.IntegrityError as e:
            print(f"[WARN] 이메일 유니크 인덱스 생성 실패 (중복 데이터 존재): {e}")

        cursor.execute("CREATE INDEX IF NOT EXISTS ix_users_status ON users(status)")
        print("[OK] 인덱스 생성: ix_users_status")

        conn.commit()
        print("\n[SUCCESS] 마이그레이션 완료")

        # 최종 테이블 구조 출력
        cursor.execute("PRAGMA table_info(users)")
        columns = cursor.fetchall()
        print("\n[INFO] 최종 테이블 구조:")
        for col in columns:
            print(f"  - {col[1]} ({col[2]})")

        return True

    except Exception as e:
        print(f"[ERROR] 마이그레이션 실패: {e}")
        conn.rollback()
        return False

    finally:
        conn.close()


def rollback():
    """마이그레이션 롤백 (컬럼 삭제는 SQLite에서 직접 지원하지 않음)"""
    print("[WARN] SQLite는 컬럼 삭제를 직접 지원하지 않습니다.")
    print("[INFO] 롤백이 필요한 경우 테이블을 재생성해야 합니다.")
    return False


if __name__ == "__main__":
    print("=" * 60)
    print("User Registration Columns Migration")
    print("=" * 60)
    migrate()
