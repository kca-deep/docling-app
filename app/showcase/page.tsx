"use client"

import { useState, useEffect, useCallback, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { getCategories, getItems, getStats, ShowcaseCategory, ShowcaseItem, ShowcaseStatsResponse } from "@/lib/showcase"
import { useAuth } from "@/components/auth/auth-provider"
import { ShowcaseHero } from "./components/ShowcaseHero"
import { CategoryTabs } from "./components/CategoryTabs"
import { FilterBar } from "./components/FilterBar"
import { SearchInput } from "./components/SearchInput"
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

  const [category, setCategory] = useState<string | null>(searchParams.get("category"))
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
        category: category ?? undefined,
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
  }, [category, type, difficulty, search, sort, page])

  useEffect(() => { fetchItems() }, [fetchItems])

  const updateUrl = useCallback((params: Record<string, string | null>) => {
    const q = new URLSearchParams(searchParams.toString())
    for (const [k, v] of Object.entries(params)) {
      if (v) q.set(k, v)
      else q.delete(k)
    }
    router.replace(`/showcase?${q}`, { scroll: false })
  }, [searchParams, router])

  const handleCategory = (key: string | null) => {
    setCategory(key)
    setPage(1)
    updateUrl({ category: key, page: null })
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

  return (
    <>
      <ShowcaseHero stats={stats} isAuthenticated={isAuthenticated} />
    <div className="container max-w-7xl mx-auto px-4 py-6 space-y-5">

      <CategoryTabs categories={categories} selected={category} onSelect={handleCategory} />

      <div className="flex flex-wrap gap-2 items-center justify-between">
        <FilterBar
          type={type}
          difficulty={difficulty}
          sort={sort}
          onTypeChange={handleType}
          onDifficultyChange={handleDifficulty}
          onSortChange={handleSort}
        />
        <SearchInput value={search} onSearch={handleSearch} />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-48 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : (
        <ShowcaseGrid
          items={items}
          categories={categories}
          search={search || undefined}
          activeCategory={category}
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
