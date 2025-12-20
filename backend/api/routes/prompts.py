"""
프롬프트 자동 생성 API 라우터
"""
import logging
import asyncio
import uuid
from typing import Dict, Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from backend.utils.timezone import now_naive, now_iso
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.config.settings import settings
from backend.services.document_selector_service import document_selector_service
from backend.services.prompt_generator_service import prompt_generator_service
from backend.services.prompt_validator import prompt_validator
from backend.services.file_manager_service import file_manager_service
from backend.services.embedding_service import EmbeddingService
from backend.services.qdrant_service import QdrantService

logger = logging.getLogger(__name__)

# 청크 기반 샘플링용 서비스 인스턴스
embedding_service = EmbeddingService(
    base_url=settings.EMBEDDING_URL,
    model=settings.EMBEDDING_MODEL
)
qdrant_service = QdrantService(
    url=settings.QDRANT_URL,
    api_key=settings.QDRANT_API_KEY
)
router = APIRouter(prefix="/api/prompts", tags=["prompts"])

# 진행 중인 작업 저장소 (메모리)
# 실제 운영에서는 Redis 등 사용 권장
task_storage: Dict[str, Dict[str, Any]] = {}


# ================== Pydantic 모델 ==================

class GenerateRequest(BaseModel):
    """프롬프트 생성 요청"""
    collection_name: str = Field(..., description="컬렉션 이름")
    document_ids: List[int] = Field(..., description="문서 ID 목록")
    template_type: str = Field(default="default", description="템플릿 유형 (regulation, budget, default)")
    prompt_filename: Optional[str] = Field(None, description="저장할 프롬프트 파일명")
    model: Optional[str] = Field(None, description="사용할 LLM 모델")


class GenerateResponse(BaseModel):
    """프롬프트 생성 응답"""
    task_id: str
    status: str  # pending, processing, completed, failed
    message: str


class TaskStatusResponse(BaseModel):
    """작업 상태 응답"""
    task_id: str
    status: str
    progress: int
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


class SaveRequest(BaseModel):
    """프롬프트 저장 요청"""
    collection_name: str
    prompt_filename: str
    prompt_content: str
    suggested_questions: List[str]
    description: Optional[str] = None
    recommended_params: Optional[Dict[str, Any]] = None


class SaveResponse(BaseModel):
    """프롬프트 저장 응답"""
    success: bool
    backup_path: Optional[str] = None
    files_updated: List[str] = []
    message: str


class ValidateRequest(BaseModel):
    """프롬프트 검증 요청"""
    prompt_content: str
    questions: List[str] = []


class RollbackRequest(BaseModel):
    """롤백 요청"""
    backup_name: str


# ================== 백그라운드 작업 ==================

async def generate_prompt_task(
    task_id: str,
    collection_name: str,
    document_ids: List[int],
    template_type: str,
    model: Optional[str],
    db_session_maker
):
    """백그라운드에서 프롬프트 생성"""
    try:
        # 상태 업데이트: 처리 중
        task_storage[task_id]["status"] = "processing"
        task_storage[task_id]["progress"] = 10

        # DB 세션 생성
        db = db_session_maker()

        try:
            # 1. 문서 샘플링 (20%) - 청크 기반 샘플링 우선 시도
            task_storage[task_id]["progress"] = 20
            document_sample = ""

            # 청크 기반 샘플링 시도 (Qdrant에서 의미론적 검색)
            try:
                logger.info(f"청크 기반 샘플링 시작: collection={collection_name}, docs={document_ids}")
                document_sample = await document_selector_service.sample_documents_from_chunks(
                    collection_name=collection_name,
                    document_ids=document_ids,
                    embedding_service=embedding_service,
                    qdrant_service=qdrant_service,
                    max_tokens_total=4000,
                    top_k=15
                )
                if document_sample:
                    logger.info(f"청크 기반 샘플링 성공: {len(document_sample)}자")
            except Exception as e:
                logger.warning(f"청크 기반 샘플링 실패, 기존 방식으로 폴백: {e}")
                document_sample = ""

            # 청크 기반 실패 시 기존 위치 기반 샘플링으로 폴백
            if not document_sample:
                logger.info("기존 위치 기반 샘플링 사용")
                document_sample = document_selector_service.sample_multiple_documents(
                    db=db,
                    document_ids=document_ids,
                    max_tokens_total=4000
                )

            if not document_sample:
                raise ValueError("문서 샘플을 생성할 수 없습니다.")

            # 2. 프롬프트 생성 (60%)
            task_storage[task_id]["progress"] = 40
            result = await prompt_generator_service.generate_all(
                collection_name=collection_name,
                document_sample=document_sample,
                template_type=template_type,
                num_questions=4,
                model=model
            )

            task_storage[task_id]["progress"] = 80

            # 3. 검증 (90%)
            validation = prompt_validator.validate_all(
                prompt_content=result["prompt_content"],
                questions=result["suggested_questions"]
            )

            task_storage[task_id]["progress"] = 100
            task_storage[task_id]["status"] = "completed"
            task_storage[task_id]["result"] = {
                "prompt_content": result["prompt_content"],
                "suggested_questions": result["suggested_questions"],
                "template_used": result["template_used"],
                "tokens_used": result["total_tokens_used"],
                "validation": validation
            }

            logger.info(f"프롬프트 생성 완료: task_id={task_id}")

        finally:
            db.close()

    except Exception as e:
        logger.error(f"프롬프트 생성 실패: {e}")
        task_storage[task_id]["status"] = "failed"
        task_storage[task_id]["error"] = str(e)


# ================== API 엔드포인트 ==================

@router.post("/generate", response_model=GenerateResponse)
async def generate_prompt(
    request: GenerateRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    프롬프트 생성 시작 (비동기)

    백그라운드에서 프롬프트와 추천 질문을 생성합니다.
    task_id를 반환하며, GET /generate/{task_id}로 상태를 조회할 수 있습니다.
    """
    # 작업 ID 생성
    task_id = f"prompt-{uuid.uuid4().hex[:8]}"

    # 작업 초기화
    task_storage[task_id] = {
        "status": "pending",
        "progress": 0,
        "result": None,
        "error": None,
        "created_at": now_iso()
    }

    # DB 세션 팩토리 (백그라운드에서 새 세션 생성용)
    from backend.database import SessionLocal

    # 백그라운드 작업 등록
    background_tasks.add_task(
        generate_prompt_task,
        task_id=task_id,
        collection_name=request.collection_name,
        document_ids=request.document_ids,
        template_type=request.template_type,
        model=request.model,
        db_session_maker=SessionLocal
    )

    return GenerateResponse(
        task_id=task_id,
        status="pending",
        message="프롬프트 생성이 시작되었습니다."
    )


@router.get("/generate/{task_id}", response_model=TaskStatusResponse)
async def get_task_status(task_id: str):
    """
    작업 상태 조회

    프롬프트 생성 작업의 진행 상태를 조회합니다.
    status가 "completed"이면 result에 생성 결과가 포함됩니다.
    """
    if task_id not in task_storage:
        raise HTTPException(status_code=404, detail="작업을 찾을 수 없습니다.")

    task = task_storage[task_id]

    return TaskStatusResponse(
        task_id=task_id,
        status=task["status"],
        progress=task["progress"],
        result=task.get("result"),
        error=task.get("error")
    )


@router.post("/save", response_model=SaveResponse)
async def save_prompt(request: SaveRequest):
    """
    프롬프트 저장

    생성된 프롬프트와 추천 질문을 파일로 저장합니다.
    자동으로 백업을 생성하고, mapping.json과 suggested_prompts.json을 업데이트합니다.
    """
    try:
        result = file_manager_service.save_all(
            collection_name=request.collection_name,
            prompt_filename=request.prompt_filename,
            prompt_content=request.prompt_content,
            questions=request.suggested_questions,
            description=request.description,
            recommended_params=request.recommended_params
        )

        return SaveResponse(
            success=True,
            backup_path=result["backup_path"],
            files_updated=result["files_updated"],
            message=f"'{request.prompt_filename}' 프롬프트가 저장되었습니다."
        )

    except Exception as e:
        logger.error(f"프롬프트 저장 실패: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/templates")
async def get_templates():
    """
    템플릿 목록 조회

    사용 가능한 프롬프트 템플릿 목록을 반환합니다.
    """
    templates = file_manager_service.get_templates()
    return {"templates": templates}


@router.get("/documents/{collection_name}")
async def get_documents(
    collection_name: str,
    search: Optional[str] = None,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """
    컬렉션 문서 목록 조회

    프롬프트 생성에 사용할 문서 목록을 조회합니다.
    해당 컬렉션에 업로드된 문서만 반환합니다.
    """
    documents = document_selector_service.get_documents_for_collection(
        db=db,
        collection_name=collection_name,
        search=search,
        limit=limit
    )
    return {"documents": documents, "total": len(documents)}


@router.post("/validate")
async def validate_prompt(request: ValidateRequest):
    """
    프롬프트 검증

    프롬프트 내용과 추천 질문의 유효성을 검증합니다.
    """
    result = prompt_validator.validate_all(
        prompt_content=request.prompt_content,
        questions=request.questions
    )
    return result


@router.get("/backups")
async def list_backups():
    """
    백업 목록 조회

    생성된 백업 목록을 반환합니다.
    """
    backups = file_manager_service.list_backups()
    return {"backups": backups}


@router.post("/rollback")
async def rollback(request: RollbackRequest):
    """
    백업으로 롤백

    지정한 백업으로 프롬프트 파일들을 복원합니다.
    """
    try:
        result = file_manager_service.restore_backup(request.backup_name)
        if result["success"]:
            return {
                "success": True,
                "message": f"'{request.backup_name}' 백업으로 복원되었습니다.",
                "restored": result["restored"]
            }
        else:
            raise HTTPException(
                status_code=500,
                detail=f"일부 파일 복원 실패: {result['errors']}"
            )
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"롤백 실패: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# 작업 정리 (오래된 작업 삭제)
async def cleanup_old_tasks():
    """30분 이상 된 작업 삭제"""
    from datetime import datetime, timedelta

    cutoff = now_naive() - timedelta(minutes=30)
    to_delete = []

    for task_id, task in task_storage.items():
        created_at = datetime.fromisoformat(task.get("created_at", now_iso()))
        if created_at < cutoff:
            to_delete.append(task_id)

    for task_id in to_delete:
        del task_storage[task_id]

    if to_delete:
        logger.info(f"오래된 작업 {len(to_delete)}개 삭제됨")
