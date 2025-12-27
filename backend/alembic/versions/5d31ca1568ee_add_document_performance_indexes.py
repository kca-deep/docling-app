"""add_document_performance_indexes

Revision ID: 5d31ca1568ee
Revises: fd42f1fdfdb1
Create Date: 2025-12-27 08:45:17.972592

Document 테이블에 성능 개선을 위한 인덱스 추가:
- original_filename: 파일명 검색 최적화
- file_type: 파일 타입 필터링 최적화
- status: 상태별 조회 최적화
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5d31ca1568ee'
down_revision: Union[str, None] = 'fd42f1fdfdb1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Document 테이블에 성능 인덱스 추가"""
    # SQLite에서 인덱스 생성 (이미 존재하면 에러 방지)
    conn = op.get_bind()

    # 기존 인덱스 목록 조회
    result = conn.execute(sa.text(
        "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='documents'"
    ))
    existing_indexes = {row[0] for row in result}

    # original_filename 인덱스
    if 'ix_documents_original_filename' not in existing_indexes:
        op.create_index(
            'ix_documents_original_filename',
            'documents',
            ['original_filename'],
            unique=False
        )

    # file_type 인덱스
    if 'ix_documents_file_type' not in existing_indexes:
        op.create_index(
            'ix_documents_file_type',
            'documents',
            ['file_type'],
            unique=False
        )

    # status 인덱스
    if 'ix_documents_status' not in existing_indexes:
        op.create_index(
            'ix_documents_status',
            'documents',
            ['status'],
            unique=False
        )


def downgrade() -> None:
    """추가된 인덱스 제거"""
    # 인덱스 존재 여부 확인 후 삭제
    conn = op.get_bind()
    result = conn.execute(sa.text(
        "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='documents'"
    ))
    existing_indexes = {row[0] for row in result}

    if 'ix_documents_status' in existing_indexes:
        op.drop_index('ix_documents_status', table_name='documents')

    if 'ix_documents_file_type' in existing_indexes:
        op.drop_index('ix_documents_file_type', table_name='documents')

    if 'ix_documents_original_filename' in existing_indexes:
        op.drop_index('ix_documents_original_filename', table_name='documents')
