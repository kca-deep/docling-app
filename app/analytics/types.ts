export interface AnalyticsSummary {
  total_queries: number
  unique_sessions: number
  total_tokens: number
  error_count: number
  avg_response_time_ms: number
  period: { from: string; to: string; days: number }
  collections: string[]
  top_queries?: string[]
}

export interface TimelineData {
  date: string
  queries: number
  sessions: number
  avg_response_time: number
  errors: number
}

export interface HeatmapData {
  heatmap: number[][]
  max_value: number
  labels: { days: string[]; hours: number[] }
}

export interface ConversationStats {
  avg_turns: number
  avg_user_messages: number
  revisit_rate: number
  total_sessions: number
  unique_users: number
  regeneration_rate: number
}

export interface ActiveSessions {
  active_count: number
  by_collection: Record<string, number>
  timestamp: string
}

export interface RecentQuery {
  query: string
  collection: string
  timestamp: string
  session_id: string
  response_time_ms?: number
}

export interface CollectionInfo {
  name: string
  description?: string
  visibility?: string
  documents_count?: number
  points_count?: number
  vector_size?: number
  distance?: string
}

export interface FeedbackSummary {
  total_count: number
  positive_count: number
  negative_count: number
  positive_rate: number
  category_distribution: Record<string, number>
  daily_trend: Array<{
    date: string
    positive: number
    negative: number
  }>
}

export interface RecentNegativeFeedback {
  feedback_id: string
  message_id: string
  collection_name: string
  category?: string
  comment?: string
  user_query: string
  created_at: string
}
