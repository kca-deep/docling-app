import Link from "next/link"
import { FileText, Network, ArrowRight, Files, Upload, Brain, FileCode, Bot, MessageSquare } from "lucide-react"
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { PageContainer } from "@/components/page-container"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

export default function HomePage() {
  const features = [
    {
      icon: FileText,
      title: "문서 파싱",
      description: "PDF, DOCX, PPTX 파일을 마크다운으로 변환합니다",
      href: "/parse",
    },
    {
      icon: Files,
      title: "다중 파일 일괄 파싱",
      description: "여러 개의 파일을 한 번에 업로드하여 일괄 변환합니다",
      href: "/batch-parse",
    },
    {
      icon: Network,
      title: "Dify 연동",
      description: "Dify AI 플랫폼과 통합하여 문서를 처리합니다",
      href: "/dify",
    },
  ]

  const processSteps = [
    {
      icon: Upload,
      number: "01",
      title: "문서 업로드",
      description: "PDF, DOCX, PPTX 파일을 업로드합니다",
    },
    {
      icon: Brain,
      number: "02",
      title: "AI 파싱",
      description: "OCR, 테이블 구조, 이미지 인식",
    },
    {
      icon: FileCode,
      number: "03",
      title: "마크다운 변환",
      description: "구조화된 텍스트로 변환",
    },
    {
      icon: Bot,
      number: "04",
      title: "Dify 연동",
      description: "AI 플랫폼 통합 (선택)",
    },
    {
      icon: MessageSquare,
      number: "05",
      title: "RAG 활용",
      description: "문서 기반 질의응답",
    },
  ]

  return (
    <PageContainer maxWidth="wide">
      {/* Hero Section */}
      <div className="text-center mb-16 space-y-6">
        <Badge variant="outline" className="mb-4">
          AI-Powered Document Processing
        </Badge>
        <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
          KCA-RAG 파이프라인
        </h1>
        <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
          문서를 AI로 분석하고 마크다운으로 변환하여 <br />
          RAG 기반 지능형 질의응답 시스템을 구축하세요
        </p>
        <div className="flex gap-4 justify-center mt-8">
          <Link href="/parse">
            <Button size="lg" className="gap-2">
              <FileText className="w-5 h-5" />
              시작하기
            </Button>
          </Link>
          <Link href="/batch-parse">
            <Button size="lg" variant="outline" className="gap-2">
              <Files className="w-5 h-5" />
              일괄 파싱
            </Button>
          </Link>
        </div>
      </div>

      {/* Process Steps */}
      <div className="mb-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">전체 프로세스</h2>
          <p className="text-muted-foreground">
            5단계로 문서를 AI 기반 지식베이스로 전환합니다
          </p>
        </div>

        <div className="relative">
          {/* Connection Line */}
          <div className="hidden lg:block absolute top-1/2 left-0 right-0 h-0.5 bg-gradient-to-r from-primary/20 via-primary to-primary/20 -translate-y-1/2 z-0" />

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6 relative z-10">
            {processSteps.map((step, index) => {
              const Icon = step.icon
              return (
                <div key={index} className="relative">
                  <Card className="h-full hover:shadow-lg transition-all hover:-translate-y-1 bg-background">
                    <CardHeader className="text-center">
                      <div className="mx-auto mb-4 relative">
                        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                          <Icon className="w-8 h-8 text-primary" />
                        </div>
                        <Badge
                          variant="default"
                          className="absolute -top-2 -right-2 w-8 h-8 rounded-full flex items-center justify-center p-0"
                        >
                          {step.number}
                        </Badge>
                      </div>
                      <CardTitle className="text-lg mb-2">
                        {step.title}
                      </CardTitle>
                      <CardDescription className="text-sm">
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

      {/* Features */}
      <div>
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">주요 기능</h2>
          <p className="text-muted-foreground">
            다양한 문서 처리 기능을 제공합니다
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {features.map((feature) => {
            const Icon = feature.icon
            return (
              <Link key={feature.href} href={feature.href}>
                <Card className="h-full hover:shadow-md transition-shadow group">
                  <CardHeader>
                    <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center mb-4">
                      <Icon className="w-6 h-6" />
                    </div>
                    <CardTitle className="flex items-center justify-between">
                      {feature.title}
                      <ArrowRight className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </CardTitle>
                    <CardDescription>
                      {feature.description}
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            )
          })}
        </div>
      </div>
    </PageContainer>
  )
}
