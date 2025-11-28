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
  Layers,
  Wand2,
  Settings2,
  FileText,
  Tag,
  Hash,
  Info
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
  const [useTemplate, setUseTemplate] = useState(false)

  // Collection 상태
  const [collections, setCollections] = useState<QdrantCollection[]>([])
  const [selectedCollection, setSelectedCollection] = useState("")
  const [loadingCollections, setLoadingCollections] = useState(false)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
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
            metadata_columns: metadataColumns
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
    <PageContainer maxWidth="wide" className="py-6">
      <div className="space-y-6">
        {/* 헤더 */}
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Sheet className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Excel Embedding</h1>
            <p className="text-sm text-muted-foreground">
              Excel 파일을 동적으로 분석하여 Vector DB에 임베딩합니다
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
          {/* 좌측: 파일 업로드 및 미리보기 */}
          <div className="space-y-6">
            {/* 파일 업로드 */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4" />
                  Excel 파일
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!uploadedFile ? (
                  <div
                    className={`
                      border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
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
                    <FileSpreadsheet className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                    <p className="text-sm text-muted-foreground">
                      Excel 파일을 드래그하거나 <span className="text-primary font-medium">클릭하여 선택</span>
                    </p>
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      .xlsx, .xls 지원
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* 파일 정보 */}
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <FileSpreadsheet className="h-8 w-8 text-green-600" />
                        <div>
                          <p className="font-medium text-sm">{uploadedFile.name}</p>
                          {previewData && (
                            <p className="text-xs text-muted-foreground">
                              {previewData.total_rows}개 행 / {previewData.headers.length}개 컬럼
                            </p>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleRemoveFile}
                        disabled={isEmbedding}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* 로딩 */}
                    {isLoadingPreview && (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        <span className="ml-2 text-sm text-muted-foreground">파일 분석 중...</span>
                      </div>
                    )}

                    {/* 감지된 포맷 */}
                    {previewData?.detected_mapping && (
                      <Alert>
                        <Wand2 className="h-4 w-4" />
                        <AlertDescription className="text-sm">
                          {previewData.detected_mapping.is_qa_format ? (
                            <span>
                              <strong>Q&A 형식</strong> 감지됨 - 질문/답변 템플릿이 자동 적용되었습니다
                            </span>
                          ) : previewData.detected_mapping.text_columns.length > 0 ? (
                            <span>
                              텍스트 컬럼 감지: <strong>{previewData.detected_mapping.text_columns.join(', ')}</strong>
                            </span>
                          ) : (
                            <span>텍스트 컬럼을 직접 선택해주세요</span>
                          )}
                        </AlertDescription>
                      </Alert>
                    )}

                    {/* 미리보기 테이블 */}
                    {previewData && previewData.preview_rows.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">데이터 미리보기 (5개 행)</Label>
                        <ScrollArea className="h-[300px] rounded-md border">
                          <div className="p-3">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b">
                                  <th className="text-left p-2 font-medium text-muted-foreground">#</th>
                                  {previewData.headers.slice(0, 5).map((h, i) => (
                                    <th key={i} className="text-left p-2 font-medium">
                                      <div className="flex items-center gap-1">
                                        {h}
                                        {textColumns.includes(h) && (
                                          <Badge variant="default" className="text-[10px] px-1">TEXT</Badge>
                                        )}
                                        {idColumn === h && (
                                          <Badge variant="secondary" className="text-[10px] px-1">ID</Badge>
                                        )}
                                      </div>
                                    </th>
                                  ))}
                                  {previewData.headers.length > 5 && (
                                    <th className="text-left p-2 font-medium text-muted-foreground">
                                      +{previewData.headers.length - 5}
                                    </th>
                                  )}
                                </tr>
                              </thead>
                              <tbody>
                                {previewData.preview_rows.slice(0, 5).map((row, i) => (
                                  <tr key={i} className="border-b hover:bg-muted/30">
                                    <td className="p-2 text-muted-foreground">{row.row_index + 1}</td>
                                    {previewData.headers.slice(0, 5).map((h, j) => (
                                      <td key={j} className="p-2 max-w-[200px] truncate">
                                        {row.data[h] || '-'}
                                      </td>
                                    ))}
                                    {previewData.headers.length > 5 && (
                                      <td className="p-2 text-muted-foreground">...</td>
                                    )}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </ScrollArea>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 임베딩 텍스트 미리보기 */}
            {previewData && textColumns.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    임베딩 텍스트 미리보기
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[200px] rounded-md border bg-muted/30">
                    <div className="p-3 space-y-3">
                      {previewData.preview_rows.slice(0, 3).map((row, i) => (
                        <div key={i} className="p-2 bg-background rounded border text-xs">
                          <Badge variant="outline" className="mb-2 text-[10px]">
                            Row {row.row_index + 1}
                          </Badge>
                          <pre className="whitespace-pre-wrap text-muted-foreground">
                            {generatePreviewText(row)}
                          </pre>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
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
                <div className="flex items-center gap-2">
                  <Select value={selectedCollection} onValueChange={setSelectedCollection}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Collection 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {collections.map((col) => (
                        <SelectItem key={col.name} value={col.name}>
                          <div className="flex items-center gap-2">
                            <span>{col.name}</span>
                            <Badge variant="outline" className="text-xs">
                              {col.points_count}
                            </Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="icon">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
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
                          <Input value="1024 (BGE-M3 고정)" disabled />
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

                  <Button
                    variant="outline"
                    size="icon"
                    onClick={fetchCollections}
                    disabled={loadingCollections}
                  >
                    {loadingCollections ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                  </Button>
                </div>

                {selectedCollectionInfo && (
                  <div className="flex gap-2">
                    <Badge variant="secondary" className="text-xs">
                      <Layers className="h-3 w-3 mr-1" />
                      {selectedCollectionInfo.points_count} points
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {selectedCollectionInfo.distance}
                    </Badge>
                  </div>
                )}
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
                        <p className="text-[10px] text-muted-foreground">
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
                            variant={metadataColumns.includes(h) ? "secondary" : "outline"}
                            className="cursor-pointer text-xs"
                            onClick={() => toggleMetadataColumn(h)}
                          >
                            {h}
                          </Badge>
                        ))}
                    </div>
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
