"use client"

import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { ShowcaseStatsResponse } from "@/lib/showcase"

interface Props {
  stats: ShowcaseStatsResponse | null
  isAuthenticated: boolean
  /** 우측 상단에 얹을 검색/필터 등 (히어로 통합용) */
  filterSlot?: React.ReactNode
}

export function ShowcaseHero({ stats, isAuthenticated, filterSlot }: Props) {
  const router = useRouter()

  // 비로그인 사용자가 등록 버튼 클릭 시: 로그인 페이지로 안내 (로그인 후 /showcase/new 복귀)
  const handleRegisterGuestClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!isAuthenticated) {
      e.preventDefault()
      toast.error("로그인이 필요합니다.")
      router.push(`/login?redirect=${encodeURIComponent("/showcase/new")}`)
    }
  }

  return (
    <div className="container max-w-7xl mx-auto px-4 pt-6">
      <div className="relative w-full aspect-[5/1] min-h-[160px] overflow-hidden rounded-xl border border-white/10 shadow-lg">
        <Image
          src="/images/showcase-hero.png"
          alt="KCA AI Hub AI 쇼케이스"
          fill
          sizes="(max-width: 1280px) 100vw, 1280px"
          className="object-cover object-center"
          priority
        />
        {/* 상단 가독성용 그라데이션 (헤드라인 영역) */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/65 via-black/10 to-transparent" />
        {/* 하단 가독성용 그라데이션 (배지/CTA 영역) */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

        {/* 상단 레이어: 헤드라인 (lg에서 우측 검색바와 겹치지 않도록 폭 제한) */}
        <div className="absolute top-0 left-0 right-0 px-5 py-3.5 lg:max-w-[58%]">
          <h1 className="text-white font-semibold tracking-tight text-lg sm:text-xl lg:text-2xl">
            우리가 만든 AI, 함께 씁니다
          </h1>
          <p className="mt-1 text-white/75 text-xs sm:text-sm">
            동료들이 직접 만든 프롬프트·자동화·미니앱을 한곳에서
          </p>
        </div>

        {/* 우측 상단: 검색/필터 슬롯 */}
        {filterSlot && (
          <div className="absolute top-3.5 right-4 z-10">{filterSlot}</div>
        )}

        {/* 하단 좌측: 통계 배지 */}
        {stats && (
          <div className="absolute bottom-0 left-0 px-5 py-3.5 flex gap-2 flex-wrap pr-28">
            <span className="inline-flex items-center gap-1.5 bg-black/40 backdrop-blur-sm rounded-md px-2.5 py-1 border border-white/15 text-xs text-white/75">
              총 <strong className="text-white">{stats.total_items}</strong>개
            </span>
            <span className="inline-flex items-center gap-1.5 bg-black/40 backdrop-blur-sm rounded-md px-2.5 py-1 border border-white/15 text-xs text-white/75">
              Featured <strong className="text-white">{stats.featured_count}</strong>개
            </span>
            <span className="inline-flex items-center gap-1.5 bg-black/40 backdrop-blur-sm rounded-md px-2.5 py-1 border border-white/15 text-xs text-white/75">
              최근 7일 <strong className="text-white">{stats.recent_count}</strong>개
            </span>
          </div>
        )}

        {/* 하단 우측: 등록 버튼 (항상 노출, 비로그인 시 로그인 안내) */}
        {/* 히어로의 검색/필터와 동일한 글래스모피즘 스타일로 통일 */}
        <Link
          href="/showcase/new"
          onClick={handleRegisterGuestClick}
          className="absolute bottom-3.5 right-5"
        >
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 border-border/70 bg-background/70 backdrop-blur-sm"
          >
            <Plus className="h-4 w-4" />
            내 AI 공유하기
          </Button>
        </Link>
      </div>
    </div>
  )
}
