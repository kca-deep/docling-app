"use client"

import { useState, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { PageContainer } from "@/components/page-container"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, Upload, Database, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { motion } from "framer-motion"
import { MarkdownViewerModal } from "@/components/markdown-viewer-modal"
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
  const [pageSize] = useState(10)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchInput, setSearchInput] = useState("")
  const [loadingDocuments, setLoadingDocuments] = useState(false)

  // Dify 관련 상태
  const [difyApiKey, setDifyApiKey] = useState("dataset-tTuWMwOLTw6Lhhmihan6uszE")
  const [difyBaseUrl, setDifyBaseUrl] = useState("http://ai.kca.kr:5001/v1")
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

  // Markdown Viewer 모달 상태
  const [viewerOpen, setViewerOpen] = useState(false)
  const [selectedDocumentId, setSelectedDocumentId] = useState<number | null>(null)

  // 카테고리 필터 관련 상태
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [movingCategory, setMovingCategory] = useState(false)

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

  // Qdrant 업로드
  const uploadToQdrant = async () => {
    if (!selectedQdrantCollection) {
      toast.error("대상 Collection을 선택해주세요")
      return
    }

    if (selectedDocs.size === 0) {
      toast.error("업로드할 문서를 선택해주세요")
      return
    }

    setUploadingQdrant(true)
    setQdrantResults([])

    try {
      const response = await fetch(`${API_BASE_URL}/api/qdrant/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({
          collection_name: selectedQdrantCollection,
          document_ids: Array.from(selectedDocs),
          chunk_size: chunkSize,
          chunk_overlap: chunkOverlap
        })
      })

      if (response.ok) {
        const data = await response.json()
        setQdrantResults(data.results)

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
      console.error("Failed to upload to Qdrant:", error)
      toast.error("업로드에 실패했습니다")
    } finally {
      setUploadingQdrant(false)
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
    <PageContainer maxWidth="wide" className="py-8 space-y-8">
      {/* Background Noise & Gradient */}
      <div className="absolute inset-0 bg-noise opacity-30 pointer-events-none -z-10" />
      <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-[color:var(--chart-1)]/5 to-transparent -z-10" />

      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10"
      >
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-[color:var(--chart-1)] to-[color:var(--chart-2)] text-white shadow-lg shadow-[color:var(--chart-1)]/20">
            <Upload className="h-5 w-5" />
          </div>
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
            문서업로드
          </span>
        </h1>
        <p className="text-muted-foreground mt-3 text-lg max-w-2xl">
          파싱된 문서를 벡터 데이터베이스 또는 Dify 지식베이스에 업로드하세요.
        </p>
      </motion.div>

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
