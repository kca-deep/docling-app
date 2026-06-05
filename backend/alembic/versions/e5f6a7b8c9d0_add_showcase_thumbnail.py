"""add_showcase_thumbnail

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-06-04 00:00:00.000000

showcase_items 테이블에 thumbnail_url 컬럼 추가.
대표 이미지(썸네일) URL을 저장한다.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'e5f6a7b8c9d0'
down_revision: Union[str, None] = 'd4e5f6a7b8c9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # create_all로 이미 컬럼이 생성된 환경을 고려해 멱등 처리
    bind = op.get_bind()
    cols = [c["name"] for c in sa.inspect(bind).get_columns("showcase_items")]
    if "thumbnail_url" not in cols:
        op.add_column(
            "showcase_items",
            sa.Column("thumbnail_url", sa.String(500), nullable=True),
        )


def downgrade() -> None:
    op.drop_column("showcase_items", "thumbnail_url")
