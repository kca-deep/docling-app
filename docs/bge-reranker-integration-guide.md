# BGE Reranker v2-m3 통합 가이드

## 개요

이 문서는 Docling App RAG 시스템에 BGE Reranker v2-m3 모델을 통합하여 검색 정확도를 향상시키는 방법을 설명합니다.

## 1. 현재 상태 및 목표

### 1.1 현재 파이프라인 (구현 완료)
```
Query → BGE-M3 Embedding → Qdrant Vector Search (top_k=5) → LLM (gpt-oss-20b)
```

**구현된 컴포넌트:**
- `backend/services/embedding_service.py` - BGE-M3 임베딩 (http://kca-ai.kro.kr:8083)
- `backend/services/qdrant_service.py` - Qdrant 벡터 검색
- `backend/services/llm_service.py` - LLM 생성
- `backend/services/rag_service.py` - RAG 파이프라인
- `backend/api/routes/chat.py` - 채팅 API 엔드포인트

### 1.2 목표: Reranker 통합 파이프라인
```
Query → BGE-M3 Embedding → Qdrant Vector Search (top_k=15-30)
      → BGE Reranker v2-m3 (재순위) → Top 5-10 선택 → LLM
```

**추가 필요 컴포넌트:**
- `backend/services/reranker_service.py` - BGE Reranker 서비스 (신규)
- `backend/config/settings.py` - Reranker 설정 추가
- `backend/services/rag_service.py` - Reranking 로직 통합
- `app/chat/components/SettingsPanel.tsx` - Reranking UI 설정

### 1.3 통합 효과
- **정확도 향상**: Cross-encoder 기반 정밀 재순위로 관련도 높은 문서 우선 선택
- **노이즈 감소**: 초기 검색 후보를 넓게 가져와 Reranker로 필터링
- **Fallback 안정성**: Reranker 실패 시 벡터 검색 결과만 사용

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

### 3.1 환경 변수 설정

**파일**: `backend/.env` (추가 필요)
```env
# Reranker 설정
RERANKER_URL=http://kca-ai.kro.kr:8006
RERANKER_MODEL=BAAI/bge-reranker-v2-m3
RERANKER_TIMEOUT=30
USE_RERANKING=true
RERANK_TOP_K_MULTIPLIER=3
RERANK_FINAL_TOP_K=5
```

**파일**: `backend/config/settings.py` (기존 파일에 추가)
```python
class Settings(BaseSettings):
    # ... 기존 설정들 ...

    # Reranker 설정
    RERANKER_URL: str = "http://kca-ai.kro.kr:8006"
    RERANKER_MODEL: str = "BAAI/bge-reranker-v2-m3"
    RERANKER_TIMEOUT: int = 30
    USE_RERANKING: bool = True
    RERANK_TOP_K_MULTIPLIER: int = 3  # 벡터 검색 시 top_k * multiplier
    RERANK_FINAL_TOP_K: int = 5       # Reranker 후 최종 문서 수
```

### 3.2 RerankerService 구현

**파일**: `backend/services/reranker_service.py` (신규 생성)

핵심 기능만 포함:
- BGE Reranker API 호출
- 타임아웃 및 에러 처리
- Fallback 전략

### 3.3 RAG Service 수정

**파일**: `backend/services/rag_service.py` (기존 파일 수정)

**현재 상태:**
- `__init__`: `embedding_service`, `qdrant_service`, `llm_service` 3개 서비스만 사용
- `retrieve()`: 벡터 검색만 수행 (top_k=5)
- `chat()`: 검색 후 바로 LLM 생성

**수정 필요 사항:**
```python
# __init__에 reranker_service 추가
def __init__(
    self,
    embedding_service: EmbeddingService,
    qdrant_service: QdrantService,
    llm_service: LLMService,
    reranker_service: Optional[RerankerService] = None  # 추가
):
    self.reranker_service = reranker_service  # 추가

# chat() 메서드에 reranking 로직 추가
async def chat(
    self,
    collection_name: str,
    query: str,
    use_reranking: bool = False,  # 새 파라미터
    **kwargs
):
    # 1. 벡터 검색 (top_k를 확장)
    initial_top_k = kwargs.get('top_k', 5)
    if use_reranking and self.reranker_service:
        initial_top_k *= settings.RERANK_TOP_K_MULTIPLIER

    retrieved_docs = await self.retrieve(
        collection_name=collection_name,
        query=query,
        top_k=initial_top_k,
        score_threshold=kwargs.get('score_threshold')
    )

    # 2. Reranking (옵션)
    if use_reranking and self.reranker_service and retrieved_docs:
        try:
            reranked = await self.reranker_service.rerank(
                query=query,
                documents=[doc['payload']['text'] for doc in retrieved_docs],
                top_n=settings.RERANK_FINAL_TOP_K
            )
            # 재순위된 문서로 교체
            retrieved_docs = [retrieved_docs[r.index] for r in reranked]
        except Exception as e:
            print(f"[WARNING] Reranking failed: {e}")

    # 3. LLM 생성 (기존 로직)
    ...
```

### 3.4 API 엔드포인트 수정

**파일**: `backend/api/routes/chat.py` (기존 파일 수정)

**현재 상태:**
```python
# 현재: reranker_service 없음
rag_service = RAGService(
    embedding_service=embedding_service,
    qdrant_service=qdrant_service,
    llm_service=llm_service
)
```

**수정 필요:**
```python
from backend.services.reranker_service import RerankerService

# Reranker 서비스 초기화
reranker_service = RerankerService() if settings.USE_RERANKING else None

# RAG 서비스에 주입
rag_service = RAGService(
    embedding_service=embedding_service,
    qdrant_service=qdrant_service,
    llm_service=llm_service,
    reranker_service=reranker_service  # 추가
)
```

**ChatRequest 스키마 추가:**
```python
# backend/models/schemas.py에 추가
class ChatRequest(BaseModel):
    # ... 기존 필드들 ...
    use_reranking: bool = False  # Reranking 사용 여부
```

## 4. UI 통합

### 4.1 설정 패널 업데이트

**파일**: `app/chat/components/SettingsPanel.tsx` (기존 파일 수정)

**현재 인터페이스:**
```typescript
interface ChatSettings {
  reasoningLevel: string;
  temperature: number;
  maxTokens: number;
  topP: number;
  topK: number;  // 검색 문서 수 (현재 라인 309)
  frequencyPenalty: number;
  presencePenalty: number;
  streamMode: boolean;
}
```

**추가 필요:**
```typescript
interface ChatSettings {
  // ... 기존 필드들 ...
  useReranking: boolean;  // Reranking 사용 여부 (Switch)
}

// UI 컴포넌트 추가 (고급 설정 섹션에)
<div className="flex items-center justify-between">
  <div className="space-y-0.5">
    <Label htmlFor="use-reranking" className="text-sm">
      재순위 검색 (Reranking)
    </Label>
    <p className="text-xs text-muted-foreground">
      검색 정확도 향상
    </p>
  </div>
  <Switch
    id="use-reranking"
    checked={settings.useReranking}
    onCheckedChange={(checked) =>
      updateSetting("useReranking", checked)
    }
  />
</div>
```

### 4.2 API 요청 수정

**파일**: `app/chat/components/ChatContainer.tsx` (기존 파일 수정)

**수정 필요 사항:**
채팅 API 요청에 `use_reranking` 파라미터 추가

## 5. 구현 체크리스트

### 5.1 백엔드 작업
- [ ] `backend/.env`에 Reranker 설정 추가
- [ ] `backend/config/settings.py`에 Reranker 설정 클래스 추가
- [ ] `backend/services/reranker_service.py` 신규 생성
- [ ] `backend/services/rag_service.py` 수정 (reranker 통합)
- [ ] `backend/api/routes/chat.py` 수정 (reranker 서비스 주입)
- [ ] `backend/models/schemas.py`에 `use_reranking` 필드 추가

### 5.2 프론트엔드 작업
- [ ] `app/chat/components/SettingsPanel.tsx`에 `useReranking` 스위치 추가
- [ ] `app/chat/components/ChatContainer.tsx`에서 API 요청 시 `use_reranking` 전송

### 5.3 테스트
- [ ] Reranker API 연결 테스트 (http://kca-ai.kro.kr:8006)
- [ ] Fallback 동작 확인 (Reranker 실패 시 벡터 검색만 사용)
- [ ] UI 토글 동작 확인

## 6. 예상 효과

### 6.1 정확도 향상
- **Cross-encoder 기반 정밀 재순위**: Bi-encoder(벡터 검색)보다 쿼리-문서 관련도를 더 정확하게 판단
- **노이즈 필터링**: 초기 후보(15-30개)에서 가장 관련 높은 문서만 선별
- **Top-1 정확도 향상**: 가장 관련 높은 문서가 상위에 위치할 확률 증가

### 6.2 트레이드오프

| 요소 | 영향 | 대응 방안 |
|------|------|----------|
| 응답 시간 | +0.3~0.8초 | Fallback 전략, 선택적 사용 |
| API 의존성 | 증가 | 에러 시 자동 벡터 검색 사용 |
| 비용 | Reranker API 호출 추가 | UI 토글로 선택 가능 |

## 7. FAQ

### Q1: Reranker 서비스가 다운되면?
**A**: 자동으로 벡터 검색 결과만 사용합니다 (Fallback).

### Q2: 기본값으로 Reranking을 활성화해야 하나요?
**A**: 현재 설정은 `USE_RERANKING=true`이지만, 사용자가 UI에서 토글 가능합니다.

### Q3: Reranking 점수와 벡터 검색 점수의 차이는?
**A**:
- **벡터 검색 점수**: 쿼리와 문서의 임베딩 벡터 간 코사인 유사도 (의미적 유사도)
- **Reranking 점수**: Cross-encoder가 쿼리-문서 쌍을 직접 분석한 관련도 점수 (더 정밀)

### Q4: top_k_multiplier를 왜 3으로 설정하나요?
**A**: 초기 후보를 넓게 가져와 Reranker가 선택할 여지를 주기 위함입니다. 기본 top_k=5이면 15개를 가져와 Reranker가 5개를 선별합니다.

## 8. 참고 자료

- [BGE Reranker v2-m3 모델](https://huggingface.co/BAAI/bge-reranker-v2-m3)
- [Cross-encoder vs Bi-encoder](https://www.sbert.net/examples/applications/cross-encoder/README.html)