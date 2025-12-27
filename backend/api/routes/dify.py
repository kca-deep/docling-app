"""
Dify 연동 API 라우트
인증 필수: 관리자만 접근 가능
"""
import logging
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import List
import httpx

logger = logging.getLogger(__name__)

from backend.services.dify_service import DifyService
from backend.services import document_crud, dify_history_crud, dify_config_crud
from backend.database import get_db
from backend.dependencies.auth import get_current_active_user
from backend.models.schemas import (
    DifyConfigRequest,
    DifyConfigSaveRequest,
    DifyConfigUpdateRequest,
    DifyConfigListResponse,
    DifyDatasetListResponse,
    DifyUploadRequest,
    DifyUploadResponse,
    DifyUploadResult,
    DifyUploadHistoryResponse
)

router = APIRouter(
    prefix="/api/dify",
    tags=["dify"],
    dependencies=[Depends(get_current_active_user)]  # 모든 엔드포인트 인증 필수
)
dify_service = DifyService()


# ==================== Dify 설정 관리 API ====================

@router.post("/config", response_model=DifyConfigListResponse)
async def save_dify_config(
    request: DifyConfigSaveRequest,
    db: Session = Depends(get_db)
):
    """
    Dify 설정 저장 API

    Args:
        request: Dify 설정 저장 요청
        db: DB 세션

    Returns:
        DifyConfigListResponse: 저장된 설정
    """
    try:
        # 같은 이름의 설정이 있는지 확인
        existing = dify_config_crud.get_config_by_name(db, request.config_name)
        if existing:
            raise HTTPException(
                status_code=400,
                detail=f"'{request.config_name}' 이름의 설정이 이미 존재합니다"
            )

        config = dify_config_crud.create_config(
            db=db,
            config_name=request.config_name,
            api_key=request.api_key,
            base_url=request.base_url,
            default_dataset_id=request.default_dataset_id,
            default_dataset_name=request.default_dataset_name,
            description=request.description
        )

        return DifyConfigListResponse(
            id=config.id,
            config_name=config.config_name,
            base_url=config.base_url,
            default_dataset_id=config.default_dataset_id,
            default_dataset_name=config.default_dataset_name,
            is_active=config.is_active,
            description=config.description,
            created_at=config.created_at.isoformat(),
            last_used_at=config.last_used_at.isoformat() if config.last_used_at else None
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"설정 저장 중 오류 발생: {str(e)}"
        )


@router.get("/config", response_model=List[DifyConfigListResponse])
async def get_dify_configs(
    active_only: bool = False,
    db: Session = Depends(get_db)
):
    """
    Dify 설정 목록 조회 API

    Args:
        active_only: 활성 설정만 조회할지 여부
        db: DB 세션

    Returns:
        List[DifyConfigListResponse]: 설정 목록
    """
    try:
        configs = dify_config_crud.get_all_configs(db, active_only=active_only)

        return [
            DifyConfigListResponse(
                id=config.id,
                config_name=config.config_name,
                base_url=config.base_url,
                default_dataset_id=config.default_dataset_id,
                default_dataset_name=config.default_dataset_name,
                is_active=config.is_active,
                description=config.description,
                created_at=config.created_at.isoformat(),
                last_used_at=config.last_used_at.isoformat() if config.last_used_at else None
            )
            for config in configs
        ]

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"설정 조회 중 오류 발생: {str(e)}"
        )


@router.get("/config/active")
async def get_active_dify_config(db: Session = Depends(get_db)):
    """
    가장 최근에 사용한 활성 Dify 설정 조회 API

    Args:
        db: DB 세션

    Returns:
        dict: API 키와 Base URL (민감 정보는 마스킹)
    """
    try:
        config = dify_config_crud.get_active_config(db)

        if not config:
            return {
                "config_id": None,
                "config_name": None,
                "api_key": "",
                "base_url": "https://api.dify.ai/v1",
                "default_dataset_id": None,
                "default_dataset_name": None
            }

        # API 키 일부 마스킹 (보안)
        masked_key = config.api_key_encrypted[:10] + "..." if len(config.api_key_encrypted) > 10 else config.api_key_encrypted

        return {
            "config_id": config.id,
            "config_name": config.config_name,
            "api_key": config.api_key_encrypted,  # 실제 사용을 위해 전체 키 반환
            "api_key_masked": masked_key,
            "base_url": config.base_url,
            "default_dataset_id": config.default_dataset_id,
            "default_dataset_name": config.default_dataset_name
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"활성 설정 조회 중 오류 발생: {str(e)}"
        )


@router.put("/config/{config_id}", response_model=DifyConfigListResponse)
async def update_dify_config(
    config_id: int,
    request: DifyConfigUpdateRequest,
    db: Session = Depends(get_db)
):
    """
    Dify 설정 업데이트 API

    Args:
        config_id: 설정 ID
        request: 업데이트 요청
        db: DB 세션

    Returns:
        DifyConfigListResponse: 업데이트된 설정
    """
    try:
        config = dify_config_crud.update_config(
            db=db,
            config_id=config_id,
            api_key=request.api_key,
            base_url=request.base_url,
            default_dataset_id=request.default_dataset_id,
            default_dataset_name=request.default_dataset_name,
            description=request.description,
            is_active=request.is_active
        )

        if not config:
            raise HTTPException(status_code=404, detail="설정을 찾을 수 없습니다")

        return DifyConfigListResponse(
            id=config.id,
            config_name=config.config_name,
            base_url=config.base_url,
            default_dataset_id=config.default_dataset_id,
            default_dataset_name=config.default_dataset_name,
            is_active=config.is_active,
            description=config.description,
            created_at=config.created_at.isoformat(),
            last_used_at=config.last_used_at.isoformat() if config.last_used_at else None
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"설정 업데이트 중 오류 발생: {str(e)}"
        )


@router.delete("/config/{config_id}")
async def delete_dify_config(
    config_id: int,
    db: Session = Depends(get_db)
):
    """
    Dify 설정 삭제 API

    Args:
        config_id: 설정 ID
        db: DB 세션

    Returns:
        dict: 삭제 결과
    """
    try:
        success = dify_config_crud.delete_config(db, config_id)

        if not success:
            raise HTTPException(status_code=404, detail="설정을 찾을 수 없습니다")

        return {"message": "설정이 성공적으로 삭제되었습니다"}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"설정 삭제 중 오류 발생: {str(e)}"
        )


# ==================== Dify 업로드 이력 API ====================

@router.get("/upload-history", response_model=List[DifyUploadHistoryResponse])
async def get_upload_history(
    skip: int = 0,
    limit: int = 100,
    document_id: int = None,
    dataset_id: str = None,
    db: Session = Depends(get_db)
):
    """
    Dify 업로드 이력 조회 API

    Args:
        skip: 건너뛸 개수
        limit: 가져올 최대 개수
        document_id: 문서 ID 필터 (선택적)
        dataset_id: 데이터셋 ID 필터 (선택적)
        db: DB 세션

    Returns:
        List[DifyUploadHistoryResponse]: 업로드 이력 목록
    """
    try:
        histories = dify_history_crud.get_upload_histories(
            db=db,
            skip=skip,
            limit=limit,
            document_id=document_id,
            dataset_id=dataset_id
        )

        return [
            DifyUploadHistoryResponse(
                id=h.id,
                document_id=h.document_id,
                original_filename=h.document.original_filename if h.document else "",
                dify_dataset_id=h.dify_dataset_id,
                dify_dataset_name=h.dify_dataset_name,
                dify_document_id=h.dify_document_id,
                upload_status=h.upload_status,
                error_message=h.error_message,
                uploaded_at=h.uploaded_at.isoformat() if h.uploaded_at else ""
            )
            for h in histories
        ]

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"업로드 이력 조회 중 오류 발생: {str(e)}"
        )


@router.post("/datasets")
async def get_dify_datasets(
    config: DifyConfigRequest,
    page: int = 1,
    limit: int = 20
):
    """
    Dify 데이터셋 목록 조회 API

    Args:
        config: Dify 설정 (API 키, base URL)
        page: 페이지 번호
        limit: 페이지당 항목 수

    Returns:
        DifyDatasetListResponse: 데이터셋 목록
    """
    logger.debug(f"Dify datasets 요청 - Base URL: {config.base_url}")

    try:
        datasets = await dify_service.get_datasets(
            api_key=config.api_key,
            base_url=config.base_url,
            page=page,
            limit=limit
        )

        logger.debug(f"Dify datasets 조회 완료: {len(datasets.data)}개")

        # 응답을 dict로 변환하여 반환 (response_model 검증 우회)
        return {
            "data": [dataset.model_dump() for dataset in datasets.data],
            "has_more": datasets.has_more,
            "limit": datasets.limit,
            "total": datasets.total,
            "page": datasets.page
        }

    except httpx.HTTPStatusError as e:
        # HTTP 에러 (401, 403, 404 등)
        logger.warning(f"Dify API HTTP 에러: {e.response.status_code}")
        raise HTTPException(
            status_code=e.response.status_code,
            detail=f"Dify API 에러: {e.response.text}"
        )
    except Exception as e:
        # 기타 에러
        logger.exception(f"Dify 데이터셋 조회 중 오류 발생: {e}")
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


@router.post("/upload", response_model=DifyUploadResponse)
async def upload_documents_to_dify(
    request: DifyUploadRequest,
    db: Session = Depends(get_db)
):
    """
    선택한 문서들을 Dify 데이터셋에 일괄 업로드

    Args:
        request: 업로드 요청 (API 키, 데이터셋 ID, 문서 ID 목록)
        db: DB 세션

    Returns:
        DifyUploadResponse: 업로드 결과 (성공/실패 개수, 상세 결과)
    """
    results: List[DifyUploadResult] = []
    success_count = 0
    failure_count = 0

    try:
        # 각 문서를 순회하며 업로드
        for doc_id in request.document_ids:
            # DB에서 문서 조회
            document = document_crud.get_document_by_id(db, doc_id)

            if not document:
                results.append(DifyUploadResult(
                    document_id=doc_id,
                    filename=f"Unknown (ID: {doc_id})",
                    success=False,
                    error="문서를 찾을 수 없습니다"
                ))
                failure_count += 1
                continue

            # Dify에 업로드 시도
            try:
                response = await dify_service.upload_document_to_dataset(
                    api_key=request.api_key,
                    base_url=request.base_url,
                    dataset_id=request.dataset_id,
                    document_name=document.original_filename,
                    document_text=document.md_content
                )

                dify_document_id = response.get("document", {}).get("id")

                # 업로드 이력 저장
                dify_history_crud.create_upload_history(
                    db=db,
                    document_id=doc_id,
                    dify_dataset_id=request.dataset_id,
                    dify_dataset_name=request.dataset_name,
                    dify_document_id=dify_document_id,
                    dify_base_url=request.base_url,
                    upload_status="success",
                    error_message=None
                )

                # 성공
                results.append(DifyUploadResult(
                    document_id=doc_id,
                    filename=document.original_filename,
                    success=True,
                    dify_document_id=dify_document_id
                ))
                success_count += 1

            except Exception as upload_error:
                # 업로드 실패 이력 저장
                dify_history_crud.create_upload_history(
                    db=db,
                    document_id=doc_id,
                    dify_dataset_id=request.dataset_id,
                    dify_dataset_name=request.dataset_name,
                    dify_document_id=None,
                    dify_base_url=request.base_url,
                    upload_status="failure",
                    error_message=str(upload_error)
                )

                # 개별 업로드 실패
                results.append(DifyUploadResult(
                    document_id=doc_id,
                    filename=document.original_filename,
                    success=False,
                    error=str(upload_error)
                ))
                failure_count += 1

        return DifyUploadResponse(
            total=len(request.document_ids),
            success_count=success_count,
            failure_count=failure_count,
            results=results
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Dify 업로드 중 오류 발생: {str(e)}"
        )
