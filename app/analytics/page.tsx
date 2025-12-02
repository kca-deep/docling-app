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
      const names = data.collections?.map((c: any) => c.name) || []
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

  // 메트릭 카드 컴포넌트
  const MetricCard = ({ title, value, subtitle, icon: Icon }: any) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      </CardContent>
    </Card>
  )

  // 히트맵 셀 컴포넌트
  const HeatmapCell = ({ value, maxValue }: { value: number; maxValue: number }) => {
    const intensity = maxValue > 0 ? value / maxValue : 0
    const bgColor = intensity === 0
      ? 'bg-muted'
      : intensity < 0.25
        ? 'bg-blue-200 dark:bg-blue-900'
        : intensity < 0.5
          ? 'bg-blue-400 dark:bg-blue-700'
          : intensity < 0.75
            ? 'bg-blue-500 dark:bg-blue-600'
            : 'bg-blue-600 dark:bg-blue-500'

    return (
      <div
        className={cn("w-4 h-4 rounded-sm", bgColor)}
        title={`${value}건`}
      />
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
        />
        <MetricCard
          title="고유 세션"
          value={(summary?.unique_sessions ?? 0).toLocaleString()}
          icon={Users}
        />
        <MetricCard
          title="평균 턴수"
          value={conversationStats?.avg_turns?.toFixed(1) || "0"}
          subtitle="세션당 대화"
          icon={TrendingUp}
        />
        <MetricCard
          title="재방문율"
          value={`${conversationStats?.revisit_rate?.toFixed(1) || 0}%`}
          icon={Users}
        />
        <MetricCard
          title="평균 응답시간"
          value={`${(summary?.avg_response_time_ms ?? 0).toFixed(0)}ms`}
          icon={Clock}
        />
        <MetricCard
          title="토큰 사용량"
          value={`${((summary?.total_tokens ?? 0) / 1000).toFixed(1)}K`}
          icon={Zap}
        />
      </div>

      {/* 탭 컨텐츠 */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">개요</TabsTrigger>
          <TabsTrigger value="behavior">사용자 행동</TabsTrigger>
          <TabsTrigger value="documents">문서 분석</TabsTrigger>
          <TabsTrigger value="performance">성능</TabsTrigger>
          <TabsTrigger value="realtime">실시간</TabsTrigger>
        </TabsList>

        {/* 개요 탭 */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 일별 추이 */}
            <Card className="col-span-1 lg:col-span-2">
              <CardHeader>
                <CardTitle>일별 사용 추이</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={timeline}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tickFormatter={(v) => format(new Date(v), "MM/dd")} />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip labelFormatter={(v) => format(new Date(v), "yyyy-MM-dd")} />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="queries" stroke="#8884d8" name="쿼리" strokeWidth={2} />
                    <Line yAxisId="left" type="monotone" dataKey="sessions" stroke="#82ca9d" name="세션" strokeWidth={2} />
                    <Line yAxisId="right" type="monotone" dataKey="avg_response_time" stroke="#ffc658" name="응답시간(ms)" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* 에러 차트 */}
            <Card>
              <CardHeader>
                <CardTitle>에러 발생 현황</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={timeline}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tickFormatter={(v) => format(new Date(v), "MM/dd")} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="errors" fill="#ef4444" name="에러" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* 인기 쿼리 */}
            <Card>
              <CardHeader>
                <CardTitle>인기 검색어 TOP 10</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {summary?.top_queries?.slice(0, 10).map((query, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted">
                      <Badge variant="outline">{idx + 1}</Badge>
                      <span className="text-sm truncate flex-1">{query}</span>
                    </div>
                  )) || <p className="text-sm text-muted-foreground">데이터 없음</p>}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* 사용자 행동 탭 */}
        <TabsContent value="behavior" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 시간대별 히트맵 */}
            <Card className="col-span-1 lg:col-span-2">
              <CardHeader>
                <CardTitle>시간대별 사용량 히트맵</CardTitle>
                <CardDescription>요일별/시간별 사용 패턴</CardDescription>
              </CardHeader>
              <CardContent>
                {heatmap && heatmap.labels?.days ? (
                  <div className="space-y-2">
                    {/* 시간 레이블 */}
                    <div className="flex gap-1 ml-8">
                      {[0, 3, 6, 9, 12, 15, 18, 21].map(h => (
                        <div key={h} className="w-12 text-xs text-muted-foreground text-center">{h}시</div>
                      ))}
                    </div>
                    {/* 히트맵 */}
                    {heatmap.labels.days.map((day, dayIdx) => (
                      <div key={day} className="flex items-center gap-1">
                        <span className="w-6 text-xs text-muted-foreground">{day}</span>
                        <div className="flex gap-0.5">
                          {heatmap.heatmap[dayIdx]?.map((value, hourIdx) => (
                            <HeatmapCell key={hourIdx} value={value} maxValue={heatmap.max_value} />
                          ))}
                        </div>
                      </div>
                    ))}
                    {/* 범례 */}
                    <div className="flex items-center gap-2 mt-4 text-xs text-muted-foreground">
                      <span>적음</span>
                      <div className="flex gap-0.5">
                        <div className="w-4 h-4 bg-muted rounded-sm" />
                        <div className="w-4 h-4 bg-blue-200 dark:bg-blue-900 rounded-sm" />
                        <div className="w-4 h-4 bg-blue-400 dark:bg-blue-700 rounded-sm" />
                        <div className="w-4 h-4 bg-blue-500 dark:bg-blue-600 rounded-sm" />
                        <div className="w-4 h-4 bg-blue-600 dark:bg-blue-500 rounded-sm" />
                      </div>
                      <span>많음</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">데이터 없음</p>
                )}
              </CardContent>
            </Card>

            {/* 대화 통계 */}
            <Card>
              <CardHeader>
                <CardTitle>대화 통계</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">총 세션</span>
                  <span className="font-medium">{conversationStats?.total_sessions ?? 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">고유 사용자</span>
                  <span className="font-medium">{conversationStats?.unique_users ?? 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">평균 대화 턴수</span>
                  <span className="font-medium">{conversationStats?.avg_turns?.toFixed(1) ?? 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">평균 사용자 메시지</span>
                  <span className="font-medium">{conversationStats?.avg_user_messages?.toFixed(1) ?? 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">재방문율</span>
                  <span className="font-medium">{conversationStats?.revisit_rate?.toFixed(1) ?? 0}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">재생성 비율</span>
                  <span className="font-medium">{conversationStats?.regeneration_rate?.toFixed(1) ?? 0}%</span>
                </div>
              </CardContent>
            </Card>

          </div>
        </TabsContent>

        {/* 문서 분석 탭 */}
        <TabsContent value="documents" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* TOP 참조 문서 */}
            <Card>
              <CardHeader>
                <CardTitle>가장 많이 참조된 문서 TOP 10</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {topDocuments.length > 0 ? topDocuments.map((doc, idx) => (
                    <div key={idx} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{idx + 1}</Badge>
                          <span className="text-sm truncate max-w-[200px]">{doc.name}</span>
                        </div>
                        <span className="text-sm font-medium">{doc.count}회</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
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
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={topDocuments.slice(0, 5)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis
                      dataKey="name"
                      type="category"
                      width={120}
                      tickFormatter={(v) => v.length > 15 ? v.slice(0, 15) + '...' : v}
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

        {/* 실시간 탭 */}
        <TabsContent value="realtime" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 활성 세션 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  실시간 활성 세션
                </CardTitle>
                <CardDescription>최근 5분 내 활동</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center mb-6">
                  <div className="text-5xl font-bold text-green-500">
                    {activeSessions?.active_count ?? 0}
                  </div>
                  <div className="text-sm text-muted-foreground mt-2">현재 활성 세션</div>
                </div>
                {activeSessions?.by_collection && Object.keys(activeSessions.by_collection).length > 0 && (
                  <div className="space-y-2">
                    <div className="text-sm font-medium">컬렉션별 분포</div>
                    {Object.entries(activeSessions.by_collection).map(([col, count]) => (
                      <div key={col} className="flex justify-between items-center">
                        <span className="text-sm truncate">{col}</span>
                        <Badge>{count}</Badge>
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
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {recentQueries.length > 0 ? recentQueries.map((q, idx) => (
                      <div key={idx} className="p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm flex-1">{q.query}</p>
                          {q.response_time_ms && (
                            <Badge variant="outline" className="shrink-0">
                              {q.response_time_ms.toFixed(0)}ms
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                          <span>{q.collection}</span>
                          <span>|</span>
                          <span>{q.timestamp ? format(new Date(q.timestamp), "HH:mm:ss") : "-"}</span>
                          {q.session_id && (
                            <>
                              <span>|</span>
                              <span>#{q.session_id}</span>
                            </>
                          )}
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
          </div>
        </TabsContent>
      </Tabs>
    </PageContainer>
  )
}
