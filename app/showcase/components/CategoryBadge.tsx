"use client"

import { cn } from "@/lib/utils"

const COLOR_MAP: Record<string, string> = {
  blue:   "bg-info-bg text-info",
  purple: "bg-purple-bg text-purple",
  green:  "bg-success-bg text-success",
  orange: "bg-warning-bg text-warning",
  yellow: "bg-warning-bg text-warning",
  teal:   "bg-primary/10 text-primary",
  red:    "bg-danger-bg text-danger",
}

interface Props {
  name: string
  color: string
  className?: string
}

export function CategoryBadge({ name, color, className }: Props) {
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-xs font-medium", COLOR_MAP[color] ?? COLOR_MAP.blue, className)}>
      {name}
    </span>
  )
}
