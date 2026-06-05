"""
AI 쇼케이스 모델
"""
from sqlalchemy import (
    Column, Integer, String, Text, Boolean, DateTime,
    JSON, ForeignKey, Index
)
from backend.database import Base
from backend.utils.timezone import now_naive


class ShowcaseCategory(Base):
    __tablename__ = "showcase_categories"

    id          = Column(Integer, primary_key=True, autoincrement=True)
    key         = Column(String(50), unique=True, nullable=False, index=True)
    name        = Column(String(100), nullable=False)
    icon        = Column(String(50), nullable=False)
    color       = Column(String(30), nullable=False)
    description = Column(Text, nullable=True)
    sort_order  = Column(Integer, default=0)
    is_active   = Column(Boolean, default=True)
    created_at  = Column(DateTime, default=now_naive)


class ShowcaseItem(Base):
    __tablename__ = "showcase_items"

    id              = Column(Integer, primary_key=True, autoincrement=True)
    category_key    = Column(String(50), ForeignKey("showcase_categories.key"), nullable=False, index=True)
    title           = Column(String(200), nullable=False, index=True)
    summary         = Column(String(500), nullable=False)
    content         = Column(Text, nullable=False)
    item_type       = Column(String(30), nullable=False)        # prompt|code|guide|workflow|snippet
    difficulty      = Column(String(20), default="beginner")    # beginner|intermediate|advanced
    tags            = Column(JSON, default=list)
    author_id       = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    author_name     = Column(String(100), nullable=True)
    install_command = Column(String(500), nullable=True)
    source_url      = Column(String(500), nullable=True)
    thumbnail_url   = Column(String(500), nullable=True)        # 대표 이미지 (image_urls 중 하나)
    image_urls      = Column(JSON, default=list)                # 첨부 이미지 갤러리 (URL 목록)
    view_count      = Column(Integer, default=0)
    is_published    = Column(Boolean, default=True)
    is_featured     = Column(Boolean, default=False)
    created_at      = Column(DateTime, default=now_naive, index=True)
    updated_at      = Column(DateTime, default=now_naive, onupdate=now_naive)

    __table_args__ = (
        Index("ix_showcase_items_category_published", "category_key", "is_published"),
    )


class ShowcaseComment(Base):
    __tablename__ = "showcase_comments"

    id            = Column(Integer, primary_key=True, autoincrement=True)
    item_id       = Column(Integer, ForeignKey("showcase_items.id", ondelete="CASCADE"), nullable=False, index=True)
    author_id     = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    author_name   = Column(String(100), nullable=False)
    content       = Column(Text, nullable=False)
    password_hash = Column(String(255), nullable=True)  # 비로그인 작성자 삭제용
    created_at    = Column(DateTime, default=now_naive, index=True)
