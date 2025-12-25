"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import {
  ArrowRight,
  Upload,
  FileCode,
  Bot,
  Database,
  Sparkles,
  Zap,
  Shield,
  TrendingUp,
  ChevronDown,
  BarChart3,
  Server,
  Cpu,
  Network,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from "lucide-react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
import { Badge } from "@/components/ui/badge"
import { FloatingChatButton } from "@/components/floating-chat-button"
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

// 상태별 Badge 렌더링 함수
const StatusBadge = ({ status }: { status: ServiceStatus["status"] }) => {
  switch (status) {
    case "healthy":
      return (
        <Badge className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20 text-xs gap-1">
          <CheckCircle2 className="w-3 h-3" />
          Running
        </Badge>
      )
    case "degraded":
      return (
        <Badge className="bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20 text-xs gap-1">
          <AlertCircle className="w-3 h-3" />
          Degraded
        </Badge>
      )
    case "unhealthy":
      return (
        <Badge className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20 text-xs gap-1">
          <AlertCircle className="w-3 h-3" />
          Offline
        </Badge>
      )
    case "disabled":
      return (
        <Badge className="bg-muted text-muted-foreground border-border text-xs">
          Disabled
        </Badge>
      )
    case "loading":
      return (
        <Badge className="bg-muted/50 text-muted-foreground border-border text-xs gap-1">
          <Loader2 className="w-3 h-3 animate-spin" />
          Loading
        </Badge>
      )
    default:
      return (
        <Badge className="bg-muted text-muted-foreground border-border text-xs">
          Unknown
        </Badge>
      )
  }
}

export default function HomePage() {
  // 인프라 상태
  const [healthData, setHealthData] = useState<HealthData | null>(null)
  const [healthLoading, setHealthLoading] = useState(true)

  // 인프라 상태 폴링
  const fetchHealth = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/health/ready`, {
        credentials: "include",
      })
      // 503도 JSON 응답이므로 파싱 (critical 서비스 장애 시 503 반환)
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

  // 초기 로드 + 30초 간격 폴링
  useEffect(() => {
    fetchHealth()
    const interval = setInterval(fetchHealth, 30000)
    return () => clearInterval(interval)
  }, [fetchHealth])
  // 핵심 워크플로우 4단계 (미니멀 데이터 구조)
  const coreSteps = [
    {
      icon: FileCode,
      title: "문서 파싱",
      description: "PDF, DOCX, URL을 마크다운으로 변환",
      features: ["Docling Serve API", "Qwen3-VL OCR", "테이블 인식"],
      link: "/parse",
      colorVar: 1,
    },
    {
      icon: Database,
      title: "벡터 임베딩",
      description: "BGE-M3로 1024차원 벡터 생성",
      features: ["청크 분할", "다국어 지원", "Qdrant 저장"],
      link: "/upload",
      colorVar: 2,
    },
    {
      icon: Bot,
      title: "AI 챗봇",
      description: "RAG + Reranking으로 정확한 답변",
      features: ["멀티 LLM", "스트리밍", "출처 표시"],
      link: "/chat?fullscreen=true",
      colorVar: 3,
    },
    {
      icon: BarChart3,
      title: "통계 분석",
      description: "실시간 사용량 모니터링",
      features: ["일별 추이", "히트맵", "엑셀 내보내기"],
      link: "/analytics",
      colorVar: 4,
    },
  ]

  // 활성 서비스 수 계산
  const activeServiceCount = healthData
    ? Object.values(healthData.services).filter(
        (s) => s.status === "healthy" || s.status === "degraded"
      ).length
    : 0

  const stats = [
    { icon: Zap, label: "처리 속도", value: "<3", unit: "초/문서" },
    { icon: Server, label: "활성 서비스", value: healthLoading ? "-" : String(activeServiceCount), unit: "개" },
    { icon: TrendingUp, label: "벡터 차원", value: "1024", unit: "dim" },
    { icon: Sparkles, label: "AI 모델", value: "3+", unit: "개" },
  ]

  return (
    <>
      {/* Hero Section */}
      <div className="relative w-full text-center min-h-[calc(100vh-4rem)] lg:min-h-[85vh] flex flex-col justify-center overflow-hidden">
        {/* Background layers */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          <div className="absolute inset-0 bg-background" />
          {/* Dynamic Mesh Gradient */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.5 }}
            className="absolute inset-0 overflow-hidden"
          >
            <motion.div
              animate={{
                scale: [1, 1.2, 1],
                rotate: [0, 90, 0],
                x: [0, -100, 0],
                y: [0, -50, 0],
              }}
              transition={{
                duration: 20,
                repeat: Infinity,
                repeatType: "reverse",
                ease: "easeInOut"
              }}
              className="absolute -top-[50%] -left-[50%] w-[200%] h-[200%] bg-[radial-gradient(circle_farthest-corner_at_center,var(--chart-1)_0%,transparent_50%)] opacity-40 dark:opacity-50 blur-[100px] will-change-transform"
            />
            <motion.div
              animate={{
                scale: [1, 1.2, 1],
                rotate: [0, -90, 0],
                x: [0, 100, 0],
                y: [0, 50, 0],
              }}
              transition={{
                duration: 25,
                repeat: Infinity,
                repeatType: "reverse",
                ease: "easeInOut",
                delay: 2
              }}
              className="absolute -bottom-[50%] -right-[50%] w-[200%] h-[200%] bg-[radial-gradient(circle_farthest-corner_at_center,var(--chart-3)_0%,transparent_50%)] opacity-40 dark:opacity-50 blur-[100px] will-change-transform"
            />
          </motion.div>
          {/* Dot pattern overlay */}
          <div
            className="absolute inset-0 opacity-20 dark:opacity-10"
            style={{
              backgroundImage: 'radial-gradient(circle, hsl(var(--foreground) / 0.3) 1px, transparent 1px)',
              backgroundSize: '32px 32px',
              maskImage: 'radial-gradient(circle at center, black, transparent 80%)'
            }}
          />
        </div>

        {/* Content */}
        <div className="relative z-10 w-full max-w-7xl mx-auto px-6 md:px-8 lg:px-12 py-12 md:py-16 space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 bg-background/50 border border-[color:var(--chart-1)]/20 backdrop-blur-md shadow-sm"
          >
            <Sparkles className="w-4 h-4 text-[color:var(--chart-1)] animate-pulse" />
            <span className="text-sm font-semibold bg-clip-text text-transparent bg-gradient-to-r from-[color:var(--chart-1)] to-[color:var(--chart-3)]">
              AI-Powered Document Intelligence
            </span>
          </motion.div>

          <div className="space-y-6 mt-8">
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="text-6xl sm:text-7xl lg:text-8xl font-bold tracking-tighter"
            >
              <span className="bg-clip-text text-transparent bg-gradient-to-b from-foreground to-foreground/70">
                KCA-RAG
              </span>{' '}
              <span className="inline-block bg-clip-text text-transparent bg-gradient-to-r from-[color:var(--chart-1)] via-[color:var(--chart-2)] to-[color:var(--chart-3)]">
                Pipeline
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.6 }}
              className="text-xl sm:text-2xl text-muted-foreground/80 max-w-3xl mx-auto leading-relaxed px-4 text-balance font-light"
            >
              문서를 <strong className="font-semibold text-foreground">AI로 분석</strong>하고 <strong className="font-semibold text-foreground">벡터 데이터베이스</strong>에 저장하여<br className="hidden md:block" />
              초정밀 RAG 기반 질의응답 시스템을 구축하세요
            </motion.p>
          </div>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.8 }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center mt-12"
          >
            <Link href="/parse">
              <Button size="lg" className="h-12 px-8 rounded-full text-base font-semibold bg-gradient-to-r from-[color:var(--chart-1)] to-[color:var(--chart-2)] hover:opacity-90 transition-all shadow-lg shadow-[color:var(--chart-1)]/20 hover:shadow-[color:var(--chart-1)]/40 hover:scale-105 active:scale-95 text-white border-0">
                <Upload className="w-5 h-5 mr-2" />
                시작하기
              </Button>
            </Link>
            <Link href="/chat?fullscreen=true" className="group flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors px-6 py-3 rounded-full hover:bg-muted/50">
              <span className="font-medium">AI 챗봇 체험</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </motion.div>

          {/* Inline Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1.0 }}
            className="flex flex-wrap justify-center items-center gap-4 pt-12"
          >
            {stats.map((stat, index) => {
              const Icon = stat.icon
              return (
                <div key={index} className="flex items-center gap-3 px-6 py-3 rounded-2xl bg-background/40 backdrop-blur-sm border border-border/50 shadow-sm hover:shadow-md transition-all hover:bg-background/60 hover:-translate-y-1">
                  <div className="p-2 rounded-lg bg-[color:var(--chart-1)]/10 text-[color:var(--chart-1)]">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col items-start">
                    <span className="text-sm font-bold text-foreground">{stat.value}{stat.unit}</span>
                    <span className="text-xs text-muted-foreground">{stat.label}</span>
                  </div>
                </div>
              )
            })}
          </motion.div>
        </div>

        {/* Scroll Indicator */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, y: [0, 10, 0] }}
          transition={{ duration: 2, repeat: Infinity, delay: 1.5 }}
          onClick={() => {
            const processSection = document.getElementById('process-section')
            processSection?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 cursor-pointer p-2 rounded-full hover:bg-muted/30 transition-colors"
          aria-label="다음 섹션으로 스크롤"
        >
          <ChevronDown className="w-6 h-6 text-muted-foreground" />
        </motion.button>
      </div>

      {/* Process Flow Timeline */}
      <div id="process-section" className="w-full py-24 bg-gradient-to-b from-background via-muted/5 to-background relative overflow-hidden">
        <div className="absolute inset-0 bg-noise opacity-30 pointer-events-none" />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8 }}
          className="text-center mb-16 relative z-10"
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">
            문서에서 <span className="text-[color:var(--chart-1)]">지식</span>으로
          </h2>
          <p className="text-lg text-muted-foreground/80 max-w-2xl mx-auto">
            KCA-RAG의 4단계 핵심 프로세스
          </p>
        </motion.div>

        {/* Desktop Timeline */}
        <div className="hidden md:block max-w-6xl mx-auto px-6 relative z-10">
          <div className="relative">
            {/* Timeline connector line */}
            <div className="absolute top-8 left-0 right-0 h-1 rounded-full bg-muted dark:bg-muted/50 overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-[color:var(--chart-1)] via-[color:var(--chart-2)] to-[color:var(--chart-3)]"
                initial={{ width: "0%" }}
                whileInView={{ width: "100%" }}
                viewport={{ once: true }}
                transition={{ duration: 1.5, ease: "easeInOut" }}
              />
            </div>

            {/* Timeline steps */}
            <motion.div
              className="relative grid grid-cols-4 gap-8"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={{
                hidden: { opacity: 0 },
                visible: {
                  opacity: 1,
                  transition: {
                    staggerChildren: 0.2
                  }
                }
              }}
            >
              {coreSteps.map((step, index) => {
                const Icon = step.icon
                const chartColor = `var(--chart-${step.colorVar})`
                return (
                  <HoverCard key={index} openDelay={0} closeDelay={100}>
                    <HoverCardTrigger asChild>
                      <motion.div
                        variants={{
                          hidden: { opacity: 0, y: 20 },
                          visible: { opacity: 1, y: 0 }
                        }}
                      >
                        <Link href={step.link} className="group flex flex-col items-center cursor-pointer">
                          {/* Step circle */}
                          <div
                            className="relative z-10 w-16 h-16 rounded-2xl rotate-45 group-hover:rotate-0 transition-all duration-500 shadow-lg flex items-center justify-center bg-background dark:bg-card border border-border dark:border-border/80 group-hover:border-[color:var(--chart-1)]/50 group-hover:shadow-[color:var(--chart-1)]/30"
                          >
                            <div className="absolute inset-1 rounded-xl bg-muted/30 dark:bg-muted/40 group-hover:bg-[color:var(--chart-1)]/10 transition-colors -rotate-45 group-hover:rotate-0 duration-500" />
                            <Icon className="w-6 h-6 -rotate-45 group-hover:rotate-0 transition-all duration-500" style={{ color: chartColor }} />
                          </div>
                          {/* Step title */}
                          <div className="mt-8 text-center space-y-1">
                            <span className="block text-lg font-bold group-hover:text-[color:var(--chart-1)] transition-colors">{step.title}</span>
                            <span className="block text-xs font-mono text-muted-foreground dark:text-muted-foreground/80 uppercase tracking-widest">Step 0{index + 1}</span>
                          </div>
                        </Link>
                      </motion.div>
                    </HoverCardTrigger>
                    <HoverCardContent className="w-72 p-0 overflow-hidden border-0 shadow-2xl glass" side="bottom" align="center" sideOffset={20}>
                      <div className="p-4 bg-gradient-to-br from-background to-muted/20">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="p-1.5 rounded-md bg-muted/50">
                            <Icon className="w-4 h-4" style={{ color: chartColor }} />
                          </div>
                          <span className="font-semibold">{step.title}</span>
                        </div>
                        <p className="text-sm text-muted-foreground mb-4 leading-relaxed">{step.description}</p>
                        <ul className="space-y-2">
                          {step.features.map((feature, i) => (
                            <li key={i} className="text-xs text-muted-foreground flex items-center gap-2">
                              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: chartColor }} />
                              {feature}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="p-3 bg-muted/30 border-t border-border/50 flex justify-end">
                        <span className="text-xs font-medium flex items-center gap-1 hover:gap-2 transition-all" style={{ color: chartColor }}>
                          세부 정보 보기 <ArrowRight className="w-3 h-3" />
                        </span>
                      </div>
                    </HoverCardContent>
                  </HoverCard>
                )
              })}
            </motion.div>
          </div>
        </div>

        {/* Mobile Timeline */}
        <div className="md:hidden max-w-sm mx-auto px-4 relative z-10">
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-6 top-6 bottom-6 w-0.5 bg-gradient-to-b from-[color:var(--chart-1)] to-[color:var(--chart-3)] opacity-50 dark:opacity-70" />

            {/* Steps */}
            <div className="space-y-8">
              {coreSteps.map((step, index) => {
                const Icon = step.icon
                const chartColor = `var(--chart-${step.colorVar})`
                return (
                  <Link
                    key={index}
                    href={step.link}
                    className="relative flex items-start gap-6 group"
                  >
                    {/* Step circle */}
                    <div
                      className="relative z-10 w-12 h-12 rounded-xl flex items-center justify-center bg-background dark:bg-card border border-border dark:border-border/80 shrink-0 shadow-sm group-hover:scale-110 transition-transform"
                    >
                      <Icon className="w-5 h-5" style={{ color: chartColor }} />
                    </div>
                    {/* Content */}
                    <div className="flex-1 pt-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-lg">{step.title}</span>
                        <span className="text-xs font-mono text-muted-foreground dark:text-muted-foreground/80">0{index + 1}</span>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 시스템 아키텍처 섹션 */}
      <div className="w-full py-24 bg-gradient-to-b from-background via-muted/5 to-background relative overflow-hidden">
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
                {healthLoading ? "Checking..." : `${activeServiceCount} Active`}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { name: "BGE-M3 Embedding", desc: "1024-dim Vector", icon: Database, healthKey: "embedding" as const, colorVar: 1 },
                { name: "BGE Reranker", desc: "v2-m3 Model", icon: TrendingUp, healthKey: "reranker" as const, colorVar: 2 },
                { name: "Docling API", desc: "Doc Parser", icon: FileCode, healthKey: "docling" as const, colorVar: 3 },
                { name: "Qdrant DB", desc: "Vector Store", icon: Database, healthKey: "qdrant" as const, colorVar: 4 },
              ].map((svc, i) => {
                const Icon = svc.icon
                const chartColor = `var(--chart-${svc.colorVar})`
                const status = healthLoading
                  ? "loading"
                  : healthData?.services[svc.healthKey]?.status || "unhealthy"

                return (
                  <motion.div
                    key={i}
                    whileHover={{ y: -4 }}
                    className="group relative bg-background dark:bg-card border border-border rounded-2xl p-5 shadow-sm hover:shadow-lg transition-all duration-300"
                  >
                    {/* Icon */}
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-colors"
                      style={{ backgroundColor: `color-mix(in srgb, ${chartColor} 10%, transparent)` }}
                    >
                      <Icon className="h-6 w-6" style={{ color: chartColor }} />
                    </div>

                    {/* Info */}
                    <h4 className="font-bold text-base mb-1">{svc.name}</h4>
                    <p className="text-sm text-muted-foreground mb-4">{svc.desc}</p>

                    {/* Status */}
                    <div className="flex items-center justify-end">
                      <StatusBadge status={status} />
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </motion.div>

        </div>
      </div>

      {/* 플로팅 챗봇 버튼 */}
      <FloatingChatButton />
    </>
  )
}