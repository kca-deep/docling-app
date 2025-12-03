"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { PageContainer } from "@/components/page-container"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  Sheet,
  FileSpreadsheet,
  Upload,
  X,
  Loader2,
  CheckCircle2,
  XCircle,
  Database,
  RefreshCw,
  Plus,
  Trash2,
  Layers,
  Wand2,
  Settings2,
  FileText,
  Tag,
  Hash,
  Info,
  Table,
  ChevronDown
} from "lucide-react"
import { toast } from "sonner"
import { API_BASE_URL } from "@/lib/api-config"

interface ExcelPreviewRow {
  row_index: number
  data: Record<string, string>
}

interface DetectedMapping {
  id_column: string | null
  text_columns: string[]
  tag_column: string | null
  is_qa_format: boolean
  question_column: string | null
  answer_column: string | null
  heading_columns: string[]  // 참조문서 표시용 컬럼들
}

interface ExcelPreviewResponse {
  total_rows: number
  headers: string[]
  preview_rows: ExcelPreviewRow[]
  file_name: string
  detected_mapping: DetectedMapping | null
}

interface QdrantCollection {
  name: string
  vectors_count: number
  points_count: number
  vector_size: number
  distance: string
}

interface EmbeddingResult {
  row_index: number
  id_value: string | null
  success: boolean
  vector_id: string | null
  error: string | null
}

export default function ExcelEmbeddingPage() {
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 파일 상태
  const [isDragging, setIsDragging] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  const [previewData, setPreviewData] = useState<ExcelPreviewResponse | null>(null)

  // 컬럼 매핑 상태
  const [idColumn, setIdColumn] = useState<string>("")
  const [textColumns, setTextColumns] = useState<string[]>([])
  const [textTemplate, setTextTemplate] = useState<string>("")
  const [tagColumn, setTagColumn] = useState<string>("")
  const [metadataColumns, setMetadataColumns] = useState<string[]>([])
  const [headingColumns, setHeadingColumns] = useState<string[]>([])  // 참조문서 표시용
  const [useTemplate, setUseTemplate] = useState(false)

  // Collection 상태
  const [collections, setCollections] = useState<QdrantCollection[]>([])
  const [selectedCollection, setSelectedCollection] = useState("")
  const [loadingCollections, setLoadingCollections] = useState(false)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingCollection, setDeletingCollection] = useState(false)
  const [newCollectionName, setNewCollectionName] = useState("")
  const [distance, setDistance] = useState("Cosine")

  // 임베딩 상태
  const [isEmbedding, setIsEmbedding] = useState(false)
  const [embeddingProgress, setEmbeddingProgress] = useState(0)
  const [embeddingResults, setEmbeddingResults] = useState<EmbeddingResult[]>([])

  // Collection 목록 로드
  const fetchCollections = async () => {
    setLoadingCollections(true)
    try {
      const response = await fetch(`${API_BASE_URL}/api/qdrant/collections`)
      if (response.ok) {
        const data = await response.json()
        const sorted = [...(data.collections || [])].sort((a, b) =>
          a.name.localeCompare(b.name, 'ko-KR')
        )
        setCollections(sorted)
      }
    } catch (error) {
      console.error("Failed to fetch collections:", error)
      toast.error("Collection 목록을 불러오는데 실패했습니다")
    } finally {
      setLoadingCollections(false)
    }
  }

  // Collection 생성
  const createCollection = async () => {
    if (!newCollectionName.trim()) {
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

    setDeletingCollection(true)

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/qdrant/collections/${encodeURIComponent(selectedCollection)}`,
        { method: "DELETE" }
      )

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
      setDeletingCollection(false)
    }
  }

  // 파일 업로드 핸들러
  const handleFileUpload = async (file: File) => {
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      toast.error("Excel 파일(.xlsx, .xls)만 지원합니다")
      return
    }

    setUploadedFile(file)
    setIsLoadingPreview(true)
    setPreviewData(null)
    setEmbeddingResults([])

    // 매핑 초기화
    setIdColumn("")
    setTextColumns([])
    setTextTemplate("")
    setTagColumn("")
    setMetadataColumns([])
    setHeadingColumns([])

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch(`${API_BASE_URL}/api/qdrant/excel/preview`, {
        method: 'POST',
        body: formData,
      })

      if (response.ok) {
        const data: ExcelPreviewResponse = await response.json()
        setPreviewData(data)

        // 스마트 감지된 매핑 적용
        if (data.detected_mapping) {
          const dm = data.detected_mapping
          if (dm.id_column) setIdColumn(dm.id_column)
          if (dm.text_columns.length > 0) setTextColumns(dm.text_columns)
          if (dm.tag_column) setTagColumn(dm.tag_column)
          if (dm.heading_columns && dm.heading_columns.length > 0) setHeadingColumns(dm.heading_columns)

          // Q&A 포맷이면 템플릿 자동 생성
          if (dm.is_qa_format && dm.question_column && dm.answer_column) {
            setTextTemplate(`질문: {${dm.question_column}}\n답변: {${dm.answer_column}}`)
            setUseTemplate(true)
          }
        }

        toast.success(`${data.total_rows}개 행을 불러왔습니다`)
      } else {
        const error = await response.json()
        toast.error(error.detail || "파일 파싱에 실패했습니다")
        setUploadedFile(null)
      }
    } catch (error) {
      console.error("Failed to parse Excel:", error)
      toast.error("파일 파싱에 실패했습니다")
      setUploadedFile(null)
    } finally {
      setIsLoadingPreview(false)
    }
  }

  // 드래그 앤 드롭
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFileUpload(files[0])
    }
  }, [])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFileUpload(files[0])
    }
  }

  const handleRemoveFile = () => {
    setUploadedFile(null)
    setPreviewData(null)
    setEmbeddingResults([])
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // 텍스트 컬럼 토글
  const toggleTextColumn = (column: string) => {
    setTextColumns(prev =>
      prev.includes(column)
        ? prev.filter(c => c !== column)
        : [...prev, column]
    )
  }

  // 메타데이터 컬럼 토글
  const toggleMetadataColumn = (column: string) => {
    setMetadataColumns(prev =>
      prev.includes(column)
        ? prev.filter(c => c !== column)
        : [...prev, column]
    )
  }

  // Heading 컬럼 토글
  const toggleHeadingColumn = (column: string) => {
    setHeadingColumns(prev =>
      prev.includes(column)
        ? prev.filter(c => c !== column)
        : [...prev, column]
    )
  }

  // 임베딩 미리보기 텍스트 생성
  const generatePreviewText = (row: ExcelPreviewRow): string => {
    if (useTemplate && textTemplate) {
      let text = textTemplate
      for (const [key, value] of Object.entries(row.data)) {
        text = text.replace(new RegExp(`\\{${key}\\}`, 'g'), value || '')
      }
      return text
    } else {
      return textColumns
        .map(col => row.data[col] || '')
        .filter(v => v)
        .join('\n')
    }
  }

  // 임베딩 실행
  const handleEmbed = async () => {
    if (!selectedCollection) {
      toast.error("Collection을 선택해주세요")
      return
    }

    if (textColumns.length === 0 && !textTemplate) {
      toast.error("텍스트 컬럼을 선택하거나 템플릿을 입력해주세요")
      return
    }

    if (!previewData || previewData.preview_rows.length === 0) {
      toast.error("임베딩할 데이터가 없습니다")
      return
    }

    setIsEmbedding(true)
    setEmbeddingProgress(0)
    setEmbeddingResults([])

    try {
      const response = await fetch(`${API_BASE_URL}/api/qdrant/excel/embed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collection_name: selectedCollection,
          file_name: previewData.file_name,
          rows: previewData.preview_rows,
          mapping: {
            id_column: idColumn || null,
            text_columns: textColumns,
            text_template: useTemplate ? textTemplate : null,
            tag_column: tagColumn || null,
            metadata_columns: metadataColumns,
            heading_columns: headingColumns
          }
        })
      })

      if (response.ok) {
        const data = await response.json()
        setEmbeddingResults(data.results)
        setEmbeddingProgress(100)

        if (data.failure_count === 0) {
          toast.success(`${data.success_count}개 항목이 성공적으로 임베딩되었습니다`)
        } else {
          toast.warning(`${data.success_count}개 성공, ${data.failure_count}개 실패`)
        }

        fetchCollections()
      } else {
        const error = await response.json()
        toast.error(error.detail || "임베딩에 실패했습니다")
      }
    } catch (error) {
      console.error("Failed to embed:", error)
      toast.error("임베딩에 실패했습니다")
    } finally {
      setIsEmbedding(false)
    }
  }

  useEffect(() => {
    fetchCollections()
  }, [])

  const selectedCollectionInfo = collections.find(c => c.name === selectedCollection)
  const isEmbedDisabled = isEmbedding || !selectedCollection || !previewData ||
    (textColumns.length === 0 && (!useTemplate || !textTemplate))

  return (
    <PageContainer maxWidth="wide" className="py-4">
      <div className="space-y-4">
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_24rem] gap-4">
          {/* 좌측: 파일 업로드 및 미리보기 */}
          <div className="space-y-4 min-w-0">
            {/* 파일 업로드 */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4" />
                  Excel 파일
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {!uploadedFile ? (
                  <div
                    className={`
                      border-2 border-dashed rounded-lg p-6 text-center cursor-pointer
                      transition-colors duration-200
                      ${isDragging
                        ? 'border-primary bg-primary/5'
                        : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50'
                      }
                    `}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <FileSpreadsheet className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Excel 파일을 드래그하거나 <span className="text-primary font-medium">클릭하여 선택</span>
                    </p>
                    <p className="text-xs text-muted-foreground/70 mt-0.5">
                      .xlsx, .xls 지원
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* 컴팩트한 파일 정보 */}
                    <div className="flex items-center justify-between p-1.5 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="h-4 w-4 text-green-600" />
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">{uploadedFile.name}</p>
                          {previewData && (
                            <>
                              <Badge variant="secondary" className="text-xs">
                                {previewData.total_rows}행
                              </Badge>
                              <Badge variant="secondary" className="text-xs">
                                {previewData.headers.length}열
                              </Badge>
                            </>
                          )}
                          {previewData?.detected_mapping?.is_qa_format && (
                            <Badge variant="default" className="text-xs">
                              Q&A 형식
                            </Badge>
                          )}
                          {isLoadingPreview && (
                            <div className="flex items-center gap-1">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              <span className="text-xs text-muted-foreground">분석 중...</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={handleRemoveFile}
                        disabled={isEmbedding}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>

                  </div>
                )}
              </CardContent>
            </Card>

            {/* 미리보기 탭 */}
            {previewData && previewData.preview_rows.length > 0 && (
              <Card>
                <CardContent className="pt-3">
                  <Tabs defaultValue="data" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="data" className="gap-2">
                        <Table className="h-4 w-4" />
                        데이터 미리보기
                      </TabsTrigger>
                      <TabsTrigger value="embedding" disabled={textColumns.length === 0 && !textTemplate} className="gap-2">
                        <FileText className="h-4 w-4" />
                        임베딩 텍스트
                      </TabsTrigger>
                    </TabsList>

                    {/* 데이터 미리보기 탭 */}
                    <TabsContent value="data" className="mt-2">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-medium">전체 데이터 ({previewData.total_rows}개 행)</Label>
                          <Badge variant="outline" className="text-xs">
                            미리보기 {Math.min(5, previewData.preview_rows.length)}개
                          </Badge>
                        </div>
                        <div className="rounded-md border bg-background">
                          <div className="relative h-80 overflow-auto">
                            <table className="text-xs w-full">
                              <thead className="sticky top-0 bg-background border-b z-10">
                                <tr>
                                  <th className="sticky left-0 z-20 bg-background text-left p-2 font-medium text-muted-foreground min-w-12 border-r">#</th>
                                  {previewData.headers.map((h, i) => (
                                    <th key={i} className="text-left p-2 font-medium min-w-36 whitespace-nowrap bg-background">
                                      <div className="flex items-center gap-1">
                                        {h}
                                        {textColumns.includes(h) && (
                                          <Badge variant="default" className="text-[0.625rem] px-1">TEXT</Badge>
                                        )}
                                        {idColumn === h && (
                                          <Badge variant="secondary" className="text-[0.625rem] px-1">ID</Badge>
                                        )}
                                        {tagColumn === h && (
                                          <Badge variant="outline" className="text-[0.625rem] px-1">TAG</Badge>
                                        )}
                                        {metadataColumns.includes(h) && (
                                          <Badge variant="default" className="text-[0.625rem] px-1">META</Badge>
                                        )}
                                        {headingColumns.includes(h) && (
                                          <Badge variant="secondary" className="text-[0.625rem] px-1 bg-amber-100 text-amber-800">REF</Badge>
                                        )}
                                      </div>
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {previewData.preview_rows.slice(0, 5).map((row, i) => (
                                  <tr key={i} className="border-b hover:bg-muted/30">
                                    <td className="sticky left-0 z-10 bg-background p-2 text-muted-foreground min-w-12 border-r font-medium">{row.row_index + 1}</td>
                                    {previewData.headers.map((h, j) => (
                                      <td key={j} className="p-2 min-w-36 max-w-sm">
                                        <div className="truncate" title={row.data[h] || '-'}>
                                          {row.data[h] || '-'}
                                        </div>
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    </TabsContent>

                    {/* 임베딩 텍스트 미리보기 탭 */}
                    <TabsContent value="embedding" className="mt-2">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-medium">임베딩될 텍스트 형식</Label>
                          {useTemplate ? (
                            <Badge variant="default" className="text-xs">템플릿 사용</Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">{textColumns.length}개 컬럼 결합</Badge>
                          )}
                        </div>
                        <ScrollArea className="h-80 rounded-md border bg-muted/30">
                          <div className="p-4 space-y-3">
                            {previewData.preview_rows.slice(0, 5).map((row, i) => (
                              <div key={i} className="p-3 bg-background rounded-lg border">
                                <div className="flex items-center justify-between mb-2">
                                  <Badge variant="outline" className="text-xs">
                                    Row {row.row_index + 1}
                                  </Badge>
                                  {idColumn && row.data[idColumn] && (
                                    <span className="text-xs text-muted-foreground">
                                      ID: {row.data[idColumn]}
                                    </span>
                                  )}
                                </div>
                                <pre className="whitespace-pre-wrap text-sm text-muted-foreground font-mono">
                                  {generatePreviewText(row) || '(텍스트 컬럼을 선택해주세요)'}
                                </pre>
                                {tagColumn && row.data[tagColumn] && (
                                  <div className="mt-2 pt-2 border-t">
                                    <Badge variant="secondary" className="text-xs">
                                      {row.data[tagColumn]}
                                    </Badge>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </div>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            )}
          </div>

          {/* 우측: 설정 패널 */}
          <div className="space-y-4">
            {/* Collection 선택 */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  Collection
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* 1줄: Collection 라벨 + 정보 배지 */}
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">Collection</Label>
                  {selectedCollectionInfo && (
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className="text-xs gap-1">
                        <Layers className="h-3 w-3" />
                        {selectedCollectionInfo.points_count.toLocaleString()}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {selectedCollectionInfo.distance}
                      </Badge>
                    </div>
                  )}
                </div>

                {/* 2줄: Select 드롭다운 (전체 너비) */}
                <Select value={selectedCollection} onValueChange={setSelectedCollection}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Collection 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {collections.map((col) => (
                      <SelectItem key={col.name} value={col.name}>
                        <div className="flex items-center justify-between w-full gap-3">
                          <span className="font-medium">{col.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {col.points_count.toLocaleString()}p
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* 3줄: 추가/삭제/새로고침 버튼 (우측 정렬) */}
                <div className="flex items-center gap-1.5 justify-end">
                  <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-9 w-9">
                              <Plus className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs">새 Collection 생성</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <DialogContent className="sm:max-w-lg">
                      <DialogHeader>
                        <DialogTitle>New Collection</DialogTitle>
                        <DialogDescription>새 Qdrant Collection 생성</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label>Collection Name</Label>
                          <Input
                            value={newCollectionName}
                            onChange={(e) => setNewCollectionName(e.target.value)}
                            placeholder="e.g., faq_data"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Vector Size</Label>
                          <Input value="1024" placeholder="BGE-M3" disabled />
                        </div>
                        <div className="space-y-2">
                          <Label>Distance Metric</Label>
                          <Select value={distance} onValueChange={setDistance}>
                            <SelectTrigger>
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
                          Cancel
                        </Button>
                        <Button onClick={createCollection}>Create</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  {/* 삭제 다이얼로그 */}
                  <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={!selectedCollection}
                              className="h-9 w-9"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs">Collection 삭제</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
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
                          disabled={deletingCollection}
                        >
                          {deletingCollection ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              삭제 중...
                            </>
                          ) : (
                            <>
                              <Trash2 className="h-4 w-4 mr-2" />
                              삭제
                            </>
                          )}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={fetchCollections}
                          disabled={loadingCollections}
                          className="h-9 w-9"
                        >
                          {loadingCollections ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs">Collection 목록 새로고침</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </CardContent>
            </Card>

            {/* 컬럼 매핑 */}
            {previewData && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Settings2 className="h-4 w-4" />
                    Column Mapping
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* ID 컬럼 */}
                  <div className="space-y-2">
                    <Label className="text-xs flex items-center gap-1">
                      <Hash className="h-3 w-3" />
                      ID Column
                    </Label>
                    <Select value={idColumn || "_none_"} onValueChange={(v) => setIdColumn(v === "_none_" ? "" : v)}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="선택 (선택사항)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none_">선택 안함</SelectItem>
                        {previewData.headers.map((h) => (
                          <SelectItem key={h} value={h}>{h}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Separator />

                  {/* 텍스트 컬럼 */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        Text Columns
                      </Label>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="use-template"
                          checked={useTemplate}
                          onCheckedChange={(c) => setUseTemplate(!!c)}
                        />
                        <Label htmlFor="use-template" className="text-xs text-muted-foreground cursor-pointer">
                          템플릿 사용
                        </Label>
                      </div>
                    </div>

                    {!useTemplate ? (
                      <div className="flex flex-wrap gap-1.5">
                        {previewData.headers.map((h) => (
                          <Badge
                            key={h}
                            variant={textColumns.includes(h) ? "default" : "outline"}
                            className="cursor-pointer text-xs"
                            onClick={() => toggleTextColumn(h)}
                          >
                            {h}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Textarea
                          value={textTemplate}
                          onChange={(e) => setTextTemplate(e.target.value)}
                          placeholder={"예: 질문: {question}\\n답변: {answer_text}"}
                          className="h-20 text-xs font-mono"
                        />
                        <p className="text-[0.625rem] text-muted-foreground">
                          {"{컬럼명}"} 형식으로 컬럼 값을 삽입합니다
                        </p>
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* 태그 컬럼 */}
                  <div className="space-y-2">
                    <Label className="text-xs flex items-center gap-1">
                      <Tag className="h-3 w-3" />
                      Tag Column
                    </Label>
                    <Select value={tagColumn || "_none_"} onValueChange={(v) => setTagColumn(v === "_none_" ? "" : v)}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="선택 (선택사항)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none_">선택 안함</SelectItem>
                        {previewData.headers.map((h) => (
                          <SelectItem key={h} value={h}>{h}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Separator />

                  {/* 메타데이터 컬럼 */}
                  <div className="space-y-2">
                    <Label className="text-xs flex items-center gap-1">
                      <Info className="h-3 w-3" />
                      Metadata Columns
                    </Label>
                    <div className="flex flex-wrap gap-1.5">
                      {previewData.headers
                        .filter(h => h !== idColumn && !textColumns.includes(h) && h !== tagColumn)
                        .map((h) => (
                          <Badge
                            key={h}
                            variant={metadataColumns.includes(h) ? "default" : "outline"}
                            className="cursor-pointer text-xs"
                            onClick={() => toggleMetadataColumn(h)}
                          >
                            {h}
                          </Badge>
                        ))}
                    </div>
                  </div>

                  <Separator />

                  {/* 참조문서 표시용 컬럼 (Heading Columns) */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label className="text-xs flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        Reference Columns
                      </Label>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs">
                            <p className="text-xs">
                              AI 챗봇에서 참조문서로 표시될 정보입니다.
                              예: source 컬럼과 page 컬럼을 선택하면 "문서명 - 페이지 5" 형태로 표시됩니다.
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {previewData.headers.map((h) => (
                        <Badge
                          key={h}
                          variant={headingColumns.includes(h) ? "default" : "outline"}
                          className={`cursor-pointer text-xs ${headingColumns.includes(h) ? "bg-amber-100 text-amber-800 hover:bg-amber-200" : ""}`}
                          onClick={() => toggleHeadingColumn(h)}
                        >
                          {h}
                          {headingColumns.includes(h) && (
                            <span className="ml-1 text-[0.5rem]">
                              ({headingColumns.indexOf(h) + 1})
                            </span>
                          )}
                        </Badge>
                      ))}
                    </div>
                    {headingColumns.length > 0 && (
                      <p className="text-[0.625rem] text-muted-foreground">
                        참조문서 표시: {headingColumns.join(" - ")}
                      </p>
                    )}
                    {headingColumns.length === 0 && (
                      <p className="text-[0.625rem] text-muted-foreground">
                        선택 안함 시 기본값: 파일명 - 행 번호
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 임베딩 진행률 */}
            {isEmbedding && (
              <Card>
                <CardContent className="py-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Embedding...</span>
                      <span>{embeddingProgress}%</span>
                    </div>
                    <Progress value={embeddingProgress} className="h-2" />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 결과 */}
            {embeddingResults.length > 0 && !isEmbedding && (
              <Card>
                <CardContent className="py-4">
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1.5 text-green-600">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>{embeddingResults.filter(r => r.success).length} success</span>
                    </div>
                    {embeddingResults.filter(r => !r.success).length > 0 && (
                      <div className="flex items-center gap-1.5 text-red-600">
                        <XCircle className="h-4 w-4" />
                        <span>{embeddingResults.filter(r => !r.success).length} failed</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 임베딩 버튼 */}
            <Button
              onClick={handleEmbed}
              disabled={isEmbedDisabled}
              size="lg"
              className="w-full gap-2"
            >
              {isEmbedding ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Embedding...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Embed to Qdrant ({previewData?.total_rows || 0} rows)
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </PageContainer>
  )
}
