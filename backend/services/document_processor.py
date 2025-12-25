"""
백그라운드 문서 처리 서비스
- Docling 파싱 -> 청킹 -> 임베딩 -> Qdrant 저장
- Excel 파일 직접 처리 지원
"""
import asyncio
import logging
import io
from typing import Dict, Optional, List, Tuple
from enum import Enum
from dataclasses import dataclass, field
from pathlib import Path

logger = logging.getLogger(__name__)


def parse_excel_to_markdown(file_content: bytes, filename: str) -> Tuple[str, int]:
    """
    Excel 파일을 마크다운으로 변환

    Args:
        file_content: 파일 내용 (바이트)
        filename: 파일명

    Returns:
        Tuple[str, int]: (마크다운 내용, 시트 수)
    """
    import pandas as pd

    # 파일 확장자 확인
    ext = Path(filename).suffix.lower()

    try:
        # Excel 파일 읽기
        if ext == ".xls":
            excel_file = pd.ExcelFile(io.BytesIO(file_content), engine="xlrd")
        else:  # .xlsx
            excel_file = pd.ExcelFile(io.BytesIO(file_content), engine="openpyxl")

        sheet_names = excel_file.sheet_names
        md_parts = [f"# {filename}\n"]
        sheet_count = len(sheet_names)

        for sheet_name in sheet_names:
            df = pd.read_excel(excel_file, sheet_name=sheet_name)

            if df.empty:
                continue

            # 시트별 섹션
            md_parts.append(f"\n## {sheet_name}\n")

            # DataFrame을 마크다운 테이블로 변환
            # 헤더
            headers = df.columns.tolist()
            md_parts.append("| " + " | ".join(str(h) for h in headers) + " |")
            md_parts.append("| " + " | ".join("---" for _ in headers) + " |")

            # 데이터 행 (최대 1000행으로 제한)
            max_rows = min(len(df), 1000)
            for idx in range(max_rows):
                row = df.iloc[idx]
                values = [str(v) if pd.notna(v) else "" for v in row.tolist()]
                # 파이프 문자 이스케이프
                values = [v.replace("|", "\\|").replace("\n", " ") for v in values]
                md_parts.append("| " + " | ".join(values) + " |")

            if len(df) > max_rows:
                md_parts.append(f"\n*... {len(df) - max_rows}개 행 생략 ...*\n")

        return "\n".join(md_parts), sheet_count

    except Exception as e:
        logger.error(f"Excel parsing error: {e}")
        raise Exception(f"Excel 파일 파싱 실패: {e}")


class ProcessingStage(str, Enum):
    """문서 처리 단계"""
    UPLOADING = "uploading"
    PARSING = "parsing"
    CHUNKING = "chunking"
    EMBEDDING = "embedding"
    INDEXING = "indexing"
    READY = "ready"
    ERROR = "error"


@dataclass
class ProcessingStatus:
    """문서 처리 상태"""
    stage: ProcessingStage
    progress: int
    filename: str
    collection_name: Optional[str] = None
    error: Optional[str] = None
    page_count: int = 0


class DocumentProcessor:
    """백그라운드 문서 처리"""

    def __init__(self):
        self._status: Dict[str, ProcessingStatus] = {}
        self._lock = asyncio.Lock()

    def get_status(self, task_id: str) -> Optional[ProcessingStatus]:
        """
        처리 상태 조회

        Args:
            task_id: 작업 ID

        Returns:
            Optional[ProcessingStatus]: 처리 상태 (없으면 None)
        """
        return self._status.get(task_id)

    async def _update_status(
        self,
        task_id: str,
        stage: ProcessingStage,
        progress: int,
        error: Optional[str] = None,
        collection_name: Optional[str] = None,
        page_count: int = 0
    ):
        """상태 업데이트"""
        async with self._lock:
            if task_id in self._status:
                self._status[task_id].stage = stage
                self._status[task_id].progress = progress
                if error:
                    self._status[task_id].error = error
                if collection_name:
                    self._status[task_id].collection_name = collection_name
                if page_count:
                    self._status[task_id].page_count = page_count

    async def process_document(
        self,
        task_id: str,
        session_id: str,
        file_content: bytes,
        filename: str,
        existing_collection_name: Optional[str] = None
    ) -> Optional[str]:
        """
        문서 처리 (백그라운드)

        Args:
            task_id: 작업 ID
            session_id: 세션 ID
            file_content: 파일 내용 (바이트)
            filename: 파일명
            existing_collection_name: 기존 컬렉션명 (다중 파일 업로드 시)

        Returns:
            Optional[str]: 생성된 임시 컬렉션명 (실패 시 None)
        """
        # 초기 상태 설정
        self._status[task_id] = ProcessingStatus(
            stage=ProcessingStage.UPLOADING,
            progress=0,
            filename=filename
        )

        try:
            # 지연 임포트 (순환 참조 방지)
            from backend.services.temp_collection_manager import get_temp_collection_manager
            from backend.services.docling_service import get_docling_service
            from backend.services.chunking_service import ChunkingService
            from backend.services.embedding_service import EmbeddingService
            from backend.config.settings import settings

            temp_manager = get_temp_collection_manager()
            docling_service = get_docling_service()
            chunking_service = ChunkingService(
                base_url=settings.DOCLING_CHUNKING_URL,
                poll_interval=settings.POLL_INTERVAL
            )
            embedding_service = EmbeddingService(
                base_url=settings.EMBEDDING_URL,
                model=settings.EMBEDDING_MODEL
            )

            # 1. 임시 컬렉션 생성 또는 기존 컬렉션 사용
            if existing_collection_name:
                # 기존 컬렉션 사용 (다중 파일 업로드)
                collection_name = existing_collection_name
                logger.info(f"[{task_id}] Using existing collection: {collection_name}")
            else:
                # 새 컬렉션 생성
                collection_name = await temp_manager.create_collection(session_id)
                logger.info(f"[{task_id}] Created new collection: {collection_name}")
            await self._update_status(
                task_id, ProcessingStage.PARSING, 10,
                collection_name=collection_name
            )

            # 2. 파싱 (10-40%) - Excel은 직접 처리, 나머지는 Docling
            logger.info(f"[{task_id}] Parsing document: {filename}")
            file_ext = Path(filename).suffix.lower()
            is_excel = file_ext in [".xlsx", ".xls"]

            if is_excel:
                # Excel 파일 직접 처리
                md_content, sheet_count = parse_excel_to_markdown(file_content, filename)
                logger.info(f"[{task_id}] Excel parsed: {sheet_count} sheets")
            else:
                # Docling 서비스로 파싱
                # Note: convert_document() 내부에서 DOCLING_CLEAR_CACHE_INTERVAL 설정에 따라
                # 자동으로 VRAM 캐시 정리됨 (중복 호출 불필요)
                result = await docling_service.convert_document(file_content, filename)

                if not result.document or not result.document.md_content:
                    error_msg = result.error if result.error else "문서 파싱 실패: 내용을 추출할 수 없습니다"
                    raise Exception(error_msg)

                md_content = result.document.md_content

            await self._update_status(task_id, ProcessingStage.CHUNKING, 40)

            # 3. 청킹 (40-60%)
            logger.info(f"[{task_id}] Chunking document")
            chunks_result = await chunking_service.chunk_markdown(
                md_content,
                max_tokens=settings.DEFAULT_CHUNK_SIZE,
                overlap_tokens=settings.DEFAULT_CHUNK_OVERLAP,
                filename=filename
            )

            if not chunks_result:
                raise Exception("청킹 결과가 비어 있습니다")

            chunk_texts = [c.get("text", "") for c in chunks_result]
            metadata = []
            for i, c in enumerate(chunks_result):
                # meta 필드에서 page 정보 추출 (Docling chunking 결과 형식)
                meta = c.get("meta", {})
                page_num = meta.get("page", 1) if isinstance(meta, dict) else 1

                metadata.append({
                    "page_number": page_num,
                    "chunk_index": i,
                    "headings": c.get("headings", []),
                    "filename": filename
                })

            # 페이지 수 계산
            page_count = max((m["page_number"] for m in metadata), default=1)
            await self._update_status(
                task_id, ProcessingStage.EMBEDDING, 60,
                page_count=page_count
            )

            # 4. 임베딩 생성 (60-85%)
            logger.info(f"[{task_id}] Generating embeddings for {len(chunk_texts)} chunks")
            embeddings = await embedding_service.get_embeddings(chunk_texts)
            await self._update_status(task_id, ProcessingStage.INDEXING, 85)

            # 5. Qdrant 저장 (85-100%)
            logger.info(f"[{task_id}] Storing in Qdrant collection: {collection_name}")
            await temp_manager.add_documents(
                collection_name=collection_name,
                chunks=chunk_texts,
                embeddings=embeddings,
                metadata=metadata
            )
            await self._update_status(task_id, ProcessingStage.READY, 100)

            logger.info(f"[{task_id}] Document processing complete: {collection_name}")
            return collection_name

        except Exception as e:
            logger.error(f"[{task_id}] Document processing failed: {e}")
            await self._update_status(
                task_id, ProcessingStage.ERROR, 0,
                error=str(e)
            )
            return None

    def cleanup_status(self, task_id: str):
        """
        상태 정보 정리

        Args:
            task_id: 작업 ID
        """
        if task_id in self._status:
            del self._status[task_id]


# 싱글톤 인스턴스
document_processor = DocumentProcessor()
