"use client"

import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Placeholder from "@tiptap/extension-placeholder"
import { Markdown } from "tiptap-markdown"
import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Undo,
  Redo,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  minHeight?: string
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "내용을 입력하세요...",
  disabled = false,
  className,
  minHeight = "120px",
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
      }),
      Placeholder.configure({
        placeholder,
      }),
      // 마크다운 지원 확장
      Markdown.configure({
        html: true,                  // HTML 입출력 허용
        breaks: true,                // \n을 <br>로 변환
        tightLists: true,            // 리스트 간격 최소화
        bulletListMarker: "-",       // 불릿 리스트 마커
        transformPastedText: true,   // 붙여넣기 시 마크다운 파싱
      }),
    ],
    content: value,
    editable: !disabled,
    onUpdate: ({ editor }) => {
      // HTML로 출력 (서식 유지)
      onChange(editor.getHTML())
    },
  })

  // 외부에서 value가 변경되면 에디터 내용도 업데이트
  // Markdown 확장 덕분에 마크다운 텍스트도 자동 파싱됨
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value)
    }
  }, [editor, value])

  // disabled 상태 변경 시 editable 업데이트
  useEffect(() => {
    if (editor) {
      editor.setEditable(!disabled)
    }
  }, [editor, disabled])

  if (!editor) {
    return (
      <div
        className={cn(
          "rounded-md border bg-background animate-pulse",
          className
        )}
        style={{ minHeight }}
      />
    )
  }

  return (
    <div className={cn(
      "rounded-md border bg-background overflow-hidden",
      disabled && "opacity-50 cursor-not-allowed",
      className
    )}>
      {/* Toolbar */}
      {!disabled && (
        <div className="flex items-center gap-1 border-b px-2 py-1.5 bg-muted/30">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            isActive={editor.isActive("bold")}
            disabled={!editor.can().chain().focus().toggleBold().run()}
            title="굵게 (Ctrl+B)"
          >
            <Bold className="h-4 w-4" />
          </ToolbarButton>

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            isActive={editor.isActive("italic")}
            disabled={!editor.can().chain().focus().toggleItalic().run()}
            title="기울임 (Ctrl+I)"
          >
            <Italic className="h-4 w-4" />
          </ToolbarButton>

          <div className="w-px h-4 bg-border mx-1" />

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            isActive={editor.isActive("bulletList")}
            title="글머리 기호"
          >
            <List className="h-4 w-4" />
          </ToolbarButton>

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            isActive={editor.isActive("orderedList")}
            title="번호 매기기"
          >
            <ListOrdered className="h-4 w-4" />
          </ToolbarButton>

          <div className="w-px h-4 bg-border mx-1" />

          <ToolbarButton
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().chain().focus().undo().run()}
            title="실행 취소 (Ctrl+Z)"
          >
            <Undo className="h-4 w-4" />
          </ToolbarButton>

          <ToolbarButton
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().chain().focus().redo().run()}
            title="다시 실행 (Ctrl+Y)"
          >
            <Redo className="h-4 w-4" />
          </ToolbarButton>
        </div>
      )}

      {/* Editor Content */}
      <EditorContent
        editor={editor}
        className={cn(
          "prose prose-sm dark:prose-invert max-w-none px-3 py-2",
          "[&_.ProseMirror]:outline-none",
          "[&_.ProseMirror]:min-h-[var(--editor-min-height)]",
          "[&_.ProseMirror_p.is-editor-empty:first-child::before]:text-muted-foreground",
          "[&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]",
          "[&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left",
          "[&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none",
          "[&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0",
        )}
        style={{ "--editor-min-height": minHeight } as React.CSSProperties}
      />
    </div>
  )
}

// 툴바 버튼 컴포넌트
function ToolbarButton({
  onClick,
  isActive,
  disabled,
  title,
  children,
}: {
  onClick: () => void
  isActive?: boolean
  disabled?: boolean
  title?: string
  children: React.ReactNode
}) {
  return (
    <Button
      type="button"
      variant={isActive ? "secondary" : "ghost"}
      size="sm"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="h-7 w-7 p-0"
    >
      {children}
    </Button>
  )
}
