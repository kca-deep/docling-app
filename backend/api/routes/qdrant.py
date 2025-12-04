"""
Qdrant Vector DB 연동 API 라우트
인증 필수: 관리자만 접근 가능
"""
import uuid
import io
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from sqlalchemy.orm import Session
from typing import List

from backend.services.qdrant_service import QdrantService
from backend.services.chunking_service import ChunkingService
from backend.services.embedding_service import EmbeddingService
from backend.services import document_crud, qdrant_history_crud
from backend.database import get_db
from backend.config.settings import settings
from backend.dependencies.auth import get_current_active_user
from backend.models.schemas import (
    QdrantCollectionsResponse,
    QdrantCollectionCreateRequest,
    QdrantCollectionResponse,
    QdrantCollectionInfo,
    QdrantUploadRequest,
    QdrantUploadResponse,
    QdrantUploadResult,
    QdrantConfigResponse,
    QAPreviewResponse,
    QAPreviewRow,
    QAEmbeddingRequest,
    QAEmbeddingResponse,
    QAEmbeddingResult,
    ExcelPreviewResponse,
    ExcelPreviewRow,
    ColumnMapping,
    DynamicEmbeddingRequest,
    DynamicEmbeddingResponse,
    DynamicEmbeddingResult
)

router = APIRouter(
    prefix="/api/qdrant",
    tags=["qdrant"],
    dependencies=[Depends(get_current_active_user)]  # 모든 엔드포인트 인증 필수
)

# 서비스 인스턴스 생성
qdrant_service = QdrantService(
    url=settings.QDRANT_URL,
    api_key=settings.QDRANT_API_KEY
)
chunking_service = ChunkingService(base_url=settings.DOCLING_CHUNKING_URL)
embedding_service = EmbeddingService(
    base_url=settings.EMBEDDING_URL,
    model=settings.EMBEDDING_MODEL
)


@router.get("/config", response_model=QdrantConfigResponse)
async def get_qdrant_config():
    """
    Qdrant 청킹 설정값 조회 API

    Returns:
        QdrantConfigResponse: 기본 chunk_size 및 chunk_overlap 설정값
    """
    return QdrantConfigResponse(
        default_chunk_size=settings.DEFAULT_CHUNK_SIZE,
        default_chunk_overlap=settings.DEFAULT_CHUNK_OVERLAP
    )


@router.get("/collections", response_model=QdrantCollectionsResponse)
async def get_collections():
    """
    Qdrant Collection 목록 조회 API

    Returns:
        QdrantCollectionsResponse: Collection 목록

    Raises:
        HTTPException: Qdrant 서버 연결 실패 시
    """
    try:
        collections = await qdrant_service.get_collections()

        return QdrantCollectionsResponse(
            collections=collections
        )

    except Exception as e:
        print(f"[ERROR] Failed to get collections: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Qdrant collection 목록 조회 실패: {str(e)}"
        )


@router.post("/collections", response_model=QdrantCollectionResponse)
async def create_collection(request: QdrantCollectionCreateRequest):
    """
    Qdrant Collection 생성 API

    Args:
        request: Collection 생성 요청

    Returns:
        QdrantCollectionResponse: 생성 결과

    Raises:
        HTTPException: Collection 생성 실패 시
    """
    try:
        # Collection 이름 검증
        if not request.collection_name or not request.collection_name.strip():
            raise HTTPException(
                status_code=400,
                detail="Collection 이름은 필수입니다"
            )

        # Vector size 검증
        if request.vector_size <= 0:
            raise HTTPException(
                status_code=400,
                detail="Vector size는 양수여야 합니다"
            )

        # Distance metric 검증
        valid_distances = ["Cosine", "Euclidean", "Dot"]
        if request.distance not in valid_distances:
            raise HTTPException(
                status_code=400,
                detail=f"Distance metric은 {valid_distances} 중 하나여야 합니다"
            )

        # Collection 생성
        await qdrant_service.create_collection(
            collection_name=request.collection_name,
            vector_size=request.vector_size,
            distance=request.distance
        )

        return QdrantCollectionResponse(
            success=True,
            collection_name=request.collection_name,
            message=f"Collection '{request.collection_name}'이 성공적으로 생성되었습니다"
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] Failed to create collection: {e}")

        # 이미 존재하는 경우
        if "이미 존재합니다" in str(e):
            raise HTTPException(
                status_code=409,
                detail=str(e)
            )

        raise HTTPException(
            status_code=500,
            detail=f"Collection 생성 실패: {str(e)}"
        )


@router.delete("/collections/{collection_name}", response_model=QdrantCollectionResponse)
async def delete_collection(collection_name: str):
    """
    Qdrant Collection 삭제 API

    Args:
        collection_name: 삭제할 Collection 이름

    Returns:
        QdrantCollectionResponse: 삭제 결과

    Raises:
        HTTPException: Collection 삭제 실패 시
    """
    try:
        # Collection 이름 검증
        if not collection_name or not collection_name.strip():
            raise HTTPException(
                status_code=400,
                detail="Collection 이름은 필수입니다"
            )

        # Collection 삭제
        await qdrant_service.delete_collection(collection_name)

        return QdrantCollectionResponse(
            success=True,
            collection_name=collection_name,
            message=f"Collection '{collection_name}'이 성공적으로 삭제되었습니다"
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] Failed to delete collection: {e}")

        # 존재하지 않는 경우
        if "존재하지 않습니다" in str(e):
            raise HTTPException(
                status_code=404,
                detail=str(e)
            )

        raise HTTPException(
            status_code=500,
            detail=f"Collection 삭제 실패: {str(e)}"
        )


@router.post("/upload", response_model=QdrantUploadResponse)
async def upload_documents(
    request: QdrantUploadRequest,
    db: Session = Depends(get_db)
):
    """
    문서를 Qdrant에 임베딩 및 업로드

    Args:
        request: 업로드 요청
        db: DB 세션

    Returns:
        QdrantUploadResponse: 업로드 결과

    Raises:
        HTTPException: 업로드 실패 시
    """
    results = []
    success_count = 0
    failure_count = 0

    try:
        # Collection 존재 확인
        collection_exists = await qdrant_service.collection_exists(request.collection_name)
        if not collection_exists:
            raise HTTPException(
                status_code=404,
                detail=f"Collection '{request.collection_name}'이 존재하지 않습니다"
            )

        # 각 문서 처리
        for document_id in request.document_ids:
            try:
                # 1. DB에서 문서 조회
                document = document_crud.get_document_by_id(db, document_id)
                if not document or not document.md_content:
                    results.append(QdrantUploadResult(
                        document_id=document_id,
                        filename=document.original_filename if document else "Unknown",
                        success=False,
                        error="문서를 찾을 수 없거나 markdown 내용이 없습니다"
                    ))
                    failure_count += 1
                    continue

                print(f"[INFO] Processing document {document_id}: {document.original_filename}")

                # 2. Markdown 청킹
                chunks = await chunking_service.chunk_markdown(
                    markdown_content=document.md_content,
                    max_tokens=request.chunk_size,
                    filename=document.original_filename
                )

                if not chunks:
                    results.append(QdrantUploadResult(
                        document_id=document_id,
                        filename=document.original_filename,
                        success=False,
                        error="청킹 결과가 없습니다"
                    ))
                    failure_count += 1
                    continue

                # 3. 청크 텍스트 추출
                chunk_texts = [chunk.get('text', '') for chunk in chunks]

                # 4. 임베딩 생성
                embeddings = await embedding_service.get_embeddings(chunk_texts)

                if len(embeddings) != len(chunk_texts):
                    results.append(QdrantUploadResult(
                        document_id=document_id,
                        filename=document.original_filename,
                        success=False,
                        error="임베딩 개수와 청크 개수가 일치하지 않습니다"
                    ))
                    failure_count += 1
                    continue

                # 5. 메타데이터 생성
                metadata_list = []
                for i, chunk in enumerate(chunks):
                    metadata_list.append({
                        "document_id": document_id,
                        "filename": document.original_filename,
                        "chunk_index": i,
                        "num_tokens": chunk.get('num_tokens', 0),
                        "headings": chunk.get('headings') or []  # None 안전 처리
                    })

                # 6. Qdrant에 벡터 업로드
                vector_ids = await qdrant_service.upsert_vectors(
                    collection_name=request.collection_name,
                    vectors=embeddings,
                    texts=chunk_texts,
                    metadata_list=metadata_list
                )

                # 7. 업로드 이력 저장
                qdrant_history_crud.create_upload_history(
                    db=db,
                    document_id=document_id,
                    collection_name=request.collection_name,
                    chunk_count=len(chunks),
                    vector_ids=vector_ids,
                    qdrant_url=settings.QDRANT_URL,
                    upload_status="success"
                )

                # 성공 결과 추가
                results.append(QdrantUploadResult(
                    document_id=document_id,
                    filename=document.original_filename,
                    success=True,
                    chunk_count=len(chunks),
                    vector_ids=vector_ids
                ))
                success_count += 1

                print(f"[INFO] Successfully uploaded document {document_id} with {len(chunks)} chunks")

            except Exception as e:
                print(f"[ERROR] Failed to upload document {document_id}: {e}")

                # 실패 이력 저장
                try:
                    document = document_crud.get_document_by_id(db, document_id)
                    qdrant_history_crud.create_upload_history(
                        db=db,
                        document_id=document_id,
                        collection_name=request.collection_name,
                        chunk_count=0,
                        vector_ids=[],
                        qdrant_url=settings.QDRANT_URL,
                        upload_status="failure",
                        error_message=str(e)
                    )
                except:
                    pass

                results.append(QdrantUploadResult(
                    document_id=document_id,
                    filename=document.original_filename if document else "Unknown",
                    success=False,
                    error=str(e)
                ))
                failure_count += 1

        return QdrantUploadResponse(
            total=len(request.document_ids),
            success_count=success_count,
            failure_count=failure_count,
            results=results
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] Upload process failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"업로드 프로세스 실패: {str(e)}"
        )


# ==================== Q&A Excel Embedding Endpoints ====================

@router.post("/qa/preview", response_model=QAPreviewResponse)
async def preview_qa_excel(file: UploadFile = File(...)):
    """
    Q&A Excel 파일 미리보기 API

    Args:
        file: 업로드된 Excel 파일 (.xlsx)

    Returns:
        QAPreviewResponse: 미리보기 데이터
    """
    try:
        import openpyxl

        if not file.filename.endswith(('.xlsx', '.xls')):
            raise HTTPException(
                status_code=400,
                detail="Excel 파일(.xlsx, .xls)만 지원합니다"
            )

        contents = await file.read()
        wb = openpyxl.load_workbook(io.BytesIO(contents))
        ws = wb.active

        headers = [cell.value for cell in ws[1] if cell.value]
        print(f"[INFO] Excel headers: {headers}")

        required_headers = ['question', 'answer_text']
        header_lower = [h.lower() if h else '' for h in headers]

        for req in required_headers:
            if req not in header_lower:
                raise HTTPException(
                    status_code=400,
                    detail=f"필수 컬럼 '{req}'이(가) 없습니다. 현재 컬럼: {headers}"
                )

        header_map = {h.lower(): i for i, h in enumerate(headers) if h}

        rows = []
        for row_num in range(2, ws.max_row + 1):
            row_values = [ws.cell(row=row_num, column=i+1).value for i in range(len(headers))]

            question = row_values[header_map.get('question', 1)] or ''
            answer_text = row_values[header_map.get('answer_text', 2)] or ''

            if not question.strip() and not answer_text.strip():
                continue

            faq_id = row_values[header_map.get('faq_id', 0)] if 'faq_id' in header_map else f"FAQ-{row_num-1:04d}"
            tags_raw = row_values[header_map.get('tag', -1)] if 'tag' in header_map else ''
            tags = [t.strip() for t in (tags_raw or '').split(',')] if tags_raw else []
            policy_anchor = row_values[header_map.get('policy_anchor', -1)] if 'policy_anchor' in header_map else None
            source = row_values[header_map.get('source', -1)] if 'source' in header_map else None

            rows.append(QAPreviewRow(
                row_index=row_num - 2,
                faq_id=str(faq_id) if faq_id else f"FAQ-{row_num-1:04d}",
                question=str(question),
                answer_text=str(answer_text),
                tags=tags,
                policy_anchor=str(policy_anchor) if policy_anchor else None,
                source=str(source) if source else None
            ))

        wb.close()

        print(f"[INFO] Parsed {len(rows)} Q&A rows from Excel")

        return QAPreviewResponse(
            total_rows=len(rows),
            headers=headers,
            preview_rows=rows,
            file_name=file.filename
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] Failed to parse Excel file: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Excel 파일 파싱 실패: {str(e)}"
        )


@router.post("/qa/embed", response_model=QAEmbeddingResponse)
async def embed_qa_rows(request: QAEmbeddingRequest):
    """
    Q&A 행별 임베딩 및 Qdrant 업로드 API

    Args:
        request: Q&A 임베딩 요청

    Returns:
        QAEmbeddingResponse: 임베딩 결과
    """
    results = []
    success_count = 0
    failure_count = 0

    try:
        collection_exists = await qdrant_service.collection_exists(request.collection_name)
        if not collection_exists:
            raise HTTPException(
                status_code=404,
                detail=f"Collection '{request.collection_name}'이 존재하지 않습니다"
            )

        batch_size = 10
        rows = request.rows

        for batch_start in range(0, len(rows), batch_size):
            batch_end = min(batch_start + batch_size, len(rows))
            batch_rows = rows[batch_start:batch_end]

            try:
                texts = [f"질문: {row.question}\n답변: {row.answer_text}" for row in batch_rows]

                embeddings = await embedding_service.get_embeddings(texts)

                metadata_list = []
                for row in batch_rows:
                    metadata_list.append({
                        "faq_id": row.faq_id,
                        "question": row.question,
                        "answer_text": row.answer_text,
                        "tags": row.tags,
                        "policy_anchor": row.policy_anchor or "",
                        "source": row.source or "",
                        "row_index": row.row_index
                    })

                vector_ids = await qdrant_service.upsert_vectors(
                    collection_name=request.collection_name,
                    vectors=embeddings,
                    texts=texts,
                    metadata_list=metadata_list
                )

                for i, row in enumerate(batch_rows):
                    results.append(QAEmbeddingResult(
                        row_index=row.row_index,
                        faq_id=row.faq_id,
                        success=True,
                        vector_id=vector_ids[i] if i < len(vector_ids) else None
                    ))
                    success_count += 1

                print(f"[INFO] Embedded batch {batch_start+1}-{batch_end}")

            except Exception as e:
                print(f"[ERROR] Failed to embed batch {batch_start+1}-{batch_end}: {e}")
                for row in batch_rows:
                    results.append(QAEmbeddingResult(
                        row_index=row.row_index,
                        faq_id=row.faq_id,
                        success=False,
                        error=str(e)
                    ))
                    failure_count += 1

        return QAEmbeddingResponse(
            total=len(rows),
            success_count=success_count,
            failure_count=failure_count,
            results=results
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] Q&A embedding failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Q&A 임베딩 실패: {str(e)}"
        )


# ==================== Dynamic Excel Embedding Endpoints ====================

# 스마트 컬럼 감지 규칙
TEXT_CANDIDATES = ['full_text', 'content', 'text', 'answer_text', 'body', 'description']
ID_CANDIDATES = ['id', 'faq_id', 'law_id', 'doc_id', 'item_id', 'code']
TAG_CANDIDATES = ['tag', 'tags', 'category', 'categories', 'label', 'labels']
QA_QUESTION_CANDIDATES = ['question', 'q', 'query', 'title']
QA_ANSWER_CANDIDATES = ['answer', 'answer_text', 'a', 'response', 'content']
# headings 컬럼 후보 (문서명, 페이지 등 참조문서 표시에 사용)
HEADING_SOURCE_CANDIDATES = ['source', 'document', 'doc_name', 'file', 'filename', 'document_name', 'ref', 'reference']
HEADING_PAGE_CANDIDATES = ['page', 'page_number', 'page_no', 'pg', 'section', 'chapter']


def detect_column_mapping(headers: List[str]) -> dict:
    """헤더를 분석하여 컬럼 매핑 자동 감지"""
    headers_lower = [h.lower() if h else '' for h in headers]

    detected = {
        "id_column": None,
        "text_columns": [],
        "tag_column": None,
        "is_qa_format": False,
        "question_column": None,
        "answer_column": None,
        "heading_columns": []  # 참조문서 표시용 컬럼들
    }

    # ID 컬럼 감지
    for candidate in ID_CANDIDATES:
        for i, h in enumerate(headers_lower):
            if candidate in h:
                detected["id_column"] = headers[i]
                break
        if detected["id_column"]:
            break

    # Q&A 패턴 감지
    for q_candidate in QA_QUESTION_CANDIDATES:
        for i, h in enumerate(headers_lower):
            if q_candidate == h or h.endswith(q_candidate):
                detected["question_column"] = headers[i]
                break
        if detected["question_column"]:
            break

    for a_candidate in QA_ANSWER_CANDIDATES:
        for i, h in enumerate(headers_lower):
            if a_candidate == h or h.endswith(a_candidate):
                detected["answer_column"] = headers[i]
                break
        if detected["answer_column"]:
            break

    if detected["question_column"] and detected["answer_column"]:
        detected["is_qa_format"] = True
        detected["text_columns"] = [detected["question_column"], detected["answer_column"]]
    else:
        # 일반 텍스트 컬럼 감지
        for candidate in TEXT_CANDIDATES:
            for i, h in enumerate(headers_lower):
                if candidate in h:
                    detected["text_columns"].append(headers[i])

    # 태그 컬럼 감지
    for candidate in TAG_CANDIDATES:
        for i, h in enumerate(headers_lower):
            if candidate == h:
                detected["tag_column"] = headers[i]
                break
        if detected["tag_column"]:
            break

    # headings 컬럼 감지 (소스/문서명 + 페이지/섹션 순서로)
    heading_source = None
    heading_page = None

    for candidate in HEADING_SOURCE_CANDIDATES:
        for i, h in enumerate(headers_lower):
            if candidate == h or candidate in h:
                heading_source = headers[i]
                break
        if heading_source:
            break

    for candidate in HEADING_PAGE_CANDIDATES:
        for i, h in enumerate(headers_lower):
            if candidate == h or candidate in h:
                heading_page = headers[i]
                break
        if heading_page:
            break

    # 감지된 컬럼들을 heading_columns에 추가 (소스 먼저, 페이지 다음)
    if heading_source:
        detected["heading_columns"].append(heading_source)
    if heading_page:
        detected["heading_columns"].append(heading_page)

    return detected


@router.post("/excel/preview", response_model=ExcelPreviewResponse)
async def preview_excel(file: UploadFile = File(...)):
    """
    Excel 파일 미리보기 및 스마트 컬럼 감지 API

    Args:
        file: 업로드된 Excel 파일 (.xlsx)

    Returns:
        ExcelPreviewResponse: 미리보기 데이터 및 감지된 매핑
    """
    try:
        import openpyxl

        if not file.filename.endswith(('.xlsx', '.xls')):
            raise HTTPException(
                status_code=400,
                detail="Excel 파일(.xlsx, .xls)만 지원합니다"
            )

        contents = await file.read()
        wb = openpyxl.load_workbook(io.BytesIO(contents))
        ws = wb.active

        headers = [cell.value for cell in ws[1] if cell.value]
        print(f"[INFO] Excel headers: {headers}")

        # 스마트 컬럼 매핑 감지
        detected_mapping = detect_column_mapping(headers)
        print(f"[INFO] Detected mapping: {detected_mapping}")

        # 모든 행 읽기
        rows = []
        for row_num in range(2, ws.max_row + 1):
            row_data = {}
            has_content = False

            for col_num, header in enumerate(headers):
                cell_value = ws.cell(row=row_num, column=col_num + 1).value
                if cell_value is not None:
                    row_data[header] = str(cell_value) if cell_value else ""
                    if str(cell_value).strip():
                        has_content = True
                else:
                    row_data[header] = ""

            if has_content:
                rows.append(ExcelPreviewRow(
                    row_index=row_num - 2,
                    data=row_data
                ))

        wb.close()

        print(f"[INFO] Parsed {len(rows)} rows from Excel")

        return ExcelPreviewResponse(
            total_rows=len(rows),
            headers=headers,
            preview_rows=rows,
            file_name=file.filename,
            detected_mapping=detected_mapping
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] Failed to parse Excel file: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Excel 파일 파싱 실패: {str(e)}"
        )


@router.post("/excel/embed", response_model=DynamicEmbeddingResponse)
async def embed_excel_dynamic(request: DynamicEmbeddingRequest):
    """
    동적 컬럼 매핑을 사용한 Excel 임베딩 API

    Args:
        request: 동적 임베딩 요청 (컬럼 매핑 포함)

    Returns:
        DynamicEmbeddingResponse: 임베딩 결과
    """
    results = []
    success_count = 0
    failure_count = 0

    try:
        # Collection 존재 확인
        collection_exists = await qdrant_service.collection_exists(request.collection_name)
        if not collection_exists:
            raise HTTPException(
                status_code=404,
                detail=f"Collection '{request.collection_name}'이 존재하지 않습니다"
            )

        mapping = request.mapping
        batch_size = 10
        rows = request.rows

        for batch_start in range(0, len(rows), batch_size):
            batch_end = min(batch_start + batch_size, len(rows))
            batch_rows = rows[batch_start:batch_end]

            try:
                # 임베딩 텍스트 생성
                texts = []
                for row in batch_rows:
                    if mapping.text_template:
                        # 템플릿 사용
                        text = mapping.text_template
                        for key, value in row.data.items():
                            text = text.replace(f"{{{key}}}", str(value) if value else "")
                    else:
                        # 텍스트 컬럼 연결
                        text_parts = []
                        for col in mapping.text_columns:
                            if col in row.data and row.data[col]:
                                text_parts.append(str(row.data[col]))
                        text = "\n".join(text_parts)

                    texts.append(text)

                # 임베딩 생성
                embeddings = await embedding_service.get_embeddings(texts)

                # 메타데이터 생성
                metadata_list = []
                for row in batch_rows:
                    metadata = {
                        "source_file": request.file_name,
                        "row_index": row.row_index
                    }

                    # ID 컬럼
                    if mapping.id_column and mapping.id_column in row.data:
                        metadata["id"] = row.data[mapping.id_column]

                    # 태그 컬럼
                    if mapping.tag_column and mapping.tag_column in row.data:
                        tag_value = row.data[mapping.tag_column]
                        if tag_value:
                            metadata["tags"] = [t.strip() for t in str(tag_value).split(',')]

                    # 메타데이터 컬럼들
                    for col in mapping.metadata_columns:
                        if col in row.data:
                            metadata[col] = row.data[col]

                    # 텍스트 컬럼들도 메타데이터에 저장
                    for col in mapping.text_columns:
                        if col in row.data:
                            metadata[col] = row.data[col]

                    # headings 생성 (참조문서 표시용)
                    if mapping.heading_columns:
                        # 사용자가 지정한 컬럼들로 headings 생성
                        headings = []
                        for col in mapping.heading_columns:
                            if col in row.data and row.data[col]:
                                headings.append(str(row.data[col]))
                        metadata["headings"] = headings if headings else [request.file_name, f"행 {row.row_index + 1}"]
                    else:
                        # 기본값: [파일명, 행 번호]
                        metadata["headings"] = [request.file_name, f"행 {row.row_index + 1}"]

                    metadata_list.append(metadata)

                # Qdrant 업로드
                vector_ids = await qdrant_service.upsert_vectors(
                    collection_name=request.collection_name,
                    vectors=embeddings,
                    texts=texts,
                    metadata_list=metadata_list
                )

                # 결과 기록
                for i, row in enumerate(batch_rows):
                    id_value = None
                    if mapping.id_column and mapping.id_column in row.data:
                        id_value = row.data[mapping.id_column]

                    results.append(DynamicEmbeddingResult(
                        row_index=row.row_index,
                        id_value=id_value,
                        success=True,
                        vector_id=vector_ids[i] if i < len(vector_ids) else None
                    ))
                    success_count += 1

                print(f"[INFO] Embedded batch {batch_start+1}-{batch_end}")

            except Exception as e:
                print(f"[ERROR] Failed to embed batch {batch_start+1}-{batch_end}: {e}")
                for row in batch_rows:
                    id_value = None
                    if mapping.id_column and mapping.id_column in row.data:
                        id_value = row.data[mapping.id_column]

                    results.append(DynamicEmbeddingResult(
                        row_index=row.row_index,
                        id_value=id_value,
                        success=False,
                        error=str(e)
                    ))
                    failure_count += 1

        return DynamicEmbeddingResponse(
            total=len(rows),
            success_count=success_count,
            failure_count=failure_count,
            results=results
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] Dynamic embedding failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Excel 임베딩 실패: {str(e)}"
        )
