# Excel 업로드 시 SQLite 문서 기록 통합 구현 계획

> **문서 최종 업데이트**: 2025-12-12
> **상태**: 구현 대기 (현행화 완료)

---

## 1. 문제 정의

### 1.1 현재 상황
```
일반 문서 업로드 경로:
PDF/DOCX → Document 테이블 저장 → Qdrant 업로드 → QdrantUploadHistory 기록

엑셀 업로드 경로:
Excel → (SQLite 저장 없음) → Qdrant 직접 업로드 → (이력 없음)
```

### 1.2 문제점
- 프롬프트 자동생성 시 문서 선택 UI에 엑셀 컬렉션 문서가 표시되지 않음
- `document_selector_service.get_documents_for_collection()`이 `Document JOIN QdrantUploadHistory`로 조회하기 때문
- 엑셀 컬렉션은 두 테이블 모두에 레코드가 없음

### 1.3 영향 범위
- `/api/prompts/documents/{collection_name}` 엔드포인트
- 프롬프트 자동생성 모달 (`app/collections/components/PromptGeneratorModal.tsx`)
- 청크 기반 샘플링 기능 (`backend/services/document_selector_service.py`)

---

## 2. 현재 구현 상태 분석 (2025-12-12 업데이트)

### 2.1 Document 모델 현재 구조

```python
# backend/models/document.py (실제 코드 확인 결과)
class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    task_id = Column(String(100), unique=True, index=True, nullable=False)
    original_filename = Column(String(255), nullable=False)
    file_size = Column(Integer, nullable=True)
    file_type = Column(String(20), nullable=True)  # pdf, docx, pptx
    status = Column(String(20), default="success", nullable=False)
    processing_time = Column(Float, nullable=True)
    parse_options = Column(JSON, nullable=True)
    error_message = Column(Text, nullable=True)
    content_length = Column(Integer, nullable=True)
    content_preview = Column(String(500), nullable=True)
    md_content = Column(Text, nullable=False)

    # 카테고리 컬럼 (신규 추가됨)
    category = Column(String(100), nullable=True, index=True)

    download_count = Column(Integer, default=0, nullable=False)
    last_accessed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
```

**주요 변경사항**:
- `category` 컬럼이 추가됨 (마이그레이션 파일: `backend/migrations/add_category_column.py`)
- `source_type`, `excel_metadata` 필드는 아직 미추가

### 2.2 엑셀 업로드 API 현재 구조

```python
# backend/api/routes/qdrant.py (line 932-1084)
@router.post("/excel/embed", response_model=DynamicEmbeddingResponse)
async def embed_excel_dynamic(
    request: DynamicEmbeddingRequest,
    current_user: User = Depends(get_current_active_user)
):
    # 현재 상태:
    # - db: Session 의존성 없음 → 추가 필요
    # - SQLite Document/History 기록 없음 → 추가 필요
    # - vector_ids 수집 없음 → 추가 필요
```

### 2.3 컬렉션 관리 UI 현재 상태

**`app/collections/page.tsx`** 주요 기능:
- 컬렉션 목록 조회 및 필터링 (이름, 키워드, 한글명 검색)
- 빠른 필터 (추천, 문서있음, 비어있음)
- 정렬 옵션 (이름순, 벡터수, 문서수, 최신순)
- 컬렉션 생성/설정/삭제 모달
- **프롬프트 자동생성 모달** (`PromptGeneratorModal.tsx`)

**`app/upload/page.tsx`** 주요 기능:
- 문서 목록 조회 (카테고리 필터 지원)
- Qdrant/Dify 업로드 탭
- 카테고리 이동 기능 (`handleMoveCategory`)
- 문서 선택기 (`DocumentSelector.tsx`)

### 2.4 문서 선택 서비스 현재 구조

```python
# backend/services/document_selector_service.py (line 35-84)
def get_documents_for_collection(
    self,
    db: Session,
    collection_name: Optional[str] = None,
    ...
) -> List[Dict[str, Any]]:
    if collection_name:
        # Document JOIN QdrantUploadHistory로 조회
        query = db.query(Document).join(
            QdrantUploadHistory,
            Document.id == QdrantUploadHistory.document_id
        ).filter(
            QdrantUploadHistory.collection_name == collection_name,
            QdrantUploadHistory.upload_status == "success"
        )
        # 엑셀 문서는 이 쿼리에서 조회되지 않음!
```

### 2.5 프롬프트 생성 모달 현재 상태

**`app/collections/components/PromptGeneratorModal.tsx`**:
- Step 1: 문서 선택 (현재 엑셀 문서 미표시)
- Step 2: 템플릿 선택 (regulation, budget, casual, technical, default)
- Step 3: 파일명 입력
- Step 4: 생성 및 편집

---

## 3. 목표

1. 엑셀 업로드 시 SQLite `Document` 테이블에 메타데이터 기록
2. `QdrantUploadHistory` 테이블에 업로드 이력 기록
3. 기존 문서 선택 로직 100% 호환 (프롬프트 자동생성 모달에서 엑셀 문서 표시)
4. 기존 엑셀 컬렉션에 대한 마이그레이션 방안 제공
5. 카테고리 필드와의 연계 (선택적)

---

## 4. 구현 계획 (업데이트)

### 4.1 Phase 1: 구현 방식 결정

**권장: 옵션 B (기존 필드 활용)**
- `file_type`에 "xlsx", "xls" 저장
- `parse_options`에 엑셀 메타데이터 저장: `{"source_type": "excel", "mapping": {...}}`
- 새 필드 추가 없이 기존 구조 활용
- DB 마이그레이션 불필요

**옵션 A는 보류** (source_type, excel_metadata 필드 추가)

### 4.1.1 md_content 처리 전략 (엑셀 전용)

**핵심 원칙: 엑셀은 Qdrant 청크 기반 샘플링만 사용**

```
일반 문서 (PDF/DOCX):
  1. 청크 기반 샘플링 (우선) → Qdrant 검색
  2. 위치 기반 샘플링 (폴백) → SQLite md_content

엑셀 문서:
  1. 청크 기반 샘플링 (전용) → Qdrant 검색 (행 단위 임베딩 활용)
  2. md_content는 메타정보만 저장 (폴백 불필요)
```

**이유:**
- 엑셀 업로드 시 각 행이 개별 벡터로 Qdrant에 저장됨
- `text` 필드에 텍스트 컬럼 내용이 이미 포함됨
- `sample_documents_from_chunks()`가 Qdrant에서 직접 텍스트 추출
- md_content에 전체 데이터 중복 저장 불필요

**md_content 저장 내용 (메타정보만):**

```python
def generate_excel_metadata_content(
    file_name: str,
    rows: List[ExcelPreviewRow],
    mapping: ColumnMapping
) -> str:
    """
    엑셀 문서의 md_content용 메타정보 생성
    (프롬프트 생성 시 청크 기반 샘플링 사용하므로 메타정보만 저장)
    """
    headers = list(rows[0].data.keys()) if rows else []

    return f"""# {file_name}

## 문서 정보
- **유형**: Excel 데이터
- **총 행 수**: {len(rows)}
- **컬럼**: {', '.join(headers)}

## 매핑 설정
- **텍스트 컬럼**: {', '.join(mapping.text_columns)}
- **메타데이터 컬럼**: {', '.join(mapping.metadata_columns)}
- **ID 컬럼**: {mapping.id_column or '없음'}
- **태그 컬럼**: {mapping.tag_column or '없음'}

## 샘플링 안내
이 문서의 내용은 Qdrant 벡터 DB에 행 단위로 임베딩되어 있습니다.
프롬프트 자동생성 시 청크 기반 샘플링(`sample_documents_from_chunks`)을 통해
의미론적으로 관련된 행들이 자동 추출됩니다.
"""
```

**장점:**
- 저장 공간 최소화 (수백KB → 수KB)
- Qdrant에 이미 저장된 데이터 재활용
- 청크 기반 샘플링이 더 정확한 샘플 추출 (의미 기반)

### 4.2 Phase 2: 헬퍼 서비스 구현

**신규 파일**: `backend/services/excel_document_service.py`

```python
"""
엑셀 문서 SQLite 저장 서비스
- md_content: 메타정보만 저장 (청크 기반 샘플링 사용)
- 실제 데이터는 Qdrant에 행 단위로 임베딩
"""
from typing import List, Optional
from backend.models.schemas import ExcelPreviewRow, ColumnMapping


def generate_excel_metadata_content(
    file_name: str,
    rows: List[ExcelPreviewRow],
    mapping: ColumnMapping
) -> str:
    """
    엑셀 문서의 md_content용 메타정보 생성
    (프롬프트 생성 시 청크 기반 샘플링 사용하므로 메타정보만 저장)
    """
    headers = list(rows[0].data.keys()) if rows else []

    return f"""# {file_name}

## 문서 정보
- **유형**: Excel 데이터
- **총 행 수**: {len(rows)}
- **컬럼**: {', '.join(headers)}

## 매핑 설정
- **텍스트 컬럼**: {', '.join(mapping.text_columns)}
- **메타데이터 컬럼**: {', '.join(mapping.metadata_columns)}
- **ID 컬럼**: {mapping.id_column or '없음'}
- **태그 컬럼**: {mapping.tag_column or '없음'}

## 샘플링 안내
이 문서의 내용은 Qdrant 벡터 DB에 행 단위로 임베딩되어 있습니다.
프롬프트 자동생성 시 청크 기반 샘플링을 통해 의미론적으로 관련된 행들이 자동 추출됩니다.
"""


def generate_preview(texts: List[str], max_length: int = 500) -> str:
    """텍스트 목록에서 미리보기 생성"""
    combined = " ".join(t for t in texts if t)
    return combined[:max_length] if len(combined) > max_length else combined


def calculate_total_length(rows: List[ExcelPreviewRow], mapping: ColumnMapping) -> int:
    """전체 텍스트 길이 계산"""
    total = 0
    for row in rows:
        for col in mapping.text_columns:
            if col in row.data and row.data[col]:
                total += len(str(row.data[col]))
    return total
```

### 4.3 Phase 3: 엑셀 업로드 API 수정

**파일**: `backend/api/routes/qdrant.py` (line 932 부근)

**변경 내용**:

```python
@router.post("/excel/embed", response_model=DynamicEmbeddingResponse)
async def embed_excel_dynamic(
    request: DynamicEmbeddingRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)  # 추가
):
    results = []
    success_count = 0
    failure_count = 0
    vector_ids_all = []  # 전체 vector ID 수집 (추가)
    texts_all = []       # 전체 텍스트 수집 (추가)

    try:
        # ... 기존 임베딩 로직 ...
        # 각 배치에서:
        #   vector_ids_all.extend(vector_ids)
        #   texts_all.extend(texts)

        # 임베딩 완료 후 SQLite 기록 추가
        if success_count > 0:
            from backend.services.excel_document_service import (
                generate_excel_metadata_content, generate_preview, calculate_total_length
            )

            # 1. Document 생성 (md_content는 메타정보만)
            excel_doc = Document(
                task_id=f"excel-{uuid.uuid4().hex[:12]}",
                original_filename=request.file_name,
                file_size=None,
                file_type="xlsx",
                status="success",
                content_length=calculate_total_length(request.rows, request.mapping),
                content_preview=generate_preview(texts_all[:3]),
                # 메타정보만 저장 (청크 기반 샘플링 사용)
                md_content=generate_excel_metadata_content(
                    request.file_name, request.rows, request.mapping
                ),
                category=request.collection_name,
                parse_options={
                    "source_type": "excel",
                    "mapping": request.mapping.dict(),
                    "total_rows": len(request.rows)
                }
            )
            db.add(excel_doc)
            db.flush()  # ID 획득

            # 2. QdrantUploadHistory 생성
            history = QdrantUploadHistory(
                document_id=excel_doc.id,
                collection_name=request.collection_name,
                chunk_count=success_count,
                vector_ids_json=json.dumps(vector_ids_all),
                qdrant_url=settings.QDRANT_URL,
                upload_status="success"
            )
            db.add(history)
            db.commit()

            logger.info(f"Excel document saved: id={excel_doc.id}, filename={request.file_name}")

        return DynamicEmbeddingResponse(...)

    except Exception as e:
        db.rollback()
        raise
```

**핵심 변경점:**
- `md_content`: `rows_to_markdown()` → `generate_excel_metadata_content()` (메타정보만)
- 프롬프트 생성 시 `sample_documents_from_chunks()`가 Qdrant에서 실제 텍스트 추출

### 4.4 Phase 4: 기존 엑셀 컬렉션 마이그레이션 (선택적)

**옵션 A: 관리자 API 엔드포인트**

```python
# backend/api/routes/qdrant.py

@router.post("/migrate/excel-collection/{collection_name}")
async def migrate_excel_collection(
    collection_name: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    기존 엑셀 컬렉션을 SQLite에 역으로 기록
    Qdrant에서 메타데이터 추출하여 Document 생성
    """
    # 1. Qdrant에서 컬렉션 포인트 조회 (scroll)
    points = await qdrant_service.scroll(collection_name, limit=10000)

    # 2. source_file 기준 그룹핑
    grouped = {}
    for point in points:
        source = point.payload.get("source_file", "unknown")
        if source not in grouped:
            grouped[source] = {
                "texts": [],
                "metadata": point.payload
            }
        grouped[source]["texts"].append(point.payload.get("text", ""))

    # 3. 각 source_file에 대해 Document 생성
    created_docs = []
    for source_file, data in grouped.items():
        doc = Document(
            task_id=f"excel-migrated-{uuid.uuid4().hex[:8]}",
            original_filename=source_file,
            file_type="xlsx",
            status="success",
            content_length=sum(len(t) for t in data["texts"]),
            md_content="\n\n".join(data["texts"]),
            category=collection_name,
            parse_options={"source_type": "excel", "migrated": True}
        )
        db.add(doc)
        db.flush()

        history = QdrantUploadHistory(
            document_id=doc.id,
            collection_name=collection_name,
            chunk_count=len(data["texts"]),
            upload_status="success"
        )
        db.add(history)
        created_docs.append(doc.id)

    db.commit()
    return {"migrated_documents": len(created_docs), "document_ids": created_docs}
```

---

## 5. 파일 변경 목록 (업데이트)

### 5.1 수정 파일

| 파일 | 변경 내용 | 상태 | 우선순위 |
|------|----------|------|---------|
| `backend/api/routes/qdrant.py` | `embed_excel_dynamic()` 함수에 SQLite 기록 로직 추가 | 대기 | 높음 |
| `backend/models/document.py` | `category` 컬럼 이미 추가됨 | **완료** | - |

### 5.2 신규 파일

| 파일 | 내용 | 상태 | 우선순위 |
|------|-----|------|---------|
| `backend/services/excel_document_service.py` | 엑셀→마크다운 변환 헬퍼 | 대기 | 높음 |

### 5.3 마이그레이션 파일

| 파일 | 내용 | 상태 |
|------|-----|------|
| `backend/migrations/add_category_column.py` | category 컬럼 추가 | **완료** |

---

## 6. 구현 순서 및 체크리스트

### Step 1: 헬퍼 서비스 구현
- [ ] `backend/services/excel_document_service.py` 생성
- [ ] `rows_to_markdown()` 함수 구현
- [ ] `generate_preview()` 함수 구현
- [ ] `calculate_total_length()` 함수 구현
- [ ] 단위 테스트 작성

### Step 2: 엑셀 업로드 API 수정
- [ ] `embed_excel_dynamic()` 함수에 `db: Session = Depends(get_db)` 추가
- [ ] vector_ids_all, texts_all 수집 로직 추가
- [ ] 임베딩 성공 후 Document 생성 로직 추가
- [ ] QdrantUploadHistory 생성 로직 추가
- [ ] category 필드에 컬렉션명 저장
- [ ] 트랜잭션 처리 (commit/rollback)
- [ ] 에러 핸들링

### Step 3: 통합 테스트
- [ ] 엑셀 업로드 후 `/api/prompts/documents/{collection}` 조회 테스트
- [ ] 프롬프트 생성 모달에서 엑셀 문서 표시 확인
- [ ] 청크 기반 샘플링 기능 테스트

### Step 4: 기존 컬렉션 마이그레이션 (선택)
- [ ] 마이그레이션 API 구현
- [ ] 기존 엑셀 컬렉션 목록 확인
- [ ] 마이그레이션 실행 및 검증

---

## 7. 연관 기능 업데이트 현황

### 7.1 완료된 기능
- [x] 컬렉션 관리 페이지 (`app/collections/page.tsx`)
  - 한글명/키워드 검색
  - 빠른 필터 (추천, 문서있음, 비어있음)
  - 프롬프트 자동생성 모달 연동
- [x] 문서 업로드 페이지 (`app/upload/page.tsx`)
  - 카테고리 필터 기능
  - 카테고리 이동 기능
- [x] Document 모델 category 컬럼 추가
- [x] 마이그레이션 스크립트 (`add_category_column.py`)

### 7.2 대기 중인 기능
- [ ] 엑셀 업로드 시 Document/History 저장
- [ ] 기존 엑셀 컬렉션 마이그레이션

---

## 8. 롤백 계획

### 8.1 코드 롤백
- Git revert로 변경사항 되돌리기
- 새로 추가된 헬퍼 서비스 파일 삭제

### 8.2 데이터 롤백
```sql
-- 엑셀로 추가된 Document 삭제 (옵션 B 사용 시)
DELETE FROM qdrant_upload_history
WHERE document_id IN (
    SELECT id FROM documents
    WHERE json_extract(parse_options, '$.source_type') = 'excel'
);

DELETE FROM documents
WHERE json_extract(parse_options, '$.source_type') = 'excel';
```

---

## 9. 위험 요소 및 대응

| 위험 | 가능성 | 영향 | 대응 |
|------|-------|-----|------|
| 엑셀 파일 크기가 매우 큰 경우 md_content 저장 실패 | 낮음 | 중간 | TEXT 타입은 충분히 큼, 필요시 청크만 저장 |
| 기존 코드와의 호환성 문제 | 중간 | 높음 | 기존 필드 활용 (옵션 B)으로 최소화 |
| 마이그레이션 시 데이터 불일치 | 중간 | 중간 | 마이그레이션 전 백업, 검증 스크립트 |
| 트랜잭션 실패 시 Qdrant/SQLite 불일치 | 낮음 | 높음 | Qdrant 성공 후 SQLite 기록, 실패 시 로그만 |

---

## 10. 참고 파일 경로

```
backend/
├── api/routes/
│   ├── qdrant.py                    # 엑셀 업로드 API (수정 대상) - line 932
│   └── prompts.py                   # 프롬프트 생성 API
├── models/
│   ├── document.py                  # Document 모델 (category 추가됨)
│   ├── qdrant_upload_history.py
│   └── schemas.py                   # Pydantic 스키마
├── services/
│   ├── document_selector_service.py # 문서 선택 서비스 - line 35
│   ├── excel_document_service.py    # 신규 생성 예정
│   └── prompt_generator_service.py
├── migrations/
│   └── add_category_column.py       # category 마이그레이션 (완료)
└── database.py

app/
├── collections/
│   ├── page.tsx                     # 컬렉션 관리 페이지
│   └── components/
│       └── PromptGeneratorModal.tsx # 프롬프트 생성 모달
└── upload/
    ├── page.tsx                     # 문서 업로드 페이지
    ├── types.ts
    └── components/
        └── DocumentSelector.tsx     # 문서 선택기
```
