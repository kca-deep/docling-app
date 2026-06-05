"use client"

import { useRef } from "react"
import { Sparkles, Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { EXTRACT_ACCEPT } from "@/lib/showcase"

interface Props {
  /** 파일 선택 시 호출 (검증은 상위에서 수행) */
  onFile: (file: File) => void
  /** 추출(분석) 진행 중 여부 */
  extracting: boolean
  /** 진행 중 취소 */
  onCancel: () => void
  /** 비활성화 (예: 저장 진행 중) */
  disabled?: boolean
}

/**
 * AI 기반 자동 작성 트리거 버튼 (입력 폼 우측 상단).
 * 클릭하면 문서(hwp/hwpx/pdf/docx) 파일 선택창이 열리고,
 * 선택한 문서로 제목·본문·태그 등을 자동으로 채운다.
 */
export function AutoFillButton({ onFile, extracting, onCancel, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  const openPicker = () => {
    if (disabled || extracting) return
    inputRef.current?.click()
  }

  return (
    <div className="flex items-center gap-2">
      {/* 숨김 input — ref + 명시적 click()로 안정적으로 파일창 오픈 */}
      <input
        ref={inputRef}
        type="file"
        accept={EXTRACT_ACCEPT}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onFile(f)
          e.target.value = "" // 같은 파일 재선택 허용
        }}
      />

      {extracting ? (
        <>
          <Button type="button" variant="outline" size="sm" disabled className="gap-1.5">
            <Loader2 className="h-4 w-4 animate-spin" />
            문서 분석 중...
          </Button>
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" />
            취소
          </button>
        </>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={openPicker}
          disabled={disabled}
          title="hwp · hwpx · pdf · docx 문서를 업로드하면 제목·본문·태그를 자동으로 채워줍니다"
          className="gap-1.5 border-primary/40 bg-primary/5 text-primary hover:bg-primary/10 hover:text-primary"
        >
          <Sparkles className="h-4 w-4" />
          AI기반 자동작성하기
        </Button>
      )}
    </div>
  )
}
