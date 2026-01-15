import Link from "next/link"
import {
  ArrowRight,
  Upload,
  Sparkles,
  Zap,
  TrendingUp,
  Server,
} from "lucide-react"
import { Button } from "@/components/ui/button"

// 정적 통계 데이터 (Server Component에서 사용)
const stats = [
  { icon: Zap, label: "처리 속도", value: "<3", unit: "초/문서" },
  { icon: Server, label: "활성 서비스", value: "-", unit: "개", isDynamic: true },
  { icon: TrendingUp, label: "벡터 차원", value: "1024", unit: "dim" },
  { icon: Sparkles, label: "AI 모델", value: "3+", unit: "개" },
]

interface HeroSectionProps {
  activeServiceCount?: number
  isLoading?: boolean
}

export function HeroSection({ activeServiceCount, isLoading }: HeroSectionProps) {
  return (
    <div className="relative z-10 w-full max-w-7xl mx-auto px-6 md:px-8 lg:px-12 py-12 md:py-16 space-y-8">
      {/* Badge */}
      <div
        className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 bg-background/90 border border-[color:var(--chart-1)]/20 shadow-sm animate-hero-fade-in-up-delay-1"
      >
        <Sparkles className="w-4 h-4 text-[color:var(--chart-1)] animate-pulse" />
        <span className="text-sm font-semibold bg-clip-text text-transparent bg-gradient-to-r from-[color:var(--chart-1)] to-[color:var(--chart-3)]">
          AI-Powered Document Intelligence
        </span>
      </div>

      {/* Title & Description */}
      <div className="space-y-6 mt-8">
        <h1
          className="text-6xl sm:text-7xl lg:text-8xl font-bold tracking-tighter animate-hero-fade-in-up-delay-2"
        >
          <span className="bg-clip-text text-transparent bg-gradient-to-b from-foreground to-foreground/70">
            KCA-RAG
          </span>{' '}
          <span className="inline-block bg-clip-text text-transparent bg-gradient-to-r from-[color:var(--chart-1)] via-[color:var(--chart-2)] to-[color:var(--chart-3)]">
            Pipeline
          </span>
        </h1>

        <p
          className="text-xl sm:text-2xl text-muted-foreground/80 max-w-3xl mx-auto leading-relaxed px-4 text-balance font-light animate-hero-fade-in-up-delay-3"
        >
          문서를 <strong className="font-semibold text-foreground">AI로 분석</strong>하고 <strong className="font-semibold text-foreground">벡터 데이터베이스</strong>에 저장하여<br className="hidden md:block" />
          초정밀 RAG 기반 질의응답 시스템을 구축하세요
        </p>
      </div>

      {/* CTA Buttons */}
      <div
        className="flex flex-col sm:flex-row gap-4 justify-center items-center mt-12 animate-hero-scale-in"
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
      </div>

      {/* Inline Stats */}
      <div
        className="flex flex-wrap justify-center items-center gap-4 pt-12 animate-hero-scale-in-delay"
      >
        {stats.map((stat, index) => {
          const Icon = stat.icon
          const displayValue = stat.isDynamic
            ? (isLoading ? "-" : String(activeServiceCount ?? "-"))
            : stat.value
          return (
            <div key={index} className="flex items-center gap-3 px-6 py-3 rounded-2xl bg-background/80 border border-border/50 shadow-sm hover:shadow-md transition-all hover:bg-background/90 hover:-translate-y-1">
              <div className="p-2 rounded-lg bg-[color:var(--chart-1)]/10 text-[color:var(--chart-1)]">
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex flex-col items-start">
                <span className="text-sm font-bold text-foreground">{displayValue}{stat.unit}</span>
                <span className="text-xs text-muted-foreground">{stat.label}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
