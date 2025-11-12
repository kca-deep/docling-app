"""
Chat API 라우터
RAG 기반 채팅 엔드포인트
"""
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from backend.models.schemas import ChatRequest, ChatResponse, RetrievedDocument
from backend.services.embedding_service import EmbeddingService
from backend.services.qdrant_service import QdrantService
from backend.services.llm_service import LLMService
from backend.services.rag_service import RAGService
from backend.services.reranker_service import RerankerService
from backend.config.settings import settings

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


@router.post("/", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    RAG 기반 채팅

    Args:
        request: 채팅 요청
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

    Returns:
        ChatResponse: 채팅 응답
            - answer: AI 답변
            - retrieved_docs: 검색된 문서 리스트
            - usage: 토큰 사용량

    Raises:
        HTTPException: 처리 실패 시
    """
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

        return ChatResponse(
            answer=result.get("answer", ""),
            retrieved_docs=retrieved_docs,
            usage=result.get("usage")
        )

    except Exception as e:
        print(f"[ERROR] Chat failed: {e}")
        raise HTTPException(status_code=500, detail=f"채팅 처리 실패: {str(e)}")


@router.post("/stream")
async def chat_stream(request: ChatRequest):
    """
    RAG 기반 스트리밍 채팅

    Args:
        request: 채팅 요청 (stream 파라미터는 무시됨)

    Returns:
        StreamingResponse: SSE 스트리밍 응답

    Raises:
        HTTPException: 처리 실패 시
    """
    try:
        # 대화 기록 변환
        chat_history = None
        if request.chat_history:
            chat_history = [
                {"role": msg.role, "content": msg.content}
                for msg in request.chat_history
            ]

        # 스트리밍 제너레이터
        async def generate():
            try:
                async for chunk in rag_service.chat_stream(
                    collection_name=request.collection_name,
                    query=request.message,
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
                    yield chunk
            except Exception as e:
                print(f"[ERROR] Stream generation failed: {e}")
                yield f'data: {{"error": "스트리밍 실패: {str(e)}"}}\n\n'

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
        print(f"[ERROR] Stream chat failed: {e}")
        raise HTTPException(status_code=500, detail=f"스트리밍 채팅 실패: {str(e)}")


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
