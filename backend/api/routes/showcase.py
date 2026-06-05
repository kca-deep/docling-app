"""
AI 쇼케이스 API 라우터
"""
import uuid
import mimetypes
from pathlib import Path
from typing import Optional, List

from fastapi import APIRouter, Depends, Query, UploadFile, File, HTTPException, Request
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.middleware.rate_limit import limiter
from backend.dependencies.auth import get_current_active_user, get_current_user, require_admin, require_permission
from backend.config.settings import settings
from backend.models.schemas.showcase import (
    ShowcaseCategoryResponse, ShowcaseItemDetail,
    ShowcaseItemCreate, ShowcaseItemUpdate,
    ShowcaseListResponse, ShowcaseStatsResponse,
    ShowcaseExtractResponse,
    CommentCreate, CommentDeleteRequest, CommentResponse, CommentListResponse,
)
from backend.services.showcase_crud import showcase_crud
from backend.services import showcase_extract_service

router = APIRouter(prefix="/api/showcase", tags=["showcase"])

# 썸네일 이미지 저장 경로
IMAGE_UPLOAD_DIR = Path("backend/uploads/showcase")
IMAGE_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp"}
MAX_IMAGE_SIZE_BYTES = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024


@router.post("/upload-image")
async def upload_image(
    file: UploadFile = File(...),
    user=Depends(require_permission("showcase", "contribute")),
):
    """썸네일 이미지 업로드 → 접근 URL 반환"""
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"허용되지 않는 이미지 형식입니다. ({', '.join(sorted(ALLOWED_IMAGE_EXTENSIONS))})",
        )

    data = await file.read()
    if len(data) > MAX_IMAGE_SIZE_BYTES:
        raise HTTPException(
            status_code=400,
            detail=f"이미지 크기는 {settings.MAX_UPLOAD_SIZE_MB}MB 이하여야 합니다.",
        )

    filename = f"{uuid.uuid4().hex}{ext}"
    (IMAGE_UPLOAD_DIR / filename).write_bytes(data)
    return {"url": f"/api/showcase/images/{filename}"}


@router.post("/upload-images")
async def upload_images(
    files: List[UploadFile] = File(...),
    user=Depends(require_permission("showcase", "contribute")),
):
    """다중 썸네일 이미지 업로드 → 접근 URL 목록 반환 (갤러리용)."""
    if not files:
        raise HTTPException(status_code=400, detail="업로드할 이미지가 없습니다.")
    if len(files) > settings.SHOWCASE_MAX_IMAGES:
        raise HTTPException(
            status_code=400,
            detail=f"이미지는 한 번에 최대 {settings.SHOWCASE_MAX_IMAGES}개까지 업로드할 수 있습니다.",
        )

    urls: List[str] = []
    for file in files:
        ext = Path(file.filename or "").suffix.lower()
        if ext not in ALLOWED_IMAGE_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"허용되지 않는 이미지 형식입니다. ({', '.join(sorted(ALLOWED_IMAGE_EXTENSIONS))})",
            )
        data = await file.read()
        if len(data) > MAX_IMAGE_SIZE_BYTES:
            raise HTTPException(
                status_code=400,
                detail=f"이미지 크기는 {settings.MAX_UPLOAD_SIZE_MB}MB 이하여야 합니다.",
            )
        filename = f"{uuid.uuid4().hex}{ext}"
        (IMAGE_UPLOAD_DIR / filename).write_bytes(data)
        urls.append(f"/api/showcase/images/{filename}")

    return {"urls": urls}


@router.get("/images/{filename}")
async def get_image(filename: str):
    """업로드된 썸네일 이미지 서빙"""
    # 경로 조작 방지: 파일명만 허용
    safe_name = Path(filename).name
    file_path = IMAGE_UPLOAD_DIR / safe_name
    if safe_name != filename or not file_path.is_file():
        raise HTTPException(status_code=404, detail="이미지를 찾을 수 없습니다.")
    media_type = mimetypes.guess_type(str(file_path))[0] or "application/octet-stream"
    return FileResponse(file_path, media_type=media_type)


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
    # category는 콤마 구분 다중 선택 지원 (단일 값도 길이 1 리스트로 처리)
    category_list = [c.strip() for c in category.split(",") if c.strip()] if category else None
    return showcase_crud.get_items(
        db,
        category=category_list,
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


@router.post("/extract", response_model=ShowcaseExtractResponse)
@limiter.limit(settings.RATE_LIMIT_SHOWCASE_EXTRACT)
async def extract_from_file(
    request: Request,
    file: UploadFile = File(...),
    return_markdown: bool = Query(False),
    user=Depends(require_permission("showcase", "contribute")),
    db: Session = Depends(get_db),
):
    """문서 업로드 → 입력항목 자동 추출(제안). DB 미변경, 폼 프리필용 제안 JSON만 반환.

    LLM/파서 비용 보호를 위해 rate-limit 적용(settings.RATE_LIMIT_SHOWCASE_EXTRACT).
    """
    return await showcase_extract_service.extract_from_upload(db, file, return_markdown)


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
