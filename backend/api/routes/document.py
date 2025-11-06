"""
문서 변환 API 라우트
"""
from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from fastapi.responses import JSONResponse
from typing import Optional

from backend.services.docling_service import DoclingService
from backend.models.schemas import (
    ConvertResult,
    TaskStatusResponse,
    ErrorResponse,
    TargetType
)

router = APIRouter(prefix="/api/documents", tags=["documents"])
docling_service = DoclingService()


@router.post("/convert", response_model=ConvertResult)
async def convert_document(
    file: UploadFile = File(...),
    target_type: str = Form(default="inbody")
):
    """
    문서 변환 API

    Args:
        file: 업로드할 파일 (PDF, DOCX 등)
        target_type: 변환 타겟 타입 (inbody, markdown, json)

    Returns:
        ConvertResult: 변환 결과
    """
    try:
        # 파일 검증
        if not file.filename:
            raise HTTPException(status_code=400, detail="파일명이 없습니다")

        # 파일 읽기
        file_content = await file.read()

        if len(file_content) == 0:
            raise HTTPException(status_code=400, detail="파일이 비어있습니다")

        # Docling Service 호출
        result = await docling_service.convert_document(
            file_content=file_content,
            filename=file.filename,
            target_type=target_type
        )

        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"문서 변환 중 오류 발생: {str(e)}"
        )


@router.get("/status/{task_id}", response_model=TaskStatusResponse)
async def get_task_status(task_id: str):
    """
    Task 상태 조회 API

    Args:
        task_id: Task ID

    Returns:
        TaskStatusResponse: Task 상태
    """
    try:
        status_data = await docling_service.get_task_status(task_id)
        return TaskStatusResponse(
            task_id=task_id,
            task_status=status_data.get("task_status", "unknown"),
            message=status_data.get("message")
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"상태 조회 중 오류 발생: {str(e)}"
        )


@router.get("/health")
async def health_check():
    """헬스 체크 API"""
    return {"status": "ok", "service": "docling-parse-api"}
