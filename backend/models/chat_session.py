"""
채팅 세션 모델
채팅 세션 메타데이터 및 기본 정보 저장
"""

from datetime import datetime
from sqlalchemy import Column, String, DateTime, Integer, Text
from backend.database import Base
from backend.utils.timezone import now_naive


class ChatSession(Base):
    """채팅 세션 테이블"""
    __tablename__ = "chat_sessions"

    # Primary key
    session_id = Column(String(36), primary_key=True, index=True)

    # Session information
    collection_name = Column(String(255), nullable=False, index=True)

    # User information (hashed for privacy)
    user_hash = Column(String(64), nullable=True, index=True)

    # Timing information
    started_at = Column(DateTime, default=now_naive, index=True)
    ended_at = Column(DateTime, nullable=True)

    # Message counts
    message_count = Column(Integer, default=0)
    user_message_count = Column(Integer, default=0)
    assistant_message_count = Column(Integer, default=0)

    # Performance metrics
    total_response_time_ms = Column(Integer, default=0)
    avg_response_time_ms = Column(Integer, default=0)

    # Session quality indicators
    has_error = Column(Integer, default=0)  # Boolean as integer for SQLite
    has_regeneration = Column(Integer, default=0)  # Boolean as integer
    min_retrieval_score = Column(String(20), nullable=True)  # Store as string for SQLite

    # Metadata
    llm_model = Column(String(100), nullable=True)
    reasoning_level = Column(String(20), nullable=True)

    # Summary for quick reference
    summary = Column(Text, nullable=True)

    # Retention metadata
    is_sampled = Column(Integer, default=0)  # Boolean as integer
    retention_priority = Column(String(20), default="medium")  # high, medium, low

    def to_dict(self):
        """Convert model to dictionary"""
        return {
            "session_id": self.session_id,
            "collection_name": self.collection_name,
            "user_hash": self.user_hash,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "ended_at": self.ended_at.isoformat() if self.ended_at else None,
            "message_count": self.message_count,
            "user_message_count": self.user_message_count,
            "assistant_message_count": self.assistant_message_count,
            "total_response_time_ms": self.total_response_time_ms,
            "avg_response_time_ms": self.avg_response_time_ms,
            "has_error": bool(self.has_error),
            "has_regeneration": bool(self.has_regeneration),
            "min_retrieval_score": float(self.min_retrieval_score) if self.min_retrieval_score else None,
            "llm_model": self.llm_model,
            "reasoning_level": self.reasoning_level,
            "summary": self.summary,
            "is_sampled": bool(self.is_sampled),
            "retention_priority": self.retention_priority
        }