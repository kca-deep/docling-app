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
        {/* Background layers - z-0 to stay above layout bg-background */}
        <div className="absolute inset-0 z-0">
          {/* Solid background base */}
          <div className="absolute inset-0 bg-background" />
          {/* Gradient overlay - 다크모드에서 더 강한 그라데이션 */}
          <div className="absolute inset-0 bg-gradient-to-br from-[color:var(--chart-1)]/10 via-transparent to-[color:var(--chart-3)]/10 dark:from-[color:var(--chart-1)]/20 dark:via-[color:var(--chart-2)]/5 dark:to-[color:var(--chart-3)]/20" />
          {/* Radial glow effect - 다크모드에서 중앙 글로우 */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[color:var(--chart-1)]/5 via-transparent to-transparent dark:from-[color:var(--chart-1)]/10 dark:via-transparent dark:to-transparent" />
          {/* Dot pattern overlay - 다크모드에서 더 밝은 도트 */}
          <div
            className="absolute inset-0 opacity-30 dark:opacity-20"
            style={{
              backgroundImage: 'radial-gradient(circle, hsl(var(--muted-foreground) / 0.3) 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }}
          />
        </div>

        {/* 중앙 정렬된 컨텐츠 */}
        <div className="relative z-10 w-full max-w-7xl mx-auto px-6 md:px-8 lg:px-12 py-12 md:py-16 space-y-8">
          <div className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 bg-[color:var(--chart-1)]/10 border border-[color:var(--chart-1)]/20 backdrop-blur-sm">
            <Sparkles className="w-4 h-4 text-[color:var(--chart-1)]" />
            <span className="text-sm font-semibold text-[color:var(--chart-1)]">AI-Powered Document Intelligence</span>
          </div>

          <div className="space-y-6 mt-8">
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight">
              <span className="text-foreground">KCA-RAG 파이프라인</span>
            </h1>

            <p className="text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed px-4">
              문서를 AI로 분석하고 벡터 데이터베이스에 저장하여<br />
              초정밀 RAG 기반 질의응답 시스템을 구축하세요
            </p>
          </div>

          {/* CTA 버튼 */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mt-8">
            <Link href="/parse">
              <Button className="bg-[color:var(--chart-1)] hover:bg-[color:var(--chart-1)]/90 text-white">
                <Upload className="w-4 h-4 mr-2" />
                시작하기
              </Button>
            </Link>
            <Link href="/chat?fullscreen=true" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5">
              AI 챗봇 체험
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Inline Stats */}
          <div className="flex flex-wrap justify-center items-center gap-x-6 gap-y-2 pt-8 text-sm text-muted-foreground">
            {stats.map((stat, index) => {
              const Icon = stat.icon
              return (
                <div key={index} className="flex items-center gap-1.5">
                  <Icon className="w-4 h-4" />
                  <span className="font-medium text-foreground">{stat.value}{stat.unit}</span>
                  <span>{stat.label}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* 스크롤 인디케이터 */}
        <button
          onClick={() => {
            const processSection = document.getElementById('process-section')
            processSection?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 cursor-pointer opacity-40 hover:opacity-100 transition-opacity"
          aria-label="다음 섹션으로 스크롤"
        >
          <ChevronDown className="w-5 h-5 text-muted-foreground" />
        </button>
      </div>

      {/* Process Flow Timeline */}
      <div id="process-section" className="w-full py-16 bg-gradient-to-b from-background via-muted/10 to-background relative overflow-hidden">
        <div className="text-center mb-12 relative">
          <h2 className="text-3xl font-bold mb-3">
            문서에서 지식으로
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            KCA-RAG의 4단계 핵심 프로세스
          </p>
        </div>

        {/* Desktop Timeline */}
        <div className="hidden md:block max-w-5xl mx-auto px-6">
          <div className="relative">
            {/* Timeline connector line */}
            <div className="absolute top-6 left-0 right-0 h-0.5 bg-border" />

            {/* Timeline steps */}
            <div className="relative grid grid-cols-4 gap-4">
              {coreSteps.map((step, index) => {
                const Icon = step.icon
                const chartColor = `var(--chart-${step.colorVar})`
                return (
                  <HoverCard key={index} openDelay={100} closeDelay={100}>
                    <HoverCardTrigger asChild>
                      <Link href={step.link} className="group flex flex-col items-center cursor-pointer">
                        {/* Step circle */}
                        <div
                          className="relative z-10 w-12 h-12 rounded-full flex items-center justify-center border-2 bg-background transition-all group-hover:scale-110"
                          style={{ borderColor: chartColor }}
                        >
                          <Icon className="w-5 h-5" style={{ color: chartColor }} />
                        </div>
                        {/* Step title */}
                        <span className="mt-4 text-sm font-medium text-center">{step.title}</span>
                        {/* Step number */}
                        <span className="mt-1 text-xs text-muted-foreground">Step {index + 1}</span>
                      </Link>
                    </HoverCardTrigger>
                    <HoverCardContent className="w-64" side="bottom" align="center">
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">{step.description}</p>
                        <ul className="space-y-1">
                          {step.features.map((feature, i) => (
                            <li key={i} className="text-xs text-muted-foreground flex items-center gap-1.5">
                              <CheckCircle className="w-3 h-3" style={{ color: chartColor }} />
                              {feature}
                            </li>
                          ))}
                        </ul>
                        <div className="pt-2 border-t">
                          <span className="text-xs font-medium" style={{ color: chartColor }}>
                            {step.title} 바로가기 &rarr;
                          </span>
                        </div>
                      </div>
                    </HoverCardContent>
                  </HoverCard>
                )
              })}
            </div>
          </div>
        </div>

        {/* Mobile Timeline */}
        <div className="md:hidden max-w-sm mx-auto px-4">
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-6 top-6 bottom-6 w-0.5 bg-border" />

            {/* Steps */}
            <div className="space-y-6">
              {coreSteps.map((step, index) => {
                const Icon = step.icon
                const chartColor = `var(--chart-${step.colorVar})`
                return (
                  <Link
                    key={index}
                    href={step.link}
                    className="relative flex items-start gap-4 group"
                  >
                    {/* Step circle */}
                    <div
                      className="relative z-10 w-12 h-12 rounded-full flex items-center justify-center border-2 bg-background shrink-0 transition-all group-hover:scale-105"
                      style={{ borderColor: chartColor }}
                    >
                      <Icon className="w-5 h-5" style={{ color: chartColor }} />
                    </div>
                    {/* Content */}
                    <div className="flex-1 pt-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{step.title}</span>
                        <span className="text-xs text-muted-foreground">Step {index + 1}</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{step.description}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground mt-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 시스템 아키텍처 섹션 */}
      <PageContainer maxWidth="wide">
        <div className="mb-16">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold mb-3">시스템 인프라</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              RTX 5090 GPU 서버 기반 AI 서비스 아키텍처
            </p>
          </div>

          <Card className="border-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5" style={{ color: "var(--chart-5)" }} />
                시스템 아키텍처 다이어그램
              </CardTitle>
              <CardDescription>RTX 5090 GPU 서버의 전체 구성도</CardDescription>
            </CardHeader>
            <CardContent>
              {/* RTX 5090 전체 컨테이너 */}
              <div className="border-4 border-red-600/60 rounded-2xl p-6 bg-gradient-to-br from-red-500/10 to-red-600/5 relative">
                {/* RTX 5090 라벨 */}
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-background px-4 py-1 border-2 border-red-600 rounded-full">
                  <div className="flex items-center gap-2">
                    <Cpu className="h-5 w-5 text-red-600" />
                    <span className="font-bold text-base">NVIDIA RTX 5090</span>
                    <Badge variant="secondary" className="text-xs">32GB VRAM</Badge>
                  </div>
                </div>

                <Accordion type="multiple" defaultValue={["entry", "application"]} className="space-y-4 mt-4">
                  {/* Entry Points */}
                  <AccordionItem value="entry" className="border-2 border-purple-500/50 rounded-lg bg-purple-500/5 px-4 pb-2 overflow-visible">
                    <AccordionTrigger className="hover:no-underline py-4">
                      <div className="flex items-center gap-2">
                        <Globe className="h-5 w-5 text-purple-600" />
                        <span className="font-bold text-base text-purple-700 dark:text-purple-400">Entry Points</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          <div className="bg-background border-2 border-purple-500 rounded-lg p-4 text-center">
                            <Server className="h-7 w-7 mx-auto mb-2 text-purple-600" />
                            <p className="font-semibold text-sm mb-1">KCA-i RAG 파이프라인</p>
                            <Badge variant="secondary" className="text-xs">:3000</Badge>
                          </div>
                          <div className="bg-background border-2 border-purple-500 rounded-lg p-4 text-center">
                            <Globe className="h-7 w-7 mx-auto mb-2 text-purple-600" />
                            <p className="font-semibold text-sm mb-1">Dify Platform</p>
                            <Badge variant="secondary" className="text-xs">:3002</Badge>
                          </div>
                          <div className="bg-muted/20 border-2 rounded-lg p-4 text-center">
                            <MonitorPlay className="h-7 w-7 mx-auto mb-2 text-muted-foreground" />
                            <div className="flex items-center justify-center gap-2 mb-1">
                              <p className="font-semibold text-sm">Open WebUI</p>
                              <Badge variant="outline" className="text-xs">Inactive</Badge>
                            </div>
                            <Badge variant="secondary" className="text-xs">:3001</Badge>
                          </div>
                        </div>

                        {/* Direct LLM API with expandable details */}
                        <Collapsible defaultOpen className="max-w-full mx-auto">
                          <div className="bg-background border-2 border-purple-500 rounded-lg overflow-hidden">
                            <div className="flex items-center justify-between p-4">
                              <div className="flex items-center gap-4 flex-1">
                                <Network className="h-7 w-7 text-purple-600" />
                                <div className="text-left">
                                  <p className="font-semibold text-sm mb-1">Direct LLM API</p>
                                </div>
                                <Badge variant="secondary" className="text-xs">:808X</Badge>
                              </div>
                              <CollapsibleTrigger asChild>
                                <button className="p-2 hover:bg-muted rounded-md transition-colors">
                                  <ChevronDown className="h-5 w-5 transition-transform duration-200 data-[state=open]:rotate-180" />
                                </button>
                              </CollapsibleTrigger>
                            </div>

                            <CollapsibleContent>
                              <div className="border-t-2 border-purple-500/30 p-4 bg-purple-500/5">
                                <h4 className="font-bold text-sm mb-3 text-purple-700 dark:text-purple-400">LLM 모델 서비스 상세</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                  <div className="border-2 border-green-500/50 rounded-lg p-3 bg-green-500/5">
                                    <div className="flex items-center justify-between mb-2">
                                      <p className="font-semibold text-sm">GPT-OSS 20B</p>
                                      <Badge className="bg-green-500 text-xs">Running</Badge>
                                    </div>
                                    <div className="flex flex-wrap gap-1 mb-2">
                                      <Badge variant="outline" className="text-xs">US</Badge>
                                      <Badge variant="secondary" className="text-xs">일반 대화</Badge>
                                    </div>
                                    <div className="space-y-1 text-xs text-muted-foreground">
                                      <p>포트: 8080 | VRAM: ~16GB</p>
                                    </div>
                                  </div>

                                  <div className="border-2 rounded-lg p-3 bg-muted/20">
                                    <div className="flex items-center justify-between mb-2">
                                      <p className="font-semibold text-sm">EXAONE 32B</p>
                                      <Badge variant="outline" className="text-xs">Inactive</Badge>
                                    </div>
                                    <div className="flex flex-wrap gap-1 mb-2">
                                      <Badge variant="outline" className="text-xs">KR</Badge>
                                      <Badge variant="secondary" className="text-xs">긴 문서</Badge>
                                    </div>
                                    <div className="space-y-1 text-xs text-muted-foreground">
                                      <p>포트: 8081 | 131K ctx</p>
                                    </div>
                                  </div>

                                  <div className="border-2 rounded-lg p-3 bg-muted/20">
                                    <div className="flex items-center justify-between mb-2">
                                      <p className="font-semibold text-sm">HyperCLOVA X</p>
                                      <Badge variant="outline" className="text-xs">Inactive</Badge>
                                    </div>
                                    <div className="flex flex-wrap gap-1 mb-2">
                                      <Badge variant="outline" className="text-xs">KR</Badge>
                                      <Badge variant="secondary" className="text-xs">한국어</Badge>
                                    </div>
                                    <div className="space-y-1 text-xs text-muted-foreground">
                                      <p>포트: 8082 | ~29GB</p>
                                    </div>
                                  </div>

                                  <div className="border-2 border-green-500/50 rounded-lg p-3 bg-green-500/5">
                                    <div className="flex items-center justify-between mb-2">
                                      <p className="font-semibold text-sm">Qwen3-VL 8B</p>
                                      <Badge className="bg-green-500 text-xs">Running</Badge>
                                    </div>
                                    <div className="flex flex-wrap gap-1 mb-2">
                                      <Badge variant="outline" className="text-xs">CN</Badge>
                                      <Badge variant="secondary" className="text-xs">OCR</Badge>
                                    </div>
                                    <div className="space-y-1 text-xs text-muted-foreground">
                                      <p>포트: 8084 | Vision</p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </CollapsibleContent>
                          </div>
                        </Collapsible>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* Application Layer */}
                  <AccordionItem value="application" className="border-2 border-blue-500/50 rounded-lg bg-blue-500/5 px-4 pb-2 overflow-visible">
                    <AccordionTrigger className="hover:no-underline py-4">
                      <div className="flex items-center gap-2">
                        <Server className="h-5 w-5 text-blue-600" />
                        <span className="font-bold text-base text-blue-700 dark:text-blue-400">Application Layer</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div>
                        {/* AI Services - 지원 서비스 상세 카드 */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                          <div className="border-2 border-orange-500/50 rounded-lg p-4 bg-orange-500/5">
                            <div className="flex items-center justify-between mb-3">
                              <p className="font-semibold text-sm">BGE-M3 Embedding</p>
                              <Badge className="bg-green-500 text-xs">Running</Badge>
                            </div>
                            <div className="space-y-1 text-xs text-muted-foreground">
                              <p>포트: 8083</p>
                              <p>VRAM: &lt;1GB</p>
                              <p>용도: 벡터 임베딩</p>
                            </div>
                          </div>

                          <div className="border-2 border-orange-500/50 rounded-lg p-4 bg-orange-500/5">
                            <div className="flex items-center justify-between mb-3">
                              <p className="font-semibold text-sm">BGE Reranker</p>
                              <Badge className="bg-green-500 text-xs">Running</Badge>
                            </div>
                            <div className="space-y-1 text-xs text-muted-foreground">
                              <p>포트: 8006</p>
                              <p>VRAM: ~1-2GB</p>
                              <p>용도: 검색 재정렬</p>
                            </div>
                          </div>

                          <div className="border-2 border-orange-500/50 rounded-lg p-4 bg-orange-500/5">
                            <div className="flex items-center justify-between mb-3">
                              <p className="font-semibold text-sm">Docling API</p>
                              <Badge className="bg-green-500 text-xs">Running</Badge>
                            </div>
                            <div className="space-y-1 text-xs text-muted-foreground">
                              <p>포트: 8007</p>
                              <p>기술: Python</p>
                              <p>기능: 문서 변환</p>
                            </div>
                          </div>

                          <div className="border-2 border-orange-500/50 rounded-lg p-4 bg-orange-500/5">
                            <div className="flex items-center justify-between mb-3">
                              <p className="font-semibold text-sm">Qdrant Vector DB</p>
                              <Badge className="bg-green-500 text-xs">Running</Badge>
                            </div>
                            <div className="space-y-1 text-xs text-muted-foreground">
                              <p>포트: 6333</p>
                              <p>기술: Vector DB</p>
                              <p>기능: 벡터 저장소</p>
                            </div>
                          </div>
                        </div>
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