# BGE Reranker v2-m3 통합 가이드

## 개요

이 문서는 KCA-RAG 시스템에 BGE Reranker v2-m3 모델을 통합하여 검색 정확도를 향상시키는 방법을 설명합니다.

## 1. 아키텍처 개요

### 1.1 현재 파이프라인
```
Query → Embedding → Qdrant Vector Search (top_k=50) → LLM
```

### 1.2 개선된 파이프라인
```
Query → Embedding → Qdrant Vector Search (top_k=100)
      → BGE Reranker (재순위) → Top 20 선택 → LLM
```

### 1.3 파이프라인 플로우차트
```mermaid
graph TD
    A[사용자 질문] --> B[Embedding Service]
    B --> C[Qdrant Vector Search]
    C --> D{Reranking 사용?}
    D -->|Yes| E[BGE Reranker Service]
    D -->|No| F[상위 K개 문서]
    E --> G[Cross-encoder 재순위]
    G --> F
    F --> H[LLM Service]
    H --> I[최종 응답]
```

## 2. BGE Reranker API 스펙

### 2.1 API 정보
- **Base URL**: `http://kca-ai.kro.kr:8006`
- **Model**: `BAAI/bge-reranker-v2-m3`
- **Endpoint**: `/v1/rerank`

### 2.2 요청 형식
```json
POST /v1/rerank
{
  "model": "BAAI/bge-reranker-v2-m3",
  "query": "사용자 질문",
  "documents": [
    "문서1 텍스트",
    "문서2 텍스트",
    // 또는 객체 형태:
    {
      "text": "문서 텍스트",
      "metadata": {...}
    }
  ],
  "top_n": 20,  // 상위 N개만 반환 (선택사항)
  "return_documents": true  // 문서 텍스트 포함 여부
}
```

### 2.3 응답 형식
```json
{
  "id": "req-xxxxx",
  "model": "BAAI/bge-reranker-v2-m3",
  "results": [
    {
      "index": 0,  // 원본 documents 배열의 인덱스
      "relevance_score": 0.95,  // 관련도 점수
      "document": "문서 텍스트"  // return_documents=true일 때
    }
  ],
  "usage": {...}
}
```

## 3. 구현 가이드

### 3.1 RerankerService 구현

**파일**: `backend/services/reranker_service.py`

```python
from typing import List, Optional, Dict, Any
import httpx
from pydantic import BaseModel
from backend.config.settings import settings

class RerankDocument(BaseModel):
    text: str
    metadata: Optional[Dict[str, Any]] = None

class RerankResult(BaseModel):
    index: int
    relevance_score: float
    document: Optional[str | Dict] = None

class RerankerService:
    """BGE Reranker v2-m3 서비스 클래스"""

    def __init__(self, base_url: str = None):
        self.base_url = base_url or settings.RERANKER_URL
        self.model = settings.RERANKER_MODEL
        self.timeout = settings.RERANKER_TIMEOUT

    async def rerank(
        self,
        query: str,
        documents: List[str | RerankDocument],
        top_n: Optional[int] = None,
        return_documents: bool = True
    ) -> List[RerankResult]:
        """
        BGE Reranker를 사용하여 문서 재순위

        Args:
            query: 사용자 질문
            documents: 재순위할 문서 리스트
            top_n: 반환할 상위 문서 개수
            return_documents: 결과에 문서 텍스트 포함 여부

        Returns:
            재순위된 문서 리스트 (relevance_score 내림차순)
        """
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    f"{self.base_url}/v1/rerank",
                    json={
                        "model": self.model,
                        "query": query,
                        "documents": documents,
                        "top_n": top_n,
                        "return_documents": return_documents
                    },
                    timeout=self.timeout
                )
                response.raise_for_status()

                data = response.json()
                return [RerankResult(**result) for result in data["results"]]

            except httpx.TimeoutException:
                print(f"[WARNING] Reranker timeout after {self.timeout}s, falling back to vector search")
                raise
            except Exception as e:
                print(f"[ERROR] Reranker failed: {e}")
                raise
```

### 3.2 RAG Service 수정

**파일**: `backend/services/rag_service.py`

```python
class RAGService:
    def __init__(
        self,
        embedding_service: EmbeddingService,
        qdrant_service: QdrantService,
        llm_service: LLMService,
        reranker_service: Optional[RerankerService] = None
    ):
        self.embedding_service = embedding_service
        self.qdrant_service = qdrant_service
        self.llm_service = llm_service
        self.reranker_service = reranker_service

    async def chat(
        self,
        collection_name: str,
        query: str,
        use_reranking: bool = True,
        rerank_top_k_multiplier: int = 3,
        final_top_k: int = 20,
        **kwargs
    ):
        """
        RAG 기반 채팅 with Reranking

        1. 벡터 검색으로 초기 후보 문서 검색
        2. (옵션) Reranker로 정밀 재순위
        3. LLM으로 최종 응답 생성
        """
        import time
        start_time = time.time()

        # 1단계: 벡터 검색
        initial_top_k = final_top_k * rerank_top_k_multiplier if use_reranking else final_top_k

        vector_start = time.time()
        query_embedding = await self.embedding_service.embed([query])

        search_results = await self.qdrant_service.search(
            collection_name=collection_name,
            query_vector=query_embedding[0],
            limit=initial_top_k,
            score_threshold=0.0
        )
        vector_time = time.time() - vector_start

        if not search_results:
            return {
                "answer": "관련 문서를 찾을 수 없습니다.",
                "retrieved_docs": [],
                "reranking_used": False
            }

        # 2단계: Reranking
        rerank_time = 0
        if use_reranking and self.reranker_service:
            try:
                rerank_start = time.time()

                # 문서 준비
                documents = []
                for idx, result in enumerate(search_results):
                    doc_text = result.payload.get("text", "")
                    documents.append({
                        "text": doc_text,
                        "metadata": {
                            "original_score": result.score,
                            "doc_id": result.id
                        }
                    })

                # Reranking 수행
                reranked_results = await self.reranker_service.rerank(
                    query=query,
                    documents=documents,
                    top_n=final_top_k,
                    return_documents=True
                )

                # 결과 매핑
                final_docs = []
                for rerank_result in reranked_results:
                    original_idx = rerank_result.index
                    original_doc = search_results[original_idx]

                    final_docs.append({
                        "id": original_doc.id,
                        "text": original_doc.payload.get("text", ""),
                        "score": rerank_result.relevance_score,
                        "original_score": original_doc.score,
                        "metadata": original_doc.payload
                    })

                rerank_time = time.time() - rerank_start
                reranking_used = True

            except Exception as e:
                print(f"[WARNING] Reranking failed, using vector search only: {e}")
                final_docs = self._prepare_vector_docs(search_results[:final_top_k])
                reranking_used = False
        else:
            final_docs = self._prepare_vector_docs(search_results[:final_top_k])
            reranking_used = False

        # 3단계: LLM 생성
        llm_start = time.time()
        context = self._build_context(final_docs)

        response = await self.llm_service.generate(
            prompt=query,
            context=context,
            **kwargs
        )
        llm_time = time.time() - llm_start

        total_time = time.time() - start_time

        return {
            "answer": response,
            "retrieved_docs": final_docs,
            "reranking_used": reranking_used,
            "performance": {
                "vector_search_time": vector_time,
                "reranking_time": rerank_time,
                "llm_generation_time": llm_time,
                "total_time": total_time,
                "initial_docs_count": len(search_results),
                "final_docs_count": len(final_docs)
            }
        }

    def _prepare_vector_docs(self, search_results):
        """벡터 검색 결과를 문서 형식으로 변환"""
        return [
            {
                "id": doc.id,
                "text": doc.payload.get("text", ""),
                "score": doc.score,
                "metadata": doc.payload
            }
            for doc in search_results
        ]

    def _build_context(self, docs):
        """LLM 컨텍스트 구성"""
        return "\n\n".join([
            f"[문서 {i+1}] (관련도: {doc['score']:.2f})\n{doc['text']}"
            for i, doc in enumerate(docs)
        ])
```

### 3.3 환경 변수 설정

**파일**: `backend/.env`

```env
# Reranker Configuration
RERANKER_URL=http://kca-ai.kro.kr:8006
RERANKER_MODEL=BAAI/bge-reranker-v2-m3
RERANKER_TIMEOUT=30
USE_RERANKING=true
RERANK_TOP_K_MULTIPLIER=3
RERANK_FINAL_TOP_K=20
```

**파일**: `backend/config/settings.py`

```python
class Settings(BaseSettings):
    # 기존 설정들...

    # Reranker 설정
    RERANKER_URL: str = "http://kca-ai.kro.kr:8006"
    RERANKER_MODEL: str = "BAAI/bge-reranker-v2-m3"
    RERANKER_TIMEOUT: int = 30
    USE_RERANKING: bool = True
    RERANK_TOP_K_MULTIPLIER: int = 3
    RERANK_FINAL_TOP_K: int = 20
```

### 3.4 API 엔드포인트 수정

**파일**: `backend/api/routes/chat.py`

```python
# 서비스 초기화에 Reranker 추가
from backend.services.reranker_service import RerankerService

reranker_service = RerankerService(
    base_url=settings.RERANKER_URL
) if settings.USE_RERANKING else None

rag_service = RAGService(
    embedding_service=embedding_service,
    qdrant_service=qdrant_service,
    llm_service=llm_service,
    reranker_service=reranker_service
)

# ChatRequest 모델 수정
class ChatRequest(BaseModel):
    # 기존 필드들...

    # Reranking 옵션
    use_reranking: bool = Field(default=True, description="Reranking 사용 여부")
    rerank_top_k_multiplier: int = Field(default=3, ge=1, le=5)
    rerank_final_top_k: int = Field(default=20, ge=10, le=100)
```

## 4. UI 통합

### 4.1 설정 패널 업데이트

**파일**: `app/chat/components/SettingsPanel.tsx`

```typescript
// ChatSettings 인터페이스에 추가
interface ChatSettings {
  // 기존 설정들...

  // Reranking 설정
  useReranking: boolean;
  rerankTopKMultiplier: number;
  rerankFinalTopK: number;
}

// 초기값 설정
const [settings, setSettings] = useState<ChatSettings>({
  // 기존 설정들...
  useReranking: true,
  rerankTopKMultiplier: 3,
  rerankFinalTopK: 20,
});
```

### 4.2 API 요청 수정

**파일**: `app/chat/components/ChatContainer.tsx`

```typescript
// 메시지 전송 시 Reranking 옵션 포함
const requestBody = {
  collection_name: selectedCollection,
  message: userMessage.content,
  // 기존 파라미터들...

  // Reranking 옵션 추가
  use_reranking: settings.useReranking,
  rerank_top_k_multiplier: settings.rerankTopKMultiplier,
  rerank_final_top_k: settings.rerankFinalTopK,
};
```

## 5. 성능 최적화

### 5.1 캐싱 전략

```python
from functools import lru_cache
import hashlib

class RerankerService:
    def __init__(self):
        self._cache = {}
        self._cache_ttl = 300  # 5분

    def _get_cache_key(self, query: str, documents: List):
        """캐시 키 생성"""
        doc_texts = [d if isinstance(d, str) else d.get("text", "") for d in documents]
        content = query + "".join(doc_texts)
        return hashlib.md5(content.encode()).hexdigest()

    async def rerank_with_cache(self, query, documents, **kwargs):
        cache_key = self._get_cache_key(query, documents)

        # 캐시 확인
        if cache_key in self._cache:
            cached = self._cache[cache_key]
            if time.time() - cached["timestamp"] < self._cache_ttl:
                return cached["results"]

        # 실제 Reranking 수행
        results = await self.rerank(query, documents, **kwargs)

        # 캐시 저장
        self._cache[cache_key] = {
            "results": results,
            "timestamp": time.time()
        }

        return results
```

### 5.2 배치 처리

```python
async def rerank_batch(self, queries: List[str], documents_list: List[List], batch_size: int = 10):
    """대량 요청 배치 처리"""
    results = []

    for i in range(0, len(queries), batch_size):
        batch_queries = queries[i:i+batch_size]
        batch_docs = documents_list[i:i+batch_size]

        batch_results = await asyncio.gather(*[
            self.rerank(q, d) for q, d in zip(batch_queries, batch_docs)
        ])

        results.extend(batch_results)

    return results
```

## 6. 테스트 및 평가

### 6.1 단위 테스트

```python
# test_reranker_service.py
import pytest
from backend.services.reranker_service import RerankerService

@pytest.mark.asyncio
async def test_reranker_basic():
    reranker = RerankerService()

    query = "파이썬에서 리스트 정렬 방법"
    documents = [
        "파이썬 리스트는 sort() 메서드로 정렬할 수 있습니다.",
        "자바스크립트 배열 정렬 방법",
        "sorted() 함수를 사용하여 새로운 정렬된 리스트를 만들 수 있습니다."
    ]

    results = await reranker.rerank(query, documents, top_n=2)

    assert len(results) == 2
    assert results[0].relevance_score > results[1].relevance_score
    assert results[0].index in [0, 2]  # 파이썬 관련 문서가 상위에
```

### 6.2 통합 테스트

```python
# test_rag_with_reranking.py
@pytest.mark.asyncio
async def test_rag_reranking_improves_quality():
    # Vector search only
    result_without = await rag_service.chat(
        collection_name="test",
        query="테스트 질문",
        use_reranking=False
    )

    # With reranking
    result_with = await rag_service.chat(
        collection_name="test",
        query="테스트 질문",
        use_reranking=True
    )

    # Reranking이 더 높은 관련도를 보여야 함
    avg_score_without = sum(d["score"] for d in result_without["retrieved_docs"]) / len(result_without["retrieved_docs"])
    avg_score_with = sum(d["score"] for d in result_with["retrieved_docs"]) / len(result_with["retrieved_docs"])

    assert avg_score_with > avg_score_without
```

## 7. 모니터링 및 로깅

### 7.1 성능 메트릭 수집

```python
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

class RerankerMetrics:
    def __init__(self):
        self.requests_total = 0
        self.requests_success = 0
        self.requests_failed = 0
        self.total_latency = 0

    def record_request(self, success: bool, latency: float):
        self.requests_total += 1
        self.total_latency += latency

        if success:
            self.requests_success += 1
        else:
            self.requests_failed += 1

        logger.info(f"Reranker metrics: success_rate={self.get_success_rate():.2%}, avg_latency={self.get_avg_latency():.2f}s")

    def get_success_rate(self):
        return self.requests_success / max(self.requests_total, 1)

    def get_avg_latency(self):
        return self.total_latency / max(self.requests_total, 1)
```

## 8. 예상 효과 및 트레이드오프

### 8.1 예상 효과

| 지표 | 개선 전 | 개선 후 | 향상률 |
|------|---------|---------|--------|
| 평균 관련도 점수 | 0.65 | 0.85 | +30.8% |
| Top-1 정확도 | 70% | 90% | +28.6% |
| MRR (Mean Reciprocal Rank) | 0.75 | 0.92 | +22.7% |
| 사용자 만족도 | 3.5/5 | 4.3/5 | +22.9% |

### 8.2 트레이드오프

| 요소 | 영향 | 대응 방안 |
|------|------|----------|
| 응답 시간 | +0.5~1초 | 캐싱, 비동기 처리 |
| API 의존성 | 증가 | Fallback 전략 구현 |
| 비용 | API 호출 추가 | 선택적 사용 옵션 제공 |
| 복잡도 | 시스템 복잡도 증가 | 모듈화, 문서화 |

## 9. FAQ

### Q1: Reranker 서비스가 다운되면?
**A**: 자동으로 벡터 검색 결과만 사용하도록 Fallback 처리됩니다.

### Q2: 최적의 top_k_multiplier 값은?
**A**: 일반적으로 3-5배가 적절합니다. 문서가 많고 노이즈가 많은 경우 높은 값을 사용하세요.

### Q3: 모든 쿼리에 Reranking을 사용해야 하나요?
**A**: 아닙니다. 간단한 쿼리나 빠른 응답이 필요한 경우 비활성화할 수 있습니다.

### Q4: Reranking 점수와 벡터 검색 점수의 차이는?
**A**: 벡터 검색은 의미적 유사도, Reranking은 쿼리-문서 쌍의 직접적인 관련도를 측정합니다.

## 10. 참고 자료

- [BGE Reranker v2-m3 모델 정보](https://huggingface.co/BAAI/bge-reranker-v2-m3)
- [Cross-encoder vs Bi-encoder 비교](https://www.sbert.net/examples/applications/cross-encoder/README.html)
- [RAG 시스템의 Reranking 전략](https://arxiv.org/abs/2404.07220)