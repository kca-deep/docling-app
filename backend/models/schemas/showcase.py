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
    thumbnail_url: Optional[str] = None
    image_urls: List[str] = Field(default_factory=list)
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
    thumbnail_url: Optional[str]   = Field(None, max_length=500)   # 대표 이미지
    image_urls: List[str]          = Field(default_factory=list)   # 첨부 이미지 갤러리
    is_published: bool      = Field(default=True)


class ShowcaseItemUpdate(ShowcaseItemCreate):
    pass


class ShowcaseSuggestion(BaseModel):
    """문서 추출 제안값 (보정 후). 모든 필드 Optional → 부분 추출/폴백도 200으로 응답.
    강한 검증은 최종 create_item(ShowcaseItemCreate)에서 수행한다."""
    category_key: Optional[str] = None   # 검증 후 DB 존재 key 또는 None
    title: Optional[str] = None          # 2~200 보정
    summary: Optional[str] = None        # 10~500 보정
    content: Optional[str] = None        # 정제 마크다운, >=10
    item_type: Optional[str] = None      # enum 보정, 미상이면 None
    difficulty: Optional[str] = None     # enum, 기본 beginner
    tags: List[str] = Field(default_factory=list)


class ShowcaseExtractResponse(BaseModel):
    """POST /api/showcase/extract 응답. DB 미변경, 제안만 반환."""
    suggestion: ShowcaseSuggestion
    warnings: List[str] = Field(default_factory=list)   # 한국어 안내 메시지
    parser_used: str                                     # 현재 "kordoc" 고정
    llm_used: bool
    source_markdown: Optional[str] = None                # return_markdown=True 일 때만


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
