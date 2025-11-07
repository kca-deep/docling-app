"""
Document CRUD operations
"""
from sqlalchemy.orm import Session
from backend.models.document import Document
from backend.models.schemas import DocumentSaveRequest
from typing import List, Optional
from datetime import datetime


def create_document(db: Session, doc_request: DocumentSaveRequest) -> Document:
    """
    문서 저장

    Args:
        db: DB 세션
        doc_request: 문서 저장 요청 데이터

    Returns:
        저장된 Document 객체
    """
    # 콘텐츠 메타데이터 생성
    content_length = len(doc_request.md_content) if doc_request.md_content else 0
    content_preview = doc_request.md_content[:500] if doc_request.md_content else None

    # 파일 타입 추출 (파일명에서)
    file_type = doc_request.file_type
    if not file_type and doc_request.original_filename:
        file_type = doc_request.original_filename.split(".")[-1].lower()

    # Document 객체 생성
    db_document = Document(
        task_id=doc_request.task_id,
        original_filename=doc_request.original_filename,
        file_size=doc_request.file_size,
        file_type=file_type,
        md_content=doc_request.md_content,
        processing_time=doc_request.processing_time,
        parse_options=doc_request.parse_options,
        content_length=content_length,
        content_preview=content_preview,
        status="success",
    )

    db.add(db_document)
    db.commit()
    db.refresh(db_document)

    return db_document


def get_document_by_id(db: Session, document_id: int) -> Optional[Document]:
    """
    ID로 문서 조회

    Args:
        db: DB 세션
        document_id: 문서 ID

    Returns:
        Document 객체 또는 None
    """
    document = db.query(Document).filter(Document.id == document_id).first()

    # 조회 시 last_accessed_at 업데이트
    if document:
        document.last_accessed_at = datetime.utcnow()
        db.commit()

    return document


def get_document_by_task_id(db: Session, task_id: str) -> Optional[Document]:
    """
    Task ID로 문서 조회

    Args:
        db: DB 세션
        task_id: Docling API task ID

    Returns:
        Document 객체 또는 None
    """
    return db.query(Document).filter(Document.task_id == task_id).first()


def get_documents(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    order_by: str = "created_at",
    search: Optional[str] = None
) -> tuple[List[Document], int]:
    """
    문서 목록 조회 (검색 및 페이징)

    Args:
        db: DB 세션
        skip: 건너뛸 개수 (페이징)
        limit: 가져올 최대 개수
        order_by: 정렬 기준 ("created_at", "updated_at")
        search: 검색어 (파일명 검색)

    Returns:
        (Document 리스트, 전체 개수)
    """
    query = db.query(Document)

    # 검색 필터
    if search:
        query = query.filter(Document.original_filename.contains(search))

    # 전체 개수 조회 (페이징 전)
    total = query.count()

    # 정렬
    if order_by == "updated_at":
        query = query.order_by(Document.updated_at.desc())
    else:
        query = query.order_by(Document.created_at.desc())

    # 페이징
    documents = query.offset(skip).limit(limit).all()

    return documents, total


def delete_document(db: Session, document_id: int) -> bool:
    """
    문서 삭제

    Args:
        db: DB 세션
        document_id: 문서 ID

    Returns:
        삭제 성공 여부
    """
    document = db.query(Document).filter(Document.id == document_id).first()

    if not document:
        return False

    db.delete(document)
    db.commit()

    return True


def increment_download_count(db: Session, document_id: int) -> Optional[Document]:
    """
    다운로드 횟수 증가

    Args:
        db: DB 세션
        document_id: 문서 ID

    Returns:
        업데이트된 Document 객체 또는 None
    """
    document = db.query(Document).filter(Document.id == document_id).first()

    if not document:
        return None

    document.download_count += 1
    document.last_accessed_at = datetime.utcnow()
    db.commit()
    db.refresh(document)

    return document
