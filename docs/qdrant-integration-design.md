# Qdrant Vector DB 임베딩 기능 설계

## 구현 현황 (2025-11-10 기준)

| 구성 요소 | 구현 상태 | 비고 |
|---------|---------|------|
| 프론트엔드 UI | 완료 | Collection 관리, 문서 선택/업로드, 결과 표시 |
| Backend API | 미구현 | 모든 엔드포인트 미구현 |
| DB 모델 | 미구현 | QdrantUploadHistory 테이블 필요 |
| 서비스 레이어 | 미구현 | Qdrant, 청킹, 임베딩 서비스 모두 필요 |
| 환경 변수 | 미구현 | .env에 Qdrant/임베딩 설정 추가 필요 |

**다음 단계**: Phase 1 백엔드 기본 기능 구현 (섹션 9 참조)

---

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
- **청킹도 원격 Docling Serve 서버 사용** (API 스펙 확인 필요)
- 원격 BGE-M3 Korean 임베딩 모델 사용 (API 스펙 확인 필요)
- 설정은 .env 파일에서 관리

**구현 전 확인 사항:**
1. Docling Serve 청킹 API 엔드포인트 및 스펙 확인
2. BGE-M3 임베딩 서버 API 엔드포인트 및 스펙 확인
3. Qdrant 서버 연결 테스트

---

## 1. Backend API Endpoints

**구현 상태: 모든 백엔드 API 미구현**

### 1.1 Collection 관리 (미구현)

#### GET `/api/qdrant/collections`
Collection 목록 조회

**프론트엔드 사용처**: `app/qdrant/page.tsx:114` (fetchCollections)

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

**프론트엔드 사용처**: `app/qdrant/page.tsx:138` (createCollection)

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
Collection 정보 조회 (Phase 2)

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

### 1.2 문서 업로드 (미구현 - 핵심 기능)

#### POST `/api/qdrant/upload`
문서 임베딩 및 업로드

**프론트엔드 사용처**: `app/qdrant/page.tsx:179` (uploadDocuments)

**Request:**
```json
{
  "collection_name": "documents",
  "document_ids": [1, 2, 3, 4],
  "chunk_size": 500,
  "chunk_overlap": 50
}
```

**참고**: 프론트엔드에서 `metadata_fields` 파라미터는 전송하지 않음

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

### 1.3 검색 기능 (Phase 2로 연기)

#### POST `/api/qdrant/search`
유사도 검색

**프론트엔드 사용처**: 미구현

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

### 1.4 업로드 이력 (Phase 2로 연기)

#### GET `/api/qdrant/upload-history`
업로드 이력 조회

**프론트엔드 사용처**: 미구현

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

# Docling Serve 청킹 서버 설정 (API 스펙 확인 필요)
DOCLING_CHUNKING_URL=http://kca-ai.kro.kr:8007

# BGE-M3 임베딩 서버 설정
EMBEDDING_URL=http://kca-ai.kro.kr:8083
EMBEDDING_MODEL=bge-m3-korean
EMBEDDING_DIMENSION=1024

# 기본 청킹 설정
DEFAULT_CHUNK_SIZE=500
DEFAULT_CHUNK_OVERLAP=50

# 기본 Collection
DEFAULT_COLLECTION_NAME=documents
```

---

## 3. UI 화면 구성

**파일**: `app/qdrant/page.tsx`
**구현 상태**: 프론트엔드 완료 (백엔드 미구현)
**주요 기술**: React 19, Next.js 16, shadcn/ui, Tailwind CSS

### 3.1 Collection 설정 섹션 (구현됨)
- **대상 Collection 선택**: Dropdown으로 기존 Collection 선택
  - 표시 형식: `{name} ({points_count} points, {vectors_count} vectors)`
- **동작 버튼**:
  - 새로고침: Collection 목록 다시 불러오기
  - 생성: Dialog로 새 Collection 생성
- **Collection 생성 Dialog**:
  - Collection 이름 입력
  - Vector 크기: 1024 (BGE-M3 고정, disabled)
  - Distance Metric: Cosine/Euclidean/Dot 선택
- **청킹 설정**:
  - Chunk Size: 기본값 500 토큰
  - Chunk Overlap: 기본값 50 토큰

### 3.2 문서 선택 및 업로드 섹션 (구현됨)
- **헤더**:
  - 총 문서 수와 선택된 문서 수 표시
  - 우측에 "Qdrant에 업로드 (N)" 버튼
  - Collection 미선택 시 경고 Alert 표시
- **선택된 문서 표시 영역**:
  - Badge 형태로 파일명 표시
  - 각 Badge에 X 버튼으로 개별 해제 가능
  - ScrollArea로 최대 높이 제한
- **검색 기능**:
  - 파일명으로 검색
  - Enter 키로 검색 실행
  - 검색어 초기화 버튼
- **문서 목록 테이블**:
  - Checkbox로 전체 선택/개별 선택
  - 컬럼: 선택, 파일명, 크기(KB), 생성일
  - 선택된 행은 배경색 변경
  - ScrollArea로 최대 높이 420px 제한
- **페이지네이션**:
  - 페이지당 20개 문서
  - 이전/다음 버튼
  - 최대 5개 페이지 번호 표시
  - 현재 페이지 하이라이트

### 3.3 업로드 결과 섹션 (구현됨)
- **헤더**:
  - 성공/실패 상태에 따른 아이콘 표시 (CheckCircle2/XCircle/Upload)
  - 통계: 총 문서 수, 성공/실패 건수, 총 청크 수
- **결과 목록**:
  - 각 문서별 카드 형태 표시
  - 성공: 녹색 체크 아이콘, 청크 수, 벡터 ID 개수
  - 실패: 빨간색 X 아이콘, 에러 메시지
  - ScrollArea로 최대 높이 300px 제한

### 3.4 검색 테스트 섹션 (미구현)
검색 기능은 Phase 2로 연기

---

## 4. 데이터베이스 스키마

**구현 상태: 미생성**

### QdrantUploadHistory 테이블
**파일**: `backend/models/qdrant_upload_history.py` (생성 필요)

```python
# SQLAlchemy 모델 예시
class QdrantUploadHistory(Base):
    __tablename__ = "qdrant_upload_history"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False)
    collection_name = Column(String, nullable=False)
    chunk_count = Column(Integer)
    vector_ids_json = Column(Text)  # JSON array of vector IDs
    upload_status = Column(String)  # "success" or "failed"
    error_message = Column(Text, nullable=True)
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    qdrant_url = Column(String)

    # Relationship
    document = relationship("Document", back_populates="qdrant_uploads")
```

**SQL 스키마 (참고용)**:
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

**Alembic 마이그레이션**: 생성 필요

---

## 5. 임베딩 서버 API 인터페이스

**현황**: `http://kca-ai.kro.kr:8080` BGE-M3 서버의 정확한 API 스펙 확인 필요

백엔드 구현 전에 다음을 확인해야 합니다:
1. 엔드포인트 경로 (예: `/embeddings`, `/v1/embeddings`)
2. 요청/응답 JSON 스키마
3. 배치 처리 지원 여부
4. Rate limiting 정책

**예상되는 API 형식**:

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

**구현 상태**: `backend/requirements.txt`에 추가 필요

```python
# requirements.txt에 추가할 패키지
qdrant-client>=1.7.0    # Qdrant Python 클라이언트
# httpx>=0.25.0          # 이미 설치됨 (Docling, Dify 연동에 사용 중)
```

**참고**:
- `httpx`는 이미 `backend/requirements.txt`에 포함되어 있음
- 청킹은 원격 Docling Serve 서버 사용 (별도 라이브러리 불필요)
- 임베딩은 원격 BGE-M3 서버 사용 (별도 라이브러리 불필요)

---

## 7. Backend 파일 구조

**구현 상태: 모든 파일 미생성**

생성해야 할 파일 목록:

```
backend/
├── api/routes/
│   └── qdrant.py                    # Qdrant API 라우트 (미생성)
├── services/
│   ├── qdrant_service.py            # Qdrant 통신 서비스 (미생성)
│   ├── chunking_service.py          # Docling Serve 청킹 서비스 (미생성)
│   ├── embedding_service.py         # 임베딩 서버 통신 (미생성)
│   └── qdrant_history_crud.py       # 업로드 이력 CRUD (미생성)
├── models/
│   ├── schemas.py                   # Pydantic 스키마 (업데이트 필요)
│   └── qdrant_upload_history.py     # SQLAlchemy 모델 (미생성)
└── config/settings.py               # 환경 변수 로드 (업데이트 필요)
```

**파일별 책임:**
- `qdrant.py`: FastAPI 라우터, 모든 `/api/qdrant/*` 엔드포인트 정의
- `qdrant_service.py`: Qdrant 클라이언트 래퍼, collection 관리 및 vector upsert
- `chunking_service.py`: Docling Serve API 호출하여 markdown 청킹
- `embedding_service.py`: BGE-M3 임베딩 서버 API 호출
- `qdrant_history_crud.py`: 업로드 이력 DB CRUD 작업
- `qdrant_upload_history.py`: SQLAlchemy ORM 모델 정의

---

## 8. Pydantic Schemas

**구현 상태**: `backend/models/schemas.py`에 추가 필요

**Phase 1에 필요한 스키마**:

```python
from pydantic import BaseModel
from typing import List, Optional

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
    distance: str = "Cosine"  # Cosine, Euclidean, Dot

class QdrantCollectionResponse(BaseModel):
    success: bool
    collection_name: str
    message: str

class QdrantCollectionsResponse(BaseModel):
    collections: List[QdrantCollectionInfo]

# 업로드 관련
class QdrantUploadRequest(BaseModel):
    collection_name: str
    document_ids: List[int]
    chunk_size: int = 500
    chunk_overlap: int = 50
    # metadata_fields는 프론트엔드에서 전송하지 않음

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
```

**Phase 2에 필요한 스키마** (검색, 업로드 이력):

```python
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

### Phase 1: 백엔드 기본 기능 (프론트엔드 완료)
**목표**: 프론트엔드와 연동하여 기본 업로드 플로우 완성

1. **환경 변수 설정** (`backend/config/settings.py`)
   - Qdrant URL, 임베딩 서버 URL, 청킹 설정 추가
   - `backend/.env.example` 업데이트

2. **데이터베이스 모델** (`backend/models/qdrant_upload_history.py`)
   - QdrantUploadHistory 테이블 생성
   - Alembic 마이그레이션

3. **서비스 레이어 구현**:
   - `qdrant_service.py`: Collection 목록 조회, Collection 생성
   - `chunking_service.py`: Docling Serve 청킹 API 연동
   - `embedding_service.py`: BGE-M3 임베딩 서버 연동
   - `qdrant_history_crud.py`: 업로드 이력 CRUD

4. **API 라우트** (`backend/api/routes/qdrant.py`):
   - GET `/api/qdrant/collections`
   - POST `/api/qdrant/collections`
   - POST `/api/qdrant/upload`

5. **의존성 설치**:
   - `qdrant-client` 추가
   - `requirements.txt` 업데이트

### Phase 2: 고급 기능
1. Collection 삭제 API
2. 검색 기능 (프론트엔드 + 백엔드)
3. 업로드 이력 조회 API
4. 필터링 및 메타데이터 관리
5. 배치 업로드 최적화

### Phase 3: 개선 사항
1. 청킹 전략 고도화 (문서 타입별)
2. 오류 처리 및 재시도 로직
3. 진행률 표시 (웹소켓 또는 SSE)
4. 검색 결과 하이라이팅
5. 업로드 취소 기능

---

## 10. 참고 자료

**구현된 코드**:
- 프론트엔드 UI: `app/qdrant/page.tsx` (완료)
- 기존 Dify 연동 참고: `backend/services/dify_service.py`, `backend/api/routes/dify.py`
- 문서 모델 참고: `backend/models/document.py`

**외부 문서**:
- [Qdrant API Reference](https://api.qdrant.tech/api-reference)
- [Qdrant Python Client Docs](https://github.com/qdrant/qdrant-client)
- [BGE-M3 Model](https://huggingface.co/BAAI/bge-m3)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)

**내부 서버**:
- Qdrant: `http://kca-ai.kro.kr:6333`
- Docling Serve (청킹): `http://kca-ai.kro.kr:8007`
- BGE-M3 (임베딩): `http://kca-ai.kro.kr:8080`
