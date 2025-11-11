"use client"

import Link from "next/link"
import {
  FileText,
  Network,
  ArrowRight,
  Upload,
  Brain,
  FileCode,
  Bot,
  MessageSquare,
  Link2,
  Database,
  CheckCircle,
  ChevronRight,
  Sparkles,
  Zap,
  Shield,
  TrendingUp,
  BrainCircuit
} from "lucide-react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { PageContainer } from "@/components/page-container"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { cn } from "@/lib/utils"
import { ChatPreview } from "@/components/chat-preview"
import { FloatingChatButton } from "@/components/floating-chat-button"

export default function HomePage() {

  const features = [
    {
      icon: FileText,
      title: "문서 변환",
      description: "PDF, DOCX, PPTX 파일을 AI로 분석하여 마크다운으로 변환",
      href: "/parse",
      color: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-100 dark:bg-blue-900/30",
      features: ["OCR 기능", "테이블 인식", "이미지 추출", "일괄 처리"]
    },
    {
      icon: Link2,
      title: "URL 기반 파싱",
      description: "웹 문서를 실시간으로 수집하고 구조화된 데이터로 변환",
      href: "/url-parse",
      color: "text-green-600 dark:text-green-400",
      bgColor: "bg-green-100 dark:bg-green-900/30",
      features: ["실시간 수집", "메타데이터 추출", "자동 업데이트"]
    },
    {
      icon: Database,
      title: "Qdrant Vector DB",
      description: "문서를 벡터 임베딩으로 변환하여 시맨틱 검색 지원",
      href: "/qdrant",
      color: "text-purple-600 dark:text-purple-400",
      bgColor: "bg-purple-100 dark:bg-purple-900/30",
      features: ["BGE-M3 임베딩", "시맨틱 검색", "유사도 매칭", "클러스터링"]
    },
    {
      icon: Network,
      title: "Dify 연동",
      description: "Dify AI 플랫폼과 통합하여 지식베이스 구축",
      href: "/dify",
      color: "text-orange-600 dark:text-orange-400",
      bgColor: "bg-orange-100 dark:bg-orange-900/30",
      features: ["API 통합", "데이터셋 관리", "버전 관리", "팀 협업"]
    },
  ]

  const processSteps = [
    {
      icon: FileCode,
      number: "01",
      title: "문서 파싱",
      description: "AI 기반으로 문서를 분석하여 마크다운으로 변환",
      details: "PDF, DOCX, PPTX 지원\nOCR 텍스트 추출\n테이블 구조 인식\n마크다운 변환",
      tech: "Docling Serve API (IBM)",
      status: "completed"
    },
    {
      icon: Database,
      number: "02",
      title: "벡터 임베딩",
      description: "BGE-M3 모델로 벡터화하여 Qdrant에 저장",
      details: "1024차원 벡터 생성\n다국어 지원\n의미적 유사도 계산\n실시간 인덱싱",
      tech: "BGE-M3 + Qdrant Vector DB",
      status: "active"
    },
    {
      icon: Bot,
      number: "03",
      title: "Dify 연동",
      description: "Dify 지식베이스에 문서 업로드 (선택)",
      details: "데이터셋 자동 분류\nAPI 통합\n버전 관리\n권한 설정",
      tech: "Dify Knowledge Base API",
      status: "pending"
    },
    {
      icon: MessageSquare,
      number: "04",
      title: "RAG 활용",
      description: "문서 기반 지능형 질의응답 시스템",
      details: "벡터 검색 + BGE Rerank\n컨텍스트 기반 응답\n출처 표시\n멀티턴 대화\n정확도 향상",
      tech: "RAG Pipeline + BGE Reranker",
      status: "pending"
    },
    {
      icon: Brain,
      number: "05",
      title: "멀티 LLM 지원",
      description: "다양한 LLM으로 최적의 답변 생성",
      details: "OpenAI GPT-4, GPT-4 Turbo, GPT-3.5\nNaver HyperCLOVA X\nLG EXAONE 3.0\nAnthropic Claude 3.5 Sonnet\nGoogle Gemini Pro\n모델별 특화 응답",
      tech: "Multi-LLM Integration",
      status: "pending"
    },
  ]

  const stats = [
    { icon: Zap, label: "처리 속도", value: "3초", unit: "/문서" },
    { icon: Shield, label: "정확도", value: "99.5", unit: "%" },
    { icon: TrendingUp, label: "처리량", value: "1000+", unit: "/일" },
    { icon: Sparkles, label: "AI 모델", value: "5", unit: "개" },
  ]

  return (
    <PageContainer maxWidth="wide">
      {/* Hero Section - 개선된 버전 */}
      <div className="text-center mb-16 space-y-8">
        <div className="inline-flex items-center gap-2 rounded-full px-4 py-2 bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 animate-fade-up">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">AI-Powered Document Intelligence</span>
        </div>

        <div className="space-y-6">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight animate-fade-up animate-delay-100">
            <span className="bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent">
              KCA-RAG
            </span>
            <span className="text-foreground"> 파이프라인</span>
          </h1>

          <p className="text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed px-4 animate-fade-up animate-delay-200">
            문서를 AI로 분석하고 벡터 데이터베이스에 저장하여
            <br className="hidden sm:block" />
            <span className="font-semibold text-foreground">초정밀 RAG 기반 질의응답 시스템</span>을 구축하세요
          </p>
        </div>

        {/* 통계 표시 */}
        <div className="grid grid-cols-2 sm:flex gap-4 sm:gap-8 justify-center flex-wrap mt-8 px-4">
          {stats.map((stat, index) => {
            const Icon = stat.icon
            return (
              <Link key={index} href="/qdrant">
                <div
                  className={`flex items-center gap-3 animate-scale-up animate-delay-${(index + 3) * 100} cursor-pointer group transition-all hover:scale-105`}
                >
                  <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                    <Icon className="w-4 h-4 text-primary group-hover:scale-110 transition-transform" />
                  </div>
                  <div className="text-left">
                    <div className="text-xl sm:text-2xl font-bold group-hover:text-primary transition-colors">
                      {stat.value}
                      <span className="text-xs sm:text-sm text-muted-foreground ml-1">{stat.unit}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">{stat.label}</div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Process Flow Diagram - 히어로 섹션 바로 아래 추가 */}
      <div className="mb-16 py-16 bg-gradient-to-b from-background via-muted/10 to-background relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] dark:bg-grid-slate-700/25 -z-10" />

        <div className="text-center mb-16 relative">
          <Badge variant="outline" className="mb-4 shadow-sm">
            <BrainCircuit className="w-3 h-3 mr-1" />
            전체 프로세스
          </Badge>
          <h2 className="text-4xl font-bold mb-4 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            문서에서 지식으로, 한눈에 보는 워크플로우
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            파싱부터 멀티 LLM까지 KCA-RAG의 5단계 프로세스
          </p>
        </div>

        {/* Desktop Flow Chart - 개선된 버전 */}
        <div className="hidden lg:block max-w-[1400px] mx-auto px-8">
          <div className="relative">
            {/* Animated connection lines */}
            <div className="absolute top-20 left-0 right-0 h-1 flex items-center gap-4 px-[4.5rem]">
              {[0, 1, 2, 3].map((index) => (
                <div key={index} className="flex-1 relative h-1 rounded-full overflow-hidden bg-blue-500">
                  {/* Arrow */}
                  <div className="absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-4 rotate-45 border-r-2 border-t-2 border-blue-500" />
                </div>
              ))}
            </div>

            {/* Process Cards - 개선된 3D 효과 */}
            <div className="relative grid grid-cols-5 gap-6 pt-4">
              {processSteps.map((step, index) => {
                const Icon = step.icon
                return (
                  <div
                    key={index}
                    className="group relative"
                  >
                    {/* Glow effect */}
                    <div className="absolute -inset-4 rounded-2xl bg-blue-500/20 opacity-75 blur-2xl -z-10" />

                    <Card className="relative h-full border-2 border-blue-500/60 bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/60 dark:to-blue-900/30 shadow-xl backdrop-blur-sm">
                      <CardHeader className="text-center p-4 items-center space-y-2">
                        {/* Step Number Badge */}
                        <div className="absolute -top-3 -right-3 z-10">
                          <div className="relative w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shadow-lg ring-2 ring-background bg-gradient-to-br from-blue-500 to-blue-600 text-white">
                            {step.number}
                          </div>
                        </div>

                        {/* Icon with better styling */}
                        <div className="relative w-16 h-16 rounded-xl flex items-center justify-center shadow-inner bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900/50 dark:to-blue-800/30">
                          <Icon className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                        </div>

                        {/* Title */}
                        <div className="space-y-1.5 flex flex-col items-center">
                          <CardTitle className="text-sm font-bold text-center leading-tight">
                            {step.title}
                          </CardTitle>

                          {/* Description */}
                          <p className="text-[0.7rem] text-muted-foreground text-center leading-snug px-1">
                            {step.description}
                          </p>

                          {/* Tech Badge */}
                          <Badge
                            variant="secondary"
                            className="text-[0.65rem] px-2 py-0.5 font-medium shadow-sm bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20"
                          >
                            {step.tech}
                          </Badge>
                        </div>
                      </CardHeader>
                    </Card>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Mobile/Tablet Flow - 개선된 버전 */}
        <div className="lg:hidden max-w-lg mx-auto px-4">
          <div className="relative">
            {/* Animated Vertical Connection Line */}
            <div className="absolute left-10 top-8 bottom-8 w-1 rounded-full overflow-hidden bg-muted">
              <div className="absolute top-0 left-0 right-0 h-full bg-gradient-to-b from-blue-500 to-blue-600" />
            </div>

            {/* Process Cards */}
            <div className="space-y-8">
              {processSteps.map((step, index) => {
                const Icon = step.icon
                return (
                  <div key={index} className="relative flex gap-5 items-start">
                    {/* Enhanced Step Circle */}
                    <div className="relative z-10 w-20 h-20 rounded-full flex items-center justify-center shrink-0 border-4 border-blue-500 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/20 shadow-lg ring-4 ring-background">
                      <Icon className="w-9 h-9 text-blue-600 dark:text-blue-400" />

                      {/* Step number */}
                      <div className="absolute -top-2 -right-2 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shadow-md bg-blue-500 text-white">
                        {step.number}
                      </div>
                    </div>

                    {/* Enhanced Content Card */}
                    <Card className="flex-1 border-2 border-blue-500/60 bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/60 dark:to-blue-900/30 shadow-md">
                      <CardHeader className="p-3 text-center space-y-2">
                        <div className="space-y-1">
                          <CardTitle className="text-base font-bold leading-tight">
                            {step.title}
                          </CardTitle>
                          <CardDescription className="text-[0.7rem] leading-snug">
                            {step.description}
                          </CardDescription>
                        </div>

                        {/* Tech Badge */}
                        <Badge
                          variant="secondary"
                          className="text-[0.65rem] px-2 py-0.5 font-medium shadow-sm mx-auto bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20"
                        >
                          {step.tech}
                        </Badge>
                      </CardHeader>
                    </Card>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

      </div>


      {/* AI 챗봇 섹션 - 새로 추가 */}
      <div className="mb-16">
        <div className="text-center mb-12">
          <Badge variant="outline" className="mb-4">
            <BrainCircuit className="w-3 h-3 mr-1" />
            AI Assistant
          </Badge>
          <h2 className="text-4xl font-bold mb-4">RAG 기반 AI 챗봇</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            업로드한 문서를 기반으로 정확한 답변을 제공하는 지능형 챗봇
          </p>
        </div>

        <div className="max-w-6xl mx-auto px-4 sm:px-0">
          <div className="grid lg:grid-cols-2 gap-8 items-center">
            {/* 왼쪽: 챗봇 미리보기 */}
            <div className="order-2 lg:order-1">
              <ChatPreview />
            </div>

            {/* 오른쪽: 특징 설명 */}
            <div className="order-1 lg:order-2 space-y-6 px-4 lg:px-0">
              <div className="space-y-4">
                <h3 className="text-2xl font-bold">똑똑한 문서 기반 대화</h3>
                <p className="text-muted-foreground">
                  KCA-RAG 챗봇은 업로드된 문서를 완벽하게 이해하고,
                  컨텍스트를 파악하여 정확한 답변을 제공합니다.
                </p>
              </div>

              {/* 챗봇 특징 리스트 */}
              <div className="space-y-4">
                <div className="flex gap-4 items-start">
                  <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                    <Database className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">벡터 검색 기반</h4>
                    <p className="text-sm text-muted-foreground">
                      Qdrant 벡터 DB를 활용한 시맨틱 검색으로 관련 문서를 정확히 찾습니다
                    </p>
                  </div>
                </div>

                <div className="flex gap-4 items-start">
                  <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                    <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">출처 명시</h4>
                    <p className="text-sm text-muted-foreground">
                      모든 답변에 정보의 출처 문서와 페이지를 함께 표시합니다
                    </p>
                  </div>
                </div>

                <div className="flex gap-4 items-start">
                  <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                    <Brain className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">컨텍스트 이해</h4>
                    <p className="text-sm text-muted-foreground">
                      대화 맥락을 기억하고 연속된 질문에도 자연스럽게 응답합니다
                    </p>
                  </div>
                </div>

                <div className="flex gap-4 items-start">
                  <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/30">
                    <Sparkles className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">실시간 응답</h4>
                    <p className="text-sm text-muted-foreground">
                      스트리밍 방식으로 빠르게 답변을 생성하고 표시합니다
                    </p>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>

      {/* Features - 개선된 카드 디자인 */}
      <div>
        <div className="text-center mb-12">
          <Badge variant="outline" className="mb-4">주요 기능</Badge>
          <h2 className="text-4xl font-bold mb-4">강력한 문서 처리 도구</h2>
          <p className="text-lg text-muted-foreground">
            엔터프라이즈급 문서 인텔리전스 플랫폼
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto px-4 sm:px-0">
          {features.map((feature) => {
            const Icon = feature.icon
            return (
              <Card key={feature.href} className="h-full border-2">
                <CardHeader>
                  <div className={cn(
                    "w-14 h-14 rounded-xl flex items-center justify-center mb-4",
                    feature.bgColor
                  )}>
                    <Icon className={cn("w-7 h-7", feature.color)} />
                  </div>
                  <CardTitle>
                    {feature.title}
                  </CardTitle>
                  <CardDescription className="mt-2">
                    {feature.description}
                  </CardDescription>
                  <div className="pt-4 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">주요 기능</p>
                    {feature.features.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm">
                        <CheckCircle className="w-3 h-3 text-green-600 dark:text-green-400" />
                        <span className="text-sm text-muted-foreground">{item}</span>
                      </div>
                    ))}
                  </div>
                </CardHeader>
              </Card>
            )
          })}
        </div>
      </div>

      {/* 플로팅 챗봇 버튼 */}
      <FloatingChatButton />
    </PageContainer>
  )
}