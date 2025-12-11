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
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
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
  vectors_count: number
  points_count: number
  vector_size: number
  distance: string
  // 추후 백엔드에서 추가될 필드
  visibility?: "public" | "private" | "shared"
  description?: string
  owner_id?: number
  is_owner?: boolean
  documents_count?: number
  created_at?: string
}

type VisibilityFilter = "all" | "public" | "private" | "shared"
type SortOption = "name_asc" | "name_desc" | "vectors_desc" | "newest"

export default function CollectionsPage() {
  // 컬렉션 목록 상태
  const [collections, setCollections] = useState<Collection[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [visibilityFilter, setVisibilityFilter] = useState<VisibilityFilter>("all")
  const [sortOption, setSortOption] = useState<SortOption>("name_asc")

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

  // 필터링 및 정렬된 컬렉션
  const filteredCollections = collections
    .filter((col) => {
      // 검색 필터
      if (searchQuery && !col.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false
      }
      // visibility 필터 (추후 백엔드 지원 시 활성화)
      if (visibilityFilter !== "all" && col.visibility && col.visibility !== visibilityFilter) {
        return false
      }
      return true
    })
    .sort((a, b) => {
      switch (sortOption) {
        case "name_asc":
          return a.name.localeCompare(b.name, 'ko-KR')
        case "name_desc":
          return b.name.localeCompare(a.name, 'ko-KR')
        case "vectors_desc":
          return b.vectors_count - a.vectors_count
        case "newest":
          // created_at이 없으면 이름 순으로 fallback
          if (a.created_at && b.created_at) {
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          }
          return a.name.localeCompare(b.name, 'ko-KR')
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
        <div className="p-1.5 rounded-2xl bg-background/60 backdrop-blur-xl border border-border/50 shadow-lg supports-[backdrop-filter]:bg-background/40">
          <div className="flex flex-col sm:flex-row gap-2">
            {/* 검색 */}
            <div className="relative flex-1 group">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-[color:var(--chart-1)] transition-colors" />
              <Input
                placeholder="컬렉션 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-10 bg-background/50 border-transparent focus:bg-background focus:border-[color:var(--chart-1)]/20 rounded-xl transition-all"
              />
            </div>

            <div className="flex gap-2">
              {/* 공개 상태 필터 */}
              <Select value={visibilityFilter} onValueChange={(v) => setVisibilityFilter(v as VisibilityFilter)}>
                <SelectTrigger className="w-[130px] h-10 rounded-xl border-border/50 bg-background/50 focus:bg-background">
                  <SelectValue placeholder="공개 상태" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 상태</SelectItem>
                  <SelectItem value="public">공개</SelectItem>
                  <SelectItem value="private">비공개</SelectItem>
                  <SelectItem value="shared">공유</SelectItem>
                </SelectContent>
              </Select>

              {/* 정렬 */}
              <Select value={sortOption} onValueChange={(v) => setSortOption(v as SortOption)}>
                <SelectTrigger className="w-[130px] h-10 rounded-xl border-border/50 bg-background/50 focus:bg-background">
                  <ArrowUpDown className="h-4 w-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="정렬" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name_asc">이름 (오름차순)</SelectItem>
                  <SelectItem value="name_desc">이름 (내림차순)</SelectItem>
                  <SelectItem value="vectors_desc">벡터 수 (많은순)</SelectItem>
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
        </div>
      </motion.div>

      {/* 컬렉션 그리드 */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="border-border/50 bg-background/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <div className="space-y-1.5 flex-1">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
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
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {filteredCollections.map((collection) => (
            <motion.div key={collection.name} variants={item}>
              <Card className="group relative overflow-hidden border-border/50 bg-background/60 backdrop-blur-sm hover:border-[color:var(--chart-1)]/30 hover:shadow-xl hover:shadow-[color:var(--chart-1)]/5 transition-all duration-300">
                <div className="absolute inset-0 bg-gradient-to-br from-[color:var(--chart-1)]/0 via-[color:var(--chart-1)]/0 to-[color:var(--chart-1)]/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                <CardContent className="p-5">
                  {/* Card Header Area */}
                  <div className="flex items-start justify-between mb-4 relative z-10">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 group-hover:from-[color:var(--chart-1)]/10 group-hover:to-[color:var(--chart-2)]/10 text-muted-foreground group-hover:text-[color:var(--chart-1)] transition-all duration-300 shadow-inner">
                        <Database className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-base line-clamp-1 group-hover:text-[color:var(--chart-1)] transition-colors" title={collection.name}>
                          {collection.name}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          {collection.distance} • {collection.vector_size}d
                        </p>
                      </div>
                    </div>

                    {/* Actions Menu */}
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity translate-x-2 group-hover:translate-x-0">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 hover:bg-background/80 hover:text-[color:var(--chart-1)] rounded-lg"
                              onClick={() => openPromptGenerator(collection)}
                              disabled={collection.vectors_count === 0}
                            >
                              <Sparkles className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top">프롬프트 생성</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>

                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 hover:bg-background/80 rounded-lg"
                              onClick={() => openSettingsModal(collection)}
                            >
                              <Settings className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top">설정</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>

                  {/* Description */}
                  <div className="min-h-[2.5rem] mb-4 relative z-10">
                    <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                      {collection.description || "설명이 없습니다."}
                    </p>
                  </div>

                  {/* Footer Info */}
                  <div className="flex items-center justify-between pt-4 border-t border-border/50 relative z-10">
                    <div className="flex items-center gap-2">
                      {collection.vectors_count > 0 ? (
                        <Badge variant="secondary" className="bg-secondary/50 font-mono">
                          {collection.vectors_count.toLocaleString()} vectors
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground text-xs border-dashed">
                          비어있음
                        </Badge>
                      )}
                    </div>
                    {getVisibilityBadge(collection.visibility, true)}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
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
