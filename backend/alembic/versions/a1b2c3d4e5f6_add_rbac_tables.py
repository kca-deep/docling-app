"""add_rbac_tables

Revision ID: a1b2c3d4e5f6
Revises: 5d31ca1568ee
Create Date: 2026-05-13 00:00:00.000000

RBAC 테이블 추가:
- roles: 역할 (admin, operator, user)
- permissions: 권한 (category.action)
- role_permissions: 역할별 권한 매핑
- user_roles: 사용자-역할 매핑
- user_permission_overrides: 사용자별 권한 오버라이드
- users.permissions JSON 컬럼 삭제
"""
from typing import Sequence, Union
import json

from alembic import op
import sqlalchemy as sa


revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '5d31ca1568ee'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# 16개 권한 정의 (category, action, description)
PERMISSIONS = [
    ("chat",      "use",             "채팅 기능 사용"),
    ("chat",      "all_collections", "모든 컬렉션 접근"),
    ("selfcheck", "execute",         "셀프체크 실행"),
    ("selfcheck", "history",         "셀프체크 기록 조회"),
    ("selfcheck", "feedback",        "셀프체크 피드백 관리"),
    ("documents", "parse",           "문서 파싱"),
    ("documents", "view",            "문서 조회"),
    ("documents", "delete",          "문서 삭제"),
    ("qdrant",    "upload",          "Qdrant 업로드"),
    ("qdrant",    "collections",     "Qdrant 컬렉션 관리"),
    ("excel",     "upload",          "Excel 임베딩"),
    ("dify",      "upload",          "Dify 업로드"),
    ("dify",      "config",          "Dify 설정 관리"),
    ("analytics", "view",            "통계 조회"),
    ("admin",     "users",           "사용자 관리"),
    ("admin",     "system",          "시스템 관리"),
]

# 역할별 권한 매핑: (category, action) -> {admin, operator, user}
ROLE_GRANTS = {
    ("chat",      "use"):             {"admin": True,  "operator": False, "user": True},
    ("chat",      "all_collections"): {"admin": True,  "operator": False, "user": False},
    ("selfcheck", "execute"):         {"admin": True,  "operator": False, "user": True},
    ("selfcheck", "history"):         {"admin": True,  "operator": False, "user": True},
    ("selfcheck", "feedback"):        {"admin": True,  "operator": False, "user": False},
    ("documents", "parse"):           {"admin": True,  "operator": True,  "user": True},
    ("documents", "view"):            {"admin": True,  "operator": True,  "user": True},
    ("documents", "delete"):          {"admin": True,  "operator": True,  "user": False},
    ("qdrant",    "upload"):          {"admin": True,  "operator": True,  "user": True},
    ("qdrant",    "collections"):     {"admin": True,  "operator": True,  "user": False},
    ("excel",     "upload"):          {"admin": True,  "operator": True,  "user": True},
    ("dify",      "upload"):          {"admin": True,  "operator": False, "user": True},
    ("dify",      "config"):          {"admin": True,  "operator": False, "user": False},
    ("analytics", "view"):            {"admin": True,  "operator": False, "user": False},
    ("admin",     "users"):           {"admin": True,  "operator": False, "user": False},
    ("admin",     "system"):          {"admin": True,  "operator": False, "user": False},
}

# user 역할 기본 권한 (overrides 비교용)
USER_DEFAULT_GRANTS = {(cat, act): grants["user"] for (cat, act), grants in ROLE_GRANTS.items()}


def upgrade() -> None:
    # 1. 테이블 생성
    op.create_table(
        "roles",
        sa.Column("id", sa.Integer, primary_key=True, index=True),
        sa.Column("name", sa.String(50), unique=True, nullable=False, index=True),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=True),
    )

    op.create_table(
        "permissions",
        sa.Column("id", sa.Integer, primary_key=True, index=True),
        sa.Column("category", sa.String(50), nullable=False, index=True),
        sa.Column("action", sa.String(50), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=True),
        sa.UniqueConstraint("category", "action", name="uq_permissions_category_action"),
    )

    op.create_table(
        "role_permissions",
        sa.Column("id", sa.Integer, primary_key=True, index=True),
        sa.Column("role_id", sa.Integer, sa.ForeignKey("roles.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("permission_id", sa.Integer, sa.ForeignKey("permissions.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("granted", sa.Boolean, nullable=False, default=False),
        sa.UniqueConstraint("role_id", "permission_id", name="uq_role_permissions"),
    )

    op.create_table(
        "user_roles",
        sa.Column("id", sa.Integer, primary_key=True, index=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("role_id", sa.Integer, sa.ForeignKey("roles.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("assigned_at", sa.DateTime, nullable=True),
        sa.Column("assigned_by", sa.Integer, sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.UniqueConstraint("user_id", name="uq_user_roles_user_id"),
    )

    op.create_table(
        "user_permission_overrides",
        sa.Column("id", sa.Integer, primary_key=True, index=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("permission_id", sa.Integer, sa.ForeignKey("permissions.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("granted", sa.Boolean, nullable=False),
        sa.Column("created_at", sa.DateTime, nullable=True),
        sa.Column("created_by", sa.Integer, sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.UniqueConstraint("user_id", "permission_id", name="uq_user_permission_overrides"),
    )

    conn = op.get_bind()

    # 2. 역할 시드
    conn.execute(sa.text(
        "INSERT INTO roles (name, description, created_at) VALUES "
        "('admin', '관리자 - 전체 기능 접근', CURRENT_TIMESTAMP), "
        "('operator', '운영자 - 임베딩/문서파싱/컬렉션 관리', CURRENT_TIMESTAMP), "
        "('user', '일반 사용자 - 채팅/셀프체크', CURRENT_TIMESTAMP)"
    ))

    # 3. 권한 시드
    for category, action, description in PERMISSIONS:
        conn.execute(sa.text(
            "INSERT INTO permissions (category, action, description, created_at) "
            "VALUES (:cat, :act, :desc, CURRENT_TIMESTAMP)"
        ), {"cat": category, "act": action, "desc": description})

    # 4. 역할별 권한 매핑 시드 (48개)
    for (category, action), role_grants in ROLE_GRANTS.items():
        for role_name, granted in role_grants.items():
            conn.execute(sa.text(
                "INSERT INTO role_permissions (role_id, permission_id, granted) "
                "VALUES ("
                "  (SELECT id FROM roles WHERE name = :role_name),"
                "  (SELECT id FROM permissions WHERE category = :cat AND action = :act),"
                "  :granted"
                ")"
            ), {
                "role_name": role_name,
                "cat": category,
                "act": action,
                "granted": 1 if granted else 0,
            })

    # 5. 기존 사용자 -> user_roles 마이그레이션
    # users.role 값이 roles 테이블에 없으면 'user' 역할로 fallback
    conn.execute(sa.text("""
        INSERT INTO user_roles (user_id, role_id, assigned_at)
        SELECT
            u.id,
            COALESCE(
                (SELECT id FROM roles WHERE name = u.role),
                (SELECT id FROM roles WHERE name = 'user')
            ),
            CURRENT_TIMESTAMP
        FROM users u
    """))

    # 6. 기존 user 역할 사용자의 permissions JSON -> user_permission_overrides 마이그레이션
    # admin은 모든 권한이므로 override 불필요
    # user 역할 사용자 중 기본값과 다른 권한만 override로 저장
    users_result = conn.execute(sa.text(
        "SELECT id, permissions FROM users WHERE role != 'admin' AND permissions IS NOT NULL"
    ))
    users = users_result.fetchall()

    for user_id, permissions_json in users:
        if not permissions_json:
            continue
        try:
            perms = json.loads(permissions_json) if isinstance(permissions_json, str) else permissions_json
        except (json.JSONDecodeError, TypeError):
            continue

        for category, actions in perms.items():
            if not isinstance(actions, dict):
                continue
            for action, granted in actions.items():
                default = USER_DEFAULT_GRANTS.get((category, action))
                if default is None:
                    continue
                # 기본값과 다를 때만 override 저장
                if bool(granted) != default:
                    conn.execute(sa.text(
                        "INSERT OR IGNORE INTO user_permission_overrides "
                        "(user_id, permission_id, granted, created_at) "
                        "VALUES ("
                        "  :user_id,"
                        "  (SELECT id FROM permissions WHERE category = :cat AND action = :act),"
                        "  :granted,"
                        "  CURRENT_TIMESTAMP"
                        ")"
                    ), {
                        "user_id": user_id,
                        "cat": category,
                        "act": action,
                        "granted": 1 if granted else 0,
                    })

    # 7. users.permissions 컬럼 삭제 (SQLite batch mode 필요)
    with op.batch_alter_table("users") as batch_op:
        batch_op.drop_column("permissions")


def downgrade() -> None:
    # users.permissions 컬럼 복원 (데이터 복구 불가)
    with op.batch_alter_table("users") as batch_op:
        batch_op.add_column(sa.Column("permissions", sa.JSON, nullable=True))

    op.drop_table("user_permission_overrides")
    op.drop_table("user_roles")
    op.drop_table("role_permissions")
    op.drop_table("permissions")
    op.drop_table("roles")
