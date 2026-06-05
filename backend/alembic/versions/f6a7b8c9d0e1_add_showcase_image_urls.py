"""add_showcase_image_urls

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-06-05 00:00:00.000000

showcase_items 테이블에 image_urls(JSON) 컬럼 추가.
첨부 이미지 갤러리(URL 목록)를 저장한다. thumbnail_url은 이 중 대표 이미지.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f6a7b8c9d0e1'
down_revision: Union[str, None] = 'e5f6a7b8c9d0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # create_all로 이미 컬럼이 생성된 환경을 고려해 멱등 처리
    bind = op.get_bind()
    cols = [c["name"] for c in sa.inspect(bind).get_columns("showcase_items")]
    if "image_urls" not in cols:
        op.add_column(
            "showcase_items",
            sa.Column("image_urls", sa.JSON(), nullable=True),
        )


def downgrade() -> None:
    op.drop_column("showcase_items", "image_urls")
