"use client"

import { Button } from "@/components/ui/button"
import { AlertTriangle, Trash2 } from "lucide-react"

interface Collection {
  name: string
  documents_count: number
  points_count: number
}

interface DangerZoneTabProps {
  collection: Collection
  onOpenChange: (open: boolean) => void
  onDelete?: () => void
}

export function DangerZoneTab({
  collection,
  onOpenChange,
  onDelete,
}: DangerZoneTabProps) {
  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/5 overflow-hidden">
      {/* 경고 헤더 */}
      <div className="bg-destructive/10 px-4 py-3 border-b border-destructive/20">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <h4 className="font-semibold text-destructive">위험 영역</h4>
        </div>
      </div>

      {/* 삭제 정보 */}
      <div className="p-4 space-y-4">
        <div className="space-y-2">
          <p className="text-sm font-medium">이 작업은 되돌릴 수 없습니다!</p>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-destructive/60" />
              모든 벡터 데이터가 영구 삭제됩니다
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-destructive/60" />
              {collection.documents_count}개 문서, {collection.points_count.toLocaleString()}개 청크 삭제
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-destructive/60" />
              관련 프롬프트 설정도 삭제됩니다
            </li>
          </ul>
        </div>

        <Button
          variant="destructive"
          className="w-full"
          onClick={() => {
            onOpenChange(false)
            onDelete?.()
          }}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          컬렉션 삭제
        </Button>
      </div>
    </div>
  )
}
