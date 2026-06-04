"use client"

import { MarkdownMessage } from "@/components/markdown-message"

interface Props {
  content: string
  className?: string
}

export function MarkdownPreview({ content, className }: Props) {
  return (
    <div className={className}>
      <MarkdownMessage content={content} />
    </div>
  )
}
