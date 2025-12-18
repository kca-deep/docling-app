"use client"

import * as React from "react"
import Link from "next/link"
import { Globe, Lock, Users, Loader2, RefreshCw, Settings, Database, Layers, FileText, ChevronRight, Search, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { getCollectionDisplayName, getVisibilityLabel } from "@/lib/collection-utils"
import { QdrantCollection } from "@/app/upload/types"

import { RadioGroup, RadioGroupItem } from "./radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select"
import { Badge } from "./badge"
import { Button } from "./button"
import { Label } from "./label"
import { Input } from "./input"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./tooltip"
import { ScrollArea } from "./scroll-area"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./dialog"

/**
 * Visibility 아이콘 컴포넌트
 */
function VisibilityIcon({ visibility, className }: { visibility?: string; className?: string }) {
  const iconClass = cn("h-3 w-3", className)

  switch (visibility) {
    case "private":
      return <Lock className={iconClass} />
    case "shared":
      return <Users className={iconClass} />
    default:
      return <Globe className={iconClass} />
  }
}

/**
 * CollectionSelector Props
 */
export interface CollectionSelectorProps {
  /** 선택된 collection name */
  value: string
  /** 값 변경 핸들러 */
  onValueChange: (value: string) => void
  /** Collection 목록 */
  collections: QdrantCollection[]
  /** 로딩 상태 */
  loading?: boolean
  /** 새로고침 핸들러 */
  onRefresh?: () => void
  /** 미분류 옵션 표시 여부 */
  showUncategorized?: boolean
  /** 컬렉션 관리 링크 표시 여부 */
  showManageLink?: boolean
  /** 표시 형식: grid(카드형), dropdown(드롭다운), modal(모달), inline(인라인 그리드) */
  variant?: "grid" | "dropdown" | "modal" | "inline"
  /** grid/modal variant에서의 열 개수 (기본: 2, modal은 4) */
  columns?: 1 | 2 | 3 | 4
  /** 라벨 텍스트 */
  label?: string
  /** 추가 CSS 클래스 */
  className?: string
  /** 컬렉션이 없을 때 표시할 메시지 */
  emptyMessage?: string
  /** 모달 제목 (modal variant용) */
  modalTitle?: string
  /** 검색 기능 활성화 */
  searchable?: boolean
  /** 최대 표시 행 수 (inline variant용) */
  maxRows?: number
  /** 전체 옵션 표시 여부 (통계용) */
  showAllOption?: boolean
  /** 일상대화 옵션 표시 여부 (통계용) */
  showCasualOption?: boolean
  /** 모달 트리거 스타일 (modal variant용): card(기본) 또는 select(드롭다운 스타일) */
  triggerStyle?: "card" | "select"
}

/**
 * Collection 카드 컴포넌트 (grid/modal variant용)
 */
function CollectionCard({
  collection,
  isSelected,
  onClick,
}: {
  collection: QdrantCollection | { name: string; isUncategorized: true }
  isSelected: boolean
  onClick: () => void
}) {
  const isUncategorized = "isUncategorized" in collection

  if (isUncategorized) {
    return (
      <div
        onClick={onClick}
        className={cn(
          "relative flex flex-col p-3 rounded-xl border-2 cursor-pointer transition-all",
          "hover:border-muted-foreground/30 hover:bg-muted/30",
          isSelected
            ? "border-[color:var(--chart-4)] bg-[color:var(--chart-4)]/5 shadow-sm"
            : "border-border/50 bg-background/50"
        )}
      >
        <div className="flex items-center gap-2">
          <RadioGroupItem value="__uncategorized__" id="__uncategorized__" className="sr-only" />
          <div className={cn(
            "w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors",
            isSelected ? "border-[color:var(--chart-4)] bg-[color:var(--chart-4)]" : "border-muted-foreground/30"
          )}>
            {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
          </div>
          <span className="font-medium text-sm text-muted-foreground">미분류</span>
        </div>
        <p className="text-xs text-muted-foreground/70 mt-1 ml-6">
          카테고리가 지정되지 않은 문서
        </p>
      </div>
    )
  }

  const displayName = getCollectionDisplayName(collection)
  const showEnglishName = displayName !== collection.name

  return (
    <div
      onClick={onClick}
      className={cn(
        "relative flex flex-col p-3 rounded-xl border-2 cursor-pointer transition-all",
        "hover:border-[color:var(--chart-4)]/50 hover:bg-[color:var(--chart-4)]/5",
        isSelected
          ? "border-[color:var(--chart-4)] bg-[color:var(--chart-4)]/5 shadow-sm"
          : "border-border/50 bg-background/50"
      )}
    >
      {/* 상단: 라디오 + 한글명 + Visibility */}
      <div className="flex items-center gap-2">
        <RadioGroupItem value={collection.name} id={collection.name} className="sr-only" />
        <div className={cn(
          "w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors",
          isSelected ? "border-[color:var(--chart-4)] bg-[color:var(--chart-4)]" : "border-muted-foreground/30"
        )}>
          {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
        </div>
        <span className="font-medium text-sm truncate flex-1">{displayName}</span>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className={cn(
                "p-1 rounded",
                collection.visibility === "private" ? "text-amber-600" :
                collection.visibility === "shared" ? "text-blue-600" : "text-muted-foreground"
              )}>
                <VisibilityIcon visibility={collection.visibility} />
              </div>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p className="text-xs">{getVisibilityLabel(collection.visibility)}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* 중단: 영문명 (한글명과 다를 때만) */}
      {showEnglishName && (
        <p className="text-xs text-muted-foreground/70 mt-1 ml-6 truncate">
          {collection.name}
        </p>
      )}

      {/* 하단: 문서수 + 청크수 */}
      <div className="flex items-center gap-2 mt-2 ml-6">
        <Badge variant="outline" className="text-[0.65rem] px-1.5 py-0 h-5 gap-1 border-[color:var(--chart-4)]/30">
          <FileText className="h-2.5 w-2.5" />
          {collection.documents_count}
        </Badge>
        <Badge variant="secondary" className="text-[0.65rem] px-1.5 py-0 h-5 gap-1 bg-[color:var(--chart-4)]/10 text-[color:var(--chart-4)]">
          <Layers className="h-2.5 w-2.5" />
          {collection.points_count.toLocaleString()}c
        </Badge>
      </div>
    </div>
  )
}

/**
 * Collection 선택 컴포넌트
 * grid variant: RadioGroup 기반 2열/3열 카드형
 * dropdown variant: Select 기반 드롭다운
 * modal variant: 버튼 클릭 시 모달로 선택
 */
export function CollectionSelector({
  value,
  onValueChange,
  collections,
  loading = false,
  onRefresh,
  showUncategorized = false,
  showManageLink = true,
  variant = "grid",
  columns = 2,
  label = "Collection",
  className,
  emptyMessage = "접근 가능한 컬렉션이 없습니다",
  modalTitle = "컬렉션 선택",
  searchable = false,
  maxRows = 2,
  showAllOption = false,
  showCasualOption = false,
  triggerStyle = "card",
}: CollectionSelectorProps) {
  // 모달 상태
  const [open, setOpen] = React.useState(false)

  // 검색어 상태
  const [searchQuery, setSearchQuery] = React.useState("")

  // 선택된 컬렉션 정보
  const selectedCollection = collections.find((col) => col.name === value)

  // 검색 필터링된 컬렉션
  const filteredCollections = React.useMemo(() => {
    if (!searchQuery.trim()) return collections
    const query = searchQuery.toLowerCase()
    return collections.filter((col) => {
      const displayName = getCollectionDisplayName(col).toLowerCase()
      const name = col.name.toLowerCase()
      return displayName.includes(query) || name.includes(query)
    })
  }, [collections, searchQuery])

  // Grid 열 클래스 결정 (모바일 반응형 지원)
  // Note: columns 4는 globals.css의 .grid-responsive-cols 클래스 사용 (순수 CSS로 반응형 보장)
  const getGridColsClass = (cols?: number) => {
    switch (cols) {
      case 1: return "grid-cols-1"
      case 2: return "grid-cols-2"
      case 3: return "grid-cols-2 sm:grid-cols-3"
      case 4: return "grid-responsive-cols" // 순수 CSS: 모바일 2열 → sm 3열 → lg 4열
      default: return "grid-responsive-cols"
    }
  }
  const gridColsClass = getGridColsClass(columns)

  // 선택된 컬렉션 표시명
  const getSelectedDisplayName = () => {
    if (value === "__uncategorized__") return "미분류"
    if (selectedCollection) return getCollectionDisplayName(selectedCollection)
    return null
  }

  // 헤더 렌더링
  const renderHeader = (showLabel = true) => (
    <div className="flex items-center justify-between mb-3">
      {showLabel && (
        <Label className="text-sm font-semibold flex items-center gap-2">
          <Database className="h-4 w-4 text-[color:var(--chart-4)]" />
          {label}
        </Label>
      )}
      <div className="flex items-center gap-1">
        {showManageLink && (
          <Link href="/collections">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-[color:var(--chart-4)] transition-colors"
            >
              <Settings className="h-3 w-3" />
              관리
            </Button>
          </Link>
        )}
        {onRefresh && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={onRefresh}
                  disabled={loading}
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 hover:bg-[color:var(--chart-4)]/10 hover:text-[color:var(--chart-4)] transition-colors"
                >
                  {loading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-[color:var(--chart-4)]" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">새로고침</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    </div>
  )

  // 검색 입력 렌더링
  const renderSearchInput = () => {
    if (!searchable) return null
    return (
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="컬렉션 검색..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 pr-9 h-9 bg-background/50 border-border/50 focus:border-[color:var(--chart-4)]/30"
        />
        {searchQuery && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
            onClick={() => setSearchQuery("")}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    )
  }

  // 컬렉션 그리드 렌더링 (grid/modal 공용)
  const renderCollectionGrid = (onSelect?: (name: string) => void, overrideColumns?: number, useFiltered = true) => {
    const colsClass = overrideColumns ? getGridColsClass(overrideColumns) : gridColsClass
    const displayCollections = useFiltered ? filteredCollections : collections

    return (
      <>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-[color:var(--chart-4)]" />
          </div>
        ) : displayCollections.length === 0 && !showUncategorized && !showAllOption && !showCasualOption ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Database className="h-8 w-8 text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">
              {searchQuery ? "검색 결과가 없습니다" : emptyMessage}
            </p>
          </div>
        ) : (
          <ScrollArea className="max-h-[400px]">
            <RadioGroup
              value={value}
              onValueChange={(newValue) => {
                onValueChange(newValue)
                onSelect?.(newValue)
              }}
              className={cn("grid gap-2 p-2 pr-5", colsClass)}
            >
              {showAllOption && (!searchQuery || "전체".includes(searchQuery.toLowerCase())) && (
                <div
                  onClick={() => {
                    onValueChange("ALL")
                    onSelect?.("ALL")
                  }}
                  className={cn(
                    "relative flex flex-col p-3 rounded-xl border-2 cursor-pointer transition-all",
                    "hover:border-[color:var(--chart-1)]/50 hover:bg-[color:var(--chart-1)]/5",
                    value === "ALL"
                      ? "border-[color:var(--chart-1)] bg-[color:var(--chart-1)]/5 shadow-sm"
                      : "border-border/50 bg-background/50"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="ALL" id="ALL" className="sr-only" />
                    <div className={cn(
                      "w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors",
                      value === "ALL" ? "border-[color:var(--chart-1)] bg-[color:var(--chart-1)]" : "border-muted-foreground/30"
                    )}>
                      {value === "ALL" && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                    <span className="font-medium text-sm">전체</span>
                  </div>
                  <p className="text-xs text-muted-foreground/70 mt-1 ml-6">
                    모든 컬렉션 통합 조회
                  </p>
                </div>
              )}
              {showCasualOption && (!searchQuery || "일상대화".includes(searchQuery.toLowerCase())) && (
                <div
                  onClick={() => {
                    onValueChange("casual")
                    onSelect?.("casual")
                  }}
                  className={cn(
                    "relative flex flex-col p-3 rounded-xl border-2 cursor-pointer transition-all",
                    "hover:border-[color:var(--chart-2)]/50 hover:bg-[color:var(--chart-2)]/5",
                    value === "casual"
                      ? "border-[color:var(--chart-2)] bg-[color:var(--chart-2)]/5 shadow-sm"
                      : "border-border/50 bg-background/50"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="casual" id="casual" className="sr-only" />
                    <div className={cn(
                      "w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors",
                      value === "casual" ? "border-[color:var(--chart-2)] bg-[color:var(--chart-2)]" : "border-muted-foreground/30"
                    )}>
                      {value === "casual" && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                    <span className="font-medium text-sm">일상대화</span>
                  </div>
                  <p className="text-xs text-muted-foreground/70 mt-1 ml-6">
                    RAG 없이 일반 대화
                  </p>
                </div>
              )}
              {showUncategorized && (!searchQuery || "미분류".includes(searchQuery.toLowerCase())) && (
                <CollectionCard
                  collection={{ name: "__uncategorized__", isUncategorized: true }}
                  isSelected={value === "__uncategorized__"}
                  onClick={() => {
                    onValueChange("__uncategorized__")
                    onSelect?.("__uncategorized__")
                  }}
                />
              )}
              {displayCollections.map((collection) => (
                <CollectionCard
                  key={collection.name}
                  collection={collection}
                  isSelected={value === collection.name}
                  onClick={() => {
                    onValueChange(collection.name)
                    onSelect?.(collection.name)
                  }}
                />
              ))}
            </RadioGroup>
          </ScrollArea>
        )}
      </>
    )
  }

  // Grid variant 렌더링
  const renderGridVariant = () => (
    <div className={cn("space-y-3", className)}>
      {renderHeader()}
      {renderSearchInput()}
      {renderCollectionGrid()}
    </div>
  )

  // Inline variant 렌더링 (2줄 그리드 + 검색)
  const renderInlineVariant = () => {
    // 선택된 컬렉션 표시명
    const getSelectedDisplayForInline = () => {
      if (value === "ALL") return "전체"
      if (value === "casual") return "일상대화"
      if (value === "__uncategorized__") return "미분류"
      if (selectedCollection) return getCollectionDisplayName(selectedCollection)
      return "선택하세요"
    }

    return (
      <div className={cn("space-y-2", className)}>
        {/* 검색 + 현재 선택 표시 */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="컬렉션 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-9 h-10 bg-background/50 border-border/50 focus:border-[color:var(--chart-4)]/30"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => setSearchQuery("")}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
          {onRefresh && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={onRefresh}
                    disabled={loading}
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 hover:bg-[color:var(--chart-4)]/10 hover:text-[color:var(--chart-4)] transition-colors"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin text-[color:var(--chart-4)]" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">새로고침</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>

        {/* 2줄 그리드 */}
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-[color:var(--chart-4)]" />
          </div>
        ) : filteredCollections.length === 0 && !showAllOption && !showCasualOption ? (
          <div className="flex items-center justify-center py-4 text-center">
            <p className="text-sm text-muted-foreground">
              {searchQuery ? "검색 결과가 없습니다" : emptyMessage}
            </p>
          </div>
        ) : (
          <RadioGroup
            value={value}
            onValueChange={onValueChange}
            className={cn("grid gap-2", gridColsClass)}
          >
            {/* 전체 옵션 */}
            {showAllOption && (!searchQuery || "전체".includes(searchQuery.toLowerCase())) && (
              <div
                onClick={() => onValueChange("ALL")}
                className={cn(
                  "flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-all",
                  "hover:border-[color:var(--chart-1)]/50 hover:bg-[color:var(--chart-1)]/5",
                  value === "ALL"
                    ? "border-[color:var(--chart-1)] bg-[color:var(--chart-1)]/10"
                    : "border-border/50 bg-background/50"
                )}
              >
                <RadioGroupItem value="ALL" id="inline-ALL" className="sr-only" />
                <div className={cn(
                  "w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center flex-shrink-0",
                  value === "ALL" ? "border-[color:var(--chart-1)] bg-[color:var(--chart-1)]" : "border-muted-foreground/30"
                )}>
                  {value === "ALL" && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
                <span className="text-sm font-medium truncate">전체</span>
              </div>
            )}

            {/* 일상대화 옵션 */}
            {showCasualOption && (!searchQuery || "일상대화".includes(searchQuery.toLowerCase())) && (
              <div
                onClick={() => onValueChange("casual")}
                className={cn(
                  "flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-all",
                  "hover:border-[color:var(--chart-2)]/50 hover:bg-[color:var(--chart-2)]/5",
                  value === "casual"
                    ? "border-[color:var(--chart-2)] bg-[color:var(--chart-2)]/10"
                    : "border-border/50 bg-background/50"
                )}
              >
                <RadioGroupItem value="casual" id="inline-casual" className="sr-only" />
                <div className={cn(
                  "w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center flex-shrink-0",
                  value === "casual" ? "border-[color:var(--chart-2)] bg-[color:var(--chart-2)]" : "border-muted-foreground/30"
                )}>
                  {value === "casual" && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
                <span className="text-sm font-medium truncate">일상대화</span>
              </div>
            )}

            {/* 컬렉션 목록 */}
            {filteredCollections.map((collection) => {
              const displayName = getCollectionDisplayName(collection)
              const isSelected = value === collection.name
              return (
                <div
                  key={collection.name}
                  onClick={() => onValueChange(collection.name)}
                  className={cn(
                    "flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-all",
                    "hover:border-[color:var(--chart-4)]/50 hover:bg-[color:var(--chart-4)]/5",
                    isSelected
                      ? "border-[color:var(--chart-4)] bg-[color:var(--chart-4)]/10"
                      : "border-border/50 bg-background/50"
                  )}
                >
                  <RadioGroupItem value={collection.name} id={`inline-${collection.name}`} className="sr-only" />
                  <div className={cn(
                    "w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center flex-shrink-0",
                    isSelected ? "border-[color:var(--chart-4)] bg-[color:var(--chart-4)]" : "border-muted-foreground/30"
                  )}>
                    {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  <span className="text-sm font-medium truncate flex-1">{displayName}</span>
                  <VisibilityIcon visibility={collection.visibility} className="text-muted-foreground flex-shrink-0" />
                </div>
              )
            })}
          </RadioGroup>
        )}
      </div>
    )
  }

  // Dropdown variant 렌더링
  const renderDropdownVariant = () => (
    <div className={cn("space-y-3", className)}>
      {renderHeader()}

      {/* 선택된 컬렉션 정보 배지 */}
      {selectedCollection && (
        <div className="flex items-center gap-1.5 mb-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="text-xs gap-1 border-[color:var(--chart-4)]/30">
                  <VisibilityIcon visibility={selectedCollection.visibility} />
                  {getVisibilityLabel(selectedCollection.visibility)}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">공개 설정</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Badge variant="secondary" className="text-xs gap-1 bg-[color:var(--chart-4)]/10 text-[color:var(--chart-4)]">
            <Layers className="h-3 w-3" />
            {selectedCollection.points_count.toLocaleString()}c
          </Badge>
        </div>
      )}

      <Select value={value} onValueChange={onValueChange} disabled={loading}>
        <SelectTrigger className="h-11 bg-background/50 border-border/50 focus:border-[color:var(--chart-4)]/30 transition-colors">
          <SelectValue placeholder={loading ? "로딩 중..." : "Collection 선택"}>
            {value && value !== "__uncategorized__" && selectedCollection
              ? getCollectionDisplayName(selectedCollection)
              : value === "__uncategorized__"
              ? "미분류"
              : null}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {collections.length === 0 && !showUncategorized ? (
            <div className="px-2 py-3 text-center text-sm text-muted-foreground">
              {emptyMessage}
            </div>
          ) : (
            <>
              {showUncategorized && (
                <SelectItem value="__uncategorized__">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">미분류</span>
                  </div>
                </SelectItem>
              )}
              {collections.map((col) => (
                <SelectItem key={col.name} value={col.name}>
                  <div className="flex items-center justify-between w-full gap-3">
                    <div className="flex items-center gap-2">
                      <VisibilityIcon visibility={col.visibility} />
                      <span className="font-medium">{getCollectionDisplayName(col)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className="text-xs px-1.5">
                        {col.documents_count}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {col.points_count.toLocaleString()}c
                      </Badge>
                    </div>
                  </div>
                </SelectItem>
              ))}
            </>
          )}
        </SelectContent>
      </Select>
    </div>
  )

  // Modal variant 렌더링
  const renderModalVariant = () => {
    const selectedName = getSelectedDisplayName()

    // Select 스타일 트리거 버튼
    const renderSelectStyleTrigger = () => (
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className={cn(
          "h-9 gap-2 justify-between",
          "bg-background/50 border-border/50 hover:bg-background/80",
          "focus:border-[color:var(--chart-4)]/20",
          "transition-all"
        )}
      >
        <span className="truncate">
          {loading ? (
            <span className="flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              로딩 중...
            </span>
          ) : selectedName ? (
            selectedName
          ) : (
            <span className="text-muted-foreground">선택하세요</span>
          )}
        </span>
        <ChevronRight className="h-4 w-4 opacity-50 rotate-90" />
      </Button>
    )

    // Card 스타일 트리거 버튼 (기존)
    const renderCardStyleTrigger = () => (
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className={cn(
          "w-full justify-between h-auto py-3 px-4",
          "border-border/50 bg-background/50 hover:bg-[color:var(--chart-4)]/5 hover:border-[color:var(--chart-4)]/30",
          "transition-all"
        )}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[color:var(--chart-4)]/10">
            <Database className="h-4 w-4 text-[color:var(--chart-4)]" />
          </div>
          <div className="text-left">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="font-medium text-sm">
              {loading ? (
                <span className="flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  로딩 중...
                </span>
              ) : selectedName ? (
                selectedName
              ) : (
                <span className="text-muted-foreground">선택하세요</span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {selectedCollection && (
            <div className="flex items-center gap-1.5">
              <Badge variant="outline" className="text-[0.65rem] px-1.5 py-0 h-5 gap-1">
                <FileText className="h-2.5 w-2.5" />
                {selectedCollection.documents_count}
              </Badge>
              <Badge variant="secondary" className="text-[0.65rem] px-1.5 py-0 h-5 gap-1 bg-[color:var(--chart-4)]/10 text-[color:var(--chart-4)]">
                {selectedCollection.points_count.toLocaleString()}c
              </Badge>
            </div>
          )}
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>
      </Button>
    )

    return (
      <div className={cn("space-y-2", className)}>
        {/* 트리거 버튼 */}
        {triggerStyle === "select" ? renderSelectStyleTrigger() : renderCardStyleTrigger()}

        {/* 모달 */}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="sm:max-w-[700px] md:max-w-[900px] lg:max-w-[1000px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Database className="h-5 w-5 text-[color:var(--chart-4)]" />
                {modalTitle}
              </DialogTitle>
            </DialogHeader>

            {/* 모달 내 헤더 (관리/새로고침 버튼) */}
            <div className="flex items-center justify-end gap-1 -mt-2">
              {showManageLink && (
                <Link href="/collections" onClick={() => setOpen(false)}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-[color:var(--chart-4)] transition-colors"
                  >
                    <Settings className="h-3.5 w-3.5" />
                    컬렉션 관리
                  </Button>
                </Link>
              )}
              {onRefresh && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={onRefresh}
                        disabled={loading}
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 hover:bg-[color:var(--chart-4)]/10 hover:text-[color:var(--chart-4)] transition-colors"
                      >
                        {loading ? (
                          <Loader2 className="h-4 w-4 animate-spin text-[color:var(--chart-4)]" />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">새로고침</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>

            {/* 검색 입력 */}
            {renderSearchInput()}

            {/* 컬렉션 그리드 */}
            {renderCollectionGrid(() => setOpen(false), 4)}
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  // variant에 따라 렌더링
  switch (variant) {
    case "dropdown":
      return renderDropdownVariant()
    case "modal":
      return renderModalVariant()
    case "inline":
      return renderInlineVariant()
    default:
      return renderGridVariant()
  }
}
