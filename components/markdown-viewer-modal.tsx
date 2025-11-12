"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Loader2, Download, FileText, Clock, Calendar } from "lucide-react"
import { MarkdownMessage } from "@/components/markdown-message"
import { toast } from "sonner"

interface DocumentDetail {
  id: number
  task_id: string
  original_filename: string
  file_size: number | null
  file_type: string | null
  md_content: string
  processing_time: number | null
  content_length: number | null
  download_count: number
  created_at: string
}

interface MarkdownViewerModalProps {
  documentId: number | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MarkdownViewerModal({ documentId, open, onOpenChange }: MarkdownViewerModalProps) {
  const [document, setDocument] = useState<DocumentDetail | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open && documentId) {
      fetchDocument()
    }
  }, [open, documentId])

  const fetchDocument = async () => {
    if (!documentId) return

    setLoading(true)
    try {
      const response = await fetch(`http://localhost:8000/api/documents/saved/${documentId}`)
      if (response.ok) {
        const data: DocumentDetail = await response.json()
        setDocument(data)
      } else {
        toast.error("문서를 불러오는데 실패했습니다")
      }
    } catch (error) {
      console.error("Failed to fetch document:", error)
      toast.error("문서를 불러오는데 실패했습니다")
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = () => {
    if (!document) return

    const blob = new Blob([document.md_content], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = window.document.createElement('a')
    a.href = url
    a.download = `${document.original_filename}.md`
    a.click()
    URL.revokeObjectURL(url)
    toast.success("마크다운 파일이 다운로드되었습니다")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[90vw] sm:max-w-[90vw] md:max-w-[85vw] lg:max-w-[80vw] h-[90vh] flex flex-col overflow-hidden p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {loading ? "문서 불러오는 중..." : document?.original_filename || "문서 뷰어"}
          </DialogTitle>
          <DialogDescription>
            {loading ? "잠시만 기다려주세요" : "마크다운 형식으로 변환된 문서 내용을 확인하세요"}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center flex-1 px-6">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">문서를 불러오는 중...</p>
          </div>
        ) : document ? (
          <>
            {/* 문서 메타데이터 */}
            <div className="px-6 pb-4 space-y-2 shrink-0">
              <div className="flex items-center gap-4 text-sm flex-wrap">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>{new Date(document.created_at).toLocaleString("ko-KR")}</span>
                </div>
                {document.processing_time && (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>{document.processing_time.toFixed(2)}초</span>
                  </div>
                )}
                <Badge variant="outline">{document.file_type?.toUpperCase() || "PDF"}</Badge>
                {document.content_length && (
                  <Badge variant="secondary">{(document.content_length / 1000).toFixed(1)}KB</Badge>
                )}
              </div>
              <Separator />
            </div>

            {/* 마크다운 콘텐츠 - 명확한 높이 지정 */}
            <div className="flex-1 min-h-0 overflow-hidden">
              <ScrollArea className="h-full w-full">
                <div className="px-6 pb-6 pr-10">
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <MarkdownMessage content={document.md_content} />
                  </div>
                </div>
              </ScrollArea>
            </div>

            <DialogFooter className="px-6 pb-6 pt-4 shrink-0 border-t">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                닫기
              </Button>
              <Button onClick={handleDownload}>
                <Download className="mr-2 h-4 w-4" />
                마크다운 다운로드
              </Button>
            </DialogFooter>
          </>
        ) : (
          <div className="flex items-center justify-center flex-1 px-6 text-center text-muted-foreground">
            문서를 찾을 수 없습니다
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
