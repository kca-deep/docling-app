"use client"

import Link from "next/link"
import {
  ArrowRight,
  Upload,
  FileCode,
  Bot,
  MessageSquare,
  Database,
  CheckCircle,
  Sparkles,
  Zap,
  Shield,
  TrendingUp,
  ChevronDown,
  BarChart3,
} from "lucide-react"
import { PageContainer } from "@/components/page-container"
import { Button } from "@/components/ui/button"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
import { ChatPreview } from "@/components/chat-preview"
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
    { icon: Sparkles, label: "AI 모델", value: "5", unit: "개" },
  ]

  return (
    <>
      {/* Hero Section - 전체 너비 배경 */}
      <div className="relative w-full text-center min-h-[calc(100vh-4rem)] lg:min-h-[85vh] flex flex-col justify-center overflow-hidden">
        {/* Simplified Background Gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-[color:var(--chart-1)]/5 via-background to-[color:var(--chart-3)]/5 -z-10" />

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

      {/* 나머지 섹션들은 PageContainer로 감싸기 */}
      <PageContainer maxWidth="wide">
      {/* AI 챗봇 섹션 - Compact */}
      <div className="mb-16">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold mb-3">RAG 기반 AI 챗봇</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            업로드한 문서를 기반으로 정확한 답변을 제공하는 지능형 챗봇
          </p>
        </div>

        <div className="max-w-6xl mx-auto px-4 sm:px-0">
          <div className="grid lg:grid-cols-2 gap-8 items-center">
            {/* 왼쪽: 챗봇 미리보기 */}
            <div className="order-2 lg:order-1">
              <ChatPreview />
            </div>

            {/* 오른쪽: 특징 설명 - Reduced to 3 items */}
            <div className="order-1 lg:order-2 space-y-6 px-4 lg:px-0">
              <div className="space-y-3">
                <h3 className="text-xl font-bold">똑똑한 문서 기반 대화</h3>
                <p className="text-muted-foreground">
                  KCA-RAG 챗봇은 업로드된 문서를 완벽하게 이해하고,
                  컨텍스트를 파악하여 정확한 답변을 제공합니다.
                </p>
              </div>

              {/* 챗봇 특징 리스트 - Reduced to 3 */}
              <div className="space-y-4">
                <div className="flex gap-3 items-start">
                  <div className="p-2 rounded-lg bg-[color:var(--chart-1)]/10">
                    <Database className="w-5 h-5 text-[color:var(--chart-1)]" />
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">벡터 검색 기반</h4>
                    <p className="text-sm text-muted-foreground">
                      시맨틱 검색으로 관련 문서를 정확히 찾습니다
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 items-start">
                  <div className="p-2 rounded-lg bg-[color:var(--chart-2)]/10">
                    <CheckCircle className="w-5 h-5 text-[color:var(--chart-2)]" />
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">출처 명시</h4>
                    <p className="text-sm text-muted-foreground">
                      모든 답변에 출처 문서와 페이지를 표시합니다
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 items-start">
                  <div className="p-2 rounded-lg bg-[color:var(--chart-3)]/10">
                    <Sparkles className="w-5 h-5 text-[color:var(--chart-3)]" />
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">실시간 스트리밍</h4>
                    <p className="text-sm text-muted-foreground">
                      빠르게 답변을 생성하고 표시합니다
                    </p>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>

      </PageContainer>

      {/* 플로팅 챗봇 버튼 */}
      <FloatingChatButton />
    </>
  )
}