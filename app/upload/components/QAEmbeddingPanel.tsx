"use client"

import { useState, useRef, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Loader2,
  Database,
  RefreshCw,
  Trash2,
  Plus,
  Layers,
  FileStack,
  Upload,
  FileSpreadsheet,
  X,
  CheckCircle2,
  XCircle,
  HelpCircle,
  FileQuestion
} from "lucide-react"
import { QdrantCollection, QAPreviewRow, QAPreviewResponse, QAEmbeddingResult } from "../types"
import { toast } from "sonner"
import { API_BASE_URL } from "@/lib/api-config"

interface QAEmbeddingPanelProps {
  collections: QdrantCollection[]
  loadingCollections: boolean
  onFetchCollections: () => void
  createDialogOpen: boolean
  onCreateDialogOpenChange: (open: boolean) => void
  newCollectionName: string
  onNewCollectionNameChange: (value: string) => void
  distance: string
  onDistanceChange: (value: string) => void
  onCreateCollection: () => void
}

export function QAEmbeddingPanel({
  collections,
  loadingCollections,
  onFetchCollections,
  createDialogOpen,
  onCreateDialogOpenChange,
  newCollectionName,
  onNewCollectionNameChange,
  distance,
  onDistanceChange,
  onCreateCollection,
}: QAEmbeddingPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 상태
  const [selectedCollection, setSelectedCollection] = useState("")
  const [isDragging, setIsDragging] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [previewData, setPreviewData] = useState<QAPreviewResponse | null>(null)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  const [isEmbedding, setIsEmbedding] = useState(false)
  const [embeddingProgress, setEmbeddingProgress] = useState(0)
  const [embeddingResults, setEmbeddingResults] = useState<QAEmbeddingResult[]>([])

  const selectedCollectionInfo = collections.find(col => col.name === selectedCollection)

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

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch(`${API_BASE_URL}/api/qdrant/qa/preview`, {
        method: 'POST',
        body: formData,
      })

      if (response.ok) {
        const data: QAPreviewResponse = await response.json()
        setPreviewData(data)
        toast.success(`${data.total_rows}개의 Q&A 항목을 불러왔습니다`)
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

  // 드래그 앤 드롭 핸들러
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

  // 파일 선택 핸들러
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFileUpload(files[0])
    }
  }

  // 파일 제거
  const handleRemoveFile = () => {
    setUploadedFile(null)
    setPreviewData(null)
    setEmbeddingResults([])
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // 임베딩 실행
  const handleEmbed = async () => {
    if (!selectedCollection) {
      toast.error("Collection을 선택해주세요")
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
      const response = await fetch(`${API_BASE_URL}/api/qdrant/qa/embed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collection_name: selectedCollection,
          rows: previewData.preview_rows
        })
      })

      if (response.ok) {
        const data = await response.json()
        setEmbeddingResults(data.results)
        setEmbeddingProgress(100)

        if (data.failure_count === 0) {
          toast.success(`${data.success_count}개 Q&A가 성공적으로 임베딩되었습니다`)
        } else {
          toast.warning(`${data.success_count}개 성공, ${data.failure_count}개 실패`)
        }

        // Collection 목록 새로고침
        onFetchCollections()
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

  const isEmbedDisabled = isEmbedding || !selectedCollection || !previewData || previewData.preview_rows.length === 0

  return (
    <div className="space-y-4">
      {/* Collection 선택 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="qa-collection" className="text-sm font-semibold">Collection</Label>
          {selectedCollectionInfo && (
            <div className="flex items-center gap-1.5">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className="text-xs gap-1">
                      <Layers className="h-3 w-3" />
                      {selectedCollectionInfo.points_count.toLocaleString()}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">Total Points</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}
        </div>
        <Select value={selectedCollection} onValueChange={setSelectedCollection}>
          <SelectTrigger id="qa-collection" className="h-10">
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
      </div>

      {/* Collection 관리 버튼 */}
      <div className="flex items-center gap-1.5 justify-end">
        <Dialog open={createDialogOpen} onOpenChange={onCreateDialogOpenChange}>
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
                <p className="text-xs">New Collection</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>New Collection</DialogTitle>
              <DialogDescription>
                Create a new Qdrant Collection
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="newQACollectionName">Collection Name</Label>
                <Input
                  id="newQACollectionName"
                  placeholder="e.g., faq_data"
                  value={newCollectionName}
                  onChange={(e) => onNewCollectionNameChange(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Vector Size</Label>
                <Input value="1024 (BGE-M3)" disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="qa-distance">Distance Metric</Label>
                <Select value={distance} onValueChange={onDistanceChange}>
                  <SelectTrigger id="qa-distance">
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
              <Button variant="outline" onClick={() => onCreateDialogOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={onCreateCollection}>
                <Database className="h-4 w-4 mr-2" />
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={onFetchCollections}
                disabled={loadingCollections}
                variant="ghost"
                size="icon"
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
              <p className="text-xs">Refresh</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <Separator className="my-4" />

      {/* Excel 파일 업로드 영역 */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-1 w-1 rounded-full bg-foreground" />
          <Label className="text-sm font-semibold">Excel File</Label>
        </div>

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
              Drop Excel file here or <span className="text-primary font-medium">browse</span>
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              .xlsx, .xls (question, answer_text columns required)
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* 업로드된 파일 정보 */}
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="h-8 w-8 text-green-600" />
                <div>
                  <p className="font-medium text-sm">{uploadedFile.name}</p>
                  {previewData && (
                    <p className="text-xs text-muted-foreground">
                      {previewData.total_rows} Q&A items
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

            {/* 로딩 상태 */}
            {isLoadingPreview && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">Parsing...</span>
              </div>
            )}

            {/* 미리보기 */}
            {previewData && previewData.preview_rows.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Preview (first 5)</Label>
                  <Badge variant="secondary" className="text-xs">
                    {previewData.total_rows} total
                  </Badge>
                </div>
                <ScrollArea className="h-[180px] rounded-md border">
                  <div className="p-2 space-y-2">
                    {previewData.preview_rows.slice(0, 5).map((row, index) => (
                      <div
                        key={index}
                        className="p-2 bg-muted/30 rounded text-xs space-y-1"
                      >
                        <div className="flex items-start gap-2">
                          <Badge variant="outline" className="text-[10px] shrink-0">
                            {row.faq_id}
                          </Badge>
                          {row.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {row.tags.slice(0, 2).map((tag, i) => (
                                <Badge key={i} variant="secondary" className="text-[10px]">
                                  {tag}
                                </Badge>
                              ))}
                              {row.tags.length > 2 && (
                                <Badge variant="secondary" className="text-[10px]">
                                  +{row.tags.length - 2}
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                        <p className="font-medium text-foreground line-clamp-1">
                          Q: {row.question}
                        </p>
                        <p className="text-muted-foreground line-clamp-2">
                          A: {row.answer_text}
                        </p>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 임베딩 진행률 */}
      {isEmbedding && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>Embedding...</span>
            <span>{embeddingProgress}%</span>
          </div>
          <Progress value={embeddingProgress} className="h-2" />
        </div>
      )}

      {/* 임베딩 결과 */}
      {embeddingResults.length > 0 && !isEmbedding && (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Results</Label>
          <div className="p-3 bg-muted/30 rounded-lg">
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
          </div>
        </div>
      )}

      {/* 안내 메시지 */}
      {!selectedCollection && previewData && (
        <Alert>
          <AlertDescription>
            Please select a Collection first.
          </AlertDescription>
        </Alert>
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
            Embed Q&A ({previewData?.total_rows || 0})
          </>
        )}
      </Button>
    </div>
  )
}
