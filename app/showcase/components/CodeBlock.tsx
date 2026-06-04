"use client"

import { useState } from "react"
import { Copy, Check } from "lucide-react"
import { cn } from "@/lib/utils"

interface Props {
  code: string
  language?: string
  className?: string
}

export function CodeBlock({ code, language, className }: Props) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={cn("relative group rounded-lg border bg-muted/50", className)}>
      {language && (
        <div className="px-3 py-1.5 text-xs text-muted-foreground border-b font-mono">
          {language}
        </div>
      )}
      <pre className="p-4 overflow-x-auto text-sm font-mono leading-relaxed">
        <code>{code}</code>
      </pre>
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded bg-background/80 border text-muted-foreground hover:text-foreground"
        title="복사"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  )
}
