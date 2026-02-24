"use client"

import Link from "next/link"
import {
  ArrowRight,
  FileCode,
  Bot,
  Database,
  BarChart3,
} from "lucide-react"
import { motion } from "framer-motion"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"

// 핵심 워크플로우 4단계
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
    link: "/chat?fullscreen=true&collection=kca-reguration",
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

export function ProcessTimeline() {
  return (
    <div id="process-section" className="w-full py-24 bg-gradient-to-b from-muted/25 via-muted/10 to-transparent relative overflow-hidden">
      {/* 상단 액센트 라인 */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[color:var(--chart-1)] to-transparent" />
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
  )
}

// CSS 애니메이션 폴백 버전 (dynamic import loading 시 사용)
export function ProcessTimelineFallback() {
  return (
    <div id="process-section" className="w-full py-24 bg-gradient-to-b from-muted/25 via-muted/10 to-transparent relative overflow-hidden">
      {/* 상단 액센트 라인 */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[color:var(--chart-1)] to-transparent" />
      <div className="absolute inset-0 bg-noise opacity-30 pointer-events-none" />
      <div className="text-center mb-16 relative z-10 animate-fade-in">
        <h2 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">
          문서에서 <span className="text-[color:var(--chart-1)]">지식</span>으로
        </h2>
        <p className="text-lg text-muted-foreground/80 max-w-2xl mx-auto">
          KCA-RAG의 4단계 핵심 프로세스
        </p>
      </div>

      {/* Desktop Timeline - Static */}
      <div className="hidden md:block max-w-6xl mx-auto px-6 relative z-10">
        <div className="relative">
          <div className="absolute top-8 left-0 right-0 h-1 rounded-full bg-gradient-to-r from-[color:var(--chart-1)] via-[color:var(--chart-2)] to-[color:var(--chart-3)]" />
          <div className="relative grid grid-cols-4 gap-8">
            {coreSteps.map((step, index) => {
              const Icon = step.icon
              const chartColor = `var(--chart-${step.colorVar})`
              return (
                <Link key={index} href={step.link} className="group flex flex-col items-center cursor-pointer">
                  <div className="relative z-10 w-16 h-16 rounded-2xl shadow-lg flex items-center justify-center bg-background dark:bg-card border border-border">
                    <Icon className="w-6 h-6" style={{ color: chartColor }} />
                  </div>
                  <div className="mt-8 text-center space-y-1">
                    <span className="block text-lg font-bold">{step.title}</span>
                    <span className="block text-xs font-mono text-muted-foreground uppercase tracking-widest">Step 0{index + 1}</span>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      </div>

      {/* Mobile Timeline - Static */}
      <div className="md:hidden max-w-sm mx-auto px-4 relative z-10">
        <div className="relative">
          <div className="absolute left-6 top-6 bottom-6 w-0.5 bg-gradient-to-b from-[color:var(--chart-1)] to-[color:var(--chart-3)] opacity-50" />
          <div className="space-y-8">
            {coreSteps.map((step, index) => {
              const Icon = step.icon
              const chartColor = `var(--chart-${step.colorVar})`
              return (
                <Link key={index} href={step.link} className="relative flex items-start gap-6 group">
                  <div className="relative z-10 w-12 h-12 rounded-xl flex items-center justify-center bg-background dark:bg-card border border-border shrink-0 shadow-sm">
                    <Icon className="w-5 h-5" style={{ color: chartColor }} />
                  </div>
                  <div className="flex-1 pt-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-lg">{step.title}</span>
                      <span className="text-xs font-mono text-muted-foreground">0{index + 1}</span>
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
  )
}
