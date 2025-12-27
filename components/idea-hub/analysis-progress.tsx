"use client"

import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  CheckCircle2,
  Loader2,
  Shield,
  ShieldCheck,
  Lock,
  KeyRound,
  FileText,
  FileCheck,
  FileScan,
  ClipboardCheck,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { AnimatedKcaLogo } from "@/components/ui/animated-kca-logo"
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


// 떠다니는 아이콘 요소 정의 (문서/보안 관련)
const FLOATING_ICONS = [
  // 왼쪽 요소들 (보안 관련)
  { icon: Shield, position: "left" as const, delay: 0, y: "10%", x: "12%" },
  { icon: Lock, position: "left" as const, delay: 2.5, y: "35%", x: "16%" },
  { icon: ShieldCheck, position: "left" as const, delay: 5, y: "58%", x: "10%" },
  { icon: KeyRound, position: "left" as const, delay: 7.5, y: "80%", x: "14%" },
  // 오른쪽 요소들 (문서 관련)
  { icon: FileText, position: "right" as const, delay: 1.2, y: "15%", x: "14%" },
  { icon: FileScan, position: "right" as const, delay: 3.7, y: "40%", x: "10%" },
  { icon: ClipboardCheck, position: "right" as const, delay: 6, y: "62%", x: "16%" },
  { icon: FileCheck, position: "right" as const, delay: 8.2, y: "85%", x: "12%" },
]

// 떠다니는 아이콘 컴포넌트
function FloatingIcon({
  icon: Icon,
  position,
  delay,
  y,
  x,
}: {
  icon: React.ComponentType<{ className?: string }>
  position: "left" | "right"
  delay: number
  y: string
  x: string
}) {
  return (
    <motion.div
      className="absolute"
      style={{
        top: y,
        [position === "left" ? "left" : "right"]: x,
      }}
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{
        opacity: [0, 0.5, 0.5, 0],
        scale: [0.8, 1, 1, 0.8],
        y: [0, -10, 10, 0],
      }}
      transition={{
        duration: 5,
        delay: delay,
        repeat: Infinity,
        repeatDelay: 5,
        ease: "easeInOut",
      }}
    >
      <Icon className="w-6 h-6 text-slate-400/60 dark:text-slate-500/50" />
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
      className="relative flex flex-col items-center justify-center py-16 px-4 min-h-[400px] overflow-hidden rounded-lg"
    >
      {/* Aurora Background */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Base gradient for better dark mode visibility */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900" />

        {/* Aurora wave 1 - Primary blue */}
        <motion.div
          className={cn(
            "absolute -top-[30%] -left-[10%] w-[70%] h-[60%]",
            "bg-gradient-to-br from-blue-400/30 via-indigo-400/25 to-cyan-400/20",
            "dark:from-blue-500/25 dark:via-indigo-500/20 dark:to-cyan-500/15",
            "blur-[80px] rounded-full"
          )}
          animate={{
            x: [0, 50, 20, 0],
            y: [0, 20, -10, 0],
            scale: [1, 1.1, 0.95, 1],
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            repeatType: "reverse",
            ease: "easeInOut",
          }}
        />

        {/* Aurora wave 2 - Secondary emerald */}
        <motion.div
          className={cn(
            "absolute top-[20%] -right-[5%] w-[60%] h-[50%]",
            "bg-gradient-to-l from-emerald-400/25 via-teal-400/20 to-green-400/15",
            "dark:from-emerald-500/20 dark:via-teal-500/15 dark:to-green-500/12",
            "blur-[70px] rounded-full"
          )}
          animate={{
            x: [0, -40, -20, 0],
            y: [0, 30, 10, 0],
            scale: [1, 0.9, 1.05, 1],
          }}
          transition={{
            duration: 18,
            repeat: Infinity,
            repeatType: "reverse",
            ease: "easeInOut",
            delay: 2,
          }}
        />

        {/* Aurora wave 3 - Accent pink/purple */}
        <motion.div
          className={cn(
            "absolute -bottom-[20%] left-[20%] w-[50%] h-[45%]",
            "bg-gradient-to-tr from-purple-400/20 via-pink-400/15 to-rose-400/15",
            "dark:from-purple-500/18 dark:via-pink-500/12 dark:to-rose-500/10",
            "blur-[60px] rounded-full"
          )}
          animate={{
            x: [0, 30, -20, 0],
            y: [0, -20, 10, 0],
            scale: [1, 1.15, 0.9, 1],
          }}
          transition={{
            duration: 12,
            repeat: Infinity,
            repeatType: "reverse",
            ease: "easeInOut",
            delay: 1,
          }}
        />

        {/* Aurora wave 4 - Extra amber glow for dark mode */}
        <motion.div
          className={cn(
            "absolute top-[40%] left-[30%] w-[40%] h-[35%]",
            "bg-gradient-to-br from-amber-300/15 via-orange-300/10 to-yellow-300/10",
            "dark:from-amber-500/15 dark:via-orange-500/12 dark:to-yellow-500/10",
            "blur-[50px] rounded-full"
          )}
          animate={{
            x: [0, -20, 30, 0],
            y: [0, 15, -15, 0],
            scale: [1, 1.1, 0.9, 1],
            opacity: [0.8, 1, 0.7, 0.8],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            repeatType: "reverse",
            ease: "easeInOut",
            delay: 0.5,
          }}
        />

        {/* Radial gradient overlay for depth */}
        <div
          className={cn(
            "absolute inset-0",
            "bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(255,255,255,0.4)_100%)]",
            "dark:bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(15,23,42,0.5)_100%)]"
          )}
        />

        {/* Subtle noise texture for premium feel */}
        <div className="absolute inset-0 opacity-[0.02] dark:opacity-[0.04] bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIj48ZmlsdGVyIGlkPSJhIiB4PSIwIiB5PSIwIj48ZmVUdXJidWxlbmNlIGJhc2VGcmVxdWVuY3k9Ii43NSIgc3RpdGNoVGlsZXM9InN0aXRjaCIgdHlwZT0iZnJhY3RhbE5vaXNlIi8+PC9maWx0ZXI+PHJlY3Qgd2lkdGg9IjMwMCIgaGVpZ2h0PSIzMDAiIGZpbHRlcj0idXJsKCNhKSIgb3BhY2l0eT0iMSIvPjwvc3ZnPg==')]" />
      </div>

      {/* Floating Icons - 좌우 여백에 떠다니는 아이콘들 */}
      <div className="absolute inset-0 pointer-events-none hidden md:block">
        {FLOATING_ICONS.map((item, index) => (
          <FloatingIcon
            key={index}
            icon={item.icon}
            position={item.position}
            delay={item.delay}
            y={item.y}
            x={item.x}
          />
        ))}
      </div>

      {/* Content - z-10 to stay above background */}
      <div className="relative z-10 flex flex-col items-center">
        {/* KCA-i 애니메이션 로고 */}
        <AnimatedKcaLogo />

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
      </div>
    </motion.div>
  )
}
