"use client";

import { Button } from "@/components/ui/button";
import { Sun, Moon, Maximize, Minimize } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface ChatHeaderProps {
  isFullscreen: boolean;
  onFullscreenToggle: () => void;
  theme: string | undefined;
  onThemeToggle: () => void;
  mounted: boolean;
}

export function ChatHeader({
  isFullscreen,
  onFullscreenToggle,
  theme,
  onThemeToggle,
  mounted,
}: ChatHeaderProps) {
  return (
    <div
      className={cn(
        "relative flex items-center justify-center flex-shrink-0 transition-all duration-300",
        isFullscreen ? "bg-background/95 backdrop-blur-xl" : "bg-background"
      )}
    >
      {/* 상단 그라데이션 라인 */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px]"
        style={{
          background: "linear-gradient(90deg, var(--chart-1), var(--chart-2), var(--chart-3), var(--chart-2), var(--chart-1))",
        }}
      />

      {/* 메인 콘텐츠 영역 */}
      <div className="w-full px-4 py-2 flex items-center justify-center">
        {/* 중앙 텍스트 - 선명한 타이포그래피 */}
        <div className="flex items-center gap-3">
          {/* KCA-i 로고 */}
          <span className="font-extrabold text-2xl tracking-tight text-foreground">
            KCA
            <span className="text-primary">-</span>
            <span
              className="italic"
              style={{ color: "var(--chart-2)" }}
            >
              i
            </span>
          </span>
          {/* 구분선 */}
          <span className="w-px h-6 bg-border" />
          {/* Assistant */}
          <span className="font-medium text-lg text-muted-foreground tracking-wide">
            Assistant
          </span>
        </div>
      </div>

      {/* 하단 그라데이션 라인 */}
      <div
        className="absolute bottom-0 left-0 right-0 h-[1px]"
        style={{
          background: "linear-gradient(90deg, transparent, var(--chart-1), var(--chart-2), var(--chart-3), var(--chart-2), var(--chart-1), transparent)",
        }}
      />

      {/* 오른쪽: 컨트롤 버튼들 */}
      <div className="absolute right-3 flex items-center gap-0.5">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground/60 hover:text-foreground hover:bg-muted/50"
                onClick={onThemeToggle}
              >
                {mounted && theme === "dark" ? (
                  <Sun className="h-3.5 w-3.5" />
                ) : (
                  <Moon className="h-3.5 w-3.5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">
                {mounted && theme === "dark" ? "라이트 모드" : "다크 모드"}
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground/60 hover:text-foreground hover:bg-muted/50"
                onClick={onFullscreenToggle}
              >
                {isFullscreen ? (
                  <Minimize className="h-3.5 w-3.5" />
                ) : (
                  <Maximize className="h-3.5 w-3.5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">
                {isFullscreen ? "전체화면 종료" : "전체화면"}
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}
