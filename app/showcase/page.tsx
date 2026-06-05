"use client"

import { useState, useEffect, useCallback, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { getCategories, getItems, getStats, ShowcaseCategory, ShowcaseItem, ShowcaseStatsResponse } from "@/lib/showcase"
import { useAuth } from "@/components/auth/auth-provider"
import { ShowcaseHero } from "./components/ShowcaseHero"
import { ShowcaseFilters } from "./components/ShowcaseFilters"
import { ShowcaseGrid } from "./components/ShowcaseGrid"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"

const PAGE_SIZE = 20

function ShowcaseContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isAuthenticated } = useAuth()

  const [categories, setCategories] = useState<ShowcaseCategory[]>([])
  const [items, setItems] = useState<ShowcaseItem[]>([])
  const [stats, setStats] = useState<ShowcaseStatsResponse | null>(null)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    searchParams.get("category")?.split(",").filter(Boolean) ?? []
  )
  const [type, setType] = useState(searchParams.get("type") ?? "all")
  const [difficulty, setDifficulty] = useState(searchParams.get("difficulty") ?? "all")
  const [search, setSearch] = useState(searchParams.get("search") ?? "")
  const [sort, setSort] = useState<"created_at" | "view_count">(
    (searchParams.get("sort") as "created_at" | "view_count") ?? "created_at"
  )
  const [page, setPage] = useState(Number(searchParams.get("page") ?? 1))

  useEffect(() => {
    getCategories().then(setCategories).catch(console.error)
    getStats().then(setStats).catch(console.error)
  }, [])

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getItems({
        category: selectedCategories.length ? selectedCategories.join(",") : undefined,
        type: type !== "all" ? type : undefined,
        difficulty: difficulty !== "all" ? difficulty : undefined,
        search: search || undefined,
        sort,
        order: "desc",
        skip: (page - 1) * PAGE_SIZE,
        limit: PAGE_SIZE,
      })
      setItems(res.items)
      setTotal(res.total)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [selectedCategories, type, difficulty, search, sort, page])

  useEffect(() => { fetchItems() }, [fetchItems])

  const updateUrl = useCallback((params: Record<string, string | null>) => {
    const q = new URLSearchParams(searchParams.toString())
    for (const [k, v] of Object.entries(params)) {
      if (v) q.set(k, v)
      else q.delete(k)
    }
    router.replace(`/showcase?${q}`, { scroll: false })
  }, [searchParams, router])

  const handleToggleCategory = (key: string) => {
    const next = selectedCategories.includes(key)
      ? selectedCategories.filter((k) => k !== key)
      : [...selectedCategories, key]
    setSelectedCategories(next)
    setPage(1)
    updateUrl({ category: next.length ? next.join(",") : null, page: null })
  }

  const handleClearCategories = () => {
    setSelectedCategories([])
    setPage(1)
    updateUrl({ category: null, page: null })
  }

  const handleReset = () => {
    setSelectedCategories([])
    setType("all")
    setDifficulty("all")
    setSort("created_at")
    setSearch("")
    setPage(1)
    updateUrl({
      category: null,
      type: null,
      difficulty: null,
      sort: null,
      search: null,
      page: null,
    })
  }

  const handleType = (v: string) => {
    setType(v)
    setPage(1)
    updateUrl({ type: v !== "all" ? v : null, page: null })
  }

  const handleDifficulty = (v: string) => {
    setDifficulty(v)
    setPage(1)
    updateUrl({ difficulty: v !== "all" ? v : null, page: null })
  }

  const handleSort = (v: string) => {
    setSort(v as "created_at" | "view_count")
    setPage(1)
    updateUrl({ sort: v, page: null })
  }

  const handleSearch = (v: string) => {
    setSearch(v)
    setPage(1)
    updateUrl({ search: v || null, page: null })
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  const filterProps = {
    categories,
    selectedCategories,
    type,
    difficulty,
    sort,
    search,
    onToggleCategory: handleToggleCategory,
    onClearCategories: handleClearCategories,
    onTypeChange: handleType,
    onDifficultyChange: handleDifficulty,
    onSortChange: handleSort,
    onSearch: handleSearch,
    onReset: handleReset,
  }

  return (
    <>
      <ShowcaseHero
        stats={stats}
        isAuthenticated={isAuthenticated}
        filterSlot={
          <div className="hidden lg:block">
            <ShowcaseFilters {...filterProps} variant="hero" />
          </div>
        }
      />
    <div className="container max-w-7xl mx-auto px-4 py-6 space-y-5">

      {/* 모바일/태블릿: 히어로 아래 기본 필터 (lg에서는 히어로 우측 상단에 통합) */}
      <div className="lg:hidden">
        <ShowcaseFilters {...filterProps} />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-[150px] rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : (
        <ShowcaseGrid
          items={items}
          categories={categories}
          search={search || undefined}
          activeCategory={selectedCategories.length === 1 ? selectedCategories[0] : null}
          isAuthenticated={isAuthenticated}
        />
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 1}
            onClick={() => { setPage(page - 1); updateUrl({ page: String(page - 1) }) }}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => { setPage(page + 1); updateUrl({ page: String(page + 1) }) }}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
    </>
  )
}

export default function ShowcasePage() {
  return (
    <Suspense fallback={<div className="container max-w-7xl mx-auto px-4 py-6"><div className="h-8 w-40 bg-muted animate-pulse rounded" /></div>}>
      <ShowcaseContent />
    </Suspense>
  )
}
