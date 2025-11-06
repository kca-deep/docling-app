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
    target_type: str = Form(default="inbody"),
    to_formats: str = Form(default="md"),
    do_ocr: str = Form(default="true"),
    do_table_structure: str = Form(default="true"),
    include_images: str = Form(default="true"),
    table_mode: str = Form(default="accurate"),
    image_export_mode: str = Form(default="embedded"),
    page_range_start: str = Form(default="1"),
    page_range_end: str = Form(default="9223372036854776000"),
    do_formula_enrichment: str = Form(default="false"),
    pipeline: str = Form(default="standard")
):
    """
    문서 변환 API

    Args:
        file: 업로드할 파일 (PDF, DOCX 등)
        target_type: 변환 타겟 타입 (inbody, zip)
        to_formats: 출력 형식 (md, json, html, text, doctags)
        do_ocr: OCR 인식 활성화
        do_table_structure: 테이블 구조 인식
        include_images: 이미지 포함
        table_mode: 테이블 모드 (fast, accurate)
        image_export_mode: 이미지 내보내기 모드 (placeholder, embedded, referenced)
        page_range_start: 페이지 시작
        page_range_end: 페이지 끝
        do_formula_enrichment: 수식 인식
        pipeline: 처리 파이프라인 (legacy, standard, vlm, asr)

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

        # 파라미터 변환
        do_ocr_bool = do_ocr.lower() == "true"
        do_table_bool = do_table_structure.lower() == "true"
        include_images_bool = include_images.lower() == "true"
        do_formula_bool = do_formula_enrichment.lower() == "true"

        page_start = int(page_range_start) if page_range_start else 1
        page_end = int(page_range_end) if page_range_end else 9223372036854776000

        # Docling Service 호출
        result = await docling_service.convert_document(
            file_content=file_content,
            filename=file.filename,
            target_type=target_type,
            to_formats=to_formats,
            do_ocr=do_ocr_bool,
            do_table_structure=do_table_bool,
            include_images=include_images_bool,
            table_mode=table_mode,
            image_export_mode=image_export_mode,
            page_range_start=page_start,
            page_range_end=page_end,
            do_formula_enrichment=do_formula_bool,
            pipeline=pipeline
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
