"""
셀프진단 첨부파일 API 라우트
파일 업로드, 조회, 삭제, 다운로드, 미리보기
"""
import logging
import os
import uuid
import mimetypes
from typing import List
from pathlib import Path
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.dependencies.auth import get_current_active_user
from backend.models.user import User
from backend.models.selfcheck import SelfCheckAttachment
from backend.models.schemas import AttachmentInfo, AttachmentUploadResponse
from backend.services.selfcheck_service import selfcheck_service
from backend.config.settings import settings

logger = logging.getLogger(__name__)

# 첨부파일 저장 경로
ATTACHMENT_UPLOAD_DIR = Path("backend/uploads/selfcheck")
ATTACHMENT_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# 허용 확장자 및 크기 제한 (settings에서 로드)
ALLOWED_EXTENSIONS = set(settings.SELFCHECK_ALLOWED_EXTENSIONS)
MAX_FILE_SIZE_MB = settings.SELFCHECK_MAX_FILE_SIZE_MB
MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024
MAX_FILES_PER_SUBMISSION = settings.SELFCHECK_MAX_FILES_PER_SUBMISSION

router = APIRouter(prefix="/api/selfcheck", tags=["selfcheck-attachments"])


def _check_attachment_access(
    db: Session,
    submission_id: str,
    current_user: User
) -> None:
    """첨부파일 접근 권한 확인 (관리자/피드백 권한자/본인)"""
    has_access = (
        current_user.role == "admin" or
        current_user.has_permission("selfcheck", "feedback")
    )
    if not has_access:
        submission = selfcheck_service.get_submission_raw(
            db=db,
            submission_id=submission_id,
            user_id=current_user.id
        )
        if not submission:
            raise HTTPException(status_code=404, detail="진단 결과를 찾을 수 없습니다.")


def _get_attachment(
    db: Session,
    submission_id: str,
    attachment_id: int
) -> SelfCheckAttachment:
    """첨부파일 조회 (없으면 404)"""
    attachment = db.query(SelfCheckAttachment).filter(
        SelfCheckAttachment.id == attachment_id,
        SelfCheckAttachment.submission_id == submission_id
    ).first()
    if not attachment:
        raise HTTPException(status_code=404, detail="첨부파일을 찾을 수 없습니다.")
    return attachment


@router.post("/{submission_id}/attachments", response_model=AttachmentUploadResponse)
async def upload_attachment(
    submission_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    셀프진단 첨부파일 업로드 (로그인 필수)

    - 지원 형식: PDF, DOCX, DOC, PPTX, PPT, HWP
    - 최대 파일 크기: settings 기반
    - 최대 파일 수: settings 기반
    """
    # 제출건 확인 (본인 것만 가능)
    submission = selfcheck_service.get_submission_raw(
        db=db,
        submission_id=submission_id,
        user_id=current_user.id
    )
    if not submission:
        raise HTTPException(status_code=404, detail="진단 결과를 찾을 수 없습니다.")

    # 기존 첨부파일 수 확인
    existing_count = db.query(SelfCheckAttachment).filter(
        SelfCheckAttachment.submission_id == submission_id
    ).count()

    if existing_count >= MAX_FILES_PER_SUBMISSION:
        raise HTTPException(
            status_code=400,
            detail=f"첨부파일은 최대 {MAX_FILES_PER_SUBMISSION}개까지 가능합니다."
        )

    # 파일 확장자 검증
    file_ext = os.path.splitext(file.filename)[1].lower() if file.filename else ""
    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"지원하지 않는 파일 형식입니다. 지원 형식: {', '.join(ALLOWED_EXTENSIONS)}"
        )

    # 파일 크기 검증
    content = await file.read()
    if len(content) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=400,
            detail=f"파일 크기는 최대 {MAX_FILE_SIZE_MB}MB입니다."
        )

    # 저장 경로 생성
    submission_dir = ATTACHMENT_UPLOAD_DIR / submission_id
    submission_dir.mkdir(parents=True, exist_ok=True)

    # 저장 파일명 생성 (UUID + 원본 확장자)
    stored_filename = f"{uuid.uuid4()}{file_ext}"
    file_path = submission_dir / stored_filename

    # 파일 저장
    with open(file_path, "wb") as f:
        f.write(content)

    # MIME 타입 추론
    mime_type = mimetypes.guess_type(file.filename)[0] if file.filename else None

    # DB 저장
    attachment = SelfCheckAttachment(
        submission_id=submission_id,
        original_filename=file.filename or "unknown",
        stored_filename=stored_filename,
        file_path=str(file_path),
        file_size=len(content),
        mime_type=mime_type,
        extraction_status="pending"
    )
    db.add(attachment)
    db.commit()
    db.refresh(attachment)

    logger.info(f"[Attachment] Uploaded: {file.filename} -> {stored_filename} for {submission_id}")

    return AttachmentUploadResponse(
        id=attachment.id,
        original_filename=attachment.original_filename,
        file_size=attachment.file_size,
        mime_type=attachment.mime_type,
        extraction_status=attachment.extraction_status,
        message="파일이 업로드되었습니다."
    )


@router.get("/{submission_id}/attachments", response_model=List[AttachmentInfo])
async def list_attachments(
    submission_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """셀프진단 첨부파일 목록 조회 (본인/관리자/피드백 권한자)"""
    _check_attachment_access(db, submission_id, current_user)

    attachments = db.query(SelfCheckAttachment).filter(
        SelfCheckAttachment.submission_id == submission_id
    ).order_by(SelfCheckAttachment.created_at.desc()).all()

    return [
        AttachmentInfo(
            id=att.id,
            original_filename=att.original_filename,
            file_size=att.file_size,
            mime_type=att.mime_type,
            extraction_status=att.extraction_status,
            created_at=att.created_at.isoformat() if att.created_at else ""
        )
        for att in attachments
    ]


@router.delete("/{submission_id}/attachments/{attachment_id}")
async def delete_attachment(
    submission_id: str,
    attachment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """셀프진단 첨부파일 삭제 (본인 진단만 가능)"""
    submission = selfcheck_service.get_submission_raw(
        db=db,
        submission_id=submission_id,
        user_id=current_user.id
    )
    if not submission:
        raise HTTPException(status_code=404, detail="진단 결과를 찾을 수 없습니다.")

    attachment = _get_attachment(db, submission_id, attachment_id)

    # 파일 삭제
    try:
        file_path = Path(attachment.file_path)
        if file_path.exists():
            file_path.unlink()
    except Exception as e:
        logger.warning(f"Failed to delete file: {attachment.file_path}, error: {e}")

    db.delete(attachment)
    db.commit()

    logger.info(f"[Attachment] Deleted: {attachment.original_filename} (id={attachment_id})")

    return {"success": True, "message": "첨부파일이 삭제되었습니다."}


@router.get("/{submission_id}/attachments/{attachment_id}/download")
async def download_attachment(
    submission_id: str,
    attachment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """셀프진단 첨부파일 다운로드 (본인/관리자/피드백 권한자)"""
    _check_attachment_access(db, submission_id, current_user)
    attachment = _get_attachment(db, submission_id, attachment_id)

    file_path = Path(attachment.file_path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="파일이 존재하지 않습니다.")

    encoded_filename = quote(attachment.original_filename, safe='')

    return FileResponse(
        path=str(file_path),
        media_type=attachment.mime_type or "application/octet-stream",
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}"
        }
    )


@router.get("/{submission_id}/attachments/{attachment_id}/preview")
async def preview_attachment(
    submission_id: str,
    attachment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """셀프진단 첨부파일 미리보기 (PDF만 inline, 나머지 다운로드)"""
    _check_attachment_access(db, submission_id, current_user)
    attachment = _get_attachment(db, submission_id, attachment_id)

    file_path = Path(attachment.file_path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="파일이 존재하지 않습니다.")

    if attachment.mime_type == "application/pdf":
        return FileResponse(
            path=str(file_path),
            media_type="application/pdf",
            headers={"Content-Disposition": "inline"}
        )
    else:
        encoded_filename = quote(attachment.original_filename, safe='')
        return FileResponse(
            path=str(file_path),
            media_type=attachment.mime_type or "application/octet-stream",
            headers={
                "Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}"
            }
        )
