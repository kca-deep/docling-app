"""
Excel/QA 임베딩 스키마
엑셀 파일 처리 및 임베딩 관련
"""
from pydantic import BaseModel
from typing import Optional, List


class QAPreviewRow(BaseModel):
    """Q&A 미리보기 행"""
    row_index: int
    faq_id: str
    question: str
    answer_text: str
    tags: List[str]
    policy_anchor: Optional[str] = None
    source: Optional[str] = None


class QAPreviewResponse(BaseModel):
    """Q&A Excel 미리보기 응답"""
    total_rows: int
    headers: List[str]
    preview_rows: List[QAPreviewRow]
    file_name: str


class QAEmbeddingRequest(BaseModel):
    """Q&A 임베딩 요청"""
    collection_name: str
    rows: List[QAPreviewRow]


class QAEmbeddingResult(BaseModel):
    """Q&A 임베딩 결과 (개별)"""
    row_index: int
    faq_id: str
    success: bool
    vector_id: Optional[str] = None
    error: Optional[str] = None


class QAEmbeddingResponse(BaseModel):
    """Q&A 임베딩 응답 (전체)"""
    total: int
    success_count: int
    failure_count: int
    results: List[QAEmbeddingResult]


class ExcelPreviewRow(BaseModel):
    """Excel 미리보기 행 (동적)"""
    row_index: int
    data: dict  # 컬럼명: 값


class ExcelPreviewResponse(BaseModel):
    """Excel 미리보기 응답"""
    total_rows: int
    headers: List[str]
    preview_rows: List[ExcelPreviewRow]
    file_name: str
    detected_mapping: Optional[dict] = None  # 자동 감지된 컬럼 매핑


class ColumnMapping(BaseModel):
    """컬럼 매핑 설정"""
    id_column: Optional[str] = None  # ID로 사용할 컬럼
    text_columns: List[str]  # 임베딩 텍스트로 사용할 컬럼들
    text_template: Optional[str] = None  # 텍스트 템플릿 (예: "{question}\n{answer}")
    tag_column: Optional[str] = None  # 태그 컬럼
    metadata_columns: List[str] = []  # 메타데이터로 저장할 컬럼들
    heading_columns: List[str] = []  # headings로 사용할 컬럼들 (참조문서 표시용, 예: ["source", "page"])


class DynamicEmbeddingRequest(BaseModel):
    """동적 Excel 임베딩 요청"""
    collection_name: str
    file_name: str
    rows: List[ExcelPreviewRow]
    mapping: ColumnMapping


class DynamicEmbeddingResult(BaseModel):
    """동적 임베딩 결과 (개별)"""
    row_index: int
    id_value: Optional[str] = None
    success: bool
    vector_id: Optional[str] = None
    error: Optional[str] = None


class DynamicEmbeddingResponse(BaseModel):
    """동적 임베딩 응답 (전체)"""
    total: int
    success_count: int
    failure_count: int
    results: List[DynamicEmbeddingResult]
