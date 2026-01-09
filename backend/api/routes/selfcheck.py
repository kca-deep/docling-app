"""
셀프진단 API 라우트
AI 과제 보안성 검토 셀프진단 API 엔드포인트
"""
import logging
import os
import uuid
import mimetypes
from datetime import datetime
from typing import Optional, List
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import Response, FileResponse
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.dependencies.auth import get_current_active_user, get_current_user_optional, require_selfcheck_feedback
from backend.models.user import User
from backend.models.selfcheck import SelfCheckAttachment
from backend.models.schemas import (
    SelfCheckAnalyzeRequest,
    SelfCheckAnalyzeResponse,
    LLMStatusResponse,
    SelfCheckHistoryResponse,
    SelfCheckDetailResponse,
    SelfCheckExportRequest,
    SelfCheckExportPdfRequest,
    ExportPdfMode,
    FeedbackDraftResponse,
    FeedbackResponse,
    FeedbackViewResponse,
    FeedbackUpdateRequest,
    AttachmentInfo,
    AttachmentUploadResponse,
)
from backend.services.selfcheck_service import selfcheck_service, CHECKLIST_ITEMS
from backend.services.selfcheck.feedback_service import feedback_service
from backend.services.pdf_service import pdf_service
from backend.services.excel_export_service import excel_export_service

# 첨부파일 저장 경로
ATTACHMENT_UPLOAD_DIR = Path("backend/uploads/selfcheck")
ATTACHMENT_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# 허용 확장자 및 크기 제한
ALLOWED_EXTENSIONS = {".pdf", ".docx", ".doc", ".pptx", ".ppt", ".hwp"}
MAX_FILE_SIZE_MB = 20
MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024
MAX_FILES_PER_SUBMISSION = 5

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/selfcheck", tags=["selfcheck"])


@router.get("/llm-status", response_model=LLMStatusResponse)
async def get_llm_status():
    """
    현재 사용 가능한 LLM 상태 조회

    Returns:
        LLMStatusResponse: 선택된 모델 및 전체 모델 상태
    """
    return await selfcheck_service.get_llm_status()


@router.get("/checklist")
async def get_checklist():
    """
    체크리스트 항목 조회

    Returns:
        list: 체크리스트 항목 목록
    """
    return {"items": CHECKLIST_ITEMS}


@router.post("/analyze", response_model=SelfCheckAnalyzeResponse)
async def analyze(
    request: SelfCheckAnalyzeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    셀프진단 분석 실행 (로그인 필수)

    과제 내용을 기반으로 10개 체크리스트 항목을 AI가 분석합니다.
    분석 결과는 자동으로 DB에 저장됩니다.

    Args:
        request: 분석 요청 (과제 정보 + 체크리스트 사용자 입력)

    Returns:
        SelfCheckAnalyzeResponse: 분석 결과
    """
    logger.info(f"[SelfCheck] Analyze request from user {current_user.id}: {request.project_name}")

    return await selfcheck_service.analyze(
        request=request,
        user_id=current_user.id,
        db=db
    )


@router.get("/history", response_model=SelfCheckHistoryResponse)
async def get_history(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    start_date: Optional[str] = Query(None, description="시작일 (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="종료일 (YYYY-MM-DD)"),
    view_all: bool = Query(False, description="전체 조회 (관리자 전용)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    진단 이력 조회 (로그인 필수)

    Args:
        skip: 건너뛸 항목 수 (페이지네이션)
        limit: 조회할 항목 수
        start_date: 시작일 (YYYY-MM-DD 형식)
        end_date: 종료일 (YYYY-MM-DD 형식)
        view_all: 전체 조회 여부 (관리자만 사용 가능)

    Returns:
        SelfCheckHistoryResponse: 이력 목록
    """
    # 날짜 문자열을 datetime으로 변환
    start_dt = None
    end_dt = None
    if start_date:
        try:
            start_dt = datetime.strptime(start_date, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="시작일 형식이 올바르지 않습니다. (YYYY-MM-DD)")
    if end_date:
        try:
            end_dt = datetime.strptime(end_date, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="종료일 형식이 올바르지 않습니다. (YYYY-MM-DD)")

    # 관리자이고 view_all=True면 전체 조회 (user_id=None)
    target_user_id = None if (view_all and current_user.role == "admin") else current_user.id

    return selfcheck_service.get_history(
        db=db,
        user_id=target_user_id,
        skip=skip,
        limit=limit,
        start_date=start_dt,
        end_date=end_dt
    )


@router.get("/{submission_id}", response_model=SelfCheckDetailResponse)
async def get_submission(
    submission_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    특정 진단 상세 조회 (로그인 필수)

    - 관리자 또는 피드백 권한 보유자: 모든 제출건 조회 가능
    - 일반 사용자: 본인 제출건만 조회 가능

    Args:
        submission_id: 진단 ID (UUID)

    Returns:
        SelfCheckDetailResponse: 진단 상세 정보
    """
    # 관리자이거나 피드백 권한이 있으면 모든 제출건 조회 가능
    user_id = None if (current_user.role == "admin" or current_user.has_permission("selfcheck", "feedback")) else current_user.id

    return selfcheck_service.get_submission(
        db=db,
        submission_id=submission_id,
        user_id=user_id
    )


@router.delete("/{submission_id}")
async def delete_submission(
    submission_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    셀프진단 결과 삭제 (관리자 전용)

    DB와 Qdrant 양쪽에서 삭제합니다.

    Args:
        submission_id: 삭제할 진단 ID (UUID)

    Returns:
        삭제 결과
    """
    # 관리자 권한 체크
    if current_user.role != "admin":
        raise HTTPException(
            status_code=403,
            detail="관리자만 삭제할 수 있습니다"
        )

    result = await selfcheck_service.delete_submission(
        submission_id=submission_id,
        db=db
    )

    if not result["success"]:
        raise HTTPException(
            status_code=404 if "not found" in str(result.get("error", "")).lower() else 500,
            detail=result.get("error", "삭제 실패")
        )

    return {
        "success": True,
        "message": f"삭제 완료: {submission_id}",
        "db_deleted": result["db_deleted"],
        "qdrant_deleted": result["qdrant_deleted"]
    }


@router.post("/bulk-delete")
async def delete_submissions_bulk(
    request: SelfCheckExportRequest,  # submission_ids 필드 재사용
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    셀프진단 결과 일괄 삭제 (관리자 전용)

    선택된 여러 진단 결과를 DB와 Qdrant에서 삭제합니다.

    Args:
        request: 삭제할 submission_ids 목록

    Returns:
        삭제 결과 (성공/실패 건수)
    """
    # 관리자 권한 체크
    if current_user.role != "admin":
        raise HTTPException(
            status_code=403,
            detail="관리자만 삭제할 수 있습니다"
        )

    if not request.submission_ids:
        raise HTTPException(
            status_code=400,
            detail="삭제할 항목을 선택해주세요"
        )

    result = await selfcheck_service.delete_submissions_bulk(
        submission_ids=request.submission_ids,
        db=db
    )

    return {
        "success": result["failed"] == 0,
        "message": f"총 {result['total']}건 중 {result['success']}건 삭제 완료",
        "total": result["total"],
        "deleted": result["success"],
        "failed": result["failed"]
    }


@router.get("/{submission_id}/pdf")
async def download_pdf(
    submission_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    셀프진단 결과 PDF 다운로드 (로그인 필수)

    Args:
        submission_id: 진단 ID (UUID)

    Returns:
        PDF 파일 응답
    """
    from urllib.parse import quote

    # 진단 결과 조회 (관리자는 모든 submission 조회 가능)
    target_user_id = None if current_user.role == "admin" else current_user.id
    submission = selfcheck_service.get_submission(
        db=db,
        submission_id=submission_id,
        user_id=target_user_id
    )

    # PDF 생성
    pdf_bytes = await pdf_service.generate_selfcheck_report(submission)

    # 파일명 생성 (ASCII만 허용)
    ascii_project_name = "".join(
        c for c in submission.project_name if c.isascii() and (c.isalnum() or c in " _-")
    )[:30] or "project"
    ascii_filename = f"selfcheck_{ascii_project_name}_{submission_id[:8]}.pdf"

    # UTF-8 파일명 (RFC 5987 인코딩)
    korean_project_name = submission.project_name[:30]
    utf8_filename = f"selfcheck_{korean_project_name}_{submission_id[:8]}.pdf"
    encoded_filename = quote(utf8_filename, safe='')

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=\"{ascii_filename}\"; filename*=UTF-8''{encoded_filename}"
        }
    )


@router.post("/export/excel")
async def export_excel(
    request: SelfCheckExportRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    선택한 진단 결과를 Excel로 내보내기 (로그인 필수)

    Args:
        request: 내보내기 요청 (submission_ids 목록)

    Returns:
        Excel 파일 응답
    """
    from urllib.parse import quote
    from datetime import datetime as dt

    if not request.submission_ids:
        raise HTTPException(status_code=400, detail="내보낼 항목을 선택해주세요.")

    # 선택한 submissions 조회 (관리자는 모든 submission 조회 가능)
    target_user_id = None if current_user.role == "admin" else current_user.id
    submissions = selfcheck_service.get_submissions_by_ids(
        db=db,
        submission_ids=request.submission_ids,
        user_id=target_user_id
    )

    if not submissions:
        raise HTTPException(status_code=404, detail="선택한 진단 결과를 찾을 수 없습니다.")

    # Excel 생성
    excel_bytes = await excel_export_service.export_selfcheck_excel(submissions)

    # 파일명 생성
    timestamp = dt.now().strftime("%Y%m%d_%H%M%S")
    filename = f"selfcheck_export_{timestamp}.xlsx"

    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f"attachment; filename=\"{filename}\""
        }
    )


@router.post("/export/pdf")
async def export_pdf(
    request: SelfCheckExportPdfRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    선택한 진단 결과를 PDF로 내보내기 (로그인 필수)

    Args:
        request: 내보내기 요청 (submission_ids 목록, mode: individual/merged)

    Returns:
        PDF 파일 (merged) 또는 ZIP 파일 (individual)
    """
    from urllib.parse import quote
    from datetime import datetime as dt

    if not request.submission_ids:
        raise HTTPException(status_code=400, detail="내보낼 항목을 선택해주세요.")

    # 선택한 submissions 조회 (관리자는 모든 submission 조회 가능)
    target_user_id = None if current_user.role == "admin" else current_user.id
    submissions = selfcheck_service.get_submissions_by_ids(
        db=db,
        submission_ids=request.submission_ids,
        user_id=target_user_id
    )

    if not submissions:
        raise HTTPException(status_code=404, detail="선택한 진단 결과를 찾을 수 없습니다.")

    timestamp = dt.now().strftime("%Y%m%d_%H%M%S")

    if request.mode == ExportPdfMode.MERGED:
        # 병합 PDF
        pdf_bytes = await pdf_service.generate_merged_pdf(submissions)
        filename = f"selfcheck_merged_{timestamp}.pdf"

        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=\"{filename}\""
            }
        )
    else:
        # 개별 PDF (ZIP)
        zip_bytes = await pdf_service.generate_individual_pdfs_zip(submissions)
        filename = f"selfcheck_reports_{timestamp}.zip"

        return Response(
            content=zip_bytes,
            media_type="application/zip",
            headers={
                "Content-Disposition": f"attachment; filename=\"{filename}\""
            }
        )


# ===========================================
# 첨부파일 API
# ===========================================

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
    - 최대 파일 크기: 20MB
    - 최대 파일 수: 5개/진단

    Args:
        submission_id: 진단 ID (UUID)
        file: 업로드할 파일

    Returns:
        AttachmentUploadResponse: 업로드된 파일 정보
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
    """
    셀프진단 첨부파일 목록 조회 (로그인 필수)

    - 본인 진단 또는 피드백 권한자/관리자가 조회 가능

    Args:
        submission_id: 진단 ID (UUID)

    Returns:
        List[AttachmentInfo]: 첨부파일 목록
    """
    # 권한 확인: 관리자 또는 피드백 권한자는 모두 조회 가능
    has_access = (
        current_user.role == "admin" or
        current_user.has_permission("selfcheck", "feedback")
    )

    if not has_access:
        # 일반 사용자는 본인 진단만 조회 가능
        submission = selfcheck_service.get_submission_raw(
            db=db,
            submission_id=submission_id,
            user_id=current_user.id
        )
        if not submission:
            raise HTTPException(status_code=404, detail="진단 결과를 찾을 수 없습니다.")

    # 첨부파일 목록 조회
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
    """
    셀프진단 첨부파일 삭제 (본인 진단만 가능)

    Args:
        submission_id: 진단 ID (UUID)
        attachment_id: 첨부파일 ID

    Returns:
        삭제 결과
    """
    # 본인 진단 확인
    submission = selfcheck_service.get_submission_raw(
        db=db,
        submission_id=submission_id,
        user_id=current_user.id
    )
    if not submission:
        raise HTTPException(status_code=404, detail="진단 결과를 찾을 수 없습니다.")

    # 첨부파일 조회
    attachment = db.query(SelfCheckAttachment).filter(
        SelfCheckAttachment.id == attachment_id,
        SelfCheckAttachment.submission_id == submission_id
    ).first()

    if not attachment:
        raise HTTPException(status_code=404, detail="첨부파일을 찾을 수 없습니다.")

    # 파일 삭제
    try:
        file_path = Path(attachment.file_path)
        if file_path.exists():
            file_path.unlink()
    except Exception as e:
        logger.warning(f"Failed to delete file: {attachment.file_path}, error: {e}")

    # DB 삭제
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
    """
    셀프진단 첨부파일 다운로드 (로그인 필수)

    - 본인 진단 또는 피드백 권한자/관리자가 다운로드 가능

    Args:
        submission_id: 진단 ID (UUID)
        attachment_id: 첨부파일 ID

    Returns:
        파일 응답
    """
    from urllib.parse import quote

    # 권한 확인
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

    # 첨부파일 조회
    attachment = db.query(SelfCheckAttachment).filter(
        SelfCheckAttachment.id == attachment_id,
        SelfCheckAttachment.submission_id == submission_id
    ).first()

    if not attachment:
        raise HTTPException(status_code=404, detail="첨부파일을 찾을 수 없습니다.")

    file_path = Path(attachment.file_path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="파일이 존재하지 않습니다.")

    # RFC 5987 인코딩된 파일명
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
    """
    셀프진단 첨부파일 미리보기 (PDF만 지원)

    - 본인 진단 또는 피드백 권한자/관리자가 조회 가능
    - PDF 파일만 inline으로 표시, 그 외는 다운로드

    Args:
        submission_id: 진단 ID (UUID)
        attachment_id: 첨부파일 ID

    Returns:
        파일 응답 (inline)
    """
    from urllib.parse import quote

    # 권한 확인
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

    # 첨부파일 조회
    attachment = db.query(SelfCheckAttachment).filter(
        SelfCheckAttachment.id == attachment_id,
        SelfCheckAttachment.submission_id == submission_id
    ).first()

    if not attachment:
        raise HTTPException(status_code=404, detail="첨부파일을 찾을 수 없습니다.")

    file_path = Path(attachment.file_path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="파일이 존재하지 않습니다.")

    # PDF만 inline 미리보기 지원
    if attachment.mime_type == "application/pdf":
        return FileResponse(
            path=str(file_path),
            media_type="application/pdf",
            headers={
                "Content-Disposition": "inline"
            }
        )
    else:
        # 그 외 파일은 다운로드로 리다이렉트
        encoded_filename = quote(attachment.original_filename, safe='')
        return FileResponse(
            path=str(file_path),
            media_type=attachment.mime_type or "application/octet-stream",
            headers={
                "Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}"
            }
        )


# ===========================================
# Qdrant 마이그레이션 API (관리자 전용)
# ===========================================

@router.get("/qdrant/stats")
async def get_qdrant_stats(
    current_user: User = Depends(get_current_active_user)
):
    """
    Qdrant selfcheck 컬렉션 통계 조회 (관리자 전용)

    Returns:
        컬렉션 존재 여부, 포인트 수, 상태
    """
    # 관리자 권한 확인
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="관리자 권한이 필요합니다.")

    return await selfcheck_service.get_qdrant_collection_stats()


@router.post("/qdrant/migrate")
async def migrate_to_qdrant(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    기존 DB 프로젝트를 Qdrant로 마이그레이션 (관리자 전용)

    - 모든 완료된 프로젝트의 임베딩을 생성하여 Qdrant에 저장
    - 이미 존재하는 프로젝트는 덮어쓰기 (upsert)
    - 새 분석은 자동으로 Qdrant에 저장됨

    Returns:
        {"total": int, "migrated": int, "failed": int, "skipped": int}
    """
    # 관리자 권한 확인
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="관리자 권한이 필요합니다.")

    result = await selfcheck_service.migrate_projects_to_qdrant(db)

    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])

    return result


# ===========================================
# 피드백 API (피드백 권한 필요)
# ===========================================

@router.post("/{submission_id}/feedback/generate", response_model=FeedbackDraftResponse)
async def generate_feedback_draft(
    submission_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_selfcheck_feedback())
):
    """
    AI 피드백 초안 생성 (피드백 권한 필요)

    기존 셀프진단 결과를 바탕으로 관리적/기술적/종합의견 초안을 생성합니다.

    Args:
        submission_id: 셀프진단 ID (UUID)

    Returns:
        FeedbackDraftResponse: 생성된 초안 (3개 섹션)
    """
    try:
        return await feedback_service.generate_draft(
            db=db,
            submission_id=submission_id,
            user_id=user.id
        )
    except Exception as e:
        logger.error(f"Failed to generate feedback draft: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{submission_id}/feedback", response_model=FeedbackResponse)
async def get_feedback(
    submission_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_selfcheck_feedback())
):
    """
    피드백 조회 (피드백 권한 필요 - 작성자용)

    작성자/관리자가 피드백 내용 및 AI 초안을 조회합니다.

    Args:
        submission_id: 셀프진단 ID (UUID)

    Returns:
        FeedbackResponse: 피드백 정보 (AI 초안 포함)
    """
    feedback = feedback_service.get_feedback_for_writer(db, submission_id)
    if not feedback:
        raise HTTPException(status_code=404, detail="피드백을 찾을 수 없습니다")
    return feedback


@router.put("/{submission_id}/feedback", response_model=FeedbackResponse)
async def update_feedback(
    submission_id: str,
    request: FeedbackUpdateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_selfcheck_feedback())
):
    """
    피드백 수정 (피드백 권한 필요)

    작성자가 피드백 내용을 수정합니다.

    Args:
        submission_id: 셀프진단 ID (UUID)
        request: 수정할 피드백 내용

    Returns:
        FeedbackResponse: 수정된 피드백 정보
    """
    try:
        return feedback_service.update_feedback(
            db=db,
            submission_id=submission_id,
            user_id=user.id,
            request=request
        )
    except Exception as e:
        logger.error(f"Failed to update feedback: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{submission_id}/feedback/complete", response_model=FeedbackResponse)
async def complete_feedback(
    submission_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_selfcheck_feedback())
):
    """
    피드백 완료 처리 (피드백 권한 필요)

    피드백 작성을 완료 처리합니다.
    완료 후 사용자가 피드백을 조회할 수 있습니다.

    Args:
        submission_id: 셀프진단 ID (UUID)

    Returns:
        FeedbackResponse: 완료 처리된 피드백 정보
    """
    try:
        return feedback_service.complete_feedback(
            db=db,
            submission_id=submission_id,
            user_id=user.id
        )
    except Exception as e:
        logger.error(f"Failed to complete feedback: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{submission_id}/feedback/view", response_model=FeedbackViewResponse)
async def view_feedback_for_user(
    submission_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_active_user)
):
    """
    사용자용 피드백 조회 (로그인 필수)

    본인 제출건의 완료된 피드백을 조회합니다.
    피드백이 완료 상태가 아니면 조회할 수 없습니다.

    Args:
        submission_id: 셀프진단 ID (UUID)

    Returns:
        FeedbackViewResponse: 피드백 내용 (AI 초안 미포함)
    """
    try:
        feedback = feedback_service.get_feedback_for_user(
            db=db,
            submission_id=submission_id,
            user_id=user.id
        )
        if not feedback:
            raise HTTPException(status_code=404, detail="피드백을 찾을 수 없습니다")
        return feedback
    except Exception as e:
        if "본인" in str(e) or "완료" in str(e):
            raise HTTPException(status_code=403, detail=str(e))
        raise HTTPException(status_code=500, detail=str(e))
