"""
AI 쇼케이스 API 라우터
"""
from typing import Optional, List

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.dependencies.auth import get_current_active_user, get_current_user, require_admin, require_permission
from backend.models.schemas.showcase import (
    ShowcaseCategoryResponse, ShowcaseItemDetail,
    ShowcaseItemCreate, ShowcaseItemUpdate,
    ShowcaseListResponse, ShowcaseStatsResponse,
    CommentCreate, CommentDeleteRequest, CommentResponse, CommentListResponse,
)
from backend.services.showcase_crud import showcase_crud

router = APIRouter(prefix="/api/showcase", tags=["showcase"])


@router.get("/categories", response_model=List[ShowcaseCategoryResponse])
async def get_categories(db: Session = Depends(get_db)):
    return showcase_crud.get_categories(db)


@router.get("/stats", response_model=ShowcaseStatsResponse)
async def get_stats(db: Session = Depends(get_db)):
    return showcase_crud.get_stats(db)


@router.get("/", response_model=ShowcaseListResponse)
async def list_items(
    category: Optional[str]      = Query(None),
    type: Optional[str]          = Query(None, alias="type"),
    difficulty: Optional[str]    = Query(None),
    search: Optional[str]        = Query(None),
    tags: Optional[str]          = Query(None, description="comma-separated tags"),
    featured: Optional[bool]     = Query(None),
    sort: str                    = Query("created_at", pattern=r"^(created_at|view_count)$"),
    order: str                   = Query("desc", pattern=r"^(asc|desc)$"),
    skip: int                    = Query(0, ge=0),
    limit: int                   = Query(20, ge=1, le=100),
    db: Session                  = Depends(get_db),
):
    tag_list = [t.strip() for t in tags.split(",")] if tags else None
    return showcase_crud.get_items(
        db,
        category=category,
        item_type=type,
        difficulty=difficulty,
        search=search,
        tags=tag_list,
        featured=featured,
        sort=sort,
        order=order,
        skip=skip,
        limit=limit,
    )


@router.get("/{item_id}", response_model=ShowcaseItemDetail)
async def get_item(
    item_id: int,
    increment_view: bool = Query(True),
    db: Session = Depends(get_db),
):
    return showcase_crud.get_item_by_id(db, item_id, increment_view=increment_view)


@router.post("/", response_model=ShowcaseItemDetail, status_code=201)
async def create_item(
    data: ShowcaseItemCreate,
    user=Depends(require_permission("showcase", "contribute")),
    db: Session = Depends(get_db),
):
    return showcase_crud.create_item(db, data, user)


@router.put("/{item_id}", response_model=ShowcaseItemDetail)
async def update_item(
    item_id: int,
    data: ShowcaseItemUpdate,
    user=Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    return showcase_crud.update_item(db, item_id, data, user)


@router.delete("/{item_id}", status_code=204)
async def delete_item(
    item_id: int,
    user=Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    showcase_crud.delete_item(db, item_id, user)


@router.patch("/{item_id}/featured", response_model=ShowcaseItemDetail)
async def toggle_featured(
    item_id: int,
    user=Depends(require_admin),
    db: Session = Depends(get_db),
):
    return showcase_crud.toggle_featured(db, item_id)


@router.patch("/{item_id}/publish", response_model=ShowcaseItemDetail)
async def toggle_publish(
    item_id: int,
    user=Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    return showcase_crud.toggle_publish(db, item_id, user)


@router.get("/{item_id}/comments", response_model=CommentListResponse)
async def get_comments(
    item_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
):
    return showcase_crud.get_comments(db, item_id, skip=skip, limit=limit)


@router.post("/{item_id}/comments", response_model=CommentResponse, status_code=201)
async def create_comment(
    item_id: int,
    data: CommentCreate,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return showcase_crud.create_comment(db, item_id, data, user=user)


@router.delete("/{item_id}/comments/{comment_id}", status_code=204)
async def delete_comment(
    item_id: int,
    comment_id: int,
    body: CommentDeleteRequest = CommentDeleteRequest(),
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    showcase_crud.delete_comment(db, comment_id, user=user, password=body.password)
