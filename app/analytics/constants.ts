import { type ChartConfig } from "@/components/ui/chart"
import type { TimelineData } from "./types"

export const timelineChartConfig = {
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

export function calculateMovingAverage(data: TimelineData[], metric: keyof TimelineData, window: number = 7): (number | null)[] {
  return data.map((_, idx) => {
    if (idx < window - 1) return null
    const slice = data.slice(idx - window + 1, idx + 1)
    const sum = slice.reduce((acc, item) => acc + (Number(item[metric]) || 0), 0)
    return Math.round(sum / window)
  })
}

export const metricColors = {
  queries: "var(--chart-1)",
  sessions: "var(--chart-5)",
  turns: "var(--chart-2)",
  responseTime: "var(--chart-3)",
  tokens: "var(--chart-3)",
  active: "var(--chart-2)",
  positive: "var(--chart-2)",
  negative: "var(--chart-4)",
}

export const feedbackCategoryLabels: Record<string, string> = {
  inaccurate: "부정확",
  incomplete: "불완전",
  irrelevant: "관련없음",
  outdated: "구버전",
  other: "기타",
}
