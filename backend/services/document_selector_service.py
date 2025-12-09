"""
문서 선택 및 샘플링 서비스
SQLite에서 문서를 조회하고 전략적 샘플링을 수행
"""
import logging
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

from backend.models.document import Document
from backend.services.document_crud import get_document_by_id, get_documents

logger = logging.getLogger(__name__)


class DocumentSelectorService:
    """문서 선택 및 샘플링 서비스"""

    # 기본 샘플링 설정
    DEFAULT_MAX_TOKENS = 4000
    DEFAULT_SAMPLE_RATIO = {
        "start": 0.20,   # 첫 20% (목차, 서론)
        "middle": 0.40,  # 중간 40% (본문)
        "end": 0.20,     # 끝 20% (부칙, 별표)
    }
    # 대략적인 토큰 추정: 한글 1글자 ≈ 0.5~1 토큰
    CHARS_PER_TOKEN = 2

    def get_documents_for_collection(
        self,
        db: Session,
        document_ids: Optional[List[int]] = None,
        search: Optional[str] = None,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """
        컬렉션의 문서 목록 조회

        Args:
            db: DB 세션
            document_ids: 특정 문서 ID 목록 (없으면 전체)
            search: 파일명 검색어
            limit: 최대 조회 개수

        Returns:
            문서 정보 리스트 (id, filename, file_type, created_at, page_count)
        """
        if document_ids:
            # 특정 문서들만 조회
            documents = []
            for doc_id in document_ids:
                doc = get_document_by_id(db, doc_id)
                if doc:
                    documents.append(doc)
            return [self._to_dict(doc) for doc in documents]
        else:
            # 전체 문서 조회 (검색 적용)
            documents, _ = get_documents(db, skip=0, limit=limit, search=search)
            return [self._to_dict(doc) for doc in documents]

    def get_document_content(
        self,
        db: Session,
        document_id: int
    ) -> Optional[str]:
        """
        문서 전체 내용 조회

        Args:
            db: DB 세션
            document_id: 문서 ID

        Returns:
            마크다운 콘텐츠 또는 None
        """
        doc = get_document_by_id(db, document_id)
        return doc.md_content if doc else None

    def sample_document(
        self,
        content: str,
        max_tokens: int = DEFAULT_MAX_TOKENS,
        strategy: str = "strategic"
    ) -> str:
        """
        문서 내용을 전략적으로 샘플링

        Args:
            content: 전체 문서 내용
            max_tokens: 최대 토큰 수
            strategy: 샘플링 전략 ("strategic", "head", "tail", "random")

        Returns:
            샘플링된 문서 내용
        """
        if not content:
            return ""

        max_chars = max_tokens * self.CHARS_PER_TOKEN

        if len(content) <= max_chars:
            # 전체 내용이 제한보다 작으면 그대로 반환
            return content

        if strategy == "head":
            return self._sample_head(content, max_chars)
        elif strategy == "tail":
            return self._sample_tail(content, max_chars)
        elif strategy == "random":
            return self._sample_random(content, max_chars)
        else:  # strategic (default)
            return self._sample_strategic(content, max_chars)

    def _sample_strategic(self, content: str, max_chars: int) -> str:
        """
        전략적 샘플링: 시작, 중간, 끝 부분 추출

        규정 문서의 경우:
        - 시작 20%: 목차, 총칙, 용어 정의
        - 중간 40%: 본문 핵심 내용
        - 끝 20%: 부칙, 별표, 별지
        """
        content_len = len(content)
        ratios = self.DEFAULT_SAMPLE_RATIO

        # 각 섹션 크기 계산
        start_chars = int(max_chars * ratios["start"] / (ratios["start"] + ratios["middle"] + ratios["end"]))
        middle_chars = int(max_chars * ratios["middle"] / (ratios["start"] + ratios["middle"] + ratios["end"]))
        end_chars = max_chars - start_chars - middle_chars

        # 섹션 위치 계산
        start_section = content[:start_chars]

        middle_start = content_len // 2 - middle_chars // 2
        middle_end = middle_start + middle_chars
        middle_section = content[middle_start:middle_end]

        end_section = content[-end_chars:]

        # 샘플 조합
        sample = f"""[문서 시작 부분]
{start_section}

[문서 중간 부분]
{middle_section}

[문서 끝 부분]
{end_section}"""

        return sample

    def _sample_head(self, content: str, max_chars: int) -> str:
        """앞부분만 샘플링"""
        return content[:max_chars]

    def _sample_tail(self, content: str, max_chars: int) -> str:
        """뒷부분만 샘플링"""
        return content[-max_chars:]

    def _sample_random(self, content: str, max_chars: int) -> str:
        """무작위 위치에서 샘플링"""
        import random
        content_len = len(content)
        if content_len <= max_chars:
            return content

        start = random.randint(0, content_len - max_chars)
        return content[start:start + max_chars]

    def sample_multiple_documents(
        self,
        db: Session,
        document_ids: List[int],
        max_tokens_total: int = DEFAULT_MAX_TOKENS
    ) -> str:
        """
        여러 문서를 샘플링하여 결합

        Args:
            db: DB 세션
            document_ids: 문서 ID 목록
            max_tokens_total: 전체 최대 토큰 수

        Returns:
            결합된 샘플 텍스트
        """
        if not document_ids:
            return ""

        # 각 문서당 할당 토큰
        tokens_per_doc = max_tokens_total // len(document_ids)
        samples = []

        for doc_id in document_ids:
            content = self.get_document_content(db, doc_id)
            if content:
                doc = get_document_by_id(db, doc_id)
                filename = doc.original_filename if doc else f"문서 {doc_id}"
                sample = self.sample_document(content, max_tokens=tokens_per_doc)
                samples.append(f"### {filename}\n{sample}")

        return "\n\n---\n\n".join(samples)

    def _to_dict(self, doc: Document) -> Dict[str, Any]:
        """Document 객체를 딕셔너리로 변환"""
        return {
            "id": doc.id,
            "original_filename": doc.original_filename,
            "file_type": doc.file_type,
            "created_at": doc.created_at.isoformat() if doc.created_at else None,
            "content_length": doc.content_length,
            "page_count": self._estimate_page_count(doc.content_length)
        }

    def _estimate_page_count(self, content_length: Optional[int]) -> Optional[int]:
        """콘텐츠 길이로 페이지 수 추정 (약 2000자/페이지)"""
        if not content_length:
            return None
        return max(1, content_length // 2000)


# 싱글톤 인스턴스
document_selector_service = DocumentSelectorService()
