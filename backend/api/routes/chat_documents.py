"""
채팅 문서 업로드 API 라우터
- 문서 업로드 및 백그라운드 처리
- SSE 진행률 스트리밍
- 임시 컬렉션 삭제
"""
import json
import asyncio
import uuid
import logging
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, UploadFile, File, Form, BackgroundTasks, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from backend.services.document_processor import document_processor, ProcessingStage
from backend.services.temp_collection_manager import get_temp_collection_manager
from backend.config.settings import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chat/documents", tags=["chat-documents"])


class UploadResponse(BaseModel):
    """업로드 응답"""
    task_id: str
    session_id: str
    filename: str
    status: str


class StatusResponse(BaseModel):
    """상태 응답"""
    stage: str
    progress: int
    filename: str
    collection_name: Optional[str] = None
    error: Optional[str] = None
    page_count: int = 0


class DeleteResponse(BaseModel):
    """삭제 응답"""
    deleted: bool
    collection_name: str


class TempCollectionInfo(BaseModel):
    """임시 컬렉션 정보"""
    name: str
    created_at: int
    age_minutes: float
    points_count: int


class TempCollectionsResponse(BaseModel):
    """임시 컬렉션 목록 응답"""
    collections: list
    count: int


class CleanupResponse(BaseModel):
    """정리 응답"""
    deleted_count: int


@router.post("/upload", response_model=UploadResponse)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    session_id: Optional[str] = Form(None),
    collection_name: Optional[str] = Form(None)
):
    """
    문서 업로드 시작 (즉시 반환, 백그라운드 처리)

    - 파일 검증 후 즉시 task_id 반환
    - 백그라운드에서 파싱/청킹/임베딩/저장 처리
    - SSE로 진행률 확인 가능
    - collection_name이 주어지면 기존 컬렉션에 추가 (다중 파일 지원)
    """
    # 파일명 검증
    if not file.filename:
        raise HTTPException(status_code=400, detail="파일명이 필요합니다")

    # 확장자 검증
    ext = Path(file.filename).suffix.lower()
    allowed_extensions = settings.ALLOWED_EXTENSIONS
    if ext not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"지원하지 않는 파일 형식입니다: {ext}. 지원 형식: {', '.join(allowed_extensions)}"
        )

    # 파일 크기 검증 (AI챗봇용 제한 적용)
    content = await file.read()
    max_size = settings.CHAT_MAX_UPLOAD_SIZE
    if len(content) > max_size:
        raise HTTPException(
            status_code=400,
            detail=f"파일 크기가 {settings.CHAT_MAX_UPLOAD_SIZE_MB}MB를 초과합니다"
        )

    # 작업 ID 및 세션 ID 생성
    task_id = str(uuid.uuid4())[:8]
    session_id = session_id or str(uuid.uuid4())[:12]

    # 기존 컬렉션명 검증 (제공된 경우)
    if collection_name and not collection_name.startswith("temp_"):
        raise HTTPException(
            status_code=400,
            detail="기존 컬렉션은 임시 컬렉션(temp_)만 지원합니다"
        )

    # 백그라운드 처리 시작
    background_tasks.add_task(
        document_processor.process_document,
        task_id=task_id,
        session_id=session_id,
        file_content=content,
        filename=file.filename,
        existing_collection_name=collection_name
    )

    logger.info(f"Document upload started: task_id={task_id}, filename={file.filename}")

    return UploadResponse(
        task_id=task_id,
        session_id=session_id,
        filename=file.filename,
        status="processing"
    )


@router.get("/status/{task_id}")
async def get_upload_status(task_id: str):
    """
    업로드 상태 SSE 스트리밍

    - 0.5초 간격으로 상태 전송
    - ready 또는 error 상태에서 종료
    """
    async def event_generator():
        max_wait = 300  # 최대 5분 대기
        waited = 0.0

        while waited < max_wait:
            status = document_processor.get_status(task_id)

            if not status:
                yield f"data: {json.dumps({'error': 'Task not found', 'stage': 'error'})}\n\n"
                break

            status_dict = {
                "stage": status.stage.value,
                "progress": status.progress,
                "filename": status.filename,
                "collection_name": status.collection_name,
                "error": status.error,
                "page_count": status.page_count
            }

            yield f"data: {json.dumps(status_dict)}\n\n"

            if status.stage in [ProcessingStage.READY, ProcessingStage.ERROR]:
                # 상태 정보 정리 (약간의 지연 후)
                await asyncio.sleep(5)
                document_processor.cleanup_status(task_id)
                break

            await asyncio.sleep(0.5)
            waited += 0.5

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


@router.delete("/{collection_name}", response_model=DeleteResponse)
async def delete_temp_collection(collection_name: str):
    """
    임시 컬렉션 삭제

    temp_ 접두사가 있는 컬렉션만 삭제 가능
    """
    if not collection_name.startswith("temp_"):
        raise HTTPException(
            status_code=400,
            detail="임시 컬렉션만 삭제할 수 있습니다"
        )

    temp_manager = get_temp_collection_manager()
    success = await temp_manager.delete_collection(collection_name)

    return DeleteResponse(deleted=success, collection_name=collection_name)


@router.get("/temp-collections", response_model=TempCollectionsResponse)
async def list_temp_collections():
    """
    임시 컬렉션 목록 조회 (디버깅용)
    """
    temp_manager = get_temp_collection_manager()
    collections = await temp_manager.list_temp_collections()
    return TempCollectionsResponse(collections=collections, count=len(collections))


@router.post("/cleanup", response_model=CleanupResponse)
async def trigger_cleanup(ttl_minutes: int = 60):
    """
    수동 정리 트리거 (디버깅용)

    Args:
        ttl_minutes: TTL (분), 기본값 60분
    """
    temp_manager = get_temp_collection_manager()
    deleted_count = await temp_manager.cleanup_expired(ttl_minutes)
    return CleanupResponse(deleted_count=deleted_count)
