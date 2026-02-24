"""
Chat 데이터 분석 API 라우터
Code Interpreter 기능을 위한 데이터 업로드 및 세션 관리
"""
import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel

from backend.config.settings import settings
from backend.utils.error_handler import get_http_error_detail

logger = logging.getLogger("uvicorn")

router = APIRouter(prefix="/api/chat", tags=["chat-data"])


# ============================================================================
# 스키마
# ============================================================================

class SheetInfo(BaseModel):
    """시트 정보"""
    name: str
    rows: int
    columns: int
    column_names: list[str]
    column_types: list[str]


class DataUploadResponse(BaseModel):
    """데이터 업로드 응답"""
    session_id: str
    filename: str
    file_size: int
    sheets: list[SheetInfo]
    message: str


# ============================================================================
# 설정 상수
# ============================================================================

# 데이터 업로드 허용 확장자
DATA_UPLOAD_ALLOWED_EXTENSIONS = getattr(
    settings, "DATA_UPLOAD_ALLOWED_EXTENSIONS",
    [".xlsx", ".xls", ".csv"]
)

# 데이터 업로드 최대 크기 (MB)
DATA_UPLOAD_MAX_SIZE_MB = getattr(
    settings, "DATA_UPLOAD_MAX_SIZE_MB",
    20
)


# ============================================================================
# 엔드포인트
# ============================================================================

@router.post("/upload-data", response_model=DataUploadResponse)
async def upload_data(file: UploadFile = File(...)):
    """
    데이터 분석용 엑셀/CSV 파일 업로드

    파일을 검증하고 DataSessionService에 저장합니다.
    반환된 session_id를 /stream 요청의 data_session_id로 사용합니다.

    Args:
        file: 업로드할 엑셀/CSV 파일

    Returns:
        DataUploadResponse: 세션 ID, 파일 정보, 시트 메타데이터

    Raises:
        HTTPException: 파일 검증 실패 또는 처리 오류 시
    """
    try:
        # 1. 파일명 검증
        if not file.filename:
            raise HTTPException(status_code=400, detail="파일명이 없습니다.")

        # 2. 확장자 검증
        file_ext = "." + file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
        if file_ext not in DATA_UPLOAD_ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"지원하지 않는 파일 형식입니다. 허용: {', '.join(DATA_UPLOAD_ALLOWED_EXTENSIONS)}"
            )

        # 3. 파일 크기 검증
        content = await file.read()
        file_size = len(content)
        max_size_bytes = DATA_UPLOAD_MAX_SIZE_MB * 1024 * 1024

        if file_size > max_size_bytes:
            raise HTTPException(
                status_code=400,
                detail=f"파일 크기({file_size / (1024*1024):.1f}MB)가 최대 허용 크기({DATA_UPLOAD_MAX_SIZE_MB}MB)를 초과합니다."
            )

        if file_size == 0:
            raise HTTPException(status_code=400, detail="빈 파일은 업로드할 수 없습니다.")

        logger.info(f"[DATA UPLOAD] File: {file.filename}, Size: {file_size} bytes, Extension: {file_ext}")

        # 4. DataSessionService 호출 (서비스 구현 후 연동)
        # TODO: Phase 1-3 구현 시 아래 주석 해제
        # from backend.services.data_session_service import data_session_service
        # result = await data_session_service.upload_excel(content, file.filename)
        # return DataUploadResponse(
        #     session_id=result.session_id,
        #     filename=file.filename,
        #     file_size=file_size,
        #     sheets=result.sheets,
        #     message=f"'{file.filename}' 업로드 완료"
        # )

        raise HTTPException(
            status_code=501,
            detail="데이터 분석 기능은 준비 중입니다. (Code Interpreter Phase 1)"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[DATA UPLOAD] Failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=get_http_error_detail(e, "upload", "데이터 파일 업로드 실패")
        )


@router.delete("/data-sessions/{session_id}")
async def delete_data_session(session_id: str):
    """
    데이터 세션 삭제

    Args:
        session_id: 삭제할 세션 ID

    Returns:
        dict: 삭제 결과

    Raises:
        HTTPException: 세션을 찾을 수 없거나 삭제 실패 시
    """
    # TODO: Phase 1-3 구현 시 DataSessionService 연동
    raise HTTPException(
        status_code=501,
        detail="데이터 분석 기능은 준비 중입니다. (Code Interpreter Phase 1)"
    )
