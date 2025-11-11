"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bot, User, FileText, Copy, Check, RefreshCw } from "lucide-react";
import { MarkdownMessage } from "@/components/markdown-message";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface Source {
  id: string;
  title: string;
  content: string;
  score: number;
  metadata?: {
    page?: number;
    file?: string;
    url?: string;
  };
}

interface MessageBubbleProps {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  sources?: Source[];
  metadata?: {
    tokens?: number;
    processingTime?: number;
  };
  onSourceClick?: (sources: Source[]) => void;
  onCopy?: () => void;
  onRegenerate?: () => void;
  isLast?: boolean;
}

export function MessageBubble({
  role,
  content,
  timestamp,
  sources,
  metadata,
  onSourceClick,
  onCopy,
  onRegenerate,
  isLast,
}: MessageBubbleProps) {
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div
      className={cn(
        "group relative flex gap-3 w-full",
        role === "user" && "flex-row-reverse"
      )}
    >
      {/* 아바타 */}
      <Avatar className="h-8 w-8 flex-shrink-0">
        <AvatarFallback
          className={cn(
            role === "user"
              ? "bg-primary text-primary-foreground"
              : "bg-muted"
          )}
        >
          {role === "assistant" ? (
            <Bot className="h-4 w-4" />
          ) : role === "system" ? (
            <RefreshCw className="h-4 w-4" />
          ) : (
            <User className="h-4 w-4" />
          )}
        </AvatarFallback>
      </Avatar>

      {/* 메시지 콘텐츠 */}
      <div
        className={cn(
          "flex flex-col gap-1 w-full max-w-[calc(100%-3rem)] min-w-0",
          role === "user" && "items-end"
        )}
      >
        {/* 메시지 버블 */}
        <div
          className={cn(
            "rounded-lg p-4 w-full shadow-sm transition-colors",
            role === "user"
              ? "bg-primary text-primary-foreground"
              : role === "system"
              ? "bg-muted/50 border border-border"
              : "bg-card border border-border"
          )}
        >
          <div className="w-full min-w-0 overflow-hidden">
            {role === "assistant" || role === "system" ? (
              <MarkdownMessage content={content} />
            ) : (
              <p className="text-sm whitespace-pre-wrap break-words">
                {content}
              </p>
            )}
          </div>

          {/* 참조 문서 표시 */}
          {sources && sources.length > 0 && (
            <div className="mt-3 pt-3 border-t">
              <button
                onClick={() => onSourceClick?.(sources)}
                className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <FileText className="h-3 w-3" />
                <span>{sources.length}개의 참조 문서</span>
              </button>
            </div>
          )}

          {/* 메타데이터 표시 */}
          {metadata && (
            <div className="mt-2 flex items-center gap-2">
              {metadata.tokens && (
                <Badge variant="outline" className="text-xs">
                  {metadata.tokens} 토큰
                </Badge>
              )}
              {metadata.processingTime && (
                <Badge variant="outline" className="text-xs">
                  {metadata.processingTime.toFixed(1)}초
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* 타임스탬프 및 액션 */}
        <div className="flex items-center gap-2 px-1">
          <span className="text-xs text-muted-foreground">
            {formatTime(timestamp)}
          </span>

          {/* 액션 버튼 (호버 시 표시) */}
          {role === "assistant" && (
            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={onCopy}
              >
                <Copy className="h-3 w-3" />
              </Button>
              {isLast && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={onRegenerate}
                >
                  <RefreshCw className="h-3 w-3" />
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}