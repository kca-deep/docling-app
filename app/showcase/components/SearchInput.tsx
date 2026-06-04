"use client"

import { useState, useEffect, useCallback } from "react"
import { Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"

interface Props {
  value: string
  onSearch: (v: string) => void
}

export function SearchInput({ value, onSearch }: Props) {
  const [local, setLocal] = useState(value)

  useEffect(() => setLocal(value), [value])

  const debounced = useCallback(
    (() => {
      let timer: ReturnType<typeof setTimeout>
      return (v: string) => {
        clearTimeout(timer)
        timer = setTimeout(() => onSearch(v), 300)
      }
    })(),
    [onSearch]
  )

  const handleChange = (v: string) => {
    setLocal(v)
    debounced(v)
  }

  return (
    <div className="relative">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
      <Input
        value={local}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="제목, 설명, 태그 검색..."
        className="pl-8 pr-8 h-8 text-sm"
      />
      {local && (
        <button
          onClick={() => handleChange("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}
