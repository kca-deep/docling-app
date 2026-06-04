"""
AI 쇼케이스 CRUD 서비스
"""
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List

from fastapi import HTTPException
from sqlalchemy import or_, func, String
from sqlalchemy.orm import Session

from backend.models.showcase import ShowcaseCategory, ShowcaseItem, ShowcaseComment
from backend.models.schemas.showcase import (
    ShowcaseItemCreate, ShowcaseItemUpdate, ShowcaseCategoryResponse,
    ShowcaseItemSummary, ShowcaseItemDetail, ShowcaseListResponse, ShowcaseStatsResponse,
    CommentCreate, CommentDeleteRequest, CommentResponse, CommentListResponse,
)
from backend.services.auth_service import auth_service

logger = logging.getLogger(__name__)

SEED_CATEGORIES = [
    {"key": "writing",    "name": "글쓰기 도우미", "icon": "PencilLine", "color": "blue",   "sort_order": 1, "description": "보고서, 이메일, 기획서 작성에 활용하는 AI 프롬프트"},
    {"key": "image",      "name": "이미지 만들기", "icon": "ImagePlus",  "color": "purple", "sort_order": 2, "description": "이미지 생성 AI를 활용한 프롬프트 모음"},
    {"key": "data",       "name": "엑셀·데이터",  "icon": "Table2",     "color": "green",  "sort_order": 3, "description": "엑셀 VBA, 수식, 데이터 분석 스크립트"},
    {"key": "miniapp",    "name": "미니 프로그램", "icon": "Code2",      "color": "orange", "sort_order": 4, "description": "바이브코딩으로 만든 간단한 업무용 프로그램"},
    {"key": "automation", "name": "업무 자동화",   "icon": "Zap",        "color": "yellow", "sort_order": 5, "description": "반복 업무를 자동화하는 스크립트와 워크플로"},
    {"key": "howto",      "name": "AI 사용법",    "icon": "Lightbulb",  "color": "teal",   "sort_order": 6, "description": "AI 도구 활용 가이드와 팁"},
    {"key": "devtools",   "name": "개발자 도구",   "icon": "Terminal",   "color": "red",    "sort_order": 7, "description": "개발 생산성을 높이는 도구와 설정"},
]

_CATEGORY_NAME_CACHE: dict = {}


def _get_category_name(db: Session, key: str) -> str:
    if key not in _CATEGORY_NAME_CACHE:
        row = db.query(ShowcaseCategory).filter(ShowcaseCategory.key == key).first()
        _CATEGORY_NAME_CACHE[key] = row.name if row else key
    return _CATEGORY_NAME_CACHE[key]


def _item_to_summary(db: Session, item: ShowcaseItem) -> ShowcaseItemSummary:
    return ShowcaseItemSummary(
        id=item.id,
        category_key=item.category_key,
        category_name=_get_category_name(db, item.category_key),
        title=item.title,
        summary=item.summary,
        item_type=item.item_type,
        difficulty=item.difficulty,
        tags=item.tags or [],
        author_name=item.author_name,
        author_id=item.author_id,
        view_count=item.view_count,
        is_featured=item.is_featured,
        is_published=item.is_published,
        created_at=item.created_at,
    )


def _item_to_detail(db: Session, item: ShowcaseItem) -> ShowcaseItemDetail:
    return ShowcaseItemDetail(
        id=item.id,
        category_key=item.category_key,
        category_name=_get_category_name(db, item.category_key),
        title=item.title,
        summary=item.summary,
        item_type=item.item_type,
        difficulty=item.difficulty,
        tags=item.tags or [],
        author_name=item.author_name,
        author_id=item.author_id,
        view_count=item.view_count,
        is_featured=item.is_featured,
        is_published=item.is_published,
        created_at=item.created_at,
        content=item.content,
        install_command=item.install_command,
        source_url=item.source_url,
        updated_at=item.updated_at,
    )


def _check_ownership(item: ShowcaseItem, user) -> None:
    """
    소유권 2단계 검사.

    1단계: contribute 권한 확인 (RBAC 오버라이드 반영)
      admin이 특정 사용자의 contribute를 False로 설정한 경우
      기존 본인 글 수정/삭제도 차단한다.
    2단계: 소유권 확인 (admin은 면제)
    """
    if not user.has_permission("showcase", "contribute"):
        raise HTTPException(status_code=403, detail="showcase 기여 권한이 없습니다.")
    if user.role != "admin" and item.author_id != user.id:
        raise HTTPException(status_code=403, detail="본인 게시물만 수정/삭제할 수 있습니다.")


class ShowcaseCrud:

    def get_categories(self, db: Session) -> List[ShowcaseCategoryResponse]:
        categories = (
            db.query(ShowcaseCategory)
            .filter(ShowcaseCategory.is_active == True)
            .order_by(ShowcaseCategory.sort_order)
            .all()
        )
        result = []
        for cat in categories:
            count = (
                db.query(func.count(ShowcaseItem.id))
                .filter(
                    ShowcaseItem.category_key == cat.key,
                    ShowcaseItem.is_published == True,
                )
                .scalar()
            ) or 0
            result.append(ShowcaseCategoryResponse(
                id=cat.id,
                key=cat.key,
                name=cat.name,
                icon=cat.icon,
                color=cat.color,
                description=cat.description,
                sort_order=cat.sort_order,
                item_count=count,
            ))
        return result

    def get_items(
        self,
        db: Session,
        category: Optional[str] = None,
        item_type: Optional[str] = None,
        difficulty: Optional[str] = None,
        search: Optional[str] = None,
        tags: Optional[List[str]] = None,
        featured: Optional[bool] = None,
        sort: str = "created_at",
        order: str = "desc",
        skip: int = 0,
        limit: int = 20,
        include_unpublished: bool = False,
    ) -> ShowcaseListResponse:
        query = db.query(ShowcaseItem)

        if not include_unpublished:
            query = query.filter(ShowcaseItem.is_published == True)
        if category:
            query = query.filter(ShowcaseItem.category_key == category)
        if item_type:
            query = query.filter(ShowcaseItem.item_type == item_type)
        if difficulty:
            query = query.filter(ShowcaseItem.difficulty == difficulty)
        if featured is not None:
            query = query.filter(ShowcaseItem.is_featured == featured)
        if search:
            query = query.filter(
                or_(
                    ShowcaseItem.title.ilike(f"%{search}%"),
                    ShowcaseItem.summary.ilike(f"%{search}%"),
                    ShowcaseItem.tags.cast(String).ilike(f"%{search}%"),
                )
            )
        if tags:
            for tag in tags:
                query = query.filter(
                    ShowcaseItem.tags.cast(String).ilike(f"%{tag}%")
                )

        sort_col = ShowcaseItem.view_count if sort == "view_count" else ShowcaseItem.created_at
        query = query.order_by(sort_col.desc() if order == "desc" else sort_col.asc())

        total = query.count()
        items = query.offset(skip).limit(limit).all()

        return ShowcaseListResponse(
            items=[_item_to_summary(db, item) for item in items],
            total=total,
            skip=skip,
            limit=limit,
            has_next=(skip + limit) < total,
        )

    def get_item_by_id(self, db: Session, item_id: int, increment_view: bool = False) -> ShowcaseItemDetail:
        item = db.query(ShowcaseItem).filter(ShowcaseItem.id == item_id).first()
        if not item:
            raise HTTPException(status_code=404, detail="아이템을 찾을 수 없습니다.")
        if increment_view:
            item.view_count = (item.view_count or 0) + 1
            db.commit()
            db.refresh(item)
        return _item_to_detail(db, item)

    def get_featured_items(self, db: Session, limit: int = 6) -> List[ShowcaseItemSummary]:
        items = (
            db.query(ShowcaseItem)
            .filter(ShowcaseItem.is_featured == True, ShowcaseItem.is_published == True)
            .order_by(ShowcaseItem.view_count.desc())
            .limit(limit)
            .all()
        )
        return [_item_to_summary(db, item) for item in items]

    def get_recent_items(self, db: Session, days: int = 7, limit: int = 5) -> List[ShowcaseItemSummary]:
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        items = (
            db.query(ShowcaseItem)
            .filter(
                ShowcaseItem.is_published == True,
                ShowcaseItem.created_at >= cutoff,
            )
            .order_by(ShowcaseItem.created_at.desc())
            .limit(limit)
            .all()
        )
        return [_item_to_summary(db, item) for item in items]

    def create_item(self, db: Session, data: ShowcaseItemCreate, user) -> ShowcaseItemDetail:
        cat = db.query(ShowcaseCategory).filter(ShowcaseCategory.key == data.category_key).first()
        if not cat:
            raise HTTPException(status_code=400, detail="존재하지 않는 카테고리입니다.")

        item = ShowcaseItem(
            category_key=data.category_key,
            title=data.title,
            summary=data.summary,
            content=data.content,
            item_type=data.item_type,
            difficulty=data.difficulty,
            tags=data.tags,
            author_id=user.id,
            author_name=user.name or user.username,
            install_command=data.install_command,
            source_url=data.source_url,
            is_published=data.is_published,
        )
        db.add(item)
        db.commit()
        db.refresh(item)
        _CATEGORY_NAME_CACHE.clear()
        logger.info(f"Showcase item created: id={item.id} by user={user.id}")
        return _item_to_detail(db, item)

    def update_item(self, db: Session, item_id: int, data: ShowcaseItemUpdate, user) -> ShowcaseItemDetail:
        item = db.query(ShowcaseItem).filter(ShowcaseItem.id == item_id).first()
        if not item:
            raise HTTPException(status_code=404, detail="아이템을 찾을 수 없습니다.")
        _check_ownership(item, user)

        cat = db.query(ShowcaseCategory).filter(ShowcaseCategory.key == data.category_key).first()
        if not cat:
            raise HTTPException(status_code=400, detail="존재하지 않는 카테고리입니다.")

        for field in ("category_key", "title", "summary", "content", "item_type",
                      "difficulty", "tags", "install_command", "source_url", "is_published"):
            setattr(item, field, getattr(data, field))

        db.commit()
        db.refresh(item)
        _CATEGORY_NAME_CACHE.clear()
        return _item_to_detail(db, item)

    def delete_item(self, db: Session, item_id: int, user) -> None:
        item = db.query(ShowcaseItem).filter(ShowcaseItem.id == item_id).first()
        if not item:
            raise HTTPException(status_code=404, detail="아이템을 찾을 수 없습니다.")
        _check_ownership(item, user)
        db.delete(item)
        db.commit()

    def toggle_featured(self, db: Session, item_id: int) -> ShowcaseItemDetail:
        item = db.query(ShowcaseItem).filter(ShowcaseItem.id == item_id).first()
        if not item:
            raise HTTPException(status_code=404, detail="아이템을 찾을 수 없습니다.")
        item.is_featured = not item.is_featured
        db.commit()
        db.refresh(item)
        return _item_to_detail(db, item)

    def toggle_publish(self, db: Session, item_id: int, user) -> ShowcaseItemDetail:
        item = db.query(ShowcaseItem).filter(ShowcaseItem.id == item_id).first()
        if not item:
            raise HTTPException(status_code=404, detail="아이템을 찾을 수 없습니다.")
        _check_ownership(item, user)
        item.is_published = not item.is_published
        db.commit()
        db.refresh(item)
        return _item_to_detail(db, item)

    def _comment_to_response(self, comment: ShowcaseComment) -> CommentResponse:
        return CommentResponse(
            id=comment.id,
            item_id=comment.item_id,
            author_id=comment.author_id,
            author_name=comment.author_name,
            content=comment.content,
            has_password=comment.password_hash is not None,
            created_at=comment.created_at,
        )

    def get_comments(self, db: Session, item_id: int, skip: int = 0, limit: int = 10) -> CommentListResponse:
        item = db.query(ShowcaseItem).filter(ShowcaseItem.id == item_id).first()
        if not item:
            raise HTTPException(status_code=404, detail="아이템을 찾을 수 없습니다.")
        query = (
            db.query(ShowcaseComment)
            .filter(ShowcaseComment.item_id == item_id)
            .order_by(ShowcaseComment.created_at.asc())
        )
        total = query.count()
        comments = query.offset(skip).limit(limit).all()
        return CommentListResponse(
            comments=[self._comment_to_response(c) for c in comments],
            total=total,
            has_next=(skip + limit) < total,
        )

    def create_comment(self, db: Session, item_id: int, data: CommentCreate, user=None) -> CommentResponse:
        item = db.query(ShowcaseItem).filter(ShowcaseItem.id == item_id).first()
        if not item:
            raise HTTPException(status_code=404, detail="아이템을 찾을 수 없습니다.")
        author_id = None
        author_name = data.author_name.strip()
        password_hash = None
        if user is not None:
            author_id = user.id
            author_name = user.name or user.username
        elif data.password:
            password_hash = auth_service.get_password_hash(data.password)
        comment = ShowcaseComment(
            item_id=item_id,
            author_id=author_id,
            author_name=author_name,
            content=data.content.strip(),
            password_hash=password_hash,
        )
        db.add(comment)
        db.commit()
        db.refresh(comment)
        logger.info(f"Showcase comment created: item={item_id} author={author_name}")
        return self._comment_to_response(comment)

    def delete_comment(self, db: Session, comment_id: int, user=None, password: Optional[str] = None) -> None:
        comment = db.query(ShowcaseComment).filter(ShowcaseComment.id == comment_id).first()
        if not comment:
            raise HTTPException(status_code=404, detail="댓글을 찾을 수 없습니다.")
        if user is not None:
            # 로그인 사용자: admin이거나 본인 댓글
            if user.role != "admin" and comment.author_id != user.id:
                raise HTTPException(status_code=403, detail="본인 댓글만 삭제할 수 있습니다.")
        else:
            # 비로그인: 비밀번호 검증
            if not comment.password_hash:
                raise HTTPException(status_code=403, detail="삭제 권한이 없습니다.")
            if not password or not auth_service.verify_password(password, comment.password_hash):
                raise HTTPException(status_code=403, detail="비밀번호가 일치하지 않습니다.")
        db.delete(comment)
        db.commit()

    def get_stats(self, db: Session) -> ShowcaseStatsResponse:
        total = db.query(func.count(ShowcaseItem.id)).filter(ShowcaseItem.is_published == True).scalar() or 0
        featured = db.query(func.count(ShowcaseItem.id)).filter(
            ShowcaseItem.is_featured == True, ShowcaseItem.is_published == True
        ).scalar() or 0
        cutoff = datetime.now(timezone.utc) - timedelta(days=7)
        recent = db.query(func.count(ShowcaseItem.id)).filter(
            ShowcaseItem.is_published == True, ShowcaseItem.created_at >= cutoff
        ).scalar() or 0

        rows = (
            db.query(ShowcaseItem.category_key, func.count(ShowcaseItem.id))
            .filter(ShowcaseItem.is_published == True)
            .group_by(ShowcaseItem.category_key)
            .all()
        )
        category_counts = {row[0]: row[1] for row in rows}

        return ShowcaseStatsResponse(
            total_items=total,
            category_counts=category_counts,
            featured_count=featured,
            recent_count=recent,
        )

    def seed_categories(self, db: Session) -> None:
        existing = db.query(func.count(ShowcaseCategory.id)).scalar()
        if existing and existing > 0:
            return
        for cat_data in SEED_CATEGORIES:
            db.add(ShowcaseCategory(**cat_data))
        db.commit()
        _CATEGORY_NAME_CACHE.clear()
        logger.info("Showcase categories seeded.")


showcase_crud = ShowcaseCrud()
