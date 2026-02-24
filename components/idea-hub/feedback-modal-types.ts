export interface SubmissionInfo {
  submission_id: string
  project_name: string
  department: string
  manager_name: string
  requires_review: boolean
  review_reason?: string
  created_at: string
}

export interface ChecklistItem {
  item_number: number
  item_category: string
  question: string
  short_label: string
  user_answer?: string
  user_details?: string
  llm_answer: string
  llm_confidence: number
  llm_evidence: string
  llm_risk_level: string
  match_status: string
  final_answer?: string
  llm_judgment?: string
  llm_quote?: string
}

export interface AttachmentInfo {
  id: number
  original_filename: string
  file_size: number
  mime_type?: string
  extraction_status: string
  created_at: string
}

export interface ProjectDetail {
  id: number
  submission_id: string
  project_name: string
  department: string
  manager_name: string
  contact?: string
  email?: string
  project_description?: string
  requires_review: boolean
  review_reason?: string
  summary?: string
  used_model?: string
  status: string
  created_at: string
  items: ChecklistItem[]
  attachments?: AttachmentInfo[]
}

export interface FeedbackData {
  id?: number
  submission_id: string
  security_review_required: boolean | null
  administrative_security: string
  technical_security: string
  overall_opinion: string
  ai_draft_administrative?: string
  ai_draft_technical?: string
  ai_draft_overall?: string
  status: "draft" | "in_progress" | "completed"
  created_at?: string
  updated_at?: string
  completed_at?: string
}

export interface FeedbackModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  submission: SubmissionInfo | null
  canEdit: boolean
  onFeedbackUpdated?: () => void
}
