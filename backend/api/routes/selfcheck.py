"""
셀프진단 API 라우트
AI 과제 보안성 검토 셀프진단 API 엔드포인트
"""
import logging
from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.dependencies.auth import get_current_active_user, get_current_user_optional, require_selfcheck_feedback
from backend.models.user import User
from backend.models.schemas import (
    SelfCheckAnalyzeRequest,
    SelfCheckAnalyzeResponse,
    SelfCheckUpdateRequest,
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
)
from backend.services.selfcheck_service import selfcheck_service, CHECKLIST_ITEMS
from backend.services.selfcheck.feedback_service import feedback_service
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


@router.put("/{submission_id}")
async def update_submission(
    submission_id: str,
    request: SelfCheckUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    셀프진단 내용 수정 (본인 소유 + 최종제출 전에만 가능)

    과제 정보 및 체크리스트 사용자 답변을 수정합니다.
    최종제출(submitted) 상태에서는 수정할 수 없습니다.

    Args:
        submission_id: 진단 ID (UUID)
        request: 수정할 내용

    Returns:
        수정 결과
    """
    # 소유권 확인 (관리자는 모든 건 수정 가능)
    submission = selfcheck_service.get_submission_raw(db, submission_id)
    if not submission:
        raise HTTPException(status_code=404, detail="진단 결과를 찾을 수 없습니다")

    if current_user.role != "admin" and submission.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="본인이 신청한 과제만 수정할 수 있습니다")

    if submission.status == "submitted":
        raise HTTPException(status_code=400, detail="최종제출된 건은 수정할 수 없습니다")

    update_data = request.model_dump(exclude={"checklist_items"}, exclude_none=True)

    success = selfcheck_service.update_submission(
        db=db,
        submission_id=submission_id,
        user_id=submission.user_id,
        update_data=update_data,
        checklist_items=request.checklist_items
    )

    if not success:
        raise HTTPException(status_code=500, detail="수정에 실패했습니다")

    return {
        "success": True,
        "message": f"수정 완료: {submission_id}"
    }


@router.post("/{submission_id}/submit")
async def submit_submission(
    submission_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    셀프진단 최종제출 (본인 소유만 가능)

    status를 completed -> submitted로 변경합니다.
    최종제출 후에는 수정할 수 없습니다.

    Args:
        submission_id: 진단 ID (UUID)

    Returns:
        제출 결과
    """
    submission = selfcheck_service.get_submission_raw(db, submission_id)
    if not submission:
        raise HTTPException(status_code=404, detail="진단 결과를 찾을 수 없습니다")

    if current_user.role != "admin" and submission.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="본인이 신청한 과제만 제출할 수 있습니다")

    if submission.status == "submitted":
        raise HTTPException(status_code=400, detail="이미 최종제출된 건입니다")

    success = selfcheck_service.submit_submission(
        db=db,
        submission_id=submission_id,
        user_id=submission.user_id
    )

    if not success:
        raise HTTPException(status_code=500, detail="최종제출에 실패했습니다")

    return {
        "success": True,
        "message": f"최종제출 완료: {submission_id}",
        "status": "submitted"
    }


@router.delete("/{submission_id}")
async def delete_submission(
    submission_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    셀프진단 결과 삭제 (관리자 또는 본인)

    - 관리자: 모든 건 삭제 가능
    - 신청자: 본인 건만 삭제 가능 (단, 피드백 등록완료 건은 삭제 불가)

    DB와 Qdrant 양쪽에서 삭제합니다.

    Args:
        submission_id: 삭제할 진단 ID (UUID)

    Returns:
        삭제 결과
    """
    # 소유권 및 권한 확인
    submission = selfcheck_service.get_submission_raw(db, submission_id)
    if not submission:
        raise HTTPException(status_code=404, detail="진단 결과를 찾을 수 없습니다")

    if current_user.role != "admin":
        # 본인 소유 확인
        if submission.user_id != current_user.id:
            raise HTTPException(
                status_code=403,
                detail="본인이 신청한 과제만 삭제할 수 있습니다"
            )

        # 피드백 등록완료 건 삭제 불가
        feedback_status = selfcheck_service.get_feedback_status(db, submission_id)
        if feedback_status == "completed":
            raise HTTPException(
                status_code=403,
                detail="보안성검토 피드백이 등록완료된 건은 삭제할 수 없습니다"
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
    셀프진단 결과 일괄 삭제 (관리자 또는 본인)

    - 관리자: 모든 건 삭제 가능
    - 신청자: 본인 건만 삭제 가능 (피드백 등록완료 건 제외)

    선택된 여러 진단 결과를 DB와 Qdrant에서 삭제합니다.

    Args:
        request: 삭제할 submission_ids 목록

    Returns:
        삭제 결과 (성공/실패/건너뛴 건수)
    """
    if not request.submission_ids:
        raise HTTPException(
            status_code=400,
            detail="삭제할 항목을 선택해주세요"
        )

    deletable_ids = []
    skipped = []

    if current_user.role == "admin":
        deletable_ids = request.submission_ids
    else:
        # 일반 사용자: 소유권 + 피드백 상태 확인
        for sid in request.submission_ids:
            submission = selfcheck_service.get_submission_raw(db, sid)
            if not submission:
                skipped.append({"submission_id": sid, "reason": "존재하지 않는 건"})
                continue
            if submission.user_id != current_user.id:
                skipped.append({"submission_id": sid, "reason": "본인 소유가 아닌 건"})
                continue
            feedback_status = selfcheck_service.get_feedback_status(db, sid)
            if feedback_status == "completed":
                skipped.append({"submission_id": sid, "reason": "피드백 등록완료된 건"})
                continue
            deletable_ids.append(sid)

    if not deletable_ids:
        return {
            "success": False,
            "message": "삭제 가능한 항목이 없습니다",
            "total": len(request.submission_ids),
            "deleted": 0,
            "failed": 0,
            "skipped": len(skipped),
            "skipped_details": skipped
        }

    result = await selfcheck_service.delete_submissions_bulk(
        submission_ids=deletable_ids,
        db=db
    )

    return {
        "success": result["failed"] == 0 and len(skipped) == 0,
        "message": f"총 {len(request.submission_ids)}건 중 {result['success']}건 삭제 완료"
                   + (f", {len(skipped)}건 건너뜀" if skipped else ""),
        "total": len(request.submission_ids),
        "deleted": result["success"],
        "failed": result["failed"],
        "skipped": len(skipped),
        "skipped_details": skipped
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

    - 관리자: 모든 완료된 피드백 조회 가능
    - 일반 사용자: 본인 제출건의 완료된 피드백만 조회 가능
    피드백이 완료 상태가 아니면 조회할 수 없습니다.

    Args:
        submission_id: 셀프진단 ID (UUID)

    Returns:
        FeedbackViewResponse: 피드백 내용 (AI 초안 미포함)
    """
    try:
        # 관리자는 모든 완료된 피드백 조회 가능 (user_id=None)
        target_user_id = None if user.role == "admin" else user.id

        feedback = feedback_service.get_feedback_for_user(
            db=db,
            submission_id=submission_id,
            user_id=target_user_id
        )
        if not feedback:
            raise HTTPException(status_code=404, detail="피드백을 찾을 수 없습니다")
        return feedback
    except Exception as e:
        if "본인" in str(e) or "완료" in str(e):
            raise HTTPException(status_code=403, detail=str(e))
        raise HTTPException(status_code=500, detail=str(e))
