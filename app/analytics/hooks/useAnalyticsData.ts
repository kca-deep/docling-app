import { useState, useEffect, useCallback } from "react"
import { format, addDays } from "date-fns"
import { toast } from "sonner"
import { API_BASE_URL } from "@/lib/api-config"
import type {
  AnalyticsSummary,
  TimelineData,
  HeatmapData,
  ConversationStats,
  ActiveSessions,
  RecentQuery,
  CollectionInfo,
  FeedbackSummary,
  RecentNegativeFeedback,
} from "../types"

export function useAnalyticsData() {
  const [loading, setLoading] = useState(false)
  const [selectedCollection, setSelectedCollection] = useState<string>("ALL")
  const [collections, setCollections] = useState<CollectionInfo[]>([])
  const [dateRange, setDateRange] = useState({
    from: addDays(new Date(), -30),
    to: new Date()
  })

  // 데이터 상태
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null)
  const [timeline, setTimeline] = useState<TimelineData[]>([])
  const [heatmap, setHeatmap] = useState<HeatmapData | null>(null)
  const [conversationStats, setConversationStats] = useState<ConversationStats | null>(null)
  const [activeSessions, setActiveSessions] = useState<ActiveSessions | null>(null)
  const [recentQueries, setRecentQueries] = useState<RecentQuery[]>([])
  const [feedbackSummary, setFeedbackSummary] = useState<FeedbackSummary | null>(null)
  const [recentNegativeFeedbacks, setRecentNegativeFeedbacks] = useState<RecentNegativeFeedback[]>([])

  // Excel 다운로드 상태
  const [downloading, setDownloading] = useState(false)
  const [downloadingErrors, setDownloadingErrors] = useState(false)

  // 컬렉션 목록 조회
  const fetchCollections = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/qdrant/collections`, {
        credentials: 'include'
      })
      if (!response.ok) throw new Error("컬렉션 조회 실패")
      const data = await response.json()
      const collectionInfos: CollectionInfo[] = (data.collections || [])
        .map((c: any) => ({
          name: c.name,
          description: c.description,
          visibility: c.visibility || "public",
          documents_count: c.documents_count || 0,
          points_count: c.points_count || 0,
          vector_size: c.vector_size || 1024,
          distance: c.distance || "Cosine",
        }))
        .sort((a: CollectionInfo, b: CollectionInfo) => a.name.localeCompare(b.name))
      setCollections(collectionInfos)
    } catch (error) {
      console.error("컬렉션 조회 오류:", error)
    }
  }, [])

  // 모든 데이터 새로고침
  const refreshAllData = useCallback(async () => {
    setLoading(true)
    const days = Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24)) || 7
    const params = `collection_name=${selectedCollection}&days=${days}`
    const dateParams = `collection_name=${selectedCollection}&date_from=${format(dateRange.from, "yyyy-MM-dd")}&date_to=${format(dateRange.to, "yyyy-MM-dd")}`

    try {
      const recentQueriesParams = selectedCollection === "ALL" ? "limit=20" : `collection_name=${selectedCollection}&limit=20`
      const feedbackDateParams = `date_from=${format(dateRange.from, "yyyy-MM-dd")}&date_to=${format(dateRange.to, "yyyy-MM-dd")}`
      const feedbackParams = selectedCollection === "ALL" ? feedbackDateParams : `collection_name=${selectedCollection}&${feedbackDateParams}`
      const [
        summaryRes, timelineRes, heatmapRes, convStatsRes,
        activeRes, recentRes, feedbackSummaryRes, recentNegativeRes
      ] = await Promise.allSettled([
        fetch(`${API_BASE_URL}/api/analytics/summary?${dateParams}`, { credentials: 'include' }),
        fetch(`${API_BASE_URL}/api/analytics/timeline?${params}&period=daily`, { credentials: 'include' }),
        fetch(`${API_BASE_URL}/api/analytics/hourly-heatmap?${params}`, { credentials: 'include' }),
        fetch(`${API_BASE_URL}/api/analytics/conversation-stats?${params}`, { credentials: 'include' }),
        fetch(`${API_BASE_URL}/api/analytics/active-sessions?minutes=5`, { credentials: 'include' }),
        fetch(`${API_BASE_URL}/api/analytics/recent-queries?${recentQueriesParams}`, { credentials: 'include' }),
        fetch(`${API_BASE_URL}/api/feedback/summary?${feedbackParams}`, { credentials: 'include' }),
        fetch(`${API_BASE_URL}/api/feedback/recent-negative?${selectedCollection === "ALL" ? "" : `collection_name=${selectedCollection}&`}limit=10`, { credentials: 'include' })
      ])

      if (summaryRes.status === 'fulfilled' && summaryRes.value.ok) {
        setSummary(await summaryRes.value.json())
      }
      if (timelineRes.status === 'fulfilled' && timelineRes.value.ok) {
        const data = await timelineRes.value.json()
        setTimeline(data.data || [])
      }
      if (heatmapRes.status === 'fulfilled' && heatmapRes.value.ok) {
        setHeatmap(await heatmapRes.value.json())
      }
      if (convStatsRes.status === 'fulfilled' && convStatsRes.value.ok) {
        setConversationStats(await convStatsRes.value.json())
      }
      if (activeRes.status === 'fulfilled' && activeRes.value.ok) {
        setActiveSessions(await activeRes.value.json())
      }
      if (recentRes.status === 'fulfilled' && recentRes.value.ok) {
        const data = await recentRes.value.json()
        setRecentQueries(data.queries || [])
      }
      if (feedbackSummaryRes.status === 'fulfilled' && feedbackSummaryRes.value.ok) {
        setFeedbackSummary(await feedbackSummaryRes.value.json())
      }
      if (recentNegativeRes.status === 'fulfilled' && recentNegativeRes.value.ok) {
        const data = await recentNegativeRes.value.json()
        setRecentNegativeFeedbacks(data.feedbacks || [])
      }

    } catch (error) {
      console.error("데이터 조회 오류:", error)
      toast.error("일부 데이터를 불러올 수 없습니다")
    } finally {
      setLoading(false)
    }
  }, [selectedCollection, dateRange])

  // 초기 로드
  useEffect(() => {
    fetchCollections()
  }, [])

  useEffect(() => {
    refreshAllData()
  }, [selectedCollection, dateRange, refreshAllData])

  // 실시간 데이터 자동 갱신 (30초)
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const recentParams = selectedCollection === "ALL" ? "limit=20" : `collection_name=${selectedCollection}&limit=20`
        const [activeRes, recentRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/analytics/active-sessions?minutes=5`, { credentials: 'include' }),
          fetch(`${API_BASE_URL}/api/analytics/recent-queries?${recentParams}`, { credentials: 'include' })
        ])
        if (activeRes.ok) setActiveSessions(await activeRes.json())
        if (recentRes.ok) {
          const data = await recentRes.json()
          setRecentQueries(data.queries || [])
        }
      } catch (error) {
        console.error("실시간 데이터 갱신 오류:", error)
      }
    }, 30000)

    return () => clearInterval(interval)
  }, [selectedCollection])

  // Excel 다운로드 함수
  const handleExcelDownload = useCallback(async () => {
    setDownloading(true)
    try {
      const dateFromStr = format(dateRange.from, "yyyy-MM-dd")
      const dateToStr = format(dateRange.to, "yyyy-MM-dd")

      const collectionParam = selectedCollection === "ALL" ? "" : `collection_name=${encodeURIComponent(selectedCollection)}&`
      const response = await fetch(
        `${API_BASE_URL}/api/analytics/export/excel?${collectionParam}date_from=${dateFromStr}&date_to=${dateToStr}`,
        { credentials: 'include' }
      )

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || "다운로드 실패")
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      const displayCollection = selectedCollection === "casual" ? "일상대화" : selectedCollection
      a.download = `conversations_${displayCollection}_${dateFromStr}_${dateToStr}.xlsx`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast.success("Excel 파일 다운로드 완료")
    } catch (error) {
      console.error("Excel 다운로드 오류:", error)
      toast.error(error instanceof Error ? error.message : "다운로드 중 오류가 발생했습니다")
    } finally {
      setDownloading(false)
    }
  }, [selectedCollection, dateRange])

  // 오류 로그 다운로드 함수
  const handleErrorLogDownload = useCallback(async () => {
    setDownloadingErrors(true)
    try {
      const dateFromStr = format(dateRange.from, "yyyy-MM-dd")
      const dateToStr = format(dateRange.to, "yyyy-MM-dd")

      const response = await fetch(
        `${API_BASE_URL}/api/analytics/errors/download?date_from=${dateFromStr}&date_to=${dateToStr}`,
        { credentials: 'include' }
      )

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || "다운로드 실패")
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `error_logs_${dateFromStr}_${dateToStr}.xlsx`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast.success("오류 로그 다운로드 완료")
    } catch (error) {
      console.error("오류 로그 다운로드 오류:", error)
      toast.error(error instanceof Error ? error.message : "다운로드 중 오류가 발생했습니다")
    } finally {
      setDownloadingErrors(false)
    }
  }, [dateRange])

  return {
    loading,
    selectedCollection,
    setSelectedCollection,
    collections,
    dateRange,
    setDateRange,
    summary,
    timeline,
    heatmap,
    conversationStats,
    activeSessions,
    recentQueries,
    feedbackSummary,
    recentNegativeFeedbacks,
    downloading,
    downloadingErrors,
    fetchCollections,
    refreshAllData,
    handleExcelDownload,
    handleErrorLogDownload,
  }
}
