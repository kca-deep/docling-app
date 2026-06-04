"""
AI 쇼케이스 Pydantic 스키마
"""
from datetime import datetime
from typing import List, Optional, Dict
from pydantic import BaseModel, Field


class ShowcaseCategoryResponse(BaseModel):
    id: int
    key: str
    name: str
    icon: str
    color: str
    description: Optional[str] = None
    sort_order: int
    item_count: int

    class Config:
        from_attributes = True


class ShowcaseItemSummary(BaseModel):
    id: int
    category_key: str
    category_name: str
    title: str
    summary: str
    item_type: str
    difficulty: str
    tags: List[str]
    author_name: Optional[str] = None
    author_id: Optional[int] = None
    view_count: int
    is_featured: bool
    is_published: bool
    created_at: datetime

    class Config:
        from_attributes = True


class ShowcaseItemDetail(ShowcaseItemSummary):
    content: str
    install_command: Optional[str] = None
    source_url: Optional[str] = None
    updated_at: datetime


class ShowcaseItemCreate(BaseModel):
    category_key: str       = Field(..., max_length=50)
    title: str              = Field(..., min_length=2, max_length=200)
    summary: str            = Field(..., min_length=10, max_length=500)
    content: str            = Field(..., min_length=10)
    item_type: str          = Field(..., pattern=r"^(prompt|code|guide|workflow|snippet)$")
    difficulty: str         = Field(default="beginner", pattern=r"^(beginner|intermediate|advanced)$")
    tags: List[str]         = Field(default_factory=list)
    install_command: Optional[str] = Field(None, max_length=500)
    source_url: Optional[str]      = Field(None, max_length=500)
    is_published: bool      = Field(default=True)


class ShowcaseItemUpdate(ShowcaseItemCreate):
    pass


class ShowcaseListResponse(BaseModel):
    items: List[ShowcaseItemSummary]
    total: int
    skip: int
    limit: int
    has_next: bool


class ShowcaseStatsResponse(BaseModel):
    total_items: int
    category_counts: Dict[str, int]
    featured_count: int
    recent_count: int


class CommentCreate(BaseModel):
    author_name: str            = Field(..., min_length=1, max_length=100)
    content: str                = Field(..., min_length=1, max_length=2000)
    password: Optional[str]     = Field(None, min_length=4, max_length=100)


class CommentDeleteRequest(BaseModel):
    password: Optional[str] = Field(None, max_length=100)


class CommentResponse(BaseModel):
    id: int
    item_id: int
    author_id: Optional[int] = None
    author_name: str
    content: str
    has_password: bool
    created_at: datetime

    class Config:
        from_attributes = True


class CommentListResponse(BaseModel):
    comments: List[CommentResponse]
    total: int
    has_next: bool
