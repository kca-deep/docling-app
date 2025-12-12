"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Link,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { MarkdownMessage } from "@/components/markdown-message";
import { cleanSourceContent } from "@/lib/content-sanitizer";

interface Source {
  id: string;
  title: string;
  content: string;
  score: number;
  metadata?: {
    page?: number;
    file?: string;
    url?: string;
    section?: string;
    chunk_index?: number;
    document_id?: number;
    num_tokens?: number;
  };
}

interface SourceArtifactModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sources: Source[];
  initialSourceId?: string;
}

export function SourceArtifactModal({
  open,
  onOpenChange,
  sources,
  initialSourceId,
}: SourceArtifactModalProps) {
  const [activeSourceId, setActiveSourceId] = useState<string | null>(
    initialSourceId || sources[0]?.id || null
  );
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const tabsContainerRef = useRef<HTMLDivElement>(null);

  // 모달이 열릴 때 초기 소스 설정
  useEffect(() => {
    if (open) {
      setActiveSourceId(initialSourceId || sources[0]?.id || null);
    }
  }, [open, initialSourceId, sources]);

  // 현재 활성화된 소스 찾기
  const activeSource = sources.find((s) => s.id === activeSourceId) || sources[0];
  const activeIndex = sources.findIndex((s) => s.id === activeSourceId);

  // 이전/다음 문서로 이동
  const goToPrevious = useCallback(() => {
    if (activeIndex > 0) {
      setActiveSourceId(sources[activeIndex - 1].id);
    }
  }, [activeIndex, sources]);

  const goToNext = useCallback(() => {
    if (activeIndex < sources.length - 1) {
      setActiveSourceId(sources[activeIndex + 1].id);
    }
  }, [activeIndex, sources]);

  // 활성 탭이 보이도록 스크롤
  useEffect(() => {
    if (tabsContainerRef.current && activeSourceId) {
      const activeTab = tabsContainerRef.current.querySelector(
        `[data-source-id="${activeSourceId}"]`
      );
      if (activeTab) {
        activeTab.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
      }
    }
  }, [activeSourceId]);

  // 복사 핸들러
  const handleCopy = async () => {
    if (!activeSource) return;

    try {
      await navigator.clipboard.writeText(activeSource.content);
      setCopiedId(activeSource.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // 모바일에서는 토스트 안나옴
    }
  };

  // 점수에 따른 프로그레스 바 색상
  const getScoreBarColor = (score: number) => {
    if (score >= 0.8) return "bg-emerald-500";
    if (score >= 0.6) return "bg-amber-500";
    return "bg-red-500";
  };

  // 점수에 따른 배지 색상
  const getScoreBadgeColor = (score: number) => {
    if (score >= 0.8) return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30";
    if (score >= 0.6) return "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30";
    return "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30";
  };

  // 점수에 따른 라벨
  const getScoreLabel = (score: number) => {
    if (score >= 0.8) return "높은 관련도";
    if (score >= 0.6) return "중간 관련도";
    return "낮은 관련도";
  };

  // 점수에 따른 텍스트 색상
  const getScoreTextColor = (score: number) => {
    if (score >= 0.8) return "text-emerald-600 dark:text-emerald-400 font-semibold";
    if (score >= 0.6) return "text-amber-600 dark:text-amber-400 font-medium";
    return "text-red-500 dark:text-red-400";
  };

  if (sources.length === 0) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="h-[90vh] max-h-[90vh] w-[95vw] max-w-[95vw] p-0 flex flex-col gap-0 rounded-t-xl"
        showCloseButton={false}
      >
        {/* 헤더 */}
        <DialogHeader className="flex-shrink-0 px-4 py-3 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <DialogTitle className="text-base">참조 문서</DialogTitle>
              <Badge variant="secondary" className="text-xs">
                {sources.length}개
              </Badge>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleCopy}
              >
                {copiedId === activeSource?.id ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onOpenChange(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* 탭 네비게이션 */}
        <div className="flex items-center gap-1 px-2 py-2 border-b flex-shrink-0 bg-muted/20">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 flex-shrink-0 rounded-full"
            onClick={goToPrevious}
            disabled={activeIndex <= 0}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <div
            ref={tabsContainerRef}
            className="flex-1 overflow-x-auto scrollbar-hide"
          >
            <div className="flex gap-1.5 px-1">
              {sources.map((source, index) => {
                const isActive = source.id === activeSourceId;
                const scorePercent = source.score * 100;

                return (
                  <button
                    key={source.id}
                    data-source-id={source.id}
                    onClick={() => setActiveSourceId(source.id)}
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all duration-200 whitespace-nowrap",
                      isActive
                        ? "bg-primary/15 dark:bg-primary/20 shadow-sm"
                        : "bg-muted/60 hover:bg-muted dark:bg-muted/40"
                    )}
                  >
                    <span className={cn(
                      "font-semibold text-sm",
                      isActive ? "text-foreground" : "text-muted-foreground"
                    )}>
                      #{index + 1}
                    </span>
                    <span className={cn("text-xs", getScoreTextColor(source.score))}>
                      {scorePercent.toFixed(0)}%
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 flex-shrink-0 rounded-full"
            onClick={goToNext}
            disabled={activeIndex >= sources.length - 1}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* 메타데이터 바 */}
        {activeSource && (
          <div className="px-4 py-3 border-b flex-shrink-0 bg-muted/20">
            {/* 제목 + 관련도 점수 */}
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="font-medium text-sm truncate">
                  {activeSource.title}
                </span>
              </div>
              <Badge
                variant="outline"
                className={cn("flex-shrink-0 font-semibold text-xs", getScoreBadgeColor(activeSource.score))}
              >
                {(activeSource.score * 100).toFixed(0)}%
              </Badge>
            </div>

            {/* 관련도 프로그레스 바 */}
            <div className="mb-2">
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500 ease-out",
                    getScoreBarColor(activeSource.score)
                  )}
                  style={{ width: `${activeSource.score * 100}%` }}
                />
              </div>
            </div>

            {/* 메타 정보 배지들 */}
            <div className="flex flex-wrap items-center gap-1.5">
              {activeSource.metadata?.page && (
                <Badge variant="outline" className="text-xs">
                  페이지 {activeSource.metadata.page}
                </Badge>
              )}
              {activeSource.metadata?.chunk_index !== undefined && (
                <Badge variant="outline" className="text-xs">
                  청크 #{activeSource.metadata.chunk_index}
                </Badge>
              )}
              {activeSource.metadata?.num_tokens && (
                <Badge variant="outline" className="text-xs">
                  {activeSource.metadata.num_tokens} 토큰
                </Badge>
              )}
              {activeSource.metadata?.url && (
                <a
                  href={activeSource.metadata.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <Link className="h-3 w-3" />
                  원본
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
        )}

        {/* 문서 내용 */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-4">
            {activeSource ? (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <MarkdownMessage content={cleanSourceContent(activeSource.content)} compact />
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-8">
                문서를 선택해주세요
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
