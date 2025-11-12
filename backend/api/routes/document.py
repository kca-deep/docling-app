"""
문서 변환 API 라우트
"""
from fastapi import APIRouter, UploadFile, File, HTTPException, Form, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import Optional, List

from backend.services.docling_service import DoclingService
from backend.services.qwen3_service import qwen3_service
from backend.services import document_crud
from backend.database import get_db
from backend.models.schemas import (
    ConvertResult,
    TaskStatusResponse,
    ErrorResponse,
    TargetType,
    DocumentSaveRequest,
    DocumentSaveResponse,
    DocumentListResponse,
    DocumentDetailResponse,
    URLConvertRequest,
)

router = APIRouter(prefix="/api/documents", tags=["documents"])
docling_service = DoclingService()


@router.post("/convert", response_model=ConvertResult)
async def convert_document(
    file: UploadFile = File(...),
    strategy: str = Form(default="docling"),
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
    pipeline: str = Form(default="standard"),
    vlm_pipeline_model: Optional[str] = Form(default=None)
):
    """
    문서 변환 API

    Args:
        file: 업로드할 파일 (PDF, DOCX 등)
        strategy: 파싱 전략 (docling, qwen3-vl)
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

        # 파싱 전략에 따라 서비스 선택
        if strategy == "qwen3-vl":
            # Qwen3 VL OCR Service 호출
            result = await qwen3_service.convert_document(
                file_content=file_content,
                filename=file.filename
            )
        elif strategy == "docling":
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
                pipeline=pipeline,
                vlm_pipeline_model=vlm_pipeline_model
            )
        else:
            raise HTTPException(
                status_code=400,
                detail=f"지원하지 않는 파싱 전략입니다: {strategy}"
            )

        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"문서 변환 중 오류 발생: {str(e)}"
        )


@router.post("/convert-url", response_model=ConvertResult)
async def convert_url(request: URLConvertRequest):
    """
    URL 문서 변환 API

    Args:
        request: URL 변환 요청 (JSON)

    Returns:
        ConvertResult: 변환 결과
    """
    try:
        # URL 검증
        if not request.url or not request.url.strip():
            raise HTTPException(status_code=400, detail="URL이 비어있습니다")

        # Docling Service 호출
        result = await docling_service.convert_url(
            url=request.url,
            target_type=request.target_type,
            to_formats=request.to_formats,
            do_ocr=request.do_ocr,
            do_table_structure=request.do_table_structure,
            include_images=request.include_images,
            table_mode=request.table_mode,
            image_export_mode=request.image_export_mode,
            page_range_start=request.page_range_start,
            page_range_end=request.page_range_end,
            do_formula_enrichment=request.do_formula_enrichment,
            pipeline=request.pipeline,
            vlm_pipeline_model=request.vlm_pipeline_model
        )

        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"URL 문서 변환 중 오류 발생: {str(e)}"
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


# === 문서 저장/관리 API ===

@router.post("/save", response_model=DocumentSaveResponse)
async def save_document(
    request: DocumentSaveRequest,
    db: Session = Depends(get_db)
):
    """
    문서 저장 API

    Args:
        request: 문서 저장 요청 데이터
        db: DB 세션

    Returns:
        DocumentSaveResponse: 저장된 문서 정보
    """
    try:
        # 이미 저장된 문서인지 확인 (task_id 중복 체크)
        existing_doc = document_crud.get_document_by_task_id(db, request.task_id)
        if existing_doc:
            raise HTTPException(
                status_code=400,
                detail=f"이미 저장된 문서입니다 (task_id: {request.task_id})"
            )

        # 문서 저장
        saved_doc = document_crud.create_document(db, request)

        return DocumentSaveResponse(
            id=saved_doc.id,
            task_id=saved_doc.task_id,
            original_filename=saved_doc.original_filename,
            message="문서가 성공적으로 저장되었습니다"
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"문서 저장 중 오류 발생: {str(e)}"
        )


@router.get("/saved")
async def get_saved_documents(
    skip: int = 0,
    limit: int = 20,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    저장된 문서 목록 조회 API (검색 및 페이징 지원)

    Args:
        skip: 건너뛸 개수 (페이징)
        limit: 가져올 최대 개수
        search: 검색어 (파일명 검색)
        db: DB 세션

    Returns:
        dict: 문서 목록, 전체 개수, 페이지 정보
    """
    try:
        documents, total = document_crud.get_documents(
            db, skip=skip, limit=limit, search=search
        )

        # Pydantic 모델로 변환
        items = [
            DocumentListResponse(
                id=doc.id,
                task_id=doc.task_id,
                original_filename=doc.original_filename,
                content_length=doc.content_length,
                content_preview=doc.content_preview,
                processing_time=doc.processing_time,
                created_at=doc.created_at.isoformat() if doc.created_at else ""
            ).model_dump()
            for doc in documents
        ]

        return {
            "items": items,
            "total": total,
            "page": (skip // limit) + 1,
            "page_size": limit,
            "total_pages": (total + limit - 1) // limit
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"문서 목록 조회 중 오류 발생: {str(e)}"
        )


@router.get("/saved/{document_id}", response_model=DocumentDetailResponse)
async def get_saved_document(
    document_id: int,
    db: Session = Depends(get_db)
):
    """
    저장된 문서 상세 조회 API (전체 내용 포함)

    Args:
        document_id: 문서 ID
        db: DB 세션

    Returns:
        DocumentDetailResponse: 문서 상세 정보 (전체 md_content 포함)
    """
    try:
        document = document_crud.get_document_by_id(db, document_id)

        if not document:
            raise HTTPException(
                status_code=404,
                detail=f"문서를 찾을 수 없습니다 (ID: {document_id})"
            )

        return DocumentDetailResponse(
            id=document.id,
            task_id=document.task_id,
            original_filename=document.original_filename,
            file_size=document.file_size,
            file_type=document.file_type,
            md_content=document.md_content,
            processing_time=document.processing_time,
            content_length=document.content_length,
            download_count=document.download_count,
            created_at=document.created_at.isoformat() if document.created_at else ""
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"문서 조회 중 오류 발생: {str(e)}"
        )


@router.delete("/saved/{document_id}")
async def delete_saved_document(
    document_id: int,
    db: Session = Depends(get_db)
):
    """
    저장된 문서 삭제 API

    Args:
        document_id: 문서 ID
        db: DB 세션

    Returns:
        삭제 성공 메시지
    """
    try:
        success = document_crud.delete_document(db, document_id)

        if not success:
            raise HTTPException(
                status_code=404,
                detail=f"문서를 찾을 수 없습니다 (ID: {document_id})"
            )

        return {"message": "문서가 성공적으로 삭제되었습니다", "id": document_id}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"문서 삭제 중 오류 발생: {str(e)}"
        )
