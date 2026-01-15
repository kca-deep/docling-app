"""
피드백 모델
사용자 피드백 (긍정/부정) 저장
"""

import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Integer, Text, Index
from backend.database import Base
from backend.utils.timezone import now_naive


class Feedback(Base):
    """사용자 피드백 테이블"""
    __tablename__ = "feedback"

    # Primary key
    feedback_id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))

    # Message identification
    message_id = Column(String(100), nullable=False, index=True)  # 프론트엔드 메시지 ID
    session_id = Column(String(100), nullable=False, index=True)  # 채팅 세션 ID
    collection_name = Column(String(255), nullable=False, index=True)

    # Feedback data
    rating = Column(String(20), nullable=False, index=True)  # "positive" | "negative"
    category = Column(String(50), nullable=True)  # "inaccurate", "incomplete", "irrelevant", "outdated", "other"
    comment = Column(Text, nullable=True)  # 사용자 추가 의견

    # Context data (for analysis)
    user_query = Column(Text, nullable=False)  # 원본 질문
    assistant_response = Column(Text, nullable=True)  # AI 응답 (처음 500자)

    # LLM metadata
    llm_model = Column(String(100), nullable=True)
    reasoning_level = Column(String(20), nullable=True)
    retrieved_docs_count = Column(Integer, nullable=True)

    # User identification (anonymized)
    user_hash = Column(String(64), nullable=True)
    client_ip_hash = Column(String(64), nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=now_naive, index=True)

    # Composite indexes for analytics queries
    __table_args__ = (
        Index('ix_feedback_collection_rating', 'collection_name', 'rating'),
        Index('ix_feedback_collection_created', 'collection_name', 'created_at'),
        Index('ix_feedback_rating_created', 'rating', 'created_at'),
    )

    def to_dict(self):
        """Convert model to dictionary"""
        return {
            "feedback_id": self.feedback_id,
            "message_id": self.message_id,
            "session_id": self.session_id,
            "collection_name": self.collection_name,
            "rating": self.rating,
            "category": self.category,
            "comment": self.comment,
            "user_query": self.user_query,
            "assistant_response": self.assistant_response[:200] + "..." if self.assistant_response and len(self.assistant_response) > 200 else self.assistant_response,
            "llm_model": self.llm_model,
            "reasoning_level": self.reasoning_level,
            "retrieved_docs_count": self.retrieved_docs_count,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
