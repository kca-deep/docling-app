"""add_comment_password

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-05-20 01:00:00.000000

showcase_comments 테이블에 password_hash 컬럼 추가.
비로그인 사용자가 본인 댓글을 삭제할 수 있도록 비밀번호 해시를 저장.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, None] = 'c3d4e5f6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'showcase_comments',
        sa.Column('password_hash', sa.String(255), nullable=True)
    )


def downgrade() -> None:
    op.drop_column('showcase_comments', 'password_hash')
