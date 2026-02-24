import type { FeedbackStatus } from "@/components/idea-hub/feedback-status-badge"

export interface HistoryItem {
  id: number
  submission_id: string
  project_name: string
  department: string
  manager_name: string
  requires_review: boolean
  review_reason?: string
  status: string
  used_model: string | null
  created_at: string
  feedback_status?: FeedbackStatus
}

// Pagination constants
export const ITEMS_PER_PAGE = 15
export const PAGES_PER_BLOCK = 10
