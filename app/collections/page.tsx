"use client"

import { useState, useEffect, useCallback } from "react"
import { PageContainer } from "@/components/page-container"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Database,
  Plus,
  Search,
  Settings,
  RefreshCw,
  Globe,
  Lock,
  Users,
  ArrowUpDown,
  Sparkles,
  FolderCog,
  Star,
  Landmark,
  Briefcase,
  Calendar,
  Wallet,
  Gift,
  Scale,
  Shield,
  CreditCard,
  FileText,
  Award,
  FlaskConical,
  Building,
  LucideIcon,
  X,
  FileCheck,
  FolderOpen,
  RotateCcw,
} from "lucide-react"
import { toast } from "sonner"
import { API_BASE_URL } from "@/lib/api-config"
import { cn } from "@/lib/utils"
import { motion } from "framer-motion"
import { CreateCollectionModal } from "./components/CreateCollectionModal"
import { CollectionSettingsModal } from "./components/CollectionSettingsModal"
import { DeleteConfirmModal } from "./components/DeleteConfirmModal"
import { PromptGeneratorModal } from "./components/PromptGeneratorModal"

// 컬렉션 타입 정의
interface Collection {
  name: string
  documents_count: number
  points_count: number
  vector_size: number
  distance: string
  visibility?: "public" | "private" | "shared"
  description?: string
  owner_id?: number
  is_owner?: boolean
  created_at?: string
}

type SortOption = "name_asc" | "name_desc" | "vectors_desc" | "docs_desc" | "newest"
type QuickFilter = "recommended" | "hasDocuments" | "empty" | "public" | "private"

// 메타데이터 타입
interface CollectionMetadata {
  koreanName?: string
  icon?: string
  keywords?: string[]
  priority?: number
  plainDescription?: string
}

// 아이콘 매핑
const ICON_MAP: Record<string, LucideIcon> = {
  Landmark,
  Briefcase,
  Users,
  Calendar,
  Wallet,
  Gift,
  Scale,
  Shield,
  CreditCard,
  Search,
  FileText,
  Award,
  FlaskConical,
  Building,
  Database,
}

// description JSON 파싱 함수
function parseMetadata(description?: string): CollectionMetadata {
  if (!description) return {}
  try {
    const parsed = JSON.parse(description)
    if (typeof parsed === 'object' && parsed !== null) {
      return {
        koreanName: parsed.koreanName,
        icon: parsed.icon,
        keywords: Array.isArray(parsed.keywords) ? parsed.keywords : undefined,
        priority: typeof parsed.priority === 'number' ? parsed.priority : undefined,
        plainDescription: parsed.plainDescription,
      }
    }
  } catch {
    return { plainDescription: description }
  }
  return {}
}

// 아이콘 컴포넌트 가져오기
function getIcon(iconName?: string): LucideIcon {
  if (!iconName) return Database
  return ICON_MAP[iconName] || Database
}

export default function CollectionsPage() {
  // 컬렉션 목록 상태
  const [collections, setCollections] = useState<Collection[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [sortOption, setSortOption] = useState<SortOption>("name_asc")
  const [quickFilters, setQuickFilters] = useState<QuickFilter[]>([])
  const [searchInputRef, setSearchInputRef] = useState<HTMLInputElement | null>(null)

  // 모달 상태
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [settingsModalOpen, setSettingsModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [promptGeneratorOpen, setPromptGeneratorOpen] = useState(false)
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null)

  // 컬렉션 목록 가져오기
  const fetchCollections = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(`${API_BASE_URL}/api/qdrant/collections`, {
        credentials: 'include'
      })
      if (response.ok) {
        const data = await response.json()
        setCollections(data.collections || [])
      } else {
        toast.error("컬렉션 목록을 불러오는데 실패했습니다")
      }
    } catch (error) {
      console.error("Failed to fetch collections:", error)
      toast.error("컬렉션 목록을 불러오는데 실패했습니다")
    } finally {
      setLoading(false)
    }
  }, [])

  // 초기 로드
  useEffect(() => {
    fetchCollections()
  }, [fetchCollections])

  // 키보드 단축키 (Cmd/Ctrl + K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        searchInputRef?.focus()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [searchInputRef])

  // 빠른 필터 토글
  const toggleQuickFilter = (filter: QuickFilter) => {
    setQuickFilters(prev =>
      prev.includes(filter)
        ? prev.filter(f => f !== filter)
        : [...prev, filter]
    )
  }

  // 모든 필터 초기화
  const resetAllFilters = () => {
    setSearchQuery("")
    setQuickFilters([])
  }

  // 필터가 적용되어 있는지 확인
  const hasActiveFilters = searchQuery || quickFilters.length > 0

  // 필터링 및 정렬된 컬렉션
  const filteredCollections = collections
    .filter((col) => {
      // 검색 필터 - 이름, 한글명, 키워드로 검색
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const metadata = parseMetadata(col.description)

        const matchName = col.name.toLowerCase().includes(query)
        const matchKoreanName = metadata.koreanName?.toLowerCase().includes(query)
        const matchKeywords = metadata.keywords?.some(k => k.toLowerCase().includes(query))
        const matchDescription = metadata.plainDescription?.toLowerCase().includes(query)

        if (!matchName && !matchKoreanName && !matchKeywords && !matchDescription) {
          return false
        }
      }

      // 빠른 필터 적용
      if (quickFilters.length > 0) {
        const metadata = parseMetadata(col.description)

        // 추천 필터
        if (quickFilters.includes("recommended") && metadata.priority !== 1) {
          return false
        }
        // 문서 있음 필터
        if (quickFilters.includes("hasDocuments") && col.points_count === 0) {
          return false
        }
        // 비어있음 필터
        if (quickFilters.includes("empty") && col.points_count > 0) {
          return false
        }
        // 공개 필터
        if (quickFilters.includes("public") && col.visibility !== "public") {
          return false
        }
        // 비공개 필터
        if (quickFilters.includes("private") && col.visibility !== "private") {
          return false
        }
      }

      return true
    })
    .sort((a, b) => {
      // 한글명 우선, 없으면 영문명 사용
      const metaA = parseMetadata(a.description)
      const metaB = parseMetadata(b.description)
      const nameA = metaA.koreanName || a.name
      const nameB = metaB.koreanName || b.name

      switch (sortOption) {
        case "name_asc":
          return nameA.localeCompare(nameB, 'ko-KR')
        case "name_desc":
          return nameB.localeCompare(nameA, 'ko-KR')
        case "vectors_desc":
          return b.points_count - a.points_count
        case "docs_desc":
          return b.documents_count - a.documents_count
        case "newest":
          // created_at이 없으면 이름 순으로 fallback
          if (a.created_at && b.created_at) {
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          }
          return nameA.localeCompare(nameB, 'ko-KR')
        default:
          return 0
      }
    })

  // 설정 모달 열기
  const openSettingsModal = (collection: Collection) => {
    setSelectedCollection(collection)
    setSettingsModalOpen(true)
  }

  // 삭제 모달 열기
  const openDeleteModal = (collection: Collection) => {
    setSelectedCollection(collection)
    setDeleteModalOpen(true)
  }

  // 프롬프트 생성 모달 열기
  const openPromptGenerator = (collection: Collection) => {
    setSelectedCollection(collection)
    setPromptGeneratorOpen(true)
  }

  // 컬렉션 삭제
  const handleDeleteCollection = async () => {
    if (!selectedCollection) return

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/qdrant/collections/${encodeURIComponent(selectedCollection.name)}`,
        {
          method: "DELETE",
          credentials: 'include'
        }
      )

      if (response.ok) {
        toast.success(`'${selectedCollection.name}' 컬렉션이 삭제되었습니다`)
        setDeleteModalOpen(false)
        setSelectedCollection(null)
        fetchCollections()
      } else {
        const error = await response.json()
        toast.error(error.detail || "컬렉션 삭제에 실패했습니다")
      }
    } catch (error) {
      console.error("Failed to delete collection:", error)
      toast.error("컬렉션 삭제에 실패했습니다")
    }
  }

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  }

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  }

  // visibility 아이콘 및 색상 (컴팩트 버전)
  const getVisibilityBadge = (visibility?: string, compact: boolean = false) => {
    const config = {
      public: {
        icon: Globe,
        label: "공개",
        className: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20"
      },
      private: {
        icon: Lock,
        label: "비공개",
        className: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20"
      },
      shared: {
        icon: Users,
        label: "공유",
        className: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
      }
    }

    const v = (visibility || "public") as keyof typeof config
    const { icon: Icon, label, className } = config[v] || config.public

    if (compact) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className={cn("flex items-center justify-center p-1.5 rounded-full border", className)}>
                <Icon className="h-3 w-3" />
              </div>
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )
    }

    return (
      <Badge variant="outline" className={cn("gap-1", className)}>
        <Icon className="h-3 w-3" />
        {label}
      </Badge>
    )
  }

  return (
    <PageContainer maxWidth="wide" className="py-8 space-y-8">
      {/* Background Noise & Gradient */}
      <div className="absolute inset-0 bg-noise opacity-30 pointer-events-none -z-10" />
      <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-[color:var(--chart-1)]/5 to-transparent -z-10" />

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-[color:var(--chart-1)] to-[color:var(--chart-2)] text-white shadow-lg shadow-[color:var(--chart-1)]/20">
              <FolderCog className="h-5 w-5" />
            </div>
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
              컬렉션
            </span>
          </h1>
          <p className="text-muted-foreground mt-3 text-lg max-w-2xl">
            벡터 데이터베이스 컬렉션을 효율적으로 관리하고 AI 지식베이스를 구축하세요.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Button
            onClick={() => setCreateModalOpen(true)}
            size="lg"
            className="gap-2 rounded-full shadow-lg shadow-[color:var(--chart-1)]/20 hover:shadow-[color:var(--chart-1)]/40 hover:scale-105 active:scale-95 transition-all bg-[color:var(--chart-1)] hover:bg-[color:var(--chart-1)]/90"
          >
            <Plus className="h-5 w-5" />
            새 컬렉션
          </Button>
        </motion.div>
      </div>

      {/* 필터 및 검색 영역 */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="sticky top-20 z-30"
      >
        <div className="p-3 rounded-2xl bg-background/60 backdrop-blur-xl border border-border/50 shadow-lg supports-[backdrop-filter]:bg-background/40 space-y-3">
          {/* 첫 번째 줄: 검색 + 정렬 + 새로고침 */}
          <div className="flex flex-col sm:flex-row gap-2">
            {/* 검색 */}
            <div className="relative flex-1 group">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-[color:var(--chart-1)] transition-colors" />
              <Input
                ref={(el) => setSearchInputRef(el)}
                placeholder="컬렉션 검색... (Ctrl+K)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-10 h-10 bg-background/50 border-transparent focus:bg-background focus:border-[color:var(--chart-1)]/20 rounded-xl transition-all"
              />
              {/* 검색어 클리어 버튼 */}
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="flex gap-2">
              {/* 정렬 */}
              <Select value={sortOption} onValueChange={(v) => setSortOption(v as SortOption)}>
                <SelectTrigger className="w-[150px] h-10 rounded-xl border-border/50 bg-background/50 focus:bg-background">
                  <ArrowUpDown className="h-4 w-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="정렬" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name_asc">이름 (오름차순)</SelectItem>
                  <SelectItem value="name_desc">이름 (내림차순)</SelectItem>
                  <SelectItem value="vectors_desc">벡터 수 (많은순)</SelectItem>
                  <SelectItem value="docs_desc">문서 수 (많은순)</SelectItem>
                  <SelectItem value="newest">최신순</SelectItem>
                </SelectContent>
              </Select>

              {/* 새로고침 버튼 */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={fetchCollections} disabled={loading} className="h-10 w-10 rounded-xl hover:bg-background/80">
                      <RefreshCw className={cn("h-4 w-4", loading && "animate-spin text-[color:var(--chart-1)]")} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>목록 새로고침</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>

          {/* 두 번째 줄: 빠른 필터 칩 + 결과 요약 */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            {/* 빠른 필터 칩 */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-muted-foreground mr-1">빠른 필터:</span>
              <button
                onClick={() => toggleQuickFilter("recommended")}
                className={cn(
                  "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all",
                  quickFilters.includes("recommended")
                    ? "bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent"
                )}
              >
                <Star className="h-3 w-3" />
                추천
              </button>
              <button
                onClick={() => toggleQuickFilter("hasDocuments")}
                className={cn(
                  "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all",
                  quickFilters.includes("hasDocuments")
                    ? "bg-green-500/20 text-green-600 dark:text-green-400 border border-green-500/30"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent"
                )}
              >
                <FileCheck className="h-3 w-3" />
                문서 있음
              </button>
              <button
                onClick={() => toggleQuickFilter("empty")}
                className={cn(
                  "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all",
                  quickFilters.includes("empty")
                    ? "bg-orange-500/20 text-orange-600 dark:text-orange-400 border border-orange-500/30"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent"
                )}
              >
                <FolderOpen className="h-3 w-3" />
                비어있음
              </button>
              <span className="text-muted-foreground/50 mx-0.5">|</span>
              <button
                onClick={() => toggleQuickFilter("public")}
                className={cn(
                  "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all",
                  quickFilters.includes("public")
                    ? "bg-green-500/20 text-green-600 dark:text-green-400 border border-green-500/30"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent"
                )}
              >
                <Globe className="h-3 w-3" />
                공개
              </button>
              <button
                onClick={() => toggleQuickFilter("private")}
                className={cn(
                  "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all",
                  quickFilters.includes("private")
                    ? "bg-orange-500/20 text-orange-600 dark:text-orange-400 border border-orange-500/30"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent"
                )}
              >
                <Lock className="h-3 w-3" />
                비공개
              </button>
            </div>

            {/* 결과 요약 + 필터 초기화 */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">
                {hasActiveFilters ? (
                  <>전체 <span className="font-medium text-foreground">{collections.length}</span>개 중 <span className="font-medium text-[color:var(--chart-1)]">{filteredCollections.length}</span>개 표시</>
                ) : (
                  <>총 <span className="font-medium text-foreground">{collections.length}</span>개 컬렉션</>
                )}
              </span>
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetAllFilters}
                  className="h-6 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
                >
                  <RotateCcw className="h-3 w-3" />
                  초기화
                </Button>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* 컬렉션 그리드 */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <Card key={i} className="border-border/50 bg-background/50">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Skeleton className="h-8 w-8 rounded-lg" />
                  <div className="space-y-1 flex-1">
                    <Skeleton className="h-3.5 w-20" />
                    <Skeleton className="h-2.5 w-14" />
                  </div>
                </div>
                <Skeleton className="h-2.5 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredCollections.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center justify-center py-24 text-center border-2 border-dashed border-border/50 rounded-3xl bg-muted/5"
        >
          <div className="p-4 rounded-full bg-[color:var(--chart-1)]/10 text-[color:var(--chart-1)] mb-4">
            <Database className="h-8 w-8" />
          </div>
          <h3 className="text-xl font-bold mb-2">
            {searchQuery ? "검색 결과가 없습니다" : "컬렉션이 없습니다"}
          </h3>
          <p className="text-muted-foreground mb-6 max-w-sm">
            {searchQuery
              ? "다른 검색어를 시도해보거나 필터를 초기화해보세요."
              : "문서와 지식을 관리할 첫 번째 컬렉션을 만들어보세요."}
          </p>
          {!searchQuery && (
            <Button onClick={() => setCreateModalOpen(true)} className="gap-2 rounded-full">
              <Plus className="h-4 w-4" />
              첫 컬렉션 만들기
            </Button>
          )}
        </motion.div>
      ) : (
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3"
        >
          {filteredCollections.map((collection) => {
            const metadata = parseMetadata(collection.description)
            const IconComponent = getIcon(metadata.icon)
            const displayName = metadata.koreanName || collection.name
            const hasMetadata = !!metadata.koreanName

            return (
              <motion.div key={collection.name} variants={item}>
                <Card className="relative overflow-hidden border-border/40 bg-background/80 backdrop-blur-sm hover:border-[color:var(--chart-1)]/40 hover:shadow-lg transition-all duration-300">
                  {/* Priority 배지 */}
                  {metadata.priority === 1 && (
                    <div className="absolute top-1.5 right-1.5 z-20">
                      <Badge className="bg-amber-500/90 text-white text-[9px] px-1 py-0 h-4 gap-0.5">
                        <Star className="h-2.5 w-2.5 fill-current" />
                        추천
                      </Badge>
                    </div>
                  )}

                  <CardContent className="p-3 relative z-10">
                    {/* 헤더 - 아이콘, 타이틀, 공개상태 */}
                    <div className="flex items-start gap-2">
                      {/* 아이콘 */}
                      <div className="p-2 rounded-lg bg-[color:var(--chart-1)]/10 text-[color:var(--chart-1)] flex-shrink-0">
                        <IconComponent className="h-4 w-4" />
                      </div>

                      {/* 메인 정보 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h3 className="font-bold text-sm truncate" title={displayName}>
                            {displayName}
                          </h3>
                          {getVisibilityBadge(collection.visibility, true)}
                        </div>
                        {hasMetadata && (
                          <p className="text-[10px] text-muted-foreground truncate" title={collection.name}>
                            {collection.name}
                          </p>
                        )}
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {collection.points_count > 0 ? (
                            <>{collection.documents_count}문서 · {collection.points_count.toLocaleString()}청크</>
                          ) : (
                            <span className="text-muted-foreground/60">비어있음</span>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* 키워드 태그 */}
                    {metadata.keywords && metadata.keywords.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {metadata.keywords.slice(0, 3).map((keyword, idx) => (
                          <Badge
                            key={idx}
                            variant="secondary"
                            className="text-[9px] px-1.5 py-0 h-4 font-normal bg-muted/50"
                          >
                            {keyword}
                          </Badge>
                        ))}
                        {metadata.keywords.length > 3 && (
                          <Badge
                            variant="secondary"
                            className="text-[9px] px-1.5 py-0 h-4 font-normal bg-muted/50"
                          >
                            +{metadata.keywords.length - 3}
                          </Badge>
                        )}
                      </div>
                    )}

                    {/* 설명 */}
                    {metadata.plainDescription && (
                      <p className="text-[10px] text-muted-foreground mt-1.5 line-clamp-1">
                        {metadata.plainDescription}
                      </p>
                    )}

                    {/* 구분선 */}
                    <div className="h-px bg-border/50 my-2" />

                    {/* 액션 버튼 - 항상 표시 */}
                    <div className="flex gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 h-7 text-[10px] gap-1 hover:bg-[color:var(--chart-1)]/10 hover:text-[color:var(--chart-1)] hover:border-[color:var(--chart-1)]/30"
                        onClick={(e) => {
                          e.stopPropagation()
                          openPromptGenerator(collection)
                        }}
                        disabled={collection.points_count === 0}
                      >
                        <Sparkles className="h-3 w-3" />
                        프롬프트
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 h-7 text-[10px] gap-1"
                        onClick={(e) => {
                          e.stopPropagation()
                          openSettingsModal(collection)
                        }}
                      >
                        <Settings className="h-3 w-3" />
                        설정
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </motion.div>
      )}

      {/* 하단 안내 */}
      <div className="mt-8 text-center">
        <Button
          variant="link"
          className="text-muted-foreground hover:text-[color:var(--chart-1)] transition-colors"
          onClick={() => window.location.href = '/upload'}
        >
          데이터 업로드하러 가기 →
        </Button>
      </div>

      {/* 모달들 */}
      <CreateCollectionModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        onSuccess={fetchCollections}
      />

      <CollectionSettingsModal
        open={settingsModalOpen}
        onOpenChange={setSettingsModalOpen}
        collection={selectedCollection}
        onSuccess={fetchCollections}
        onDelete={() => selectedCollection && openDeleteModal(selectedCollection)}
      />

      <DeleteConfirmModal
        open={deleteModalOpen}
        onOpenChange={setDeleteModalOpen}
        collectionName={selectedCollection?.name || ""}
        onConfirm={handleDeleteCollection}
      />

      <PromptGeneratorModal
        open={promptGeneratorOpen}
        onOpenChange={setPromptGeneratorOpen}
        collectionName={selectedCollection?.name || ""}
        onSuccess={fetchCollections}
      />
    </PageContainer>
  )
}
