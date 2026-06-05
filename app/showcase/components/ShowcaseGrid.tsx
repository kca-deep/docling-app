"use client"

import Link from "next/link"
import { Sparkles, SearchX, FolderOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ShowcaseItem, ShowcaseCategory } from "@/lib/showcase"
import { ShowcaseCard } from "./ShowcaseCard"

interface EmptyProps {
  search?: string
  category?: string | null
  categoryName?: string
  isAuthenticated?: boolean
}

function EmptyState({ search, category, categoryName, isAuthenticated }: EmptyProps) {
  if (search) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
        <SearchX className="h-10 w-10 text-muted-foreground/40" />
        <div>
          <p className="text-sm font-medium">
            &apos;<span className="text-primary">{search}</span>&apos;에 대한 결과가 없습니다.
          </p>
          <p className="text-xs text-muted-foreground mt-1">다른 검색어나 태그로 시도해보세요.</p>
        </div>
      </div>
    )
  }

  if (category) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
        <FolderOpen className="h-10 w-10 text-muted-foreground/40" />
        <div>
          <p className="text-sm font-medium">
            {categoryName ? `'${categoryName}'` : "이 카테고리"}에 아직 아이템이 없습니다.
          </p>
          <p className="text-xs text-muted-foreground mt-1">첫 번째로 등록해보세요!</p>
        </div>
        {isAuthenticated && (
          <Link href={`/showcase/new`}>
            <Button size="sm" variant="outline" className="mt-1">
              등록하기
            </Button>
          </Link>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
      <Sparkles className="h-10 w-10 text-muted-foreground/40" />
      <div>
        <p className="text-sm font-medium">아직 등록된 아이템이 없습니다.</p>
        <p className="text-xs text-muted-foreground mt-1">
          AI 활용 노하우를 첫 번째로 공유해보세요!
        </p>
      </div>
      {isAuthenticated && (
        <Link href="/showcase/new">
          <Button size="sm" className="mt-1">
            첫 번째로 등록하기
          </Button>
        </Link>
      )}
    </div>
  )
}

interface Props {
  items: ShowcaseItem[]
  categories: ShowcaseCategory[]
  search?: string
  activeCategory?: string | null
  isAuthenticated?: boolean
}

export function ShowcaseGrid({ items, categories, search, activeCategory, isAuthenticated }: Props) {
  const colorMap = Object.fromEntries(categories.map((c) => [c.key, c.color]))
  const categoryName = activeCategory
    ? categories.find((c) => c.key === activeCategory)?.name
    : undefined

  if (items.length === 0) {
    return (
      <EmptyState
        search={search}
        category={activeCategory}
        categoryName={categoryName}
        isAuthenticated={isAuthenticated}
      />
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      {items.map((item) => (
        <ShowcaseCard
          key={item.id}
          item={item}
          categoryColor={colorMap[item.category_key] ?? "blue"}
          hideCategoryBadge={!!activeCategory}
          horizontal
        />
      ))}
    </div>
  )
}
