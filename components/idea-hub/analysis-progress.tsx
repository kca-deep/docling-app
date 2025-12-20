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

// 셀프진단 테마 색상
const selfcheckTheme = {
  primary: "#3B82F6",     // blue-500
  secondary: "#10B981",   // emerald-500
  accent: "#EF4444",      // red-500
  gradient: "conic-gradient(from 0deg, #3B82F6, #10B981, #EF4444, #3B82F6)",
}

// 개선된 AnimatedLogo 컴포넌트 (챗봇과 동일한 스타일)
function AnimatedLogo() {
  const theme = selfcheckTheme

  return (
    <div className="relative w-24 h-24">
      {/* 1. 회전하는 conic-gradient 테두리 */}
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{ background: theme.gradient, padding: "3px" }}
        animate={{ rotate: 360 }}
        transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
      >
        <div className="w-full h-full rounded-full bg-background" />
      </motion.div>

      {/* 2. 펄스 링 1 (느린 파동) - 다크모드 글로우 효과 강화 */}
      <motion.div
        className="absolute inset-0 rounded-full border-2"
        style={{
          borderColor: `${theme.primary}90`,
          boxShadow: `0 0 20px ${theme.primary}60, 0 0 40px ${theme.primary}30`,
        }}
        animate={{ scale: [1, 1.25, 1], opacity: [0.8, 0, 0.8] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* 3. 펄스 링 2 (빠른 파동, 딜레이) - 글로우 효과 추가 */}
      <motion.div
        className="absolute inset-0 rounded-full border-2"
        style={{
          borderColor: `${theme.secondary}80`,
          boxShadow: `0 0 15px ${theme.secondary}50, 0 0 30px ${theme.secondary}25`,
        }}
        animate={{ scale: [1, 1.4, 1], opacity: [0.7, 0, 0.7] }}
        transition={{ duration: 2, repeat: Infinity, delay: 0.5, ease: "easeInOut" }}
      />

      {/* 4. 내부 배경 원 + KCA-i 텍스트 */}
      <motion.div
        className="absolute inset-[6px] rounded-full flex items-center justify-center"
        style={{
          background: `linear-gradient(135deg, ${theme.primary}30, ${theme.secondary}25)`,
          backdropFilter: "blur(12px)",
          boxShadow: `inset 0 0 20px ${theme.primary}20, 0 4px 20px ${theme.primary}15`,
        }}
        animate={{ scale: [1, 1.02, 1] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      >
        <span
          className="text-lg font-bold"
          style={{
            background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary}, ${theme.accent})`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          KCA-i
        </span>
      </motion.div>
    </div>
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
      {/* 개선된 AnimatedLogo */}
      <AnimatedLogo />

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
