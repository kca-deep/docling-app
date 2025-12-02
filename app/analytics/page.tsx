"use client"

import { useState, useEffect, useCallback } from "react"
import { PageContainer } from "@/components/page-container"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
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
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart"
import { cn } from "@/lib/utils"
import { format, addDays } from "date-fns"
import {
  RefreshCw, TrendingUp, Users, MessageSquare,
  Clock, Activity, Zap
} from "lucide-react"
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area
} from "recharts"
import { toast } from "sonner"

// 차트 설정
const timelineChartConfig = {
  queries: {
    label: "쿼리",
    color: "hsl(var(--chart-1))",
  },
  sessions: {
    label: "세션",
    color: "hsl(var(--chart-2))",
  },
  avg_response_time: {
    label: "응답시간(ms)",
    color: "hsl(var(--chart-3))",
  },
} satisfies ChartConfig

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

interface TopDocument {
  name: string
  count: number
  percentage: number
}

interface ResponseTimeDistribution {
  histogram: { range: string; count: number; percentage: number }[]
  percentiles: { p50: number; p90: number; p95: number; p99: number }
  stats: { min: number; max: number; avg: number; total_count: number }
}

interface TokenTrend {
  trend: { date: string; tokens: number }[]
  total: number
  avg_daily: number
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
  const [loading, setLoading] = useState(false)
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null)
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
  const [topDocuments, setTopDocuments] = useState<TopDocument[]>([])
  const [responseTimeDist, setResponseTimeDist] = useState<ResponseTimeDistribution | null>(null)
  const [tokenTrend, setTokenTrend] = useState<TokenTrend | null>(null)
  const [activeSessions, setActiveSessions] = useState<ActiveSessions | null>(null)
  const [recentQueries, setRecentQueries] = useState<RecentQuery[]>([])

  // 컬렉션 목록 조회
  const fetchCollections = useCallback(async () => {
    try {
      const response = await fetch("http://localhost:8000/api/qdrant/collections")
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
        topDocsRes, respTimeRes, tokenRes, activeRes, recentRes
      ] = await Promise.allSettled([
        fetch(`http://localhost:8000/api/analytics/summary?${dateParams}`),
        fetch(`http://localhost:8000/api/analytics/timeline?${params}&period=daily`),
        fetch(`http://localhost:8000/api/analytics/hourly-heatmap?${params}`),
        fetch(`http://localhost:8000/api/analytics/conversation-stats?${params}`),
        fetch(`http://localhost:8000/api/analytics/top-documents?${params}&limit=10`),
        fetch(`http://localhost:8000/api/analytics/response-time-distribution?${params}`),
        fetch(`http://localhost:8000/api/analytics/token-usage-trend?${params}`),
        fetch(`http://localhost:8000/api/analytics/active-sessions?minutes=5`),
        fetch(`http://localhost:8000/api/analytics/recent-queries?collection_name=${selectedCollection}&limit=20`)
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
      if (topDocsRes.status === 'fulfilled' && topDocsRes.value.ok) {
        const data = await topDocsRes.value.json()
        setTopDocuments(data.documents || [])
      }
      if (respTimeRes.status === 'fulfilled' && respTimeRes.value.ok) {
        setResponseTimeDist(await respTimeRes.value.json())
      }
      if (tokenRes.status === 'fulfilled' && tokenRes.value.ok) {
        setTokenTrend(await tokenRes.value.json())
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
          fetch(`http://localhost:8000/api/analytics/active-sessions?minutes=5`),
          fetch(`http://localhost:8000/api/analytics/recent-queries?collection_name=${selectedCollection}&limit=20`)
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

  // 메트릭 카드 컴포넌트 (개선된 버전)
  const MetricCard = ({
    title,
    value,
    subtitle,
    icon: Icon,
    trend,
    trendLabel,
    color = "default",
    tooltip
  }: {
    title: string
    value: string | number
    subtitle?: string
    icon?: any
    trend?: "up" | "down" | "neutral"
    trendLabel?: string
    color?: "default" | "blue" | "green" | "orange" | "purple" | "pink"
    tooltip?: string
  }) => {
    const colorClasses = {
      default: "bg-muted text-muted-foreground",
      blue: "bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400",
      green: "bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400",
      orange: "bg-orange-100 text-orange-600 dark:bg-orange-950 dark:text-orange-400",
      purple: "bg-purple-100 text-purple-600 dark:bg-purple-950 dark:text-purple-400",
      pink: "bg-pink-100 text-pink-600 dark:bg-pink-950 dark:text-pink-400"
    }

    const trendColors = {
      up: "text-emerald-600 dark:text-emerald-400",
      down: "text-red-600 dark:text-red-400",
      neutral: "text-muted-foreground"
    }

    const trendIcons = {
      up: <TrendingUp className="h-3 w-3" />,
      down: <TrendingUp className="h-3 w-3 rotate-180" />,
      neutral: null
    }

    const cardContent = (
      <Card className="group relative overflow-hidden transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:border-primary/20">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
          {Icon && (
            <div className={cn("p-2 rounded-lg transition-transform group-hover:scale-110", colorClasses[color])}>
              <Icon className="h-4 w-4" />
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-1">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight">{value}</span>
            {trend && (
              <span className={cn("flex items-center gap-0.5 text-xs font-medium", trendColors[trend])}>
                {trendIcons[trend]}
                {trendLabel}
              </span>
            )}
          </div>
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
        </CardContent>
        {/* 장식용 그라데이션 */}
        <div className={cn(
          "absolute bottom-0 left-0 right-0 h-1 opacity-0 transition-opacity group-hover:opacity-100",
          color === "blue" && "bg-gradient-to-r from-blue-500 to-blue-600",
          color === "green" && "bg-gradient-to-r from-emerald-500 to-emerald-600",
          color === "orange" && "bg-gradient-to-r from-orange-500 to-orange-600",
          color === "purple" && "bg-gradient-to-r from-purple-500 to-purple-600",
          color === "pink" && "bg-gradient-to-r from-pink-500 to-pink-600",
          color === "default" && "bg-gradient-to-r from-gray-400 to-gray-500"
        )} />
      </Card>
    )

    if (tooltip) {
      return (
        <ShadcnTooltip>
          <TooltipTrigger asChild>
            {cardContent}
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-sm">{tooltip}</p>
          </TooltipContent>
        </ShadcnTooltip>
      )
    }

    return cardContent
  }

  // 히트맵 셀 컴포넌트 (개선된 버전)
  const HeatmapCell = ({
    value,
    maxValue,
    day,
    hour,
    isPeak = false
  }: {
    value: number
    maxValue: number
    day: string
    hour: number
    isPeak?: boolean
  }) => {
    const intensity = maxValue > 0 ? value / maxValue : 0

    // GitHub 스타일 녹색 그라데이션
    const bgColor = intensity === 0
      ? 'bg-muted'
      : intensity < 0.2
        ? 'bg-emerald-200 dark:bg-emerald-900/60'
        : intensity < 0.4
          ? 'bg-emerald-300 dark:bg-emerald-800'
          : intensity < 0.6
            ? 'bg-emerald-400 dark:bg-emerald-700'
            : intensity < 0.8
              ? 'bg-emerald-500 dark:bg-emerald-600'
              : 'bg-emerald-600 dark:bg-emerald-500'

    const percentage = maxValue > 0 ? ((value / maxValue) * 100).toFixed(1) : 0

    return (
      <ShadcnTooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "w-5 h-5 rounded-md cursor-pointer transition-all duration-150",
              "hover:scale-125 hover:ring-2 hover:ring-primary hover:ring-offset-1 hover:z-10",
              bgColor,
              isPeak && "ring-2 ring-orange-400 ring-offset-1"
            )}
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

  return (
    <PageContainer maxWidth="wide">
      {/* 필터 영역 */}
      <div className="flex flex-wrap gap-4 mb-6">
        <Select value={selectedCollection || ""} onValueChange={setSelectedCollection}>
          <SelectTrigger className="w-[200px]">
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
            value={format(dateRange.from, "yyyy-MM-dd")}
            onChange={(e) => setDateRange(prev => ({ ...prev, from: new Date(e.target.value) }))}
            className="w-[150px]"
          />
          <span className="text-sm text-muted-foreground">~</span>
          <Input
            type="date"
            value={format(dateRange.to, "yyyy-MM-dd")}
            onChange={(e) => setDateRange(prev => ({ ...prev, to: new Date(e.target.value) }))}
            className="w-[150px]"
          />
        </div>

        <Button onClick={refreshAllData} disabled={loading}>
          <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
          새로고침
        </Button>

        {/* 실시간 활성 세션 표시 */}
        {activeSessions && (
          <div className="flex items-center gap-2 ml-auto">
            <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-sm text-muted-foreground">
              활성 세션: <strong>{activeSessions.active_count}</strong>
            </span>
          </div>
        )}
      </div>

      {/* 주요 메트릭 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <MetricCard
          title="총 쿼리"
          value={(summary?.total_queries ?? 0).toLocaleString()}
          subtitle={`${summary?.period?.days || 0}일간`}
          icon={MessageSquare}
          color="blue"
          tooltip="선택한 기간 동안 처리된 총 질의 수"
        />
        <MetricCard
          title="고유 세션"
          value={(summary?.unique_sessions ?? 0).toLocaleString()}
          subtitle="방문자 수"
          icon={Users}
          color="purple"
          tooltip="고유한 세션 ID 기준 방문자 수"
        />
        <MetricCard
          title="평균 턴수"
          value={conversationStats?.avg_turns?.toFixed(1) || "0"}
          subtitle="세션당 대화"
          icon={TrendingUp}
          color="green"
          tooltip="한 세션에서 평균적으로 주고받은 대화 횟수"
        />
        <MetricCard
          title="재방문율"
          value={`${conversationStats?.revisit_rate?.toFixed(1) || 0}%`}
          subtitle="재방문 사용자"
          icon={Users}
          color="pink"
          tooltip="2회 이상 방문한 사용자 비율"
        />
        <MetricCard
          title="평균 응답시간"
          value={`${(summary?.avg_response_time_ms ?? 0).toFixed(0)}ms`}
          subtitle="응답 속도"
          icon={Clock}
          color="orange"
          tooltip="질의에 대한 평균 응답 소요 시간"
        />
        <MetricCard
          title="토큰 사용량"
          value={`${((summary?.total_tokens ?? 0) / 1000).toFixed(1)}K`}
          subtitle="LLM 토큰"
          icon={Zap}
          color="green"
          tooltip="LLM API에서 사용된 총 토큰 수"
        />
      </div>

      {/* 탭 컨텐츠 */}
      <Tabs defaultValue="dashboard" className="space-y-4">
        <TabsList>
          <TabsTrigger value="dashboard">대시보드</TabsTrigger>
          <TabsTrigger value="patterns">사용 패턴</TabsTrigger>
          <TabsTrigger value="performance">성능</TabsTrigger>
        </TabsList>

        {/* 대시보드 탭 (개요 + 실시간 통합) */}
        <TabsContent value="dashboard" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 일별 추이 - shadcn 차트 스타일 */}
            <Card className="col-span-1 lg:col-span-2">
              <CardHeader className="flex flex-col items-stretch border-b p-0 sm:flex-row">
                <div className="flex flex-1 flex-col justify-center gap-1 px-6 py-4">
                  <CardTitle className="text-base font-semibold">일별 사용 추이</CardTitle>
                  <CardDescription className="text-sm">
                    {summary?.period?.days || 0}일간 사용량 현황
                  </CardDescription>
                </div>
                <div className="flex">
                  {(["queries", "sessions", "avg_response_time"] as const).map((key) => {
                    const totals = {
                      queries: timeline.reduce((acc, curr) => acc + (curr.queries || 0), 0),
                      sessions: timeline.reduce((acc, curr) => acc + (curr.sessions || 0), 0),
                      avg_response_time: timeline.length > 0
                        ? Math.round(timeline.reduce((acc, curr) => acc + (curr.avg_response_time || 0), 0) / timeline.length)
                        : 0,
                    }
                    const labels = {
                      queries: "총 쿼리",
                      sessions: "총 세션",
                      avg_response_time: "평균 응답",
                    }
                    const units = {
                      queries: "",
                      sessions: "",
                      avg_response_time: "ms",
                    }
                    return (
                      <div
                        key={key}
                        className="flex flex-1 flex-col justify-center gap-1 border-t px-4 py-3 text-left even:border-l sm:border-l sm:border-t-0 sm:px-6 sm:py-4"
                      >
                        <span className="text-xs text-muted-foreground">
                          {labels[key]}
                        </span>
                        <span className="text-lg font-bold leading-none sm:text-xl tabular-nums">
                          {totals[key].toLocaleString()}{units[key]}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </CardHeader>
              <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
                <ChartContainer
                  config={timelineChartConfig}
                  className="aspect-auto h-[250px] w-full"
                >
                  <LineChart
                    data={timeline}
                    margin={{ left: 12, right: 12 }}
                  >
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      minTickGap={32}
                      tickFormatter={(v) => format(new Date(v), "MM/dd")}
                    />
                    <YAxis
                      yAxisId="left"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                    />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          className="w-[180px]"
                          labelFormatter={(value) => format(new Date(value), "yyyy-MM-dd (EEE)")}
                        />
                      }
                    />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="queries"
                      stroke="var(--color-queries)"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="sessions"
                      stroke="var(--color-sessions)"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="avg_response_time"
                      stroke="var(--color-avg_response_time)"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ChartContainer>
              </CardContent>
            </Card>

            {/* 실시간 활성 세션 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  실시간 현황
                </CardTitle>
                <CardDescription>최근 5분 내 활동</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center mb-4">
                  <div className="text-4xl font-bold text-green-500">
                    {activeSessions?.active_count ?? 0}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">활성 세션</div>
                </div>
                {activeSessions?.by_collection && Object.keys(activeSessions.by_collection).length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-muted-foreground">컬렉션별</div>
                    {Object.entries(activeSessions.by_collection).map(([col, count]) => (
                      <div key={col} className="flex justify-between items-center text-sm">
                        <span className="truncate">{col}</span>
                        <Badge variant="secondary">{count}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 최근 질문 피드 */}
            <Card className="col-span-1 lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  최근 질문
                </CardTitle>
                <CardDescription>실시간 질문 피드 (30초마다 갱신)</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[280px]">
                  <div className="space-y-2">
                    {recentQueries.length > 0 ? recentQueries.map((q, idx) => (
                      <div key={idx} className="p-2 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm flex-1 line-clamp-2">{q.query}</p>
                          {q.response_time_ms && (
                            <Badge variant="outline" className="shrink-0 text-xs">
                              {q.response_time_ms.toFixed(0)}ms
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <span>{q.timestamp ? format(new Date(q.timestamp), "HH:mm:ss") : "-"}</span>
                        </div>
                      </div>
                    )) : (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        오늘의 질문 데이터가 없습니다
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* 인기 검색어 */}
            <Card>
              <CardHeader>
                <CardTitle>인기 검색어</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {summary?.top_queries?.slice(0, 8).map((query, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-1.5 rounded hover:bg-muted">
                      <Badge variant="outline" className="text-xs w-5 h-5 p-0 flex items-center justify-center">{idx + 1}</Badge>
                      <span className="text-sm truncate flex-1">{query}</span>
                    </div>
                  )) || <p className="text-sm text-muted-foreground">데이터 없음</p>}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* 사용 패턴 탭 (사용자 행동 + 문서 분석 통합) */}
        <TabsContent value="patterns" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 시간대별 히트맵 */}
            <Card className="col-span-1 lg:col-span-2">
              <CardHeader>
                <CardTitle>시간대별 사용량 히트맵</CardTitle>
                <CardDescription>요일별/시간별 사용 패턴 (셀을 호버하여 상세 정보 확인)</CardDescription>
              </CardHeader>
              <CardContent>
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

                    // 전체 합계
                    const totalSum = daySums.reduce((sum, val) => sum + val, 0)

                    // 값 범위 계산 (범례용)
                    const step = Math.ceil(heatmap.max_value / 5)

                    return (
                      <div className="space-y-4">
                        {/* 피크 타임 표시 */}
                        {peakValue > 0 && (
                          <div className="flex items-center gap-2 p-3 bg-orange-50 dark:bg-orange-950/30 rounded-lg border border-orange-200 dark:border-orange-800">
                            <Zap className="h-4 w-4 text-orange-500" />
                            <span className="text-sm">
                              <strong>피크 타임:</strong> {heatmap.labels.days[peakDay]} {peakHour}시 ({peakValue.toLocaleString()}건)
                            </span>
                          </div>
                        )}

                        <div className="flex gap-4">
                          {/* 히트맵 본체 */}
                          <div className="flex-1 space-y-1.5">
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
                                <span className="w-10 text-xs text-muted-foreground text-right">{day}</span>
                                <div className="flex gap-1">
                                  {heatmap.heatmap[dayIdx]?.map((value, hourIdx) => (
                                    <HeatmapCell
                                      key={hourIdx}
                                      value={value}
                                      maxValue={heatmap.max_value}
                                      day={day}
                                      hour={hourIdx}
                                      isPeak={dayIdx === peakDay && hourIdx === peakHour && peakValue > 0}
                                    />
                                  ))}
                                </div>
                                {/* 요일별 합계 */}
                                <div className="flex items-center gap-2 ml-2">
                                  <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-emerald-500 rounded-full transition-all"
                                      style={{ width: maxDaySum > 0 ? `${(daySums[dayIdx] / maxDaySum) * 100}%` : '0%' }}
                                    />
                                  </div>
                                  <span className="text-xs text-muted-foreground w-12 text-right font-mono">
                                    {daySums[dayIdx].toLocaleString()}
                                  </span>
                                </div>
                              </div>
                            ))}

                            {/* 시간대 구분 */}
                            <div className="flex gap-1 ml-12 mt-2 pt-2 border-t">
                              <div className="flex-1 text-center text-[10px] text-muted-foreground">새벽 (0-6)</div>
                              <div className="flex-1 text-center text-[10px] text-muted-foreground">오전 (6-12)</div>
                              <div className="flex-1 text-center text-[10px] text-muted-foreground">오후 (12-18)</div>
                              <div className="flex-1 text-center text-[10px] text-muted-foreground">저녁 (18-24)</div>
                            </div>
                          </div>
                        </div>

                        {/* 범례 및 통계 */}
                        <div className="flex items-center justify-between pt-4 border-t">
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-muted-foreground">0건</span>
                            <div className="flex gap-1">
                              <div className="w-5 h-5 bg-muted rounded-md" />
                              <div className="w-5 h-5 bg-emerald-200 dark:bg-emerald-900/60 rounded-md" />
                              <div className="w-5 h-5 bg-emerald-300 dark:bg-emerald-800 rounded-md" />
                              <div className="w-5 h-5 bg-emerald-400 dark:bg-emerald-700 rounded-md" />
                              <div className="w-5 h-5 bg-emerald-500 dark:bg-emerald-600 rounded-md" />
                              <div className="w-5 h-5 bg-emerald-600 dark:bg-emerald-500 rounded-md" />
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

            {/* TOP 참조 문서 */}
            <Card>
              <CardHeader>
                <CardTitle>가장 많이 참조된 문서</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {topDocuments.length > 0 ? topDocuments.slice(0, 8).map((doc, idx) => (
                    <div key={idx} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs w-5 h-5 p-0 flex items-center justify-center">{idx + 1}</Badge>
                          <span className="text-sm truncate max-w-[180px]">{doc.name}</span>
                        </div>
                        <span className="text-xs font-medium text-muted-foreground">{doc.count}회</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${doc.percentage}%` }}
                        />
                      </div>
                    </div>
                  )) : <p className="text-sm text-muted-foreground">데이터 없음</p>}
                </div>
              </CardContent>
            </Card>

            {/* 문서 참조 분포 차트 */}
            <Card>
              <CardHeader>
                <CardTitle>문서 참조 분포</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={topDocuments.slice(0, 5)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis
                      dataKey="name"
                      type="category"
                      width={100}
                      tickFormatter={(v) => v.length > 12 ? v.slice(0, 12) + '...' : v}
                    />
                    <Tooltip />
                    <Bar dataKey="count" fill="#8884d8" name="참조 횟수" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* 성능 탭 */}
        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 응답시간 분포 */}
            <Card>
              <CardHeader>
                <CardTitle>응답시간 분포</CardTitle>
                <CardDescription>구간별 빈도</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={responseTimeDist?.histogram || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="range" />
                    <YAxis />
                    <Tooltip formatter={(v: number) => [`${v}건`, "횟수"]} />
                    <Bar dataKey="count" fill="#8884d8" name="횟수" />
                  </BarChart>
                </ResponsiveContainer>
                {responseTimeDist && (
                  <div className="grid grid-cols-4 gap-4 mt-4 text-center">
                    <div>
                      <div className="text-lg font-bold">{responseTimeDist.percentiles.p50.toFixed(0)}ms</div>
                      <div className="text-xs text-muted-foreground">P50</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold">{responseTimeDist.percentiles.p90.toFixed(0)}ms</div>
                      <div className="text-xs text-muted-foreground">P90</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold">{responseTimeDist.percentiles.p95.toFixed(0)}ms</div>
                      <div className="text-xs text-muted-foreground">P95</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold">{responseTimeDist.percentiles.p99.toFixed(0)}ms</div>
                      <div className="text-xs text-muted-foreground">P99</div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 토큰 사용량 추이 */}
            <Card>
              <CardHeader>
                <CardTitle>토큰 사용량 추이</CardTitle>
                <CardDescription>
                  총 {((tokenTrend?.total ?? 0) / 1000).toFixed(1)}K 토큰 | 일평균 {((tokenTrend?.avg_daily ?? 0) / 1000).toFixed(1)}K
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={tokenTrend?.trend || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tickFormatter={(v) => format(new Date(v), "MM/dd")} />
                    <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                    <Tooltip
                      labelFormatter={(v) => format(new Date(v), "yyyy-MM-dd")}
                      formatter={(v: number) => [`${v.toLocaleString()} 토큰`, "사용량"]}
                    />
                    <Area type="monotone" dataKey="tokens" stroke="#82ca9d" fill="#82ca9d" fillOpacity={0.3} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* 성능 요약 */}
            <Card className="col-span-1 lg:col-span-2">
              <CardHeader>
                <CardTitle>성능 요약</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-green-500">
                      {responseTimeDist?.stats.avg.toFixed(0) || 0}ms
                    </div>
                    <div className="text-sm text-muted-foreground">평균 응답시간</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-blue-500">
                      {responseTimeDist?.stats.min.toFixed(0) || 0}ms
                    </div>
                    <div className="text-sm text-muted-foreground">최소 응답시간</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-orange-500">
                      {responseTimeDist?.stats.max.toFixed(0) || 0}ms
                    </div>
                    <div className="text-sm text-muted-foreground">최대 응답시간</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-purple-500">
                      {responseTimeDist?.stats.total_count || 0}
                    </div>
                    <div className="text-sm text-muted-foreground">총 요청 수</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </PageContainer>
  )
}
