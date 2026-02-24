import { useState, useEffect } from "react"
import { toast } from "sonner"
import { API_BASE_URL } from "@/lib/api-config"
import type {
  Document,
  DifyDataset,
  DifyUploadResult,
  QdrantCollection,
  QdrantUploadResult,
  QdrantUploadProgressEvent,
  DuplicateCheckResponse,
  DuplicateInfo,
  UploadTarget,
} from "../types"

interface UseUploadPageDataOptions {
  initialTab: UploadTarget
  initialCollection: string | null
}

export function useUploadPageData({ initialTab, initialCollection }: UseUploadPageDataOptions) {
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

  // Dify 관련 상태
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

  // =========================================================
  // 문서 관련 핸들러
  // =========================================================

  const fetchDocuments = async (page = 1, search = "", category = categoryFilter) => {
    setLoadingDocuments(true)
    try {
      const skip = (page - 1) * pageSize
      const params = new URLSearchParams({
        skip: skip.toString(),
        limit: pageSize.toString(),
      })
      if (search) params.append("search", search)
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

  const handleMoveCategory = async (documentIds: number[], category: string | null) => {
    setMovingCategory(true)
    try {
      const response = await fetch(`${API_BASE_URL}/api/documents/category`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({ document_ids: documentIds, category })
      })
      if (response.ok) {
        const result = await response.json()
        toast.success(`${result.updated_count}개 문서의 카테고리가 변경되었습니다`)
        fetchDocuments(currentPage, searchQuery, categoryFilter)
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
            method: 'DELETE', credentials: 'include'
          })
          if (response.ok) successCount++
          else failCount++
        } catch { failCount++ }
      }

      if (successCount > 0 && failCount === 0) toast.success(`${successCount}개 문서가 삭제되었습니다`)
      else if (successCount > 0) toast.warning(`${successCount}개 삭제, ${failCount}개 실패`)
      else toast.error('문서 삭제에 실패했습니다')

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

  const handleCategoryFilterChange = (category: string) => {
    setCategoryFilter(category)
    setCurrentPage(1)
    fetchDocuments(1, searchQuery, category)
  }

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
        if (doc) newInfo.set(id, doc.original_filename)
      }
    }
    setSelectedDocs(newSelected)
    setSelectedDocsInfo(newInfo)
  }

  const toggleAll = () => {
    if (selectedDocs.size === documents.length) {
      setSelectedDocs(new Set())
      setSelectedDocsInfo(new Map())
    } else {
      setSelectedDocs(new Set(documents.map(d => d.id)))
      setSelectedDocsInfo(new Map(documents.map(d => [d.id, d.original_filename])))
    }
  }

  const deselectDocument = (id: number) => {
    const newSelected = new Set(selectedDocs)
    const newInfo = new Map(selectedDocsInfo)
    newSelected.delete(id)
    newInfo.delete(id)
    setSelectedDocs(newSelected)
    setSelectedDocsInfo(newInfo)
  }

  const handleSearch = () => {
    setSearchQuery(searchInput)
    setCurrentPage(1)
    fetchDocuments(1, searchInput)
  }

  const handleSearchReset = () => {
    setSearchInput("")
    setSearchQuery("")
    fetchDocuments(1, "")
  }

  const handlePageChange = (page: number) => {
    if (page < 1 || page > totalPages) return
    fetchDocuments(page, searchQuery)
  }

  const openDocumentViewer = (documentId: number) => {
    setSelectedDocumentId(documentId)
    setViewerOpen(true)
  }

  // =========================================================
  // Dify 핸들러
  // =========================================================

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

  const saveDifyConfig = async () => {
    if (!difyConfigName.trim()) { toast.error("설정 이름을 입력해주세요"); return }
    if (!difyApiKey || !difyBaseUrl) { toast.error("API Key와 Base URL을 입력해주세요"); return }

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

  const loadActiveDifyConfig = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/dify/config/active`, { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        if (data.api_key) {
          setDifyApiKey(data.api_key)
          setDifyBaseUrl(data.base_url)
          if (data.default_dataset_id) setSelectedDifyDataset(data.default_dataset_id)
        }
      }
    } catch (error) {
      console.error("Failed to load active Dify config:", error)
    }
  }

  const uploadToDify = async () => {
    if (!difyApiKey || !selectedDifyDataset) { toast.error("API Key와 데이터셋을 선택해주세요"); return }
    if (selectedDocs.size === 0) { toast.error("업로드할 문서를 선택해주세요"); return }

    setUploadingDify(true)
    setDifyResults([])
    try {
      const selectedDatasetName = difyDatasets.find(d => d.id === selectedDifyDataset)?.name || null
      const response = await fetch(`${API_BASE_URL}/api/dify/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({
          api_key: difyApiKey, base_url: difyBaseUrl,
          dataset_id: selectedDifyDataset, dataset_name: selectedDatasetName,
          document_ids: Array.from(selectedDocs)
        })
      })
      if (response.ok) {
        const data = await response.json()
        setDifyResults(data.results)
        if (data.success_count > 0 && data.failure_count === 0) {
          toast.success(`${data.success_count}개 문서가 성공적으로 업로드되었습니다`)
          setSelectedDocs(new Set()); setSelectedDocsInfo(new Map())
        } else if (data.success_count > 0) {
          toast.warning(`${data.success_count}개 성공, ${data.failure_count}개 실패`)
          setSelectedDocs(new Set()); setSelectedDocsInfo(new Map())
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

  // =========================================================
  // Qdrant 핸들러
  // =========================================================

  const fetchQdrantCollections = async () => {
    setLoadingQdrantCollections(true)
    try {
      const [collectionsRes, categoryStatsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/qdrant/collections`, { credentials: 'include' }),
        fetch(`${API_BASE_URL}/api/documents/categories`, { credentials: 'include' })
      ])
      if (collectionsRes.ok) {
        const collectionsData = await collectionsRes.json()
        let categoryCountMap: Record<string, number> = {}
        if (categoryStatsRes.ok) {
          const categoryStats = await categoryStatsRes.json()
          categoryCountMap = (categoryStats.categories || []).reduce(
            (acc: Record<string, number>, cat: { name: string | null; count: number }) => {
              if (cat.name) acc[cat.name] = cat.count
              return acc
            }, {}
          )
        }
        const collectionsWithCategoryCount = (collectionsData.collections || []).map(
          (col: QdrantCollection) => ({
            ...col,
            documents_count: categoryCountMap[col.name] || 0
          })
        )
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

  const fetchQdrantConfig = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/qdrant/config`, { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        setChunkSize(data.default_chunk_size)
        setChunkOverlap(data.default_chunk_overlap)
      }
    } catch (error) {
      console.error("Failed to fetch Qdrant config:", error)
    }
  }

  const executeQdrantUpload = async (documentIds: number[]) => {
    if (documentIds.length === 0) { toast.info("업로드할 문서가 없습니다"); return }

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

      if (!response.ok) { toast.error("업로드에 실패했습니다"); setUploadingQdrant(false); return }

      const reader = response.body?.getReader()
      if (!reader) { toast.error("스트리밍을 시작할 수 없습니다"); setUploadingQdrant(false); return }

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

              if (eventData.event_type === "document_complete" && eventData.document_id) {
                results.push({
                  document_id: eventData.document_id,
                  filename: eventData.filename || "Unknown",
                  success: true, chunk_count: eventData.chunk_count || 0,
                  vector_ids: eventData.vector_ids || [], error: null
                })
                setQdrantResults([...results])
              }
              if (eventData.event_type === "error" && eventData.document_id) {
                results.push({
                  document_id: eventData.document_id,
                  filename: eventData.filename || "Unknown",
                  success: false, chunk_count: 0, vector_ids: [],
                  error: eventData.error || "업로드 실패"
                })
                setQdrantResults([...results])
              }
              if (eventData.event_type === "done") {
                if (eventData.success_count > 0 && eventData.failure_count === 0) {
                  toast.success(`${eventData.success_count}개 문서가 성공적으로 업로드되었습니다`)
                  setSelectedDocs(new Set()); setSelectedDocsInfo(new Map())
                } else if (eventData.success_count > 0) {
                  toast.warning(`${eventData.success_count}개 성공, ${eventData.failure_count}개 실패`)
                  setSelectedDocs(new Set()); setSelectedDocsInfo(new Map())
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

  const uploadToQdrant = async () => {
    if (!selectedQdrantCollection) { toast.error("대상 Collection을 선택해주세요"); return }
    if (selectedDocs.size === 0) { toast.error("업로드할 문서를 선택해주세요"); return }

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
          setDuplicateInfo(checkData.duplicates)
          setNewDocumentIds(checkData.new_documents)
          setDuplicateDialogOpen(true)
          return
        }
      }
    } catch (error) {
      console.error("Failed to check duplicates:", error)
    }
    await executeQdrantUpload(Array.from(selectedDocs))
  }

  // =========================================================
  // 초기 로드
  // =========================================================

  useEffect(() => {
    fetchDocuments()
    loadActiveDifyConfig()
    fetchQdrantCollections()
    fetchQdrantConfig()
  }, [])

  useEffect(() => {
    if (initialCollection && qdrantCollections.length > 0 && !selectedQdrantCollection) {
      const found = qdrantCollections.find(c => c.name === initialCollection)
      if (found) {
        setSelectedQdrantCollection(found.name)
        setCategoryFilter(found.name)
        fetchDocuments(1, "", found.name)
      }
    }
  }, [initialCollection, qdrantCollections])

  // 파생 상태
  const isUploading = uploadingDify || uploadingQdrant
  const isDifyUploadDisabled = uploadingDify || selectedDocs.size === 0 || !selectedDifyDataset || !difyApiKey
  const isQdrantUploadDisabled = uploadingQdrant || selectedDocs.size === 0 || !selectedQdrantCollection

  return {
    // 탭
    activeTab, setActiveTab,
    // 문서
    documents, selectedDocs, selectedDocsInfo, currentPage, totalPages, totalDocs, pageSize,
    searchInput, searchQuery, loadingDocuments,
    toggleDocument, toggleAll, deselectDocument,
    handleSearch, handleSearchReset, handlePageChange, openDocumentViewer,
    setSearchInput,
    // 카테고리
    categoryFilter, handleCategoryFilterChange, handleMoveCategory, movingCategory,
    handleDeleteSelectedDocuments, deletingDocuments,
    qdrantCollections,
    // Dify
    difyApiKey, setDifyApiKey, difyBaseUrl, setDifyBaseUrl,
    difyDatasets, selectedDifyDataset, setSelectedDifyDataset,
    loadingDifyDatasets, difySaveDialogOpen, setDifySaveDialogOpen,
    difyConfigName, setDifyConfigName, difyResults, uploadingDify,
    fetchDifyDatasets, saveDifyConfig, uploadToDify,
    // Qdrant
    selectedQdrantCollection, setSelectedQdrantCollection,
    chunkSize, setChunkSize, chunkOverlap, setChunkOverlap,
    loadingQdrantCollections, qdrantResults, uploadingQdrant,
    qdrantProgress, fetchQdrantCollections, uploadToQdrant, executeQdrantUpload,
    // 중복
    duplicateDialogOpen, setDuplicateDialogOpen, duplicateInfo, newDocumentIds,
    // 뷰어
    viewerOpen, setViewerOpen, selectedDocumentId,
    // 파생
    isUploading, isDifyUploadDisabled, isQdrantUploadDisabled,
  }
}
