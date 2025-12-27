"use client"

import { useState } from "react"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Copy, Check, RotateCcw } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface PromptEditorProps {
  value: string
  onChange: (value: string) => void
  originalValue?: string
  className?: string
  placeholder?: string
}

export function PromptEditor({
  value,
  onChange,
  originalValue,
  className,
  placeholder = "프롬프트 내용을 입력하세요...",
}: PromptEditorProps) {
  const [copied, setCopied] = useState(false)

  // Copy to clipboard
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      toast.success("클립보드에 복사되었습니다")
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      toast.error("복사에 실패했습니다")
    }
  }

  // Reset to original
  const handleReset = () => {
    if (originalValue) {
      onChange(originalValue)
      toast.info("원본으로 복원되었습니다")
    }
  }

  // Count statistics
  const charCount = value.length
  const lineCount = value.split("\n").length

  return (
    <div className={cn("flex flex-col border rounded-md", className)}>
      {/* Toolbar - 간소화 */}
      <div className="flex items-center justify-end gap-1 px-2 py-1.5 border-b bg-muted/30">
        {originalValue && value !== originalValue && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="h-6 px-2 text-xs"
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            복원
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          className="h-6 px-2 text-xs"
        >
          {copied ? (
            <Check className="h-3 w-3 mr-1" />
          ) : (
            <Copy className="h-3 w-3 mr-1" />
          )}
          복사
        </Button>
      </div>

      {/* Content area - 편집만 */}
      <div className="flex-1 min-h-0">
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="h-full min-h-[160px] resize-none border-0 rounded-none focus-visible:ring-0 focus-visible:ring-offset-0 font-mono text-sm"
        />
      </div>

      {/* Footer with stats - 간소화 */}
      <div className="flex items-center justify-end gap-3 px-2 py-1 border-t bg-muted/30 text-[10px] text-muted-foreground">
        <span>{charCount.toLocaleString()}자</span>
        <span>{lineCount}줄</span>
      </div>
    </div>
  )
}
