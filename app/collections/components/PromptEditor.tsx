"use client"

import { useState } from "react"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Eye, Edit3, Copy, Check, RotateCcw } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import ReactMarkdown from "react-markdown"

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
  const [activeTab, setActiveTab] = useState<"edit" | "preview">("edit")
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
  const wordCount = value.trim() ? value.trim().split(/\s+/).length : 0
  const lineCount = value.split("\n").length

  return (
    <div className={cn("flex flex-col border rounded-md", className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "edit" | "preview")}>
          <TabsList className="h-8">
            <TabsTrigger value="edit" className="h-7 text-xs px-3">
              <Edit3 className="h-3 w-3 mr-1" />
              편집
            </TabsTrigger>
            <TabsTrigger value="preview" className="h-7 text-xs px-3">
              <Eye className="h-3 w-3 mr-1" />
              미리보기
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-1">
          {originalValue && value !== originalValue && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="h-7 px-2 text-xs"
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              복원
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="h-7 px-2 text-xs"
          >
            {copied ? (
              <Check className="h-3 w-3 mr-1" />
            ) : (
              <Copy className="h-3 w-3 mr-1" />
            )}
            복사
          </Button>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 min-h-0">
        {activeTab === "edit" ? (
          <Textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="h-full min-h-[160px] resize-none border-0 rounded-none focus-visible:ring-0 focus-visible:ring-offset-0 font-mono text-sm"
          />
        ) : (
          <ScrollArea className="h-full min-h-[160px] p-4">
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown>{value || "*내용이 없습니다*"}</ReactMarkdown>
            </div>
          </ScrollArea>
        )}
      </div>

      {/* Footer with stats */}
      <div className="flex items-center justify-end gap-4 px-3 py-1.5 border-t bg-muted/30 text-xs text-muted-foreground">
        <span>{charCount.toLocaleString()} 글자</span>
        <span>{wordCount.toLocaleString()} 단어</span>
        <span>{lineCount.toLocaleString()} 줄</span>
      </div>
    </div>
  )
}
