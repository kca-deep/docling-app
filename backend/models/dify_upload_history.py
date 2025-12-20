"""
Dify Upload History SQLAlchemy Model
"""
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from backend.database import Base
from backend.utils.timezone import now_naive


class DifyUploadHistory(Base):
    """Dify 업로드 이력 테이블"""
    __tablename__ = "dify_upload_history"

    # 기본 정보
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)

    # Dify 정보
    dify_dataset_id = Column(String(100), nullable=False, index=True)
    dify_dataset_name = Column(String(255), nullable=True)
    dify_document_id = Column(String(100), nullable=True)  # Dify에서 반환한 document ID
    dify_base_url = Column(String(255), nullable=True)  # 업로드 시 사용한 base URL

    # 업로드 상태
    upload_status = Column(String(20), default="success", nullable=False)  # success, failure
    error_message = Column(Text, nullable=True)  # 실패 시 오류 메시지

    # 타임스탬프
    uploaded_at = Column(DateTime, default=now_naive, nullable=False, index=True)

    # Relationship
    document = relationship("Document", backref="dify_uploads")

    def __repr__(self):
        return f"<DifyUploadHistory(id={self.id}, document_id={self.document_id}, status={self.upload_status})>"
