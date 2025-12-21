"""
RAG (Retrieval-Augmented Generation) 서비스
Qdrant 검색 + LLM 생성을 통합하는 서비스
"""
import json
import logging
from typing import List, Dict, Any, Optional, AsyncGenerator, TYPE_CHECKING
from backend.services.embedding_service import EmbeddingService
from backend.services.qdrant_service import QdrantService
from backend.services.llm_service import LLMService
from backend.services.reranker_service import RerankerService
from backend.config.settings import settings
from backend.utils.error_handler import get_sse_error_response
from backend.utils.source_converter import convert_docs_to_sources
from backend.services.keyword_service import extract_keywords_for_documents
from backend.services.citation_service import extract_citations_for_sources

if TYPE_CHECKING:
    from backend.services.hybrid_search_service import HybridSearchService

# 로거 설정
logger = logging.getLogger("uvicorn")


class RAGService:
    """RAG 파이프라인을 담당하는 서비스"""

    def __init__(
        self,
        embedding_service: EmbeddingService,
        qdrant_service: QdrantService,
        llm_service: LLMService,
        reranker_service: Optional[RerankerService] = None,
        hybrid_search_service: Optional["HybridSearchService"] = None
    ):
        """
        RAGService 초기화

        Args:
            embedding_service: 임베딩 서비스
            qdrant_service: Qdrant 서비스
            llm_service: LLM 서비스
            reranker_service: Reranker 서비스 (선택)
            hybrid_search_service: 하이브리드 검색 서비스 (선택)
        """
        self.embedding_service = embedding_service
        self.qdrant_service = qdrant_service
        self.llm_service = llm_service
        self.reranker_service = reranker_service
        self.hybrid_search_service = hybrid_search_service

    async def _apply_reranking(
        self,
        query: str,
        retrieved_docs: List[Dict[str, Any]],
        top_k: int
    ) -> List[Dict[str, Any]]:
        """
        검색 결과에 리랭킹 적용 (공통 로직)

        Args:
            query: 검색 쿼리
            retrieved_docs: 검색된 문서 리스트
            top_k: 최종 반환할 문서 수

        Returns:
            List[Dict[str, Any]]: 리랭킹된 문서 리스트
        """
        if not retrieved_docs:
            return retrieved_docs

        try:
            logger.info(f"Reranking {len(retrieved_docs)} documents")

            # 문서 텍스트 추출 (파일명/페이지 정보 포함)
            documents = []
            for doc in retrieved_docs:
                payload = doc.get("payload", {})
                text = payload.get("text", "")
                filename = payload.get("filename", "")
                headings = payload.get("headings", [])

                # 파일명과 헤딩 정보가 있으면 앞에 추가
                if filename and headings:
                    header = f"[{filename}] [{headings[1] if len(headings) > 1 else ''}] "
                    documents.append(header + text)
                elif filename:
                    documents.append(f"[{filename}] " + text)
                else:
                    documents.append(text)

            # Reranker 호출
            reranked_results = await self.reranker_service.rerank_with_fallback(
                query=query,
                documents=documents,
                top_n=top_k,
                return_documents=False
            )

            # Reranking 성공 시 재정렬
            if reranked_results:
                reordered_docs = []
                filtered_docs = []

                for r in reranked_results:
                    doc = retrieved_docs[r.index].copy()
                    doc["score"] = r.relevance_score
                    reordered_docs.append(doc)

                    if r.relevance_score >= settings.RERANK_SCORE_THRESHOLD:
                        filtered_docs.append(doc)

                # threshold 통과 문서가 있으면 사용, 없으면 리랭킹 순서만 유지
                if filtered_docs:
                    top_score = filtered_docs[0]["score"]
                    logger.info(f"Reranking completed: {len(filtered_docs)} docs passed threshold (>={settings.RERANK_SCORE_THRESHOLD}), top score={top_score:.4f}")
                    return filtered_docs
                else:
                    top_score = reordered_docs[0]["score"] if reordered_docs else 0
                    logger.info(f"Reranking completed: no docs passed threshold, but using reranked order. top score={top_score:.4f}")
                    return reordered_docs[:top_k]
            else:
                logger.warning("Reranking failed, using original vector search results")
                return retrieved_docs[:top_k]

        except Exception as e:
            logger.warning(f"Reranking error: {e}, using original results")
            return retrieved_docs[:top_k]

    async def retrieve(
        self,
        collection_name: str,
        query: str,
        top_k: int = 5,
        score_threshold: Optional[float] = None,
        use_hybrid: bool = True
    ) -> List[Dict[str, Any]]:
        """
        유사 문서 검색 (하이브리드 검색 지원)

        Args:
            collection_name: Qdrant 컬렉션 이름
            query: 검색 쿼리
            top_k: 검색할 문서 수
            score_threshold: 최소 유사도 점수
            use_hybrid: 하이브리드 검색 사용 여부 (기본값: True)

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
            logger.info(f"[RAG] Embedding query: {query[:100]}...")
            query_embeddings = await self.embedding_service.get_embeddings(query)

            if not query_embeddings or len(query_embeddings) == 0:
                raise Exception("임베딩 생성 실패")

            query_vector = query_embeddings[0]

            # 2. 하이브리드 검색 또는 벡터 검색
            if use_hybrid and self.hybrid_search_service and settings.USE_HYBRID_SEARCH:
                # 하이브리드 검색 (벡터 + BM25)
                logger.info(f"[RAG] Hybrid search in '{collection_name}' with top_k={top_k}")
                results = await self.hybrid_search_service.hybrid_search(
                    collection_name=collection_name,
                    query=query,
                    query_vector=query_vector,
                    top_k=top_k,
                    score_threshold=score_threshold,
                    vector_weight=settings.HYBRID_VECTOR_WEIGHT,
                    bm25_weight=settings.HYBRID_BM25_WEIGHT
                )
            else:
                # 기존 벡터 검색
                logger.info(f"[RAG] Vector search in '{collection_name}' with top_k={top_k}")
                results = await self.qdrant_service.search(
                    collection_name=collection_name,
                    query_vector=query_vector,
                    limit=top_k,
                    score_threshold=score_threshold
                )

            logger.info(f"[RAG] Retrieved {len(results)} documents")
            return results

        except Exception as e:
            logger.error(f"[RAG] Retrieve failed: {e}")
            raise Exception(f"문서 검색 실패: {str(e)}")

    async def retrieve_from_multiple(
        self,
        collection_names: List[str],
        query: str,
        top_k: int = 5,
        score_threshold: Optional[float] = None,
        use_hybrid: bool = True
    ) -> List[Dict[str, Any]]:
        """
        여러 컬렉션에서 문서 검색 후 병합

        Args:
            collection_names: Qdrant 컬렉션 이름 리스트
            query: 검색 쿼리
            top_k: 컬렉션당 검색할 문서 수
            score_threshold: 최소 유사도 점수
            use_hybrid: 하이브리드 검색 사용 여부

        Returns:
            List[Dict[str, Any]]: 병합된 검색 결과 (점수순 정렬)
        """
        all_results = []

        for collection_name in collection_names:
            try:
                results = await self.retrieve(
                    collection_name=collection_name,
                    query=query,
                    top_k=top_k,
                    score_threshold=score_threshold,
                    use_hybrid=use_hybrid
                )
                # 컬렉션 출처 추가
                for doc in results:
                    doc["source_collection"] = collection_name
                all_results.extend(results)
                logger.info(f"[RAG] Retrieved {len(results)} docs from '{collection_name}'")
            except Exception as e:
                logger.warning(f"[RAG] Failed to retrieve from '{collection_name}': {e}")
                continue

        # 점수순 정렬 후 반환
        all_results.sort(key=lambda x: x.get("score", 0), reverse=True)
        logger.info(f"[RAG] Total merged results: {len(all_results)} documents")
        return all_results

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
            # 1. RAG 프롬프트 구성 (EXAONE Deep 모델 여부에 따라 프롬프트 구조 변경)
            messages = self.llm_service.build_rag_messages(
                query=query,
                retrieved_docs=retrieved_docs,
                reasoning_level=reasoning_level,
                chat_history=chat_history,
                collection_name=collection_name,
                model_key=model
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
            logger.error(f"Generate failed: {e}")
            raise Exception(f"답변 생성 실패: {str(e)}") from e

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
            # 1. RAG 프롬프트 구성 (EXAONE Deep 모델 여부에 따라 프롬프트 구조 변경)
            messages = self.llm_service.build_rag_messages(
                query=query,
                retrieved_docs=retrieved_docs,
                reasoning_level=reasoning_level,
                chat_history=chat_history,
                collection_name=collection_name,
                model_key=model
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
            logger.error(f"Stream generate failed: {e}")
            raise Exception(f"스트리밍 답변 생성 실패: {str(e)}") from e

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
        use_reranking: bool = False,
        use_hybrid: bool = True,
        temp_collection_name: Optional[str] = None
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
            use_hybrid: 하이브리드 검색 사용 여부 (기본값: True)
            temp_collection_name: 임시 컬렉션 이름 (채팅 문서 업로드용)

        Returns:
            Dict[str, Any]: 응답
                - answer: AI 답변 텍스트
                - retrieved_docs: 검색된 문서 리스트
                - usage: 토큰 사용량

        Raises:
            Exception: 처리 실패 시
        """
        try:
            # 검색 대상 컬렉션 목록 구성
            target_collections = []
            if collection_name:
                target_collections.append(collection_name)
            if temp_collection_name:
                target_collections.append(temp_collection_name)

            # 일상대화 모드 체크 (컬렉션이 하나도 없는 경우)
            is_casual_mode = len(target_collections) == 0

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
                    logger.info(f"Reranking enabled: expanding top_k from {top_k} to {initial_top_k}")

                # 단일 컬렉션 또는 병합 검색
                if len(target_collections) == 1:
                    retrieved_docs = await self.retrieve(
                        collection_name=target_collections[0],
                        query=query,
                        top_k=initial_top_k,
                        score_threshold=score_threshold,
                        use_hybrid=use_hybrid
                    )
                else:
                    # 병합 검색: 여러 컬렉션에서 검색 후 합침
                    logger.info(f"[RAG] Merged search across {len(target_collections)} collections: {target_collections}")
                    retrieved_docs = await self.retrieve_from_multiple(
                        collection_names=target_collections,
                        query=query,
                        top_k=initial_top_k,
                        score_threshold=score_threshold,
                        use_hybrid=use_hybrid
                    )

                if not retrieved_docs:
                    return {
                        "answer": "관련된 문서를 찾을 수 없습니다. 다른 질문을 시도해보세요.",
                        "retrieved_docs": [],
                        "usage": None
                    }

            # 1.5. Reranking (선택)
            if use_reranking and self.reranker_service and retrieved_docs:
                retrieved_docs = await self._apply_reranking(query, retrieved_docs, top_k)

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
            message = llm_response.get("choices", [{}])[0].get("message", {})
            answer = message.get("content", "")
            reasoning_content = message.get("reasoning_content", "")
            usage = llm_response.get("usage", {})

            result = {
                "answer": answer,
                "retrieved_docs": retrieved_docs,
                "usage": usage
            }

            # GPT-OSS의 reasoning_content가 있으면 포함
            if reasoning_content:
                result["reasoning_content"] = reasoning_content

            return result

        except Exception as e:
            logger.error(f"RAG chat failed: {e}")
            raise Exception(f"RAG 채팅 실패: {str(e)}") from e

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
        use_reranking: bool = False,
        use_hybrid: bool = True,
        temp_collection_name: Optional[str] = None
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
            use_hybrid: 하이브리드 검색 사용 여부 (기본값: True)
            temp_collection_name: 임시 컬렉션 이름 (채팅 문서 업로드용)

        Yields:
            str: SSE 이벤트 라인

        Raises:
            Exception: 처리 실패 시
        """
        try:
            # 검색 대상 컬렉션 목록 구성
            target_collections = []
            if collection_name:
                target_collections.append(collection_name)
            if temp_collection_name:
                target_collections.append(temp_collection_name)

            # 일상대화 모드 체크 (컬렉션이 하나도 없는 경우)
            is_casual_mode = len(target_collections) == 0

            if is_casual_mode:
                # 일상대화 모드: 검색 없이 바로 LLM 생성
                logger.info(f"[RAG] Casual mode stream - skipping retrieval")
                # 단계 이벤트: 바로 생성 단계로
                yield f'data: {json.dumps({"type": "stage", "stage": "generate"}, ensure_ascii=False)}\n\n'
                retrieved_docs = []
            else:
                # 단계 이벤트: 분석 단계
                yield f'data: {json.dumps({"type": "stage", "stage": "analyze"}, ensure_ascii=False)}\n\n'

                # 1. Retrieve: 관련 문서 검색
                # Reranking 사용 시 top_k를 배수만큼 증가
                initial_top_k = top_k
                if use_reranking and self.reranker_service:
                    initial_top_k = top_k * settings.RERANK_TOP_K_MULTIPLIER
                    logger.info(f"Reranking enabled: expanding top_k from {top_k} to {initial_top_k}")

                # 단계 이벤트: 검색 단계
                yield f'data: {json.dumps({"type": "stage", "stage": "search"}, ensure_ascii=False)}\n\n'

                # 단일 컬렉션 또는 병합 검색
                if len(target_collections) == 1:
                    retrieved_docs = await self.retrieve(
                        collection_name=target_collections[0],
                        query=query,
                        top_k=initial_top_k,
                        score_threshold=score_threshold,
                        use_hybrid=use_hybrid
                    )
                else:
                    # 병합 검색: 여러 컬렉션에서 검색 후 합침
                    logger.info(f"[RAG] Merged search across {len(target_collections)} collections: {target_collections}")
                    retrieved_docs = await self.retrieve_from_multiple(
                        collection_names=target_collections,
                        query=query,
                        top_k=initial_top_k,
                        score_threshold=score_threshold,
                        use_hybrid=use_hybrid
                    )

                if not retrieved_docs:
                    # 문서가 없을 경우 단일 메시지 전송
                    yield 'data: {"error": "관련된 문서를 찾을 수 없습니다."}\n\n'
                    return

            # 1.5. Reranking (선택) - RAG 모드에서만 적용
            if not is_casual_mode and use_reranking and self.reranker_service and retrieved_docs:
                # 단계 이벤트: 리랭킹 단계
                yield f'data: {json.dumps({"type": "stage", "stage": "rerank"}, ensure_ascii=False)}\n\n'
                retrieved_docs = await self._apply_reranking(query, retrieved_docs, top_k)

            # 2. 검색된 문서에 키워드 추출 후 전송 (스트리밍 시작 전)
            docs_with_keywords = extract_keywords_for_documents(query, retrieved_docs)
            sources_data = convert_docs_to_sources(docs_with_keywords)
            yield f'data: {json.dumps({"sources": sources_data}, ensure_ascii=False)}\n\n'

            # 단계 이벤트: 생성 단계
            yield f'data: {json.dumps({"type": "stage", "stage": "generate"}, ensure_ascii=False)}\n\n'

            # 3. Generate: 스트리밍 답변 생성 (응답 내용 수집)
            response_parts = []  # 리스트로 수집 (문자열 연결보다 효율적)
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
                # 응답 내용 추출하여 수집 (리스트 append는 O(1))
                if chunk.startswith("data: "):
                    try:
                        chunk_data = json.loads(chunk[6:].strip())
                        if "choices" in chunk_data:
                            delta = chunk_data["choices"][0].get("delta", {})
                            content = delta.get("content", "")
                            if content:
                                response_parts.append(content)
                    except (json.JSONDecodeError, KeyError, IndexError):
                        pass

            # 리스트를 문자열로 합침 (O(n))
            full_response = "".join(response_parts)

            # 4. 스트리밍 완료 후 인용 추출 및 sources_update 전송 (설정에 따라)
            if settings.RAG_CITATION_EXTRACTION and full_response and docs_with_keywords:
                try:
                    # 인용 추출
                    docs_with_citations = extract_citations_for_sources(
                        full_response, docs_with_keywords
                    )
                    # cited_phrases가 있는 문서가 있으면 업데이트 전송
                    has_citations = any(
                        doc.get("cited_phrases") for doc in docs_with_citations
                    )
                    if has_citations:
                        updated_sources = convert_docs_to_sources(docs_with_citations)
                        yield f'data: {json.dumps({"sources_update": updated_sources}, ensure_ascii=False)}\n\n'
                        logger.debug(f"Sent sources_update with citations")
                except Exception as cite_err:
                    logger.warning(f"Citation extraction failed: {cite_err}")

        except Exception as e:
            logger.error(f"RAG stream chat failed: {e}")
            yield get_sse_error_response(e, "stream")
