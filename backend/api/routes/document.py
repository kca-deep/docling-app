"""
문서 변환 API 라우트
인증 필수: 관리자만 접근 가능
"""
from fastapi import APIRouter, UploadFile, File, HTTPException, Form, Depends, BackgroundTasks
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import Optional, List

from backend.services.docling_service import DoclingService
from backend.services.qwen3_service import qwen3_service
from backend.services import document_crud
from backend.services.progress_tracker import progress_tracker
from backend.database import get_db
from backend.dependencies.auth import get_current_active_user
from backend.models.user import User
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
    ProgressResponse,
    CategoryUpdateRequest,
    CategoryStatsResponse,
    CategoryStat,
)

router = APIRouter(
    prefix="/api/documents",
    tags=["documents"],
    dependencies=[Depends(get_current_active_user)]  # 모든 엔드포인트 인증 필수
)
docling_service = DoclingService()


async def _process_qwen3_background(
    file_content: bytes,
    filename: str,
    task_id: str
):
    """qwen3-vl 백그라운드 처리"""
    try:
        result = await qwen3_service.convert_document(
            file_content=file_content,
            filename=filename,
            task_id=task_id  # task_id 전달
        )
        # 결과는 progress_tracker에 자동 저장됨
    except Exception as e:
        # 에러 발생 시 progress_tracker에 실패 기록
        progress_tracker.mark_failed(task_id, str(e))


@router.post("/convert", response_model=ConvertResult)
async def convert_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    strategy: str = Form(default="qwen3-vl"),
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
            # Qwen3 VL OCR Service - 백그라운드 처리
            import time
            task_id = f"qwen3-{int(time.time() * 1000)}"

            # 파일 내용을 미리 읽어서 백그라운드 작업에 전달
            file_content_copy = file_content

            # 백그라운드 작업 등록
            background_tasks.add_task(
                _process_qwen3_background,
                file_content_copy,
                file.filename,
                task_id
            )

            # 즉시 task_id와 processing 상태 반환
            from backend.models.schemas import TaskStatus, DocumentInfo
            result = ConvertResult(
                task_id=task_id,
                status=TaskStatus.PROCESSING,
                document=DocumentInfo(
                    filename=file.filename,
                    md_content=None,
                    processing_time=None
                )
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
    category: Optional[str] = None,
    uncategorized: bool = False,
    db: Session = Depends(get_db)
):
    """
    저장된 문서 목록 조회 API (검색 및 페이징 지원)

    Args:
        skip: 건너뛸 개수 (페이징)
        limit: 가져올 최대 개수
        search: 검색어 (파일명 검색)
        category: 카테고리 필터 (컬렉션명)
        uncategorized: True면 미분류 문서만 조회
        db: DB 세션

    Returns:
        dict: 문서 목록, 전체 개수, 페이지 정보
    """
    try:
        # 카테고리 필터 모드 결정
        category_filter_mode = "uncategorized" if uncategorized else "exact"

        documents, total = document_crud.get_documents(
            db,
            skip=skip,
            limit=limit,
            search=search,
            category=category,
            category_filter_mode=category_filter_mode
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
                created_at=doc.created_at.isoformat() if doc.created_at else "",
                category=doc.category
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
            created_at=document.created_at.isoformat() if document.created_at else "",
            category=document.category
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


# === 진행률 추적 API ===

@router.get("/progress/{task_id}", response_model=ProgressResponse)
async def get_progress(task_id: str):
    """
    문서 변환 진행률 조회 API

    Args:
        task_id: Task ID (qwen3-vl 파싱에서 사용)

    Returns:
        ProgressResponse: 진행률 정보 (페이지별 진행 상황, 예상 남은 시간 등)
    """
    try:
        progress_data = progress_tracker.get_progress(task_id)

        if not progress_data:
            raise HTTPException(
                status_code=404,
                detail=f"진행률 정보를 찾을 수 없습니다 (Task ID: {task_id})"
            )

        return ProgressResponse(**progress_data)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"진행률 조회 중 오류 발생: {str(e)}"
        )


# === 카테고리 관련 API ===

@router.get("/categories", response_model=CategoryStatsResponse)
async def get_category_stats(db: Session = Depends(get_db)):
    """
    카테고리별 문서 수 통계 조회 API

    Returns:
        CategoryStatsResponse: 카테고리별 문서 수 목록
    """
    try:
        stats = document_crud.get_category_stats(db)
        total = sum(s["count"] for s in stats)

        return CategoryStatsResponse(
            categories=[CategoryStat(name=s["name"], count=s["count"]) for s in stats],
            total=total
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"카테고리 통계 조회 중 오류 발생: {str(e)}"
        )


@router.patch("/category")
async def update_category(
    request: CategoryUpdateRequest,
    db: Session = Depends(get_db)
):
    """
    문서 카테고리 일괄 변경 API

    Args:
        request: 카테고리 변경 요청 (document_ids, category)
        db: DB 세션

    Returns:
        변경된 문서 수
    """
    try:
        if not request.document_ids:
            raise HTTPException(
                status_code=400,
                detail="변경할 문서 ID가 없습니다"
            )

        updated_count = document_crud.update_document_categories(
            db,
            document_ids=request.document_ids,
            category=request.category
        )

        category_name = request.category if request.category else "미분류"
        return {
            "success": True,
            "updated_count": updated_count,
            "message": f"{updated_count}개 문서가 '{category_name}' 카테고리로 이동되었습니다"
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"카테고리 변경 중 오류 발생: {str(e)}"
        )
