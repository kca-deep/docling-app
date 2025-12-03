"""
채팅 통계 모델
컬렉션별, 시간별 집계 통계 저장
"""

from datetime import datetime
from sqlalchemy import Column, String, DateTime, Integer, Float, Text, Date
from backend.database import Base
from backend.utils.timezone import now_naive


class ChatStatistics(Base):
    """채팅 통계 테이블"""
    __tablename__ = "chat_statistics"

    # Primary key
    stat_id = Column(String(36), primary_key=True, index=True)

    # Aggregation dimensions
    collection_name = Column(String(255), nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)
    hour = Column(Integer, nullable=True, index=True)  # 0-23, NULL for daily aggregation

    # Basic metrics
    total_queries = Column(Integer, default=0)
    unique_sessions = Column(Integer, default=0)
    total_tokens = Column(Integer, default=0)
    error_count = Column(Integer, default=0)
    regeneration_count = Column(Integer, default=0)

    # Response time metrics
    avg_response_time_ms = Column(Float, default=0.0)
    p50_response_time_ms = Column(Float, nullable=True)
    p95_response_time_ms = Column(Float, nullable=True)
    p99_response_time_ms = Column(Float, nullable=True)
    max_response_time_ms = Column(Float, nullable=True)

    # Retrieval metrics
    avg_retrieval_time_ms = Column(Float, default=0.0)
    avg_retrieval_score = Column(Float, nullable=True)
    avg_retrieved_count = Column(Float, default=0.0)

    # Reranking metrics
    reranking_usage_count = Column(Integer, default=0)
    avg_reranking_time_ms = Column(Float, nullable=True)

    # Top queries (stored as JSON string)
    top_queries = Column(Text, nullable=True)  # JSON array of top queries

    # Model usage (stored as JSON string)
    model_usage = Column(Text, nullable=True)  # JSON object with model: count

    # Reasoning level distribution (stored as JSON string)
    reasoning_distribution = Column(Text, nullable=True)  # JSON object with level: count

    # Metadata
    created_at = Column(DateTime, default=now_naive)
    updated_at = Column(DateTime, default=now_naive, onupdate=now_naive)

    def to_dict(self):
        """Convert model to dictionary"""
        import json

        return {
            "stat_id": self.stat_id,
            "collection_name": self.collection_name,
            "date": self.date.isoformat() if self.date else None,
            "hour": self.hour,
            "metrics": {
                "total_queries": self.total_queries,
                "unique_sessions": self.unique_sessions,
                "total_tokens": self.total_tokens,
                "error_count": self.error_count,
                "regeneration_count": self.regeneration_count
            },
            "response_time": {
                "avg": self.avg_response_time_ms,
                "p50": self.p50_response_time_ms,
                "p95": self.p95_response_time_ms,
                "p99": self.p99_response_time_ms,
                "max": self.max_response_time_ms
            },
            "retrieval": {
                "avg_time_ms": self.avg_retrieval_time_ms,
                "avg_score": self.avg_retrieval_score,
                "avg_count": self.avg_retrieved_count
            },
            "reranking": {
                "usage_count": self.reranking_usage_count,
                "avg_time_ms": self.avg_reranking_time_ms
            },
            "top_queries": json.loads(self.top_queries) if self.top_queries else [],
            "model_usage": json.loads(self.model_usage) if self.model_usage else {},
            "reasoning_distribution": json.loads(self.reasoning_distribution) if self.reasoning_distribution else {},
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }