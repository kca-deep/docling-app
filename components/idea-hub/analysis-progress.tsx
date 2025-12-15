"use client"

import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import {
  CheckCircle2,
  Circle,
  Loader2,
  Brain,
  ChevronRight,
  ArrowRight,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useEffect, useState } from "react"
import type { ChecklistItem } from "./checklist-form"

export interface AnalysisResultItem extends ChecklistItem {
  llmAnswer: "yes" | "no" | "need_check" | null
  llmConfidence: number
  llmEvidence: string
  llmRiskLevel: "high" | "medium" | "low"
}

export interface AnalysisResult {
  submissionId: string
  requiresReview: boolean
  reviewReason: string
  items: AnalysisResultItem[]
  summary: string
  nextSteps: string[]
  usedModel: string
  analysisTimeMs: number
}

interface AnalysisProgressProps {
  isAnalyzing: boolean
  result: AnalysisResult | null
  checklistItems: ChecklistItem[]
}

const ANALYSIS_STEPS = [
  { id: 1, label: "내용분석", shortLabel: "내용" },
  { id: 2, label: "항목검증", shortLabel: "항목" },
  { id: 3, label: "위험평가", shortLabel: "위험" },
  { id: 4, label: "결과생성", shortLabel: "결과" },
]

export function AnalysisProgress({
  isAnalyzing,
  result,
  checklistItems,
}: AnalysisProgressProps) {
  const [currentAnalysisStep, setCurrentAnalysisStep] = useState(0)
  const [progress, setProgress] = useState(0)
  const [analyzedItems, setAnalyzedItems] = useState<number[]>([])

  // Simulate analysis progress
  useEffect(() => {
    if (!isAnalyzing) {
      setCurrentAnalysisStep(ANALYSIS_STEPS.length)
      setProgress(100)
      return
    }

    setCurrentAnalysisStep(0)
    setProgress(0)
    setAnalyzedItems([])

    const stepInterval = setInterval(() => {
      setCurrentAnalysisStep((prev) => {
        if (prev < ANALYSIS_STEPS.length) {
          return prev + 1
        }
        return prev
      })
    }, 700)

    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev < 95) {
          return prev + Math.random() * 10
        }
        return prev
      })
    }, 200)

    // Simulate item-by-item analysis
    checklistItems.forEach((_, index) => {
      setTimeout(() => {
        setAnalyzedItems((prev) => [...prev, index + 1])
      }, 300 * (index + 1))
    })

    return () => {
      clearInterval(stepInterval)
      clearInterval(progressInterval)
    }
  }, [isAnalyzing, checklistItems])

  // 완료 시에는 렌더링하지 않음 (ResultComparison이 대신 표시됨)
  if (!isAnalyzing) {
    return null
  }

  // 진행 중 화면 - 인라인 컴팩트
  return (
    <div className="space-y-4">
      {/* 헤더 + 프로그레스 바 */}
      <div className="flex items-center gap-4 p-4 rounded-lg bg-primary/5 border border-primary/20">
        <div className="relative shrink-0">
          <Brain className="w-8 h-8 text-primary animate-pulse" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-primary">AI 검증 중...</span>
            <span className="text-sm font-medium">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      </div>

      {/* 분석 단계 - 브레드크럼 스타일 */}
      <div className="flex items-center gap-1 px-4 py-3 rounded-lg bg-muted/50 border overflow-x-auto">
        {ANALYSIS_STEPS.map((step, index) => {
          const isCompleted = index < currentAnalysisStep
          const isCurrent = index === currentAnalysisStep - 1

          return (
            <div key={step.id} className="flex items-center shrink-0">
              <div
                className={cn(
                  "flex items-center gap-1.5 text-sm transition-colors",
                  isCompleted && "text-green-600 dark:text-green-400",
                  isCurrent && "text-primary font-medium",
                  !isCompleted && !isCurrent && "text-muted-foreground"
                )}
              >
                {isCompleted ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : isCurrent ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Circle className="w-4 h-4 opacity-30" />
                )}
                <span className="hidden sm:inline">{step.label}</span>
                <span className="sm:hidden">{step.shortLabel}</span>
              </div>
              {index < ANALYSIS_STEPS.length - 1 && (
                <ChevronRight className="w-4 h-4 text-muted-foreground/30 mx-1" />
              )}
            </div>
          )
        })}
      </div>

      {/* 항목별 검증 - 인라인 도트 */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-muted/50 border">
        <span className="text-sm text-muted-foreground shrink-0">항목:</span>
        <div className="flex items-center gap-1.5 flex-wrap">
          {checklistItems.map((item, index) => {
            const isAnalyzed = analyzedItems.includes(index + 1)
            return (
              <div
                key={item.number}
                className={cn(
                  "w-6 h-6 rounded text-xs font-medium flex items-center justify-center transition-all duration-300",
                  isAnalyzed
                    ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {isAnalyzed ? <CheckCircle2 className="w-3.5 h-3.5" /> : item.number}
              </div>
            )
          })}
        </div>
        <span className="text-sm text-muted-foreground ml-auto shrink-0">
          {analyzedItems.length}/{checklistItems.length}
        </span>
      </div>
    </div>
  )
}
