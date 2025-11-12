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
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious, PaginationEllipsis } from "@/components/ui/pagination"
import { Loader2, CheckCircle2, XCircle, Upload, Settings, FileText, Save, Search, X } from "lucide-react"
import { toast } from "sonner"
import { MarkdownViewerModal } from "@/components/markdown-viewer-modal"

interface Document {
  id: number
  task_id: string
  original_filename: string
  content_length: number | null
  content_preview: string | null
  processing_time: number | null
  created_at: string
}

interface DifyDataset {
  id: string
  name: string
  description: string | null
  document_count: number
  word_count: number
}

interface UploadResult {
  document_id: number
  filename: string
  success: boolean
  dify_document_id: string | null
  error: string | null
}

export default function DifyPage() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [selectedDocs, setSelectedDocs] = useState<Set<number>>(new Set())
  const [selectedDocsInfo, setSelectedDocsInfo] = useState<Map<number, string>>(new Map())
  const [loading, setLoading] = useState(false)
  const [datasets, setDatasets] = useState<DifyDataset[]>([])
  const [uploadResults, setUploadResults] = useState<UploadResult[]>([])

  // Dify 설정 (기본값 설정)
  const [apiKey, setApiKey] = useState("dataset-tTuWMwOLTw6Lhhmihan6uszE")
  const [baseUrl, setBaseUrl] = useState("http://kca-ai.kro.kr:5001/v1")
  const [selectedDataset, setSelectedDataset] = useState("")
  const [configName, setConfigName] = useState("")
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)

  // 페이징 및 검색 상태
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalDocs, setTotalDocs] = useState(0)
  const [pageSize] = useState(20)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchInput, setSearchInput] = useState("")

  // 상태
  const [loadingDocuments, setLoadingDocuments] = useState(false)
  const [loadingDatasets, setLoadingDatasets] = useState(false)
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

      const response = await fetch(`http://localhost:8000/api/documents/saved?${params}`)
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

  // Dify 데이터셋 목록 가져오기
  const fetchDatasets = async () => {
    if (!apiKey) {
      toast.error("API Key를 입력해주세요")
      return
    }

    setLoadingDatasets(true)
    try {
      const response = await fetch("http://localhost:8000/api/dify/datasets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: apiKey, base_url: baseUrl })
      })

      if (response.ok) {
        const data = await response.json()
        setDatasets(data.data || [])
        toast.success(`${data.data.length}개의 데이터셋을 불러왔습니다`)
      } else {
        toast.error("데이터셋을 가져오는데 실패했습니다")
      }
    } catch (error) {
      console.error("Failed to fetch datasets:", error)
      toast.error("데이터셋을 가져오는데 실패했습니다")
    } finally {
      setLoadingDatasets(false)
    }
  }

  // 문서 업로드
  const uploadDocuments = async () => {
    if (!apiKey || !selectedDataset) {
      toast.error("API Key와 데이터셋을 선택해주세요")
      return
    }

    if (selectedDocs.size === 0) {
      toast.error("업로드할 문서를 선택해주세요")
      return
    }

    setUploading(true)
    setUploadResults([])

    try {
      const selectedDatasetName = datasets.find(d => d.id === selectedDataset)?.name || null

      const response = await fetch("http://localhost:8000/api/dify/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: apiKey,
          base_url: baseUrl,
          dataset_id: selectedDataset,
          dataset_name: selectedDatasetName,
          document_ids: Array.from(selectedDocs)
        })
      })

      if (response.ok) {
        const data = await response.json()
        setUploadResults(data.results)

        // 성공/실패 알림
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

  // 활성 Dify 설정 불러오기
  const loadActiveConfig = async () => {
    try {
      const response = await fetch("http://localhost:8000/api/dify/config/active")
      if (response.ok) {
        const data = await response.json()
        if (data.api_key) {
          setApiKey(data.api_key)
          setBaseUrl(data.base_url)
          if (data.default_dataset_id) {
            setSelectedDataset(data.default_dataset_id)
          }
        }
      }
    } catch (error) {
      console.error("Failed to load active config:", error)
    }
  }

  // Dify 설정 저장
  const saveConfig = async () => {
    if (!configName.trim()) {
      toast.error("설정 이름을 입력해주세요")
      return
    }

    if (!apiKey || !baseUrl) {
      toast.error("API Key와 Base URL을 입력해주세요")
      return
    }

    try {
      const response = await fetch("http://localhost:8000/api/dify/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config_name: configName,
          api_key: apiKey,
          base_url: baseUrl,
          default_dataset_id: selectedDataset || null,
          default_dataset_name: datasets.find(d => d.id === selectedDataset)?.name || null
        })
      })

      if (response.ok) {
        toast.success("설정이 저장되었습니다")
        setSaveDialogOpen(false)
        setConfigName("")
      } else {
        const error = await response.json()
        toast.error(error.detail || "설정 저장에 실패했습니다")
      }
    } catch (error) {
      console.error("Failed to save config:", error)
      toast.error("설정 저장에 실패했습니다")
    }
  }

  useEffect(() => {
    fetchDocuments()
    loadActiveConfig()
  }, [])

  // 문서 선택 토글
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
  const toggleAllDocuments = () => {
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

  return (
    <PageContainer maxWidth="wide" className="py-6">
      <div className="space-y-6">
        {/* Dify 설정 섹션 */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              <CardTitle>Dify API 설정</CardTitle>
            </div>
            <CardDescription>
              Dify API 키와 데이터셋을 설정하세요
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="apiKey">API Key</Label>
                <Input
                  id="apiKey"
                  type="password"
                  placeholder="dataset-xxxxxxxxxxxxx"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="baseUrl">Base URL</Label>
                <Input
                  id="baseUrl"
                  placeholder="https://api.dify.ai/v1"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>동작</Label>
                <div className="flex gap-2">
                  <Button
                    onClick={fetchDatasets}
                    disabled={loadingDatasets || !apiKey}
                    variant="outline"
                    className="flex-1"
                  >
                    {loadingDatasets && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    불러오기
                  </Button>
                  <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" disabled={!apiKey || !baseUrl}>
                        <Save className="mr-2 h-4 w-4" />
                        저장
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Dify 설정 저장</DialogTitle>
                        <DialogDescription>
                          현재 설정을 저장하여 다음에 다시 사용할 수 있습니다
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="configName">설정 이름</Label>
                          <Input
                            id="configName"
                            placeholder="예: 회사 Dify 설정"
                            value={configName}
                            onChange={(e) => setConfigName(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>API Key</Label>
                          <Input value={apiKey.substring(0, 20) + "..."} disabled />
                        </div>
                        <div className="space-y-2">
                          <Label>Base URL</Label>
                          <Input value={baseUrl} disabled />
                        </div>
                        {selectedDataset && (
                          <div className="space-y-2">
                            <Label>기본 데이터셋</Label>
                            <Input value={datasets.find(d => d.id === selectedDataset)?.name || ""} disabled />
                          </div>
                        )}
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
                          취소
                        </Button>
                        <Button onClick={saveConfig}>
                          <Save className="mr-2 h-4 w-4" />
                          저장
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </div>

            {datasets.length > 0 && (
              <div className="mt-4">
                <Select value={selectedDataset} onValueChange={setSelectedDataset}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="업로드할 데이터셋 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {datasets.map((dataset) => (
                      <SelectItem key={dataset.id} value={dataset.id}>
                        {dataset.name} ({dataset.document_count} 문서, {Math.round(dataset.word_count / 1000)}K 단어)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
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
                  disabled={uploading || selectedDocs.size === 0 || !selectedDataset || !apiKey}
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
                      Dify에 업로드 ({selectedDocs.size})
                    </>
                  )}
                </Button>
              </div>
            </div>
            {(!apiKey || !selectedDataset) && selectedDocs.size > 0 && (
              <Alert className="mt-4">
                <AlertDescription>
                  업로드하려면 상단에서 API Key와 데이터셋을 먼저 설정해주세요.
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
                            onCheckedChange={toggleAllDocuments}
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
                        {result.success && result.dify_document_id && (
                          <p className="text-xs text-muted-foreground mt-1">
                            문서 ID: {result.dify_document_id}
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
