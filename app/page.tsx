"use client"

import Link from "next/link"
import {
  ArrowRight,
  Upload,
  FileCode,
  Bot,
  Database,
  CheckCircle,
  Sparkles,
  Zap,
  Shield,
  TrendingUp,
  ChevronDown,
  BarChart3,
  Server,
  Cpu,
  Network,
  Globe,
  MonitorPlay,
} from "lucide-react"
import { motion } from "framer-motion"
import { PageContainer } from "@/components/page-container"
import { Button } from "@/components/ui/button"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { FloatingChatButton } from "@/components/floating-chat-button"

export default function HomePage() {
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

  const stats = [
    { icon: Zap, label: "처리 속도", value: "3초", unit: "/문서" },
    { icon: Shield, label: "정확도", value: "99.5", unit: "%" },
    { icon: TrendingUp, label: "처리량", value: "1000+", unit: "/일" },
    { icon: Sparkles, label: "AI 모델", value: "4", unit: "개" },
  ]

  return (
    <>
      {/* Hero Section */}
      <div className="relative w-full text-center min-h-[calc(100vh-4rem)] lg:min-h-[85vh] flex flex-col justify-center overflow-hidden">
        {/* Background layers */}
        <div className="absolute inset-0 z-0">
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
              className="absolute -top-[50%] -left-[50%] w-[200%] h-[200%] bg-[radial-gradient(circle_farthest-corner_at_center,var(--chart-1)_0%,transparent_50%)] opacity-20 dark:opacity-30 blur-[100px]"
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
              className="absolute -bottom-[50%] -right-[50%] w-[200%] h-[200%] bg-[radial-gradient(circle_farthest-corner_at_center,var(--chart-3)_0%,transparent_50%)] opacity-20 dark:opacity-30 blur-[100px]"
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
            <div className="absolute top-8 left-0 right-0 h-1 rounded-full bg-border/30 overflow-hidden">
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
                            className="relative z-10 w-16 h-16 rounded-2xl rotate-45 group-hover:rotate-0 transition-all duration-500 shadow-lg flex items-center justify-center bg-background border border-border/50 group-hover:border-[color:var(--chart-1)]/50 group-hover:shadow-[color:var(--chart-1)]/30"
                          >
                            <div className="absolute inset-1 rounded-xl bg-muted/20 group-hover:bg-[color:var(--chart-1)]/10 transition-colors -rotate-45 group-hover:rotate-0 duration-500" />
                            <Icon className="w-6 h-6 -rotate-45 group-hover:rotate-0 transition-all duration-500" style={{ color: chartColor }} />
                          </div>
                          {/* Step title */}
                          <div className="mt-8 text-center space-y-1">
                            <span className="block text-lg font-bold group-hover:text-[color:var(--chart-1)] transition-colors">{step.title}</span>
                            <span className="block text-xs font-mono text-muted-foreground/60 uppercase tracking-widest">Step 0{index + 1}</span>
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
            <div className="absolute left-6 top-6 bottom-6 w-0.5 bg-gradient-to-b from-[color:var(--chart-1)] to-[color:var(--chart-3)] opacity-30" />

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
                      className="relative z-10 w-12 h-12 rounded-xl flex items-center justify-center bg-background border border-border shrink-0 shadow-sm group-hover:scale-110 transition-transform"
                    >
                      <Icon className="w-5 h-5" style={{ color: chartColor }} />
                    </div>
                    {/* Content */}
                    <div className="flex-1 pt-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-lg">{step.title}</span>
                        <span className="text-xs font-mono text-muted-foreground/60">0{index + 1}</span>
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
      <PageContainer maxWidth="wide">
        <div className="mb-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">시스템 인프라</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg text-balance">
              RTX 5090 GPU 서버 기반 AI 서비스 아키텍처
            </p>
          </motion.div>

          <Card className="border-0 shadow-2xl overflow-hidden glass">
            <CardHeader className="bg-muted/10 border-b border-border/40 pb-6">
              <CardTitle className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-[color:var(--chart-5)]/10 text-[color:var(--chart-5)]">
                  <Server className="h-6 w-6" />
                </div>
                <div>
                  <span className="block text-xl">System Architecture</span>
                  <span className="block text-sm font-normal text-muted-foreground mt-1">H/W & S/W Composition</span>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8 bg-gradient-to-b from-background/50 to-muted/20">
              {/* RTX 5090 전체 컨테이너 */}
              <div className="border border-red-500/20 rounded-3xl p-8 bg-gradient-to-br from-red-500/5 to-transparent relative shadow-sm">
                {/* RTX 5090 라벨 */}
                <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-background/80 backdrop-blur-md px-6 py-2 border border-red-500/30 rounded-full shadow-lg flex items-center gap-3">
                  <Cpu className="h-5 w-5 text-red-500" />
                  <span className="font-bold text-base bg-clip-text text-transparent bg-gradient-to-r from-red-500 to-orange-500">NVIDIA RTX 5090</span>
                  <div className="h-4 w-px bg-border/50" />
                  <span className="text-xs font-mono text-muted-foreground">32GB VRAM</span>
                </div>

                <Accordion type="multiple" defaultValue={["entry", "application"]} className="space-y-6 mt-6">
                  {/* Entry Points */}
                  <AccordionItem value="entry" className="border-0 bg-background/50 backdrop-blur-sm rounded-2xl overflow-hidden shadow-sm">
                    <AccordionTrigger className="hover:no-underline px-6 py-5 bg-purple-500/5 hover:bg-purple-500/10 transition-colors">
                      <div className="flex items-center gap-3">
                        <Globe className="h-5 w-5 text-purple-600" />
                        <span className="font-bold text-lg text-purple-700 dark:text-purple-400">Entry Points</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-6 py-6">
                      <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          <motion.div whileHover={{ y: -4 }} className="bg-background border border-purple-200 dark:border-purple-800 rounded-xl p-6 text-center shadow-sm hover:shadow-md transition-all">
                            <Server className="h-8 w-8 mx-auto mb-3 text-purple-600" />
                            <p className="font-bold mb-2">KCA-RAG Pipeline</p>
                            <Badge variant="secondary" className="font-mono">:3000</Badge>
                          </motion.div>
                          <motion.div whileHover={{ y: -4 }} className="bg-background border border-purple-200 dark:border-purple-800 rounded-xl p-6 text-center shadow-sm hover:shadow-md transition-all">
                            <Globe className="h-8 w-8 mx-auto mb-3 text-purple-600" />
                            <p className="font-bold mb-2">Dify Platform</p>
                            <Badge variant="secondary" className="font-mono">:3002</Badge>
                          </motion.div>
                          <div className="bg-muted/40 border border-border/50 rounded-xl p-6 text-center opacity-70">
                            <MonitorPlay className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
                            <p className="font-semibold mb-2">Open WebUI</p>
                            <Badge variant="outline" className="text-[10px]">Inactive</Badge>
                          </div>
                        </div>

                        {/* Direct LLM API */}
                        <Collapsible defaultOpen className="w-full">
                          <div className="bg-background border border-purple-200 dark:border-purple-800 rounded-xl overflow-hidden shadow-sm">
                            <div className="flex items-center justify-between p-4 bg-muted/5">
                              <div className="flex items-center gap-4 flex-1">
                                <Network className="h-6 w-6 text-purple-600" />
                                <div className="text-left">
                                  <p className="font-bold">Direct LLM API</p>
                                </div>
                                <Badge variant="secondary" className="font-mono text-xs">:808X</Badge>
                              </div>
                              <CollapsibleTrigger asChild>
                                <button className="p-2 hover:bg-muted/50 rounded-full transition-colors">
                                  <ChevronDown className="h-5 w-5 transition-transform duration-200 data-[state=open]:rotate-180" />
                                </button>
                              </CollapsibleTrigger>
                            </div>

                            <CollapsibleContent>
                              <div className="border-t border-purple-100 dark:border-purple-900 p-5 bg-purple-50/30 dark:bg-purple-900/10">
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                  {/* Model Cards */}
                                  {[
                                    { name: "GPT-OSS 20B", status: "Running", badge: "US", type: "Chat", port: "8080", vram: "16GB", active: true },
                                    { name: "Qwen3-VL 8B", status: "Running", badge: "CN", type: "OCR", port: "8084", vram: "Vision", active: true },
                                    { name: "EXAONE 32B", status: "Inactive", badge: "KR", type: "Long", port: "8081", vram: "131K", active: false },
                                    { name: "HyperCLOVA X", status: "Inactive", badge: "KR", type: "Chat", port: "8082", vram: "29GB", active: false },
                                  ].map((model, i) => (
                                    <div key={i} className={`border rounded-lg p-3 ${model.active ? 'bg-background border-green-200 dark:border-green-900' : 'bg-muted/30 border-border/50'}`}>
                                      <div className="flex items-center justify-between mb-2">
                                        <p className="font-bold text-sm truncate pr-2">{model.name}</p>
                                        <div className={`w-2 h-2 rounded-full ${model.active ? 'bg-green-500 animate-pulse' : 'bg-muted-foreground'}`} />
                                      </div>
                                      <div className="flex flex-wrap gap-1 mb-2">
                                        <Badge variant="outline" className="text-[10px] h-5 px-1">{model.badge}</Badge>
                                        <Badge variant="secondary" className="text-[10px] h-5 px-1">{model.type}</Badge>
                                      </div>
                                      <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                                        <span>:{model.port}</span>
                                        <span>{model.vram}</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </CollapsibleContent>
                          </div>
                        </Collapsible>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* Application Layer */}
                  <AccordionItem value="application" className="border-0 bg-background/50 backdrop-blur-sm rounded-2xl overflow-hidden shadow-sm">
                    <AccordionTrigger className="hover:no-underline px-6 py-5 bg-blue-500/5 hover:bg-blue-500/10 transition-colors">
                      <div className="flex items-center gap-3">
                        <Server className="h-5 w-5 text-blue-600" />
                        <span className="font-bold text-lg text-blue-700 dark:text-blue-400">Application Layer</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-6 py-6">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {[
                          { name: "BGE-M3 Embedding", port: "8083", type: "Vector", color: "orange" },
                          { name: "BGE Reranker", port: "8006", type: "Rerank", color: "orange" },
                          { name: "Docling API", port: "8007", type: "Python", color: "blue" },
                          { name: "Qdrant Vector DB", port: "6333", type: "DB", color: "green" },
                        ].map((svc, i) => (
                          <motion.div whileHover={{ scale: 1.02 }} key={i} className="bg-background border border-border/60 rounded-xl p-4 shadow-sm hover:shadow-md transition-all">
                            <div className="flex items-center justify-between mb-3">
                              <p className="font-bold text-sm truncate">{svc.name}</p>
                              <Badge className="bg-green-500 hover:bg-green-600 text-[10px] h-5">ON</Badge>
                            </div>
                            <div className="space-y-1 text-xs text-muted-foreground font-mono">
                              <p>Port: {svc.port}</p>
                              <p>Type: {svc.type}</p>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            </CardContent>
          </Card>
        </div>
      </PageContainer>

      {/* 플로팅 챗봇 버튼 */}
      <FloatingChatButton />
    </>
  )
}