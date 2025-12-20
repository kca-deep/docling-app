"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  BarChart3,
  MessageSquareWarning,
  RefreshCcw,
  TrendingUp,
  ArrowRight,
  CheckCircle2,
  Sparkles,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface WorkflowStep {
  icon: React.ReactNode
  title: string
  description: string
  details: string[]
  color: string
  bgColor: string
}

const WORKFLOW_STEPS: WorkflowStep[] = [
  {
    icon: <BarChart3 className="w-5 h-5" />,
    title: "응답 분석",
    description: "품질 평가",
    details: [
      "답변 정확도 측정",
      "출처 검증",
    ],
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
  },
  {
    icon: <MessageSquareWarning className="w-5 h-5" />,
    title: "피드백 수집",
    description: "사용자 평가",
    details: [
      "만족도 평가",
      "오류 신고",
    ],
    color: "text-purple-600 dark:text-purple-400",
    bgColor: "bg-purple-100 dark:bg-purple-900/30",
  },
  {
    icon: <RefreshCcw className="w-5 h-5" />,
    title: "데이터 보강",
    description: "지식 갱신",
    details: [
      "문서 추가/수정",
      "FAQ 업데이트",
    ],
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-100 dark:bg-amber-900/30",
  },
  {
    icon: <TrendingUp className="w-5 h-5" />,
    title: "성능 개선",
    description: "파라미터 튜닝",
    details: [
      "검색 정확도 향상",
      "응답 품질 개선",
    ],
    color: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-100 dark:bg-green-900/30",
  },
]

export function RagImprovementWorkflow() {
  return (
    <Card className="border-2 border-dashed border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-transparent">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-500" />
          반복적 RAG 개선 워크플로우
          <Badge variant="secondary" className="ml-2 text-xs">
            지속적 품질 향상
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Desktop: Horizontal Layout */}
        <div className="hidden lg:block">
          <div className="flex items-start justify-between gap-2">
            {WORKFLOW_STEPS.map((step, index) => (
              <div key={step.title} className="flex items-start flex-1">
                <div className="flex-1 text-center">
                  <div
                    className={cn(
                      "w-12 h-12 mx-auto rounded-xl flex items-center justify-center mb-2",
                      step.bgColor
                    )}
                  >
                    <span className={step.color}>{step.icon}</span>
                  </div>
                  <h4 className="font-semibold text-sm mb-0.5">{step.title}</h4>
                  <p className="text-xs text-muted-foreground mb-2">
                    {step.description}
                  </p>
                  <ul className="text-xs text-muted-foreground space-y-0.5">
                    {step.details.map((detail, i) => (
                      <li key={i} className="flex items-center justify-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0" />
                        <span>{detail}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                {index < WORKFLOW_STEPS.length - 1 && (
                  <div className="flex items-center justify-center px-1 pt-5">
                    <ArrowRight className="w-4 h-4 text-muted-foreground/50" />
                  </div>
                )}
              </div>
            ))}
          </div>
          {/* Circular Arrow */}
          <div className="flex justify-center mt-4">
            <div className="flex items-center gap-2 text-muted-foreground/50">
              <RefreshCcw className="w-4 h-4" />
              <span className="text-xs">반복 개선 사이클</span>
            </div>
          </div>
        </div>

        {/* Mobile: Compact Grid */}
        <div className="lg:hidden">
          <div className="grid grid-cols-4 gap-1">
            {WORKFLOW_STEPS.map((step) => (
              <div key={step.title} className="flex flex-col items-center text-center">
                <div
                  className={cn(
                    "w-9 h-9 rounded-lg flex items-center justify-center mb-1",
                    step.bgColor
                  )}
                >
                  <span className={cn(step.color, "[&>svg]:w-4 [&>svg]:h-4")}>
                    {step.icon}
                  </span>
                </div>
                <span className="text-[10px] font-medium leading-tight">
                  {step.title.split(' ')[0]}
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3 text-center">
            분석 → 피드백 → 보강 → 개선 (반복)
          </p>
        </div>

        {/* Info Badge */}
        <div className="mt-4 flex items-center justify-center gap-2 flex-wrap">
          <Badge variant="outline" className="text-xs gap-1">
            <RefreshCcw className="w-3 h-3" />
            지속적 개선
          </Badge>
          <Badge variant="outline" className="text-xs gap-1">
            <TrendingUp className="w-3 h-3" />
            품질 향상
          </Badge>
        </div>
      </CardContent>
    </Card>
  )
}
