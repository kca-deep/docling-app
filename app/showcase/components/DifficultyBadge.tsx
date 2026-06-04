"use client"

import { cn } from "@/lib/utils"

const DIFF_MAP: Record<string, { label: string; className: string }> = {
  beginner:     { label: "입문",  className: "bg-success-bg text-success" },
  intermediate: { label: "중급",  className: "bg-warning-bg text-warning" },
  advanced:     { label: "고급",  className: "bg-danger-bg text-danger" },
}

interface Props {
  difficulty: string
  className?: string
}

export function DifficultyBadge({ difficulty, className }: Props) {
  const cfg = DIFF_MAP[difficulty] ?? DIFF_MAP.beginner
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-xs font-medium", cfg.className, className)}>
      {cfg.label}
    </span>
  )
}
