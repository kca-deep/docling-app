"use client"

import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { CheckCircle2, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ChecklistItem } from "./checklist-form"

export interface AnalysisResultItem extends ChecklistItem {
  llmAnswer: "yes" | "no" | "need_check" | null
  llmConfidence: number
  llmEvidence: string
  llmRiskLevel: "high" | "medium" | "low"
  llmJudgment?: string | null
  llmQuote?: string | null
  llmReasoning?: string | null
  llmUserComparison?: string | null
}

export interface SimilarProject {
  submissionId: string
  projectName: string
  department: string
  managerName: string
  similarityScore: number
  similarityReason: string
  createdAt: string
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
  isSaved?: boolean
  similarProjects?: SimilarProject[]
}

interface AnalysisProgressProps {
  isAnalyzing: boolean
  result: AnalysisResult | null
  checklistItems: ChecklistItem[]
}

// 분석 단계 정의
const ANALYSIS_STEPS = [
  { id: 1, label: "내용분석", shortLabel: "내용" },
  { id: 2, label: "항목검증", shortLabel: "항목" },
  { id: 3, label: "위험평가", shortLabel: "위험" },
  { id: 4, label: "결과생성", shortLabel: "결과" },
]

// 친근한 메시지
const STEP_MESSAGES = [
  "과제 내용을 꼼꼼히 살펴보고 있어요",
  "체크리스트 항목을 하나씩 검토하고 있어요",
  "보안 위험도를 평가하고 있어요",
  "분석 결과를 정리하고 있어요",
]

// 타이핑 dots 애니메이션
function TypingDots() {
  return (
    <span className="inline-flex items-center gap-0.5 ml-1">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="w-1 h-1 rounded-full bg-primary/60"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{
            duration: 1,
            repeat: Infinity,
            delay: i * 0.2,
          }}
        />
      ))}
    </span>
  )
}

// 회전하는 원형 로더
function SpinningCircle({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative w-28 h-28">
      {/* 회전하는 그라디언트 테두리 */}
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{
          background: "conic-gradient(from 0deg, rgb(37, 99, 235), rgb(16, 185, 129), rgb(239, 68, 68), rgb(37, 99, 235))",
          padding: "3px",
        }}
        animate={{ rotate: 360 }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "linear",
        }}
      >
        <div className="w-full h-full rounded-full bg-background" />
      </motion.div>

      {/* 내부 콘텐츠 (로고) */}
      <div className="absolute inset-0 flex items-center justify-center">
        {children}
      </div>

      {/* 펄스 효과 링 */}
      <motion.div
        className="absolute inset-0 rounded-full border-2 border-primary/20"
        animate={{
          scale: [1, 1.15, 1],
          opacity: [0.5, 0, 0.5],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
    </div>
  )
}

// KCA-i 텍스트 (원형 안에 표시)
function KCAiText() {
  return (
    <motion.div
      className="flex items-center justify-center"
      animate={{ scale: [1, 1.03, 1] }}
      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
    >
      <span className="text-xl font-bold bg-gradient-to-r from-blue-600 via-emerald-500 to-red-500 bg-clip-text text-transparent">
        KCA-i
      </span>
    </motion.div>
  )
}

// 단계 도트 컴포넌트
function StepDot({
  isCompleted,
  isCurrent
}: {
  isCompleted: boolean
  isCurrent: boolean
}) {
  if (isCompleted) {
    return (
      <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
        <CheckCircle2 className="w-4 h-4 text-white" />
      </div>
    )
  }

  if (isCurrent) {
    return (
      <div className="relative">
        {/* 펄스 링 */}
        <motion.div
          className="absolute inset-0 rounded-full bg-primary/30"
          animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        />
        <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
          <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="w-6 h-6 rounded-full border-2 border-muted-foreground/30 bg-background" />
  )
}

export function AnalysisProgress({
  isAnalyzing,
}: AnalysisProgressProps) {
  const [currentStep, setCurrentStep] = useState(0)

  useEffect(() => {
    if (!isAnalyzing) {
      setCurrentStep(ANALYSIS_STEPS.length - 1)
      return
    }

    setCurrentStep(0)

    const stepInterval = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev < ANALYSIS_STEPS.length - 1) {
          return prev + 1
        }
        return prev
      })
    }, 5000)

    return () => {
      clearInterval(stepInterval)
    }
  }, [isAnalyzing])

  if (!isAnalyzing) {
    return null
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex flex-col items-center justify-center py-12 px-4"
    >
      {/* KCA-i 텍스트 + 회전 원형 */}
      <SpinningCircle>
        <KCAiText />
      </SpinningCircle>

      {/* 보안성검토 AI Agent 텍스트 */}
      <motion.p
        className="mt-5 text-sm font-medium text-muted-foreground"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        보안성검토 AI Agent
      </motion.p>

      {/* 현재 단계 메시지 (텍스트만) */}
      <AnimatePresence mode="wait">
        <motion.p
          key={currentStep}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3, delay: 0.5 }}
          className="mt-4 text-sm text-center text-foreground/70"
        >
          {STEP_MESSAGES[currentStep]}
          <TypingDots />
        </motion.p>
      </AnimatePresence>

      {/* 단계 표시 - 도트 + 라벨 */}
      <motion.div
        className="mt-10 flex items-start gap-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
      >
        {ANALYSIS_STEPS.map((step, index) => {
          const isCompleted = index < currentStep
          const isCurrent = index === currentStep

          return (
            <div key={step.id} className="flex items-center">
              {/* 단계 도트 + 라벨 */}
              <div className="flex flex-col items-center gap-2">
                <StepDot isCompleted={isCompleted} isCurrent={isCurrent} />
                <span
                  className={cn(
                    "text-xs font-medium transition-colors whitespace-nowrap",
                    isCompleted && "text-emerald-600 dark:text-emerald-400",
                    isCurrent && "text-primary",
                    !isCompleted && !isCurrent && "text-muted-foreground/50"
                  )}
                >
                  <span className="hidden sm:inline">{step.label}</span>
                  <span className="sm:hidden">{step.shortLabel}</span>
                </span>
              </div>

              {/* 연결선 */}
              {index < ANALYSIS_STEPS.length - 1 && (
                <div
                  className={cn(
                    "w-8 sm:w-12 h-0.5 mx-1 mt-[-14px] transition-colors",
                    isCompleted ? "bg-emerald-500" : "bg-muted-foreground/20"
                  )}
                />
              )}
            </div>
          )
        })}
      </motion.div>
    </motion.div>
  )
}
