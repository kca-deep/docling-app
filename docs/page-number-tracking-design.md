# 청킹 결과에 페이지 번호 표시 기능 설계

## 문제 정의

**현재 상황:**
- AI 챗봇 응답 시 참고 문서가 "문서1, 문서2" 등 청킹 단위로 표시됨
- 사용자가 실제 원본 문서의 몇 페이지인지 알 수 없음

**목표:**
- Qdrant 벡터 검색 결과를 "문서명 X페이지" 형식으로 표시
- 예: "계약서.pdf 5페이지, 보고서.docx 12페이지"

**범위:**
- Qdrant 벡터 DB 통합에만 적용 (Dify 연동과 무관)
- 문서 파싱 → 청킹 → 임베딩 → Qdrant 업로드 → 검색 결과 표시 전 과정

---

## 아키텍처 개요

```
[Docling 파싱]
    ↓ (Markdown + 페이지 메타데이터)
[SQLite DB 저장]
    ↓
[Docling Serve 청킹 API] ← 원격 청킹 서버
    ↓ (청크 + 페이지 매핑)
[BGE-M3 임베딩 API] ← 원격 임베딩 서버
    ↓ (벡터 + 페이지 메타데이터)
[Qdrant Vector DB]
    ↓
[검색 API] → "문서명 X페이지"
```

**핵심 설계 원칙:**
1. **페이지 정보의 전 과정 추적**: 파싱 → DB → 청킹 → Qdrant 전 단계에서 페이지 정보 유지
2. **메타데이터 기반 설계**: Qdrant payload에 `page_number` 필드 저장
3. **API 응답 변환**: 검색 결과에서 청크 ID → 페이지 번호 변환

---

## 1. Docling 파싱 단계: 페이지 정보 추출

### 1.1 현재 구현 확인

**파일**: `backend/services/docling_service.py`

**확인 필요 사항:**
- Docling Serve API 응답에 페이지 번호 정보가 포함되어 있는지?
- JSON 구조에서 각 콘텐츠 블록의 페이지 매핑 정보 존재 여부

**예상되는 API 응답 구조:**
```json
{
  "task_id": "abc123",
  "status": "success",
  "markdown": "# 제목\n\n본문...",
  "metadata": {
    "pages": [
      {
        "page_number": 1,
        "start_char": 0,
        "end_char": 500
      },
      {
        "page_number": 2,
        "start_char": 501,
        "end_char": 1200
      }
    ]
  }
}
```

### 1.2 개선 작업

**`backend/services/docling_service.py` 수정:**

```python
async def convert_document_async(self, file_content, filename, target_type="inbody"):
    # ... 기존 코드 ...

    # 결과 조회 후 페이지 메타데이터 추출
    result = await self.client.get(result_url).json()

    return {
        "markdown": result.get("markdown"),
        "page_metadata": result.get("metadata", {}).get("pages", []),  # ← 추가
        "task_id": task_id,
        # ... 기타 필드 ...
    }
```

**액션 아이템:**
1. `test_docling_serve_api.py` 실행하여 실제 응답 JSON 구조 확인
2. 페이지 정보가 없는 경우 대안 방법 검토 (문서 길이 기반 추정 등)

---

## 2. 데이터베이스 스키마 확장

### 2.1 Document 모델 업데이트

**파일**: `backend/models/document.py`

**추가할 필드:**

```python
from sqlalchemy import Column, Integer, String, Text, DateTime, JSON

class Document(Base):
    __tablename__ = "documents"

    # ... 기존 필드 ...

    # 청크별 페이지 매핑 정보 (JSON 배열)
    chunk_metadata = Column(JSON, nullable=True)
    # 예시 데이터:
    # [
    #   {"chunk_id": 0, "page_number": 1, "start_char": 0, "end_char": 500},
    #   {"chunk_id": 1, "page_number": 1, "start_char": 501, "end_char": 1000},
    #   {"chunk_id": 2, "page_number": 2, "start_char": 1001, "end_char": 1500}
    # ]
```

### 2.2 Alembic 마이그레이션

**명령:**
```bash
cd backend
alembic revision -m "Add chunk_metadata to documents"
alembic upgrade head
```

**마이그레이션 파일 예시:**
```python
def upgrade():
    op.add_column('documents',
        sa.Column('chunk_metadata', sa.JSON(), nullable=True))

def downgrade():
    op.drop_column('documents', 'chunk_metadata')
```

---

## 3. 청킹 서비스: 페이지 매핑 생성

### 3.1 현재 청킹 프로세스 분석

**파일**: `backend/services/chunking_service.py`

**현재 플로우:**
1. Markdown 콘텐츠를 Docling Serve 청킹 API로 전송
2. API가 청크 리스트 반환 (각 청크는 `text`, `num_tokens`, `headings` 포함)
3. 청크 텍스트와 임베딩을 Qdrant에 업로드

**문제점:**
- 청크가 원본 문서의 몇 페이지에서 왔는지 알 수 없음
- Docling Serve 청킹 API가 페이지 정보를 반환하는지 불명확

### 3.2 두 가지 접근 방법

#### 방법 A: Docling Serve API가 페이지 정보를 제공하는 경우

**청킹 API 응답 예시:**
```json
{
  "chunks": [
    {
      "text": "청크 내용...",
      "num_tokens": 150,
      "headings": ["제목1", "소제목"],
      "page_number": 5,           // ← API가 제공
      "start_char": 1000,
      "end_char": 1500
    }
  ]
}
```

**구현:**
- 청킹 API 응답을 그대로 사용
- `chunk_metadata`에 페이지 정보 저장

#### 방법 B: Docling Serve API가 페이지 정보를 제공하지 않는 경우

**대안 1: 문자 위치 기반 매핑**

```python
def map_chunks_to_pages(chunks: List[Dict], page_metadata: List[Dict]) -> List[Dict]:
    """
    청크의 문자 위치를 기반으로 페이지 번호 추정

    Args:
        chunks: 청킹 결과 [{"text": "...", "start_char": 100, "end_char": 500}, ...]
        page_metadata: Docling 파싱 시 저장한 페이지 정보

    Returns:
        페이지 정보가 추가된 청크 리스트
    """
    for chunk in chunks:
        chunk_start = chunk.get('start_char', 0)

        # 청크가 속한 페이지 찾기
        for page in page_metadata:
            if page['start_char'] <= chunk_start <= page['end_char']:
                chunk['page_number'] = page['page_number']
                break

    return chunks
```

**대안 2: 마크다운 구조 기반 추정**

- Docling 파싱 결과의 마크다운에 페이지 구분자가 있는 경우
- 예: `<!-- Page 5 -->` 형태의 주석
- 청킹 시 이 구분자를 기준으로 페이지 추정

### 3.3 추천 접근

1. **우선**: Docling Serve 청킹 API 응답에 페이지 정보가 포함되어 있는지 확인
2. **대안**: 없다면 방법 B-1 (문자 위치 기반 매핑) 사용

**액션 아이템:**
1. Docling Serve 청킹 API 문서 확인 또는 테스트 요청 실행
2. 응답 JSON에 `page_number`, `start_char`, `end_char` 필드 존재 여부 확인

---

## 4. Qdrant 업로드: Payload에 페이지 정보 포함

### 4.1 현재 구현

**파일**: `backend/api/routes/qdrant.py` (lines 213-222)

**현재 메타데이터 구조:**
```python
metadata_list.append({
    "document_id": document_id,
    "filename": document.original_filename,
    "chunk_index": i,
    "num_tokens": chunk.get('num_tokens', 0),
    "headings": chunk.get('headings', [])
})
```

### 4.2 개선된 메타데이터 구조

```python
metadata_list.append({
    "document_id": document_id,
    "filename": document.original_filename,
    "chunk_index": i,
    "page_number": chunk.get('page_number', None),  # ← 추가
    "num_tokens": chunk.get('num_tokens', 0),
    "headings": chunk.get('headings', [])
})
```

### 4.3 Qdrant Collection Schema

**기존 Collection 생성 시 (변경 없음):**
- Vector size: 1024 (BGE-M3 모델)
- Distance metric: Cosine

**Payload는 자유 형식이므로 추가 설정 불필요**

Qdrant는 payload에 임의의 JSON 필드를 저장할 수 있으므로, `page_number` 필드를 추가하는 것만으로 충분합니다.

---

## 5. 검색 API: 페이지 정보 포함

### 5.1 검색 엔드포인트 (Phase 2)

**파일**: `backend/api/routes/qdrant.py` (신규 추가 필요)

```python
@router.post("/search")
async def search_documents(request: QdrantSearchRequest):
    """
    벡터 유사도 검색

    Returns:
        검색 결과 (페이지 정보 포함)
    """
    # 1. 쿼리 임베딩 생성
    query_embedding = await embedding_service.get_embeddings([request.query_text])

    # 2. Qdrant 검색
    search_results = await qdrant_service.search_vectors(
        collection_name=request.collection_name,
        query_vector=query_embedding[0],
        top_k=request.top_k,
        score_threshold=request.score_threshold
    )

    # 3. 결과 변환 (페이지 정보 포함)
    results = []
    for hit in search_results:
        payload = hit.payload

        # 페이지 정보 포맷팅
        page_info = ""
        if payload.get('page_number'):
            page_info = f" {payload['page_number']}페이지"

        results.append({
            "id": hit.id,
            "score": hit.score,
            "text": payload.get('text', ''),
            "source": f"{payload.get('filename', '알 수 없음')}{page_info}",  # ← 핵심
            "metadata": payload
        })

    return {"results": results}
```

### 5.2 Pydantic Schema

**파일**: `backend/models/schemas.py`

```python
class QdrantSearchRequest(BaseModel):
    collection_name: str
    query_text: str
    top_k: int = 5
    score_threshold: float = 0.0

class QdrantSearchResultItem(BaseModel):
    id: str
    score: float
    text: str
    source: str  # "계약서.pdf 5페이지"
    metadata: Dict[str, Any]

class QdrantSearchResponse(BaseModel):
    results: List[QdrantSearchResultItem]
```

---

## 6. 프론트엔드: 검색 결과 표시

### 6.1 챗봇 UI 개선 (Phase 2)

**파일**: `app/qdrant/page.tsx` 또는 별도 챗봇 페이지

**현재 표시 (가정):**
```typescript
// Before
<div className="references">
  참고: 문서1, 문서3, 문서5
</div>
```

**개선된 표시:**
```typescript
// After
interface SearchResult {
  source: string;  // "계약서.pdf 5페이지"
  score: number;
  text: string;
}

function ChatbotResponse({ results }: { results: SearchResult[] }) {
  return (
    <div className="references">
      <span className="text-sm text-muted-foreground">참고: </span>
      {results.map((r, i) => (
        <span key={i} className="text-sm">
          {r.source}
          {i < results.length - 1 && ", "}
        </span>
      ))}
    </div>
  );
}

// 사용 예시
<ChatbotResponse
  results={[
    { source: "계약서.pdf 5페이지", score: 0.92, text: "..." },
    { source: "보고서.docx 12페이지", score: 0.88, text: "..." }
  ]}
/>
```

---

## 7. 구현 우선순위

### Phase 1: 페이지 메타데이터 수집 및 저장

**목표**: Docling 파싱부터 Qdrant 업로드까지 페이지 정보 추적

1. **Docling API 응답 분석**
   - `test_docling_serve_api.py` 실행하여 페이지 메타데이터 확인
   - 청킹 API 응답 구조 분석

2. **데이터베이스 스키마 확장**
   - `Document` 모델에 `chunk_metadata` JSON 필드 추가
   - Alembic 마이그레이션 실행

3. **파싱 서비스 개선**
   - `docling_service.py`: 페이지 메타데이터 추출 및 저장

4. **청킹 서비스 개선**
   - `chunking_service.py`: 청크별 페이지 번호 매핑 로직 추가
   - 페이지 정보가 없는 경우 문자 위치 기반 추정

5. **Qdrant 업로드 개선**
   - `qdrant.py`: Payload에 `page_number` 필드 추가
   - 기존 Collection에 재업로드 (또는 새 Collection 생성)

### Phase 2: 검색 API 및 UI 구현

**목표**: 검색 결과에서 페이지 정보 표시

1. **검색 엔드포인트 개발**
   - `POST /api/qdrant/search` 구현
   - 결과 변환 로직 (청크 → 페이지 번호)

2. **챗봇 UI 개발**
   - 검색 테스트 섹션 구현 (`app/qdrant/page.tsx`)
   - "문서명 X페이지" 형식으로 표시

3. **통합 테스트**
   - End-to-end 플로우 검증
   - 여러 문서 타입 테스트 (PDF, DOCX, PPTX)

### Phase 3: 고도화

**목표**: 사용자 경험 개선

1. **원본 문서 뷰어 연동**
   - 페이지 번호 클릭 시 원본 PDF 해당 페이지로 이동
   - PDF.js 또는 유사 라이브러리 사용

2. **페이지 범위 표시**
   - 청크가 여러 페이지에 걸친 경우: "계약서.pdf 5-6페이지"
   - 메타데이터에 `page_start`, `page_end` 저장

3. **정확도 개선**
   - Docling API가 정확한 페이지 정보를 제공하지 않는 경우
   - 사용자 피드백 기반 수정 기능

---

## 8. 핵심 기술 결정 사항

### 8.1 페이지 번호 저장 위치

**선택: Qdrant Payload + SQLite DB**

| 저장 위치 | 장점 | 단점 |
|---------|------|------|
| Qdrant Payload | 검색 결과에서 바로 접근 가능 | Collection 재생성 시 재업로드 필요 |
| SQLite DB | 영구 저장, 수정 용이 | 검색 시 추가 조인 필요 |
| 둘 다 사용 | 최상의 성능 + 영구성 | 데이터 중복 |

**결정**: 둘 다 사용
- SQLite: `chunk_metadata` JSON 필드로 영구 저장
- Qdrant: `page_number` payload로 빠른 검색 결과 표시

### 8.2 페이지 정보가 없는 경우 처리

**전략**: 폴백 메커니즘

1. **우선순위 1**: Docling 청킹 API 응답의 `page_number` 필드 사용
2. **우선순위 2**: 문자 위치 기반 매핑 (`start_char` → 페이지 추정)
3. **우선순위 3**: 페이지 정보 없음 표시 ("계약서.pdf (페이지 불명)")

### 8.3 청킹 전략

**현재**: Docling Serve 원격 청킹 서버 사용
- `max_tokens`: 500 (기본값)
- `chunker`: "hybrid"
- `tokenizer`: "sentence-transformers/all-MiniLM-L6-v2"

**페이지 경계 고려 여부:**
- 청크가 페이지 경계를 넘지 않도록 강제하지 않음 (의미적 일관성 우선)
- 대신 `page_start`와 `page_end`를 모두 저장하여 "5-6페이지" 형식 지원 (Phase 3)

---

## 9. 잠재적 이슈 및 해결 방안

### 이슈 1: Docling API가 페이지 정보를 제공하지 않음

**해결 방안:**
- 마크다운 길이 기반 페이지 추정 (평균 페이지당 문자 수 계산)
- PDF 원본 파일을 PyPDF2 등으로 직접 파싱하여 페이지 매핑 생성

**테스트 필요:**
- `test_docling_serve_api.py` 결과 확인

### 이슈 2: DOCX/PPTX는 페이지 개념이 다름

**해결 방안:**
- DOCX: 슬라이드 번호 대신 "섹션" 또는 "단락 번호" 사용
- PPTX: 슬라이드 번호를 페이지 번호로 간주
- 메타데이터에 `page_type` 필드 추가 ("pdf_page", "docx_section", "pptx_slide")

### 이슈 3: 청크가 여러 페이지에 걸침

**해결 방안:**
- 메타데이터에 `page_start`, `page_end` 저장
- 표시: "계약서.pdf 5-6페이지"

**Payload 구조 예시:**
```json
{
  "page_number": 5,         // 청크 시작 페이지 (하위 호환성)
  "page_start": 5,          // 청크 시작 페이지
  "page_end": 6             // 청크 종료 페이지
}
```

### 이슈 4: 기존 업로드된 벡터에 페이지 정보 없음

**해결 방안:**
- 새로운 Collection 생성하여 페이지 정보 포함 재업로드
- 또는 Qdrant의 `update_vectors` API로 기존 payload 업데이트

---

## 10. 테스트 계획

### 10.1 단위 테스트

**파일**: `backend/tests/test_page_mapping.py` (신규 생성)

```python
def test_map_chunks_to_pages():
    """청크-페이지 매핑 로직 테스트"""
    chunks = [
        {"text": "...", "start_char": 100, "end_char": 500},
        {"text": "...", "start_char": 600, "end_char": 1200}
    ]
    page_metadata = [
        {"page_number": 1, "start_char": 0, "end_char": 500},
        {"page_number": 2, "start_char": 501, "end_char": 1500}
    ]

    result = map_chunks_to_pages(chunks, page_metadata)

    assert result[0]["page_number"] == 1
    assert result[1]["page_number"] == 2
```

### 10.2 통합 테스트

**시나리오:**
1. PDF 문서 업로드 및 파싱
2. 청킹 서비스 호출 (페이지 정보 확인)
3. Qdrant 업로드
4. 검색 API 호출
5. 결과에서 `source` 필드 검증: "문서명.pdf X페이지"

### 10.3 End-to-End 테스트

**테스트 문서:**
- 10페이지 PDF 문서
- 5슬라이드 PPTX 문서
- 여러 섹션이 있는 DOCX 문서

**검증 항목:**
- 각 청크의 페이지 번호가 올바른지
- 검색 결과 표시가 정확한지
- 페이지 경계를 넘는 청크 처리

---

## 11. 다음 단계

### 즉시 실행 가능 (Phase 1)

1. **Docling API 응답 분석**
   ```bash
   cd backend
   python test_docling_serve_api.py
   ```
   - 결과 JSON에서 `metadata`, `pages`, `page_number` 필드 확인

2. **청킹 API 테스트**
   - Docling Serve 청킹 엔드포인트 직접 호출
   - 응답 구조 문서화

3. **데이터베이스 마이그레이션**
   ```bash
   alembic revision -m "Add chunk_metadata to documents"
   alembic upgrade head
   ```

### 중기 작업 (Phase 1 완료)

1. `chunking_service.py` 페이지 매핑 로직 구현
2. `qdrant.py` 업로드 시 페이지 정보 포함
3. 테스트 문서로 전체 플로우 검증

### 장기 작업 (Phase 2-3)

1. 검색 API 개발
2. 챗봇 UI 개선
3. 원본 문서 뷰어 연동

---

## 12. 참고 자료

**관련 파일:**
- `backend/api/routes/qdrant.py` - Qdrant 업로드 로직
- `backend/services/chunking_service.py` - 청킹 서비스
- `backend/services/docling_service.py` - 문서 파싱 서비스
- `backend/models/document.py` - 문서 모델
- `docs/qdrant-integration-design.md` - Qdrant 통합 설계 문서

**외부 문서:**
- [Qdrant Payload Documentation](https://qdrant.tech/documentation/concepts/payload/)
- [Qdrant Search API](https://qdrant.tech/documentation/concepts/search/)
- Docling Serve API 문서 (내부 서버: `http://kca-ai.kro.kr:8007`)

**구현 순서:**
1. Phase 1 완료 후 이 문서 업데이트
2. 실제 구현 결과 반영
3. 발견된 이슈 및 해결 방법 추가
