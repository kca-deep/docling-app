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
  Trash2,
  Upload,
  FileText,
  Wand2,
  RefreshCw,
  Globe,
  Lock,
  Users,
  ArrowUpDown,
} from "lucide-react"
import { toast } from "sonner"
import { API_BASE_URL } from "@/lib/api-config"
import { cn } from "@/lib/utils"
import { CreateCollectionModal } from "./components/CreateCollectionModal"
import { CollectionSettingsModal } from "./components/CollectionSettingsModal"
import { DeleteConfirmModal } from "./components/DeleteConfirmModal"

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

  // visibility 아이콘 및 색상 (컴팩트 버전)
  const getVisibilityBadge = (visibility?: string, compact: boolean = false) => {
    const config = {
      public: {
        icon: Globe,
        label: "공개",
        className: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
      },
      private: {
        icon: Lock,
        label: "비공개",
        className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
      },
      shared: {
        icon: Users,
        label: "공유",
        className: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
      }
    }

    const v = (visibility || "public") as keyof typeof config
    const { icon: Icon, label, className } = config[v] || config.public

    if (compact) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="secondary" className={cn("px-1.5 py-0.5", className)}>
                <Icon className="h-3 w-3" />
              </Badge>
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )
    }

    return (
      <Badge variant="secondary" className={className}>
        <Icon className="h-3 w-3 mr-1" />
        {label}
      </Badge>
    )
  }

  return (
    <PageContainer maxWidth="wide" className="py-4">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Database className="h-6 w-6" />
            컬렉션 관리
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            벡터 데이터베이스 컬렉션 생성, 설정 및 관리
          </p>
        </div>
        <Button onClick={() => setCreateModalOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          새 컬렉션
        </Button>
      </div>

      {/* 필터 및 검색 영역 */}
      <Card className="mb-6">
        <CardContent className="py-4">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* 검색 */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="컬렉션 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* 공개 상태 필터 */}
            <Select value={visibilityFilter} onValueChange={(v) => setVisibilityFilter(v as VisibilityFilter)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="공개 상태" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                <SelectItem value="public">공개</SelectItem>
                <SelectItem value="private">비공개</SelectItem>
                <SelectItem value="shared">공유</SelectItem>
              </SelectContent>
            </Select>

            {/* 정렬 */}
            <Select value={sortOption} onValueChange={(v) => setSortOption(v as SortOption)}>
              <SelectTrigger className="w-[140px]">
                <ArrowUpDown className="h-4 w-4 mr-2" />
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
                  <Button variant="outline" size="icon" onClick={fetchCollections} disabled={loading}>
                    <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>새로고침</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </CardContent>
      </Card>

      {/* 컬렉션 그리드 */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="py-3 px-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-5 w-5 rounded-full" />
                <Skeleton className="h-4 w-20" />
                <div className="flex-1" />
                <div className="flex gap-1">
                  <Skeleton className="h-8 w-8" />
                  <Skeleton className="h-8 w-8" />
                  <Skeleton className="h-8 w-8" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : filteredCollections.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Database className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">
              {searchQuery ? "검색 결과가 없습니다" : "컬렉션이 없습니다"}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {searchQuery
                ? "다른 검색어를 시도해보세요"
                : "새 컬렉션을 생성하여 문서를 업로드하세요"}
            </p>
            {!searchQuery && (
              <Button onClick={() => setCreateModalOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                새 컬렉션 생성
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredCollections.map((collection) => (
            <Card key={collection.name} className="group hover:shadow-md transition-shadow py-3 px-4">
              <div className="flex items-center gap-3">
                {/* 컬렉션 이름 + HoverCard로 설명 표시 */}
                <HoverCard openDelay={300}>
                  <HoverCardTrigger asChild>
                    <button className="font-medium text-sm truncate max-w-[140px] hover:text-primary transition-colors text-left">
                      {collection.name}
                    </button>
                  </HoverCardTrigger>
                  <HoverCardContent className="w-80" side="bottom" align="start">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Database className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{collection.name}</span>
                      </div>
                      {collection.description ? (
                        <p className="text-sm text-muted-foreground">
                          {collection.description}
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">
                          설명 없음
                        </p>
                      )}
                      <div className="flex gap-4 text-xs text-muted-foreground pt-1 border-t">
                        <span>벡터: {collection.vectors_count.toLocaleString()}</span>
                        <span>차원: {collection.vector_size}</span>
                        <span>거리: {collection.distance}</span>
                      </div>
                    </div>
                  </HoverCardContent>
                </HoverCard>

                {/* Visibility 뱃지 (컴팩트) */}
                {getVisibilityBadge(collection.visibility, true)}

                {/* 벡터 수 */}
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  <Database className="h-3 w-3 inline mr-1" />
                  {collection.vectors_count.toLocaleString()}
                </span>

                {/* Spacer */}
                <div className="flex-1" />

                {/* 액션 버튼 (아이콘만) */}
                <div className="flex gap-1">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openSettingsModal(collection)}
                        >
                          <Settings className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>설정</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => openDeleteModal(collection)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>삭제</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="default"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => window.location.href = `/upload?tab=qdrant&collection=${encodeURIComponent(collection.name)}`}
                        >
                          <Upload className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>업로드</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* 하단 안내 */}
      <div className="mt-6 text-center">
        <Button
          variant="link"
          className="text-muted-foreground"
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
      />

      <DeleteConfirmModal
        open={deleteModalOpen}
        onOpenChange={setDeleteModalOpen}
        collectionName={selectedCollection?.name || ""}
        onConfirm={handleDeleteCollection}
      />
    </PageContainer>
  )
}
