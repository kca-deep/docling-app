"""add_showcase_comments

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a1
Create Date: 2026-05-20 00:00:00.000000

showcase_comments 테이블 추가.
비로그인/로그인 사용자 모두 문의 댓글 작성 가능.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, None] = 'b2c3d4e5f6a1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'showcase_comments',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('item_id', sa.Integer(), sa.ForeignKey('showcase_items.id', ondelete='CASCADE'), nullable=False),
        sa.Column('author_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('author_name', sa.String(100), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
    )
    op.create_index('ix_showcase_comments_item_id', 'showcase_comments', ['item_id'])
    op.create_index('ix_showcase_comments_created_at', 'showcase_comments', ['created_at'])


def downgrade() -> None:
    op.drop_index('ix_showcase_comments_created_at', table_name='showcase_comments')
    op.drop_index('ix_showcase_comments_item_id', table_name='showcase_comments')
    op.drop_table('showcase_comments')
