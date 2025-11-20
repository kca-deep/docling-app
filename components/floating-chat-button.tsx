"use client"

import { useState } from "react"
import { MessageSquare, X, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import Link from "next/link"

export function FloatingChatButton() {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <Link href="/chat?fullscreen=true">
        <Button
          size="lg"
          className={cn(
            "rounded-full shadow-2xl hover:shadow-3xl transition-all duration-300",
            "w-14 h-14 p-0 relative overflow-hidden group",
            "bg-gradient-to-r from-primary to-primary/80"
          )}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {/* 애니메이션 배경 */}
          <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-transparent animate-pulse" />

          {/* 아이콘 */}
          <div className="relative">
            <MessageSquare
              className={cn(
                "w-6 h-6 transition-all duration-300",
                isHovered && "scale-110 rotate-12"
              )}
            />
            {/* 반짝이 효과 */}
            <Sparkles className="w-3 h-3 absolute -top-1 -right-1 text-yellow-300 animate-pulse" />
          </div>

          {/* 호버 시 텍스트 */}
          <span
            className={cn(
              "absolute left-full ml-3 whitespace-nowrap",
              "bg-background border rounded-lg px-3 py-1.5 shadow-lg",
              "transition-all duration-300 text-sm font-medium",
              isHovered ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2 pointer-events-none"
            )}
          >
            AI 챗봇 열기
          </span>

          {/* 펄스 효과 */}
          <span className="absolute inset-0 rounded-full animate-ping bg-primary/20" />
        </Button>
      </Link>

      {/* 툴팁 화살표 */}
      {isHovered && (
        <div className="absolute top-1/2 -translate-y-1/2 left-full ml-2 w-0 h-0
          border-t-[6px] border-t-transparent
          border-r-[8px] border-r-background
          border-b-[6px] border-b-transparent
          animate-fade-in"
        />
      )}
    </div>
  )
}