"use client"

import Link from "next/link"
import {
  Eye,
  Star,
  MessageSquare,
  Code2,
  BookOpen,
  GitBranch,
  Scissors,
  Sparkles,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { ShowcaseItem, showcaseImageUrl } from "@/lib/showcase"
import { CategoryBadge } from "./CategoryBadge"
import { ItemTypeBadge } from "./ItemTypeBadge"
import { cn } from "@/lib/utils"

// 카테고리 색상 키 → placeholder 그라데이션 클래스 (globals.css 시맨틱 토큰 사용)
const CATEGORY_GRADIENT_MAP: Record<string, string> = {
  blue:   "from-info/25 to-info/5",
  purple: "from-purple/25 to-purple/5",
  green:  "from-success/25 to-success/5",
  orange: "from-warning/25 to-warning/5",
  yellow: "from-warning/25 to-warning/5",
  teal:   "from-primary/25 to-primary/5",
  red:    "from-danger/25 to-danger/5",
}

// item_type → placeholder 중앙 아이콘 (ItemTypeBadge 아이콘 재사용)
const PLACEHOLDER_ICON_MAP: Record<string, React.ElementType> = {
  prompt:   MessageSquare,
  code:     Code2,
  guide:    BookOpen,
  workflow: GitBranch,
  snippet:  Scissors,
}

// ISO 문자열 → 한국어 상대시간 라벨
function formatRelativeTime(iso: string): string {
  const date = new Date(iso)
  if (isNaN(date.getTime())) return ""

  const diffMs = Date.now() - date.getTime()
  if (diffMs < 0) return "방금 전"

  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return "방금 전"
  if (minutes < 60) return `${minutes}분 전`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}시간 전`

  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}일 전`

  const weeks = Math.floor(days / 7)
  if (weeks < 5) return `${weeks}주 전`

  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}.${m}.${d}`
}

interface Props {
  item: ShowcaseItem
  categoryColor: string
  hideCategoryBadge?: boolean
  /** 가로형 레이아웃 (좌측 이미지 · 우측 설명). 기본 false(세로형) */
  horizontal?: boolean
}

export function ShowcaseCard({ item, categoryColor, hideCategoryBadge = false, horizontal = false }: Props) {
  const relativeTime = formatRelativeTime(item.created_at)
  const PlaceholderIcon = PLACEHOLDER_ICON_MAP[item.item_type] ?? Sparkles
  const gradientClass =
    CATEGORY_GRADIENT_MAP[categoryColor] ?? "from-muted-foreground/15 to-muted-foreground/5"

  return (
    <Link href={`/showcase/${item.id}`} className="group block h-full">
      <Card
        className={cn(
          // 기본 Card의 py-6 / gap-6 를 제거해 여백 최소화
          "h-full gap-0 py-0 overflow-hidden rounded-xl border-border/60 shadow-card",
          "transition-all duration-200 hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5",
          horizontal ? "flex flex-row min-h-[150px]" : "flex flex-col",
          item.is_featured && "ring-1 ring-warning/40"
        )}
      >
        {/* 이미지 (가로형: 좌측 / 세로형: 상단) */}
        {item.thumbnail_url ? (
          <div
            className={cn(
              "relative overflow-hidden bg-muted",
              horizontal ? "w-32 flex-shrink-0 self-stretch sm:w-44" : "aspect-[16/9] w-full"
            )}
          >
            <img
              src={showcaseImageUrl(item.thumbnail_url)}
              alt=""
              className={cn(
                "h-full w-full object-cover transition-transform duration-300 group-hover:scale-105",
                horizontal && "absolute inset-0"
              )}
            />
          </div>
        ) : (
          <div
            className={cn(
              "flex items-center justify-center overflow-hidden bg-gradient-to-br",
              gradientClass,
              horizontal ? "w-32 flex-shrink-0 self-stretch sm:w-44" : "aspect-[16/9] w-full"
            )}
          >
            <PlaceholderIcon className="h-10 w-10 text-foreground/10" />
          </div>
        )}

        {/* 설명 (가로형: 우측 / 세로형: 하단) */}
        <div className="flex min-w-0 flex-1 flex-col gap-2 p-3.5">
          {/* 배지 */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              {!hideCategoryBadge && (
                <CategoryBadge name={item.category_name} color={categoryColor} />
              )}
              {item.is_featured && (
                <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-warning-bg text-warning">
                  <Star className="h-2.5 w-2.5 fill-current" />
                  Pick
                </span>
              )}
            </div>
            <ItemTypeBadge type={item.item_type} className="flex-shrink-0" />
          </div>

          {/* 제목 */}
          <h3 className="text-sm font-semibold leading-snug line-clamp-2 group-hover:text-primary transition-colors">
            {item.title}
          </h3>

          {/* 요약 */}
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
            {item.summary}
          </p>

          {/* 하단 그룹: 태그 + 메타 (카드 하단에 정렬) */}
          <div className="mt-auto space-y-2 pt-1">
            {item.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {item.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="rounded bg-muted/60 px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors group-hover:text-foreground/70"
                  >
                    #{tag}
                  </span>
                ))}
                {item.tags.length > 3 && (
                  <span className="px-1 py-0.5 text-[10px] text-muted-foreground">
                    +{item.tags.length - 3}
                  </span>
                )}
              </div>
            )}

            <div className="flex items-center justify-between border-t border-border/40 pt-2">
              {item.author_name ? (
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground truncate max-w-[65%]">
                  <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-primary/15 text-[8px] font-semibold text-primary">
                    {item.author_name.slice(0, 1)}
                  </span>
                  {item.author_name}
                </span>
              ) : (
                <span />
              )}
              <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground flex-shrink-0">
                {relativeTime && <span>{relativeTime}</span>}
                {relativeTime && <span aria-hidden="true">·</span>}
                <span className="flex items-center gap-1">
                  <Eye className="h-3 w-3" />
                  {item.view_count.toLocaleString()}
                </span>
              </span>
            </div>
          </div>
        </div>
      </Card>
    </Link>
  )
}
