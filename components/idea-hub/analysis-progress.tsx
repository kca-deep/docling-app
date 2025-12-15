"use client"

import { Progress } from "@/components/ui/progress"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  CheckCircle2,
  Circle,
  Loader2,
  Shield,
  Brain,
  Sparkles,
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
  { id: 1, label: "과제 내용 분석 중" },
  { id: 2, label: "체크리스트 항목 검증 중" },
  { id: 3, label: "위험도 평가 중" },
  { id: 4, label: "결과 생성 중" },
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

  if (result && !isAnalyzing) {
    return (
      <div className="space-y-6">
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
          <h2 className="text-2xl font-bold mb-2">AI 분석 완료</h2>
          <p className="text-muted-foreground">
            분석이 완료되었습니다. &quot;다음&quot; 버튼을 클릭하여 결과를 확인하세요.
          </p>
        </div>

        <Card className="bg-muted/50">
          <CardContent className="pt-6">
            <div className="grid gap-4 sm:grid-cols-3 text-center">
              <div>
                <p className="text-sm text-muted-foreground">분석 모델</p>
                <p className="font-semibold">{result.usedModel}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">소요 시간</p>
                <p className="font-semibold">{(result.analysisTimeMs / 1000).toFixed(1)}초</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">검토 대상</p>
                <Badge variant={result.requiresReview ? "destructive" : "secondary"}>
                  {result.requiresReview ? "예" : "아니오"}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="text-center">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-primary/10 flex items-center justify-center relative">
          <Brain className="w-10 h-10 text-primary animate-pulse" />
          <div className="absolute -top-1 -right-1">
            <Sparkles className="w-6 h-6 text-amber-500 animate-bounce" />
          </div>
        </div>
        <h2 className="text-2xl font-bold mb-2">AI 검증 진행 중</h2>
        <p className="text-muted-foreground">
          과제 내용을 분석하여 체크리스트 선택 결과를 검증하고 있습니다
        </p>
      </div>

      {/* Main Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">전체 진행률</span>
          <span className="font-medium">{Math.round(progress)}%</span>
        </div>
        <Progress value={progress} className="h-3" />
      </div>

      {/* Analysis Steps */}
      <div className="space-y-3">
        {ANALYSIS_STEPS.map((step, index) => {
          const isCompleted = index < currentAnalysisStep
          const isCurrent = index === currentAnalysisStep - 1

          return (
            <div
              key={step.id}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg transition-all",
                isCompleted && "bg-green-50 dark:bg-green-950/20",
                isCurrent && "bg-primary/10"
              )}
            >
              <div className="shrink-0">
                {isCompleted ? (
                  <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                ) : isCurrent ? (
                  <Loader2 className="w-5 h-5 text-primary animate-spin" />
                ) : (
                  <Circle className="w-5 h-5 text-muted-foreground/30" />
                )}
              </div>
              <span
                className={cn(
                  "text-sm font-medium",
                  isCompleted && "text-green-700 dark:text-green-300",
                  isCurrent && "text-primary",
                  !isCompleted && !isCurrent && "text-muted-foreground"
                )}
              >
                {step.label}
              </span>
            </div>
          )
        })}
      </div>

      {/* Item-by-item Analysis */}
      <Card>
        <CardContent className="pt-6">
          <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
            <Shield className="w-4 h-4" />
            체크리스트 항목별 검증
          </h3>
          <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
            {checklistItems.map((item, index) => {
              const isAnalyzed = analyzedItems.includes(index + 1)
              return (
                <div
                  key={item.number}
                  className={cn(
                    "aspect-square rounded-lg flex items-center justify-center text-sm font-medium transition-all duration-300",
                    isAnalyzed
                      ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {isAnalyzed ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    item.number
                  )}
                </div>
              )
            })}
          </div>
          <p className="text-xs text-muted-foreground mt-3 text-center">
            {analyzedItems.length}/{checklistItems.length}개 항목 검증 완료
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
