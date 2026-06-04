"use client"

import { MessageSquare, Code2, BookOpen, GitBranch, Scissors } from "lucide-react"
import { cn } from "@/lib/utils"

const TYPE_CONFIG: Record<string, { label: string; icon: React.ElementType; className: string }> = {
  prompt:   { label: "프롬프트", icon: MessageSquare, className: "bg-info-bg text-info" },
  code:     { label: "코드",    icon: Code2,         className: "bg-purple-bg text-purple" },
  guide:    { label: "가이드",  icon: BookOpen,       className: "bg-success-bg text-success" },
  workflow: { label: "워크플로", icon: GitBranch,     className: "bg-warning-bg text-warning" },
  snippet:  { label: "스니펫",  icon: Scissors,       className: "bg-danger-bg text-danger" },
}

interface Props {
  type: string
  className?: string
}

export function ItemTypeBadge({ type, className }: Props) {
  const cfg = TYPE_CONFIG[type] ?? TYPE_CONFIG.snippet
  const Icon = cfg.icon
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium", cfg.className, className)}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  )
}
