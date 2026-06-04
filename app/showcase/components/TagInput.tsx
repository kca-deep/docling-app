"use client"

import { useState, KeyboardEvent } from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

const SUGGESTED_TAGS = [
  "#ChatGPT", "#Claude", "#Gemini", "#Copilot",
  "#엑셀", "#보고서", "#이메일", "#기획서", "#요약",
  "#Python", "#JavaScript", "#VBA", "#SQL",
  "#인사", "#기획", "#총무", "#IT", "#회계",
  "#이미지생성", "#Midjourney", "#DALL-E",
]

interface Props {
  value: string[]
  onChange: (tags: string[]) => void
  className?: string
}

export function TagInput({ value, onChange, className }: Props) {
  const [input, setInput] = useState("")
  const [showSuggestions, setShowSuggestions] = useState(false)

  const suggestions = SUGGESTED_TAGS.filter(
    (t) => !value.includes(t) && t.toLowerCase().includes(input.toLowerCase())
  )

  const addTag = (tag: string) => {
    const normalized = tag.startsWith("#") ? tag : `#${tag}`
    if (!value.includes(normalized) && value.length < 10) {
      onChange([...value, normalized])
    }
    setInput("")
    setShowSuggestions(false)
  }

  const removeTag = (tag: string) => onChange(value.filter((t) => t !== tag))

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === "Enter" || e.key === ",") && input.trim()) {
      e.preventDefault()
      addTag(input.trim())
    } else if (e.key === "Backspace" && !input && value.length > 0) {
      removeTag(value[value.length - 1])
    }
  }

  return (
    <div className={cn("relative", className)}>
      <div className="min-h-10 flex flex-wrap gap-1.5 p-2 border rounded-md bg-background focus-within:ring-1 focus-within:ring-ring">
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-primary/10 text-primary text-xs"
          >
            {tag}
            <button type="button" onClick={() => removeTag(tag)} className="hover:text-destructive">
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={input}
          onChange={(e) => { setInput(e.target.value); setShowSuggestions(true) }}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          placeholder={value.length === 0 ? "#태그 입력 후 Enter" : ""}
          className="flex-1 min-w-24 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 top-full mt-1 w-full bg-popover border rounded-md shadow-md p-1.5 flex flex-wrap gap-1">
          {suggestions.slice(0, 12).map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => addTag(tag)}
              className="px-2 py-0.5 rounded text-xs bg-muted hover:bg-primary/10 hover:text-primary transition-colors"
            >
              {tag}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
