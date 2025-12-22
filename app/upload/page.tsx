"use client"

import { useState, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { PageContainer } from "@/components/page-container"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Loader2, Upload, Database, Sparkles, AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import { motion } from "framer-motion"
import { MarkdownViewerModal } from "@/components/markdown-viewer-modal"
import { ServiceHealthBanner } from "@/components/service-health-banner"
import { API_BASE_URL } from "@/lib/api-config"
import { DocumentSelector } from "./components/DocumentSelector"
import { DifySettingsPanel } from "./components/DifySettingsPanel"
import { QdrantSettingsPanel } from "./components/QdrantSettingsPanel"
import { UploadResults } from "./components/UploadResults"
import {
  Document,
  DifyDataset,
  DifyUploadResult,
  QdrantCollection,
  QdrantUploadResult,
  QdrantUploadProgressEvent,
  DuplicateCheckResponse,
  DuplicateInfo,
  UploadTarget,
} from "./types"

// 허용된 탭 값 검증
const VALID_TABS: UploadTarget[] = ["qdrant", "dify"]
const getSafeTab = (tab: string | null): UploadTarget => {
  if (tab && VALID_TABS.includes(tab as UploadTarget)) {
    return tab as UploadTarget
  }
  return "qdrant"
}

function UploadPageContent() {
  const searchParams = useSearchParams()
  const initialTab = getSafeTab(searchParams.get("tab"))

  // 탭 상태
  const [activeTab, setActiveTab] = useState<UploadTarget>(initialTab)

  // 문서 관련 상태
  const [documents, setDocuments] = useState<Document[]>([])
  const [selectedDocs, setSelectedDocs] = useState<Set<number>>(new Set())
  const [selectedDocsInfo, setSelectedDocsInfo] = useState<Map<number, string>>(new Map())
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalDocs, setTotalDocs] = useState(0)
  const [pageSize] = useState(15)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchInput, setSearchInput] = useState("")
  const [loadingDocuments, setLoadingDocuments] = useState(false)

  // Dify 관련 상태 (초기값은 빈 문자열, loadActiveDifyConfig에서 로드)
  const [difyApiKey, setDifyApiKey] = useState("")
  const [difyBaseUrl, setDifyBaseUrl] = useState("")
  const [difyDatasets, setDifyDatasets] = useState<DifyDataset[]>([])
  const [selectedDifyDataset, setSelectedDifyDataset] = useState("")
  const [loadingDifyDatasets, setLoadingDifyDatasets] = useState(false)
  const [difySaveDialogOpen, setDifySaveDialogOpen] = useState(false)
  const [difyConfigName, setDifyConfigName] = useState("")
  const [difyResults, setDifyResults] = useState<DifyUploadResult[]>([])
  const [uploadingDify, setUploadingDify] = useState(false)

  // Qdrant 관련 상태
  const [qdrantCollections, setQdrantCollections] = useState<QdrantCollection[]>([])
  const [selectedQdrantCollection, setSelectedQdrantCollection] = useState("")
  const [chunkSize, setChunkSize] = useState(1000)
  const [chunkOverlap, setChunkOverlap] = useState(200)
  const [loadingQdrantCollections, setLoadingQdrantCollections] = useState(false)
  const [qdrantResults, setQdrantResults] = useState<QdrantUploadResult[]>([])
  const [uploadingQdrant, setUploadingQdrant] = useState(false)
  // Qdrant 업로드 진행률 상태
  const [qdrantProgress, setQdrantProgress] = useState<QdrantUploadProgressEvent | null>(null)
  // 중복 확인 다이얼로그 상태
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false)
  const [duplicateInfo, setDuplicateInfo] = useState<DuplicateInfo[]>([])
  const [newDocumentIds, setNewDocumentIds] = useState<number[]>([])

  // Markdown Viewer 모달 상태
  const [viewerOpen, setViewerOpen] = useState(false)
  const [selectedDocumentId, setSelectedDocumentId] = useState<number | null>(null)

  // 카테고리 필터 관련 상태
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [movingCategory, setMovingCategory] = useState(false)
  const [deletingDocuments, setDeletingDocuments] = useState(false)

  // 문서 목록 가져오기
  const fetchDocuments = async (page = 1, search = "", category = categoryFilter) => {
    setLoadingDocuments(true)
    try {
      const skip = (page - 1) * pageSize
      const params = new URLSearchParams({
        skip: skip.toString(),
        limit: pageSize.toString(),
      })

      if (search) {
        params.append("search", search)
      }

      // 카테고리 필터 적용
      if (category === "uncategorized") {
        params.append("uncategorized", "true")
      } else if (category && category !== "all") {
        params.append("category", category)
      }

      const response = await fetch(`${API_BASE_URL}/api/documents/saved?${params}`, {
        credentials: 'include'
      })
      if (response.ok) {
        const data = await response.json()
        setDocuments(data.items || [])
        setTotalPages(data.total_pages || 1)
        setTotalDocs(data.total || 0)
        setCurrentPage(page)
      }
    } catch (error) {
      console.error("Failed to fetch documents:", error)
      toast.error("문서 목록을 불러오는데 실패했습니다")
    } finally {
      setLoadingDocuments(false)
    }
  }

  // 카테고리 이동 핸들러
  const handleMoveCategory = async (documentIds: number[], category: string | null) => {
    setMovingCategory(true)
    try {
      const response = await fetch(`${API_BASE_URL}/api/documents/category`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({
          document_ids: documentIds,
          category: category
        })
      })

      if (response.ok) {
        const result = await response.json()
        toast.success(`${result.updated_count}개 문서의 카테고리가 변경되었습니다`)
        // 문서 목록 새로고침
        fetchDocuments(currentPage, searchQuery, categoryFilter)
        // 선택 초기화
        setSelectedDocs(new Set())
        setSelectedDocsInfo(new Map())
      } else {
        const error = await response.json()
        toast.error(error.detail || "카테고리 변경에 실패했습니다")
      }
    } catch (error) {
      console.error("Failed to move category:", error)
      toast.error("카테고리 변경에 실패했습니다")
    } finally {
      setMovingCategory(false)
    }
  }

  // 선택된 문서 삭제 핸들러
  const handleDeleteSelectedDocuments = async () => {
    if (selectedDocs.size === 0) return

    const confirmed = window.confirm(`${selectedDocs.size}개 문서를 삭제하시겠습니까?\n\n삭제된 문서는 복구할 수 없습니다.`)
    if (!confirmed) return

    setDeletingDocuments(true)
    let successCount = 0
    let failCount = 0

    try {
      for (const docId of selectedDocs) {
        try {
          const response = await fetch(`${API_BASE_URL}/api/documents/saved/${docId}`, {
            method: 'DELETE',
            credentials: 'include'
          })
          if (response.ok) {
            successCount++
          } else {
            failCount++
          }
        } catch {
          failCount++
        }
      }

      if (successCount > 0 && failCount === 0) {
        toast.success(`${successCount}개 문서가 삭제되었습니다`)
      } else if (successCount > 0) {
        toast.warning(`${successCount}개 삭제, ${failCount}개 실패`)
      } else {
        toast.error('문서 삭제에 실패했습니다')
      }

      setSelectedDocs(new Set())
      setSelectedDocsInfo(new Map())
      fetchDocuments(currentPage, searchQuery, categoryFilter)
    } catch (error) {
      console.error("Failed to delete documents:", error)
      toast.error('삭제 중 오류가 발생했습니다')
    } finally {
      setDeletingDocuments(false)
    }
  }

  // 카테고리 필터 변경 핸들러
  const handleCategoryFilterChange = (category: string) => {
    setCategoryFilter(category)
    setCurrentPage(1)
    fetchDocuments(1, searchQuery, category)
  }

  // Dify 데이터셋 목록 가져오기
  const fetchDifyDatasets = async () => {
    if (!difyApiKey) {
      toast.error("API Key를 입력해주세요")
      return
    }

    setLoadingDifyDatasets(true)
    try {
      const response = await fetch(`${API_BASE_URL}/api/dify/datasets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({ api_key: difyApiKey, base_url: difyBaseUrl })
      })

      if (response.ok) {
        const data = await response.json()
        setDifyDatasets(data.data || [])
        toast.success(`${data.data.length}개의 데이터셋을 불러왔습니다`)
      } else {
        toast.error("데이터셋을 가져오는데 실패했습니다")
      }
    } catch (error) {
      console.error("Failed to fetch Dify datasets:", error)
      toast.error("데이터셋을 가져오는데 실패했습니다")
    } finally {
      setLoadingDifyDatasets(false)
    }
  }

  // Dify 설정 저장
  const saveDifyConfig = async () => {
    if (!difyConfigName.trim()) {
      toast.error("설정 이름을 입력해주세요")
      return
    }

    if (!difyApiKey || !difyBaseUrl) {
      toast.error("API Key와 Base URL을 입력해주세요")
      return
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/dify/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({
          config_name: difyConfigName,
          api_key: difyApiKey,
          base_url: difyBaseUrl,
          default_dataset_id: selectedDifyDataset || null,
          default_dataset_name: difyDatasets.find(d => d.id === selectedDifyDataset)?.name || null
        })
      })

      if (response.ok) {
        toast.success("설정이 저장되었습니다")
        setDifySaveDialogOpen(false)
        setDifyConfigName("")
      } else {
        const error = await response.json()
        toast.error(error.detail || "설정 저장에 실패했습니다")
      }
    } catch (error) {
      console.error("Failed to save Dify config:", error)
      toast.error("설정 저장에 실패했습니다")
    }
  }

  // Dify 활성 설정 불러오기
  const loadActiveDifyConfig = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/dify/config/active`, {
        credentials: 'include'
      })
      if (response.ok) {
        const data = await response.json()
        if (data.api_key) {
          setDifyApiKey(data.api_key)
          setDifyBaseUrl(data.base_url)
          if (data.default_dataset_id) {
            setSelectedDifyDataset(data.default_dataset_id)
          }
        }
      }
    } catch (error) {
      console.error("Failed to load active Dify config:", error)
    }
  }

  // Qdrant Collection 목록 가져오기 (카테고리 통계 포함)
  const fetchQdrantCollections = async () => {
    setLoadingQdrantCollections(true)
    try {
      // Qdrant 컬렉션 목록과 카테고리 통계를 병렬로 가져오기
      const [collectionsRes, categoryStatsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/qdrant/collections`, { credentials: 'include' }),
        fetch(`${API_BASE_URL}/api/documents/categories`, { credentials: 'include' })
      ])

      if (collectionsRes.ok) {
        const collectionsData = await collectionsRes.json()

        // 카테고리 통계를 맵으로 변환 (category name -> document count)
        let categoryCountMap: Record<string, number> = {}
        if (categoryStatsRes.ok) {
          const categoryStats = await categoryStatsRes.json()
          categoryCountMap = (categoryStats.categories || []).reduce(
            (acc: Record<string, number>, cat: { name: string | null; count: number }) => {
              if (cat.name) {
                acc[cat.name] = cat.count
              }
              return acc
            },
            {}
          )
        }

        // 컬렉션에 카테고리 문서 수 병합
        const collectionsWithCategoryCount = (collectionsData.collections || []).map(
          (col: QdrantCollection) => ({
            ...col,
            documents_count: categoryCountMap[col.name] || 0  // Qdrant 문서수 대신 카테고리 문서수
          })
        )

        // 컬렉션명으로 오름차순 정렬
        const sortedCollections = [...collectionsWithCategoryCount].sort((a, b) =>
          a.name.localeCompare(b.name, 'ko-KR')
        )
        setQdrantCollections(sortedCollections)
        toast.success(`${collectionsData.collections.length}개의 Collection을 불러왔습니다`)
      } else {
        toast.error("Collection 목록을 가져오는데 실패했습니다")
      }
    } catch (error) {
      console.error("Failed to fetch Qdrant collections:", error)
      toast.error("Collection 목록을 가져오는데 실패했습니다")
    } finally {
      setLoadingQdrantCollections(false)
    }
  }

  // Qdrant 청킹 설정 불러오기
  const fetchQdrantConfig = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/qdrant/config`, {
        credentials: 'include'
      })
      if (response.ok) {
        const data = await response.json()
        setChunkSize(data.default_chunk_size)
        setChunkOverlap(data.default_chunk_overlap)
      }
    } catch (error) {
      console.error("Failed to fetch Qdrant config:", error)
    }
  }

  // Dify 업로드
  const uploadToDify = async () => {
    if (!difyApiKey || !selectedDifyDataset) {
      toast.error("API Key와 데이터셋을 선택해주세요")
      return
    }

    if (selectedDocs.size === 0) {
      toast.error("업로드할 문서를 선택해주세요")
      return
    }

    setUploadingDify(true)
    setDifyResults([])

    try {
      const selectedDatasetName = difyDatasets.find(d => d.id === selectedDifyDataset)?.name || null

      const response = await fetch(`${API_BASE_URL}/api/dify/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({
          api_key: difyApiKey,
          base_url: difyBaseUrl,
          dataset_id: selectedDifyDataset,
          dataset_name: selectedDatasetName,
          document_ids: Array.from(selectedDocs)
        })
      })

      if (response.ok) {
        const data = await response.json()
        setDifyResults(data.results)

        if (data.success_count > 0 && data.failure_count === 0) {
          toast.success(`${data.success_count}개 문서가 성공적으로 업로드되었습니다`)
          setSelectedDocs(new Set())
          setSelectedDocsInfo(new Map())
        } else if (data.success_count > 0) {
          toast.warning(`${data.success_count}개 성공, ${data.failure_count}개 실패`)
          setSelectedDocs(new Set())
          setSelectedDocsInfo(new Map())
        } else {
          toast.error("모든 문서 업로드에 실패했습니다")
        }
      } else {
        toast.error("업로드에 실패했습니다")
      }
    } catch (error) {
      console.error("Failed to upload to Dify:", error)
      toast.error("업로드에 실패했습니다")
    } finally {
      setUploadingDify(false)
    }
  }

  // 중복 확인 후 업로드 시작
  const uploadToQdrant = async () => {
    if (!selectedQdrantCollection) {
      toast.error("대상 Collection을 선택해주세요")
      return
    }

    if (selectedDocs.size === 0) {
      toast.error("업로드할 문서를 선택해주세요")
      return
    }

    // 중복 확인
    try {
      const checkResponse = await fetch(`${API_BASE_URL}/api/qdrant/check-duplicates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({
          collection_name: selectedQdrantCollection,
          document_ids: Array.from(selectedDocs)
        })
      })

      if (checkResponse.ok) {
        const checkData: DuplicateCheckResponse = await checkResponse.json()

        if (checkData.has_duplicates) {
          // 중복 있음 - 다이얼로그 표시
          setDuplicateInfo(checkData.duplicates)
          setNewDocumentIds(checkData.new_documents)
          setDuplicateDialogOpen(true)
          return
        }
      }
    } catch (error) {
      console.error("Failed to check duplicates:", error)
      // 중복 확인 실패해도 업로드 진행
    }

    // 중복 없으면 바로 업로드
    await executeQdrantUpload(Array.from(selectedDocs))
  }

  // 실제 Qdrant 업로드 실행 (SSE 스트리밍)
  const executeQdrantUpload = async (documentIds: number[]) => {
    if (documentIds.length === 0) {
      toast.info("업로드할 문서가 없습니다")
      return
    }

    setUploadingQdrant(true)
    setQdrantResults([])
    setQdrantProgress(null)
    setDuplicateDialogOpen(false)

    try {
      const response = await fetch(`${API_BASE_URL}/api/qdrant/upload/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({
          collection_name: selectedQdrantCollection,
          document_ids: documentIds,
          chunk_size: chunkSize,
          chunk_overlap: chunkOverlap
        })
      })

      if (!response.ok) {
        toast.error("업로드에 실패했습니다")
        setUploadingQdrant(false)
        return
      }

      const reader = response.body?.getReader()
      if (!reader) {
        toast.error("스트리밍을 시작할 수 없습니다")
        setUploadingQdrant(false)
        return
      }

      const decoder = new TextDecoder()
      const results: QdrantUploadResult[] = []

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const eventData = JSON.parse(line.slice(6)) as QdrantUploadProgressEvent
              setQdrantProgress(eventData)

              // 문서 완료 시 결과 추가
              if (eventData.event_type === "document_complete" && eventData.document_id) {
                results.push({
                  document_id: eventData.document_id,
                  filename: eventData.filename || "Unknown",
                  success: true,
                  chunk_count: eventData.chunk_count || 0,
                  vector_ids: eventData.vector_ids || [],
                  error: null
                })
                setQdrantResults([...results])
              }

              // 에러 시 결과 추가
              if (eventData.event_type === "error" && eventData.document_id) {
                results.push({
                  document_id: eventData.document_id,
                  filename: eventData.filename || "Unknown",
                  success: false,
                  chunk_count: 0,
                  vector_ids: [],
                  error: eventData.error || "업로드 실패"
                })
                setQdrantResults([...results])
              }

              // 완료 시
              if (eventData.event_type === "done") {
                if (eventData.success_count > 0 && eventData.failure_count === 0) {
                  toast.success(`${eventData.success_count}개 문서가 성공적으로 업로드되었습니다`)
                  setSelectedDocs(new Set())
                  setSelectedDocsInfo(new Map())
                } else if (eventData.success_count > 0) {
                  toast.warning(`${eventData.success_count}개 성공, ${eventData.failure_count}개 실패`)
                  setSelectedDocs(new Set())
                  setSelectedDocsInfo(new Map())
                } else {
                  toast.error("모든 문서 업로드에 실패했습니다")
                }
              }
            } catch (parseError) {
              console.error("Failed to parse SSE event:", parseError)
            }
          }
        }
      }
    } catch (error) {
      console.error("Failed to upload to Qdrant:", error)
      toast.error("업로드에 실패했습니다")
    } finally {
      setUploadingQdrant(false)
      setQdrantProgress(null)
    }
  }

  // 문서 선택/해제
  const toggleDocument = (id: number, filename?: string) => {
    const newSelected = new Set(selectedDocs)
    const newInfo = new Map(selectedDocsInfo)

    if (newSelected.has(id)) {
      newSelected.delete(id)
      newInfo.delete(id)
    } else {
      newSelected.add(id)
      if (filename) {
        newInfo.set(id, filename)
      } else {
        const doc = documents.find(d => d.id === id)
        if (doc) {
          newInfo.set(id, doc.original_filename)
        }
      }
    }
    setSelectedDocs(newSelected)
    setSelectedDocsInfo(newInfo)
  }

  // 전체 선택/해제
  const toggleAll = () => {
    if (selectedDocs.size === documents.length) {
      setSelectedDocs(new Set())
      setSelectedDocsInfo(new Map())
    } else {
      const newSelected = new Set(documents.map(d => d.id))
      const newInfo = new Map(documents.map(d => [d.id, d.original_filename]))
      setSelectedDocs(newSelected)
      setSelectedDocsInfo(newInfo)
    }
  }

  // 개별 문서 선택 해제
  const deselectDocument = (id: number) => {
    const newSelected = new Set(selectedDocs)
    const newInfo = new Map(selectedDocsInfo)
    newSelected.delete(id)
    newInfo.delete(id)
    setSelectedDocs(newSelected)
    setSelectedDocsInfo(newInfo)
  }

  // 검색 실행
  const handleSearch = () => {
    setSearchQuery(searchInput)
    setCurrentPage(1)
    fetchDocuments(1, searchInput)
  }

  // 검색 초기화
  const handleSearchReset = () => {
    setSearchInput("")
    setSearchQuery("")
    fetchDocuments(1, "")
  }

  // 페이지 변경
  const handlePageChange = (page: number) => {
    if (page < 1 || page > totalPages) return
    fetchDocuments(page, searchQuery)
  }

  // 문서 뷰어 열기
  const openDocumentViewer = (documentId: number) => {
    setSelectedDocumentId(documentId)
    setViewerOpen(true)
  }

  // 초기 로드
  useEffect(() => {
    fetchDocuments()
    loadActiveDifyConfig()
    fetchQdrantCollections()
    fetchQdrantConfig()
  }, [])

  // 현재 업로드 중 상태
  const isUploading = uploadingDify || uploadingQdrant

  // 업로드 비활성화 조건
  const isDifyUploadDisabled = uploadingDify || selectedDocs.size === 0 || !selectedDifyDataset || !difyApiKey
  const isQdrantUploadDisabled = uploadingQdrant || selectedDocs.size === 0 || !selectedQdrantCollection

  return (
    <PageContainer maxWidth="wide" className="space-y-4">
      {/* Service Health Banner */}
      <ServiceHealthBanner />

      {/* Page Header */}
      <div className="flex items-center">
        <h1 className="text-lg font-semibold flex items-center gap-2">
          <Upload className="h-5 w-5 text-muted-foreground" />
          벡터임베딩
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[7fr_3fr] gap-6">
        {/* 좌측: 문서 목록 (70%) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="space-y-4 min-w-0"
        >
          <DocumentSelector
            documents={documents}
            selectedDocs={selectedDocs}
            selectedDocsInfo={selectedDocsInfo}
            currentPage={currentPage}
            totalPages={totalPages}
            totalDocs={totalDocs}
            pageSize={pageSize}
            searchInput={searchInput}
            searchQuery={searchQuery}
            loadingDocuments={loadingDocuments}
            onToggleDocument={toggleDocument}
            onToggleAll={toggleAll}
            onDeselectDocument={deselectDocument}
            onSearch={handleSearch}
            onSearchInputChange={setSearchInput}
            onSearchReset={handleSearchReset}
            onPageChange={handlePageChange}
            onOpenDocumentViewer={openDocumentViewer}
            // 카테고리 관련 props
            collections={qdrantCollections}
            categoryFilter={categoryFilter}
            onCategoryFilterChange={handleCategoryFilterChange}
            onMoveCategory={handleMoveCategory}
            movingCategory={movingCategory}
            onDeleteSelected={handleDeleteSelectedDocuments}
            deletingDocuments={deletingDocuments}
          />
        </motion.div>

        {/* 우측: Qdrant/Dify 설정 (30%) - Sticky */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="lg:sticky lg:top-4 lg:self-start min-w-0 overflow-hidden"
        >
          <Card className="min-w-0 overflow-hidden border-border/50 bg-background/60 backdrop-blur-sm shadow-xl shadow-[color:var(--chart-1)]/5">
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as UploadTarget)}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-[color:var(--chart-1)]/10 to-[color:var(--chart-2)]/10">
                    <Upload className="h-5 w-5 text-[color:var(--chart-1)]" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-semibold">임베딩 업로드</CardTitle>
                    <CardDescription className="mt-0.5 text-sm">
                      벡터 DB 또는 지식베이스 선택
                    </CardDescription>
                  </div>
                </div>

                {/* Enhanced Tabs */}
                <TabsList className="w-full h-11 p-1 bg-muted/50">
                  <TabsTrigger value="qdrant" className="flex-1 gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                    <Database className="h-4 w-4" />
                    Vector DB
                  </TabsTrigger>
                  <TabsTrigger value="dify" className="flex-1 gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                    <Sparkles className="h-4 w-4" />
                    Dify
                  </TabsTrigger>
                </TabsList>
              </CardHeader>

              <CardContent>

                {/* Qdrant 탭 */}
                <TabsContent value="qdrant" className="space-y-4 m-0 p-0">
              <QdrantSettingsPanel
                selectedCollection={selectedQdrantCollection}
                collections={qdrantCollections}
                chunkSize={chunkSize}
                chunkOverlap={chunkOverlap}
                loadingCollections={loadingQdrantCollections}
                onSelectedCollectionChange={setSelectedQdrantCollection}
                onChunkSizeChange={setChunkSize}
                onChunkOverlapChange={setChunkOverlap}
                onFetchCollections={fetchQdrantCollections}
              />

              {!selectedQdrantCollection && selectedDocs.size > 0 && (
                <Alert variant="default" className="border-[color:var(--chart-1)]/20 bg-[color:var(--chart-1)]/5">
                  <AlertDescription className="text-sm">
                    업로드하려면 상단에서 Collection을 먼저 선택해주세요.
                  </AlertDescription>
                </Alert>
              )}

              {/* 업로드 버튼 */}
              <div className="flex items-center gap-3 pt-2">
                <Button
                  onClick={uploadToQdrant}
                  disabled={isQdrantUploadDisabled}
                  size="lg"
                  className="flex-1 gap-2 shadow-lg shadow-[color:var(--chart-1)]/20 hover:shadow-[color:var(--chart-1)]/40 hover:scale-[1.02] active:scale-[0.98] transition-all bg-[color:var(--chart-1)] hover:bg-[color:var(--chart-1)]/90"
                >
                  {uploadingQdrant ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      업로드 중...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      Vector DB 업로드
                    </>
                  )}
                </Button>
                {selectedDocs.size > 0 && (
                  <Badge variant="secondary" className="text-sm px-3 py-2 bg-[color:var(--chart-1)]/10 text-[color:var(--chart-1)] border-[color:var(--chart-1)]/20">
                    {selectedDocs.size}
                  </Badge>
                )}
              </div>

              {/* 진행률 표시 */}
              {qdrantProgress && uploadingQdrant && (
                <div className="space-y-3 p-4 rounded-lg border border-[color:var(--chart-1)]/20 bg-[color:var(--chart-1)]/5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {qdrantProgress.filename && (
                        <span className="font-medium text-foreground">{qdrantProgress.filename}</span>
                      )}
                      {qdrantProgress.phase && (
                        <span className="ml-2 text-[color:var(--chart-1)]">
                          ({qdrantProgress.phase === "chunking" && "청킹 중"}
                          {qdrantProgress.phase === "embedding" && "임베딩 생성 중"}
                          {qdrantProgress.phase === "uploading" && "업로드 중"}
                          {qdrantProgress.phase === "completed" && "완료"})
                        </span>
                      )}
                    </span>
                    <span className="font-medium">
                      {qdrantProgress.current_doc_index} / {qdrantProgress.total_docs}
                    </span>
                  </div>
                  <Progress value={(qdrantProgress.current_doc_index / qdrantProgress.total_docs) * 100} className="h-2" />
                  {qdrantProgress.chunk_count && (
                    <div className="text-xs text-muted-foreground">
                      청크 수: {qdrantProgress.chunk_count}
                    </div>
                  )}
                </div>
              )}

              <UploadResults
                uploadTarget="qdrant"
                difyResults={[]}
                qdrantResults={qdrantResults}
              />
            </TabsContent>

              {/* Dify 탭 */}
              <TabsContent value="dify" className="space-y-4 m-0 p-0">
                <DifySettingsPanel
                apiKey={difyApiKey}
                baseUrl={difyBaseUrl}
                selectedDataset={selectedDifyDataset}
                datasets={difyDatasets}
                loadingDatasets={loadingDifyDatasets}
                saveDialogOpen={difySaveDialogOpen}
                configName={difyConfigName}
                onApiKeyChange={setDifyApiKey}
                onBaseUrlChange={setDifyBaseUrl}
                onSelectedDatasetChange={setSelectedDifyDataset}
                onFetchDatasets={fetchDifyDatasets}
                onSaveDialogOpenChange={setDifySaveDialogOpen}
                onConfigNameChange={setDifyConfigName}
                onSaveConfig={saveDifyConfig}
              />

              {(!difyApiKey || !selectedDifyDataset) && selectedDocs.size > 0 && (
                <Alert variant="default" className="border-[color:var(--chart-2)]/20 bg-[color:var(--chart-2)]/5">
                  <AlertDescription className="text-sm">
                    업로드하려면 상단에서 API Key와 데이터셋을 먼저 설정해주세요.
                  </AlertDescription>
                </Alert>
              )}

              {/* 업로드 버튼 */}
              <div className="flex items-center gap-3 pt-2">
                <Button
                  onClick={uploadToDify}
                  disabled={isDifyUploadDisabled}
                  size="lg"
                  className="flex-1 gap-2 shadow-lg shadow-[color:var(--chart-2)]/20 hover:shadow-[color:var(--chart-2)]/40 hover:scale-[1.02] active:scale-[0.98] transition-all bg-[color:var(--chart-2)] hover:bg-[color:var(--chart-2)]/90"
                >
                  {uploadingDify ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      업로드 중...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Dify 업로드
                    </>
                  )}
                </Button>
                {selectedDocs.size > 0 && (
                  <Badge variant="secondary" className="text-sm px-3 py-2 bg-[color:var(--chart-2)]/10 text-[color:var(--chart-2)] border-[color:var(--chart-2)]/20">
                    {selectedDocs.size}
                  </Badge>
                )}
              </div>

              <UploadResults
                uploadTarget="dify"
                difyResults={difyResults}
                qdrantResults={[]}
              />
              </TabsContent>
              </CardContent>
            </Tabs>
          </Card>
        </motion.div>
      </div>

      {/* Markdown Viewer 모달 */}
      <MarkdownViewerModal
        documentId={selectedDocumentId}
        open={viewerOpen}
        onOpenChange={setViewerOpen}
      />

      {/* 중복 확인 다이얼로그 */}
      <Dialog open={duplicateDialogOpen} onOpenChange={setDuplicateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              중복 문서 발견
            </DialogTitle>
            <DialogDescription>
              다음 문서는 이미 "{selectedQdrantCollection}" 컬렉션에 업로드되어 있습니다.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-48 overflow-y-auto space-y-2">
            {duplicateInfo.map((dup) => (
              <div
                key={dup.document_id}
                className="flex items-center justify-between p-2 rounded bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800"
              >
                <span className="text-sm font-medium truncate">{dup.filename}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(dup.uploaded_at).toLocaleDateString("ko-KR")}
                </span>
              </div>
            ))}
          </div>

          {newDocumentIds.length > 0 && (
            <p className="text-sm text-muted-foreground">
              신규 문서 {newDocumentIds.length}개는 업로드됩니다.
            </p>
          )}

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setDuplicateDialogOpen(false)}
            >
              취소
            </Button>
            {newDocumentIds.length > 0 && (
              <Button
                variant="secondary"
                onClick={() => executeQdrantUpload(newDocumentIds)}
              >
                신규만 업로드 ({newDocumentIds.length}개)
              </Button>
            )}
            <Button
              variant="default"
              onClick={() => executeQdrantUpload([
                ...newDocumentIds,
                ...duplicateInfo.map(d => d.document_id)
              ])}
            >
              모두 업로드
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  )
}

export default function UploadPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <UploadPageContent />
    </Suspense>
  )
}
