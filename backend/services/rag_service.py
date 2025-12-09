"""
RAG (Retrieval-Augmented Generation) 서비스
Qdrant 검색 + LLM 생성을 통합하는 서비스
"""
import json
import logging
from typing import List, Dict, Any, Optional, AsyncGenerator
from backend.services.embedding_service import EmbeddingService
from backend.services.qdrant_service import QdrantService
from backend.services.llm_service import LLMService
from backend.services.reranker_service import RerankerService
from backend.config.settings import settings

# 로거 설정
logger = logging.getLogger("uvicorn")


class RAGService:
    """RAG 파이프라인을 담당하는 서비스"""

    def __init__(
        self,
        embedding_service: EmbeddingService,
        qdrant_service: QdrantService,
        llm_service: LLMService,
        reranker_service: Optional[RerankerService] = None
    ):
        """
        RAGService 초기화

        Args:
            embedding_service: 임베딩 서비스
            qdrant_service: Qdrant 서비스
            llm_service: LLM 서비스
            reranker_service: Reranker 서비스 (선택)
        """
        self.embedding_service = embedding_service
        self.qdrant_service = qdrant_service
        self.llm_service = llm_service
        self.reranker_service = reranker_service

    async def retrieve(
        self,
        collection_name: str,
        query: str,
        top_k: int = 5,
        score_threshold: Optional[float] = None
    ) -> List[Dict[str, Any]]:
        """
        유사 문서 검색

        Args:
            collection_name: Qdrant 컬렉션 이름
            query: 검색 쿼리
            top_k: 검색할 문서 수
            score_threshold: 최소 유사도 점수

        Returns:
            List[Dict[str, Any]]: 검색된 문서 리스트
                - id: 문서 ID
                - score: 유사도 점수
                - payload: 문서 내용 및 메타데이터

        Raises:
            Exception: 검색 실패 시
        """
        try:
            # 1. 쿼리를 벡터로 임베딩
            print(f"[INFO] Embedding query: {query[:100]}...")
            query_embeddings = await self.embedding_service.get_embeddings(query)

            if not query_embeddings or len(query_embeddings) == 0:
                raise Exception("임베딩 생성 실패")

            query_vector = query_embeddings[0]

            # 2. Qdrant에서 유사 문서 검색
            print(f"[INFO] Searching in collection '{collection_name}' with top_k={top_k}")
            results = await self.qdrant_service.search(
                collection_name=collection_name,
                query_vector=query_vector,
                limit=top_k,
                score_threshold=score_threshold
            )

            print(f"[INFO] Retrieved {len(results)} documents")
            return results

        except Exception as e:
            print(f"[ERROR] Retrieve failed: {e}")
            raise Exception(f"문서 검색 실패: {str(e)}")

    async def generate(
        self,
        query: str,
        retrieved_docs: List[Dict[str, Any]],
        model: str = "gpt-oss-20b",
        reasoning_level: str = "medium",
        temperature: float = 0.7,
        max_tokens: int = 2000,
        top_p: float = 0.9,
        frequency_penalty: float = 0.0,
        presence_penalty: float = 0.0,
        chat_history: Optional[List[Dict[str, str]]] = None,
        collection_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        검색된 문서 기반 답변 생성

        Args:
            query: 사용자 질문
            retrieved_docs: 검색된 문서 리스트
            reasoning_level: 추론 수준 (low/medium/high)
            temperature: 온도
            max_tokens: 최대 토큰 수
            top_p: Top P
            frequency_penalty: 빈도 패널티
            presence_penalty: 존재 패널티
            chat_history: 이전 대화 기록
            collection_name: Qdrant 컬렉션 이름 (프롬프트 선택에 사용)

        Returns:
            Dict[str, Any]: LLM 응답
                - choices[0].message.content: AI 답변
                - usage: 토큰 사용량

        Raises:
            Exception: 생성 실패 시
        """
        try:
            # 1. RAG 프롬프트 구성
            messages = self.llm_service.build_rag_messages(
                query=query,
                retrieved_docs=retrieved_docs,
                reasoning_level=reasoning_level,
                chat_history=chat_history,
                collection_name=collection_name
            )

            # 2. LLM으로 답변 생성
            logger.info(f"[RAG] Generating answer with model={model}, reasoning_level={reasoning_level}")
            response = await self.llm_service.chat_completion(
                messages=messages,
                model=model,
                temperature=temperature,
                max_tokens=max_tokens,
                top_p=top_p,
                frequency_penalty=frequency_penalty,
                presence_penalty=presence_penalty,
                stream=False
            )

            return response

        except Exception as e:
            print(f"[ERROR] Generate failed: {e}")
            raise Exception(f"답변 생성 실패: {str(e)}")

    async def generate_stream(
        self,
        query: str,
        retrieved_docs: List[Dict[str, Any]],
        model: str = "gpt-oss-20b",
        reasoning_level: str = "medium",
        temperature: float = 0.7,
        max_tokens: int = 2000,
        top_p: float = 0.9,
        frequency_penalty: float = 0.0,
        presence_penalty: float = 0.0,
        chat_history: Optional[List[Dict[str, str]]] = None,
        collection_name: Optional[str] = None
    ) -> AsyncGenerator[str, None]:
        """
        검색된 문서 기반 스트리밍 답변 생성

        Args:
            query: 사용자 질문
            retrieved_docs: 검색된 문서 리스트
            reasoning_level: 추론 수준
            temperature: 온도
            max_tokens: 최대 토큰 수
            top_p: Top P
            frequency_penalty: 빈도 패널티
            presence_penalty: 존재 패널티
            chat_history: 이전 대화 기록
            collection_name: Qdrant 컬렉션 이름 (프롬프트 선택에 사용)

        Yields:
            str: SSE 이벤트 라인

        Raises:
            Exception: 생성 실패 시
        """
        try:
            # 1. RAG 프롬프트 구성
            messages = self.llm_service.build_rag_messages(
                query=query,
                retrieved_docs=retrieved_docs,
                reasoning_level=reasoning_level,
                chat_history=chat_history,
                collection_name=collection_name
            )

            # 2. LLM으로 스트리밍 답변 생성
            logger.info(f"[RAG] Streaming answer with model={model}, reasoning_level={reasoning_level}")
            async for chunk in self.llm_service.chat_completion_stream(
                messages=messages,
                model=model,
                temperature=temperature,
                max_tokens=max_tokens,
                top_p=top_p,
                frequency_penalty=frequency_penalty,
                presence_penalty=presence_penalty
            ):
                yield chunk

        except Exception as e:
            print(f"[ERROR] Stream generate failed: {e}")
            raise Exception(f"스트리밍 답변 생성 실패: {str(e)}")

    async def chat(
        self,
        collection_name: Optional[str],
        query: str,
        model: str = "gpt-oss-20b",
        reasoning_level: str = "medium",
        temperature: float = 0.7,
        max_tokens: int = 2000,
        top_p: float = 0.9,
        frequency_penalty: float = 0.0,
        presence_penalty: float = 0.0,
        top_k: int = 5,
        score_threshold: Optional[float] = None,
        chat_history: Optional[List[Dict[str, str]]] = None,
        use_reranking: bool = False
    ) -> Dict[str, Any]:
        """
        RAG 기반 채팅 (검색 + 생성 통합)

        Args:
            collection_name: Qdrant 컬렉션 이름
            query: 사용자 질문
            reasoning_level: 추론 수준
            temperature: 온도
            max_tokens: 최대 토큰 수
            top_p: Top P
            frequency_penalty: 빈도 패널티
            presence_penalty: 존재 패널티
            top_k: 검색할 문서 수
            score_threshold: 최소 유사도 점수
            chat_history: 이전 대화 기록
            use_reranking: Reranking 사용 여부

        Returns:
            Dict[str, Any]: 응답
                - answer: AI 답변 텍스트
                - retrieved_docs: 검색된 문서 리스트
                - usage: 토큰 사용량

        Raises:
            Exception: 처리 실패 시
        """
        try:
            # 일상대화 모드 체크 (collection_name이 None인 경우)
            is_casual_mode = not collection_name

            if is_casual_mode:
                # 일상대화 모드: 검색 없이 바로 LLM 생성
                logger.info(f"[RAG] Casual mode - skipping retrieval")
                retrieved_docs = []
            else:
                # 1. Retrieve: 관련 문서 검색
                # Reranking 사용 시 top_k를 배수만큼 증가
                initial_top_k = top_k
                if use_reranking and self.reranker_service:
                    initial_top_k = top_k * settings.RERANK_TOP_K_MULTIPLIER
                    print(f"[INFO] Reranking enabled: expanding top_k from {top_k} to {initial_top_k}")

                retrieved_docs = await self.retrieve(
                    collection_name=collection_name,
                    query=query,
                    top_k=initial_top_k,
                    score_threshold=score_threshold
                )

                if not retrieved_docs:
                    return {
                        "answer": "관련된 문서를 찾을 수 없습니다. 다른 질문을 시도해보세요.",
                        "retrieved_docs": [],
                        "usage": None
                    }

            # 1.5. Reranking (선택)
            if use_reranking and self.reranker_service and retrieved_docs:
                try:
                    print(f"[INFO] Reranking {len(retrieved_docs)} documents")

                    # 문서 텍스트 추출
                    documents = [doc["payload"]["text"] for doc in retrieved_docs]

                    # Reranker 호출 (사용자 설정값 top_k 사용)
                    reranked_results = await self.reranker_service.rerank_with_fallback(
                        query=query,
                        documents=documents,
                        top_n=top_k,
                        return_documents=False
                    )

                    # Reranking 성공 시 재정렬 및 score threshold 필터링
                    if reranked_results:
                        # Reranker 순서로 재정렬하고 relevance_score를 score에 반영
                        reranked_docs = []
                        for r in reranked_results:
                            # Score threshold 필터링 적용
                            if r.relevance_score >= settings.RERANK_SCORE_THRESHOLD:
                                doc = retrieved_docs[r.index].copy()
                                doc["score"] = r.relevance_score  # Reranker score로 덮어쓰기
                                reranked_docs.append(doc)

                        if reranked_docs:
                            retrieved_docs = reranked_docs
                            top_score = reranked_docs[0]["score"]
                            print(f"[INFO] Reranking completed: {len(retrieved_docs)} docs passed threshold, top score={top_score:.4f}")
                        else:
                            print(f"[WARNING] No docs passed rerank threshold ({settings.RERANK_SCORE_THRESHOLD}), using original results")
                            retrieved_docs = retrieved_docs[:top_k]
                    else:
                        print(f"[WARNING] Reranking failed, using original vector search results")
                        # Fallback: 원본 결과를 top_k개만 사용
                        retrieved_docs = retrieved_docs[:top_k]

                except Exception as e:
                    print(f"[WARNING] Reranking error: {e}, using original results")
                    retrieved_docs = retrieved_docs[:top_k]

            # 2. Generate: 답변 생성
            llm_response = await self.generate(
                query=query,
                retrieved_docs=retrieved_docs,
                model=model,
                reasoning_level=reasoning_level,
                temperature=temperature,
                max_tokens=max_tokens,
                top_p=top_p,
                frequency_penalty=frequency_penalty,
                presence_penalty=presence_penalty,
                chat_history=chat_history,
                collection_name=collection_name
            )

            # 3. 응답 포맷팅
            answer = llm_response.get("choices", [{}])[0].get("message", {}).get("content", "")
            usage = llm_response.get("usage", {})

            return {
                "answer": answer,
                "retrieved_docs": retrieved_docs,
                "usage": usage
            }

        except Exception as e:
            print(f"[ERROR] RAG chat failed: {e}")
            raise Exception(f"RAG 채팅 실패: {str(e)}")

    async def chat_stream(
        self,
        collection_name: Optional[str],
        query: str,
        model: str = "gpt-oss-20b",
        reasoning_level: str = "medium",
        temperature: float = 0.7,
        max_tokens: int = 2000,
        top_p: float = 0.9,
        frequency_penalty: float = 0.0,
        presence_penalty: float = 0.0,
        top_k: int = 5,
        score_threshold: Optional[float] = None,
        chat_history: Optional[List[Dict[str, str]]] = None,
        use_reranking: bool = False
    ) -> AsyncGenerator[str, None]:
        """
        RAG 기반 스트리밍 채팅

        Args:
            collection_name: Qdrant 컬렉션 이름
            query: 사용자 질문
            reasoning_level: 추론 수준
            temperature: 온도
            max_tokens: 최대 토큰 수
            top_p: Top P
            frequency_penalty: 빈도 패널티
            presence_penalty: 존재 패널티
            top_k: 검색할 문서 수
            score_threshold: 최소 유사도 점수
            chat_history: 이전 대화 기록
            use_reranking: Reranking 사용 여부

        Yields:
            str: SSE 이벤트 라인

        Raises:
            Exception: 처리 실패 시
        """
        try:
            # 일상대화 모드 체크 (collection_name이 None인 경우)
            is_casual_mode = not collection_name

            if is_casual_mode:
                # 일상대화 모드: 검색 없이 바로 LLM 생성
                logger.info(f"[RAG] Casual mode stream - skipping retrieval")
                retrieved_docs = []
            else:
                # 1. Retrieve: 관련 문서 검색
                # Reranking 사용 시 top_k를 배수만큼 증가
                initial_top_k = top_k
                if use_reranking and self.reranker_service:
                    initial_top_k = top_k * settings.RERANK_TOP_K_MULTIPLIER
                    print(f"[INFO] Reranking enabled: expanding top_k from {top_k} to {initial_top_k}")

                retrieved_docs = await self.retrieve(
                    collection_name=collection_name,
                    query=query,
                    top_k=initial_top_k,
                    score_threshold=score_threshold
                )

                if not retrieved_docs:
                    # 문서가 없을 경우 단일 메시지 전송
                    yield 'data: {"error": "관련된 문서를 찾을 수 없습니다."}\n\n'
                    return

            # 1.5. Reranking (선택) - RAG 모드에서만 적용
            if not is_casual_mode and use_reranking and self.reranker_service and retrieved_docs:
                try:
                    print(f"[INFO] Reranking {len(retrieved_docs)} documents")

                    # 문서 텍스트 추출
                    documents = [doc["payload"]["text"] for doc in retrieved_docs]

                    # Reranker 호출 (사용자 설정값 top_k 사용)
                    reranked_results = await self.reranker_service.rerank_with_fallback(
                        query=query,
                        documents=documents,
                        top_n=top_k,
                        return_documents=False
                    )

                    # Reranking 성공 시 재정렬 및 score threshold 필터링
                    if reranked_results:
                        # Reranker 순서로 재정렬하고 relevance_score를 score에 반영
                        reranked_docs = []
                        for r in reranked_results:
                            # Score threshold 필터링 적용
                            if r.relevance_score >= settings.RERANK_SCORE_THRESHOLD:
                                doc = retrieved_docs[r.index].copy()
                                doc["score"] = r.relevance_score  # Reranker score로 덮어쓰기
                                reranked_docs.append(doc)

                        if reranked_docs:
                            retrieved_docs = reranked_docs
                            top_score = reranked_docs[0]["score"]
                            print(f"[INFO] Reranking completed: {len(retrieved_docs)} docs passed threshold, top score={top_score:.4f}")
                        else:
                            print(f"[WARNING] No docs passed rerank threshold ({settings.RERANK_SCORE_THRESHOLD}), using original results")
                            retrieved_docs = retrieved_docs[:top_k]
                    else:
                        print(f"[WARNING] Reranking failed, using original vector search results")
                        # Fallback: 원본 결과를 top_k개만 사용
                        retrieved_docs = retrieved_docs[:top_k]

                except Exception as e:
                    print(f"[WARNING] Reranking error: {e}, using original results")
                    retrieved_docs = retrieved_docs[:top_k]

            # 2. 검색된 문서를 먼저 전송 (스트리밍 시작 전)
            sources_data = []
            for doc in retrieved_docs:
                sources_data.append({
                    "id": str(doc.get("id", "")),
                    "score": doc.get("score", 0.0),
                    "text": doc.get("payload", {}).get("text", ""),
                    "metadata": {k: v for k, v in doc.get("payload", {}).items() if k != "text"}
                })

            yield f'data: {json.dumps({"sources": sources_data}, ensure_ascii=False)}\n\n'

            # 3. Generate: 스트리밍 답변 생성
            async for chunk in self.generate_stream(
                query=query,
                retrieved_docs=retrieved_docs,
                model=model,
                reasoning_level=reasoning_level,
                temperature=temperature,
                max_tokens=max_tokens,
                top_p=top_p,
                frequency_penalty=frequency_penalty,
                presence_penalty=presence_penalty,
                chat_history=chat_history,
                collection_name=collection_name
            ):
                yield chunk

        except Exception as e:
            print(f"[ERROR] RAG stream chat failed: {e}")
            yield f'data: {{"error": "스트리밍 실패: {str(e)}"}}\n\n'
