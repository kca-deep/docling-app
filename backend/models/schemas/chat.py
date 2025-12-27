"""
Chat/RAG 스키마
채팅 및 검색-생성 관련
"""
from pydantic import BaseModel
from typing import Optional, List


class ChatMessage(BaseModel):
    """채팅 메시지"""
    role: str  # "user" or "assistant"
    content: str


class ChatRequest(BaseModel):
    """채팅 요청"""
    session_id: Optional[str] = None  # 세션 ID (선택적, 없으면 서버에서 생성)
    conversation_id: Optional[str] = None  # 대화 ID (선택적)
    collection_name: Optional[str] = None  # 컬렉션 이름 (None이면 일상대화 모드)
    temp_collection_name: Optional[str] = None  # 임시 컬렉션명 (채팅 문서 업로드용)
    message: str
    model: str = "gpt-oss-20b"  # LLM 모델 선택
    reasoning_level: str = "medium"  # "low", "medium", "high"
    temperature: float = 0.7
    max_tokens: int = 2000
    top_p: float = 0.9
    frequency_penalty: float = 0.0
    presence_penalty: float = 0.0
    top_k: int = 5
    score_threshold: Optional[float] = None
    chat_history: Optional[List[ChatMessage]] = None
    stream: bool = False
    use_reranking: bool = True  # Reranking 사용 여부 (P0: 기본 활성화)
    use_hybrid: bool = True  # 하이브리드 검색 사용 여부 (벡터 + BM25)


class RetrievedDocument(BaseModel):
    """검색된 문서"""
    id: str
    score: float
    text: str
    metadata: Optional[dict] = None
    keywords: Optional[List[str]] = None  # 쿼리와 매칭된 키워드 목록


class ChatResponse(BaseModel):
    """채팅 응답"""
    session_id: Optional[str] = None  # 세션 ID
    conversation_id: Optional[str] = None  # 대화 ID
    answer: str
    reasoning_content: Optional[str] = None  # GPT-OSS 추론 과정 (high 레벨)
    retrieved_docs: List[RetrievedDocument]
    usage: Optional[dict] = None


class RegenerateRequest(BaseModel):
    """응답 재생성 요청"""
    query: str
    collection_name: Optional[str] = None  # 컬렉션 이름 (None이면 일상대화 모드)
    retrieved_docs: List[RetrievedDocument]
    model: str = "gpt-oss-20b"  # LLM 모델 선택
    reasoning_level: str = "medium"
    temperature: float = 0.7
    max_tokens: int = 2000
    top_p: float = 0.9
    frequency_penalty: float = 0.0
    presence_penalty: float = 0.0
    chat_history: Optional[List[ChatMessage]] = None
    session_id: Optional[str] = None  # 세션 ID (로깅용)


class DefaultSettingsResponse(BaseModel):
    """기본 설정 응답 (.env 파일 값 제공)"""
    model: str
    reasoning_level: str
    temperature: float
    max_tokens: int
    top_p: float
    top_k: int
    use_reranking: bool
