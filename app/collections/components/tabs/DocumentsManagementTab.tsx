"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { FileText, Loader2, RefreshCw, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { API_BASE_URL } from "@/lib/api-config"
import { cn } from "@/lib/utils"

interface CollectionDocumentInfo {
  document_id: number | null
  filename: string
  chunk_count: number
  source_type: "document" | "excel"
  source_file?: string
}

interface DocumentsManagementTabProps {
  collectionName: string
  onSuccess: () => void
}

export function DocumentsManagementTab({
  collectionName,
  onSuccess,
}: DocumentsManagementTabProps) {
  const [documents, setDocuments] = useState<CollectionDocumentInfo[]>([])
  const [loadingDocs, setLoadingDocs] = useState(false)
  const [selectedDocs, setSelectedDocs] = useState<CollectionDocumentInfo[]>([])
  const [deleting, setDeleting] = useState(false)

  // 문서 목록 조회
  const fetchDocuments = useCallback(async () => {
    setLoadingDocs(true)
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/qdrant/collections/${encodeURIComponent(collectionName)}/documents`,
        { credentials: 'include' }
      )
      if (response.ok) {
        const data = await response.json()
        setDocuments(data.documents || [])
        setSelectedDocs([])
      } else {
        const error = await response.json()
        toast.error(error.detail || "문서 목록을 불러오는데 실패했습니다")
      }
    } catch (error) {
      console.error("Failed to fetch documents:", error)
      toast.error("문서 목록을 불러오는데 실패했습니다")
    } finally {
      setLoadingDocs(false)
    }
  }, [collectionName])

  // 컴포넌트 마운트 시 문서 목록 로드
  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  // 문서 선택 토글
  const toggleSelectDoc = (doc: CollectionDocumentInfo) => {
    setSelectedDocs((prev) => {
      const isSelected = prev.some(
        (d) => d.document_id === doc.document_id && d.filename === doc.filename
      )
      if (isSelected) {
        return prev.filter(
          (d) => !(d.document_id === doc.document_id && d.filename === doc.filename)
        )
      } else {
        return [...prev, doc]
      }
    })
  }

  // 전체 선택/해제
  const toggleSelectAll = () => {
    if (selectedDocs.length === documents.length) {
      setSelectedDocs([])
    } else {
      setSelectedDocs([...documents])
    }
  }

  // 문서가 선택되었는지 확인
  const isDocSelected = (doc: CollectionDocumentInfo) => {
    return selectedDocs.some(
      (d) => d.document_id === doc.document_id && d.filename === doc.filename
    )
  }

  // 선택된 문서 삭제
  const handleDeleteSelected = async () => {
    if (selectedDocs.length === 0) return

    const confirmed = window.confirm(
      `${selectedDocs.length}개 문서를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`
    )
    if (!confirmed) return

    setDeleting(true)
    try {
      const documentIds = selectedDocs
        .filter((d) => d.source_type === "document" && d.document_id !== null)
        .map((d) => d.document_id as number)
      const sourceFiles = selectedDocs
        .filter((d) => d.source_type === "excel")
        .map((d) => d.source_file || d.filename)

      const response = await fetch(
        `${API_BASE_URL}/api/qdrant/collections/${encodeURIComponent(collectionName)}/documents`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          credentials: 'include',
          body: JSON.stringify({
            document_ids: documentIds.length > 0 ? documentIds : undefined,
            source_files: sourceFiles.length > 0 ? sourceFiles : undefined
          })
        }
      )

      if (response.ok) {
        const result = await response.json()
        toast.success(result.message)
        setSelectedDocs([])
        fetchDocuments()
        onSuccess()
      } else {
        const error = await response.json()
        toast.error(error.detail || "삭제에 실패했습니다")
      }
    } catch (error) {
      console.error("Failed to delete documents:", error)
      toast.error("삭제 중 오류가 발생했습니다")
    } finally {
      setDeleting(false)
    }
  }

  // 단일 문서 삭제
  const handleDeleteSingle = async (doc: CollectionDocumentInfo) => {
    const confirmed = window.confirm(
      `"${doc.filename}" 문서를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`
    )
    if (!confirmed) return

    setDeleting(true)
    try {
      const body: { document_ids?: number[]; source_files?: string[] } = {}

      if (doc.source_type === "document" && doc.document_id !== null) {
        body.document_ids = [doc.document_id]
      } else {
        body.source_files = [doc.source_file || doc.filename]
      }

      const response = await fetch(
        `${API_BASE_URL}/api/qdrant/collections/${encodeURIComponent(collectionName)}/documents`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          credentials: 'include',
          body: JSON.stringify(body)
        }
      )

      if (response.ok) {
        const result = await response.json()
        toast.success(result.message)
        fetchDocuments()
        onSuccess()
      } else {
        const error = await response.json()
        toast.error(error.detail || "삭제에 실패했습니다")
      }
    } catch (error) {
      console.error("Failed to delete document:", error)
      toast.error("삭제 중 오류가 발생했습니다")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-medium">업로드된 문서</h4>
          <p className="text-sm text-muted-foreground">
            컬렉션에 업로드된 문서를 관리합니다
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchDocuments}
          disabled={loadingDocs || deleting}
        >
          <RefreshCw className={cn("h-4 w-4 mr-2", loadingDocs && "animate-spin")} />
          새로고침
        </Button>
      </div>

      {/* 문서 목록 */}
      {loadingDocs ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : documents.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>업로드된 문서가 없습니다</p>
        </div>
      ) : (
        <>
          {/* 선택 삭제 버튼 */}
          {selectedDocs.length > 0 && (
            <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
              <span className="text-sm">{selectedDocs.length}개 선택됨</span>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDeleteSelected}
                disabled={deleting}
              >
                {deleting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    삭제 중...
                  </>
                ) : (
                  "선택 삭제"
                )}
              </Button>
            </div>
          )}

          {/* 문서 테이블 */}
          <div className="border rounded-lg max-h-[40vh] overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-10">
                    <Checkbox
                      checked={documents.length > 0 && selectedDocs.length === documents.length}
                      onCheckedChange={toggleSelectAll}
                      disabled={deleting}
                    />
                  </TableHead>
                  <TableHead>파일명</TableHead>
                  <TableHead className="w-24 text-right">청크 수</TableHead>
                  <TableHead className="w-20 text-center">유형</TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc, index) => (
                  <TableRow key={`${doc.document_id || doc.filename}-${index}`}>
                    <TableCell>
                      <Checkbox
                        checked={isDocSelected(doc)}
                        onCheckedChange={() => toggleSelectDoc(doc)}
                        disabled={deleting}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      <span className="truncate block max-w-[120px] sm:max-w-[180px]" title={doc.filename}>
                        {doc.filename}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {doc.chunk_count.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary" className="text-xs">
                        {doc.source_type === "excel" ? "Excel" : "문서"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleDeleteSingle(doc)}
                        disabled={deleting}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* 합계 표시 */}
          <div className="text-sm text-muted-foreground text-right">
            총 {documents.length}개 문서, {documents.reduce((sum, d) => sum + d.chunk_count, 0).toLocaleString()}개 청크
          </div>
        </>
      )}
    </div>
  )
}
