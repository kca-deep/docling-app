"""
Chat API 라우터
RAG 기반 채팅 엔드포인트
"""
import asyncio
import json
import logging
import uuid
import time
from pathlib import Path
from typing import Optional, Dict, Any
from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models.schemas import ChatRequest, RegenerateRequest, DefaultSettingsResponse
from backend.services.embedding_service import embedding_service
from backend.services.qdrant_service import qdrant_service
from backend.services.llm_service import llm_service
from backend.services.rag_service import RAGService
from backend.services.reranker_service import reranker_service as _reranker_service
from backend.services.hybrid_search_service import HybridSearchService
from backend.config.settings import settings
from backend.services import collection_crud
from backend.dependencies.auth import get_current_user_optional
from backend.models.user import User
from backend.utils.exaone_utils import is_exaone_model
from backend.utils.error_handler import get_http_error_detail, get_sse_error_response
from backend.utils.token_counter import count_chat_tokens
from backend.services.tool_executor_service import tool_executor
from backend.services.chat_excel_export_service import chat_excel_export_service
from backend.services.chat_docx_export_service import chat_docx_export_service
from backend.services.chat_pdf_export_service import chat_pdf_export_service
from backend.services.chat_text_export_service import chat_text_export_service
from backend.services.tool_definitions import get_chat_tools, get_tool_by_format

# 분리된 헬퍼 모듈
from .chat_helpers import (
    detect_export_format, might_be_export_request,
    convert_chat_history, build_llm_params, convert_docs_to_internal,
    prepare_chat_context, log_chat_request, schedule_error_logging,
    process_llm_stream_chunk, process_tool_calls_stream,
    log_chat_interaction_task,
)

# 로거 설정
logger = logging.getLogger("uvicorn")

router = APIRouter(prefix="/api/chat", tags=["chat"])

# 싱글톤 서비스 사용 (중복 인스턴스 제거)
# embedding_service, qdrant_service, llm_service는 import로 가져옴

# Reranker 서비스 (USE_RERANKING 설정에 따라)
reranker_service = _reranker_service if settings.USE_RERANKING else None

# 하이브리드 검색 서비스 초기화 (USE_HYBRID_SEARCH 설정에 따라)
hybrid_search_service = HybridSearchService(qdrant_service=qdrant_service) if settings.USE_HYBRID_SEARCH else None

rag_service = RAGService(
    embedding_service=embedding_service,
    qdrant_service=qdrant_service,
    llm_service=llm_service,
    reranker_service=reranker_service,
    hybrid_search_service=hybrid_search_service
)

# Function Calling 도구 핸들러 등록
tool_executor.register_handler("export_to_excel", chat_excel_export_service.handle_export_to_excel)
tool_executor.register_handler("export_to_docx", chat_docx_export_service.handle_export_to_docx)
tool_executor.register_handler("export_to_pdf", chat_pdf_export_service.handle_export_to_pdf)
tool_executor.register_handler("export_to_md", chat_text_export_service.handle_export_to_markdown)
tool_executor.register_handler("export_to_txt", chat_text_export_service.handle_export_to_text)


# ============================================================================
# 메인 채팅 엔드포인트
# ============================================================================


@router.post("/stream")
async def chat_stream(
    chat_request: ChatRequest,
    request: Request,
    background_tasks: BackgroundTasks,
):
    """
    RAG 기반 스트리밍 채팅

    Returns:
        StreamingResponse: SSE 스트리밍 응답
    """
    # 공통 컨텍스트 초기화
    ctx = prepare_chat_context(chat_request, request)
    log_chat_request(ctx, chat_request, "Stream")

    start_time = time.time()

    try:
        # 스트리밍 제너레이터
        collected_response = {"answer": "", "retrieved_docs": [], "usage": {}, "reasoning_content": ""}
        stream_error_info = None

        async def generate():
            nonlocal collected_response, stream_error_info

            # EXAONE 모델 감지 (llama.cpp가 reasoning_content와 content를 별도 필드로 전송)
            is_exaone = is_exaone_model(chat_request.model)

            # Function Calling 도구 활성화 (내보내기 의도가 감지된 경우에만)
            # P2: 요청된 형식의 도구만 선택적 활성화 (토큰 절약 + 혼란 방지)
            mode_name = 'Casual' if ctx['is_casual_mode'] else ('TempDoc' if ctx['is_temp_mode'] else 'RAG')
            if might_be_export_request(chat_request.message):
                # 특정 형식이 감지되면 해당 도구만 활성화
                detected_format = detect_export_format(chat_request.message)
                if detected_format:
                    tools = get_tool_by_format(detected_format)
                    logger.info(f"[CHAT API] {mode_name} mode - Export tool '{detected_format}' ENABLED (specific format)")
                else:
                    # 형식 미감지 시 전체 도구 활성화 (fallback)
                    tools = get_chat_tools()
                    logger.info(f"[CHAT API] {mode_name} mode - All export tools ENABLED (no specific format)")
            else:
                tools = None
                logger.info(f"[CHAT API] {mode_name} mode - Export tools DISABLED (no export intent)")

            try:
                async for chunk in rag_service.chat_stream(
                    collection_name=chat_request.collection_name,
                    query=chat_request.message,
                    model=chat_request.model,
                    reasoning_level=chat_request.reasoning_level,
                    temperature=chat_request.temperature,
                    max_tokens=chat_request.max_tokens,
                    top_p=chat_request.top_p,
                    frequency_penalty=chat_request.frequency_penalty,
                    presence_penalty=chat_request.presence_penalty,
                    top_k=chat_request.top_k,
                    score_threshold=chat_request.score_threshold,
                    chat_history=ctx['chat_history'],
                    use_reranking=chat_request.use_reranking,
                    use_hybrid=chat_request.use_hybrid,
                    temp_collection_name=chat_request.temp_collection_name,
                    tools=tools
                ):
                    # 공통 유틸리티로 스트림 청크 처리
                    chunks_to_yield = process_llm_stream_chunk(
                        chunk=chunk,
                        is_exaone=is_exaone,
                        collected_response=collected_response,
                        log_prefix="[STREAM DEBUG]",
                        debug_logging=True
                    )
                    for output_chunk in chunks_to_yield:
                        yield output_chunk

                # 스트리밍 완료 후 tool_calls 처리
                if collected_response.get("tool_calls"):
                    async for tool_chunk in process_tool_calls_stream(
                        tool_calls=collected_response["tool_calls"],
                        user_message=chat_request.message,
                        model=chat_request.model,
                        is_exaone=is_exaone,
                        chat_history=ctx['chat_history'],
                        tool_executor_instance=tool_executor,
                        llm_service_instance=llm_service,
                    ):
                        yield tool_chunk
            except asyncio.CancelledError:
                # 클라이언트 연결 끊김 시에도 기본 정보는 기록
                logger.warning("[CHAT API] Stream cancelled by client")
                stream_error_info = {
                    "error_type": "CancelledError",
                    "error_message": "Client disconnected"
                }
                raise  # 예외 재발생하여 정상적인 정리 진행
            except asyncio.TimeoutError as e:
                logger.error(f"[CHAT API] Stream timeout after {settings.STREAMING_TIMEOUT_SECONDS}s")
                stream_error_info = {
                    "error_type": "TimeoutError",
                    "error_message": f"Stream timeout ({settings.STREAMING_TIMEOUT_SECONDS}s)"
                }
                yield get_sse_error_response(e, "timeout")
            except Exception as e:
                logger.error(f"[CHAT API] Stream generation failed: {e}")
                stream_error_info = {
                    "error_type": type(e).__name__,
                    "error_message": str(e)
                }
                yield get_sse_error_response(e, "stream")
            finally:
                # 스트리밍 완료 후 로깅 (asyncio.shield로 취소 방지)
                final_response_time_ms = int((time.time() - start_time) * 1000)
                final_token_count = collected_response.get("usage", {}).get("total_tokens", 0)

                # 스트리밍에서 usage가 없는 경우 tiktoken으로 정확한 토큰 수 계산
                if final_token_count == 0 and collected_response.get("answer"):
                    token_stats = count_chat_tokens(
                        message=chat_request.message,
                        retrieved_docs=collected_response.get("retrieved_docs"),
                        answer=collected_response["answer"]
                    )
                    final_token_count = token_stats["total_tokens"]

                final_performance_metrics = {
                    "response_time_ms": final_response_time_ms,
                    "token_count": final_token_count,
                    "retrieval_time_ms": None
                }

                # asyncio.shield()로 로깅 태스크 보호 (클라이언트 취소에도 완료 보장)
                try:
                    await asyncio.shield(log_chat_interaction_task(
                        session_id=ctx['session_id'],
                        conversation_id=ctx['conversation_id'],
                        collection_name=ctx['effective_collection'] or "casual",
                        message=chat_request.message,
                        response_data=collected_response,
                        reasoning_level=chat_request.reasoning_level,
                        model=chat_request.model,
                        llm_params=build_llm_params(chat_request),
                        performance_metrics=final_performance_metrics,
                        error_info=stream_error_info,
                        request_id=ctx['tracking_ids'].get("request_id"),
                        trace_id=ctx['tracking_ids'].get("trace_id"),
                        client_info=ctx['client_info'],
                        use_reranking=chat_request.use_reranking
                    ))
                except asyncio.CancelledError:
                    # shield 내부에서도 취소될 수 있으므로 무시
                    logger.warning("[CHAT API] Stream logging interrupted but basic info recorded")
                except Exception as log_error:
                    logger.error(f"[CHAT API] Stream logging failed: {log_error}")

        # 스트리밍 응답 생성
        response = StreamingResponse(
            generate(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no"
            }
        )

        return response

    except Exception as e:
        logger.error(f"[CHAT API] Stream chat failed: {e}")
        schedule_error_logging(background_tasks, ctx, chat_request, e, start_time)
        raise HTTPException(
            status_code=500,
            detail=get_http_error_detail(e, "stream", "스트리밍 채팅 실패")
        )


@router.post("/regenerate/stream")
async def regenerate_stream(request: RegenerateRequest):
    """
    AI 응답 재생성 (스트리밍, 검색 결과 재사용)

    Returns:
        StreamingResponse: SSE 스트림
    """
    logger.info("=" * 80)
    logger.info("[REGENERATE STREAM] Endpoint called")
    logger.info(f"[REGENERATE STREAM] Model: {request.model}, Collection: {request.collection_name}")
    logger.info(f"[REGENERATE STREAM] Query: {request.query[:50]}...")
    logger.info("=" * 80)

    # 세션/대화 ID 및 시간 추적
    session_id = request.session_id or f"regen_stream_{int(time.time() * 1000)}"
    conversation_id = str(uuid.uuid4())
    start_time = time.time()
    stream_error_info = None

    try:
        # 공통 헬퍼로 변환
        chat_history = convert_chat_history(request.chat_history)
        retrieved_docs_internal = convert_docs_to_internal(request.retrieved_docs)

        # 스트리밍 응답 수집용
        collected_response = {"answer": "", "reasoning_content": ""}

        async def generate():
            nonlocal collected_response

            try:
                # 검색된 문서를 먼저 전송
                sources_data = [
                    {"id": doc.id, "text": doc.text, "score": doc.score, "metadata": doc.metadata}
                    for doc in request.retrieved_docs
                ]
                yield f'data: {json.dumps({"sources": sources_data}, ensure_ascii=False)}\n\n'

                # EXAONE 모델 감지
                is_exaone = is_exaone_model(request.model)

                # 스트리밍 생성
                # skip_score_filter=True: 재생성은 이미 검증된 문서 사용, 점수 필터링 비활성화
                async for chunk in rag_service.generate_stream(
                    query=request.query,
                    retrieved_docs=retrieved_docs_internal,
                    model=request.model,
                    reasoning_level=request.reasoning_level,
                    temperature=request.temperature,
                    max_tokens=request.max_tokens,
                    top_p=request.top_p,
                    frequency_penalty=request.frequency_penalty,
                    presence_penalty=request.presence_penalty,
                    chat_history=chat_history,
                    collection_name=request.collection_name,
                    skip_score_filter=True
                ):
                    # 공통 유틸리티로 스트림 청크 처리
                    chunks_to_yield = process_llm_stream_chunk(
                        chunk=chunk,
                        is_exaone=is_exaone,
                        collected_response=collected_response,
                        log_prefix="[REGENERATE STREAM]",
                        debug_logging=False
                    )
                    for output_chunk in chunks_to_yield:
                        yield output_chunk

            except Exception as e:
                nonlocal stream_error_info
                logger.error(f"[REGENERATE STREAM] Generation failed: {e}")
                stream_error_info = {
                    "error_type": type(e).__name__,
                    "error_message": str(e)
                }
                yield get_sse_error_response(e, "regenerate")
            finally:
                # 스트리밍 완료 후 로깅
                final_performance_metrics = {
                    "response_time_ms": int((time.time() - start_time) * 1000),
                    "token_count": 0,
                    "retrieval_time_ms": None
                }
                try:
                    await asyncio.shield(log_chat_interaction_task(
                        session_id=session_id,
                        conversation_id=conversation_id,
                        collection_name=request.collection_name or "regenerate",
                        message=f"[REGENERATE] {request.query}",
                        response_data={
                            "answer": collected_response.get("answer", ""),
                            "retrieved_docs": retrieved_docs_internal
                        },
                        reasoning_level=request.reasoning_level,
                        model=request.model,
                        llm_params=build_llm_params(request),
                        performance_metrics=final_performance_metrics,
                        error_info=stream_error_info,
                        use_reranking=False  # 재생성은 검색을 스킵하므로 리랭킹 미적용
                    ))
                except asyncio.CancelledError:
                    logger.warning("[REGENERATE STREAM] Logging interrupted")
                except Exception as log_error:
                    logger.error(f"[REGENERATE STREAM] Logging failed: {log_error}")

        return StreamingResponse(
            generate(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no"
            }
        )

    except Exception as e:
        logger.error(f"[REGENERATE STREAM] Failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=get_http_error_detail(e, "regenerate", "재생성 스트리밍 실패")
        )


def is_system_collection(name: str) -> bool:
    """시스템 컬렉션인지 확인 (selfcheck*, temp_* 패턴)"""
    if name.startswith("selfcheck"):
        return True
    if name.startswith("temp_"):
        return True
    return False


@router.get("/collections")
async def get_collections(
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """
    사용 가능한 Qdrant 컬렉션 목록 조회 (접근 제어 적용)

    사용자 권한에 따라 접근 가능한 컬렉션만 반환:
    - 비로그인: public 컬렉션만
    - 로그인: public + 소유 + 공유된(allowed) 컬렉션
    - 시스템 컬렉션(selfcheck, temp_*)은 항상 제외

    Returns:
        dict: 컬렉션 목록
            - collections: List[QdrantCollectionInfo]

    Raises:
        HTTPException: 조회 실패 시
    """
    try:
        # 1. Qdrant에서 모든 컬렉션 조회
        qdrant_collections = await qdrant_service.get_collections()
        # 시스템 컬렉션 제외
        qdrant_names = [col.name for col in qdrant_collections if not is_system_collection(col.name)]

        # 2. SQLite에서 접근 가능한 컬렉션 메타데이터 조회
        user_id = current_user.id if current_user else None
        accessible_metadata = collection_crud.get_accessible_collections(
            db=db,
            user_id=user_id,
            qdrant_collection_names=qdrant_names
        )

        # 3. 메타데이터를 딕셔너리로 변환 (빠른 조회용)
        metadata_map = {col.collection_name: col for col in accessible_metadata}

        # 4. Qdrant 데이터와 SQLite 메타데이터 병합
        result_collections = []
        for qdrant_col in qdrant_collections:
            if qdrant_col.name in metadata_map:
                meta = metadata_map[qdrant_col.name]
                result_collections.append({
                    "name": qdrant_col.name,
                    "documents_count": qdrant_col.documents_count,
                    "points_count": qdrant_col.points_count,
                    "vector_size": qdrant_col.vector_size,
                    "distance": qdrant_col.distance,
                    "visibility": meta.visibility,
                    "description": meta.description,
                    "owner_id": meta.owner_id,
                    "is_owner": user_id is not None and meta.owner_id == user_id
                })

        return {"collections": result_collections}

    except Exception as e:
        logger.error(f"[ERROR] Get collections failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=get_http_error_detail(e, "collection", "컬렉션 조회 실패")
        )


@router.get("/suggested-prompts/{collection_name}")
async def get_suggested_prompts(collection_name: str):
    """
    컬렉션별 추천 질문 조회

    Args:
        collection_name: Qdrant 컬렉션 이름

    Returns:
        dict: 추천 질문 목록
            - prompts: List[str] - 추천 질문 리스트
            - collection_name: str - 컬렉션 이름

    Raises:
        HTTPException: 조회 실패 시
    """
    try:
        # suggested_prompts.json 파일 로드
        config_path = Path(__file__).parent.parent.parent / "config" / "suggested_prompts.json"

        if not config_path.exists():
            # 파일이 없으면 기본 질문 반환
            default_prompts = [
                "이 문서의 주요 내용을 요약해주세요",
                "핵심 정책이 무엇인가요?",
                "주요 통계 데이터를 알려주세요",
                "가장 중요한 변경사항은 무엇인가요?"
            ]
            return {
                "prompts": default_prompts,
                "collection_name": collection_name
            }

        with open(config_path, "r", encoding="utf-8") as f:
            suggested_prompts = json.load(f)

        # 컬렉션 이름에 해당하는 질문이 있으면 반환, 없으면 default 반환
        prompts = suggested_prompts.get(collection_name, suggested_prompts.get("default", []))

        return {
            "prompts": prompts,
            "collection_name": collection_name
        }

    except Exception as e:
        logger.error(f"Get suggested prompts failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=get_http_error_detail(e, "prompts", "추천 질문 조회 실패")
        )


@router.get("/default-settings", response_model=DefaultSettingsResponse)
async def get_default_settings():
    """
    프론트엔드용 기본 설정 반환
    .env 파일의 값을 프론트엔드에 제공하여 초기 설정으로 사용

    Returns:
        DefaultSettingsResponse: 기본 설정
            - model: LLM 모델 이름
            - reasoning_level: 추론 수준
            - temperature: 온도
            - max_tokens: 최대 토큰 수
            - top_p: Top P
            - top_k: 검색할 문서 수
            - use_reranking: 리랭킹 사용 여부
    """
    try:
        logger.info("[GET DEFAULT SETTINGS] Returning default settings from .env")

        return DefaultSettingsResponse(
            model=settings.LLM_MODEL,
            reasoning_level=settings.RAG_DEFAULT_REASONING_LEVEL,
            temperature=settings.LLM_DEFAULT_TEMPERATURE,
            max_tokens=settings.LLM_DEFAULT_MAX_TOKENS,
            top_p=settings.LLM_DEFAULT_TOP_P,
            top_k=settings.RAG_DEFAULT_TOP_K,
            use_reranking=settings.USE_RERANKING,
        )
    except Exception as e:
        logger.error(f"[GET DEFAULT SETTINGS] Failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=get_http_error_detail(e, "settings", "기본 설정 조회 실패")
        )


