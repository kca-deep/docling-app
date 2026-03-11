// app/chat/types.ts
// 채팅 관련 공통 타입 정의

/**
 * 참조 문서 소스 정보
 */
export interface Source {
  id: string;
  title: string;
  content: string;
  score: number;
  keywords?: string[];  // 쿼리와 매칭된 키워드 목록
  citedPhrases?: string[];  // LLM 응답에서 인용된 구절 목록
  metadata?: {
    page?: number;
    file?: string;
    url?: string;
    section?: string;
    chunk_index?: number;
    document_id?: number;
    num_tokens?: number;
  };
}

/**
 * Code Interpreter 코드 실행 결과
 */
export interface CodeExecution {
  status: "running" | "success" | "error" | "failed";
  code?: string;
  description?: string;
  attempt?: number;
  stdout?: string;
  stderr?: string;
  images?: string[];  // base64 인코딩된 이미지
  error?: string;
  executionTimeMs?: number;
}

/**
 * 데이터 분석 세션 정보
 */
export interface ColumnDetail {
  name: string;
  dtype: string;
  nullRatio: number;
  sampleValues: string[];
}

export interface DataSessionInfo {
  sessionId: string;
  filename: string;
  fileSize: number;
  sheets: {
    name: string;
    rows: number;
    columns: number;
    columnNames: string[];
    columnTypes: string[];
    columnDetails?: ColumnDetail[];
  }[];
}

/**
 * 채팅 메시지
 */
export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  model?: string;
  sources?: Source[];
  reasoningContent?: string;
  codeExecutions?: CodeExecution[];  // Code Interpreter 실행 결과
  isError?: boolean;  // 에러 메시지 여부 (컬렉션 만료 등)
  metadata?: {
    tokens?: number;
    processingTime?: number;
    aborted?: boolean;
  };
  regenerationContext?: {
    originalQuery: string;
    collectionName: string;
    settings: ChatSettings;
    retrievedDocs: RetrievedDocument[];
  };
}

/**
 * 검색된 문서 (RAG 검색 결과)
 */
export interface RetrievedDocument {
  id: string;
  text: string;
  score: number;
  keywords?: string[];  // 쿼리와 매칭된 키워드 목록
  citedPhrases?: string[];  // LLM 응답에서 인용된 구절 목록
  metadata?: {
    filename?: string;
    document_id?: number;
    chunk_index?: number;
    num_tokens?: number;
    headings?: string[];
    page?: number;
    url?: string;
  };
}

/**
 * Qdrant 컬렉션 정보
 */
export interface Collection {
  name: string;
  documents_count: number;
  points_count: number;
  vector_size: number;
  distance: string;
  visibility?: string;
  description?: string;
  owner_id?: number;
  is_owner?: boolean;
}

/**
 * 채팅 설정
 */
export interface ChatSettings {
  model: string;
  reasoningLevel: string;
  temperature: number;
  maxTokens: number;
  topP: number;
  topK: number;
  frequencyPenalty: number;
  presencePenalty: number;
  useReranking: boolean;
}

/**
 * 참조문서 패널 상태
 */
export interface ArtifactState {
  isOpen: boolean;
  sources: Source[];
  activeSourceId: string | null;
  messageId: string | null;
}

/**
 * 인용 메시지
 */
export interface QuotedMessage {
  id?: string;
  content: string;
  role: "user" | "assistant";
}

/**
 * 피드백 카테고리 (부정 피드백용)
 */
export type FeedbackCategory =
  | "inaccurate"   // 부정확함
  | "incomplete"   // 불완전함
  | "irrelevant"   // 관련없음
  | "outdated"     // 구버전
  | "other";       // 기타

/**
 * 피드백 평가
 */
export type FeedbackRating = "positive" | "negative";

/**
 * 피드백 생성 요청
 */
export interface FeedbackCreateRequest {
  message_id: string;
  session_id: string;
  collection_name: string;
  rating: FeedbackRating;
  category?: FeedbackCategory;
  comment?: string;
  user_query: string;
  assistant_response?: string;
  llm_model?: string;
  reasoning_level?: string;
  retrieved_docs_count?: number;
}

/**
 * 피드백 응답
 */
export interface FeedbackResponse {
  feedback_id: string;
  message_id: string;
  rating: FeedbackRating;
  created_at: string;
}

/**
 * 피드백 존재 여부 응답
 */
export interface FeedbackExistsResponse {
  exists: boolean;
  rating?: FeedbackRating;
}
