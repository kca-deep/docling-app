# Excel 업로드 시 SQLite 문서 기록 통합 구현 계획

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
- 프롬프트 자동생성 모달 (PromptGeneratorModal.tsx)
- 청크 기반 샘플링 기능

---

## 2. 목표

1. 엑셀 업로드 시 SQLite `Document` 테이블에 메타데이터 기록
2. `QdrantUploadHistory` 테이블에 업로드 이력 기록
3. 기존 문서 선택 로직 100% 호환
4. 기존 엑셀 컬렉션에 대한 마이그레이션 방안 제공

---

## 3. 기술 분석

### 3.1 Document 모델 현재 구조

```python
# backend/models/document.py
class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, autoincrement=True)
    task_id = Column(String(100), unique=True, nullable=False)  # 제약: unique, not null
    original_filename = Column(String(255), nullable=False)
    file_size = Column(Integer, nullable=True)
    file_type = Column(String(20), nullable=True)  # pdf, docx, pptx
    status = Column(String(20), default="success")
    processing_time = Column(Float, nullable=True)
    parse_options = Column(JSON, nullable=True)
    error_message = Column(Text, nullable=True)
    content_length = Column(Integer, nullable=True)
    content_preview = Column(String(500), nullable=True)
    md_content = Column(Text, nullable=False)  # 제약: not null
    download_count = Column(Integer, default=0)
    last_accessed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
```

**제약사항 분석**:
| 필드 | 제약 | 엑셀 업로드 대응 |
|------|------|-----------------|
| `task_id` | unique, not null | UUID 생성 (`excel-{uuid}`) |
| `md_content` | not null | 엑셀 데이터를 마크다운 테이블로 변환 |
| `file_type` | nullable | "xlsx" 또는 "xls" |

### 3.2 QdrantUploadHistory 모델 현재 구조

```python
# backend/models/qdrant_upload_history.py
class QdrantUploadHistory(Base):
    __tablename__ = "qdrant_upload_history"

    id = Column(Integer, primary_key=True, autoincrement=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False)
    collection_name = Column(String(255), nullable=False)
    chunk_count = Column(Integer, nullable=True)
    vector_ids_json = Column(Text, nullable=True)
    qdrant_url = Column(String(255), nullable=True)
    upload_status = Column(String(20), default="success")
    error_message = Column(Text, nullable=True)
    uploaded_at = Column(DateTime, default=datetime.utcnow)
```

### 3.3 엑셀 업로드 API 현재 구조

```python
# backend/api/routes/qdrant.py (line 932-1083)
@router.post("/excel/embed", response_model=DynamicEmbeddingResponse)
async def embed_excel_dynamic(
    request: DynamicEmbeddingRequest,
    current_user: User = Depends(get_current_active_user)
):
    # DB 세션을 받지 않음 → 추가 필요
    # SQLite 기록 로직 없음 → 추가 필요
```

### 3.4 DynamicEmbeddingRequest 구조

```python
class DynamicEmbeddingRequest(BaseModel):
    collection_name: str
    file_name: str
    rows: List[ExcelPreviewRow]  # row_index, data(dict)
    mapping: ColumnMapping       # text_columns, metadata_columns 등
```

---

## 4. 구현 계획

### 4.1 Phase 1: Document 모델 확장 (선택적)

**옵션 A: 새 필드 추가** (권장)
```python
# backend/models/document.py 수정
class Document(Base):
    # ... 기존 필드 ...

    # 새 필드 추가
    source_type = Column(String(20), default="file")  # file, excel, url
    excel_metadata = Column(JSON, nullable=True)  # 엑셀 관련 메타 (컬럼 매핑 등)
```

**옵션 B: 기존 필드 활용** (마이그레이션 최소화)
- `file_type`에 "xlsx", "xls" 저장
- `parse_options`에 엑셀 메타데이터 저장
- 새 필드 추가 없이 기존 구조 활용

**권장: 옵션 B** (초기 구현 단순화)

### 4.2 Phase 2: 엑셀 업로드 API 수정

**파일**: `backend/api/routes/qdrant.py`

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
    vector_ids_all = []  # 전체 vector ID 수집

    try:
        # ... 기존 임베딩 로직 ...

        # 임베딩 완료 후 SQLite 기록 추가
        if success_count > 0:
            # 1. Document 생성
            excel_doc = Document(
                task_id=f"excel-{uuid.uuid4().hex[:12]}",
                original_filename=request.file_name,
                file_size=None,
                file_type="xlsx",
                status="success",
                content_length=total_text_length,
                content_preview=generate_preview(texts[:3]),
                md_content=rows_to_markdown(request.rows, request.mapping),
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
```

### 4.3 Phase 3: 헬퍼 함수 구현

**파일**: `backend/services/excel_document_service.py` (신규)

```python
"""
엑셀 문서 SQLite 저장 서비스
"""
import json
from typing import List, Dict, Any
from backend.models.schemas import ExcelPreviewRow, ColumnMapping


def rows_to_markdown(rows: List[ExcelPreviewRow], mapping: ColumnMapping) -> str:
    """
    엑셀 행 데이터를 마크다운 테이블로 변환

    Args:
        rows: 엑셀 행 목록
        mapping: 컬럼 매핑 설정

    Returns:
        마크다운 테이블 문자열
    """
    if not rows:
        return ""

    # 헤더 추출 (첫 번째 행의 키들)
    headers = list(rows[0].data.keys())

    # 마크다운 테이블 생성
    lines = []

    # 헤더 행
    lines.append("| " + " | ".join(headers) + " |")
    lines.append("| " + " | ".join(["---"] * len(headers)) + " |")

    # 데이터 행
    for row in rows:
        values = [str(row.data.get(h, "")) for h in headers]
        # 셀 내 파이프 문자 이스케이프
        values = [v.replace("|", "\\|") for v in values]
        lines.append("| " + " | ".join(values) + " |")

    return "\n".join(lines)


def generate_preview(texts: List[str], max_length: int = 500) -> str:
    """
    텍스트 목록에서 미리보기 생성
    """
    combined = " ".join(texts)
    return combined[:max_length] if len(combined) > max_length else combined


def calculate_total_length(rows: List[ExcelPreviewRow], mapping: ColumnMapping) -> int:
    """
    전체 텍스트 길이 계산
    """
    total = 0
    for row in rows:
        for col in mapping.text_columns:
            if col in row.data and row.data[col]:
                total += len(str(row.data[col]))
    return total
```

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

**옵션 B: 일회성 마이그레이션 스크립트**

```python
# scripts/migrate_excel_collections.py
"""
기존 엑셀 컬렉션 마이그레이션 스크립트
실행: python -m scripts.migrate_excel_collections
"""
import asyncio
from backend.database import SessionLocal
from backend.services.qdrant_service import QdrantService
# ... 구현
```

---

## 5. 파일 변경 목록

### 5.1 수정 파일

| 파일 | 변경 내용 | 우선순위 |
|------|----------|---------|
| `backend/api/routes/qdrant.py` | `embed_excel_dynamic()` 함수에 SQLite 기록 로직 추가 | 높음 |
| `backend/models/document.py` | (선택) `source_type` 필드 추가 | 낮음 |

### 5.2 신규 파일

| 파일 | 내용 | 우선순위 |
|------|-----|---------|
| `backend/services/excel_document_service.py` | 엑셀→마크다운 변환 헬퍼 | 높음 |

### 5.3 테스트 파일

| 파일 | 내용 |
|------|-----|
| `tests/test_excel_document_service.py` | 헬퍼 함수 단위 테스트 |
| `tests/test_excel_embed_integration.py` | 통합 테스트 |

---

## 6. 데이터베이스 마이그레이션

### 6.1 옵션 B 선택 시 (마이그레이션 불필요)
기존 필드 (`file_type`, `parse_options`) 활용으로 스키마 변경 없음

### 6.2 옵션 A 선택 시 (새 필드 추가)

```sql
-- SQLite 마이그레이션
ALTER TABLE documents ADD COLUMN source_type VARCHAR(20) DEFAULT 'file';
ALTER TABLE documents ADD COLUMN excel_metadata JSON;
```

또는 Alembic 사용:
```python
# alembic/versions/xxxx_add_source_type.py
def upgrade():
    op.add_column('documents', sa.Column('source_type', sa.String(20), default='file'))
    op.add_column('documents', sa.Column('excel_metadata', sa.JSON, nullable=True))

def downgrade():
    op.drop_column('documents', 'source_type')
    op.drop_column('documents', 'excel_metadata')
```

---

## 7. 구현 순서 및 체크리스트

### Step 1: 헬퍼 서비스 구현
- [ ] `backend/services/excel_document_service.py` 생성
- [ ] `rows_to_markdown()` 함수 구현
- [ ] `generate_preview()` 함수 구현
- [ ] `calculate_total_length()` 함수 구현
- [ ] 단위 테스트 작성

### Step 2: 엑셀 업로드 API 수정
- [ ] `embed_excel_dynamic()` 함수에 `db: Session = Depends(get_db)` 추가
- [ ] 임베딩 성공 후 Document 생성 로직 추가
- [ ] QdrantUploadHistory 생성 로직 추가
- [ ] 트랜잭션 처리 (commit/rollback)
- [ ] 에러 핸들링

### Step 3: 통합 테스트
- [ ] 엑셀 업로드 후 `/api/prompts/documents/{collection}` 조회 테스트
- [ ] 프롬프트 생성 워크플로우 E2E 테스트

### Step 4: 기존 컬렉션 마이그레이션 (선택)
- [ ] 마이그레이션 API 또는 스크립트 구현
- [ ] 기존 엑셀 컬렉션 목록 확인
- [ ] 마이그레이션 실행 및 검증

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

## 10. 예상 소요 시간

| 단계 | 예상 소요 |
|------|----------|
| Phase 1: 모델 분석 및 설계 | 완료 |
| Phase 2: 헬퍼 서비스 구현 | 1시간 |
| Phase 3: API 수정 | 1시간 |
| Phase 4: 테스트 | 1시간 |
| Phase 5: 마이그레이션 (선택) | 1시간 |
| **총합** | **4시간** |

---

## 11. 참고 파일 경로

```
backend/
├── api/routes/
│   ├── qdrant.py          # 엑셀 업로드 API (수정 대상)
│   └── prompts.py         # 프롬프트 생성 API
├── models/
│   ├── document.py        # Document 모델
│   ├── qdrant_upload_history.py
│   └── schemas.py         # Pydantic 스키마
├── services/
│   ├── document_selector_service.py  # 문서 선택 서비스
│   ├── excel_document_service.py     # 신규 생성
│   └── prompt_generator_service.py
└── database.py

app/collections/components/
└── PromptGeneratorModal.tsx  # 프롬프트 생성 모달 (영향받는 UI)
```
