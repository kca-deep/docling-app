"""
Qdrant Upload History SQLAlchemy Model
"""
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from backend.database import Base


class QdrantUploadHistory(Base):
    """Qdrant 업로드 이력 테이블"""
    __tablename__ = "qdrant_upload_history"

    # 기본 정보
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)

    # Qdrant 정보
    collection_name = Column(String(255), nullable=False, index=True)
    chunk_count = Column(Integer, nullable=True)  # 생성된 청크 수
    vector_ids_json = Column(Text, nullable=True)  # JSON 배열로 저장된 vector ID 목록
    qdrant_url = Column(String(255), nullable=True)  # 업로드 시 사용한 Qdrant URL

    # 업로드 상태
    upload_status = Column(String(20), default="success", nullable=False)  # success, failure
    error_message = Column(Text, nullable=True)  # 실패 시 오류 메시지

    # 타임스탬프
    uploaded_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    # Relationship
    document = relationship("Document", backref="qdrant_uploads")

    def __repr__(self):
        return f"<QdrantUploadHistory(id={self.id}, document_id={self.document_id}, collection={self.collection_name}, status={self.upload_status})>"
