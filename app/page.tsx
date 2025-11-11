"use client"

import Link from "next/link"
import { useState } from "react"
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
  Circle,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { cn } from "@/lib/utils"
import { ChatPreview } from "@/components/chat-preview"
import { FloatingChatButton } from "@/components/floating-chat-button"

export default function HomePage() {
  const [activeStep, setActiveStep] = useState(0)

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
      icon: Upload,
      number: "01",
      title: "문서 업로드",
      description: "PDF, DOCX, PPTX 등 다양한 형식의 문서를 업로드합니다",
      details: "지원 형식: PDF, DOCX, DOC, PPTX, PPT\n최대 크기: 50MB\n일괄 업로드 지원",
      status: "completed"
    },
    {
      icon: Brain,
      number: "02",
      title: "AI 파싱",
      description: "Docling AI가 문서를 심층 분석합니다",
      details: "OCR 텍스트 추출\n테이블 구조 인식\n이미지 분석\n메타데이터 추출",
      status: "completed"
    },
    {
      icon: FileCode,
      number: "03",
      title: "마크다운 변환",
      description: "구조화된 마크다운 형식으로 변환합니다",
      details: "헤딩 계층 구조 유지\n테이블 포맷 보존\n코드 블록 인식\n링크 자동 생성",
      status: "completed"
    },
    {
      icon: Database,
      number: "04",
      title: "벡터 임베딩",
      description: "BGE-M3 모델로 벡터화하여 Qdrant에 저장",
      details: "1024차원 벡터 생성\n다국어 지원\n의미적 유사도 계산\n실시간 인덱싱",
      status: "active"
    },
    {
      icon: Bot,
      number: "05",
      title: "Dify 연동",
      description: "Dify 지식베이스에 문서 업로드 (선택)",
      details: "데이터셋 자동 분류\nAPI 통합\n버전 관리\n권한 설정",
      status: "pending"
    },
    {
      icon: MessageSquare,
      number: "06",
      title: "RAG 활용",
      description: "문서 기반 지능형 질의응답 시스템",
      details: "컨텍스트 기반 응답\n출처 표시\n멀티턴 대화\n정확도 향상",
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
              <div
                key={index}
                className={`flex items-center gap-3 animate-scale-up animate-delay-${(index + 3) * 100}`}
              >
                <div className="p-2 rounded-lg bg-primary/10">
                  <Icon className="w-4 h-4 text-primary" />
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

        {/* CTA 버튼 - 개선된 스타일 */}
        <div className="flex gap-4 justify-center flex-wrap">
          <Link href="/parse">
            <Button size="lg" className="gap-2 h-12 px-6 shadow-lg hover:shadow-xl transition-all">
              <FileText className="w-5 h-5" />
              문서 변환 시작
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
          <Link href="/chat">
            <Button size="lg" variant="outline" className="gap-2 h-12 px-6 border-2">
              <MessageSquare className="w-5 h-5" />
              RAG 채팅
              <Badge variant="secondary" className="ml-1">New</Badge>
            </Button>
          </Link>
        </div>
      </div>

      {/* Process Flow Diagram - 히어로 섹션 바로 아래 추가 */}
      <div className="mb-16 py-12 bg-gradient-to-b from-background to-muted/20">
        <div className="text-center mb-12">
          <Badge variant="outline" className="mb-4">
            <BrainCircuit className="w-3 h-3 mr-1" />
            전체 프로세스
          </Badge>
          <h2 className="text-3xl font-bold mb-4">문서에서 지식으로, 한눈에 보는 워크플로우</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            업로드부터 RAG 활용까지 KCA-RAG의 6단계 프로세스
          </p>
        </div>

        {/* Desktop Flow Chart */}
        <div className="hidden lg:block max-w-7xl mx-auto px-4">
          <div className="relative isolate">
            {/* Connection Lines Layer - 가장 뒤쪽 레이어 */}
            <div className="absolute inset-0 flex items-center justify-between px-20 -z-10">
              {[1, 2, 3, 4, 5].map((_, index) => (
                <div
                  key={index}
                  className="flex-1 flex items-center"
                >
                  <div className="flex-1 h-0.5 bg-gradient-to-r from-muted-foreground/20 via-muted-foreground/10 to-transparent">
                    <ChevronRight className="absolute -right-2 -top-2.5 w-5 h-5 text-muted-foreground/20" />
                  </div>
                </div>
              ))}
            </div>

            {/* Process Cards Layer - 앞쪽 레이어 */}
            <div className="relative grid grid-cols-6 gap-8 z-10">
              {processSteps.map((step, index) => {
                const Icon = step.icon
                return (
                  <div
                    key={index}
                    className="group relative isolate"
                  >
                    <div className="absolute -inset-2 bg-gradient-to-r from-primary/20 to-primary/5 rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-300 blur-xl -z-10" />

                    <Card className={cn(
                      "relative h-full border-2 transition-all duration-300",
                      "bg-background dark:bg-card", // 확실한 배경색
                      "hover:shadow-xl hover:-translate-y-1",
                      step.status === "completed" && "border-green-500/30 bg-green-50/5 dark:bg-green-900/10",
                      step.status === "active" && "border-primary shadow-lg shadow-primary/20 bg-primary/5",
                      step.status === "pending" && "border-muted-foreground/30 opacity-75"
                    )}>
                      <CardHeader className="text-center p-4">
                        {/* Step Number */}
                        <div className="absolute -top-3 -right-3">
                          <Badge
                            variant={step.status === "active" ? "default" : "outline"}
                            className={cn(
                              "rounded-full w-8 h-8 p-0 flex items-center justify-center font-bold",
                              step.status === "completed" && "bg-green-500 text-white border-green-500",
                              step.status === "active" && "animate-pulse"
                            )}
                          >
                            {step.number}
                          </Badge>
                        </div>

                        {/* Icon */}
                        <div className={cn(
                          "w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-3",
                          "transition-all duration-300 group-hover:scale-110",
                          step.status === "completed" && "bg-green-100 dark:bg-green-900/30",
                          step.status === "active" && "bg-primary/10",
                          step.status === "pending" && "bg-muted"
                        )}>
                          <Icon className={cn(
                            "w-8 h-8",
                            step.status === "completed" && "text-green-600 dark:text-green-400",
                            step.status === "active" && "text-primary",
                            step.status === "pending" && "text-muted-foreground"
                          )} />
                        </div>

                        {/* Title */}
                        <CardTitle className="text-sm font-semibold">
                          {step.title}
                        </CardTitle>

                        {/* Status Indicator */}
                        {step.status === "active" && (
                          <div className="mt-2">
                            <span className="inline-flex items-center gap-1 text-xs text-primary">
                              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                              진행 중
                            </span>
                          </div>
                        )}
                        {step.status === "completed" && (
                          <div className="mt-2">
                            <CheckCircle className="w-4 h-4 text-green-500 mx-auto" />
                          </div>
                        )}
                      </CardHeader>
                    </Card>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Mobile/Tablet Flow - Vertical */}
        <div className="lg:hidden max-w-md mx-auto px-4">
          <div className="relative">
            {/* Vertical Connection Line */}
            <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary/40 via-primary/20 to-transparent" />

            {/* Process Cards */}
            <div className="space-y-6">
              {processSteps.map((step, index) => {
                const Icon = step.icon
                return (
                  <div key={index} className="relative flex gap-4 items-start">
                    {/* Step Circle */}
                    <div className={cn(
                      "relative z-10 w-16 h-16 rounded-full flex items-center justify-center",
                      "border-4 bg-background",
                      step.status === "completed" && "border-green-500 bg-green-50 dark:bg-green-900/20",
                      step.status === "active" && "border-primary bg-primary/10",
                      step.status === "pending" && "border-muted-foreground/30 bg-muted"
                    )}>
                      <Icon className={cn(
                        "w-7 h-7",
                        step.status === "completed" && "text-green-600 dark:text-green-400",
                        step.status === "active" && "text-primary",
                        step.status === "pending" && "text-muted-foreground"
                      )} />

                      {/* Pulse animation for active */}
                      {step.status === "active" && (
                        <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
                      )}
                    </div>

                    {/* Content Card */}
                    <Card className={cn(
                      "flex-1",
                      step.status === "completed" && "border-green-500/30",
                      step.status === "active" && "border-primary shadow-md",
                      step.status === "pending" && "opacity-75"
                    )}>
                      <CardHeader className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant={step.status === "active" ? "default" : "outline"} className="text-xs">
                            Step {step.number}
                          </Badge>
                          {step.status === "completed" && (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          )}
                        </div>
                        <CardTitle className="text-base">{step.title}</CardTitle>
                        <CardDescription className="text-xs mt-1">
                          {step.description}
                        </CardDescription>
                      </CardHeader>
                    </Card>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Quick Navigation */}
        <div className="mt-12 flex justify-center gap-3 flex-wrap px-4">
          <Link href="/parse">
            <Button size="sm" variant="outline" className="gap-2">
              <Upload className="w-4 h-4" />
              시작하기
            </Button>
          </Link>
          {processSteps.map((step, index) => {
            if (index === 0) return null // Skip first step as we have 시작하기
            const href = index === 3 ? "/qdrant" : index === 4 ? "/dify" : index === 5 ? "/chat" : "#"
            if (href === "#") return null

            return (
              <Link key={index} href={href}>
                <Button size="sm" variant="ghost" className="gap-2 text-xs">
                  <step.icon className="w-4 h-4" />
                  {step.title}
                </Button>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Process Steps - 탭과 프로그레스 바로 개선 */}
      <div className="mb-16">
        <div className="text-center mb-12">
          <Badge variant="outline" className="mb-4">6단계 프로세스</Badge>
          <h2 className="text-4xl font-bold mb-4">문서를 지식으로 전환하는 과정</h2>
          <p className="text-lg text-muted-foreground">
            AI 기반 문서 처리부터 RAG 활용까지 전체 워크플로우
          </p>
        </div>

        {/* 프로그레스 바 */}
        <div className="mb-8">
          <Progress value={(activeStep + 1) * 16.67} className="h-2" />
        </div>

        {/* 탭 기반 프로세스 스텝 */}
        <Tabs value={`step-${activeStep}`} onValueChange={(value) => {
          const step = parseInt(value.split('-')[1])
          setActiveStep(step)
        }} className="w-full">
          <TabsList className="grid grid-cols-3 sm:grid-cols-6 w-full h-auto p-1 bg-muted/50">
            {processSteps.map((step, index) => {
              const Icon = step.icon
              const isCompleted = step.status === "completed"
              const isActive = step.status === "active"
              const isPending = step.status === "pending"

              return (
                <TabsTrigger
                  key={index}
                  value={`step-${index}`}
                  className={cn(
                    "flex flex-col gap-2 py-4 data-[state=active]:bg-background",
                    isCompleted && "text-green-600 dark:text-green-400",
                    isActive && "text-primary",
                    isPending && "text-muted-foreground"
                  )}
                >
                  <div className="flex items-center gap-2">
                    {isCompleted ? (
                      <CheckCircle className="w-5 h-5" />
                    ) : isActive ? (
                      <div className="relative">
                        <Circle className="w-5 h-5" />
                        <div className="absolute inset-0 w-5 h-5 rounded-full bg-primary/20 animate-ping" />
                      </div>
                    ) : (
                      <Circle className="w-5 h-5" />
                    )}
                    <span className="hidden xl:inline font-medium">{step.title}</span>
                    <span className="xl:hidden font-medium">{step.number}</span>
                  </div>
                </TabsTrigger>
              )
            })}
          </TabsList>

          {processSteps.map((step, index) => {
            const Icon = step.icon
            return (
              <TabsContent key={index} value={`step-${index}`} className="mt-8">
                <Card className="border-2">
                  <CardHeader className="text-center pb-4">
                    <div className="mx-auto mb-4">
                      <div className={cn(
                        "w-20 h-20 rounded-full flex items-center justify-center",
                        step.status === "completed" && "bg-green-100 dark:bg-green-900/30",
                        step.status === "active" && "bg-primary/10",
                        step.status === "pending" && "bg-muted"
                      )}>
                        <Icon className={cn(
                          "w-10 h-10",
                          step.status === "completed" && "text-green-600 dark:text-green-400",
                          step.status === "active" && "text-primary",
                          step.status === "pending" && "text-muted-foreground"
                        )} />
                      </div>
                    </div>
                    <div className="flex items-center justify-center gap-2">
                      <Badge variant={step.status === "active" ? "default" : "outline"}>
                        Step {step.number}
                      </Badge>
                      {step.status === "completed" && (
                        <Badge variant="outline" className="bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400">
                          완료
                        </Badge>
                      )}
                      {step.status === "active" && (
                        <Badge className="bg-primary/10 text-primary">
                          진행 중
                        </Badge>
                      )}
                    </div>
                    <CardTitle className="text-2xl mt-4">{step.title}</CardTitle>
                    <CardDescription className="text-base mt-2">
                      {step.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-muted/50 rounded-lg p-6 space-y-3">
                      {step.details.split('\n').map((detail, idx) => (
                        <div key={idx} className="flex items-start gap-2">
                          <ChevronRight className="w-4 h-4 mt-0.5 text-primary" />
                          <span className="text-sm">{detail}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            )
          })}
        </Tabs>
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

              {/* CTA 버튼 */}
              <div className="flex gap-4 flex-wrap pt-4">
                <Link href="/chat">
                  <Button size="lg" className="gap-2">
                    <MessageSquare className="w-5 h-5" />
                    챗봇 시작하기
                  </Button>
                </Link>
                <Link href="/parse">
                  <Button size="lg" variant="outline" className="gap-2">
                    <Upload className="w-5 h-5" />
                    문서 업로드
                  </Button>
                </Link>
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
              <HoverCard key={feature.href}>
                <HoverCardTrigger asChild>
                  <Link href={feature.href}>
                    <Card className="h-full hover:shadow-xl transition-all hover:-translate-y-2 group overflow-hidden border-2">
                      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      <CardHeader>
                        <div className={cn(
                          "w-14 h-14 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110",
                          feature.bgColor
                        )}>
                          <Icon className={cn("w-7 h-7", feature.color)} />
                        </div>
                        <CardTitle className="flex items-center justify-between">
                          {feature.title}
                          <ArrowRight className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-all group-hover:translate-x-1" />
                        </CardTitle>
                        <CardDescription className="mt-2">
                          {feature.description}
                        </CardDescription>
                      </CardHeader>
                    </Card>
                  </Link>
                </HoverCardTrigger>
                <HoverCardContent className="w-80">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Icon className={cn("w-5 h-5", feature.color)} />
                      <h4 className="font-semibold">{feature.title}</h4>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {feature.description}
                    </p>
                    <div className="pt-3 border-t space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">주요 기능</p>
                      {feature.features.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-sm">
                          <CheckCircle className="w-3 h-3 text-green-600 dark:text-green-400" />
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </HoverCardContent>
              </HoverCard>
            )
          })}
        </div>
      </div>

      {/* CTA Section */}
      <div className="mt-20 text-center">
        <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20 max-w-3xl mx-auto">
          <CardHeader className="pb-4">
            <CardTitle className="text-3xl">지금 시작하세요</CardTitle>
            <CardDescription className="text-base mt-2">
              문서를 업로드하고 AI의 힘으로 지식베이스를 구축하세요
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 justify-center">
              <Link href="/parse">
                <Button size="lg" className="gap-2">
                  <Upload className="w-5 h-5" />
                  문서 업로드
                </Button>
              </Link>
              <Link href="/chat">
                <Button size="lg" variant="outline" className="gap-2">
                  <MessageSquare className="w-5 h-5" />
                  데모 체험
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 플로팅 챗봇 버튼 */}
      <FloatingChatButton />
    </PageContainer>
  )
}