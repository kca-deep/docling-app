"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { CheckCircle2, XCircle, Upload } from "lucide-react"
import { DifyUploadResult, QdrantUploadResult, UploadTarget } from "../types"

interface UploadResultsProps {
  uploadTarget: UploadTarget
  difyResults: DifyUploadResult[]
  qdrantResults: QdrantUploadResult[]
}

export function UploadResults({ uploadTarget, difyResults, qdrantResults }: UploadResultsProps) {
  const results = uploadTarget === "dify" ? difyResults : qdrantResults

  if (results.length === 0) return null

  const successCount = results.filter(r => r.success).length
  const failureCount = results.filter(r => !r.success).length
  const totalChunks = uploadTarget === "qdrant"
    ? (qdrantResults as QdrantUploadResult[]).reduce((acc, r) => acc + r.chunk_count, 0)
    : 0

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          {successCount === results.length ? (
            <CheckCircle2 className="h-5 w-5 text-foreground" />
          ) : failureCount === results.length ? (
            <XCircle className="h-5 w-5 text-destructive" />
          ) : (
            <Upload className="h-5 w-5 text-muted-foreground" />
          )}
          <CardTitle>업로드 결과</CardTitle>
        </div>
        <CardDescription className="mt-2">
          총 {results.length}개 문서 중 {successCount}개 성공, {failureCount}개 실패
          {uploadTarget === "qdrant" && ` | 총 청크: ${totalChunks}개`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="max-h-[300px]">
          <div className="space-y-2">
            {results.map((result, idx) => (
              <div
                key={idx}
                className="flex items-start gap-3 p-3 border rounded-lg bg-card hover:bg-muted/50 transition-colors"
              >
                {result.success ? (
                  <CheckCircle2 className="h-5 w-5 text-foreground mt-0.5 flex-shrink-0" />
                ) : (
                  <XCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
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
                  {result.success && uploadTarget === "dify" && (result as DifyUploadResult).dify_document_id && (
                    <p className="text-xs text-muted-foreground mt-1">
                      문서 ID: {(result as DifyUploadResult).dify_document_id}
                    </p>
                  )}
                  {result.success && uploadTarget === "qdrant" && (
                    <p className="text-xs text-muted-foreground mt-1">
                      청크 수: {(result as QdrantUploadResult).chunk_count} | 벡터 ID: {(result as QdrantUploadResult).vector_ids.length}개 생성
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
  )
}
