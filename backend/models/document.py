"""
Document SQLAlchemy Model
"""
from sqlalchemy import Column, Integer, String, Text, Float, DateTime, JSON
from datetime import datetime
from backend.database import Base


class Document(Base):
    """문서 저장 테이블"""
    __tablename__ = "documents"

    # 기본 정보
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    task_id = Column(String(100), unique=True, index=True, nullable=False)
    original_filename = Column(String(255), nullable=False)
    file_size = Column(Integer, nullable=True)  # bytes
    file_type = Column(String(20), nullable=True)  # pdf, docx, pptx

    # 파싱 정보
    status = Column(String(20), default="success", nullable=False)  # success, failure
    processing_time = Column(Float, nullable=True)  # 초
    parse_options = Column(JSON, nullable=True)  # 파싱 옵션
    error_message = Column(Text, nullable=True)  # 실패 시 오류 메시지

    # 콘텐츠 정보
    content_length = Column(Integer, nullable=True)  # 문자 수
    content_preview = Column(String(500), nullable=True)  # 미리보기용 (처음 500자)

    # 실제 마크다운 내용
    md_content = Column(Text, nullable=False)

    # 통계
    download_count = Column(Integer, default=0, nullable=False)
    last_accessed_at = Column(DateTime, nullable=True)

    # 타임스탬프
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    def __repr__(self):
        return f"<Document(id={self.id}, task_id={self.task_id}, filename={self.original_filename})>"
