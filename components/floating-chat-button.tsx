"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { ChatbotLogo } from "@/components/ui/chatbot-logo"

export function FloatingChatButton() {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <div className="fixed bottom-6 right-6 z-40">
      <Link href="/chat?fullscreen=true">
        <Button
          size="lg"
          className={cn(
            "rounded-full shadow-2xl hover:shadow-3xl transition-all duration-300",
            "h-12 px-4 gap-2.5 relative overflow-hidden group",
            "bg-background/80 backdrop-blur-xl border border-primary/20",
            "hover:bg-background/90 hover:border-primary/40 hover:scale-105 active:scale-95"
          )}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {/* 배경 그라데이션 */}
          <div className="absolute inset-0 opacity-[0.03] bg-[conic-gradient(at_center,_rgb(37,99,235),_rgb(16,185,129),_rgb(239,68,68),_rgb(37,99,235))]" />

          {/* 호버 시 샤인 효과 */}
          <div className="absolute inset-0 w-full h-full bg-gradient-to-tr from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 ease-in-out" />

          {/* ChatbotLogo */}
          <ChatbotLogo
            className={cn(
              "h-7 w-7 transition-transform duration-300",
              isHovered && "scale-110"
            )}
            showSparkles={false}
          />

          {/* KCA-i 텍스트 */}
          <span className="font-bold text-sm tracking-tight relative z-10">
            <span className="text-foreground">KCA</span>
            <span className="text-primary">-</span>
            <span className="italic" style={{ color: "var(--chart-2)" }}>i</span>
          </span>

          {/* 펄스 효과 */}
          <span className="absolute inset-0 rounded-full animate-ping bg-primary/10 pointer-events-none" />
        </Button>
      </Link>

      {/* 호버 시 툴팁 */}
      <span
        className={cn(
          "absolute right-0 bottom-full mb-2 whitespace-nowrap",
          "bg-background border rounded-lg px-3 py-1.5 shadow-lg",
          "transition-all duration-300 text-xs font-medium text-muted-foreground",
          isHovered ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1 pointer-events-none"
        )}
      >
        AI 어시스턴트 열기
      </span>
    </div>
  )
}