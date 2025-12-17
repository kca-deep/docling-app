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
  streamMode: boolean;
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
