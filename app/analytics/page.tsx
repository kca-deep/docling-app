"use client"

import { useState, useEffect, useMemo } from "react"
import { useTheme } from "next-themes"
import { PageContainer } from "@/components/page-container"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CollectionSelector } from "@/components/ui/collection-selector"
import { Badge } from "@/components/ui/badge"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import {
  Tooltip as ShadcnTooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import {
  RefreshCw, TrendingUp, Users, MessageSquare,
  Clock, Zap, Download, BarChart3, AlertTriangle,
  ThumbsUp, ThumbsDown
} from "lucide-react"
import { motion } from "framer-motion"
import {
  XAxis, YAxis, CartesianGrid,
  ComposedChart, Area, Line
} from "recharts"
import { getCollectionDisplayName } from "@/lib/collection-utils"
import { ServiceHealthBanner } from "@/components/service-health-banner"
import { ChatHistoryModal } from "./components/ChatHistoryModal"
import { useAnalyticsData } from "./hooks/useAnalyticsData"
import { timelineChartConfig, calculateMovingAverage, metricColors, feedbackCategoryLabels } from "./constants"



// ============================================================
// 메인 컴포넌트
// ============================================================

export default function AnalyticsPage() {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

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

  // 데이터 로직 훅
  const {
    loading,
    selectedCollection, setSelectedCollection,
    collections,
    dateRange, setDateRange,
    summary, timeline, heatmap, conversationStats,
    activeSessions, recentQueries,
    feedbackSummary, recentNegativeFeedbacks,
    downloading, downloadingErrors,
    fetchCollections, refreshAllData,
    handleExcelDownload, handleErrorLogDownload,
  } = useAnalyticsData()

  // 채팅 이력 모달 상태
  const [chatHistoryOpen, setChatHistoryOpen] = useState(false)

  // 일별 추이 차트 활성 메트릭
  const [activeTimelineMetric, setActiveTimelineMetric] = useState<"queries" | "sessions" | "avg_response_time">("queries")

  // 최근 질문 페이지네이션
  const [recentQueriesPage, setRecentQueriesPage] = useState(1)
  const recentQueriesPerPage = 5

  // 히트맵 색상 계산 (CSS 변수 기반)
  const getHeatmapColor = (intensity: number): string => {
    if (intensity === 0) return 'transparent'
    // chart-2 (초록) 기반으로 intensity에 따라 opacity 조절
    const opacity = Math.round(20 + intensity * 80) // 20% ~ 100%
    return `color-mix(in oklch, var(--chart-2) ${opacity}%, transparent)`
  }

  // 히트맵 셀 컴포넌트 (개선된 버전 - 크기 증가)
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
              "w-5 h-5 rounded cursor-pointer transition-all duration-150",
              "hover:scale-110 hover:ring-2 hover:ring-primary hover:ring-offset-1 hover:z-10",
              "animate-in fade-in zoom-in-50",
              intensity === 0 && "bg-muted border border-border/50"
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

  return (
    <PageContainer maxWidth="wide" className="space-y-4">
      {/* Service Health Banner */}
      <ServiceHealthBanner showDetails />

      {/* Page Header */}
      <div className="flex items-center">
        <h1 className="text-lg font-semibold flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-muted-foreground" />
          통계
        </h1>
      </div>

      {/* 필터 컨트롤 - 통일된 스타일 */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="sticky top-16 z-30 mb-4"
      >
        <div className="p-2 sm:p-3 rounded-xl bg-background/60 backdrop-blur-xl border border-border/50 shadow-lg supports-[backdrop-filter]:bg-background/40 space-y-2 sm:space-y-0">
          {/* 1줄: 컬렉션 + 버튼들 + 활성세션 */}
          <div className="flex items-center justify-between gap-2">
            {/* 컬렉션 선택 (모달 방식) */}
            <CollectionSelector
              value={selectedCollection}
              onValueChange={setSelectedCollection}
              collections={collections.map(c => ({
                name: c.name,
                description: c.description,
                visibility: c.visibility || "public",
                documents_count: c.documents_count || 0,
                points_count: c.points_count || 0,
                vector_size: c.vector_size || 1024,
                distance: c.distance || "Cosine",
              }))}
              loading={loading}
              onRefresh={fetchCollections}
              variant="modal"
              triggerStyle="select"
              columns={4}
              showAllOption={true}
              showCasualOption={true}
              showManageLink={false}
              searchable={true}
              modalTitle="컬렉션 선택"
            />

            {/* 데스크탑: 날짜 범위 (모바일에서 숨김) */}
            <div className="hidden sm:flex gap-1.5 items-center">
              <Input
                type="date"
                value={dateRange.from instanceof Date && !isNaN(dateRange.from.getTime()) ? format(dateRange.from, "yyyy-MM-dd") : ""}
                onChange={(e) => {
                  const date = new Date(e.target.value)
                  if (!isNaN(date.getTime())) {
                    setDateRange(prev => ({ ...prev, from: date }))
                  }
                }}
                className="w-[130px] h-9 rounded-lg border-border/50 bg-background/50 focus:bg-background text-sm"
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
                className="w-[130px] h-9 rounded-lg border-border/50 bg-background/50 focus:bg-background text-sm"
              />
            </div>

            {/* 버튼 + 활성세션 */}
            <div className="flex items-center gap-1">
              <Button onClick={refreshAllData} disabled={loading} size="sm" variant="ghost" className="h-8 w-8 sm:h-9 sm:w-auto rounded-lg hover:bg-background/80" title="새로고침">
                <RefreshCw className={cn("h-4 w-4 sm:mr-1.5", loading && "animate-spin text-[color:var(--chart-1)]")} />
                <span className="hidden sm:inline">새로고침</span>
              </Button>

              <Button onClick={handleExcelDownload} disabled={downloading || loading} size="sm" variant="ghost" className="h-8 w-8 sm:h-9 sm:w-auto rounded-lg hover:bg-background/80" title="대화 다운로드">
                <Download className={cn("h-4 w-4 sm:mr-1.5", downloading && "animate-bounce text-[color:var(--chart-1)]")} />
                <span className="hidden sm:inline">다운로드</span>
              </Button>

              <Button onClick={handleErrorLogDownload} disabled={downloadingErrors || loading} size="sm" variant="ghost" className="h-8 w-8 sm:h-9 sm:w-auto rounded-lg hover:bg-background/80 text-destructive hover:text-destructive" title="오류 로그 다운로드">
                <AlertTriangle className={cn("h-4 w-4 sm:mr-1.5", downloadingErrors && "animate-bounce")} />
                <span className="hidden sm:inline">오류</span>
              </Button>

              {/* 실시간 활성 세션 */}
              {activeSessions && (
                <div className="flex items-center gap-1 sm:gap-2 px-2 py-1 sm:py-1.5 rounded-lg bg-background/80 border border-border/50">
                  <div
                    className="h-2 w-2 rounded-full animate-pulse"
                    style={{ backgroundColor: metricColors.active }}
                  />
                  <span className="text-xs sm:text-sm font-medium">{activeSessions.active_count}</span>
                  <span className="hidden sm:inline text-sm text-muted-foreground">활성</span>
                </div>
              )}
            </div>
          </div>

          {/* 2줄: 날짜 범위 (모바일에서만 표시) */}
          <div className="flex sm:hidden gap-1.5 items-center justify-center">
            <Input
              type="date"
              value={dateRange.from instanceof Date && !isNaN(dateRange.from.getTime()) ? format(dateRange.from, "yyyy-MM-dd") : ""}
              onChange={(e) => {
                const date = new Date(e.target.value)
                if (!isNaN(date.getTime())) {
                  setDateRange(prev => ({ ...prev, from: date }))
                }
              }}
              className="flex-1 max-w-[140px] h-8 rounded-lg border-border/50 bg-background/50 focus:bg-background text-xs"
            />
            <span className="text-xs text-muted-foreground">~</span>
            <Input
              type="date"
              value={dateRange.to instanceof Date && !isNaN(dateRange.to.getTime()) ? format(dateRange.to, "yyyy-MM-dd") : ""}
              onChange={(e) => {
                const date = new Date(e.target.value)
                if (!isNaN(date.getTime())) {
                  setDateRange(prev => ({ ...prev, to: date }))
                }
              }}
              className="flex-1 max-w-[140px] h-8 rounded-lg border-border/50 bg-background/50 focus:bg-background text-xs"
            />
          </div>
        </div>
      </motion.div>

      {/* KPI 카드 - 모바일 6열 컴팩트, 데스크탑 가로 배치 */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="grid grid-cols-6 gap-1 lg:gap-3"
      >
        {/* 쿼리 */}
        <div className="group flex flex-col items-center p-1.5 text-center rounded-lg border border-border/50 bg-background/60 backdrop-blur-sm lg:flex-row lg:items-center lg:gap-3 lg:px-4 lg:py-3 lg:text-left hover:border-[color:var(--chart-1)]/30 hover:shadow-lg hover:shadow-[color:var(--chart-1)]/5 transition-all duration-300">
          <div className="w-2 h-2 rounded-full mb-0.5 lg:hidden" style={{ backgroundColor: metricColors.queries }} />
          <div className="hidden lg:flex p-2 rounded-lg bg-[color:var(--chart-1)]/10 group-hover:bg-[color:var(--chart-1)]/20 transition-colors">
            <MessageSquare className="h-4 w-4" style={{ color: metricColors.queries }} />
          </div>
          <div>
            <span className="text-sm lg:text-lg font-bold tabular-nums block">{(summary?.total_queries ?? 0).toLocaleString()}</span>
            <span className="text-[10px] lg:text-xs text-muted-foreground">쿼리</span>
          </div>
        </div>

        {/* 세션 */}
        <div className="group flex flex-col items-center p-1.5 text-center rounded-lg border border-border/50 bg-background/60 backdrop-blur-sm lg:flex-row lg:items-center lg:gap-3 lg:px-4 lg:py-3 lg:text-left hover:border-[color:var(--chart-5)]/30 hover:shadow-lg hover:shadow-[color:var(--chart-5)]/5 transition-all duration-300">
          <div className="w-2 h-2 rounded-full mb-0.5 lg:hidden" style={{ backgroundColor: metricColors.sessions }} />
          <div className="hidden lg:flex p-2 rounded-lg bg-[color:var(--chart-5)]/10 group-hover:bg-[color:var(--chart-5)]/20 transition-colors">
            <Users className="h-4 w-4" style={{ color: metricColors.sessions }} />
          </div>
          <div>
            <span className="text-sm lg:text-lg font-bold tabular-nums block">{(summary?.unique_sessions ?? 0).toLocaleString()}</span>
            <span className="text-[10px] lg:text-xs text-muted-foreground">세션</span>
          </div>
        </div>

        {/* 평균 턴 */}
        <div className="group flex flex-col items-center p-1.5 text-center rounded-lg border border-border/50 bg-background/60 backdrop-blur-sm lg:flex-row lg:items-center lg:gap-3 lg:px-4 lg:py-3 lg:text-left hover:border-[color:var(--chart-2)]/30 hover:shadow-lg hover:shadow-[color:var(--chart-2)]/5 transition-all duration-300">
          <div className="w-2 h-2 rounded-full mb-0.5 lg:hidden" style={{ backgroundColor: metricColors.turns }} />
          <div className="hidden lg:flex p-2 rounded-lg bg-[color:var(--chart-2)]/10 group-hover:bg-[color:var(--chart-2)]/20 transition-colors">
            <TrendingUp className="h-4 w-4" style={{ color: metricColors.turns }} />
          </div>
          <div>
            <span className="text-sm lg:text-lg font-bold tabular-nums block">{conversationStats?.avg_turns?.toFixed(1) || "0"}</span>
            <span className="text-[10px] lg:text-xs text-muted-foreground">평균 턴</span>
          </div>
        </div>

        {/* 응답시간 */}
        <div className="group flex flex-col items-center p-1.5 text-center rounded-lg border border-border/50 bg-background/60 backdrop-blur-sm lg:flex-row lg:items-center lg:gap-3 lg:px-4 lg:py-3 lg:text-left hover:border-[color:var(--chart-3)]/30 hover:shadow-lg hover:shadow-[color:var(--chart-3)]/5 transition-all duration-300">
          <div className="w-2 h-2 rounded-full mb-0.5 lg:hidden" style={{ backgroundColor: metricColors.responseTime }} />
          <div className="hidden lg:flex p-2 rounded-lg bg-[color:var(--chart-3)]/10 group-hover:bg-[color:var(--chart-3)]/20 transition-colors">
            <Clock className="h-4 w-4" style={{ color: metricColors.responseTime }} />
          </div>
          <div>
            <span className="text-sm lg:text-lg font-bold tabular-nums block">{(summary?.avg_response_time_ms ?? 0).toFixed(0)}<span className="text-[10px] lg:text-xs font-normal text-muted-foreground ml-0.5">ms</span></span>
            <span className="text-[10px] lg:text-xs text-muted-foreground">응답</span>
          </div>
        </div>

        {/* 토큰 */}
        <div className="group flex flex-col items-center p-1.5 text-center rounded-lg border border-border/50 bg-background/60 backdrop-blur-sm lg:flex-row lg:items-center lg:gap-3 lg:px-4 lg:py-3 lg:text-left hover:border-[color:var(--chart-3)]/30 hover:shadow-lg hover:shadow-[color:var(--chart-3)]/5 transition-all duration-300">
          <div className="w-2 h-2 rounded-full mb-0.5 lg:hidden" style={{ backgroundColor: metricColors.tokens }} />
          <div className="hidden lg:flex p-2 rounded-lg bg-[color:var(--chart-3)]/10 group-hover:bg-[color:var(--chart-3)]/20 transition-colors">
            <Zap className="h-4 w-4" style={{ color: metricColors.tokens }} />
          </div>
          <div>
            <span className="text-sm lg:text-lg font-bold tabular-nums block">{((summary?.total_tokens ?? 0) / 1000).toFixed(1)}K</span>
            <span className="text-[10px] lg:text-xs text-muted-foreground">토큰</span>
          </div>
        </div>

        {/* 피드백 만족도 */}
        <div className="group flex flex-col items-center p-1.5 text-center rounded-lg border border-border/50 bg-background/60 backdrop-blur-sm lg:flex-row lg:items-center lg:gap-3 lg:px-4 lg:py-3 lg:text-left hover:border-[color:var(--chart-2)]/30 hover:shadow-lg hover:shadow-[color:var(--chart-2)]/5 transition-all duration-300">
          <div className="w-2 h-2 rounded-full mb-0.5 lg:hidden" style={{ backgroundColor: metricColors.positive }} />
          <div className="hidden lg:flex p-2 rounded-lg bg-[color:var(--chart-2)]/10 group-hover:bg-[color:var(--chart-2)]/20 transition-colors">
            <ThumbsUp className="h-4 w-4" style={{ color: metricColors.positive }} />
          </div>
          <div>
            <span className="text-sm lg:text-lg font-bold tabular-nums block">
              {feedbackSummary?.total_count ? `${feedbackSummary.positive_rate.toFixed(0)}%` : "-"}
            </span>
            <span className="text-[10px] lg:text-xs text-muted-foreground">만족도</span>
          </div>
        </div>
      </motion.div>

      {/* 대시보드 */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        className="space-y-4"
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* 일별 추이 - 인터랙티브 차트 */}
            <Card className="col-span-1 lg:col-span-2 border-border/50 bg-background/60 backdrop-blur-sm hover:border-[color:var(--chart-1)]/30 hover:shadow-xl hover:shadow-[color:var(--chart-1)]/5 transition-all duration-300">
              <CardHeader className="px-6 py-4">
                <div className="flex items-center justify-between mb-4">
                  <CardTitle className="text-base font-semibold">일별 사용 추이</CardTitle>
                  <div className="flex items-center gap-3">
                    <Select value={activeTimelineMetric} onValueChange={(val) => setActiveTimelineMetric(val as typeof activeTimelineMetric)}>
                      <SelectTrigger className="w-[140px] h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="queries">
                          <div className="flex items-center gap-2">
                            <MessageSquare className="h-3.5 w-3.5" style={{ color: metricColors.queries }} />
                            <span>쿼리</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="sessions">
                          <div className="flex items-center gap-2">
                            <Users className="h-3.5 w-3.5" style={{ color: metricColors.sessions }} />
                            <span>세션</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="avg_response_time">
                          <div className="flex items-center gap-2">
                            <Clock className="h-3.5 w-3.5" style={{ color: metricColors.responseTime }} />
                            <span>응답시간</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <div className="w-4 h-0.5 rounded" style={{ backgroundColor: "var(--chart-5)" }} />
                      <span>7일 이동평균</span>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-6 pb-6">
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
            <Card className="border-border/50 bg-background/60 backdrop-blur-sm hover:border-[color:var(--chart-2)]/30 hover:shadow-xl hover:shadow-[color:var(--chart-2)]/5 transition-all duration-300">
              <CardHeader className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold">최근 질문</CardTitle>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => setChatHistoryOpen(true)}
                    >
                      채팅이력
                    </Button>
                    <Badge variant="outline" className="gap-1.5 px-2 py-1 font-normal text-xs">
                      <div
                        className="h-1.5 w-1.5 rounded-full animate-pulse"
                        style={{ backgroundColor: metricColors.active }}
                      />
                      30초 갱신
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-6 pb-6">
                <div className="space-y-3">
                  <div className="space-y-2">
                    {recentQueries.length > 0 ? (
                      <>
                        {recentQueries
                          .slice((recentQueriesPage - 1) * recentQueriesPerPage, recentQueriesPage * recentQueriesPerPage)
                          .map((q, idx) => (
                            <div key={idx} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors border border-transparent hover:border-border">
                              <MessageSquare className="h-4 w-4 text-muted-foreground shrink-0" />
                              <span className="text-sm flex-1 truncate">{q.query}</span>
                              <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
                                {q.timestamp ? format(new Date(q.timestamp), "HH:mm") : "-"}
                              </span>
                            </div>
                          ))}
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        질문 데이터 없음
                      </p>
                    )}
                  </div>
                  {recentQueries.length > recentQueriesPerPage && (
                    <div className="flex items-center justify-center gap-2 pt-2 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setRecentQueriesPage(prev => Math.max(1, prev - 1))}
                        disabled={recentQueriesPage === 1}
                      >
                        이전
                      </Button>
                      <span className="text-xs text-muted-foreground px-2">
                        {recentQueriesPage} / {Math.ceil(recentQueries.length / recentQueriesPerPage)}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setRecentQueriesPage(prev => Math.min(Math.ceil(recentQueries.length / recentQueriesPerPage), prev + 1))}
                        disabled={recentQueriesPage >= Math.ceil(recentQueries.length / recentQueriesPerPage)}
                      >
                        다음
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* 시간대별 히트맵 */}
            <Card className="col-span-1 lg:col-span-2 border-border/50 bg-background/60 backdrop-blur-sm hover:border-[color:var(--chart-2)]/30 hover:shadow-xl hover:shadow-[color:var(--chart-2)]/5 transition-all duration-300">
              <CardHeader className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold">시간대별 히트맵</CardTitle>
                  {heatmap && heatmap.max_value > 0 && (
                    <Badge variant="secondary" className="gap-2 px-3 py-1.5 font-normal">
                      <Zap className="h-4 w-4" style={{ color: metricColors.responseTime }} />
                      <span className="text-sm">피크: {heatmap.labels?.days?.[(() => {
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
                </div>
              </CardHeader>
              <CardContent className="px-6 pb-6">
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
                            <div className="space-y-1">
                              {/* 시간 레이블 - 3시간 단위로 표시 */}
                              <div className="flex gap-1 ml-14">
                                {Array.from({ length: 24 }, (_, h) => (
                                  <div
                                    key={h}
                                    className={cn(
                                      "w-5 text-center text-[10px]",
                                      h % 3 === 0 ? "text-foreground font-medium" : "text-muted-foreground/50"
                                    )}
                                  >
                                    {h % 3 === 0 ? h : ""}
                                  </div>
                                ))}
                              </div>

                              {/* 히트맵 행 - 간격 증가 */}
                              {heatmap.labels.days.map((day, dayIdx) => (
                                <div key={day} className="flex items-center gap-2">
                                  <span className="w-12 text-xs text-muted-foreground text-right shrink-0">{day}</span>
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
                                  {/* 요일별 합계 - 바 높이 증가 */}
                                  <div className="flex items-center gap-1.5 ml-2 shrink-0">
                                    <div className="w-12 h-3 bg-muted rounded-full overflow-hidden">
                                      <div
                                        className="h-full rounded-full transition-all"
                                        style={{
                                          width: maxDaySum > 0 ? `${(daySums[dayIdx] / maxDaySum) * 100}%` : '0%',
                                          backgroundColor: 'var(--chart-2)'
                                        }}
                                      />
                                    </div>
                                    <span className="text-xs text-muted-foreground w-14 text-right font-mono">
                                      {daySums[dayIdx].toLocaleString()}
                                    </span>
                                  </div>
                                </div>
                              ))}

                              {/* 시간대별 합계 바 차트 - 높이 및 간격 증가 */}
                              <div className="flex items-end gap-1 ml-14 mt-4 pt-4 border-t h-20">
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

                              {/* 시간대 구분 */}
                              <div className="flex ml-12 mt-1">
                                <div className="flex-1 text-center text-[10px] text-muted-foreground">새벽 (0-6)</div>
                                <div className="flex-1 text-center text-[10px] text-muted-foreground">오전 (6-12)</div>
                                <div className="flex-1 text-center text-[10px] text-muted-foreground">오후 (12-18)</div>
                                <div className="flex-1 text-center text-[10px] text-muted-foreground">저녁 (18-24)</div>
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
                              <div className="w-4 h-4 bg-muted rounded" />
                              {[20, 40, 60, 80, 100].map((opacity) => (
                                <div
                                  key={opacity}
                                  className="w-4 h-4 rounded"
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
            <Card className="border-border/50 bg-background/60 backdrop-blur-sm hover:border-[color:var(--chart-5)]/30 hover:shadow-xl hover:shadow-[color:var(--chart-5)]/5 transition-all duration-300">
              <CardHeader className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold">인기 검색어</CardTitle>
                  <Badge variant="secondary" className="gap-1 px-2.5 py-1 font-normal text-xs">
                    TOP 5
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="px-6 pb-6">
                <div className="space-y-2">
                  {summary?.top_queries?.slice(0, 5).map((query, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-2 rounded-xl hover:bg-muted/50 transition-colors border border-transparent hover:border-border/50">
                      <Badge variant="outline" className="text-xs w-6 h-6 p-0 flex items-center justify-center shrink-0 font-medium">{idx + 1}</Badge>
                      <span className="text-sm truncate flex-1">{query}</span>
                    </div>
                  )) || <p className="text-sm text-muted-foreground text-center py-8">데이터 없음</p>}
                </div>
              </CardContent>
            </Card>

            {/* 피드백 요약 */}
            <Card className="col-span-1 lg:col-span-2 border-border/50 bg-background/60 backdrop-blur-sm hover:border-[color:var(--chart-2)]/30 hover:shadow-xl hover:shadow-[color:var(--chart-2)]/5 transition-all duration-300">
              <CardHeader className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold">피드백 현황</CardTitle>
                  {feedbackSummary && feedbackSummary.total_count > 0 && (
                    <Badge variant="secondary" className="gap-1.5 px-2.5 py-1 font-normal text-xs">
                      총 {feedbackSummary.total_count.toLocaleString()}건
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="px-6 pb-6">
                {feedbackSummary && feedbackSummary.total_count > 0 ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* 긍정/부정 비율 */}
                    <div className="space-y-4">
                      <h4 className="text-sm font-medium text-muted-foreground">만족도 비율</h4>
                      <div className="flex items-center gap-4">
                        <div className="relative w-24 h-24">
                          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                            <circle
                              cx="18" cy="18" r="15.915"
                              fill="none"
                              className="stroke-muted"
                              strokeWidth="3"
                            />
                            <circle
                              cx="18" cy="18" r="15.915"
                              fill="none"
                              stroke="var(--chart-2)"
                              strokeWidth="3"
                              strokeDasharray={`${feedbackSummary.positive_rate} ${100 - feedbackSummary.positive_rate}`}
                              strokeLinecap="round"
                            />
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-lg font-bold">{feedbackSummary.positive_rate.toFixed(0)}%</span>
                          </div>
                        </div>
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <ThumbsUp className="h-4 w-4" style={{ color: metricColors.positive }} />
                              <span className="text-sm">긍정</span>
                            </div>
                            <span className="text-sm font-medium">{feedbackSummary.positive_count.toLocaleString()}건</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <ThumbsDown className="h-4 w-4" style={{ color: metricColors.negative }} />
                              <span className="text-sm">부정</span>
                            </div>
                            <span className="text-sm font-medium">{feedbackSummary.negative_count.toLocaleString()}건</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 부정 피드백 카테고리 분포 */}
                    <div className="space-y-4">
                      <h4 className="text-sm font-medium text-muted-foreground">부정 피드백 유형</h4>
                      {Object.keys(feedbackSummary.category_distribution || {}).length > 0 ? (
                        <div className="space-y-2">
                          {Object.entries(feedbackSummary.category_distribution)
                            .sort(([, a], [, b]) => b - a)
                            .map(([category, count]) => {
                              const total = Object.values(feedbackSummary.category_distribution).reduce((sum, c) => sum + c, 0)
                              const percentage = total > 0 ? (count / total) * 100 : 0
                              return (
                                <div key={category} className="space-y-1">
                                  <div className="flex items-center justify-between text-sm">
                                    <span>{feedbackCategoryLabels[category] || category}</span>
                                    <span className="text-muted-foreground">{count}건 ({percentage.toFixed(0)}%)</span>
                                  </div>
                                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                                    <div
                                      className="h-full rounded-full transition-all"
                                      style={{
                                        width: `${percentage}%`,
                                        backgroundColor: metricColors.negative
                                      }}
                                    />
                                  </div>
                                </div>
                              )
                            })}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">부정 피드백 없음</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">피드백 데이터 없음</p>
                )}
              </CardContent>
            </Card>

            {/* 최근 부정 피드백 */}
            <Card className="border-border/50 bg-background/60 backdrop-blur-sm hover:border-[color:var(--chart-4)]/30 hover:shadow-xl hover:shadow-[color:var(--chart-4)]/5 transition-all duration-300">
              <CardHeader className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold">최근 부정 피드백</CardTitle>
                  <Badge variant="outline" className="gap-1.5 px-2 py-1 font-normal text-xs text-destructive border-destructive/30">
                    <ThumbsDown className="h-3 w-3" />
                    개선필요
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="px-6 pb-6">
                <div className="space-y-2">
                  {recentNegativeFeedbacks.length > 0 ? (
                    recentNegativeFeedbacks.slice(0, 5).map((feedback) => (
                      <div key={feedback.feedback_id} className="p-3 rounded-lg border border-border/50 hover:border-border hover:bg-muted/30 transition-colors space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm line-clamp-2 flex-1">{feedback.user_query}</p>
                          <Badge variant="secondary" className="shrink-0 text-xs">
                            {feedbackCategoryLabels[feedback.category || "other"] || feedback.category}
                          </Badge>
                        </div>
                        {feedback.comment && (
                          <p className="text-xs text-muted-foreground line-clamp-2 pl-2 border-l-2 border-muted">
                            {feedback.comment}
                          </p>
                        )}
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{getCollectionDisplayName({ name: feedback.collection_name })}</span>
                          <span>{format(new Date(feedback.created_at), "M/d HH:mm")}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">부정 피드백 없음</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
      </motion.div>

      {/* 채팅 이력 모달 */}
      <ChatHistoryModal
        open={chatHistoryOpen}
        onOpenChange={setChatHistoryOpen}
        collectionName={selectedCollection}
        dateFrom={dateRange.from}
        dateTo={dateRange.to}
      />
    </PageContainer>
  )
}
