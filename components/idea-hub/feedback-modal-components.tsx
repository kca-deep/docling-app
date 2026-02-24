"use client"

import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import {
  Sparkles,
  ChevronDown,
  ChevronUp,
  Copy,
  AlertTriangle,
  AlertCircle,
  HelpCircle,
  CheckCircle,
  XCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"

// AI 초안 생성 단계 메시지
export const DRAFT_GENERATION_STEPS = [
  "과제 내용을 분석하고 있어요",
  "관리적 보안내용을 작성하고 있어요",
  "기술적 보안내용을 작성하고 있어요",
  "종합의견을 정리하고 있어요",
]

// 타이핑 dots 애니메이션
export function TypingDots() {
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

export function AiDraftToggle({
  isOpen,
  onToggle,
  onApply,
}: {
  isOpen: boolean
  onToggle: () => void
  onApply: () => void
}) {
  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onToggle}
        className="h-7 px-2 text-xs gap-1 text-blue-600 hover:text-blue-700"
      >
        <Sparkles className="h-3 w-3" />
        AI 초안
        {isOpen ? (
          <ChevronUp className="h-3 w-3" />
        ) : (
          <ChevronDown className="h-3 w-3" />
        )}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onApply}
        className="h-7 px-2 text-xs gap-1"
      >
        <Copy className="h-3 w-3" />
        적용
      </Button>
    </div>
  )
}

export function AiDraftCard({
  content,
  onCopy,
}: {
  content: string
  onCopy: () => void
}) {
  return (
    <div className="rounded-md border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30 p-3 text-sm">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-medium">
          <Sparkles className="h-3.5 w-3.5" />
          AI 초안
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCopy}
          className="h-6 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
        >
          <Copy className="h-3 w-3" />
          복사
        </Button>
      </div>
      <p className="whitespace-pre-wrap text-muted-foreground">
        {content}
      </p>
    </div>
  )
}

export function RiskLevelIcon({ riskLevel }: { riskLevel: string }) {
  switch (riskLevel) {
    case "high":
      return <AlertTriangle className="h-4 w-4 text-red-500" />
    case "medium":
      return <AlertCircle className="h-4 w-4 text-amber-500" />
    case "low":
      return <CheckCircle className="h-4 w-4 text-green-500" />
    default:
      return <HelpCircle className="h-4 w-4 text-muted-foreground" />
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function RiskLevelBadge({ level }: { level: string }) {
  const config: Record<string, { label: string; className: string }> = {
    high: { label: "높음", className: "text-red-600 bg-red-100 dark:bg-red-950" },
    medium: { label: "보통", className: "text-amber-600 bg-amber-100 dark:bg-amber-950" },
    low: { label: "낮음", className: "text-green-600 bg-green-100 dark:bg-green-950" },
  }
  const { label, className } = config[level] || { label: level, className: "" }

  return (
    <span className={cn("px-1.5 py-0.5 rounded text-xs font-medium", className)}>
      {label}
    </span>
  )
}

export function AnswerBadge({ answer }: { answer: string }) {
  const config: Record<string, { label: string; icon: typeof CheckCircle; className: string }> = {
    yes: { label: "예", icon: CheckCircle, className: "text-green-600" },
    no: { label: "아니오", icon: XCircle, className: "text-red-600" },
    unknown: { label: "미확인", icon: HelpCircle, className: "text-muted-foreground" },
    need_check: { label: "확인필요", icon: AlertCircle, className: "text-amber-600" },
  }
  const { label, icon: Icon, className } = config[answer] || config.unknown

  return (
    <div className={cn("flex items-center gap-1 text-sm font-medium", className)}>
      <Icon className="h-3.5 w-3.5" />
      {label}
    </div>
  )
}
