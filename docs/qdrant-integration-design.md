# Qdrant Vector DB 임베딩 기능 설계

## 아키텍처 개요

```
파싱된 Markdown (DB)
  → 원격 Docling Serve 청킹 서버
  → 원격 BGE-M3 임베딩 서버
  → Qdrant Vector DB
```

**핵심 요구사항:**
- 원격 Qdrant Vector DB에 임베딩 저장
- 이미 파싱된 markdown 파일 사용 (Dify 연동과 유사)
- **청킹도 원격 Docling Serve 서버 사용**
- 원격 BGE-M3 Korean 임베딩 모델 사용
- 설정은 .env 파일에서 관리

---

## 1. Backend API Endpoints

### 1.1 Collection 관리

#### GET `/api/qdrant/collections`
Collection 목록 조회

**Response:**
```json
{
  "collections": [
    {
      "name": "documents",
      "vectors_count": 15234,
      "points_count": 1523,
      "vector_size": 1024,
      "distance": "Cosine"
    }
  ]
}
```

#### POST `/api/qdrant/collections`
Collection 생성

**Request:**
```json
{
  "collection_name": "my_documents",
  "vector_size": 1024,
  "distance": "Cosine"
}
```

**Response:**
```json
{
  "success": true,
  "collection_name": "my_documents",
  "message": "Collection created successfully"
}
```

#### GET `/api/qdrant/collections/{name}`
Collection 정보 조회

**Response:**
```json
{
  "name": "documents",
  "vectors_count": 15234,
  "points_count": 1523,
  "vector_size": 1024,
  "distance": "Cosine",
  "status": "green"
}
```

---

### 1.2 문서 업로드 (핵심 기능)

#### POST `/api/qdrant/upload`
문서 임베딩 및 업로드

**Request:**
```json
{
  "collection_name": "documents",
  "document_ids": [1, 2, 3, 4],
  "chunk_size": 500,
  "chunk_overlap": 50,
  "metadata_fields": ["filename", "created_at"]
}
```

**Response:**
```json
{
  "total": 4,
  "success_count": 3,
  "failure_count": 1,
  "results": [
    {
      "document_id": 1,
      "filename": "report.pdf",
      "success": true,
      "chunk_count": 15,
      "vector_ids": ["uuid1", "uuid2", "..."]
    },
    {
      "document_id": 2,
      "filename": "manual.pdf",
      "success": false,
      "error": "임베딩 서버 연결 실패"
    }
  ]
}
```

**처리 플로우:**
1. DB에서 document.md_content 조회
2. Markdown을 원격 Docling Serve 서버로 전송하여 청킹
3. 각 청크를 BGE-M3 임베딩 서버로 전송
4. 임베딩 벡터 + 메타데이터를 Qdrant에 upsert
5. 업로드 이력 DB에 저장

---

### 1.3 검색 기능

#### POST `/api/qdrant/search`
유사도 검색

**Request:**
```json
{
  "collection_name": "documents",
  "query_text": "계약서 작성 방법",
  "top_k": 5,
  "score_threshold": 0.7,
  "filter": {
    "must": [
      {"key": "document_type", "match": "contract"}
    ]
  }
}
```

**Response:**
```json
{
  "results": [
    {
      "id": "uuid",
      "score": 0.92,
      "text": "청크 내용...",
      "metadata": {
        "document_id": 5,
        "filename": "contract_guide.pdf",
        "chunk_index": 3
      }
    }
  ]
}
```

---

### 1.4 업로드 이력

#### GET `/api/qdrant/upload-history`
업로드 이력 조회

**Query Parameters:**
- `skip`: 건너뛸 개수
- `limit`: 가져올 최대 개수
- `document_id`: 문서 ID 필터 (선택적)
- `collection_name`: Collection 필터 (선택적)

**Response:**
```json
[
  {
    "id": 1,
    "document_id": 5,
    "original_filename": "report.pdf",
    "collection_name": "documents",
    "chunk_count": 15,
    "upload_status": "success",
    "uploaded_at": "2025-11-07T10:30:00Z"
  }
]
```

---

## 2. 환경 변수 설정 (.env)

```env
# Qdrant 설정
QDRANT_URL=http://kca-ai.kro.kr:6333
QDRANT_API_KEY=optional_key

# Docling Serve 청킹 서버 설정
DOCLING_CHUNKING_URL=http://kca-ai.kro.kr:8007

# BGE-M3 임베딩 서버 설정
EMBEDDING_URL=http://kca-ai.kro.kr:8080
EMBEDDING_MODEL=bge-m3-korean
EMBEDDING_DIMENSION=1024

# 기본 청킹 설정
DEFAULT_CHUNK_SIZE=500
DEFAULT_CHUNK_OVERLAP=50

# 기본 Collection
DEFAULT_COLLECTION_NAME=documents
```

---

## 3. UI 화면 구성 (`/app/qdrant/page.tsx`)

### 3.1 Collection 관리 섹션
```
┌─────────────────────────────────────────────────┐
│ Collection 관리                  [목록 새로고침] │
├─────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────┐ │
│ │ Name        Vectors   Points   Distance    │ │
│ │ documents   15,234    1,523    Cosine      │ │
│ │ test_data   1,000     100      Cosine      │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ [새 Collection 생성]                            │
│   Collection 이름: [___________]                │
│   Vector 크기: 1024 (BGE-M3 고정)               │
│   Distance: [Cosine ▼]                          │
│   [생성]                                        │
└─────────────────────────────────────────────────┘
```

### 3.2 문서 선택 및 업로드 섹션
```
┌─────────────────────────────────────────────────┐
│ 파싱된 문서 목록                [검색: ______🔍] │
├─────────────────────────────────────────────────┤
│ ☑ 전체선택  선택: 3건                           │
│                                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │☑ report.pdf      2025-11-01  500KB  계약... │ │
│ │☐ manual.pdf      2025-11-02  1.2MB  사용... │ │
│ │☑ guide.pdf       2025-11-03  800KB  가이... │ │
│ │☑ terms.pdf       2025-11-04  300KB  약관... │ │
│ └─────────────────────────────────────────────┘ │
│ [◀ 이전] 1 2 3 4 5 [다음 ▶]                    │
│                                                 │
│ 청킹 설정:                                      │
│   Chunk Size: [500] 토큰                        │
│   Chunk Overlap: [50] 토큰                      │
│   대상 Collection: [documents ▼]                │
│                                                 │
│ [선택한 문서 업로드 (3건)]                      │
└─────────────────────────────────────────────────┘
```

### 3.3 업로드 결과 섹션
```
┌─────────────────────────────────────────────────┐
│ 업로드 결과                                      │
├─────────────────────────────────────────────────┤
│ ✓ 성공: 3건 | ✗ 실패: 0건 | 총 청크: 45개      │
│                                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │ 파일명         상태    청크   벡터ID        │ │
│ │ report.pdf    ✓성공    15    uuid-xxx...   │ │
│ │ guide.pdf     ✓성공    18    uuid-yyy...   │ │
│ │ terms.pdf     ✓성공    12    uuid-zzz...   │ │
│ └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

### 3.4 검색 테스트 섹션
```
┌─────────────────────────────────────────────────┐
│ 검색 테스트                                      │
├─────────────────────────────────────────────────┤
│ 검색어: [계약서 작성 방법__________________] [검색]│
│ Collection: [documents ▼]  Top K: [5▼]          │
│                                                 │
│ 검색 결과:                                      │
│ ┌─────────────────────────────────────────────┐ │
│ │ 1. 유사도: 0.92 | report.pdf (청크 3)       │ │
│ │    "계약서 작성 시에는 다음 사항을..."       │ │
│ │                                             │ │
│ │ 2. 유사도: 0.87 | guide.pdf (청크 7)        │ │
│ │    "표준 계약서 양식을 활용하여..."          │ │
│ └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

---

## 4. 데이터베이스 스키마

### QdrantUploadHistory 테이블
```sql
CREATE TABLE qdrant_upload_history (
    id INTEGER PRIMARY KEY,
    document_id INTEGER NOT NULL,
    collection_name VARCHAR NOT NULL,
    chunk_count INTEGER,
    vector_ids_json TEXT,
    upload_status VARCHAR,
    error_message TEXT,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    qdrant_url VARCHAR,
    FOREIGN KEY (document_id) REFERENCES documents(id)
);
```

---

## 5. 임베딩 서버 API 인터페이스

BGE-M3 서버의 API 스펙 (확인 필요):

### 옵션 A: 표준 형식
```
POST {EMBEDDING_URL}/embeddings
Content-Type: application/json

{
  "texts": ["텍스트1", "텍스트2"],
  "model": "bge-m3-korean"
}

Response:
{
  "embeddings": [[...1024차원...], [...]],
  "model": "bge-m3-korean"
}
```

### 옵션 B: OpenAI 호환 형식
```
POST {EMBEDDING_URL}/v1/embeddings

{
  "input": ["텍스트1", "텍스트2"],
  "model": "bge-m3"
}

Response:
{
  "data": [
    {"embedding": [...], "index": 0},
    {"embedding": [...], "index": 1}
  ]
}
```

---

## 6. 주요 Python 라이브러리

```python
# requirements.txt에 추가
qdrant-client>=1.7.0
httpx>=0.25.0
# 청킹은 원격 Docling Serve 서버 사용
```

---

## 7. Backend 파일 구조

```
backend/
├── api/routes/
│   └── qdrant.py              # Qdrant API 라우트
├── services/
│   ├── qdrant_service.py      # Qdrant 통신 서비스
│   ├── chunking_service.py    # Docling Serve 청킹 서비스
│   ├── embedding_service.py   # 임베딩 서버 통신
│   └── qdrant_history_crud.py # 업로드 이력 CRUD
├── models/
│   ├── schemas.py             # Pydantic 스키마 (업데이트)
│   └── qdrant_upload_history.py # SQLAlchemy 모델
└── config/settings.py         # 환경 변수 로드
```

---

## 8. Pydantic Schemas

```python
# Collection 관련
class QdrantCollectionInfo(BaseModel):
    name: str
    vectors_count: int
    points_count: int
    vector_size: int
    distance: str

class QdrantCollectionCreateRequest(BaseModel):
    collection_name: str
    vector_size: int = 1024
    distance: str = "Cosine"

# 업로드 관련
class QdrantUploadRequest(BaseModel):
    collection_name: str
    document_ids: List[int]
    chunk_size: int = 500
    chunk_overlap: int = 50
    metadata_fields: List[str] = ["filename", "created_at"]

class QdrantUploadResult(BaseModel):
    document_id: int
    filename: str
    success: bool
    chunk_count: int = 0
    vector_ids: List[str] = []
    error: Optional[str] = None

class QdrantUploadResponse(BaseModel):
    total: int
    success_count: int
    failure_count: int
    results: List[QdrantUploadResult]

# 검색 관련
class QdrantSearchRequest(BaseModel):
    collection_name: str
    query_text: str
    top_k: int = 5
    score_threshold: float = 0.0
    filter: Optional[dict] = None

class QdrantSearchResult(BaseModel):
    id: str
    score: float
    text: str
    metadata: dict

class QdrantSearchResponse(BaseModel):
    results: List[QdrantSearchResult]

# 업로드 이력
class QdrantUploadHistoryResponse(BaseModel):
    id: int
    document_id: int
    original_filename: str
    collection_name: str
    chunk_count: int
    upload_status: str
    error_message: Optional[str]
    uploaded_at: str
```

---

## 9. 구현 우선순위

### Phase 1: 기본 기능
1. Collection 목록 조회
2. 문서 업로드 (청킹 + 임베딩 + Qdrant 저장)
3. 업로드 이력 조회
4. 기본 UI 구현

### Phase 2: 고급 기능
1. Collection 생성/삭제
2. 검색 기능
3. 필터링 및 메타데이터 관리
4. 배치 업로드 최적화

### Phase 3: 개선 사항
1. 청킹 전략 고도화 (문서 타입별)
2. 오류 처리 및 재시도 로직
3. 진행률 표시 (웹소켓)
4. 검색 결과 하이라이팅

---

## 10. 참고 자료

- [Qdrant API Reference](https://api.qdrant.tech/api-reference)
- [Qdrant Python Client Docs](https://github.com/qdrant/qdrant-client)
- [BGE-M3 Model](https://huggingface.co/BAAI/bge-m3)
- [LangChain Text Splitters](https://python.langchain.com/docs/modules/data_connection/document_transformers/)
