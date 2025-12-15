"""
셀프진단 API 라우트
AI 과제 보안성 검토 셀프진단 API 엔드포인트
"""
import logging
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
)
from backend.services.selfcheck_service import selfcheck_service, CHECKLIST_ITEMS
from backend.services.pdf_service import pdf_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/selfcheck", tags=["selfcheck"])


# 부서 목록
DEPARTMENTS = [
    # 본사
    "경영기획본부",
    "AI디지털심화팀",
    "정보보호팀",
    "고객지원팀",
    "방송인프라본부",
    "전파관리본부",
    "디지털방송본부",
    # 지방본부
    "서울본부",
    "부산본부",
    "대구본부",
    "광주본부",
    "대전본부",
    "강원본부",
    "충청본부",
    "전북본부",
    "경북본부",
    "경남본부",
]


@router.get("/llm-status", response_model=LLMStatusResponse)
async def get_llm_status():
    """
    현재 사용 가능한 LLM 상태 조회

    Returns:
        LLMStatusResponse: 선택된 모델 및 전체 모델 상태
    """
    return await selfcheck_service.get_llm_status()


@router.get("/departments")
async def get_departments():
    """
    부서 목록 조회

    Returns:
        list: 부서명 목록
    """
    return {"departments": DEPARTMENTS}


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
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    내 진단 이력 조회 (로그인 필수)

    Args:
        skip: 건너뛸 항목 수 (페이지네이션)
        limit: 조회할 항목 수

    Returns:
        SelfCheckHistoryResponse: 이력 목록
    """
    return selfcheck_service.get_history(
        db=db,
        user_id=current_user.id,
        skip=skip,
        limit=limit
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

    # 진단 결과 조회
    submission = selfcheck_service.get_submission(
        db=db,
        submission_id=submission_id,
        user_id=current_user.id
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
