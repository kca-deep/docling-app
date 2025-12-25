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
from backend.models.schemas import ChatRequest, ChatResponse, RetrievedDocument, RegenerateRequest, DefaultSettingsResponse
from backend.services.embedding_service import EmbeddingService
from backend.services.qdrant_service import QdrantService
from backend.services.llm_service import LLMService
from backend.services.rag_service import RAGService
from backend.services.reranker_service import RerankerService
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

# 로거 설정
logger = logging.getLogger("uvicorn")

router = APIRouter(prefix="/api/chat", tags=["chat"])

# 서비스 인스턴스 생성
embedding_service = EmbeddingService(
    base_url=settings.EMBEDDING_URL,
    model=settings.EMBEDDING_MODEL
)

qdrant_service = QdrantService(
    url=settings.QDRANT_URL,
    api_key=settings.QDRANT_API_KEY
)

llm_service = LLMService(
    base_url=settings.LLM_BASE_URL,
    model=settings.LLM_MODEL
)

# Reranker 서비스 초기화 (USE_RERANKING 설정에 따라)
reranker_service = RerankerService() if settings.USE_RERANKING else None

# 하이브리드 검색 서비스 초기화 (USE_HYBRID_SEARCH 설정에 따라)
hybrid_search_service = HybridSearchService(qdrant_service=qdrant_service) if settings.USE_HYBRID_SEARCH else None

rag_service = RAGService(
    embedding_service=embedding_service,
    qdrant_service=qdrant_service,
    llm_service=llm_service,
    reranker_service=reranker_service,
    hybrid_search_service=hybrid_search_service
)


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
                    logger.info(f"{log_prefix} Got reasoning_content chunk: {len(reasoning_content)} chars")
                    collected_response["reasoning_content"] = collected_response.get("reasoning_content", "") + reasoning_content
                    chunks_to_yield.append(f'data: {json.dumps({"type": "reasoning_chunk", "content": reasoning_content})}\n\n')

        # sources/retrieved_docs/usage/error 처리 (chat_stream 호환)
        if 'sources' in data:
            collected_response["retrieved_docs"] = data['sources']
            if is_exaone:
                chunks_to_yield.append(f'data: {json.dumps({"sources": data["sources"]})}\n\n')
        if 'retrieved_docs' in data:
            collected_response["retrieved_docs"] = data['retrieved_docs']
        if 'usage' in data:
            collected_response["usage"] = data['usage']
        if 'error' in data and data['error']:
            error_message = data['error']
            collected_response["answer"] = error_message
            logger.warning(f"{log_prefix} Error response received: {error_message[:100]}")

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
    RAG 기반 채팅

    Args:
        request: 채팅 요청
            - conversation_id: 대화 ID (선택적)
            - collection_name: Qdrant 컬렉션 이름
            - message: 사용자 메시지
            - reasoning_level: 추론 수준 (low/medium/high)
            - temperature: 온도 (0~2)
            - max_tokens: 최대 토큰 수
            - top_p: Top P (0~1)
            - frequency_penalty: 빈도 패널티 (-2~2)
            - presence_penalty: 존재 패널티 (-2~2)
            - top_k: 검색할 문서 수
            - score_threshold: 최소 유사도 점수
            - chat_history: 이전 대화 기록
            - stream: 스트리밍 여부 (False)
        background_tasks: 백그라운드 태스크
        db: 데이터베이스 세션

    Returns:
        ChatResponse: 채팅 응답
            - conversation_id: 대화 ID
            - answer: AI 답변
            - retrieved_docs: 검색된 문서 리스트
            - usage: 토큰 사용량

    Raises:
        HTTPException: 처리 실패 시
    """
    # 추적 정보 추출
    tracking_ids = get_tracking_ids(request)
    client_info = extract_client_info(request)

    # 컬렉션 결정: temp_collection_name > collection_name > None (일상대화)
    effective_collection = chat_request.temp_collection_name or chat_request.collection_name
    is_casual_mode = not effective_collection
    is_temp_mode = bool(chat_request.temp_collection_name)
    collection_display = effective_collection or "(일상대화)"

    logger.info("="*80)
    logger.info("[CHAT API] Non-streaming endpoint called")
    logger.info(f"[CHAT API] Request ID: {tracking_ids.get('request_id')}")
    logger.info(f"[CHAT API] Requested model: {chat_request.model}")
    logger.info(f"[CHAT API] Collection: {collection_display}")
    logger.info(f"[CHAT API] Mode: {'Casual' if is_casual_mode else ('TempDoc' if is_temp_mode else 'RAG')}")
    logger.info(f"[CHAT API] Message: {chat_request.message[:50]}...")
    logger.info(f"[CHAT API] Client Type: {client_info.get('user_agent', 'unknown')[:50]}")
    logger.info("="*80)

    # conversation_id 처리
    if not chat_request.conversation_id:
        chat_request.conversation_id = str(uuid.uuid4())

    # session_id 처리 (요청에서 받거나 새로 생성)
    session_id = chat_request.session_id or str(uuid.uuid4())

    # 대화 시작 (일상대화 모드에서는 collection_name을 "casual"로 표시)
    conversation_id = conversation_service.start_conversation(
        conversation_id=chat_request.conversation_id,
        collection_name=effective_collection or "casual"
    )

    # 시작 시간 기록
    start_time = time.time()

    try:
        # 대화 기록 변환
        chat_history = None
        if chat_request.chat_history:
            chat_history = [
                {"role": msg.role, "content": msg.content}
                for msg in chat_request.chat_history
            ]

        # RAG 채팅 수행 (두 컬렉션 모두 없으면 일상대화 모드)
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
            chat_history=chat_history,
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

        # 응답 시간 계산
        response_time_ms = int((time.time() - start_time) * 1000)

        # 성능 메트릭 준비
        usage_data = result.get("usage") or {}  # None이면 빈 dict로 대체
        performance_metrics = {
            "response_time_ms": response_time_ms,
            "token_count": usage_data.get("total_tokens", 0),
            "retrieval_time_ms": result.get("retrieval_time_ms")
        }

        # LLM 파라미터 준비
        llm_params = {
            "temperature": chat_request.temperature,
            "max_tokens": chat_request.max_tokens,
            "top_p": chat_request.top_p
        }

        # 백그라운드 태스크로 로깅 추가
        background_tasks.add_task(
            log_chat_interaction_task,
            session_id=session_id,
            conversation_id=conversation_id,
            collection_name=effective_collection or "casual",
            message=chat_request.message,
            response_data={
                "answer": result.get("answer", ""),
                "retrieved_docs": result.get("retrieved_docs", [])
            },
            reasoning_level=chat_request.reasoning_level,
            model=chat_request.model,
            llm_params=llm_params,
            performance_metrics=performance_metrics,
            error_info=None,
            request_id=tracking_ids.get("request_id"),
            trace_id=tracking_ids.get("trace_id"),
            client_info=client_info
        )

        # session_id, conversation_id 포함하여 응답
        response = ChatResponse(
            session_id=session_id,
            conversation_id=conversation_id,
            answer=result.get("answer", ""),
            reasoning_content=result.get("reasoning_content"),
            retrieved_docs=retrieved_docs,
            usage=result.get("usage")
        )

        return response

    except Exception as e:
        logger.error(f"[CHAT API] Chat failed: {e}")

        # 에러 정보 준비
        error_info = {
            "error_type": type(e).__name__,
            "error_message": str(e)
        }

        # 에러도 로깅
        background_tasks.add_task(
            log_chat_interaction_task,
            session_id=session_id,
            conversation_id=conversation_id,
            collection_name=effective_collection or "casual",
            message=chat_request.message,
            response_data={},
            reasoning_level=chat_request.reasoning_level,
            model=chat_request.model,
            llm_params={
                "temperature": chat_request.temperature,
                "max_tokens": chat_request.max_tokens,
                "top_p": chat_request.top_p
            },
            performance_metrics={
                "response_time_ms": int((time.time() - start_time) * 1000)
            },
            error_info=error_info,
            request_id=tracking_ids.get("request_id"),
            trace_id=tracking_ids.get("trace_id"),
            client_info=client_info
        )

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

    Args:
        chat_request: 채팅 요청 (stream 파라미터는 무시됨)
        request: FastAPI Request 객체
        background_tasks: 백그라운드 태스크
        db: 데이터베이스 세션

    Returns:
        StreamingResponse: SSE 스트리밍 응답

    Raises:
        HTTPException: 처리 실패 시
    """
    # 추적 정보 추출
    tracking_ids = get_tracking_ids(request)
    client_info = extract_client_info(request)

    # 컬렉션 결정: temp_collection_name > collection_name > None (일상대화)
    effective_collection = chat_request.temp_collection_name or chat_request.collection_name
    is_casual_mode = not effective_collection
    is_temp_mode = bool(chat_request.temp_collection_name)
    collection_display = effective_collection or "(일상대화)"

    logger.info("="*80)
    logger.info("[CHAT API] Stream endpoint called")
    logger.info(f"[CHAT API] Request ID: {tracking_ids.get('request_id')}")
    logger.info(f"[CHAT API] Requested model: {chat_request.model}")
    logger.info(f"[CHAT API] Collection: {collection_display}")
    logger.info(f"[CHAT API] Mode: {'Casual' if is_casual_mode else ('TempDoc' if is_temp_mode else 'RAG')}")
    logger.info(f"[CHAT API] Message: {chat_request.message[:50]}...")
    logger.info("="*80)

    # conversation_id 처리
    if not chat_request.conversation_id:
        chat_request.conversation_id = str(uuid.uuid4())

    # session_id 처리 (요청에서 받거나 새로 생성)
    session_id = chat_request.session_id or str(uuid.uuid4())

    # 대화 시작 (일상대화 모드에서는 collection_name을 "casual"로 표시)
    conversation_id = conversation_service.start_conversation(
        conversation_id=chat_request.conversation_id,
        collection_name=effective_collection or "casual"
    )

    # 시작 시간 기록
    start_time = time.time()

    try:
        # 대화 기록 변환
        chat_history = None
        if chat_request.chat_history:
            chat_history = [
                {"role": msg.role, "content": msg.content}
                for msg in chat_request.chat_history
            ]

        # llama.cpp는 스트리밍 모드에서도 delta.reasoning_content를 전송함
        # non-streaming fallback 불필요 - 스트리밍에서 직접 수집
        use_non_streaming_for_reasoning = False

        # 스트리밍 제너레이터 (collection_name이 None이면 일상대화 모드)
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
                        chat_history=chat_history,
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
                    chat_history=chat_history,
                    use_reranking=chat_request.use_reranking,
                    use_hybrid=chat_request.use_hybrid,
                    temp_collection_name=chat_request.temp_collection_name
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

                final_llm_params = {
                    "temperature": chat_request.temperature,
                    "max_tokens": chat_request.max_tokens,
                    "top_p": chat_request.top_p
                }

                # asyncio.shield()로 로깅 태스크 보호 (클라이언트 취소에도 완료 보장)
                try:
                    await asyncio.shield(log_chat_interaction_task(
                        session_id=session_id,
                        conversation_id=conversation_id,
                        collection_name=effective_collection or "casual",
                        message=chat_request.message,
                        response_data=collected_response,
                        reasoning_level=chat_request.reasoning_level,
                        model=chat_request.model,
                        llm_params=final_llm_params,
                        performance_metrics=final_performance_metrics,
                        error_info=stream_error_info,
                        request_id=tracking_ids.get("request_id"),
                        trace_id=tracking_ids.get("trace_id"),
                        client_info=client_info,
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

        # 에러 정보 준비
        error_info = {
            "error_type": type(e).__name__,
            "error_message": str(e)
        }

        # 에러도 로깅
        background_tasks.add_task(
            log_chat_interaction_task,
            session_id=session_id,
            conversation_id=conversation_id,
            collection_name=effective_collection or "casual",
            message=chat_request.message,
            response_data={},
            reasoning_level=chat_request.reasoning_level,
            model=chat_request.model,
            llm_params={
                "temperature": chat_request.temperature,
                "max_tokens": chat_request.max_tokens,
                "top_p": chat_request.top_p
            },
            performance_metrics={
                "response_time_ms": int((time.time() - start_time) * 1000)
            },
            error_info=error_info,
            request_id=tracking_ids.get("request_id"),
            trace_id=tracking_ids.get("trace_id"),
            client_info=client_info
        )

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

    Args:
        request: 재생성 요청
            - query: 원본 질문
            - collection_name: 컬렉션 이름
            - retrieved_docs: 이전에 검색된 문서들
            - reasoning_level: 추론 수준
            - temperature: 온도 (재생성 시 약간 높게 설정 권장)
            - max_tokens: 최대 토큰 수
            - top_p: Top P
            - frequency_penalty: 빈도 패널티
            - presence_penalty: 존재 패널티
            - chat_history: 이전 대화 기록

    Returns:
        ChatResponse: 재생성된 응답
            - answer: 새로운 AI 답변
            - retrieved_docs: 재사용된 검색 문서 리스트
            - usage: 토큰 사용량

    Raises:
        HTTPException: 재생성 실패 시
    """
    start_time = time.time()
    session_id = request.session_id or f"regen_{int(time.time() * 1000)}"
    conversation_id = str(uuid.uuid4())

    try:
        # 대화 기록 변환
        chat_history = None
        if request.chat_history:
            chat_history = [
                {"role": msg.role, "content": msg.content}
                for msg in request.chat_history
            ]

        # RetrievedDocument -> 내부 포맷 변환
        retrieved_docs_internal = []
        for doc in request.retrieved_docs:
            # metadata에서 text를 제외한 필드들 추출
            payload = {"text": doc.text}
            if doc.metadata:
                payload.update(doc.metadata)

            retrieved_docs_internal.append({
                "id": doc.id,
                "score": doc.score,
                "payload": payload
            })

        # RAG 생성 수행 (검색 스킵, 생성만 수행)
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
            chat_history=chat_history
        )

        # 응답 포맷팅 (원본 검색 결과 재사용)
        answer = result.get("choices", [{}])[0].get("message", {}).get("content", "응답을 생성할 수 없습니다.")

        # 응답 시간 계산
        response_time_ms = int((time.time() - start_time) * 1000)

        # 로깅 추가
        background_tasks.add_task(
            log_chat_interaction_task,
            session_id=session_id,
            conversation_id=conversation_id,
            collection_name=request.collection_name or "regenerate",
            message=f"[REGENERATE] {request.query}",
            response_data={
                "answer": answer,
                "retrieved_docs": retrieved_docs_internal
            },
            reasoning_level=request.reasoning_level,
            model=request.model,
            llm_params={
                "temperature": request.temperature,
                "max_tokens": request.max_tokens,
                "top_p": request.top_p
            },
            performance_metrics={
                "response_time_ms": response_time_ms,
                "token_count": (result.get("usage") or {}).get("total_tokens", 0),
                "retrieval_time_ms": None  # 재생성은 검색 없음
            },
            error_info=None
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
        # 에러 로깅
        background_tasks.add_task(
            log_chat_interaction_task,
            session_id=session_id,
            conversation_id=conversation_id,
            collection_name=request.collection_name or "regenerate",
            message=f"[REGENERATE] {request.query}",
            response_data={},
            reasoning_level=request.reasoning_level,
            model=request.model,
            llm_params={
                "temperature": request.temperature,
                "max_tokens": request.max_tokens,
                "top_p": request.top_p
            },
            performance_metrics={
                "response_time_ms": int((time.time() - start_time) * 1000)
            },
            error_info={"error": str(e), "type": "regenerate_error"}
        )
        raise HTTPException(
            status_code=500,
            detail=get_http_error_detail(e, "regenerate", "응답 재생성 실패")
        )


@router.post("/regenerate/stream")
async def regenerate_stream(request: RegenerateRequest):
    """
    AI 응답 재생성 (스트리밍, 검색 결과 재사용)

    Args:
        request: 재생성 요청
            - query: 원본 질문
            - collection_name: 컬렉션 이름
            - retrieved_docs: 이전에 검색된 문서들
            - model: 사용할 모델
            - reasoning_level: 추론 수준
            - temperature: 온도
            - max_tokens: 최대 토큰 수
            - top_p: Top P
            - frequency_penalty: 빈도 패널티
            - presence_penalty: 존재 패널티
            - chat_history: 이전 대화 기록

    Returns:
        StreamingResponse: SSE 스트림
    """
    logger.info("="*80)
    logger.info("[REGENERATE STREAM] Endpoint called")
    logger.info(f"[REGENERATE STREAM] Model: {request.model}")
    logger.info(f"[REGENERATE STREAM] Collection: {request.collection_name}")
    logger.info(f"[REGENERATE STREAM] Query: {request.query[:50]}...")
    logger.info("="*80)

    # 세션/대화 ID 및 시간 추적
    session_id = request.session_id or f"regen_stream_{int(time.time() * 1000)}"
    conversation_id = str(uuid.uuid4())
    start_time = time.time()
    stream_error_info = None

    try:
        # 대화 기록 변환
        chat_history = None
        if request.chat_history:
            chat_history = [
                {"role": msg.role, "content": msg.content}
                for msg in request.chat_history
            ]

        # RetrievedDocument -> 내부 포맷 변환
        retrieved_docs_internal = []
        for doc in request.retrieved_docs:
            payload = {"text": doc.text}
            if doc.metadata:
                payload.update(doc.metadata)
            retrieved_docs_internal.append({
                "id": doc.id,
                "score": doc.score,
                "payload": payload
            })

        # 스트리밍 응답 수집용
        collected_response = {"answer": "", "reasoning_content": ""}

        async def generate():
            nonlocal collected_response

            try:
                # 검색된 문서를 먼저 전송
                sources_data = [
                    {
                        "id": doc.id,
                        "text": doc.text,
                        "score": doc.score,
                        "metadata": doc.metadata
                    }
                    for doc in request.retrieved_docs
                ]
                yield f'data: {json.dumps({"sources": sources_data}, ensure_ascii=False)}\n\n'

                # EXAONE 모델 감지 (llama.cpp가 reasoning_content와 content를 별도 필드로 전송)
                is_exaone = is_exaone_model(request.model)

                # 스트리밍 생성
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
                    collection_name=request.collection_name
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
                final_response_time_ms = int((time.time() - start_time) * 1000)
                final_performance_metrics = {
                    "response_time_ms": final_response_time_ms,
                    "token_count": 0,  # 스트리밍에서는 토큰 수 미확인
                    "retrieval_time_ms": None  # 재생성은 검색 없음
                }
                final_llm_params = {
                    "temperature": request.temperature,
                    "max_tokens": request.max_tokens,
                    "top_p": request.top_p
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
                        llm_params=final_llm_params,
                        performance_metrics=final_performance_metrics,
                        error_info=stream_error_info
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
