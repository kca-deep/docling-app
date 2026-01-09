"use client"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  Clock,
  Edit3,
  CheckCircle2,
  MessageSquare,
} from "lucide-react"

export type FeedbackStatus = "none" | "draft" | "in_progress" | "completed"

interface FeedbackStatusBadgeProps {
  status: FeedbackStatus
  className?: string
  showIcon?: boolean
  size?: "sm" | "default"
}

const statusConfig: Record<
  FeedbackStatus,
  {
    label: string
    variant: "outline" | "secondary" | "default" | "destructive"
    icon: typeof Clock
    className: string
  }
> = {
  none: {
    label: "대기중",
    variant: "outline",
    icon: Clock,
    className: "text-muted-foreground",
  },
  draft: {
    label: "대기중",
    variant: "outline",
    icon: Clock,
    className: "text-muted-foreground",
  },
  in_progress: {
    label: "작성중",
    variant: "secondary",
    icon: Edit3,
    className: "text-amber-600 border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800",
  },
  completed: {
    label: "완료",
    variant: "default",
    icon: CheckCircle2,
    className: "bg-green-500 hover:bg-green-600 text-white",
  },
}

export function FeedbackStatusBadge({
  status,
  className,
  showIcon = true,
  size = "default",
}: FeedbackStatusBadgeProps) {
  const config = statusConfig[status]
  const Icon = config.icon

  return (
    <Badge
      variant={config.variant}
      className={cn(
        "gap-1",
        config.className,
        size === "sm" && "text-[10px] px-1.5 py-0",
        className
      )}
    >
      {showIcon && (
        <Icon className={cn("h-3 w-3", size === "sm" && "h-2.5 w-2.5")} />
      )}
      {config.label}
    </Badge>
  )
}

// Compact version for table cells
export function FeedbackStatusIndicator({
  status,
  onClick,
  canEdit,
}: {
  status: FeedbackStatus
  onClick?: () => void
  canEdit?: boolean
}) {
  const config = statusConfig[status]
  const Icon = config.icon

  if (status === "none" || status === "draft") {
    if (canEdit) {
      return (
        <button
          onClick={onClick}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <MessageSquare className="h-3.5 w-3.5" />
          <span>피드백 작성</span>
        </button>
      )
    }
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Clock className="h-3.5 w-3.5" />
        <span>대기중</span>
      </span>
    )
  }

  if (status === "in_progress") {
    return (
      <button
        onClick={onClick}
        className="flex items-center gap-1.5 text-xs text-amber-600 hover:text-amber-700 transition-colors"
      >
        <Edit3 className="h-3.5 w-3.5" />
        <span>작성중</span>
      </button>
    )
  }

  // completed
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 text-xs text-green-600 hover:text-green-700 transition-colors"
    >
      <CheckCircle2 className="h-3.5 w-3.5" />
      <span>완료</span>
    </button>
  )
}
