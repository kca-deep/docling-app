"use client"

import { useState, useEffect } from "react"
import { PageContainer } from "@/components/page-container"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { format, addDays } from "date-fns"
import { CalendarIcon, RefreshCw, TrendingUp, TrendingDown, AlertCircle, CheckCircle } from "lucide-react"
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts"
import { toast } from "sonner"

interface AnalyticsSummary {
  total_queries: number
  unique_sessions: number
  total_tokens: number
  error_count: number
  avg_response_time_ms: number
  period: {
    from: string
    to: string
    days: number
  }
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

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(false)
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null)
  const [timeline, setTimeline] = useState<TimelineData[]>([])
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null)
  const [collections, setCollections] = useState<string[]>([])
  const [dateRange, setDateRange] = useState<{
    from: Date | undefined
    to: Date | undefined
  }>({
    from: addDays(new Date(), -7),
    to: new Date()
  })

  // 컬렉션 목록 가져오기
  const fetchCollections = async () => {
    try {
      const response = await fetch("http://localhost:8000/api/analytics/collections")
      if (!response.ok) throw new Error("컬렉션 조회 실패")
      const data = await response.json()
      const collectionNames = data.collections.map((c: any) => c.collection_name)
      setCollections(collectionNames)
      if (collectionNames.length > 0 && !selectedCollection) {
        setSelectedCollection(collectionNames[0])
      }
    } catch (error) {
      console.error("컬렉션 조회 오류:", error)
    }
  }

  // 통계 요약 가져오기
  const fetchSummary = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (selectedCollection) params.append("collection_name", selectedCollection)
      if (dateRange.from) params.append("date_from", format(dateRange.from, "yyyy-MM-dd"))
      if (dateRange.to) params.append("date_to", format(dateRange.to, "yyyy-MM-dd"))

      const response = await fetch(`http://localhost:8000/api/analytics/summary?${params}`)
      if (!response.ok) throw new Error("통계 요약 조회 실패")
      const data = await response.json()
      setSummary(data)
    } catch (error) {
      console.error("통계 요약 조회 오류:", error)
      toast.error("통계 데이터를 불러올 수 없습니다")
    } finally {
      setLoading(false)
    }
  }

  // 타임라인 데이터 가져오기
  const fetchTimeline = async () => {
    if (!selectedCollection) return

    try {
      const days = dateRange.from && dateRange.to
        ? Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24))
        : 7

      const response = await fetch(
        `http://localhost:8000/api/analytics/timeline?collection_name=${selectedCollection}&period=daily&days=${days}`
      )
      if (!response.ok) throw new Error("타임라인 조회 실패")
      const data = await response.json()
      setTimeline(data.data || [])
    } catch (error) {
      console.error("타임라인 조회 오류:", error)
    }
  }

  // 통계 집계 트리거
  const triggerAggregation = async () => {
    try {
      const today = format(new Date(), "yyyy-MM-dd")
      const response = await fetch(
        `http://localhost:8000/api/analytics/aggregate?target_date=${today}`,
        { method: "POST" }
      )
      if (!response.ok) throw new Error("집계 실행 실패")
      toast.success("통계 집계가 시작되었습니다")

      // 5초 후 데이터 새로고침
      setTimeout(() => {
        fetchSummary()
        fetchTimeline()
      }, 5000)
    } catch (error) {
      console.error("집계 실행 오류:", error)
      toast.error("집계 실행에 실패했습니다")
    }
  }

  useEffect(() => {
    fetchCollections()
  }, [])

  useEffect(() => {
    if (selectedCollection) {
      fetchSummary()
      fetchTimeline()
    }
  }, [selectedCollection, dateRange])

  // 차트 색상
  const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042"]

  // 메트릭 카드 컴포넌트
  const MetricCard = ({ title, value, subtitle, trend }: any) => (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
        {trend && (
          <div className="flex items-center mt-2">
            {trend > 0 ? (
              <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-500 mr-1" />
            )}
            <span className="text-xs">{Math.abs(trend)}%</span>
          </div>
        )}
      </CardContent>
    </Card>
  )

  return (
    <PageContainer
      title="Analytics Dashboard"
      description="채팅 로그 및 사용 통계 분석"
    >
      {/* 필터 영역 */}
      <div className="flex flex-wrap gap-4 mb-6">
        <Select value={selectedCollection || ""} onValueChange={setSelectedCollection}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="컬렉션 선택" />
          </SelectTrigger>
          <SelectContent>
            {collections.map((collection) => (
              <SelectItem key={collection} value={collection}>
                {collection}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex gap-2 items-center">
          <Input
            type="date"
            value={dateRange.from ? format(dateRange.from, "yyyy-MM-dd") : ""}
            onChange={(e) => {
              const date = e.target.value ? new Date(e.target.value) : undefined
              setDateRange(prev => ({ ...prev, from: date }))
            }}
            className="w-[150px]"
          />
          <span className="text-sm text-muted-foreground">~</span>
          <Input
            type="date"
            value={dateRange.to ? format(dateRange.to, "yyyy-MM-dd") : ""}
            onChange={(e) => {
              const date = e.target.value ? new Date(e.target.value) : undefined
              setDateRange(prev => ({ ...prev, to: date }))
            }}
            className="w-[150px]"
          />
        </div>

        <Button
          onClick={() => {
            fetchSummary()
            fetchTimeline()
          }}
          disabled={loading}
        >
          <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
          새로고침
        </Button>

        <Button
          onClick={triggerAggregation}
          variant="outline"
        >
          오늘 통계 집계
        </Button>
      </div>

      {/* 주요 메트릭 */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <MetricCard
            title="총 쿼리"
            value={summary.total_queries.toLocaleString()}
            subtitle={`${summary.period?.days || 0}일간`}
          />
          <MetricCard
            title="고유 세션"
            value={summary.unique_sessions.toLocaleString()}
            subtitle="활성 사용자"
          />
          <MetricCard
            title="토큰 사용량"
            value={(summary.total_tokens / 1000).toFixed(1) + "K"}
            subtitle="총 토큰"
          />
          <MetricCard
            title="평균 응답시간"
            value={summary.avg_response_time_ms.toFixed(0) + "ms"}
            subtitle="응답 속도"
          />
          <MetricCard
            title="에러율"
            value={((summary.error_count / summary.total_queries) * 100).toFixed(1) + "%"}
            subtitle={`${summary.error_count}건 발생`}
          />
        </div>
      )}

      {/* 차트 영역 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 타임라인 차트 */}
        <Card className="col-span-1 lg:col-span-2">
          <CardHeader>
            <CardTitle>일별 사용 추이</CardTitle>
            <CardDescription>쿼리 수 및 세션 변화</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={timeline}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) => format(new Date(value), "MM/dd")}
                />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip
                  labelFormatter={(value) => format(new Date(value), "yyyy-MM-dd")}
                />
                <Legend />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="queries"
                  stroke="#8884d8"
                  name="쿼리"
                  strokeWidth={2}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="sessions"
                  stroke="#82ca9d"
                  name="세션"
                  strokeWidth={2}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="avg_response_time"
                  stroke="#ffc658"
                  name="응답시간(ms)"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* 에러 차트 */}
        <Card>
          <CardHeader>
            <CardTitle>에러 발생 현황</CardTitle>
            <CardDescription>일별 에러 횟수</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={timeline}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) => format(new Date(value), "MM/dd")}
                />
                <YAxis />
                <Tooltip
                  labelFormatter={(value) => format(new Date(value), "yyyy-MM-dd")}
                />
                <Bar dataKey="errors" fill="#ef4444" name="에러" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* 컬렉션 사용 비율 */}
        {summary?.collections && summary.collections.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>컬렉션 사용 비율</CardTitle>
              <CardDescription>컬렉션별 쿼리 분포</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={summary.collections.map((col, idx) => ({
                      name: col,
                      value: 1 // 실제 값은 API에서 받아와야 함
                    }))}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name }) => name}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {summary.collections.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* 인기 쿼리 */}
      {summary?.top_queries && summary.top_queries.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>인기 검색어 TOP 10</CardTitle>
            <CardDescription>가장 많이 검색된 쿼리</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {summary.top_queries.slice(0, 10).map((query, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted">
                  <span className="text-sm truncate flex-1 mr-4">
                    {idx + 1}. {query}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </PageContainer>
  )
}