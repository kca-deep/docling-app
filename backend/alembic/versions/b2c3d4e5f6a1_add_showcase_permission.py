"""add_showcase_permission

Revision ID: b2c3d4e5f6a1
Revises: a1b2c3d4e5f6
Create Date: 2026-05-18 00:00:00.000000

showcase.contribute 권한을 permissions 및 role_permissions 테이블에 추가.
INSERT OR IGNORE로 멱등성 보장.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b2c3d4e5f6a1'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()

    conn.execute(sa.text("""
        INSERT OR IGNORE INTO permissions (category, action, description, created_at)
        VALUES ('showcase', 'contribute', '쇼케이스 콘텐츠 등록/수정/삭제', CURRENT_TIMESTAMP)
    """))

    for role_name in ("admin", "operator", "user"):
        conn.execute(sa.text("""
            INSERT OR IGNORE INTO role_permissions (role_id, permission_id, granted)
            VALUES (
                (SELECT id FROM roles WHERE name = :role_name),
                (SELECT id FROM permissions WHERE category = 'showcase' AND action = 'contribute'),
                1
            )
        """), {"role_name": role_name})


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text("""
        DELETE FROM role_permissions
        WHERE permission_id = (
            SELECT id FROM permissions WHERE category = 'showcase' AND action = 'contribute'
        )
    """))
    conn.execute(sa.text(
        "DELETE FROM permissions WHERE category = 'showcase' AND action = 'contribute'"
    ))
