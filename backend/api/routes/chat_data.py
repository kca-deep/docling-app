"""
Chat 데이터 분석 API 라우터
Code Interpreter 기능을 위한 데이터 업로드 및 세션 관리
"""
import logging
from typing import Optional, List
from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel

from backend.config.settings import settings
from backend.utils.error_handler import get_http_error_detail
from backend.services.data_session_service import data_session_service

logger = logging.getLogger("uvicorn")

router = APIRouter(prefix="/api/chat", tags=["chat-data"])


# ============================================================================
# 스키마
# ============================================================================

class ColumnInfo(BaseModel):
    """컬럼 상세 정보"""
    name: str
    dtype: str
    null_ratio: float
    sample_values: List[str]


class SheetInfo(BaseModel):
    """시트 정보"""
    name: str
    rows: int
    columns: int
    column_names: list[str]
    column_types: list[str]
    column_details: Optional[List[ColumnInfo]] = None


class DataUploadResponse(BaseModel):
    """데이터 업로드 응답"""
    session_id: str
    filename: str
    file_size: int
    sheets: list[SheetInfo]
    message: str


# ============================================================================
# 엔드포인트
# ============================================================================

@router.post("/upload-data", response_model=DataUploadResponse)
async def upload_data(file: UploadFile = File(...)):
    """
    데이터 분석용 엑셀/CSV 파일 업로드

    파일을 검증하고 DataSessionService에 저장합니다.
    반환된 session_id를 /stream 요청의 data_session_id로 사용합니다.
    """
    try:
        # 1. 파일명 검증
        if not file.filename:
            raise HTTPException(status_code=400, detail="파일명이 없습니다.")

        # 2. 확장자 검증
        file_ext = "." + file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
        if file_ext not in settings.DATA_UPLOAD_ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"지원하지 않는 파일 형식입니다. 허용: {', '.join(settings.DATA_UPLOAD_ALLOWED_EXTENSIONS)}"
            )

        # 3. 파일 크기 검증
        content = await file.read()
        file_size = len(content)
        max_size_bytes = settings.DATA_UPLOAD_MAX_SIZE_MB * 1024 * 1024

        if file_size > max_size_bytes:
            raise HTTPException(
                status_code=400,
                detail=f"파일 크기({file_size / (1024*1024):.1f}MB)가 최대 허용 크기({settings.DATA_UPLOAD_MAX_SIZE_MB}MB)를 초과합니다."
            )

        if file_size == 0:
            raise HTTPException(status_code=400, detail="빈 파일은 업로드할 수 없습니다.")

        logger.info(f"[DATA UPLOAD] File: {file.filename}, Size: {file_size} bytes, Extension: {file_ext}")

        # 4. DataSessionService 호출
        result = await data_session_service.upload_excel(content, file.filename)

        # 시트 정보 변환
        sheets = []
        for sheet in result.sheets:
            # 컬럼 상세 정보 생성
            column_details = []
            for i, col_name in enumerate(sheet.column_names):
                column_details.append(ColumnInfo(
                    name=col_name,
                    dtype=sheet.column_types[i],
                    null_ratio=sheet.null_ratios[i],
                    sample_values=sheet.sample_values[i] if i < len(sheet.sample_values) else [],
                ))

            sheets.append(SheetInfo(
                name=sheet.name,
                rows=sheet.rows,
                columns=sheet.columns,
                column_names=sheet.column_names,
                column_types=sheet.column_types,
                column_details=column_details,
            ))

        return DataUploadResponse(
            session_id=result.session_id,
            filename=file.filename,
            file_size=file_size,
            sheets=sheets,
            message=f"'{file.filename}' 업로드 완료",
        )

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
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
    """
    deleted = data_session_service.delete_session(session_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다.")

    return {"message": "세션이 삭제되었습니다.", "session_id": session_id}
