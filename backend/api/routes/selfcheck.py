"""
셀프진단 API 라우트
AI 과제 보안성 검토 셀프진단 API 엔드포인트
"""
import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.dependencies.auth import get_current_active_user, get_current_user_optional
from backend.models.user import User
from backend.models.schemas import (
    SelfCheckAnalyzeRequest,
    SelfCheckAnalyzeResponse,
    LLMStatusResponse,
    SelfCheckHistoryResponse,
    SelfCheckDetailResponse,
    SelfCheckExportRequest,
    SelfCheckExportPdfRequest,
    ExportPdfMode,
)
from backend.services.selfcheck_service import selfcheck_service, CHECKLIST_ITEMS
from backend.services.pdf_service import pdf_service
from backend.services.excel_export_service import excel_export_service

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

    Args:
        submission_id: 진단 ID (UUID)

    Returns:
        SelfCheckDetailResponse: 진단 상세 정보
    """
    return selfcheck_service.get_submission(
        db=db,
        submission_id=submission_id,
        user_id=current_user.id
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
