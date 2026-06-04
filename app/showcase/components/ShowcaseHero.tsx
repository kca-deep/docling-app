"use client"

import Link from "next/link"
import Image from "next/image"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ShowcaseStatsResponse } from "@/lib/showcase"

interface Props {
  stats: ShowcaseStatsResponse | null
  isAuthenticated: boolean
}

export function ShowcaseHero({ stats, isAuthenticated }: Props) {
  return (
    <div className="relative w-full overflow-hidden">
      <Image
        src="/images/showcase-hero.png"
        alt="KCA AI Hub AI 쇼케이스"
        width={1200}
        height={375}
        sizes="100vw"
        className="w-full h-auto block"
        priority
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />

      <div className="absolute bottom-0 left-0 right-0 px-6 py-5 flex items-end justify-between gap-4">
        {stats && (
          <div className="flex gap-2 flex-wrap">
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
        {isAuthenticated && (
          <Link href="/showcase/new" className="flex-shrink-0">
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" />
              등록하기
            </Button>
          </Link>
        )}
      </div>
    </div>
  )
}
