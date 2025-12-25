"""
문서 업로드 스트리밍 유틸리티
SSE (Server-Sent Events) 기반 실시간 진행률 전송
"""
import asyncio
import json
import logging
from dataclasses import dataclass
from typing import Any, AsyncGenerator, Dict, List, Optional

logger = logging.getLogger(__name__)


@dataclass
class UploadProgress:
    """업로드 진행 상태"""
    phase: str
    message: str
    document_id: Optional[int] = None
    document_name: Optional[str] = None
    current: int = 0
    total: int = 0
    chunk_count: Optional[int] = None
    vector_count: Optional[int] = None
    error: Optional[str] = None


class SSEEventGenerator:
    """SSE 이벤트 생성기"""

    @staticmethod
    def format_event(event_type: str, data: Dict[str, Any]) -> str:
        """SSE 형식의 이벤트 문자열 생성"""
        return f"event: {event_type}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"

    @staticmethod
    def progress_event(progress: UploadProgress) -> str:
        """진행률 이벤트 생성"""
        data = {
            "phase": progress.phase,
            "message": progress.message,
            "current": progress.current,
            "total": progress.total
        }
        if progress.document_id is not None:
            data["document_id"] = progress.document_id
        if progress.document_name:
            data["document_name"] = progress.document_name
        if progress.chunk_count is not None:
            data["chunk_count"] = progress.chunk_count
        if progress.vector_count is not None:
            data["vector_count"] = progress.vector_count
        return SSEEventGenerator.format_event("progress", data)

    @staticmethod
    def complete_event(results: List[Dict[str, Any]], summary: Dict[str, Any]) -> str:
        """완료 이벤트 생성"""
        data = {
            "results": results,
            "summary": summary
        }
        return SSEEventGenerator.format_event("complete", data)

    @staticmethod
    def error_event(message: str, document_id: Optional[int] = None, document_name: Optional[str] = None) -> str:
        """에러 이벤트 생성"""
        data = {"message": message}
        if document_id is not None:
            data["document_id"] = document_id
        if document_name:
            data["document_name"] = document_name
        return SSEEventGenerator.format_event("error", data)


class DocumentUploadStreamer:
    """문서 업로드 스트리밍 처리기"""

    def __init__(
        self,
        embedding_service: Any,
        qdrant_service: Any,
        chunking_service: Any,
        db_session: Any
    ):
        self.embedding_service = embedding_service
        self.qdrant_service = qdrant_service
        self.chunking_service = chunking_service
        self.db = db_session

    async def process_documents_streaming(
        self,
        documents: List[Any],
        collection_name: str,
        chunk_size: int,
        chunk_overlap: int,
        batch_size: int
    ) -> AsyncGenerator[str, None]:
        """
        문서 업로드를 스트리밍으로 처리

        Args:
            documents: 업로드할 문서 목록
            collection_name: Qdrant 컬렉션 이름
            chunk_size: 청크 크기
            chunk_overlap: 청크 오버랩
            batch_size: 배치 크기

        Yields:
            SSE 형식의 이벤트 문자열
        """
        total_documents = len(documents)
        results = []
        total_chunks = 0
        total_vectors = 0

        # 시작 이벤트
        yield SSEEventGenerator.progress_event(UploadProgress(
            phase="start",
            message=f"{total_documents}개 문서 업로드 시작",
            current=0,
            total=total_documents
        ))

        for idx, doc in enumerate(documents):
            doc_name = doc.original_filename
            doc_id = doc.id

            try:
                # 1. 청킹 단계
                yield SSEEventGenerator.progress_event(UploadProgress(
                    phase="chunking",
                    message=f"문서 분할 중: {doc_name}",
                    document_id=doc_id,
                    document_name=doc_name,
                    current=idx + 1,
                    total=total_documents
                ))

                chunks = await self._chunk_document(doc, chunk_size, chunk_overlap)
                chunk_count = len(chunks)
                total_chunks += chunk_count

                # 2. 임베딩 단계
                yield SSEEventGenerator.progress_event(UploadProgress(
                    phase="embedding",
                    message=f"벡터 생성 중: {doc_name} ({chunk_count}개 청크)",
                    document_id=doc_id,
                    document_name=doc_name,
                    current=idx + 1,
                    total=total_documents,
                    chunk_count=chunk_count
                ))

                embeddings = await self._generate_embeddings(chunks, batch_size)

                # 3. 업로드 단계
                yield SSEEventGenerator.progress_event(UploadProgress(
                    phase="uploading",
                    message=f"Qdrant 업로드 중: {doc_name}",
                    document_id=doc_id,
                    document_name=doc_name,
                    current=idx + 1,
                    total=total_documents,
                    chunk_count=chunk_count
                ))

                vector_ids = await self._upload_to_qdrant(
                    collection_name, doc, chunks, embeddings
                )
                vector_count = len(vector_ids)
                total_vectors += vector_count

                # 성공 결과 기록
                results.append({
                    "document_id": doc_id,
                    "document_name": doc_name,
                    "success": True,
                    "chunk_count": chunk_count,
                    "vector_count": vector_count
                })

                yield SSEEventGenerator.progress_event(UploadProgress(
                    phase="document_complete",
                    message=f"완료: {doc_name}",
                    document_id=doc_id,
                    document_name=doc_name,
                    current=idx + 1,
                    total=total_documents,
                    chunk_count=chunk_count,
                    vector_count=vector_count
                ))

            except Exception as e:
                error_msg = str(e)
                logger.error(f"Document upload failed: {doc_name} - {error_msg}")

                results.append({
                    "document_id": doc_id,
                    "document_name": doc_name,
                    "success": False,
                    "error": error_msg
                })

                yield SSEEventGenerator.error_event(
                    message=f"업로드 실패: {doc_name} - {error_msg}",
                    document_id=doc_id,
                    document_name=doc_name
                )

            # 작은 지연으로 클라이언트 처리 시간 확보
            await asyncio.sleep(0.01)

        # 완료 이벤트
        success_count = sum(1 for r in results if r.get("success"))
        failure_count = len(results) - success_count

        summary = {
            "total_documents": total_documents,
            "success_count": success_count,
            "failure_count": failure_count,
            "total_chunks": total_chunks,
            "total_vectors": total_vectors
        }

        yield SSEEventGenerator.complete_event(results, summary)

    async def _chunk_document(
        self,
        doc: Any,
        chunk_size: int,
        chunk_overlap: int
    ) -> List[Dict[str, Any]]:
        """문서를 청크로 분할"""
        return await self.chunking_service.chunk_markdown(
            content=doc.md_content or "",
            chunk_size=chunk_size,
            overlap=chunk_overlap,
            document_name=doc.original_filename
        )

    async def _generate_embeddings(
        self,
        chunks: List[Dict[str, Any]],
        batch_size: int
    ) -> List[List[float]]:
        """청크에 대한 임베딩 생성"""
        texts = [chunk.get("text", "") for chunk in chunks]
        all_embeddings = []

        for i in range(0, len(texts), batch_size):
            batch_texts = texts[i:i + batch_size]
            batch_embeddings = await self.embedding_service.get_embeddings(batch_texts)
            all_embeddings.extend(batch_embeddings)

        return all_embeddings

    async def _upload_to_qdrant(
        self,
        collection_name: str,
        doc: Any,
        chunks: List[Dict[str, Any]],
        embeddings: List[List[float]]
    ) -> List[str]:
        """청크와 임베딩을 Qdrant에 업로드"""
        texts = [chunk.get("text", "") for chunk in chunks]
        metadata_list = []

        for i, chunk in enumerate(chunks):
            metadata = {
                "document_id": doc.id,
                "document_name": doc.original_filename,
                "chunk_index": i,
                "page_number": chunk.get("page_number"),
                "headings": chunk.get("headings", [])
            }
            metadata_list.append(metadata)

        vector_ids = await self.qdrant_service.upsert_vectors(
            collection_name=collection_name,
            vectors=embeddings,
            texts=texts,
            metadata_list=metadata_list
        )

        return vector_ids
