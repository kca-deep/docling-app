import { API_BASE_URL } from "@/lib/api-config"

const BASE = `${API_BASE_URL}/api/showcase`

export interface ShowcaseCategory {
  id: number
  key: string
  name: string
  icon: string
  color: string
  description?: string
  sort_order: number
  item_count: number
}

export interface ShowcaseItem {
  id: number
  category_key: string
  category_name: string
  title: string
  summary: string
  item_type: string
  difficulty: string
  tags: string[]
  author_name?: string
  author_id?: number
  thumbnail_url?: string
  image_urls?: string[]
  view_count: number
  is_featured: boolean
  is_published: boolean
  created_at: string
}

export interface ShowcaseItemDetail extends ShowcaseItem {
  content: string
  install_command?: string
  source_url?: string
  updated_at: string
}

export interface ShowcaseListResponse {
  items: ShowcaseItem[]
  total: number
  skip: number
  limit: number
  has_next: boolean
}

export interface ShowcaseStatsResponse {
  total_items: number
  category_counts: Record<string, number>
  featured_count: number
  recent_count: number
}

export interface ShowcaseItemCreate {
  category_key: string
  title: string
  summary: string
  content: string
  item_type: string
  difficulty: string
  tags: string[]
  install_command?: string
  source_url?: string
  thumbnail_url?: string
  image_urls: string[]
  is_published: boolean
}

/** 쇼케이스 아이템당 첨부 이미지(갤러리) 최대 개수 (UX 가드 — 서버가 최종 권위) */
export const SHOWCASE_MAX_IMAGES = 10

export interface ShowcaseItemsParams {
  category?: string
  type?: string
  difficulty?: string
  search?: string
  tags?: string
  featured?: boolean
  sort?: "created_at" | "view_count"
  order?: "asc" | "desc"
  skip?: number
  limit?: number
}

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: "include", ...init })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || `HTTP ${res.status}`)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

/** 상대 이미지 경로(/api/showcase/images/...)를 절대 URL로 변환 */
export function showcaseImageUrl(path?: string | null): string | undefined {
  if (!path) return undefined
  if (/^https?:\/\//.test(path)) return path
  return `${API_BASE_URL}${path}`
}

// === 문서 업로드 자동 추출 (보조 입력) ===
// 클라이언트 1차 검증/UX 가드용 상수 (서버가 최종 권위 — backend SHOWCASE_EXTRACT_*)
export const EXTRACT_ACCEPT = ".hwp,.hwpx,.pdf,.docx"
export const EXTRACT_ALLOWED_EXTS = [".hwp", ".hwpx", ".pdf", ".docx"]
export const EXTRACT_MAX_MB = 20
export const EXTRACT_TIMEOUT_MS = 120_000

export interface ShowcaseExtractSuggestion {
  category_key?: string
  title?: string
  summary?: string
  content?: string
  item_type?: string
  difficulty?: string
  tags?: string[]
}

export interface ShowcaseExtractResponse {
  suggestion: ShowcaseExtractSuggestion
  warnings: string[]
  parser_used: string
  llm_used: boolean
  source_markdown?: string
}

/** 문서를 업로드해 입력항목 제안값을 받는다 (DB 미변경, 폼 프리필용). */
export async function extractFromFile(
  file: File,
  signal?: AbortSignal
): Promise<ShowcaseExtractResponse> {
  const fd = new FormData()
  fd.append("file", file)
  const res = await fetch(`${BASE}/extract`, {
    method: "POST",
    credentials: "include",
    body: fd,
    signal,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function uploadShowcaseImage(file: File): Promise<{ url: string }> {
  const fd = new FormData()
  fd.append("file", file)
  const res = await fetch(`${BASE}/upload-image`, {
    method: "POST",
    credentials: "include",
    body: fd,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function uploadShowcaseImages(files: File[]): Promise<{ urls: string[] }> {
  const fd = new FormData()
  files.forEach((f) => fd.append("files", f))
  const res = await fetch(`${BASE}/upload-images`, {
    method: "POST",
    credentials: "include",
    body: fd,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function getCategories(): Promise<ShowcaseCategory[]> {
  return apiFetch(`${BASE}/categories`)
}

export async function getStats(): Promise<ShowcaseStatsResponse> {
  return apiFetch(`${BASE}/stats`)
}

export async function getItems(params: ShowcaseItemsParams = {}): Promise<ShowcaseListResponse> {
  const q = new URLSearchParams()
  if (params.category)             q.set("category", params.category)
  if (params.type)                 q.set("type", params.type)
  if (params.difficulty)           q.set("difficulty", params.difficulty)
  if (params.search)               q.set("search", params.search)
  if (params.tags)                 q.set("tags", params.tags)
  if (params.featured !== undefined) q.set("featured", String(params.featured))
  if (params.sort)                 q.set("sort", params.sort)
  if (params.order)                q.set("order", params.order)
  if (params.skip !== undefined)   q.set("skip", String(params.skip))
  if (params.limit !== undefined)  q.set("limit", String(params.limit))
  return apiFetch(`${BASE}/?${q}`)
}

export async function getItemDetail(id: number, incrementView = true): Promise<ShowcaseItemDetail> {
  return apiFetch(`${BASE}/${id}?increment_view=${incrementView}`)
}

export async function createItem(data: ShowcaseItemCreate): Promise<ShowcaseItemDetail> {
  return apiFetch(`${BASE}/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
}

export async function updateItem(id: number, data: ShowcaseItemCreate): Promise<ShowcaseItemDetail> {
  return apiFetch(`${BASE}/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
}

export async function deleteItem(id: number): Promise<void> {
  return apiFetch(`${BASE}/${id}`, { method: "DELETE" })
}

export async function toggleFeatured(id: number): Promise<ShowcaseItemDetail> {
  return apiFetch(`${BASE}/${id}/featured`, { method: "PATCH" })
}

export async function togglePublish(id: number): Promise<ShowcaseItemDetail> {
  return apiFetch(`${BASE}/${id}/publish`, { method: "PATCH" })
}

export interface ShowcaseComment {
  id: number
  item_id: number
  author_id?: number
  author_name: string
  content: string
  has_password: boolean
  created_at: string
}

export interface ShowcaseCommentCreate {
  author_name: string
  content: string
  password?: string
}

export interface ShowcaseCommentListResponse {
  comments: ShowcaseComment[]
  total: number
  has_next: boolean
}

export async function getComments(
  itemId: number,
  params: { skip?: number; limit?: number } = {}
): Promise<ShowcaseCommentListResponse> {
  const q = new URLSearchParams()
  if (params.skip !== undefined) q.set("skip", String(params.skip))
  if (params.limit !== undefined) q.set("limit", String(params.limit))
  return apiFetch(`${BASE}/${itemId}/comments?${q}`)
}

export async function createComment(
  itemId: number,
  data: ShowcaseCommentCreate
): Promise<ShowcaseComment> {
  return apiFetch(`${BASE}/${itemId}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
}

export async function deleteComment(itemId: number, commentId: number, password?: string): Promise<void> {
  return apiFetch(`${BASE}/${itemId}/comments/${commentId}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: password ?? null }),
  })
}
