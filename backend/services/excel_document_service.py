"""
엑셀 문서 SQLite 저장 서비스

엑셀 업로드 시 Document 테이블에 메타데이터를 기록하기 위한 헬퍼 함수들.
- md_content: 메타정보만 저장 (청크 기반 샘플링 사용)
- 실제 데이터는 Qdrant에 행 단위로 임베딩
"""
from typing import List, Optional


def generate_excel_metadata_content(
    file_name: str,
    rows: List[dict],
    mapping: dict,
    total_rows: int
) -> str:
    """
    엑셀 문서의 md_content용 메타정보 생성

    프롬프트 생성 시 청크 기반 샘플링(sample_documents_from_chunks)을 사용하므로
    전체 데이터 대신 메타정보만 저장합니다.

    Args:
        file_name: 원본 파일명
        rows: ExcelPreviewRow 리스트 (첫 번째 행에서 헤더 추출용)
        mapping: ColumnMapping dict
        total_rows: 전체 행 수

    Returns:
        메타정보 마크다운 문자열
    """
    # 헤더 추출
    headers = list(rows[0].get("data", {}).keys()) if rows else []

    # 매핑 정보 추출
    text_columns = mapping.get("text_columns", [])
    metadata_columns = mapping.get("metadata_columns", [])
    id_column = mapping.get("id_column")
    tag_column = mapping.get("tag_column")
    heading_columns = mapping.get("heading_columns", [])

    return f"""# {file_name}

## 문서 정보
- **유형**: Excel 데이터
- **총 행 수**: {total_rows}
- **컬럼**: {', '.join(headers) if headers else '없음'}

## 매핑 설정
- **텍스트 컬럼**: {', '.join(text_columns) if text_columns else '없음'}
- **메타데이터 컬럼**: {', '.join(metadata_columns) if metadata_columns else '없음'}
- **ID 컬럼**: {id_column or '없음'}
- **태그 컬럼**: {tag_column or '없음'}
- **헤딩 컬럼**: {', '.join(heading_columns) if heading_columns else '없음'}

## 샘플링 안내
이 문서의 내용은 Qdrant 벡터 DB에 행 단위로 임베딩되어 있습니다.
프롬프트 자동생성 시 청크 기반 샘플링을 통해 의미론적으로 관련된 행들이 자동 추출됩니다.
"""


def generate_preview(texts: List[str], max_length: int = 500) -> str:
    """
    텍스트 목록에서 미리보기 생성

    Args:
        texts: 텍스트 목록
        max_length: 최대 길이

    Returns:
        미리보기 문자열
    """
    combined = " ".join(t for t in texts if t)
    if len(combined) > max_length:
        return combined[:max_length]
    return combined


def calculate_total_length(rows: List[dict], text_columns: List[str]) -> int:
    """
    전체 텍스트 길이 계산

    Args:
        rows: ExcelPreviewRow 리스트
        text_columns: 텍스트 컬럼 목록

    Returns:
        전체 문자 수
    """
    total = 0
    for row in rows:
        data = row.get("data", {})
        for col in text_columns:
            if col in data and data[col]:
                total += len(str(data[col]))
    return total


def extract_texts_from_rows(
    rows: List[dict],
    mapping: dict,
    limit: int = 5
) -> List[str]:
    """
    행 목록에서 텍스트 추출 (미리보기용)

    Args:
        rows: ExcelPreviewRow 리스트
        mapping: ColumnMapping dict
        limit: 추출할 최대 행 수

    Returns:
        텍스트 목록
    """
    texts = []
    text_columns = mapping.get("text_columns", [])
    text_template = mapping.get("text_template")

    for row in rows[:limit]:
        data = row.get("data", {})

        if text_template:
            # 템플릿 사용
            text = text_template
            for key, value in data.items():
                text = text.replace(f"{{{key}}}", str(value) if value else "")
            texts.append(text)
        else:
            # 텍스트 컬럼 연결
            text_parts = []
            for col in text_columns:
                if col in data and data[col]:
                    text_parts.append(str(data[col]))
            if text_parts:
                texts.append("\n".join(text_parts))

    return texts
