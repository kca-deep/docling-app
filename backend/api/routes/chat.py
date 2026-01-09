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
from datetime import datetime
from typing import Optional, Dict, Any
from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.middleware.request_tracking import get_tracking_ids
from backend.utils.client_info import extract_client_info
from backend.models.schemas import ChatRequest, ChatResponse, RetrievedDocument, RegenerateRequest, DefaultSettingsResponse, ToolResultResponse
from backend.services.embedding_service import embedding_service
from backend.services.qdrant_service import qdrant_service
from backend.services.llm_service import llm_service
from backend.services.rag_service import RAGService
from backend.services.reranker_service import reranker_service as _reranker_service
from backend.services.hybrid_search_service import HybridSearchService
from backend.config.settings import settings
from backend.services.hybrid_logging_service import hybrid_logging_service
from backend.services.conversation_service import conversation_service
from backend.services import collection_crud
from backend.dependencies.auth import get_current_user_optional
from backend.models.user import User
from backend.utils.exaone_utils import clean_thought_tags_simple, is_exaone_model
from backend.utils.error_handler import get_http_error_detail, get_sse_error_response
from backend.utils.source_converter import extract_sources_info, convert_docs_to_sources
from backend.utils.token_counter import count_chat_tokens
from backend.services.keyword_service import extract_keywords_for_documents
from backend.services.tool_executor_service import tool_executor, file_storage
from backend.services.chat_excel_export_service import chat_excel_export_service
from backend.services.chat_docx_export_service import chat_docx_export_service
from backend.services.tool_definitions import get_chat_tools

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


# ============================================================================
# 공통 헬퍼 함수들
# ============================================================================

def convert_chat_history(chat_history: Optional[list]) -> Optional[list]:
    """채팅 기록을 내부 포맷으로 변환"""
    if not chat_history:
        return None
    return [{"role": msg.role, "content": msg.content} for msg in chat_history]


def build_llm_params(request) -> Dict[str, Any]:
    """LLM 파라미터 딕셔너리 생성"""
    return {
        "temperature": request.temperature,
        "max_tokens": request.max_tokens,
        "top_p": request.top_p
    }


def convert_docs_to_internal(docs: list) -> list:
    """RetrievedDocument 리스트를 내부 포맷으로 변환"""
    result = []
    for doc in docs:
        payload = {"text": doc.text}
        if doc.metadata:
            payload.update(doc.metadata)
        result.append({
            "id": doc.id,
            "score": doc.score,
            "payload": payload
        })
    return result


def prepare_chat_context(
    chat_request: ChatRequest,
    request: Request
) -> Dict[str, Any]:
    """
    채팅 요청의 공통 컨텍스트 초기화
    chat()와 chat_stream() 엔드포인트에서 공통 사용
    """
    # 추적 정보 추출
    tracking_ids = get_tracking_ids(request)
    client_info = extract_client_info(request)

    # 컬렉션 결정: temp_collection_name > collection_name > None (일상대화)
    effective_collection = chat_request.temp_collection_name or chat_request.collection_name
    is_casual_mode = not effective_collection
    is_temp_mode = bool(chat_request.temp_collection_name)

    # conversation_id 처리
    if not chat_request.conversation_id:
        chat_request.conversation_id = str(uuid.uuid4())

    # session_id 처리
    session_id = chat_request.session_id or str(uuid.uuid4())

    # 대화 시작
    conversation_id = conversation_service.start_conversation(
        conversation_id=chat_request.conversation_id,
        collection_name=effective_collection or "casual"
    )

    return {
        "tracking_ids": tracking_ids,
        "client_info": client_info,
        "effective_collection": effective_collection,
        "is_casual_mode": is_casual_mode,
        "is_temp_mode": is_temp_mode,
        "session_id": session_id,
        "conversation_id": conversation_id,
        "collection_display": effective_collection or "(일상대화)",
        "chat_history": convert_chat_history(chat_request.chat_history)
    }


def log_chat_request(context: Dict[str, Any], chat_request: ChatRequest, endpoint: str):
    """채팅 요청 로깅"""
    logger.info("=" * 80)
    logger.info(f"[CHAT API] {endpoint} endpoint called")
    logger.info(f"[CHAT API] Request ID: {context['tracking_ids'].get('request_id')}")
    logger.info(f"[CHAT API] Requested model: {chat_request.model}")
    logger.info(f"[CHAT API] Collection: {context['collection_display']}")
    mode = 'Casual' if context['is_casual_mode'] else ('TempDoc' if context['is_temp_mode'] else 'RAG')
    logger.info(f"[CHAT API] Mode: {mode}")
    logger.info(f"[CHAT API] Message: {chat_request.message[:50]}...")
    logger.info("=" * 80)


def schedule_error_logging(
    background_tasks: BackgroundTasks,
    context: Dict[str, Any],
    request,
    error: Exception,
    start_time: float
):
    """에러 발생 시 로깅 태스크 스케줄링"""
    error_info = {
        "error_type": type(error).__name__,
        "error_message": str(error)
    }

    # request 타입에 따라 message 추출
    message = getattr(request, 'message', None) or f"[REGENERATE] {getattr(request, 'query', '')}"
    collection = context.get('effective_collection') or getattr(request, 'collection_name', None) or "casual"

    background_tasks.add_task(
        log_chat_interaction_task,
        session_id=context.get('session_id', str(uuid.uuid4())),
        conversation_id=context.get('conversation_id', str(uuid.uuid4())),
        collection_name=collection,
        message=message,
        response_data={},
        reasoning_level=request.reasoning_level,
        model=request.model,
        llm_params=build_llm_params(request),
        performance_metrics={
            "response_time_ms": int((time.time() - start_time) * 1000)
        },
        error_info=error_info,
        request_id=context.get('tracking_ids', {}).get("request_id"),
        trace_id=context.get('tracking_ids', {}).get("trace_id"),
        client_info=context.get('client_info')
    )


# ============================================================================
# 스트리밍 청크 처리 유틸리티
# ============================================================================

def process_llm_stream_chunk(
    chunk: str,
    is_exaone: bool,
    collected_response: dict,
    log_prefix: str = "[STREAM]",
    debug_logging: bool = False
) -> list:
    """
    LLM 스트리밍 청크 처리 - 공통 유틸리티

    Args:
        chunk: SSE 청크 문자열
        is_exaone: EXAONE 모델 여부
        collected_response: 응답 수집 딕셔너리 (mutated)
        log_prefix: 로그 접두사
        debug_logging: 디버그 로깅 활성화

    Returns:
        list: yield할 SSE 청크 목록
    """
    chunks_to_yield = []

    if not chunk.startswith('data: '):
        # [DONE] 처리
        if 'data: [DONE]' in chunk:
            rc_len = len(collected_response.get("reasoning_content", ""))
            ans_len = len(collected_response.get("answer", ""))
            logger.info(f"{log_prefix} [DONE] detected, reasoning: {rc_len} chars, answer: {ans_len} chars")
            chunks_to_yield.append(chunk)
        elif not is_exaone:
            chunks_to_yield.append(chunk)
        return chunks_to_yield

    try:
        data_str = chunk[6:]  # 'data: ' 제거
        if not data_str.strip() or data_str == '[DONE]':
            if 'data: [DONE]' in chunk:
                chunks_to_yield.append(chunk)
            return chunks_to_yield

        data = json.loads(data_str)

        # OpenAI 호환 API: choices[0].delta에서 추출
        if 'choices' in data and data['choices']:
            choice = data['choices'][0]
            delta = choice.get('delta', {})
            content = delta.get('content', '')
            reasoning_content = delta.get('reasoning_content', '')

            # 최종 message에서 reasoning_content 확인 (일부 서버에서 지원)
            message = choice.get('message', {})
            if message.get('reasoning_content'):
                reasoning_content = message.get('reasoning_content', '')
                logger.info(f"{log_prefix} Got reasoning_content from message: {len(reasoning_content)} chars")

            # 디버그 로깅 (처음 3개 청크만)
            if debug_logging and len(collected_response.get("answer", "")) < 50:
                logger.info(f"{log_prefix} Full chunk: {data}")
                logger.info(f"{log_prefix} choice keys: {list(choice.keys())}, delta keys: {list(delta.keys())}")

            # EXAONE 모델 처리
            if is_exaone:
                if reasoning_content:
                    # 첫 번째 reasoning_content 수신 시 "reasoning" 단계 이벤트 전송
                    if not collected_response.get("_reasoning_stage_sent"):
                        chunks_to_yield.append(f'data: {json.dumps({"type": "stage", "stage": "reasoning"})}\n\n')
                        collected_response["_reasoning_stage_sent"] = True
                    collected_response["reasoning_content"] = collected_response.get("reasoning_content", "") + reasoning_content
                    chunks_to_yield.append(f'data: {json.dumps({"type": "reasoning_chunk", "content": reasoning_content})}\n\n')

                if content:
                    clean_content = clean_thought_tags_simple(content)
                    if clean_content:
                        collected_response["answer"] = collected_response.get("answer", "") + clean_content
                        chunks_to_yield.append(f'data: {json.dumps({"choices": [{"delta": {"content": clean_content}, "index": 0}]})}\n\n')
            else:
                # GPT-OSS 및 기타 모델
                if content:
                    collected_response["answer"] = collected_response.get("answer", "") + content
                if reasoning_content:
                    # 첫 번째 reasoning_content 수신 시 "reasoning" 단계 이벤트 전송
                    if not collected_response.get("_reasoning_stage_sent"):
                        chunks_to_yield.append(f'data: {json.dumps({"type": "stage", "stage": "reasoning"})}\n\n')
                        collected_response["_reasoning_stage_sent"] = True
                    logger.info(f"{log_prefix} Got reasoning_content chunk: {len(reasoning_content)} chars")
                    collected_response["reasoning_content"] = collected_response.get("reasoning_content", "") + reasoning_content
                    chunks_to_yield.append(f'data: {json.dumps({"type": "reasoning_chunk", "content": reasoning_content})}\n\n')

        # sources/retrieved_docs/usage/error 처리 (chat_stream 호환)
        if 'sources' in data:
            collected_response["retrieved_docs"] = data['sources']
            if is_exaone:
                chunks_to_yield.append(f'data: {json.dumps({"sources": data["sources"]})}\n\n')
        # sources_update: 리랭킹 후 최종 점수로 업데이트 (로깅에 반영)
        if 'sources_update' in data:
            collected_response["retrieved_docs"] = data['sources_update']
        if 'retrieved_docs' in data:
            collected_response["retrieved_docs"] = data['retrieved_docs']
        if 'usage' in data:
            collected_response["usage"] = data['usage']
        if 'error' in data and data['error']:
            error_message = data['error']
            collected_response["answer"] = error_message
            logger.warning(f"{log_prefix} Error response received: {error_message[:100]}")

        # Function Calling: tool_calls 감지 및 누적
        if 'choices' in data and data['choices']:
            choice = data['choices'][0]
            finish_reason = choice.get('finish_reason')
            delta = choice.get('delta', {})
            message = choice.get('message', {})

            # tool_calls 수집 (delta 또는 message에서)
            tool_calls_chunk = delta.get('tool_calls') or message.get('tool_calls')
            if tool_calls_chunk:
                # tool_calls를 인덱스별로 누적 (스트리밍에서 조각으로 전달됨)
                if "tool_calls_accumulator" not in collected_response:
                    collected_response["tool_calls_accumulator"] = {}

                for tc in tool_calls_chunk:
                    idx = tc.get('index', 0)
                    if idx not in collected_response["tool_calls_accumulator"]:
                        # 새 tool_call 시작
                        collected_response["tool_calls_accumulator"][idx] = {
                            "id": tc.get('id', ''),
                            "type": tc.get('type', 'function'),
                            "function": {
                                "name": tc.get('function', {}).get('name', ''),
                                "arguments": tc.get('function', {}).get('arguments', '')
                            }
                        }
                    else:
                        # 기존 tool_call에 데이터 추가
                        existing = collected_response["tool_calls_accumulator"][idx]
                        if tc.get('id'):
                            existing['id'] = tc['id']
                        if tc.get('type'):
                            existing['type'] = tc['type']
                        if tc.get('function', {}).get('name'):
                            existing['function']['name'] = tc['function']['name']
                        if tc.get('function', {}).get('arguments'):
                            existing['function']['arguments'] += tc['function']['arguments']

            # finish_reason이 tool_calls인 경우 누적된 데이터를 최종 tool_calls로 변환
            if finish_reason == "tool_calls":
                collected_response["finish_reason"] = "tool_calls"
                if "tool_calls_accumulator" in collected_response:
                    # 인덱스 순서대로 정렬하여 리스트로 변환
                    collected_response["tool_calls"] = [
                        collected_response["tool_calls_accumulator"][idx]
                        for idx in sorted(collected_response["tool_calls_accumulator"].keys())
                    ]
                    logger.info(f"{log_prefix} finish_reason=tool_calls, accumulated {len(collected_response['tool_calls'])} tool calls")

    except json.JSONDecodeError:
        pass

    # [DONE] 처리 (chunk 내부에 포함된 경우)
    if 'data: [DONE]' in chunk:
        rc_len = len(collected_response.get("reasoning_content", ""))
        ans_len = len(collected_response.get("answer", ""))
        logger.info(f"{log_prefix} [DONE] detected, reasoning: {rc_len} chars, answer: {ans_len} chars")
        chunks_to_yield.append(chunk)
    elif not is_exaone and not chunks_to_yield:
        # EXAONE이 아니고 아직 yield할 것이 없으면 원본 전달
        chunks_to_yield.append(chunk)

    return chunks_to_yield


async def log_chat_interaction_task(
    session_id: str,
    conversation_id: str,
    collection_name: str,
    message: str,
    response_data: Dict[str, Any],
    reasoning_level: str,
    model: str,
    llm_params: Dict[str, Any],
    performance_metrics: Dict[str, Any],
    error_info: Optional[Dict] = None,
    request_id: Optional[str] = None,
    trace_id: Optional[str] = None,
    client_info: Optional[Dict] = None,
    use_reranking: bool = False
):
    """채팅 상호작용 로깅 백그라운드 태스크 (큐 기반)"""
    try:
        # 사용자 메시지 로깅 (JSONL 큐)
        await hybrid_logging_service.log_chat_interaction(
            session_id=session_id,
            collection_name=collection_name,
            message_type="user",
            message_content=message,
            reasoning_level=reasoning_level,
            llm_model=model,
            llm_params=llm_params,
            retrieval_info=None,
            performance=performance_metrics,
            error_info=error_info,
            request_id=request_id,
            trace_id=trace_id,
            client_info=client_info
        )

        # 어시스턴트 응답 로깅
        retrieval_info = {}
        if "retrieved_docs" in response_data and response_data["retrieved_docs"]:
            docs = response_data["retrieved_docs"]
            # sources 정보 추출 (공통 유틸리티 사용)
            sources = extract_sources_info(docs)

            retrieval_info = {
                "retrieved_count": len(docs),
                "top_scores": [doc.get("score", 0) for doc in docs[:5]],
                "sources": sources,
                "reranking_used": use_reranking
            }

        await hybrid_logging_service.log_chat_interaction(
            session_id=session_id,
            collection_name=collection_name,
            message_type="assistant",
            message_content=response_data.get("answer", ""),
            reasoning_level=reasoning_level,
            llm_model=model,
            llm_params=llm_params,
            retrieval_info=retrieval_info,
            performance=performance_metrics,
            error_info=error_info,
            request_id=request_id,
            trace_id=trace_id,
            client_info=client_info
        )

        # 대화 서비스에 메시지 추가
        conversation_service.add_message(
            conversation_id=conversation_id,
            role="user",
            content=message
        )

        conversation_service.add_message(
            conversation_id=conversation_id,
            role="assistant",
            content=response_data.get("answer", ""),
            retrieved_docs=response_data.get("retrieved_docs"),
            error_info=error_info
        )

        # 대화 종료 및 저장 (100% 저장 정책)
        await conversation_service.end_conversation(conversation_id)

        # 세션 정보 업데이트 (큐 기반 - 비동기 배치 처리)
        await hybrid_logging_service.queue_session_update(
            session_id=session_id,
            collection_name=collection_name,
            model=model,
            reasoning_level=reasoning_level,
            performance_metrics=performance_metrics,
            retrieval_info=retrieval_info,
            error_info=error_info
        )

    except Exception as e:
        logger.error(f"로깅 태스크 실패: {e}")


@router.post("/", response_model=ChatResponse)
async def chat(
    chat_request: ChatRequest,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    RAG 기반 채팅 (Non-streaming)

    Returns:
        ChatResponse: conversation_id, answer, retrieved_docs, usage
    """
    # 공통 컨텍스트 초기화
    ctx = prepare_chat_context(chat_request, request)
    log_chat_request(ctx, chat_request, "Non-streaming")
    logger.info(f"[CHAT API] Client Type: {ctx['client_info'].get('user_agent', 'unknown')[:50]}")

    start_time = time.time()

    try:
        # RAG 채팅 수행
        result = await rag_service.chat(
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
            temp_collection_name=chat_request.temp_collection_name
        )

        # 응답 포맷팅 (키워드 추출 포함)
        raw_docs = result.get("retrieved_docs", [])
        docs_with_keywords = extract_keywords_for_documents(chat_request.message, raw_docs)

        retrieved_docs = [
            RetrievedDocument(
                id=str(doc.get("id", "")),
                score=doc.get("score", 0.0),
                text=doc.get("payload", {}).get("text", ""),
                metadata={k: v for k, v in doc.get("payload", {}).items() if k != "text"},
                keywords=doc.get("keywords", [])
            )
            for doc in docs_with_keywords
        ]

        # 응답 시간 및 성능 메트릭
        response_time_ms = int((time.time() - start_time) * 1000)
        usage_data = result.get("usage") or {}
        performance_metrics = {
            "response_time_ms": response_time_ms,
            "token_count": usage_data.get("total_tokens", 0),
            "retrieval_time_ms": result.get("retrieval_time_ms")
        }

        # 백그라운드 태스크로 로깅 추가
        background_tasks.add_task(
            log_chat_interaction_task,
            session_id=ctx['session_id'],
            conversation_id=ctx['conversation_id'],
            collection_name=ctx['effective_collection'] or "casual",
            message=chat_request.message,
            response_data={
                "answer": result.get("answer", ""),
                "retrieved_docs": result.get("retrieved_docs", [])
            },
            reasoning_level=chat_request.reasoning_level,
            model=chat_request.model,
            llm_params=build_llm_params(chat_request),
            performance_metrics=performance_metrics,
            error_info=None,
            request_id=ctx['tracking_ids'].get("request_id"),
            trace_id=ctx['tracking_ids'].get("trace_id"),
            client_info=ctx['client_info']
        )

        return ChatResponse(
            session_id=ctx['session_id'],
            conversation_id=ctx['conversation_id'],
            answer=result.get("answer", ""),
            reasoning_content=result.get("reasoning_content"),
            retrieved_docs=retrieved_docs,
            usage=result.get("usage")
        )

    except Exception as e:
        logger.error(f"[CHAT API] Chat failed: {e}")
        schedule_error_logging(background_tasks, ctx, chat_request, e, start_time)
        raise HTTPException(
            status_code=500,
            detail=get_http_error_detail(e, "chat", "채팅 처리 실패")
        )


@router.post("/stream")
async def chat_stream(
    chat_request: ChatRequest,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
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
        # llama.cpp는 스트리밍 모드에서도 delta.reasoning_content를 전송함
        use_non_streaming_for_reasoning = False

        # 스트리밍 제너레이터
        collected_response = {"answer": "", "retrieved_docs": [], "usage": {}, "reasoning_content": ""}
        stream_error_info = None

        async def generate():
            nonlocal collected_response, stream_error_info

            # GPT-OSS + 추론 모드: non-streaming API 호출 후 simulated streaming
            if use_non_streaming_for_reasoning:
                try:
                    logger.info("[CHAT API] Calling non-streaming API for reasoning_content")
                    result = await rag_service.chat(
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
                        temp_collection_name=chat_request.temp_collection_name
                    )

                    # 검색된 문서 전송 (키워드 추출 포함)
                    if result.get("retrieved_docs"):
                        raw_docs = result["retrieved_docs"]
                        sources_data = extract_keywords_for_documents(chat_request.message, raw_docs)
                        collected_response["retrieved_docs"] = sources_data
                        yield f'data: {json.dumps({"sources": sources_data}, ensure_ascii=False)}\n\n'

                    # 답변을 청크로 나눠서 simulated streaming (더 자연스러운 UX)
                    answer = result.get("answer", "")
                    collected_response["answer"] = answer
                    collected_response["usage"] = result.get("usage", {})

                    # 청크 단위로 전송 (약 50자씩)
                    chunk_size = 50
                    for i in range(0, len(answer), chunk_size):
                        chunk_text = answer[i:i + chunk_size]
                        sse_chunk = {
                            "id": f"chatcmpl-{uuid.uuid4().hex[:8]}",
                            "object": "chat.completion.chunk",
                            "choices": [{
                                "index": 0,
                                "delta": {"content": chunk_text},
                                "finish_reason": None
                            }]
                        }
                        yield f'data: {json.dumps(sse_chunk, ensure_ascii=False)}\n\n'
                        # 약간의 딜레이를 추가하여 자연스러운 스트리밍 효과 (선택적)
                        # await asyncio.sleep(0.01)

                    # reasoning_content 전송
                    reasoning_content = result.get("reasoning_content", "")
                    if reasoning_content:
                        collected_response["reasoning_content"] = reasoning_content
                        logger.info(f"[CHAT API] Sending reasoning_content event ({len(reasoning_content)} chars)")
                        reasoning_event = {
                            "type": "reasoning_content",
                            "reasoning_content": reasoning_content
                        }
                        yield f'data: {json.dumps(reasoning_event, ensure_ascii=False)}\n\n'

                    # 완료 신호
                    yield 'data: [DONE]\n\n'
                    return

                except Exception as e:
                    logger.error(f"[CHAT API] Non-streaming fallback failed: {e}")
                    stream_error_info = {
                        "error_type": type(e).__name__,
                        "error_message": str(e)
                    }
                    yield get_sse_error_response(e, "stream")
                    return

            # 일반 스트리밍 모드
            # EXAONE 모델 감지 (llama.cpp가 reasoning_content와 content를 별도 필드로 전송)
            is_exaone = is_exaone_model(chat_request.model)

            # Function Calling 도구 활성화 (모든 모드에서 내보내기 도구 사용 가능)
            tools = get_chat_tools()
            mode_name = 'Casual' if ctx['is_casual_mode'] else ('TempDoc' if ctx['is_temp_mode'] else 'RAG')
            logger.info(f"[CHAT API] {mode_name} mode with {len(tools)} export tools enabled")

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
                    logger.info(f"[CHAT API] Processing {len(collected_response['tool_calls'])} tool calls")

                    # tool_calls 이벤트 전송
                    yield f'data: {json.dumps({"type": "tool_calls", "tool_calls": collected_response["tool_calls"]}, ensure_ascii=False)}\n\n'

                    # 도구 실행 결과 수집
                    tool_results_for_llm = []
                    all_tool_results = []

                    # 각 tool_call 실행
                    for tc in collected_response["tool_calls"]:
                        try:
                            tool_result = await tool_executor.execute_tool(
                                tool_call_id=tc.get("id", str(uuid.uuid4())),
                                tool_name=tc.get("function", {}).get("name", ""),
                                arguments=json.loads(tc.get("function", {}).get("arguments", "{}"))
                            )
                            all_tool_results.append(tool_result)

                            if tool_result.success and tool_result.action_type == "download":
                                # 다운로드 액션 이벤트 전송
                                action_event = {
                                    "type": "action",
                                    "action": "download",
                                    "file_id": tool_result.file_id,
                                    "filename": tool_result.filename,
                                    "message": tool_result.message
                                }
                                yield f'data: {json.dumps(action_event, ensure_ascii=False)}\n\n'
                                logger.info(f"[CHAT API] Tool result: download action for {tool_result.filename}")

                                # LLM 후속 응답을 위한 도구 결과 메시지
                                tool_results_for_llm.append({
                                    "role": "tool",
                                    "tool_call_id": tc.get("id", ""),
                                    "content": json.dumps({
                                        "status": "success",
                                        "filename": tool_result.filename,
                                        "message": tool_result.message
                                    }, ensure_ascii=False)
                                })
                            else:
                                # 메시지 액션 이벤트 전송
                                message_event = {
                                    "type": "tool_result",
                                    "tool_call_id": tool_result.tool_call_id,
                                    "success": tool_result.success,
                                    "message": tool_result.message or tool_result.error
                                }
                                yield f'data: {json.dumps(message_event, ensure_ascii=False)}\n\n'

                                # 실패한 경우도 LLM에 전달
                                tool_results_for_llm.append({
                                    "role": "tool",
                                    "tool_call_id": tc.get("id", ""),
                                    "content": json.dumps({
                                        "status": "error" if not tool_result.success else "success",
                                        "message": tool_result.message or tool_result.error
                                    }, ensure_ascii=False)
                                })

                        except Exception as tool_error:
                            logger.error(f"[CHAT API] Tool execution failed: {tool_error}")
                            error_event = {
                                "type": "tool_result",
                                "tool_call_id": tc.get("id", ""),
                                "success": False,
                                "message": f"도구 실행 실패: {str(tool_error)}"
                            }
                            yield f'data: {json.dumps(error_event, ensure_ascii=False)}\n\n'

                            tool_results_for_llm.append({
                                "role": "tool",
                                "tool_call_id": tc.get("id", ""),
                                "content": json.dumps({
                                    "status": "error",
                                    "message": str(tool_error)
                                }, ensure_ascii=False)
                            })

                    # 4.1: 도구 실행 결과를 LLM에 전달하여 자연스러운 후속 응답 생성
                    if tool_results_for_llm and any(r.success for r in all_tool_results):
                        try:
                            # assistant의 tool_calls 메시지 구성
                            assistant_tool_call_msg = {
                                "role": "assistant",
                                "content": None,
                                "tool_calls": collected_response["tool_calls"]
                            }

                            # 후속 LLM 호출을 위한 메시지 구성
                            followup_system_prompt = """도구 실행 결과를 바탕으로 사용자에게 간단히 안내해주세요.
규칙:
- 파일 다운로드는 시스템에서 자동으로 처리됩니다
- URL이나 링크를 절대 생성하지 마세요
- {{url}}, [링크], http:// 등의 형태를 사용하지 마세요
- 단순히 "파일이 생성되어 다운로드가 시작되었습니다" 정도로 안내하세요
- 1-2문장으로 간결하게 응답하세요"""
                            followup_messages = [
                                {"role": "system", "content": followup_system_prompt},
                                {"role": "user", "content": chat_request.message},
                                assistant_tool_call_msg,
                                *tool_results_for_llm
                            ]

                            # 후속 LLM 스트리밍 호출
                            logger.info("[CHAT API] Generating follow-up response after tool execution")
                            async for followup_chunk in llm_service.chat_completion_stream(
                                messages=followup_messages,
                                model=chat_request.model,
                                temperature=0.7,
                                max_tokens=200
                            ):
                                # 후속 응답 스트리밍
                                followup_chunks = process_llm_stream_chunk(
                                    chunk=followup_chunk,
                                    is_exaone=is_exaone,
                                    collected_response={},  # 별도 수집
                                    log_prefix="[FOLLOWUP]",
                                    debug_logging=False
                                )
                                for fc in followup_chunks:
                                    yield fc

                        except Exception as followup_error:
                            logger.warning(f"[CHAT API] Follow-up response failed: {followup_error}")
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


@router.post("/regenerate", response_model=ChatResponse)
async def regenerate(
    request: RegenerateRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    AI 응답 재생성 (검색 결과 재사용)

    Returns:
        ChatResponse: 재생성된 응답 (answer, retrieved_docs, usage)
    """
    start_time = time.time()
    session_id = request.session_id or f"regen_{int(time.time() * 1000)}"
    conversation_id = str(uuid.uuid4())
    ctx = {"session_id": session_id, "conversation_id": conversation_id}

    try:
        # 공통 헬퍼로 변환
        chat_history = convert_chat_history(request.chat_history)
        retrieved_docs_internal = convert_docs_to_internal(request.retrieved_docs)

        # RAG 생성 수행 (검색 스킵, 생성만 수행)
        # skip_score_filter=True: 재생성은 이미 검증된 문서 사용, 점수 필터링 비활성화
        result = await rag_service.generate(
            query=request.query,
            retrieved_docs=retrieved_docs_internal,
            collection_name=request.collection_name,
            model=request.model,
            reasoning_level=request.reasoning_level,
            temperature=request.temperature,
            max_tokens=request.max_tokens,
            top_p=request.top_p,
            frequency_penalty=request.frequency_penalty,
            presence_penalty=request.presence_penalty,
            chat_history=chat_history,
            skip_score_filter=True
        )

        # 응답 포맷팅
        answer = result.get("choices", [{}])[0].get("message", {}).get("content", "응답을 생성할 수 없습니다.")
        response_time_ms = int((time.time() - start_time) * 1000)

        # 로깅 추가
        background_tasks.add_task(
            log_chat_interaction_task,
            session_id=session_id,
            conversation_id=conversation_id,
            collection_name=request.collection_name or "regenerate",
            message=f"[REGENERATE] {request.query}",
            response_data={"answer": answer, "retrieved_docs": retrieved_docs_internal},
            reasoning_level=request.reasoning_level,
            model=request.model,
            llm_params=build_llm_params(request),
            performance_metrics={
                "response_time_ms": response_time_ms,
                "token_count": (result.get("usage") or {}).get("total_tokens", 0),
                "retrieval_time_ms": None  # 재생성은 검색 없음
            },
            error_info=None,
            use_reranking=False  # 재생성은 검색을 스킵하므로 리랭킹 미적용
        )

        return ChatResponse(
            answer=answer,
            retrieved_docs=request.retrieved_docs,  # 원본 그대로 반환
            usage=result.get("usage"),
            session_id=session_id,
            conversation_id=conversation_id
        )

    except Exception as e:
        logger.error(f"Regenerate failed: {e}")
        schedule_error_logging(background_tasks, ctx, request, e, start_time)
        raise HTTPException(
            status_code=500,
            detail=get_http_error_detail(e, "regenerate", "응답 재생성 실패")
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

    Returns:
        dict: 컬렉션 목록
            - collections: List[QdrantCollectionInfo]

    Raises:
        HTTPException: 조회 실패 시
    """
    try:
        # 1. Qdrant에서 모든 컬렉션 조회
        qdrant_collections = await qdrant_service.get_collections()
        qdrant_names = [col.name for col in qdrant_collections]

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


# ============================================================================
# Function Calling 파일 다운로드 엔드포인트
# ============================================================================

@router.get("/export/download/{file_id}")
async def download_exported_file(file_id: str):
    """
    Function Calling으로 생성된 파일 다운로드

    Args:
        file_id: 파일 저장소 ID

    Returns:
        StreamingResponse: 파일 다운로드 응답

    Raises:
        HTTPException: 파일을 찾을 수 없거나 만료된 경우
    """
    try:
        logger.info(f"[FILE DOWNLOAD] Requested file: {file_id}")

        # 파일 저장소에서 조회
        file_data = file_storage.get(file_id)

        if not file_data:
            logger.warning(f"[FILE DOWNLOAD] File not found or expired: {file_id}")
            raise HTTPException(
                status_code=404,
                detail="파일을 찾을 수 없거나 만료되었습니다. 다시 생성해주세요."
            )

        # 파일명 인코딩 (한글 지원)
        from urllib.parse import quote
        encoded_filename = quote(file_data.filename)

        logger.info(f"[FILE DOWNLOAD] Serving file: {file_data.filename} ({len(file_data.content)} bytes)")

        # 스트리밍 응답으로 파일 전송
        from io import BytesIO
        file_stream = BytesIO(file_data.content)

        return StreamingResponse(
            file_stream,
            media_type=file_data.content_type,
            headers={
                "Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}",
                "Content-Length": str(len(file_data.content))
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[FILE DOWNLOAD] Failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=get_http_error_detail(e, "download", "파일 다운로드 실패")
        )


# ============================================================================
# 직접 내보내기 엔드포인트 (UI 메뉴용)
# ============================================================================

from pydantic import BaseModel

class DirectExportRequest(BaseModel):
    """직접 내보내기 요청"""
    content: str
    filename: Optional[str] = None
    title: Optional[str] = None


@router.post("/export/excel")
async def export_to_excel_direct(request: DirectExportRequest):
    """
    콘텐츠를 직접 Excel 파일로 내보내기

    Args:
        request: 내보내기 요청 (content, filename)

    Returns:
        dict: 파일 ID 및 파일명
    """
    try:
        if not request.content or not request.content.strip():
            raise HTTPException(status_code=400, detail="내보낼 내용이 없습니다.")

        filename = request.filename or "export"

        # 엑셀 생성
        excel_bytes = chat_excel_export_service.export_to_excel(
            data=request.content,
            filename=filename
        )

        # 파일 저장소에 저장
        full_filename = f"{filename}.xlsx"
        file_id = file_storage.store(
            filename=full_filename,
            content=excel_bytes,
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )

        return {
            "success": True,
            "file_id": file_id,
            "filename": full_filename,
            "message": f"엑셀 파일 '{full_filename}'이(가) 생성되었습니다."
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[DIRECT EXPORT] Excel export failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=get_http_error_detail(e, "export", "엑셀 내보내기 실패")
        )


@router.post("/export/docx")
async def export_to_docx_direct(request: DirectExportRequest):
    """
    콘텐츠를 직접 Word 문서로 내보내기

    Args:
        request: 내보내기 요청 (content, filename, title)

    Returns:
        dict: 파일 ID 및 파일명
    """
    try:
        if not request.content or not request.content.strip():
            raise HTTPException(status_code=400, detail="내보낼 내용이 없습니다.")

        filename = request.filename or "document"
        title = request.title or "문서"

        # DOCX 생성
        docx_bytes = chat_docx_export_service.export_to_docx(
            content=request.content,
            title=title,
            filename=filename
        )

        # 파일 저장소에 저장
        full_filename = f"{filename}.docx"
        file_id = file_storage.store(
            filename=full_filename,
            content=docx_bytes,
            content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        )

        return {
            "success": True,
            "file_id": file_id,
            "filename": full_filename,
            "message": f"Word 문서 '{full_filename}'이(가) 생성되었습니다."
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[DIRECT EXPORT] DOCX export failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=get_http_error_detail(e, "export", "Word 문서 내보내기 실패")
        )
