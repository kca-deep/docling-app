"""
Chat API 라우터
RAG 기반 채팅 엔드포인트
"""
import json
import logging
import sys
import uuid
import time
from pathlib import Path
from datetime import datetime
from typing import Optional, Dict, Any
from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models.schemas import ChatRequest, ChatResponse, RetrievedDocument, RegenerateRequest, DefaultSettingsResponse
from backend.models.chat_session import ChatSession
from backend.services.embedding_service import EmbeddingService
from backend.services.qdrant_service import QdrantService
from backend.services.llm_service import LLMService
from backend.services.rag_service import RAGService
from backend.services.reranker_service import RerankerService
from backend.config.settings import settings
from backend.services.hybrid_logging_service import hybrid_logging_service
from backend.services.conversation_service import conversation_service

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

rag_service = RAGService(
    embedding_service=embedding_service,
    qdrant_service=qdrant_service,
    llm_service=llm_service,
    reranker_service=reranker_service
)


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
    db: Optional[Session] = None
):
    """채팅 상호작용 로깅 백그라운드 태스크"""
    try:
        # 사용자 메시지 로깅
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
            error_info=error_info
        )

        # 어시스턴트 응답 로깅
        retrieval_info = {}
        if "retrieved_docs" in response_data:
            retrieval_info = {
                "retrieved_count": len(response_data["retrieved_docs"]),
                "top_scores": [doc.get("score", 0) for doc in response_data["retrieved_docs"][:3]]
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
            error_info=error_info
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
        # 각 요청-응답 쌍마다 저장
        await conversation_service.end_conversation(conversation_id)

        # 세션 정보 업데이트 (DB에)
        if db:
            session = db.query(ChatSession).filter(
                ChatSession.session_id == session_id
            ).first()

            if not session:
                # 새 세션 생성
                session = ChatSession(
                    session_id=session_id,
                    collection_name=collection_name,
                    llm_model=model,
                    reasoning_level=reasoning_level
                )
                db.add(session)

            # 세션 정보 업데이트
            # 카운트 필드들이 None인 경우 0으로 초기화
            if session.message_count is None:
                session.message_count = 0
            if session.user_message_count is None:
                session.user_message_count = 0
            if session.assistant_message_count is None:
                session.assistant_message_count = 0

            session.message_count += 2  # 사용자 + 어시스턴트
            session.user_message_count += 1
            session.assistant_message_count += 1

            if performance_metrics.get("response_time_ms"):
                # total_response_time_ms가 None인 경우 0으로 초기화
                if session.total_response_time_ms is None:
                    session.total_response_time_ms = 0
                session.total_response_time_ms += performance_metrics["response_time_ms"]
                session.avg_response_time_ms = session.total_response_time_ms // session.assistant_message_count

            if error_info:
                session.has_error = 1

            # 최소 검색 스코어 업데이트
            if retrieval_info.get("top_scores"):
                min_score = min(retrieval_info["top_scores"])
                if session.min_retrieval_score is None or float(session.min_retrieval_score) > min_score:
                    session.min_retrieval_score = str(min_score)

            db.commit()

    except Exception as e:
        logger.error(f"로깅 태스크 실패: {e}")
        if db:
            db.rollback()


@router.post("/", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
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
    logger.info("="*80)
    logger.info("[CHAT API] Non-streaming endpoint called")
    logger.info(f"[CHAT API] Requested model: {request.model}")
    logger.info(f"[CHAT API] Collection: {request.collection_name}")
    logger.info(f"[CHAT API] Message: {request.message[:50]}...")
    logger.info("="*80)

    # conversation_id 처리
    if not request.conversation_id:
        request.conversation_id = str(uuid.uuid4())

    # session_id 생성 (conversation과 별도)
    session_id = str(uuid.uuid4())

    # 대화 시작
    conversation_id = conversation_service.start_conversation(
        conversation_id=request.conversation_id,
        collection_name=request.collection_name
    )

    # 시작 시간 기록
    start_time = time.time()

    try:
        # 대화 기록 변환
        chat_history = None
        if request.chat_history:
            chat_history = [
                {"role": msg.role, "content": msg.content}
                for msg in request.chat_history
            ]

        # RAG 채팅 수행
        result = await rag_service.chat(
            collection_name=request.collection_name,
            query=request.message,
            model=request.model,
            reasoning_level=request.reasoning_level,
            temperature=request.temperature,
            max_tokens=request.max_tokens,
            top_p=request.top_p,
            frequency_penalty=request.frequency_penalty,
            presence_penalty=request.presence_penalty,
            top_k=request.top_k,
            score_threshold=request.score_threshold,
            chat_history=chat_history,
            use_reranking=request.use_reranking
        )

        # 응답 포맷팅
        retrieved_docs = [
            RetrievedDocument(
                id=str(doc.get("id", "")),
                score=doc.get("score", 0.0),
                text=doc.get("payload", {}).get("text", ""),
                metadata={k: v for k, v in doc.get("payload", {}).items() if k != "text"}
            )
            for doc in result.get("retrieved_docs", [])
        ]

        # 응답 시간 계산
        response_time_ms = int((time.time() - start_time) * 1000)

        # 성능 메트릭 준비
        performance_metrics = {
            "response_time_ms": response_time_ms,
            "token_count": result.get("usage", {}).get("total_tokens", 0),
            "retrieval_time_ms": None  # TODO: RAG 서비스에서 측정 필요
        }

        # LLM 파라미터 준비
        llm_params = {
            "temperature": request.temperature,
            "max_tokens": request.max_tokens,
            "top_p": request.top_p
        }

        # 백그라운드 태스크로 로깅 추가
        background_tasks.add_task(
            log_chat_interaction_task,
            session_id=session_id,
            conversation_id=conversation_id,
            collection_name=request.collection_name,
            message=request.message,
            response_data={
                "answer": result.get("answer", ""),
                "retrieved_docs": result.get("retrieved_docs", [])
            },
            reasoning_level=request.reasoning_level,
            model=request.model,
            llm_params=llm_params,
            performance_metrics=performance_metrics,
            error_info=None,
            db=db
        )

        # conversation_id 포함하여 응답
        response = ChatResponse(
            answer=result.get("answer", ""),
            retrieved_docs=retrieved_docs,
            usage=result.get("usage")
        )
        response.conversation_id = conversation_id

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
            collection_name=request.collection_name,
            message=request.message,
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
            error_info=error_info,
            db=db
        )

        raise HTTPException(status_code=500, detail=f"채팅 처리 실패: {str(e)}")


@router.post("/stream")
async def chat_stream(
    request: ChatRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    RAG 기반 스트리밍 채팅

    Args:
        request: 채팅 요청 (stream 파라미터는 무시됨)
        background_tasks: 백그라운드 태스크
        db: 데이터베이스 세션

    Returns:
        StreamingResponse: SSE 스트리밍 응답

    Raises:
        HTTPException: 처리 실패 시
    """
    # 강제 출력 - 반드시 보여야 함
    sys.stderr.write("\n" + "="*80 + "\n")
    sys.stderr.write(f"[CHAT API] Stream endpoint called\n")
    sys.stderr.write(f"[CHAT API] Requested model: {request.model}\n")
    sys.stderr.write(f"[CHAT API] Collection: {request.collection_name}\n")
    sys.stderr.write(f"[CHAT API] Message: {request.message[:50]}...\n")
    sys.stderr.write("="*80 + "\n\n")
    sys.stderr.flush()

    logger.info("="*80)
    logger.info("[CHAT API] Stream endpoint called")
    logger.info(f"[CHAT API] Requested model: {request.model}")
    logger.info(f"[CHAT API] Collection: {request.collection_name}")
    logger.info(f"[CHAT API] Message: {request.message[:50]}...")
    logger.info("="*80)

    # conversation_id 처리
    if not request.conversation_id:
        request.conversation_id = str(uuid.uuid4())

    # session_id 생성 (conversation과 별도)
    session_id = str(uuid.uuid4())

    # 대화 시작
    conversation_id = conversation_service.start_conversation(
        conversation_id=request.conversation_id,
        collection_name=request.collection_name
    )

    # 시작 시간 기록
    start_time = time.time()

    try:
        # 대화 기록 변환
        chat_history = None
        if request.chat_history:
            chat_history = [
                {"role": msg.role, "content": msg.content}
                for msg in request.chat_history
            ]

        # 스트리밍 제너레이터
        collected_response = {"answer": "", "retrieved_docs": [], "usage": {}}

        async def generate():
            nonlocal collected_response
            try:
                async for chunk in rag_service.chat_stream(
                    collection_name=request.collection_name,
                    query=request.message,
                    model=request.model,
                    reasoning_level=request.reasoning_level,
                    temperature=request.temperature,
                    max_tokens=request.max_tokens,
                    top_p=request.top_p,
                    frequency_penalty=request.frequency_penalty,
                    presence_penalty=request.presence_penalty,
                    top_k=request.top_k,
                    score_threshold=request.score_threshold,
                    chat_history=chat_history,
                    use_reranking=request.use_reranking
                ):
                    # SSE 포맷 파싱하여 응답 수집
                    if chunk.startswith('data: '):
                        try:
                            data_str = chunk[6:]  # 'data: ' 제거
                            if data_str.strip() and data_str != '[DONE]':
                                data = json.loads(data_str)
                                if 'content' in data:
                                    collected_response["answer"] += data.get('content', '')
                                if 'retrieved_docs' in data:
                                    collected_response["retrieved_docs"] = data['retrieved_docs']
                                if 'usage' in data:
                                    collected_response["usage"] = data['usage']
                        except json.JSONDecodeError:
                            pass

                    yield chunk
            except Exception as e:
                logger.error(f"[CHAT API] Stream generation failed: {e}")
                yield f'data: {{"error": "스트리밍 실패: {str(e)}"}}\n\n'

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

        # 백그라운드에서 로깅 (스트리밍 완료 후)
        response_time_ms = int((time.time() - start_time) * 1000)

        performance_metrics = {
            "response_time_ms": response_time_ms,
            "token_count": 0,  # 스트리밍에서는 나중에 업데이트
            "retrieval_time_ms": None
        }

        llm_params = {
            "temperature": request.temperature,
            "max_tokens": request.max_tokens,
            "top_p": request.top_p
        }

        # 백그라운드 태스크로 로깅 추가
        background_tasks.add_task(
            log_chat_interaction_task,
            session_id=session_id,
            conversation_id=conversation_id,
            collection_name=request.collection_name,
            message=request.message,
            response_data=collected_response,  # 수집된 응답 사용
            reasoning_level=request.reasoning_level,
            model=request.model,
            llm_params=llm_params,
            performance_metrics=performance_metrics,
            error_info=None,
            db=db
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
            collection_name=request.collection_name,
            message=request.message,
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
            error_info=error_info,
            db=db
        )

        raise HTTPException(status_code=500, detail=f"스트리밍 채팅 실패: {str(e)}")


@router.post("/regenerate", response_model=ChatResponse)
async def regenerate(request: RegenerateRequest):
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

        return ChatResponse(
            answer=answer,
            retrieved_docs=request.retrieved_docs,  # 원본 그대로 반환
            usage=result.get("usage")
        )

    except Exception as e:
        print(f"[ERROR] Regenerate failed: {e}")
        raise HTTPException(status_code=500, detail=f"응답 재생성 실패: {str(e)}")


@router.get("/collections")
async def get_collections():
    """
    사용 가능한 Qdrant 컬렉션 목록 조회

    Returns:
        dict: 컬렉션 목록
            - collections: List[QdrantCollectionInfo]

    Raises:
        HTTPException: 조회 실패 시
    """
    try:
        collections = await qdrant_service.get_collections()
        return {"collections": [col.model_dump() for col in collections]}

    except Exception as e:
        print(f"[ERROR] Get collections failed: {e}")
        raise HTTPException(status_code=500, detail=f"컬렉션 조회 실패: {str(e)}")


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
        print(f"[ERROR] Get suggested prompts failed: {e}")
        raise HTTPException(status_code=500, detail=f"추천 질문 조회 실패: {str(e)}")


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
        raise HTTPException(status_code=500, detail=f"기본 설정 조회 실패: {str(e)}")
