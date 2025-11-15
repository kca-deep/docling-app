"use client"

import { useState } from "react"
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
  BrainCircuit,
  ExternalLink,
  ChevronDown
} from "lucide-react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { PageContainer } from "@/components/page-container"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { ChatPreview } from "@/components/chat-preview"
import { FloatingChatButton } from "@/components/floating-chat-button"
import { AnimatedGradientBg } from "@/components/animated-gradient-bg"
import { TypingEffect } from "@/components/typing-effect"
import { FloatingIcons } from "@/components/floating-icons"

export default function HomePage() {
  const [selectedStep, setSelectedStep] = useState<number | null>(null)

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
      status: "completed",
      color: "blue",
      gradient: "from-blue-500 to-blue-600",
      borderColor: "border-blue-500/60",
      bgGradient: "from-blue-50 to-blue-100/50 dark:from-blue-950/60 dark:to-blue-900/30",
      glowColor: "bg-blue-500/20",
      iconBg: "from-blue-100 to-blue-200 dark:from-blue-900/50 dark:to-blue-800/30",
      iconColor: "text-blue-600 dark:text-blue-400",
      badgeBg: "bg-blue-500/10",
      badgeText: "text-blue-700 dark:text-blue-400",
      badgeBorder: "border-blue-500/20",
      detailedDescription: "Docling Serve API를 활용하여 PDF, DOCX, PPTX 등 다양한 문서 형식을 지능적으로 파싱합니다. IBM의 최신 AI 기술로 문서 구조를 정확하게 분석하고, OCR을 통해 이미지 내 텍스트까지 추출합니다.",
      features: [
        "다양한 문서 형식 지원 (PDF, DOCX, PPTX)",
        "고급 OCR 기능으로 이미지 텍스트 추출",
        "복잡한 테이블 구조 자동 인식 및 변환",
        "마크다운 형식으로 깔끔하게 변환",
        "문서 메타데이터 자동 추출",
        "비동기 처리로 대용량 문서 처리 가능"
      ],
      link: "/parse"
    },
    {
      icon: Database,
      number: "02",
      title: "벡터 임베딩",
      description: "BGE-M3 모델로 벡터화하여 Qdrant에 저장",
      details: "1024차원 벡터 생성\n다국어 지원\n의미적 유사도 계산\n실시간 인덱싱",
      tech: "BGE-M3 + Qdrant Vector DB",
      status: "active",
      color: "purple",
      gradient: "from-purple-500 to-purple-600",
      borderColor: "border-purple-500/60",
      bgGradient: "from-purple-50 to-purple-100/50 dark:from-purple-950/60 dark:to-purple-900/30",
      glowColor: "bg-purple-500/20",
      iconBg: "from-purple-100 to-purple-200 dark:from-purple-900/50 dark:to-purple-800/30",
      iconColor: "text-purple-600 dark:text-purple-400",
      badgeBg: "bg-purple-500/10",
      badgeText: "text-purple-700 dark:text-purple-400",
      badgeBorder: "border-purple-500/20",
      detailedDescription: "BGE-M3 임베딩 모델을 사용하여 문서를 1024차원의 벡터로 변환하고, Qdrant 벡터 데이터베이스에 저장합니다. 의미적 유사도 기반 검색을 통해 관련 문서를 빠르고 정확하게 찾아냅니다.",
      features: [
        "BGE-M3 모델로 고품질 임베딩 생성",
        "1024차원 벡터로 의미 정보 압축",
        "한국어/영어 등 다국어 지원",
        "Qdrant를 활용한 고속 벡터 검색",
        "실시간 인덱싱 및 업데이트",
        "의미적 유사도 기반 정확한 검색"
      ],
      link: "/upload?tab=qdrant"
    },
    {
      icon: Bot,
      number: "03",
      title: "Dify 연동",
      description: "Dify 지식베이스에 문서 업로드 (선택)",
      details: "데이터셋 자동 분류\nAPI 통합\n버전 관리\n권한 설정",
      tech: "Dify Knowledge Base API",
      status: "pending",
      color: "orange",
      gradient: "from-orange-500 to-orange-600",
      borderColor: "border-orange-500/60",
      bgGradient: "from-orange-50 to-orange-100/50 dark:from-orange-950/60 dark:to-orange-900/30",
      glowColor: "bg-orange-500/20",
      iconBg: "from-orange-100 to-orange-200 dark:from-orange-900/50 dark:to-orange-800/30",
      iconColor: "text-orange-600 dark:text-orange-400",
      badgeBg: "bg-orange-500/10",
      badgeText: "text-orange-700 dark:text-orange-400",
      badgeBorder: "border-orange-500/20",
      detailedDescription: "Dify AI 플랫폼과 통합하여 파싱된 문서를 지식베이스에 업로드합니다. 팀 협업과 버전 관리를 지원하며, Dify의 강력한 RAG 기능을 활용할 수 있습니다.",
      features: [
        "Dify 플랫폼 완벽 연동",
        "데이터셋 자동 분류 및 관리",
        "REST API 기반 안정적 통합",
        "문서 버전 관리",
        "팀 단위 권한 설정",
        "다중 프로젝트 지원"
      ],
      link: "/upload?tab=dify"
    },
    {
      icon: MessageSquare,
      number: "04",
      title: "RAG 활용",
      description: "문서 기반 지능형 질의응답 시스템",
      details: "벡터 검색 + BGE Rerank\n컨텍스트 기반 응답\n출처 표시\n멀티턴 대화\n정확도 향상",
      tech: "RAG Pipeline + BGE Reranker",
      status: "pending",
      color: "green",
      gradient: "from-green-500 to-green-600",
      borderColor: "border-green-500/60",
      bgGradient: "from-green-50 to-green-100/50 dark:from-green-950/60 dark:to-green-900/30",
      glowColor: "bg-green-500/20",
      iconBg: "from-green-100 to-green-200 dark:from-green-900/50 dark:to-green-800/30",
      iconColor: "text-green-600 dark:text-green-400",
      badgeBg: "bg-green-500/10",
      badgeText: "text-green-700 dark:text-green-400",
      badgeBorder: "border-green-500/20",
      detailedDescription: "RAG(Retrieval-Augmented Generation) 파이프라인을 통해 문서 기반 질의응답 시스템을 제공합니다. BGE Reranker로 검색 정확도를 극대화하고, 출처를 명확히 표시합니다.",
      features: [
        "벡터 검색 + BGE Reranker 2단계 검색",
        "컨텍스트 기반 정확한 응답",
        "출처 문서 및 페이지 번호 표시",
        "멀티턴 대화 지원",
        "스트리밍 응답으로 빠른 피드백",
        "검색 정확도 향상 (Reranking)"
      ],
      link: "/chat"
    },
    {
      icon: Brain,
      number: "05",
      title: "멀티 LLM 지원",
      description: "다양한 LLM으로 최적의 답변 생성",
      details: "OpenAI GPT-4, GPT-4 Turbo, GPT-3.5\nNaver HyperCLOVA X\nLG EXAONE 3.0\nAnthropic Claude 3.5 Sonnet\nGoogle Gemini Pro\n모델별 특화 응답",
      tech: "Multi-LLM Integration",
      status: "pending",
      color: "rose",
      gradient: "from-rose-500 to-rose-600",
      borderColor: "border-rose-500/60",
      bgGradient: "from-rose-50 to-rose-100/50 dark:from-rose-950/60 dark:to-rose-900/30",
      glowColor: "bg-rose-500/20",
      iconBg: "from-rose-100 to-rose-200 dark:from-rose-900/50 dark:to-rose-800/30",
      iconColor: "text-rose-600 dark:text-rose-400",
      badgeBg: "bg-rose-500/10",
      badgeText: "text-rose-700 dark:text-rose-400",
      badgeBorder: "border-rose-500/20",
      detailedDescription: "OpenAI GPT-4, Naver HyperCLOVA X, LG EXAONE 등 다양한 LLM을 지원합니다. 각 모델의 특성에 맞춰 최적의 응답을 생성하며, 모델 간 전환이 자유롭습니다.",
      features: [
        "OpenAI GPT-4, GPT-4 Turbo 지원",
        "Naver HyperCLOVA X (한국어 특화)",
        "LG EXAONE 3.0 (131K 컨텍스트)",
        "Anthropic Claude 3.5 Sonnet",
        "Google Gemini Pro",
        "모델별 특화된 응답 생성"
      ],
      link: "/chat"
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
        {/* Animated Background - 전체 화면 */}
        <AnimatedGradientBg />
        <FloatingIcons />

        {/* 중앙 정렬된 컨텐츠 */}
        <div className="relative z-10 w-full max-w-7xl mx-auto px-6 md:px-8 lg:px-12 py-12 md:py-16 space-y-8">
          <div className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 bg-gradient-to-r from-primary/20 via-primary/10 to-primary/5 border-2 border-primary/30 shadow-lg backdrop-blur-sm animate-fade-up">
            <Sparkles className="w-4 h-4 text-primary animate-pulse" />
            <span className="text-sm font-semibold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">AI-Powered Document Intelligence</span>
          </div>

          <div className="space-y-6 mt-8">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight animate-fade-up animate-delay-100">
              <span className="bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent">
                KCA-RAG
              </span>
              <span className="text-foreground"> 파이프라인</span>
            </h1>

            <div className="text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed px-4 animate-fade-up animate-delay-200 flex flex-col items-center gap-1">
              <TypingEffect
                text="문서를 AI로 분석하고 벡터 데이터베이스에 저장하여"
                speed={50}
              />
              <TypingEffect
                text="초정밀 RAG 기반 질의응답 시스템을 구축하세요"
                speed={50}
                delay={1550}
              />
            </div>
          </div>

          {/* CTA 버튼 */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mt-8 animate-fade-up animate-delay-300">
            <Link href="/parse">
              <Button size="lg" className="bg-gradient-to-r from-primary to-primary/80 text-white shadow-lg hover:shadow-xl transition-all hover:scale-105 px-8">
                <Upload className="w-5 h-5 mr-2" />
                지금 시작하기
              </Button>
            </Link>
            <Link href="/chat">
              <Button size="lg" variant="outline" className="border-2 hover:bg-primary/5 transition-all hover:scale-105 px-8">
                <MessageSquare className="w-5 h-5 mr-2" />
                AI 챗봇 체험
              </Button>
            </Link>
          </div>

          {/* 통계 표시 */}
          <div className="relative z-10 grid grid-cols-2 sm:flex gap-4 sm:gap-8 justify-center flex-wrap mt-12 px-4">
            {stats.map((stat, index) => {
              const Icon = stat.icon
              return (
                <div
                  key={index}
                  className={`flex items-center gap-3 animate-scale-up animate-delay-${(index + 4) * 100}`}
                >
                  <div className="p-2 rounded-lg bg-primary/10 transition-colors">
                    <Icon className="w-4 h-4 text-primary transition-transform" />
                  </div>
                  <div className="text-left">
                    <div className="text-xl sm:text-2xl font-bold">
                      {stat.value}
                      <span className="text-xs sm:text-sm text-muted-foreground ml-1">{stat.unit}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">{stat.label}</div>
                  </div>
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
          className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce z-10 cursor-pointer hover:scale-110 transition-transform"
          aria-label="다음 섹션으로 스크롤"
        >
          <ChevronDown className="w-6 h-6 text-muted-foreground/60" />
        </button>
      </div>

      {/* Process Flow Diagram - 전체 너비 배경 */}
      <div id="process-section" className="w-full py-16 bg-gradient-to-b from-background via-muted/10 to-background relative overflow-hidden">
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

        {/* Desktop Flow Chart - 밸런스 개선 버전 */}
        <div className="hidden lg:block max-w-[1400px] mx-auto px-6 md:px-8 lg:px-12">
          <div className="relative pb-16">
            {/* Process Cards - 인터랙티브 3D 효과 */}
            <div className="relative grid grid-cols-5 gap-8 z-0">
              {processSteps.map((step, index) => {
                const Icon = step.icon
                return (
                  <Dialog key={index}>
                    <DialogTrigger asChild>
                      <div
                        className="group relative cursor-pointer transform transition-all duration-300 hover:scale-105 hover:-translate-y-2"
                        style={{
                          animation: `fade-up 0.6s ease-out`,
                          animationDelay: `${index * 100}ms`,
                          animationFillMode: 'both'
                        }}
                      >
                        {/* Glow effect - enhanced on hover */}
                        <div className={cn("absolute -inset-4 rounded-2xl opacity-50 blur-2xl -z-10 transition-opacity group-hover:opacity-100", step.glowColor)} />

                        <Card className={cn(
                          "relative h-full border-2 bg-gradient-to-br shadow-xl backdrop-blur-sm transition-all duration-300",
                          "hover:shadow-2xl hover:border-opacity-100",
                          "perspective-1000 group-hover:[transform:rotateX(5deg)_rotateY(-5deg)]",
                          step.borderColor,
                          step.bgGradient
                        )}>
                          <CardHeader className="text-center p-5 items-center space-y-2.5">
                        {/* Icon with better styling */}
                        <div className={cn("relative w-14 h-14 rounded-xl flex items-center justify-center shadow-inner bg-gradient-to-br", step.iconBg)}>
                          <Icon className={cn("w-7 h-7", step.iconColor)} />
                        </div>

                        {/* Title */}
                        <div className="space-y-2 flex flex-col items-center">
                          <CardTitle className="text-base font-bold text-center leading-tight">
                            {step.title}
                          </CardTitle>

                          {/* Description */}
                          <p className="text-xs text-muted-foreground text-center leading-snug px-1">
                            {step.description}
                          </p>

                          {/* Tech Badge */}
                          <Badge
                            variant="secondary"
                            className={cn("text-[0.7rem] px-2.5 py-0.5 font-medium shadow-sm", step.badgeBg, step.badgeText, step.badgeBorder)}
                          >
                            {step.tech}
                          </Badge>
                        </div>
                      </CardHeader>
                    </Card>
                      </div>
                    </DialogTrigger>

                    {/* Dialog Content - 상세 정보 */}
                    <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                      <DialogHeader>
                        <div className="flex items-start gap-4">
                          <div className={cn("w-16 h-16 rounded-xl flex items-center justify-center shadow-inner bg-gradient-to-br", step.iconBg)}>
                            <Icon className={cn("w-8 h-8", step.iconColor)} />
                          </div>
                          <div className="flex-1">
                            <DialogTitle className="text-2xl font-bold mb-2 flex items-center gap-2">
                              {step.title}
                              <Badge variant="secondary" className={cn("text-xs", step.badgeBg, step.badgeText)}>
                                {step.number}
                              </Badge>
                            </DialogTitle>
                            <DialogDescription className="text-base">
                              {step.detailedDescription}
                            </DialogDescription>
                          </div>
                        </div>
                      </DialogHeader>

                      <div className="space-y-6 mt-6">
                        {/* 기술 스택 */}
                        <div>
                          <h4 className="font-semibold mb-3 flex items-center gap-2">
                            <Sparkles className="w-4 h-4" />
                            기술 스택
                          </h4>
                          <Badge variant="outline" className={cn("text-sm px-3 py-1", step.badgeBg, step.badgeText)}>
                            {step.tech}
                          </Badge>
                        </div>

                        {/* 링크 버튼 */}
                        {step.link && (
                          <div className="pt-4 border-t">
                            <Link href={step.link}>
                              <Button className={cn("w-full bg-gradient-to-r text-white", step.gradient)}>
                                <ExternalLink className="w-4 h-4 mr-2" />
                                {step.title} 페이지로 이동
                              </Button>
                            </Link>
                          </div>
                        )}
                      </div>
                    </DialogContent>
                  </Dialog>
                )
              })}
            </div>

            {/* 3D 입체 파이프 연결선 - 하단 (카드 아래로 이동) */}
            <div className="absolute -bottom-8 left-0 right-0 h-12 px-[4.5rem] pointer-events-none">
              {/* 파이프 외곽선 (3D 효과) */}
              <div className="absolute inset-0 bg-gradient-to-b from-muted/70 via-muted/50 to-muted/30 rounded-full shadow-[inset_0_3px_10px_rgba(0,0,0,0.25)] dark:shadow-[inset_0_3px_10px_rgba(0,0,0,0.5)]" />

              {/* 내부 그라데이션 레이어 */}
              <div className="absolute inset-y-1.5 left-0 right-0 rounded-full overflow-hidden bg-gradient-to-r from-blue-500/40 via-purple-500/40 via-orange-500/40 via-green-500/40 to-rose-500/40" />

              {/* 흐르는 데이터 패턴 */}
              <div className="absolute inset-y-3 left-0 right-0 overflow-hidden rounded-full">
                <div
                  className="h-full w-full bg-[repeating-linear-gradient(90deg,transparent_0,transparent_20px,rgba(255,255,255,0.4)_20px,rgba(255,255,255,0.4)_40px)] dark:bg-[repeating-linear-gradient(90deg,transparent_0,transparent_20px,rgba(255,255,255,0.25)_20px,rgba(255,255,255,0.25)_40px)]"
                  style={{ animation: 'flow-pipe 2s linear infinite' }}
                />
              </div>

              {/* 각 단계마다 밸브(노드) 표시 */}
              {processSteps.map((step, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-14 h-14 rounded-full border-4 shadow-xl transition-all duration-300 pointer-events-auto cursor-pointer hover:scale-125 hover:shadow-2xl",
                    "bg-gradient-to-br backdrop-blur-sm",
                    step.bgGradient
                  )}
                  style={{
                    left: `${10 + idx * 20}%`,
                    borderColor: `var(--color-${step.color})`,
                  }}
                >
                  {/* 내부 펄스 효과 */}
                  <div className={cn("absolute inset-1.5 rounded-full bg-gradient-to-br opacity-70 animate-pulse", step.gradient)} />

                  {/* 단계 번호 */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-sm font-bold text-white drop-shadow-lg">{step.number}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Mobile/Tablet Flow - 밸런스 개선 버전 */}
        <div className="lg:hidden max-w-lg mx-auto px-4">
          <div className="relative">
            {/* 3D 입체 파이프 (수직) */}
            <div className="absolute left-8 top-8 bottom-8 w-8 -translate-x-1/2 z-0">
              {/* 파이프 외곽선 */}
              <div className="absolute inset-0 bg-gradient-to-r from-muted/60 via-muted/40 to-muted/20 rounded-full shadow-[inset_2px_0_8px_rgba(0,0,0,0.2)] dark:shadow-[inset_2px_0_8px_rgba(0,0,0,0.4)]" />

              {/* 내부 그라데이션 */}
              <div className="absolute inset-x-1 top-0 bottom-0 rounded-full overflow-hidden bg-gradient-to-b from-blue-500/30 via-purple-500/30 via-orange-500/30 via-green-500/30 to-rose-500/30" />

              {/* 흐르는 데이터 패턴 (수직) */}
              <div className="absolute inset-x-2 top-0 bottom-0 overflow-hidden rounded-full">
                <div
                  className="w-full h-full bg-[repeating-linear-gradient(0deg,transparent_0,transparent_20px,rgba(255,255,255,0.3)_20px,rgba(255,255,255,0.3)_40px)] dark:bg-[repeating-linear-gradient(0deg,transparent_0,transparent_20px,rgba(255,255,255,0.2)_20px,rgba(255,255,255,0.2)_40px)]"
                  style={{ animation: 'flow-down 2s linear infinite' }}
                />
              </div>
            </div>

            {/* Process Cards */}
            <div className="space-y-6">
              {processSteps.map((step, index) => {
                const Icon = step.icon
                return (
                  <div key={index} className="relative flex gap-4 items-start">
                    {/* Enhanced Step Circle */}
                    <div className={cn("relative z-10 w-16 h-16 rounded-full flex items-center justify-center shrink-0 border-4 bg-gradient-to-br shadow-lg ring-4 ring-background", `border-${step.color}-500`, step.bgGradient)}>
                      <Icon className={cn("w-8 h-8", step.iconColor)} />

                      {/* Step number */}
                      <div className={cn("absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-[0.65rem] font-bold shadow-md text-white bg-gradient-to-br", step.gradient)}>
                        {step.number}
                      </div>
                    </div>

                    {/* Enhanced Content Card */}
                    <Card className={cn("flex-1 border-2 bg-gradient-to-br shadow-md", step.borderColor, step.bgGradient)}>
                      <CardHeader className="p-4 text-center space-y-2">
                        <div className="space-y-1.5">
                          <CardTitle className="text-lg font-bold leading-tight">
                            {step.title}
                          </CardTitle>
                          <CardDescription className="text-xs leading-snug">
                            {step.description}
                          </CardDescription>
                        </div>

                        {/* Tech Badge */}
                        <Badge
                          variant="secondary"
                          className={cn("text-[0.7rem] px-2.5 py-0.5 font-medium shadow-sm mx-auto", step.badgeBg, step.badgeText, step.badgeBorder)}
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

      {/* 나머지 섹션들은 PageContainer로 감싸기 */}
      <PageContainer maxWidth="wide">
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

      </PageContainer>

      {/* 플로팅 챗봇 버튼 */}
      <FloatingChatButton />
    </>
  )
}