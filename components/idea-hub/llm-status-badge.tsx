"use client"

import { useState, useEffect, useCallback } from "react"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Brain, Wifi, WifiOff, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { apiEndpoints } from "@/lib/api-config"

interface LlmStatus {
  selectedModel: string
  selectedModelLabel: string
  latencyMs: number | null
  status: "healthy" | "degraded" | "unhealthy" | "loading"
}

export function LlmStatusBadge() {
  const [status, setStatus] = useState<LlmStatus>({
    selectedModel: "gpt-oss-20b",
    selectedModelLabel: "GPT-OSS 20B",
    latencyMs: null,
    status: "loading",
  })

  // Fetch LLM status from API
  const fetchLlmStatus = useCallback(async () => {
    try {
      const response = await fetch(apiEndpoints.selfcheckLlmStatus, {
        credentials: "include",
      })
      if (response.ok) {
        const data = await response.json()
        // Determine overall status from all_models
        const healthyModels = data.all_models?.filter(
          (m: { status: string }) => m.status === "healthy"
        ) || []
        const overallStatus = healthyModels.length > 0
          ? "healthy"
          : data.all_models?.some((m: { status: string }) => m.status === "degraded")
            ? "degraded"
            : "unhealthy"

        setStatus({
          selectedModel: data.selected_model,
          selectedModelLabel: data.selected_model_label,
          latencyMs: data.latency_ms,
          status: overallStatus,
        })
      } else {
        setStatus(prev => ({ ...prev, status: "unhealthy" }))
      }
    } catch (error) {
      console.error("Failed to fetch LLM status:", error)
      setStatus(prev => ({ ...prev, status: "unhealthy" }))
    }
  }, [])

  useEffect(() => {
    fetchLlmStatus()
    // Refresh status every 30 seconds
    const interval = setInterval(fetchLlmStatus, 30000)
    return () => clearInterval(interval)
  }, [fetchLlmStatus])

  const getStatusColor = () => {
    switch (status.status) {
      case "healthy":
        return "bg-green-500"
      case "degraded":
        return "bg-amber-500"
      case "unhealthy":
        return "bg-red-500"
      default:
        return "bg-gray-400"
    }
  }

  const getStatusIcon = () => {
    switch (status.status) {
      case "loading":
        return <Loader2 className="w-3 h-3 animate-spin" />
      case "unhealthy":
        return <WifiOff className="w-3 h-3" />
      default:
        return <Wifi className="w-3 h-3" />
    }
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={cn(
              "gap-1.5 cursor-help transition-colors",
              status.status === "healthy" && "border-green-500/50 text-green-700 dark:text-green-300",
              status.status === "degraded" && "border-amber-500/50 text-amber-700 dark:text-amber-300",
              status.status === "unhealthy" && "border-red-500/50 text-red-700 dark:text-red-300"
            )}
          >
            <span className={cn("w-2 h-2 rounded-full", getStatusColor())} />
            <Brain className="w-3 h-3" />
            <span className="text-xs font-medium">
              {status.status === "loading" ? "연결 중..." : status.selectedModelLabel}
            </span>
            {getStatusIcon()}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          <div className="space-y-1">
            <p className="font-medium">AI 분석 모델</p>
            <p>모델: {status.selectedModelLabel}</p>
            <p>
              상태:{" "}
              {status.status === "healthy"
                ? "정상"
                : status.status === "degraded"
                ? "지연"
                : status.status === "unhealthy"
                ? "장애"
                : "확인 중"}
            </p>
            {status.latencyMs && <p>응답시간: {status.latencyMs}ms</p>}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
