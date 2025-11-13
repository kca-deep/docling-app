"use client"

import { useState, useEffect } from "react"
import { PageContainer } from "@/components/page-container"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination"
import { Loader2, CheckCircle2, XCircle, Upload, Database, FileText, Search, X, RefreshCw, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { MarkdownViewerModal } from "@/components/markdown-viewer-modal"
import { API_BASE_URL } from "@/lib/api-config"

interface Document {
  id: number
  task_id: string
  original_filename: string
  content_length: number | null
  content_preview: string | null
  processing_time: number | null
  created_at: string
}

interface QdrantCollection {
  name: string
  vectors_count: number
  points_count: number
  vector_size: number
  distance: string
}

interface UploadResult {
  document_id: number
  filename: string
  success: boolean
  chunk_count: number
  vector_ids: string[]
  error: string | null
}

export default function QdrantPage() {
  // 문서 관련 상태
  const [documents, setDocuments] = useState<Document[]>([])
  const [selectedDocs, setSelectedDocs] = useState<Set<number>>(new Set())
  const [selectedDocsInfo, setSelectedDocsInfo] = useState<Map<number, string>>(new Map())
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalDocs, setTotalDocs] = useState(0)
  const [pageSize] = useState(20)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchInput, setSearchInput] = useState("")

  // Collection 관련 상태
  const [collections, setCollections] = useState<QdrantCollection[]>([])
  const [selectedCollection, setSelectedCollection] = useState("")

  // 청킹 설정
  const [chunkSize, setChunkSize] = useState(1000)
  const [chunkOverlap, setChunkOverlap] = useState(200)

  // Collection 생성 Dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [newCollectionName, setNewCollectionName] = useState("")
  const [distance, setDistance] = useState("Cosine")

  // Collection 삭제 Dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // 업로드 결과
  const [uploadResults, setUploadResults] = useState<UploadResult[]>([])

  // 로딩 상태
  const [loadingDocuments, setLoadingDocuments] = useState(false)
  const [loadingCollections, setLoadingCollections] = useState(false)
  const [uploading, setUploading] = useState(false)

  // Markdown Viewer 모달 상태
  const [viewerOpen, setViewerOpen] = useState(false)
  const [selectedDocumentId, setSelectedDocumentId] = useState<number | null>(null)

  // 저장된 문서 목록 가져오기
  const fetchDocuments = async (page = 1, search = "") => {
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

      const response = await fetch(`${API_BASE_URL}/api/documents/saved?${params}`)
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

  // 청킹 설정값 가져오기
  const fetchConfig = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/qdrant/config`)
      if (response.ok) {
        const data = await response.json()
        setChunkSize(data.default_chunk_size)
        setChunkOverlap(data.default_chunk_overlap)
      }
    } catch (error) {
      console.error("Failed to fetch config:", error)
    }
  }

  // Collection 목록 가져오기
  const fetchCollections = async () => {
    setLoadingCollections(true)
    try {
      const response = await fetch(`${API_BASE_URL}/api/qdrant/collections`)
      if (response.ok) {
        const data = await response.json()
        setCollections(data.collections || [])
        toast.success(`${data.collections.length}개의 Collection을 불러왔습니다`)
      } else {
        toast.error("Collection 목록을 가져오는데 실패했습니다")
      }
    } catch (error) {
      console.error("Failed to fetch collections:", error)
      toast.error("Collection 목록을 가져오는데 실패했습니다")
    } finally {
      setLoadingCollections(false)
    }
  }

  // Collection 생성
  const createCollection = async () => {
    if (!newCollectionName) {
      toast.error("Collection 이름을 입력해주세요")
      return
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/qdrant/collections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          collection_name: newCollectionName,
          vector_size: 1024,
          distance: distance
        })
      })

      if (response.ok) {
        toast.success(`Collection '${newCollectionName}'이 생성되었습니다`)
        setNewCollectionName("")
        setCreateDialogOpen(false)
        fetchCollections()
      } else {
        const error = await response.json()
        toast.error(error.detail || "Collection 생성에 실패했습니다")
      }
    } catch (error) {
      console.error("Failed to create collection:", error)
      toast.error("Collection 생성에 실패했습니다")
    }
  }

  // Collection 삭제
  const deleteCollection = async () => {
    if (!selectedCollection) {
      toast.error("삭제할 Collection을 선택해주세요")
      return
    }

    setDeleting(true)

    try {
      const response = await fetch(`${API_BASE_URL}/api/qdrant/collections/${encodeURIComponent(selectedCollection)}`, {
        method: "DELETE"
      })

      if (response.ok) {
        toast.success(`Collection '${selectedCollection}'이 삭제되었습니다`)
        setSelectedCollection("")
        setDeleteDialogOpen(false)
        fetchCollections()
      } else {
        const error = await response.json()
        toast.error(error.detail || "Collection 삭제에 실패했습니다")
      }
    } catch (error) {
      console.error("Failed to delete collection:", error)
      toast.error("Collection 삭제에 실패했습니다")
    } finally {
      setDeleting(false)
    }
  }

  // 문서 업로드
  const uploadDocuments = async () => {
    if (!selectedCollection) {
      toast.error("대상 Collection을 선택해주세요")
      return
    }

    if (selectedDocs.size === 0) {
      toast.error("업로드할 문서를 선택해주세요")
      return
    }

    setUploading(true)
    setUploadResults([])

    try {
      const response = await fetch(`${API_BASE_URL}/api/qdrant/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          collection_name: selectedCollection,
          document_ids: Array.from(selectedDocs),
          chunk_size: chunkSize,
          chunk_overlap: chunkOverlap
        })
      })

      if (response.ok) {
        const data = await response.json()
        setUploadResults(data.results)

        if (data.success_count > 0 && data.failure_count === 0) {
          toast.success(`${data.success_count}개 문서가 성공적으로 업로드되었습니다`)
          setSelectedDocs(new Set())
          setSelectedDocsInfo(new Map())
        } else if (data.success_count > 0) {
          toast.warning(`${data.success_count}개 성공, ${data.failure_count}개 실패`)
          setSelectedDocs(new Set())
          setSelectedDocsInfo(new Map())
        } else {
          toast.error(`모든 문서 업로드에 실패했습니다`)
        }
      } else {
        toast.error("업로드에 실패했습니다")
      }
    } catch (error) {
      console.error("Failed to upload documents:", error)
      toast.error("업로드에 실패했습니다")
    } finally {
      setUploading(false)
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

  // 개별 문서 선택 해제
  const deselectDocument = (id: number) => {
    const newSelected = new Set(selectedDocs)
    const newInfo = new Map(selectedDocsInfo)
    newSelected.delete(id)
    newInfo.delete(id)
    setSelectedDocs(newSelected)
    setSelectedDocsInfo(newInfo)
  }

  // 문서 뷰어 열기
  const openDocumentViewer = (documentId: number) => {
    setSelectedDocumentId(documentId)
    setViewerOpen(true)
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

  // 검색 실행
  const handleSearch = () => {
    setSearchQuery(searchInput)
    setCurrentPage(1)
    fetchDocuments(1, searchInput)
  }

  // 페이지 변경
  const handlePageChange = (page: number) => {
    if (page < 1 || page > totalPages) return
    fetchDocuments(page, searchQuery)
  }

  // 초기 로드
  useEffect(() => {
    fetchConfig()
    fetchDocuments()
    fetchCollections()
  }, [])

  return (
    <PageContainer maxWidth="wide" className="py-6">
      <div className="space-y-6">
        {/* Collection 설정 섹션 */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              <CardTitle>Collection 설정</CardTitle>
            </div>
            <CardDescription>
              Qdrant Collection을 선택하거나 새로 생성하세요
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="collection">Collection 관리</Label>
              <div className="grid grid-cols-10 gap-2">
                {/* Collection 선택 */}
                <div className="col-span-4">
                  <Select value={selectedCollection} onValueChange={setSelectedCollection}>
                    <SelectTrigger id="collection">
                      <SelectValue placeholder="Collection 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {collections.map((col) => (
                        <SelectItem key={col.name} value={col.name}>
                          {col.name} ({col.points_count.toLocaleString()}p, {col.vectors_count.toLocaleString()}v)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* 삭제 버튼 */}
                <div className="col-span-2">
                  <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                    <DialogTrigger asChild>
                      <Button
                        variant="destructive"
                        disabled={!selectedCollection}
                        className="w-full"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        삭제
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>Collection 삭제</DialogTitle>
                        <DialogDescription>
                          정말로 이 Collection을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="py-4">
                        <Alert>
                          <AlertDescription>
                            <strong>{selectedCollection}</strong> Collection이 삭제됩니다.
                          </AlertDescription>
                        </Alert>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                          취소
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={deleteCollection}
                          disabled={deleting}
                        >
                          {deleting ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              삭제 중...
                            </>
                          ) : (
                            <>
                              <Trash2 className="mr-2 h-4 w-4" />
                              삭제
                            </>
                          )}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>

                {/* 생성 버튼 */}
                <div className="col-span-2">
                  <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="w-full">
                        <Database className="mr-2 h-4 w-4" />
                        생성
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-lg">
                      <DialogHeader>
                        <DialogTitle>새 Collection 생성</DialogTitle>
                        <DialogDescription>
                          새로운 Qdrant Collection을 생성합니다
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="newCollectionName">Collection 이름</Label>
                          <Input
                            id="newCollectionName"
                            placeholder="예: documents"
                            value={newCollectionName}
                            onChange={(e) => setNewCollectionName(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Vector 크기</Label>
                          <Input value="1024 (BGE-M3 고정)" disabled />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="distance">Distance Metric</Label>
                          <Select value={distance} onValueChange={setDistance}>
                            <SelectTrigger id="distance">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Cosine">Cosine</SelectItem>
                              <SelectItem value="Euclidean">Euclidean</SelectItem>
                              <SelectItem value="Dot">Dot</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                          취소
                        </Button>
                        <Button onClick={createCollection}>
                          <Database className="mr-2 h-4 w-4" />
                          생성
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>

                {/* 새로고침 버튼 */}
                <div className="col-span-2">
                  <Button
                    onClick={fetchCollections}
                    disabled={loadingCollections}
                    variant="outline"
                    className="w-full"
                  >
                    {loadingCollections ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-2 h-4 w-4" />
                    )}
                    새로고침
                  </Button>
                </div>
              </div>
            </div>

            {/* 청킹 설정 */}
            <div className="mt-4 grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="chunkSize">Chunk Size (토큰)</Label>
                <Input
                  id="chunkSize"
                  type="number"
                  value={chunkSize}
                  onChange={(e) => setChunkSize(parseInt(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="chunkOverlap">Chunk Overlap (토큰)</Label>
                <Input
                  id="chunkOverlap"
                  type="number"
                  value={chunkOverlap}
                  onChange={(e) => setChunkOverlap(parseInt(e.target.value))}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 문서 선택 & 업로드 섹션 */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5" />
                <div>
                  <CardTitle>저장된 문서 목록</CardTitle>
                  <CardDescription className="mt-1">
                    총 {totalDocs}개 문서 중 {selectedDocs.size}개 선택됨
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  onClick={uploadDocuments}
                  disabled={uploading || selectedDocs.size === 0 || !selectedCollection}
                  size="lg"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      업로드 중...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Qdrant에 업로드 ({selectedDocs.size})
                    </>
                  )}
                </Button>
              </div>
            </div>
            {!selectedCollection && selectedDocs.size > 0 && (
              <Alert className="mt-4">
                <AlertDescription>
                  업로드하려면 상단에서 Collection을 먼저 선택해주세요.
                </AlertDescription>
              </Alert>
            )}

            {/* 선택된 문서 표시 */}
            {selectedDocs.size > 0 && (
              <div className="mt-4 p-3 border rounded-lg bg-muted/30">
                <Label className="text-sm font-medium mb-2 block">선택된 문서 ({selectedDocs.size}개)</Label>
                <ScrollArea className="max-h-20">
                  <div className="flex flex-wrap gap-2">
                    {Array.from(selectedDocsInfo.entries()).map(([id, filename]) => (
                      <Badge
                        key={id}
                        variant="secondary"
                        className="pl-3 pr-1 py-1 flex items-center gap-1 max-w-xs"
                      >
                        <span className="truncate text-xs">{filename}</span>
                        <button
                          onClick={() => deselectDocument(id)}
                          className="ml-1 rounded-full hover:bg-muted p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* 검색 입력 */}
            <div className="mt-4 flex gap-2">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="파일명으로 검색..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="pl-10"
                />
              </div>
              <Button onClick={handleSearch} variant="secondary">
                검색
              </Button>
              {searchQuery && (
                <Button
                  onClick={() => {
                    setSearchInput("")
                    setSearchQuery("")
                    fetchDocuments(1, "")
                  }}
                  variant="outline"
                >
                  초기화
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {loadingDocuments ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">문서를 불러오는 중...</p>
              </div>
            ) : documents.length === 0 ? (
              <Alert>
                <AlertDescription>
                  저장된 문서가 없습니다. 먼저 문서를 파싱하고 저장해주세요.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedDocs.size === documents.length && documents.length > 0}
                          onCheckedChange={toggleAll}
                        />
                      </TableHead>
                      <TableHead>파일명</TableHead>
                      <TableHead className="text-right">크기</TableHead>
                      <TableHead className="text-right">생성일</TableHead>
                    </TableRow>
                  </TableHeader>
                </Table>
                <ScrollArea className="max-h-[420px]">
                  <Table>
                    <TableBody>
                      {documents.map((doc) => (
                        <TableRow
                          key={doc.id}
                          className={selectedDocs.has(doc.id) ? "bg-muted/50" : ""}
                        >
                          <TableCell className="w-12">
                            <Checkbox
                              checked={selectedDocs.has(doc.id)}
                              onCheckedChange={() => toggleDocument(doc.id)}
                            />
                          </TableCell>
                          <TableCell className="font-medium">
                            <button
                              onClick={() => openDocumentViewer(doc.id)}
                              className="text-left hover:text-primary hover:underline transition-colors"
                            >
                              {doc.original_filename}
                            </button>
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {doc.content_length ? `${Math.round(doc.content_length / 1000)}KB` : "-"}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {new Date(doc.created_at).toLocaleDateString("ko-KR")}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>
            )}

            {/* 페이지네이션 */}
            {!loadingDocuments && documents.length > 0 && totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  페이지 {currentPage} / {totalPages}
                </p>
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={() => handlePageChange(currentPage - 1)}
                        className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>

                    {/* 페이지 번호들 */}
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum: number
                      if (totalPages <= 5) {
                        pageNum = i + 1
                      } else if (currentPage <= 3) {
                        pageNum = i + 1
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i
                      } else {
                        pageNum = currentPage - 2 + i
                      }

                      return (
                        <PaginationItem key={pageNum}>
                          <PaginationLink
                            onClick={() => handlePageChange(pageNum)}
                            isActive={currentPage === pageNum}
                            className="cursor-pointer"
                          >
                            {pageNum}
                          </PaginationLink>
                        </PaginationItem>
                      )
                    })}

                    <PaginationItem>
                      <PaginationNext
                        onClick={() => handlePageChange(currentPage + 1)}
                        className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 업로드 결과 */}
        {uploadResults.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                {uploadResults.filter(r => r.success).length === uploadResults.length ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : uploadResults.filter(r => !r.success).length === uploadResults.length ? (
                  <XCircle className="h-5 w-5 text-red-500" />
                ) : (
                  <Upload className="h-5 w-5 text-orange-500" />
                )}
                <CardTitle>업로드 결과</CardTitle>
              </div>
              <CardDescription className="mt-2">
                총 {uploadResults.length}개 문서 중 {uploadResults.filter(r => r.success).length}개 성공, {uploadResults.filter(r => !r.success).length}개 실패
                {" | "}총 청크: {uploadResults.reduce((acc, r) => acc + r.chunk_count, 0)}개
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-[300px]">
                <div className="space-y-2">
                  {uploadResults.map((result, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-3 p-3 border rounded-lg bg-card hover:bg-muted/50 transition-colors"
                    >
                      {result.success ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          {result.filename}
                        </p>
                        {result.error && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {result.error}
                          </p>
                        )}
                        {result.success && (
                          <p className="text-xs text-muted-foreground mt-1">
                            청크 수: {result.chunk_count} | 벡터 ID: {result.vector_ids.length}개 생성
                          </p>
                        )}
                      </div>
                      {result.success ? (
                        <Badge variant="default" className="flex-shrink-0">성공</Badge>
                      ) : (
                        <Badge variant="destructive" className="flex-shrink-0">실패</Badge>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}
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
