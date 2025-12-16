"use client"

import { useState } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertTriangle, Loader2 } from "lucide-react"

interface DeleteConfirmModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  collectionName: string
  onConfirm: () => Promise<void>
}

export function DeleteConfirmModal({
  open,
  onOpenChange,
  collectionName,
  onConfirm,
}: DeleteConfirmModalProps) {
  const [confirmInput, setConfirmInput] = useState("")
  const [deleting, setDeleting] = useState(false)

  const isConfirmValid = confirmInput === collectionName

  const handleConfirm = async () => {
    if (!isConfirmValid) return

    setDeleting(true)
    try {
      await onConfirm()
    } finally {
      setDeleting(false)
      setConfirmInput("")
    }
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setConfirmInput("")
    }
    onOpenChange(open)
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            컬렉션 삭제
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4">
              <p>
                <strong className="text-foreground select-all cursor-text">{collectionName}</strong> 컬렉션을 삭제하시겠습니까?
              </p>
              <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-3 text-sm">
                <p className="text-destructive font-medium mb-1">주의:</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>모든 벡터 데이터가 영구적으로 삭제됩니다</li>
                  <li>이 작업은 되돌릴 수 없습니다</li>
                  <li>관련된 프롬프트 설정도 삭제됩니다</li>
                </ul>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-input" className="text-foreground">
                  삭제를 확인하려면 컬렉션 이름을 입력하세요:
                </Label>
                <Input
                  id="confirm-input"
                  placeholder={collectionName}
                  value={confirmInput}
                  onChange={(e) => setConfirmInput(e.target.value)}
                  className="font-mono"
                />
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>취소</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={!isConfirmValid || deleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                삭제 중...
              </>
            ) : (
              "삭제"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
