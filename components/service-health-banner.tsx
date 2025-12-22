"use client"

import { useState, useEffect, useCallback } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  CheckCircle2,
  AlertCircle,
  XCircle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import { API_BASE_URL } from "@/lib/api-config"
import { cn } from "@/lib/utils"

interface ServiceStatus {
  status: "healthy" | "degraded" | "unhealthy" | "disabled" | "unconfigured"
  latency_ms?: number
  error?: string
}

interface HealthData {
  status: string
  services: {
    database: ServiceStatus
    qdrant: ServiceStatus
    embedding: ServiceStatus
    gpt_oss: ServiceStatus
    exaone: ServiceStatus
    docling: ServiceStatus
    reranker: ServiceStatus
    qwen3_vl: ServiceStatus
  }
}

// 서비스 표시 정보
const SERVICE_INFO: Record<string, { label: string; critical: boolean }> = {
  database: { label: "Database", critical: true },
  qdrant: { label: "Qdrant", critical: true },
  embedding: { label: "Embedding", critical: false },
  gpt_oss: { label: "GPT-OSS", critical: false },
  exaone: { label: "EXAONE", critical: false },
  docling: { label: "Docling", critical: false },
  reranker: { label: "Reranker", critical: false },
  qwen3_vl: { label: "OCR", critical: false },
}

interface ServiceHealthBannerProps {
  className?: string
  showDetails?: boolean
  pollingInterval?: number
}

export function ServiceHealthBanner({
  className,
  showDetails = false,
  pollingInterval = 60000,
}: ServiceHealthBannerProps) {
  const [healthData, setHealthData] = useState<HealthData | null>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)
  const [lastChecked, setLastChecked] = useState<Date | null>(null)

  const fetchHealth = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/health/ready`, {
        credentials: "include",
      })
      // 503도 JSON 응답이므로 파싱 (critical 서비스 장애 시 503 반환)
      if (response.ok || response.status === 503) {
        const data = await response.json()
        setHealthData(data)
        setLastChecked(new Date())
      }
    } catch (error) {
      console.error("[Health] Failed to fetch:", error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchHealth()
    const interval = setInterval(fetchHealth, pollingInterval)
    return () => clearInterval(interval)
  }, [fetchHealth, pollingInterval])

  if (loading || !healthData) {
    return null
  }

  // 상태 집계
  const services = Object.entries(healthData.services)
  const unhealthyServices = services.filter(
    ([, status]) => status.status === "unhealthy"
  )
  const degradedServices = services.filter(
    ([, status]) => status.status === "degraded"
  )
  const healthyCount = services.filter(
    ([, status]) => status.status === "healthy"
  ).length

  // 모든 서비스 정상이면 표시하지 않음 (showDetails가 true인 경우에만 표시)
  if (unhealthyServices.length === 0 && degradedServices.length === 0) {
    if (!showDetails) return null
    return (
      <Alert className={cn("bg-green-500/5 border-green-500/20", className)}>
        <CheckCircle2 className="h-4 w-4 text-green-500" />
        <AlertDescription className="flex items-center justify-between">
          <span className="text-green-700 dark:text-green-400">
            모든 서비스 정상 ({healthyCount}/{services.length})
          </span>
          <span className="text-xs text-muted-foreground">
            {lastChecked?.toLocaleTimeString()}
          </span>
        </AlertDescription>
      </Alert>
    )
  }

  // 장애가 있는 경우 배너 표시
  const isUnhealthy = unhealthyServices.length > 0
  const alertVariant = isUnhealthy ? "destructive" : "default"
  const Icon = isUnhealthy ? XCircle : AlertCircle
  const iconColor = isUnhealthy ? "text-red-500" : "text-yellow-500"
  const bgColor = isUnhealthy
    ? "bg-red-500/5 border-red-500/20"
    : "bg-yellow-500/5 border-yellow-500/20"

  return (
    <Alert className={cn(bgColor, className)}>
      <Icon className={cn("h-4 w-4", iconColor)} />
      <AlertDescription>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={cn(
                "font-medium",
                isUnhealthy
                  ? "text-red-700 dark:text-red-400"
                  : "text-yellow-700 dark:text-yellow-400"
              )}
            >
              {isUnhealthy
                ? `${unhealthyServices.length}개 서비스 오프라인`
                : `${degradedServices.length}개 서비스 저하`}
            </span>
            {/* 장애 서비스 목록 */}
            {[...unhealthyServices, ...degradedServices]
              .slice(0, 3)
              .map(([key, status]) => (
                <Badge
                  key={key}
                  variant="outline"
                  className={cn(
                    "text-xs",
                    status.status === "unhealthy"
                      ? "border-red-500/30 text-red-600 dark:text-red-400"
                      : "border-yellow-500/30 text-yellow-600 dark:text-yellow-400"
                  )}
                >
                  {SERVICE_INFO[key]?.label || key}
                </Badge>
              ))}
            {unhealthyServices.length + degradedServices.length > 3 && (
              <span className="text-xs text-muted-foreground">
                +{unhealthyServices.length + degradedServices.length - 3}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => {
                setLoading(true)
                fetchHealth()
              }}
            >
              <RefreshCw
                className={cn("h-3 w-3", loading && "animate-spin")}
              />
            </Button>
            {showDetails && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
              </Button>
            )}
          </div>
        </div>

        {/* 확장된 상세 정보 */}
        {showDetails && expanded && (
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
            {services.map(([key, status]) => (
              <div
                key={key}
                className="flex items-center gap-2 text-xs p-2 rounded-md bg-background/50"
              >
                <div
                  className={cn(
                    "w-2 h-2 rounded-full",
                    status.status === "healthy" && "bg-green-500",
                    status.status === "degraded" && "bg-yellow-500",
                    status.status === "unhealthy" && "bg-red-500",
                    status.status === "disabled" && "bg-gray-400"
                  )}
                />
                <span className="text-muted-foreground">
                  {SERVICE_INFO[key]?.label || key}
                </span>
                {status.latency_ms && (
                  <span className="text-muted-foreground/60 ml-auto">
                    {status.latency_ms}ms
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </AlertDescription>
    </Alert>
  )
}
