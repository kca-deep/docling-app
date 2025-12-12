// 공통 타입 정의

export interface Document {
  id: number
  task_id: string
  original_filename: string
  content_length: number | null
  content_preview: string | null
  processing_time: number | null
  created_at: string
  category: string | null  // 카테고리(컬렉션명) 추가
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
  documents_count: number
  points_count: number
  vector_size: number
  distance: string
  visibility?: string
  description?: string
  owner_id?: number
  is_owner?: boolean
}

export interface QdrantUploadResult {
  document_id: number
  filename: string
  success: boolean
  chunk_count: number
  vector_ids: string[]
  error: string | null
}

export type UploadTarget = "dify" | "qdrant"

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
