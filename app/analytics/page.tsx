"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useTheme } from "next-themes"
import { PageContainer } from "@/components/page-container"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import {
  Tooltip as ShadcnTooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { cn } from "@/lib/utils"
import { format, addDays } from "date-fns"
import {
  RefreshCw, TrendingUp, Users, MessageSquare,
  Clock, Zap, Download
} from "lucide-react"
import {
  XAxis, YAxis, CartesianGrid,
  ComposedChart, Area, Line
} from "recharts"
import { toast } from "sonner"
import { API_BASE_URL } from "@/lib/api-config"

// 차트 설정
const timelineChartConfig = {
  queries: {
    label: "쿼리",
    color: "var(--chart-1)",
  },
  sessions: {
    label: "세션",
    color: "var(--chart-2)",
  },
  avg_response_time: {
    label: "응답시간(ms)",
    color: "var(--chart-3)",
  },
  movingAvg: {
    label: "7일 이동평균",
    color: "var(--chart-5)",
  },
} satisfies ChartConfig

// 7일 이동평균 계산 함수
function calculateMovingAverage(data: TimelineData[], metric: keyof TimelineData, window: number = 7): (number | null)[] {
  return data.map((_, idx) => {
    if (idx < window - 1) return null // 충분한 데이터가 없으면 null
    const slice = data.slice(idx - window + 1, idx + 1)
    const sum = slice.reduce((acc, item) => acc + (Number(item[metric]) || 0), 0)
    return Math.round(sum / window)
  })
}


// ============================================================
// 타입 정의
// ============================================================

interface AnalyticsSummary {
  total_queries: number
  unique_sessions: number
  total_tokens: number
  error_count: number
  avg_response_time_ms: number
  period: { from: string; to: string; days: number }
  collections: string[]
  top_queries?: string[]
}

interface TimelineData {
  date: string
  queries: number
  sessions: number
  avg_response_time: number
  errors: number
}

interface HeatmapData {
  heatmap: number[][]
  max_value: number
  labels: { days: string[]; hours: number[] }
}

interface ConversationStats {
  avg_turns: number
  avg_user_messages: number
  revisit_rate: number
  total_sessions: number
  unique_users: number
  regeneration_rate: number
}

interface ActiveSessions {
  active_count: number
  by_collection: Record<string, number>
  timestamp: string
}

interface RecentQuery {
  query: string
  collection: string
  timestamp: string
  session_id: string
  response_time_ms?: number
}

// ============================================================
// 메인 컴포넌트
// ============================================================

export default function AnalyticsPage() {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null)

  // 다크모드 차트 opacity 설정
  const chartOpacity = useMemo(() => {
    const isDark = resolvedTheme === 'dark'
    return {
      fill: isDark ? 0.55 : 0.4,
      gradientStart: isDark ? 0.9 : 0.8,
      gradientEnd: isDark ? 0.25 : 0.1,
    }
  }, [resolvedTheme])

  // 클라이언트 마운트 확인 (hydration 이슈 방지)
  useEffect(() => {
    setMounted(true)
  }, [])
  const [collections, setCollections] = useState<string[]>([])
  const [dateRange, setDateRange] = useState({
    from: addDays(new Date(), -7),
    to: new Date()
  })

  // 데이터 상태
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null)
  const [timeline, setTimeline] = useState<TimelineData[]>([])
  const [heatmap, setHeatmap] = useState<HeatmapData | null>(null)
  const [conversationStats, setConversationStats] = useState<ConversationStats | null>(null)
  const [activeSessions, setActiveSessions] = useState<ActiveSessions | null>(null)
  const [recentQueries, setRecentQueries] = useState<RecentQuery[]>([])

  // 일별 추이 차트 활성 메트릭
  const [activeTimelineMetric, setActiveTimelineMetric] = useState<"queries" | "sessions" | "avg_response_time">("queries")

  // 컬렉션 목록 조회
  const fetchCollections = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/qdrant/collections`)
      if (!response.ok) throw new Error("컬렉션 조회 실패")
      const data = await response.json()
      const names = (data.collections?.map((c: any) => c.name) || []).sort((a: string, b: string) => a.localeCompare(b))
      setCollections(names)
      if (names.length > 0 && !selectedCollection) {
        setSelectedCollection(names[0])
      }
    } catch (error) {
      console.error("컬렉션 조회 오류:", error)
    }
  }, [selectedCollection])

  // 모든 데이터 새로고침
  const refreshAllData = useCallback(async () => {
    if (!selectedCollection) return

    setLoading(true)
    const days = Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24)) || 7
    const params = `collection_name=${selectedCollection}&days=${days}`
    const dateParams = `collection_name=${selectedCollection}&date_from=${format(dateRange.from, "yyyy-MM-dd")}&date_to=${format(dateRange.to, "yyyy-MM-dd")}`

    try {
      const [
        summaryRes, timelineRes, heatmapRes, convStatsRes,
        activeRes, recentRes
      ] = await Promise.allSettled([
        fetch(`${API_BASE_URL}/api/analytics/summary?${dateParams}`),
        fetch(`${API_BASE_URL}/api/analytics/timeline?${params}&period=daily`),
        fetch(`${API_BASE_URL}/api/analytics/hourly-heatmap?${params}`),
        fetch(`${API_BASE_URL}/api/analytics/conversation-stats?${params}`),
        fetch(`${API_BASE_URL}/api/analytics/active-sessions?minutes=5`),
        fetch(`${API_BASE_URL}/api/analytics/recent-queries?collection_name=${selectedCollection}&limit=20`)
      ])

      // 결과 처리
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
    if (selectedCollection) {
      refreshAllData()
    }
  }, [selectedCollection, dateRange, refreshAllData])

  // 실시간 데이터 자동 갱신 (30초)
  useEffect(() => {
    const interval = setInterval(async () => {
      if (!selectedCollection) return
      try {
        const [activeRes, recentRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/analytics/active-sessions?minutes=5`),
          fetch(`${API_BASE_URL}/api/analytics/recent-queries?collection_name=${selectedCollection}&limit=20`)
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

  // Excel 다운로드 상태
  const [downloading, setDownloading] = useState(false)

  // Excel 다운로드 함수
  const handleExcelDownload = useCallback(async () => {
    if (!selectedCollection) {
      toast.error("컬렉션을 선택해주세요")
      return
    }

    setDownloading(true)
    try {
      const dateFromStr = format(dateRange.from, "yyyy-MM-dd")
      const dateToStr = format(dateRange.to, "yyyy-MM-dd")

      const response = await fetch(
        `${API_BASE_URL}/api/analytics/export/excel?collection_name=${encodeURIComponent(selectedCollection)}&date_from=${dateFromStr}&date_to=${dateToStr}`
      )

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || "다운로드 실패")
      }

      // Blob으로 변환 후 다운로드
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `conversations_${selectedCollection}_${dateFromStr}_${dateToStr}.xlsx`
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

  // 히트맵 색상 계산 (CSS 변수 기반)
  const getHeatmapColor = (intensity: number): string => {
    if (intensity === 0) return 'transparent'
    // chart-2 (초록) 기반으로 intensity에 따라 opacity 조절
    const opacity = Math.round(20 + intensity * 80) // 20% ~ 100%
    return `color-mix(in oklch, var(--chart-2) ${opacity}%, transparent)`
  }

  // 히트맵 셀 컴포넌트 (개선된 버전)
  const HeatmapCell = ({
    value,
    maxValue,
    day,
    hour,
    isPeak = false,
    animationDelay = 0
  }: {
    value: number
    maxValue: number
    day: string
    hour: number
    isPeak?: boolean
    animationDelay?: number
  }) => {
    const intensity = maxValue > 0 ? value / maxValue : 0
    const percentage = maxValue > 0 ? ((value / maxValue) * 100).toFixed(1) : 0

    return (
      <ShadcnTooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "w-5 h-5 rounded-md cursor-pointer transition-all duration-150",
              "hover:scale-125 hover:ring-2 hover:ring-primary hover:ring-offset-1 hover:z-10",
              "animate-in fade-in zoom-in-50",
              intensity === 0 && "bg-muted"
            )}
            style={{
              animationDelay: `${animationDelay}ms`,
              animationFillMode: 'backwards',
              backgroundColor: intensity > 0 ? getHeatmapColor(intensity) : undefined,
              boxShadow: isPeak ? `0 0 0 2px var(--chart-3), 0 0 0 4px var(--background)` : undefined
            }}
          />
        </TooltipTrigger>
        <TooltipContent side="top" className="p-0">
          <div className="px-3 py-2 space-y-1">
            <div className="font-medium text-sm">{day} {hour}시</div>
            <div className="flex items-center justify-between gap-4 text-xs">
              <span className="text-muted-foreground">사용량</span>
              <span className="font-mono font-semibold">{value.toLocaleString()}건</span>
            </div>
            <div className="flex items-center justify-between gap-4 text-xs">
              <span className="text-muted-foreground">비율</span>
              <span className="font-mono">{percentage}%</span>
            </div>
            {isPeak && (
              <Badge variant="secondary" className="w-full justify-center mt-1 text-xs">
                피크 타임
              </Badge>
            )}
          </div>
        </TooltipContent>
      </ShadcnTooltip>
    )
  }

  // 메트릭 색상 정의 (CSS 변수 사용)
  const metricColors = {
    queries: "var(--chart-1)",      // 파랑
    sessions: "var(--chart-5)",     // 보라
    turns: "var(--chart-2)",        // 초록
    responseTime: "var(--chart-3)", // 주황
    tokens: "var(--chart-3)",       // 주황
    active: "var(--chart-2)",       // 초록
  }

  return (
    <PageContainer maxWidth="wide">
      {/* 페이지 헤더 */}
      <div className="space-y-2 mb-6">
        <h1
          className="text-3xl font-bold tracking-tight bg-clip-text text-transparent"
          style={{
            backgroundImage: "linear-gradient(90deg, var(--chart-4), var(--chart-3))"
          }}
        >
          통계
        </h1>
        <p className="text-muted-foreground">RAG 시스템 사용 현황 분석 대시보드</p>
      </div>

      {/* 필터 영역 + 메트릭 뱃지 통합 */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {/* 필터 컨트롤 */}
        <Select value={selectedCollection || ""} onValueChange={setSelectedCollection}>
          <SelectTrigger className="w-[180px] h-9">
            <SelectValue placeholder="컬렉션 선택" />
          </SelectTrigger>
          <SelectContent>
            {collections.map((collection) => (
              <SelectItem key={collection} value={collection}>{collection}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex gap-2 items-center">
          <Input
            type="date"
            value={dateRange.from instanceof Date && !isNaN(dateRange.from.getTime()) ? format(dateRange.from, "yyyy-MM-dd") : ""}
            onChange={(e) => {
              const date = new Date(e.target.value)
              if (!isNaN(date.getTime())) {
                setDateRange(prev => ({ ...prev, from: date }))
              }
            }}
            className="w-[130px] h-9"
          />
          <span className="text-sm text-muted-foreground">~</span>
          <Input
            type="date"
            value={dateRange.to instanceof Date && !isNaN(dateRange.to.getTime()) ? format(dateRange.to, "yyyy-MM-dd") : ""}
            onChange={(e) => {
              const date = new Date(e.target.value)
              if (!isNaN(date.getTime())) {
                setDateRange(prev => ({ ...prev, to: date }))
              }
            }}
            className="w-[130px] h-9"
          />
        </div>

        <Button onClick={refreshAllData} disabled={loading} size="sm" variant="outline">
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
        </Button>

        {/* 구분선 */}
        <div className="hidden md:block h-6 w-px bg-border" />

        {/* 메트릭 뱃지들 */}
        <div className="flex flex-wrap items-center gap-2 ml-auto">
          <Badge variant="secondary" className="gap-1.5 px-2.5 py-1 font-normal">
            <MessageSquare className="h-3 w-3" style={{ color: metricColors.queries }} />
            <span className="font-semibold tabular-nums">{(summary?.total_queries ?? 0).toLocaleString()}</span>
            <span className="text-muted-foreground text-xs">쿼리</span>
          </Badge>
          <Badge variant="secondary" className="gap-1.5 px-2.5 py-1 font-normal">
            <Users className="h-3 w-3" style={{ color: metricColors.sessions }} />
            <span className="font-semibold tabular-nums">{(summary?.unique_sessions ?? 0).toLocaleString()}</span>
            <span className="text-muted-foreground text-xs">세션</span>
          </Badge>
          <Badge variant="secondary" className="gap-1.5 px-2.5 py-1 font-normal">
            <TrendingUp className="h-3 w-3" style={{ color: metricColors.turns }} />
            <span className="font-semibold tabular-nums">{conversationStats?.avg_turns?.toFixed(1) || "0"}</span>
            <span className="text-muted-foreground text-xs">턴</span>
          </Badge>
          <Badge variant="secondary" className="gap-1.5 px-2.5 py-1 font-normal">
            <Clock className="h-3 w-3" style={{ color: metricColors.responseTime }} />
            <span className="font-semibold tabular-nums">{(summary?.avg_response_time_ms ?? 0).toFixed(0)}</span>
            <span className="text-muted-foreground text-xs">ms</span>
          </Badge>
          <Badge variant="secondary" className="gap-1.5 px-2.5 py-1 font-normal">
            <Zap className="h-3 w-3" style={{ color: metricColors.tokens }} />
            <span className="font-semibold tabular-nums">{((summary?.total_tokens ?? 0) / 1000).toFixed(1)}K</span>
            <span className="text-muted-foreground text-xs">토큰</span>
          </Badge>

          {/* 실시간 활성 세션 */}
          {activeSessions && (
            <Badge
              variant="outline"
              className="gap-1.5 px-2.5 py-1 font-normal"
              style={{ borderColor: `color-mix(in oklch, ${metricColors.active} 50%, transparent)` }}
            >
              <div
                className="h-1.5 w-1.5 rounded-full animate-pulse"
                style={{ backgroundColor: metricColors.active }}
              />
              <span className="font-semibold tabular-nums" style={{ color: metricColors.active }}>{activeSessions.active_count}</span>
              <span className="text-muted-foreground text-xs">활성</span>
            </Badge>
          )}
        </div>
      </div>

      {/* 대시보드 */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* 일별 추이 - 인터랙티브 차트 */}
            <Card className="col-span-1 lg:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between gap-4 px-4 py-3 sm:px-6">
                <div className="flex items-center gap-3">
                  <CardTitle className="text-sm font-medium">일별 사용 추이</CardTitle>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <div className="w-4 h-0.5 rounded" style={{ backgroundColor: "var(--chart-5)" }} />
                    <span>7일 이동평균</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {(["queries", "sessions", "avg_response_time"] as const).map((key) => {
                    const totals = {
                      queries: timeline.reduce((acc, curr) => acc + (curr.queries || 0), 0),
                      sessions: timeline.reduce((acc, curr) => acc + (curr.sessions || 0), 0),
                      avg_response_time: timeline.length > 0
                        ? Math.round(timeline.reduce((acc, curr) => acc + (curr.avg_response_time || 0), 0) / timeline.length)
                        : 0,
                    }
                    const config = {
                      queries: { label: "쿼리", unit: "", icon: MessageSquare, colorVar: metricColors.queries },
                      sessions: { label: "세션", unit: "", icon: Users, colorVar: metricColors.sessions },
                      avg_response_time: { label: "응답", unit: "ms", icon: Clock, colorVar: metricColors.responseTime },
                    }
                    const { label, unit, icon: Icon, colorVar } = config[key]
                    const isActive = activeTimelineMetric === key
                    return (
                      <button
                        key={key}
                        onClick={() => setActiveTimelineMetric(key)}
                        className="focus:outline-none"
                      >
                        <Badge
                          variant={isActive ? "default" : "secondary"}
                          className={cn(
                            "gap-1.5 px-2.5 py-1 font-normal cursor-pointer transition-all",
                            isActive ? "ring-2 ring-offset-1 ring-primary/30" : "hover:bg-muted"
                          )}
                        >
                          <Icon
                            className="h-3 w-3"
                            style={{ color: isActive ? undefined : colorVar }}
                          />
                          <span className="font-semibold tabular-nums">{totals[key].toLocaleString()}{unit}</span>
                          <span className={cn("text-xs", isActive ? "text-primary-foreground/70" : "text-muted-foreground")}>{label}</span>
                        </Badge>
                      </button>
                    )
                  })}
                </div>
              </CardHeader>
              <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
                {(() => {
                  // 7일 이동평균 계산 후 데이터에 추가
                  const movingAvgValues = calculateMovingAverage(timeline, activeTimelineMetric)
                  const chartData = timeline.map((item, idx) => ({
                    ...item,
                    movingAvg: movingAvgValues[idx],
                  }))

                  // 그라데이션 ID 매핑
                  const gradientMap = {
                    queries: "fillQueries",
                    sessions: "fillSessions",
                    avg_response_time: "fillResponseTime",
                  }

                  return (
                    <ChartContainer
                      config={timelineChartConfig}
                      className="aspect-auto h-[220px] w-full"
                    >
                      <ComposedChart
                        accessibilityLayer
                        data={chartData}
                        margin={{ left: 12, right: 12, top: 10 }}
                      >
                        <defs>
                          <linearGradient id="fillQueries" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--color-queries)" stopOpacity={mounted ? chartOpacity.gradientStart : 0.8} />
                            <stop offset="95%" stopColor="var(--color-queries)" stopOpacity={mounted ? chartOpacity.gradientEnd : 0.1} />
                          </linearGradient>
                          <linearGradient id="fillSessions" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--color-sessions)" stopOpacity={mounted ? chartOpacity.gradientStart : 0.8} />
                            <stop offset="95%" stopColor="var(--color-sessions)" stopOpacity={mounted ? chartOpacity.gradientEnd : 0.1} />
                          </linearGradient>
                          <linearGradient id="fillResponseTime" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--color-avg_response_time)" stopOpacity={mounted ? chartOpacity.gradientStart : 0.8} />
                            <stop offset="95%" stopColor="var(--color-avg_response_time)" stopOpacity={mounted ? chartOpacity.gradientEnd : 0.1} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid vertical={false} />
                        <XAxis
                          dataKey="date"
                          tickLine={false}
                          axisLine={false}
                          tickMargin={8}
                          minTickGap={32}
                          tickFormatter={(v) => {
                            try {
                              return format(new Date(v), "M/d")
                            } catch {
                              return String(v)
                            }
                          }}
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          tickMargin={8}
                          width={45}
                          tickFormatter={(v) => activeTimelineMetric === "avg_response_time" ? `${v}` : v.toLocaleString()}
                        />
                        <ChartTooltip
                          cursor={false}
                          content={
                            <ChartTooltipContent
                              className="w-[180px]"
                              labelFormatter={(value) => {
                                try {
                                  const date = new Date(value)
                                  if (isNaN(date.getTime())) return String(value)
                                  const dayNames = ['일', '월', '화', '수', '목', '금', '토']
                                  const isWeekend = date.getDay() === 0 || date.getDay() === 6
                                  return (
                                    <span className={isWeekend ? "text-destructive" : ""}>
                                      {format(date, "M월 d일")} ({dayNames[date.getDay()]})
                                    </span>
                                  )
                                } catch {
                                  return String(value)
                                }
                              }}
                              indicator="line"
                            />
                          }
                        />
                        {/* Area 차트 - 일별 데이터 */}
                        <Area
                          type="natural"
                          dataKey={activeTimelineMetric}
                          stroke={`var(--color-${activeTimelineMetric})`}
                          fill={`url(#${gradientMap[activeTimelineMetric]})`}
                          fillOpacity={mounted ? chartOpacity.fill : 0.4}
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 5, strokeWidth: 2, className: "fill-background" }}
                        />
                        {/* 7일 이동평균 라인 */}
                        <Line
                          type="monotone"
                          dataKey="movingAvg"
                          stroke="var(--color-movingAvg)"
                          strokeWidth={2.5}
                          dot={false}
                          connectNulls={false}
                          activeDot={{
                            r: 5,
                            strokeWidth: 2,
                            fill: "var(--background)",
                            stroke: "var(--color-movingAvg)"
                          }}
                        />
                      </ComposedChart>
                    </ChartContainer>
                  )
                })()}
              </CardContent>
            </Card>

            {/* 최근 질문 피드 */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-4 px-4 py-3 sm:px-6">
                <CardTitle className="text-sm font-medium">최근 질문</CardTitle>
                <div className="flex items-center gap-2">
                  <ShadcnTooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={handleExcelDownload}
                        disabled={downloading || !selectedCollection}
                      >
                        <Download className={cn("h-3.5 w-3.5", downloading && "animate-bounce")} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <p className="text-xs">대화내역 Excel 다운로드</p>
                    </TooltipContent>
                  </ShadcnTooltip>
                  <Badge variant="outline" className="gap-1 px-2 py-0.5 font-normal text-xs">
                    <div
                      className="h-1.5 w-1.5 rounded-full animate-pulse"
                      style={{ backgroundColor: metricColors.active }}
                    />
                    30초 갱신
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="px-4 sm:px-6">
                <ScrollArea className="h-[232px]">
                  <div className="space-y-1.5">
                    {recentQueries.length > 0 ? recentQueries.slice(0, 15).map((q, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-1.5 rounded-md hover:bg-muted/50 transition-colors">
                        <MessageSquare className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span className="text-xs flex-1 truncate">{q.query}</span>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {q.timestamp ? format(new Date(q.timestamp), "HH:mm") : "-"}
                        </span>
                      </div>
                    )) : (
                      <p className="text-xs text-muted-foreground text-center py-4">
                        질문 데이터 없음
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* 시간대별 히트맵 */}
            <Card className="col-span-1 lg:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between gap-4 px-4 py-3 sm:px-6">
                <CardTitle className="text-sm font-medium">시간대별 히트맵</CardTitle>
                {heatmap && heatmap.max_value > 0 && (
                  <Badge variant="secondary" className="gap-1.5 px-2.5 py-1 font-normal">
                    <Zap className="h-3 w-3" style={{ color: metricColors.responseTime }} />
                    <span className="text-xs">피크: {heatmap.labels?.days?.[(() => {
                      let peakDay = 0, peakHour = 0, peakVal = 0
                      heatmap.heatmap.forEach((d, di) => d.forEach((v, hi) => { if (v > peakVal) { peakVal = v; peakDay = di; peakHour = hi } }))
                      return peakDay
                    })()]} {(() => {
                      let peakHour = 0, peakVal = 0
                      heatmap.heatmap.forEach((d) => d.forEach((v, hi) => { if (v > peakVal) { peakVal = v; peakHour = hi } }))
                      return peakHour
                    })()}시</span>
                  </Badge>
                )}
              </CardHeader>
              <CardContent className="px-4 sm:px-6">
                {heatmap && heatmap.labels?.days ? (
                  (() => {
                    // 피크 타임 계산
                    let peakDay = 0, peakHour = 0, peakValue = 0
                    heatmap.heatmap.forEach((dayData, dayIdx) => {
                      dayData.forEach((value, hourIdx) => {
                        if (value > peakValue) {
                          peakValue = value
                          peakDay = dayIdx
                          peakHour = hourIdx
                        }
                      })
                    })

                    // 요일별 합계 계산
                    const daySums = heatmap.heatmap.map(dayData =>
                      dayData.reduce((sum, val) => sum + val, 0)
                    )
                    const maxDaySum = Math.max(...daySums)

                    // 시간대별 합계 계산 (열 합계)
                    const hourSums = Array.from({ length: 24 }, (_, hourIdx) =>
                      heatmap.heatmap.reduce((sum, dayData) => sum + (dayData[hourIdx] || 0), 0)
                    )
                    const maxHourSum = Math.max(...hourSums)

                    // 전체 합계
                    const totalSum = daySums.reduce((sum, val) => sum + val, 0)

                    return (
                      <div className="space-y-3">
                        <ScrollArea className="w-full">
                          <div className="min-w-fit">
                            {/* 히트맵 본체 */}
                            <div className="space-y-1.5">
                              {/* 시간 레이블 */}
                              <div className="flex gap-1 ml-12">
                                {Array.from({ length: 24 }, (_, h) => (
                                  <div
                                    key={h}
                                    className={cn(
                                      "w-5 text-center text-[10px]",
                                      h % 6 === 0 ? "text-foreground font-medium" : "text-muted-foreground/50"
                                    )}
                                  >
                                    {h % 6 === 0 ? h : ""}
                                  </div>
                                ))}
                              </div>

                              {/* 히트맵 행 */}
                              {heatmap.labels.days.map((day, dayIdx) => (
                                <div key={day} className="flex items-center gap-2">
                                  <span className="w-10 text-xs text-muted-foreground text-right shrink-0">{day}</span>
                                  <div className="flex gap-1">
                                    {heatmap.heatmap[dayIdx]?.map((value, hourIdx) => (
                                      <HeatmapCell
                                        key={hourIdx}
                                        value={value}
                                        maxValue={heatmap.max_value}
                                        day={day}
                                        hour={hourIdx}
                                        isPeak={dayIdx === peakDay && hourIdx === peakHour && peakValue > 0}
                                        animationDelay={dayIdx * 30 + hourIdx * 10}
                                      />
                                    ))}
                                  </div>
                                  {/* 요일별 합계 */}
                                  <div className="flex items-center gap-1 ml-1 shrink-0">
                                    <div className="w-10 h-2 bg-muted rounded-full overflow-hidden">
                                      <div
                                        className="h-full rounded-full transition-all"
                                        style={{
                                          width: maxDaySum > 0 ? `${(daySums[dayIdx] / maxDaySum) * 100}%` : '0%',
                                          backgroundColor: 'var(--chart-2)'
                                        }}
                                      />
                                    </div>
                                    <span className="text-xs text-muted-foreground w-12 text-right font-mono">
                                      {daySums[dayIdx].toLocaleString()}
                                    </span>
                                  </div>
                                </div>
                              ))}

                              {/* 시간대별 합계 바 차트 */}
                              <div className="flex items-end gap-1 ml-12 mt-3 pt-3 border-t h-16">
                                {hourSums.map((sum, hourIdx) => {
                                  const height = maxHourSum > 0 ? (sum / maxHourSum) * 100 : 0
                                  return (
                                    <ShadcnTooltip key={hourIdx}>
                                      <TooltipTrigger asChild>
                                        <div
                                          className="w-5 rounded-t transition-all duration-300 cursor-pointer animate-in slide-in-from-bottom hover:opacity-100"
                                          style={{
                                            height: `${Math.max(height, 4)}%`,
                                            animationDelay: `${hourIdx * 20 + 300}ms`,
                                            animationFillMode: 'backwards',
                                            backgroundColor: 'color-mix(in oklch, var(--chart-1) 80%, transparent)'
                                          }}
                                          onMouseEnter={(e) => {
                                            e.currentTarget.style.backgroundColor = 'var(--chart-1)'
                                          }}
                                          onMouseLeave={(e) => {
                                            e.currentTarget.style.backgroundColor = 'color-mix(in oklch, var(--chart-1) 80%, transparent)'
                                          }}
                                        />
                                      </TooltipTrigger>
                                      <TooltipContent side="top" className="p-2">
                                        <div className="text-xs">
                                          <div className="font-medium">{hourIdx}시</div>
                                          <div className="text-muted-foreground">{sum.toLocaleString()}건</div>
                                        </div>
                                      </TooltipContent>
                                    </ShadcnTooltip>
                                  )
                                })}
                              </div>

                              {/* 시간대 구분 - 셀 너비 기반 고정 너비 (6셀 + 갭) */}
                              <div className="flex ml-12 mt-1">
                                <div style={{ width: '9rem' }} className="text-center text-[10px] text-muted-foreground">새벽 (0-6)</div>
                                <div style={{ width: '9rem' }} className="text-center text-[10px] text-muted-foreground">오전 (6-12)</div>
                                <div style={{ width: '9rem' }} className="text-center text-[10px] text-muted-foreground">오후 (12-18)</div>
                                <div style={{ width: '8.75rem' }} className="text-center text-[10px] text-muted-foreground">저녁 (18-24)</div>
                              </div>
                            </div>
                          </div>
                          <ScrollBar orientation="horizontal" />
                        </ScrollArea>

                        {/* 범례 및 통계 */}
                        <div className="flex items-center justify-between pt-4 border-t">
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-muted-foreground">0건</span>
                            <div className="flex gap-1">
                              <div className="w-5 h-5 bg-muted rounded-md" />
                              {[20, 40, 60, 80, 100].map((opacity) => (
                                <div
                                  key={opacity}
                                  className="w-5 h-5 rounded-md"
                                  style={{ backgroundColor: `color-mix(in oklch, var(--chart-2) ${opacity}%, transparent)` }}
                                />
                              ))}
                            </div>
                            <span className="text-xs text-muted-foreground">{heatmap.max_value.toLocaleString()}건</span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            총 <strong className="text-foreground">{totalSum.toLocaleString()}</strong>건
                          </div>
                        </div>
                      </div>
                    )
                  })()
                ) : (
                  <p className="text-sm text-muted-foreground">데이터 없음</p>
                )}
              </CardContent>
            </Card>

            {/* 인기 검색어 */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-4 px-4 py-3 sm:px-6">
                <CardTitle className="text-sm font-medium">인기 검색어</CardTitle>
                <Badge variant="secondary" className="gap-1 px-2 py-0.5 font-normal text-xs">
                  TOP 15
                </Badge>
              </CardHeader>
              <CardContent className="px-4 sm:px-6">
                <ScrollArea className="h-[232px]">
                  <div className="space-y-1">
                    {summary?.top_queries?.slice(0, 15).map((query, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-1.5 rounded-md hover:bg-muted/50 transition-colors">
                        <Badge variant="outline" className="text-[10px] w-4 h-4 p-0 flex items-center justify-center shrink-0">{idx + 1}</Badge>
                        <span className="text-xs truncate flex-1">{query}</span>
                      </div>
                    )) || <p className="text-xs text-muted-foreground text-center py-4">데이터 없음</p>}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>
    </PageContainer>
  )
}
