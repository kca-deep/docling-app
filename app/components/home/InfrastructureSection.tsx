"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import {
  Cpu,
  Network,
  Server,
  Loader2,
} from "lucide-react"
import { motion } from "framer-motion"
import { Badge } from "@/components/ui/badge"
import { API_BASE_URL } from "@/lib/api-config"

// 서비스 상태 타입
interface ServiceStatus {
  status: "healthy" | "degraded" | "unhealthy" | "disabled" | "unconfigured" | "loading"
  latency_ms?: number
  error?: string
  model?: string
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

interface InfrastructureSectionProps {
  onHealthLoad?: (activeCount: number, isLoading: boolean) => void
}

export function InfrastructureSection({ onHealthLoad }: InfrastructureSectionProps) {
  const [healthData, setHealthData] = useState<HealthData | null>(null)
  const [healthLoading, setHealthLoading] = useState(true)
  const [isVisible, setIsVisible] = useState(false)
  const [hasFetched, setHasFetched] = useState(false)
  const sectionRef = useRef<HTMLDivElement>(null)

  // 인프라 상태 fetch
  const fetchHealth = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/health/ready`, {
        credentials: "include",
      })
      if (response.ok || response.status === 503) {
        const data = await response.json()
        setHealthData(data)
      }
    } catch (error) {
      console.error("[Health] Failed to fetch:", error)
    } finally {
      setHealthLoading(false)
    }
  }, [])

  // IntersectionObserver로 Lazy Loading
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasFetched) {
          setIsVisible(true)
          setHasFetched(true)
        }
      },
      { rootMargin: "100px", threshold: 0.1 }
    )

    if (sectionRef.current) {
      observer.observe(sectionRef.current)
    }

    return () => observer.disconnect()
  }, [hasFetched])

  // 섹션이 보이면 fetch 시작 + 30초 폴링
  useEffect(() => {
    if (!isVisible) return

    fetchHealth()
    const interval = setInterval(fetchHealth, 30000)
    return () => clearInterval(interval)
  }, [isVisible, fetchHealth])

  // 활성 서비스 수 계산 및 상위 컴포넌트에 전달
  const llmHealthKeys = ["gpt_oss", "qwen3_vl", "exaone"] as const
  const coreHealthKeys = ["embedding", "reranker", "docling", "qdrant"] as const

  const activeLlmCount = healthData
    ? llmHealthKeys.filter(key => {
        const status = healthData.services[key]?.status
        return status === "healthy" || status === "degraded"
      }).length
    : 0

  const activeCoreCount = healthData
    ? coreHealthKeys.filter(key => {
        const status = healthData.services[key]?.status
        return status === "healthy" || status === "degraded"
      }).length
    : 0

  const activeServiceCount = activeLlmCount + activeCoreCount

  // 상위 컴포넌트에 상태 전달
  useEffect(() => {
    onHealthLoad?.(activeServiceCount, healthLoading)
  }, [activeServiceCount, healthLoading, onHealthLoad])

  return (
    <div ref={sectionRef} className="w-full py-24 bg-gradient-to-b from-transparent via-[color:var(--chart-5)]/5 to-muted/15 relative overflow-hidden">
      {/* 상단 액센트 라인 */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[color:var(--chart-5)] to-transparent" />
      <div className="absolute inset-0 bg-noise opacity-30 pointer-events-none" />
      <div className="max-w-6xl mx-auto px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">
            시스템 <span className="text-[color:var(--chart-5)]">인프라</span>
          </h2>
          <p className="text-lg text-muted-foreground/80 max-w-2xl mx-auto">
            RTX 5090 GPU 서버 기반 AI 서비스 아키텍처
          </p>
        </motion.div>

        {/* GPU 서버 뱃지 */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="flex justify-center mb-12"
        >
          <div className="inline-flex items-center gap-4 px-6 py-3 rounded-full bg-gradient-to-r from-red-500/10 to-orange-500/10 border border-red-500/20 shadow-lg">
            <Cpu className="h-6 w-6 text-red-500" />
            <span className="font-bold text-lg bg-clip-text text-transparent bg-gradient-to-r from-red-500 to-orange-500">
              NVIDIA RTX 5090
            </span>
            <div className="h-5 w-px bg-border" />
            <span className="text-sm font-medium text-muted-foreground">32GB VRAM</span>
          </div>
        </motion.div>

        {/* LLM 모델 섹션 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mb-12"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-xl bg-[color:var(--chart-1)]/10">
              <Network className="h-5 w-5 text-[color:var(--chart-1)]" />
            </div>
            <h3 className="text-xl font-bold">LLM Models</h3>
            <span className="text-sm text-muted-foreground ml-auto">
              {healthLoading ? "Checking..." : `${activeLlmCount} Active`}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { name: "GPT-OSS 20B", badge: "US", type: "General", vram: "16GB", healthKey: "gpt_oss" as const, colorVar: 1 },
              { name: "Qwen3-VL 8B", badge: "CN", type: "Vision OCR", vram: "8GB", healthKey: "qwen3_vl" as const, colorVar: 2 },
              { name: "EXAONE 4.0 32B", badge: "KR", type: "Long Context", vram: "20GB", healthKey: "exaone" as const, colorVar: 3 },
            ].map((model, i) => {
              const status = healthLoading
                ? "loading"
                : healthData?.services[model.healthKey]?.status || "unhealthy"
              const isActive = status === "healthy" || status === "degraded"

              return (
                <motion.div
                  key={i}
                  whileHover={{ y: -4, scale: 1.02 }}
                  className={`relative rounded-2xl p-5 transition-all duration-300 ${
                    isActive
                      ? 'bg-background dark:bg-card border border-border shadow-lg hover:shadow-xl'
                      : 'bg-muted/30 dark:bg-muted/20 border border-border/50 opacity-60'
                  }`}
                >
                  {/* Status Indicator */}
                  <div className="absolute top-4 right-4">
                    {healthLoading ? (
                      <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                    ) : (
                      <div className={`w-3 h-3 rounded-full ${
                        status === "healthy" ? 'bg-green-500 animate-pulse shadow-lg shadow-green-500/50' :
                        status === "degraded" ? 'bg-yellow-500 shadow-lg shadow-yellow-500/50' :
                        'bg-muted-foreground/50'
                      }`} />
                    )}
                  </div>

                  {/* Model Info */}
                  <div className="mb-4">
                    <h4 className="font-bold text-base mb-1">{model.name}</h4>
                    <p className="text-sm text-muted-foreground">{model.type}</p>
                  </div>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="text-xs font-medium">{model.badge}</Badge>
                    <Badge variant="secondary" className="text-xs font-mono">{model.vram}</Badge>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </motion.div>

        {/* 서비스 섹션 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mb-12"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-xl bg-[color:var(--chart-2)]/10">
              <Server className="h-5 w-5 text-[color:var(--chart-2)]" />
            </div>
            <h3 className="text-xl font-bold">Core Services</h3>
            <span className="text-sm text-muted-foreground ml-auto">
              {healthLoading ? "Checking..." : `${activeCoreCount} Active`}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { name: "BGE-M3 Embedding", badge: "Vector", type: "1024-dim", healthKey: "embedding" as const },
              { name: "BGE Reranker", badge: "Rank", type: "v2-m3 Model", healthKey: "reranker" as const },
              { name: "Docling API", badge: "Parse", type: "Doc Parser", healthKey: "docling" as const },
              { name: "Qdrant DB", badge: "Store", type: "Vector DB", healthKey: "qdrant" as const },
            ].map((svc, i) => {
              const status = healthLoading
                ? "loading"
                : healthData?.services[svc.healthKey]?.status || "unhealthy"
              const isActive = status === "healthy" || status === "degraded"

              return (
                <motion.div
                  key={i}
                  whileHover={{ y: -4, scale: 1.02 }}
                  className={`relative rounded-2xl p-5 transition-all duration-300 ${
                    isActive
                      ? 'bg-background dark:bg-card border border-border shadow-lg hover:shadow-xl'
                      : 'bg-muted/30 dark:bg-muted/20 border border-border/50 opacity-60'
                  }`}
                >
                  {/* Status Indicator */}
                  <div className="absolute top-4 right-4">
                    {healthLoading ? (
                      <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                    ) : (
                      <div className={`w-3 h-3 rounded-full ${
                        status === "healthy" ? 'bg-green-500 animate-pulse shadow-lg shadow-green-500/50' :
                        status === "degraded" ? 'bg-yellow-500 shadow-lg shadow-yellow-500/50' :
                        'bg-muted-foreground/50'
                      }`} />
                    )}
                  </div>

                  {/* Service Info */}
                  <div className="mb-4">
                    <h4 className="font-bold text-base mb-1">{svc.name}</h4>
                    <p className="text-sm text-muted-foreground">{svc.type}</p>
                  </div>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="text-xs font-medium">{svc.badge}</Badge>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </motion.div>
      </div>
    </div>
  )
}

// CSS 애니메이션 폴백 버전
export function InfrastructureSectionFallback() {
  return (
    <div className="w-full py-24 bg-gradient-to-b from-transparent via-[color:var(--chart-5)]/5 to-muted/15 relative overflow-hidden">
      {/* 상단 액센트 라인 */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[color:var(--chart-5)] to-transparent" />
      <div className="absolute inset-0 bg-noise opacity-30 pointer-events-none" />
      <div className="max-w-6xl mx-auto px-6 relative z-10">
        <div className="text-center mb-16 animate-fade-in">
          <h2 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">
            시스템 <span className="text-[color:var(--chart-5)]">인프라</span>
          </h2>
          <p className="text-lg text-muted-foreground/80 max-w-2xl mx-auto">
            RTX 5090 GPU 서버 기반 AI 서비스 아키텍처
          </p>
        </div>

        {/* GPU 서버 뱃지 */}
        <div className="flex justify-center mb-12">
          <div className="inline-flex items-center gap-4 px-6 py-3 rounded-full bg-gradient-to-r from-red-500/10 to-orange-500/10 border border-red-500/20 shadow-lg">
            <Cpu className="h-6 w-6 text-red-500" />
            <span className="font-bold text-lg bg-clip-text text-transparent bg-gradient-to-r from-red-500 to-orange-500">
              NVIDIA RTX 5090
            </span>
            <div className="h-5 w-px bg-border" />
            <span className="text-sm font-medium text-muted-foreground">32GB VRAM</span>
          </div>
        </div>

        {/* 로딩 스켈레톤 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl p-5 bg-muted/30 border border-border/50 animate-pulse">
              <div className="h-4 w-24 bg-muted rounded mb-2" />
              <div className="h-3 w-16 bg-muted rounded mb-4" />
              <div className="flex gap-2">
                <div className="h-5 w-12 bg-muted rounded" />
                <div className="h-5 w-12 bg-muted rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
