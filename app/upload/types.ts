// 공통 타입 정의

export interface Document {
  id: number
  task_id: string
  original_filename: string
  content_length: number | null
  content_preview: string | null
  processing_time: number | null
  created_at: string
}

export interface DifyDataset {
  id: string
  name: string
  description: string | null
  document_count: number
  word_count: number
}

export interface DifyUploadResult {
  document_id: number
  filename: string
  success: boolean
  dify_document_id: string | null
  error: string | null
}

export interface QdrantCollection {
  name: string
  vectors_count: number
  points_count: number
  vector_size: number
  distance: string
}

export interface QdrantUploadResult {
  document_id: number
  filename: string
  success: boolean
  chunk_count: number
  vector_ids: string[]
  error: string | null
}

export type UploadTarget = "dify" | "qdrant" | "qa"

// Q&A Excel 임베딩 관련 타입
export interface QAPreviewRow {
  row_index: number
  faq_id: string
  question: string
  answer_text: string
  tags: string[]
  policy_anchor: string | null
  source: string | null
}

export interface QAPreviewResponse {
  total_rows: number
  headers: string[]
  preview_rows: QAPreviewRow[]
  file_name: string
}

export interface QAEmbeddingResult {
  row_index: number
  faq_id: string
  success: boolean
  vector_id: string | null
  error: string | null
}

export interface DifySettings {
  apiKey: string
  baseUrl: string
  selectedDataset: string
  datasets: DifyDataset[]
}

export interface QdrantSettings {
  selectedCollection: string
  collections: QdrantCollection[]
  chunkSize: number
  chunkOverlap: number
}
