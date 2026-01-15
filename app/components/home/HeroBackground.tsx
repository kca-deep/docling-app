"use client"

import { ChevronDown } from "lucide-react"

export function ScrollIndicator() {
  const handleClick = () => {
    const processSection = document.getElementById('process-section')
    processSection?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <button
      onClick={handleClick}
      className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 cursor-pointer p-2 rounded-full hover:bg-muted/30 transition-colors animate-bounce"
      aria-label="다음 섹션으로 스크롤"
    >
      <ChevronDown className="w-6 h-6 text-muted-foreground" />
    </button>
  )
}
