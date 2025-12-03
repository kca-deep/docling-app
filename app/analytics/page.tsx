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
} from "@/components/ui/chart"
import { cn } from "@/lib/utils"
import { format, addDays } from "date-fns"
import {
  RefreshCw, TrendingUp, Users, MessageSquare,
  Clock, Activity, Zap
} from "lucide-react"
import {
  XAxis, YAxis, CartesianGrid,
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
  const [activeSessions, setActiveSessions] = useState<ActiveSessions | null>(null)
  const [recentQueries, setRecentQueries] = useState<RecentQuery[]>([])

  // 일별 추이 차트 활성 메트릭
  const [activeTimelineMetric, setActiveTimelineMetric] = useState<"queries" | "sessions" | "avg_response_time">("queries")

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
        activeRes, recentRes
      ] = await Promise.allSettled([
        fetch(`http://localhost:8000/api/analytics/summary?${dateParams}`),
        fetch(`http://localhost:8000/api/analytics/timeline?${params}&period=daily`),
        fetch(`http://localhost:8000/api/analytics/hourly-heatmap?${params}`),
        fetch(`http://localhost:8000/api/analytics/conversation-stats?${params}`),
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
              "animate-in fade-in zoom-in-50",
              bgColor,
              isPeak && "ring-2 ring-orange-400 ring-offset-1"
            )}
            style={{ animationDelay: `${animationDelay}ms`, animationFillMode: 'backwards' }}
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
            value={format(dateRange.from, "yyyy-MM-dd")}
            onChange={(e) => setDateRange(prev => ({ ...prev, from: new Date(e.target.value) }))}
            className="w-[130px] h-9"
          />
          <span className="text-sm text-muted-foreground">~</span>
          <Input
            type="date"
            value={format(dateRange.to, "yyyy-MM-dd")}
            onChange={(e) => setDateRange(prev => ({ ...prev, to: new Date(e.target.value) }))}
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
            <MessageSquare className="h-3 w-3 text-blue-500" />
            <span className="font-semibold tabular-nums">{(summary?.total_queries ?? 0).toLocaleString()}</span>
            <span className="text-muted-foreground text-xs">쿼리</span>
          </Badge>
          <Badge variant="secondary" className="gap-1.5 px-2.5 py-1 font-normal">
            <Users className="h-3 w-3 text-purple-500" />
            <span className="font-semibold tabular-nums">{(summary?.unique_sessions ?? 0).toLocaleString()}</span>
            <span className="text-muted-foreground text-xs">세션</span>
          </Badge>
          <Badge variant="secondary" className="gap-1.5 px-2.5 py-1 font-normal">
            <TrendingUp className="h-3 w-3 text-emerald-500" />
            <span className="font-semibold tabular-nums">{conversationStats?.avg_turns?.toFixed(1) || "0"}</span>
            <span className="text-muted-foreground text-xs">턴</span>
          </Badge>
          <Badge variant="secondary" className="gap-1.5 px-2.5 py-1 font-normal">
            <Clock className="h-3 w-3 text-orange-500" />
            <span className="font-semibold tabular-nums">{(summary?.avg_response_time_ms ?? 0).toFixed(0)}</span>
            <span className="text-muted-foreground text-xs">ms</span>
          </Badge>
          <Badge variant="secondary" className="gap-1.5 px-2.5 py-1 font-normal">
            <Zap className="h-3 w-3 text-yellow-500" />
            <span className="font-semibold tabular-nums">{((summary?.total_tokens ?? 0) / 1000).toFixed(1)}K</span>
            <span className="text-muted-foreground text-xs">토큰</span>
          </Badge>

          {/* 실시간 활성 세션 */}
          {activeSessions && (
            <Badge variant="outline" className="gap-1.5 px-2.5 py-1 font-normal border-green-500/50">
              <div className="h-1.5 w-1.5 bg-green-500 rounded-full animate-pulse" />
              <span className="font-semibold tabular-nums text-green-600 dark:text-green-400">{activeSessions.active_count}</span>
              <span className="text-muted-foreground text-xs">활성</span>
            </Badge>
          )}
        </div>
      </div>

      {/* 탭 컨텐츠 */}
      <Tabs defaultValue="dashboard" className="space-y-4">
        <TabsList>
          <TabsTrigger value="dashboard">대시보드</TabsTrigger>
          <TabsTrigger value="patterns">사용 패턴</TabsTrigger>
        </TabsList>

        {/* 대시보드 탭 (개요 + 실시간 통합) */}
        <TabsContent value="dashboard" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 일별 추이 - 인터랙티브 차트 */}
            <Card className="col-span-1 lg:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between gap-4 px-4 py-3 sm:px-6">
                <CardTitle className="text-sm font-medium">일별 사용 추이</CardTitle>
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
                      queries: { label: "쿼리", unit: "", icon: MessageSquare, color: "text-blue-500" },
                      sessions: { label: "세션", unit: "", icon: Users, color: "text-purple-500" },
                      avg_response_time: { label: "응답", unit: "ms", icon: Clock, color: "text-orange-500" },
                    }
                    const { label, unit, icon: Icon, color } = config[key]
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
                          <Icon className={cn("h-3 w-3", isActive ? "text-primary-foreground" : color)} />
                          <span className="font-semibold tabular-nums">{totals[key].toLocaleString()}{unit}</span>
                          <span className={cn("text-xs", isActive ? "text-primary-foreground/70" : "text-muted-foreground")}>{label}</span>
                        </Badge>
                      </button>
                    )
                  })}
                </div>
              </CardHeader>
              <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
                <ChartContainer
                  config={timelineChartConfig}
                  className="aspect-auto h-[200px] w-full"
                >
                  <AreaChart
                    accessibilityLayer
                    data={timeline}
                    margin={{ left: 12, right: 12 }}
                  >
                    <defs>
                      <linearGradient id="fillQueries" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-queries)" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="var(--color-queries)" stopOpacity={0.1} />
                      </linearGradient>
                      <linearGradient id="fillSessions" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-sessions)" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="var(--color-sessions)" stopOpacity={0.1} />
                      </linearGradient>
                      <linearGradient id="fillResponseTime" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-avg_response_time)" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="var(--color-avg_response_time)" stopOpacity={0.1} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      minTickGap={32}
                      tickFormatter={(v) => format(new Date(v), "M/d")}
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
                          className="w-[150px]"
                          labelFormatter={(value) => format(new Date(value), "M월 d일 (EEE)")}
                          indicator="line"
                        />
                      }
                    />
                    <Area
                      type="natural"
                      dataKey={activeTimelineMetric}
                      stroke={`var(--color-${activeTimelineMetric})`}
                      fill={activeTimelineMetric === "queries" ? "url(#fillQueries)" : activeTimelineMetric === "sessions" ? "url(#fillSessions)" : "url(#fillResponseTime)"}
                      fillOpacity={0.4}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 5, strokeWidth: 2, className: "fill-background" }}
                    />
                  </AreaChart>
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

            {/* 시간대별 히트맵 */}
            <Card className="col-span-1 lg:col-span-3">
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

                    // 시간대별 합계 계산 (열 합계)
                    const hourSums = Array.from({ length: 24 }, (_, hourIdx) =>
                      heatmap.heatmap.reduce((sum, dayData) => sum + (dayData[hourIdx] || 0), 0)
                    )
                    const maxHourSum = Math.max(...hourSums)

                    // 전체 합계
                    const totalSum = daySums.reduce((sum, val) => sum + val, 0)

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
                                      animationDelay={dayIdx * 30 + hourIdx * 10}
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

                            {/* 시간대별 합계 바 차트 */}
                            <div className="flex items-end gap-1 ml-12 mt-3 pt-3 border-t h-16">
                              {hourSums.map((sum, hourIdx) => {
                                const height = maxHourSum > 0 ? (sum / maxHourSum) * 100 : 0
                                return (
                                  <ShadcnTooltip key={hourIdx}>
                                    <TooltipTrigger asChild>
                                      <div
                                        className="w-5 bg-primary/80 hover:bg-primary rounded-t transition-all duration-300 cursor-pointer animate-in slide-in-from-bottom"
                                        style={{
                                          height: `${Math.max(height, 4)}%`,
                                          animationDelay: `${hourIdx * 20 + 300}ms`,
                                          animationFillMode: 'backwards'
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
          </div>
        </TabsContent>

        {/* 사용 패턴 탭 */}
        <TabsContent value="patterns" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                <ScrollArea className="h-[320px]">
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
                  {summary?.top_queries?.slice(0, 10).map((query, idx) => (
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
      </Tabs>
    </PageContainer>
  )
}
