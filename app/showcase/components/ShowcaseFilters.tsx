"use client"

import { useState, useEffect, useCallback } from "react"
import * as icons from "lucide-react"
import { Search, X, SlidersHorizontal } from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import { ShowcaseCategory } from "@/lib/showcase"

const COLOR_MAP: Record<string, string> = {
  blue:   "text-info",
  purple: "text-purple",
  green:  "text-success",
  orange: "text-warning",
  yellow: "text-warning",
  teal:   "text-primary",
  red:    "text-danger",
}

const TYPE_OPTIONS = [
  { value: "all",      label: "전체 유형" },
  { value: "prompt",   label: "프롬프트" },
  { value: "code",     label: "코드" },
  { value: "guide",    label: "가이드" },
  { value: "workflow", label: "워크플로" },
  { value: "snippet",  label: "스니펫" },
]

const DIFFICULTY_OPTIONS = [
  { value: "all",          label: "전체" },
  { value: "beginner",     label: "입문" },
  { value: "intermediate", label: "중급" },
  { value: "advanced",     label: "고급" },
]

const SORT_OPTIONS = [
  { value: "created_at", label: "최신순" },
  { value: "view_count", label: "인기순" },
]

interface Props {
  categories: ShowcaseCategory[]
  selectedCategories: string[]
  type: string
  difficulty: string
  sort: string
  search: string
  onToggleCategory: (key: string) => void
  onClearCategories: () => void
  onTypeChange: (v: string) => void
  onDifficultyChange: (v: string) => void
  onSortChange: (v: string) => void
  onSearch: (v: string) => void
  onReset: () => void
  /** "hero": 히어로 이미지 위 컴팩트 배치(좁은 검색폭·글래스·칩 숨김) */
  variant?: "default" | "hero"
}

export function ShowcaseFilters({
  categories,
  selectedCategories,
  type,
  difficulty,
  sort,
  search,
  onToggleCategory,
  onClearCategories,
  onTypeChange,
  onDifficultyChange,
  onSortChange,
  onSearch,
  onReset,
  variant = "default",
}: Props) {
  const isHero = variant === "hero"
  // 검색어 디바운스 (기존 SearchInput 로직 흡수)
  const [localSearch, setLocalSearch] = useState(search)
  useEffect(() => setLocalSearch(search), [search])

  const debounced = useCallback(
    (() => {
      let timer: ReturnType<typeof setTimeout>
      return (v: string) => {
        clearTimeout(timer)
        timer = setTimeout(() => onSearch(v), 300)
      }
    })(),
    [onSearch]
  )

  const handleSearchChange = (v: string) => {
    setLocalSearch(v)
    debounced(v)
  }

  const catNameMap = new Map(categories.map((c) => [c.key, c.name]))
  const activeCount =
    selectedCategories.length + (type !== "all" ? 1 : 0) + (difficulty !== "all" ? 1 : 0)
  const sortLabel = SORT_OPTIONS.find((o) => o.value === sort)?.label ?? ""
  const hasActive = activeCount > 0 || !!search || sort !== "created_at"

  return (
    <div className={isHero ? "" : "space-y-2"}>
      {/* 1행: 검색 + 필터 트리거 */}
      <div className="flex gap-2">
        <div className={cn("relative", !isHero && "flex-1")}>
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={localSearch}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder={isHero ? "검색..." : "제목, 설명, 태그 검색..."}
            className={cn(
              "pl-8 pr-8 text-sm",
              isHero
                ? "h-8 w-52 bg-background/70 backdrop-blur-sm border-border/70"
                : "h-9"
            )}
          />
          {localSearch && (
            <button
              onClick={() => handleSearchChange("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "gap-1.5 flex-shrink-0",
                isHero ? "h-8 bg-background/70 backdrop-blur-sm border-border/70" : "h-9"
              )}
            >
              <SlidersHorizontal className="h-4 w-4" />
              필터
              {activeCount > 0 && (
                <Badge className="ml-0.5 h-5 min-w-5 justify-center px-1">{activeCount}</Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 space-y-3 p-4">
            {/* 카테고리 (다중 선택) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">카테고리</span>
                {selectedCategories.length > 0 && (
                  <button
                    onClick={onClearCategories}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    초기화
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {categories.map((cat) => {
                  const Icon =
                    ((icons as unknown) as Record<string, React.ElementType>)[cat.icon] ??
                    icons.Folder
                  const on = selectedCategories.includes(cat.key)
                  return (
                    <button
                      key={cat.key}
                      onClick={() => onToggleCategory(cat.key)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                        on
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-surface text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
                      )}
                    >
                      <Icon className={cn("h-3.5 w-3.5", !on && COLOR_MAP[cat.color])} />
                      {cat.name}
                      <span className="opacity-70">{cat.item_count}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <Separator />

            <PillRow label="유형" options={TYPE_OPTIONS} value={type} onChange={onTypeChange} />
            <PillRow
              label="난이도"
              options={DIFFICULTY_OPTIONS}
              value={difficulty}
              onChange={onDifficultyChange}
            />
            <PillRow label="정렬" options={SORT_OPTIONS} value={sort} onChange={onSortChange} />

            <Separator />

            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={onReset}
                disabled={!hasActive}
              >
                전체 초기화
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* 2행: 활성 필터 칩 (hero 변형에서는 숨김 — 활성 개수는 필터 버튼 배지로 표시) */}
      {!isHero && (activeCount > 0 || sort !== "created_at") && (
        <div className="flex flex-wrap items-center gap-1.5">
          {selectedCategories.map((key) => (
            <Chip
              key={key}
              label={catNameMap.get(key) ?? key}
              onRemove={() => onToggleCategory(key)}
            />
          ))}
          {type !== "all" && (
            <Chip
              label={TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type}
              onRemove={() => onTypeChange("all")}
            />
          )}
          {difficulty !== "all" && (
            <Chip
              label={DIFFICULTY_OPTIONS.find((o) => o.value === difficulty)?.label ?? difficulty}
              onRemove={() => onDifficultyChange("all")}
            />
          )}
          {sort !== "created_at" && (
            <span className="text-xs text-muted-foreground">정렬: {sortLabel}</span>
          )}
          <button
            onClick={onReset}
            className="ml-1 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            초기화
          </button>
        </div>
      )}
    </div>
  )
}

function PillRow({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: { value: string; label: string }[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="space-y-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const on = value === o.value
          return (
            <button
              key={o.value}
              onClick={() => onChange(o.value)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                on
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-surface text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
              )}
            >
              {o.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2 py-0.5 text-xs text-foreground">
      {label}
      <button onClick={onRemove} className="text-muted-foreground hover:text-foreground">
        <X className="h-3 w-3" />
      </button>
    </span>
  )
}
