"use client"

import { useState, useCallback, useRef } from "react"
import { toast } from "sonner"
import { Upload, X, FileText, File, Loader2, Download, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { apiEndpoints } from "@/lib/api-config"

// 허용 확장자
const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".doc", ".pptx", ".ppt", ".hwp"]
const MAX_FILE_SIZE_MB = 20
const MAX_FILES = 5

export interface AttachmentFile {
  id?: number
  original_filename: string
  file_size: number
  mime_type?: string
  extraction_status?: string
  created_at?: string
  // 업로드 중 상태 추적용
  uploading?: boolean
  error?: string
  localFile?: File
}

interface FileAttachmentProps {
  submissionId?: string
  attachments: AttachmentFile[]
  onChange: (attachments: AttachmentFile[]) => void
  disabled?: boolean
  maxFiles?: number
  readOnly?: boolean
}

export function FileAttachment({
  submissionId,
  attachments,
  onChange,
  disabled = false,
  maxFiles = MAX_FILES,
  readOnly = false,
}: FileAttachmentProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [uploadingFiles, setUploadingFiles] = useState<Set<string>>(new Set())
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragCounterRef = useRef(0)

  // 파일 확장자 검증
  const isValidExtension = (filename: string) => {
    const ext = "." + filename.split(".").pop()?.toLowerCase()
    return ALLOWED_EXTENSIONS.includes(ext)
  }

  // 파일 크기 포맷
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  // 파일 아이콘
  const getFileIcon = (filename: string) => {
    const ext = filename.split(".").pop()?.toLowerCase()
    if (ext === "pdf") return <FileText className="h-4 w-4 text-red-500" />
    if (["doc", "docx"].includes(ext || "")) return <FileText className="h-4 w-4 text-blue-500" />
    if (["ppt", "pptx"].includes(ext || "")) return <FileText className="h-4 w-4 text-orange-500" />
    if (ext === "hwp") return <FileText className="h-4 w-4 text-cyan-500" />
    return <File className="h-4 w-4 text-muted-foreground" />
  }

  // 파일 업로드
  const uploadFile = async (file: File) => {
    if (!submissionId) {
      // submission이 아직 생성되지 않은 경우 로컬에만 추가
      const newAttachment: AttachmentFile = {
        original_filename: file.name,
        file_size: file.size,
        mime_type: file.type,
        localFile: file,
      }
      onChange([...attachments, newAttachment])
      return
    }

    const formData = new FormData()
    formData.append("file", file)

    setUploadingFiles((prev) => new Set(prev).add(file.name))

    try {
      const response = await fetch(
        `${apiEndpoints.selfcheck}/${submissionId}/attachments`,
        {
          method: "POST",
          credentials: "include",
          body: formData,
        }
      )

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.detail || "업로드 실패")
      }

      const result = await response.json()

      const newAttachment: AttachmentFile = {
        id: result.id,
        original_filename: result.original_filename,
        file_size: result.file_size,
        mime_type: result.mime_type,
        extraction_status: result.extraction_status,
      }

      onChange([...attachments, newAttachment])
      toast.success(`${file.name} 업로드 완료`)
    } catch (error) {
      console.error("Upload error:", error)
      toast.error(error instanceof Error ? error.message : "파일 업로드에 실패했습니다.")
    } finally {
      setUploadingFiles((prev) => {
        const next = new Set(prev)
        next.delete(file.name)
        return next
      })
    }
  }

  // 파일 선택 처리
  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files)

      // 파일 수 제한 확인
      if (attachments.length + fileArray.length > maxFiles) {
        toast.warning(`파일은 최대 ${maxFiles}개까지 첨부 가능합니다.`)
        return
      }

      for (const file of fileArray) {
        // 확장자 검증
        if (!isValidExtension(file.name)) {
          toast.error(`${file.name}: 지원하지 않는 파일 형식입니다.`)
          continue
        }

        // 크기 검증
        if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
          toast.error(`${file.name}: 파일 크기는 ${MAX_FILE_SIZE_MB}MB를 초과할 수 없습니다.`)
          continue
        }

        // 중복 검사
        if (attachments.some((a) => a.original_filename === file.name)) {
          toast.warning(`${file.name}: 이미 첨부된 파일입니다.`)
          continue
        }

        await uploadFile(file)
      }
    },
    [attachments, maxFiles, submissionId, onChange]
  )

  // 파일 삭제
  const handleDelete = async (attachment: AttachmentFile, index: number) => {
    if (attachment.id && submissionId) {
      try {
        const response = await fetch(
          `${apiEndpoints.selfcheck}/${submissionId}/attachments/${attachment.id}`,
          {
            method: "DELETE",
            credentials: "include",
          }
        )

        if (!response.ok) {
          throw new Error("삭제 실패")
        }

        toast.success(`${attachment.original_filename} 삭제됨`)
      } catch (error) {
        console.error("Delete error:", error)
        toast.error("파일 삭제에 실패했습니다.")
        return
      }
    }

    // 로컬 상태에서 제거
    const newAttachments = [...attachments]
    newAttachments.splice(index, 1)
    onChange(newAttachments)
  }

  // 파일 다운로드
  const handleDownload = async (attachment: AttachmentFile) => {
    if (!attachment.id || !submissionId) return

    try {
      const response = await fetch(
        `${apiEndpoints.selfcheck}/${submissionId}/attachments/${attachment.id}/download`,
        {
          credentials: "include",
        }
      )

      if (!response.ok) throw new Error("다운로드 실패")

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = attachment.original_filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error("Download error:", error)
      toast.error("파일 다운로드에 실패했습니다.")
    }
  }

  // 파일 미리보기 (PDF만)
  const handlePreview = (attachment: AttachmentFile) => {
    if (!attachment.id || !submissionId) return

    const previewUrl = `${apiEndpoints.selfcheck}/${submissionId}/attachments/${attachment.id}/preview`
    window.open(previewUrl, "_blank")
  }

  // 드래그 이벤트
  const handleDragEnter = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (disabled || readOnly) return

      dragCounterRef.current++
      if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
        setIsDragging(true)
      }
    },
    [disabled, readOnly]
  )

  const handleDragLeave = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (disabled || readOnly) return

      dragCounterRef.current--
      if (dragCounterRef.current === 0) {
        setIsDragging(false)
      }
    },
    [disabled, readOnly]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)
      dragCounterRef.current = 0

      if (disabled || readOnly) return

      const files = e.dataTransfer.files
      if (files && files.length > 0) {
        handleFiles(files)
      }
    },
    [disabled, readOnly, handleFiles]
  )

  const handleClick = () => {
    if (disabled || readOnly) return
    fileInputRef.current?.click()
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files)
      // Reset input
      e.target.value = ""
    }
  }

  const isUploading = uploadingFiles.size > 0

  return (
    <div className="space-y-3">
      {/* 드롭존 (읽기 전용이 아닐 때만) */}
      {!readOnly && (
        <div
          className={cn(
            "relative border-2 border-dashed rounded-lg p-4 transition-colors cursor-pointer",
            isDragging
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-muted-foreground/50",
            (disabled || attachments.length >= maxFiles) && "opacity-50 cursor-not-allowed"
          )}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={handleClick}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ALLOWED_EXTENSIONS.join(",")}
            className="hidden"
            onChange={handleInputChange}
            disabled={disabled || attachments.length >= maxFiles}
          />

          <div className="flex flex-col items-center gap-2 text-center">
            <div
              className={cn(
                "p-2 rounded-full",
                isDragging ? "bg-primary/10" : "bg-muted"
              )}
            >
              <Upload
                className={cn(
                  "h-5 w-5",
                  isDragging ? "text-primary" : "text-muted-foreground"
                )}
              />
            </div>
            <div>
              <p className="text-sm font-medium">
                파일을 드래그하거나 클릭하여 첨부
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {ALLOWED_EXTENSIONS.join(", ")} (최대 {MAX_FILE_SIZE_MB}MB, {maxFiles}개)
              </p>
            </div>
          </div>

          {/* 파일 수 표시 */}
          {attachments.length > 0 && (
            <div className="absolute top-2 right-2 text-xs text-muted-foreground">
              {attachments.length}/{maxFiles}
            </div>
          )}
        </div>
      )}

      {/* 첨부파일 목록 */}
      {attachments.length > 0 && (
        <div className="space-y-2">
          {attachments.map((attachment, index) => (
            <div
              key={attachment.id || attachment.original_filename}
              className="flex items-center justify-between p-2 rounded-md border bg-muted/30"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {getFileIcon(attachment.original_filename)}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">
                    {attachment.original_filename}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(attachment.file_size)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0 ml-2">
                {uploadingFiles.has(attachment.original_filename) ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : (
                  <>
                    {/* PDF 미리보기 버튼 */}
                    {attachment.id && attachment.mime_type === "application/pdf" && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => handlePreview(attachment)}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    )}

                    {/* 다운로드 버튼 */}
                    {attachment.id && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => handleDownload(attachment)}
                      >
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                    )}

                    {/* 삭제 버튼 (읽기 전용이 아닐 때만) */}
                    {!readOnly && !disabled && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(attachment, index)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 업로드 중 상태 */}
      {isUploading && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          파일 업로드 중...
        </p>
      )}
    </div>
  )
}
