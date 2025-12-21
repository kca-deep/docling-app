"use client";

import { useEffect, useCallback, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  X,
  FileText,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Link,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useState } from "react";
import { MarkdownMessage } from "@/components/markdown-message";
import { cleanSourceContent } from "@/lib/content-sanitizer";
import { applyMarkdownHighlighting } from "@/lib/markdown-highlighter";
import type { Source } from "../types";

interface SourceArtifactPanelProps {
  sources: Source[];
  activeSourceId: string | null;
  onSourceSelect: (id: string) => void;
  onClose: () => void;
}

export function SourceArtifactPanel({
  sources,
  activeSourceId,
  onSourceSelect,
  onClose,
}: SourceArtifactPanelProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const tabsContainerRef = useRef<HTMLDivElement>(null);

  // 현재 활성화된 소스 찾기
  const activeSource = sources.find((s) => s.id === activeSourceId) || sources[0];
  const activeIndex = sources.findIndex((s) => s.id === activeSourceId);

  // 이전/다음 문서로 이동
  const goToPrevious = useCallback(() => {
    if (activeIndex > 0) {
      onSourceSelect(sources[activeIndex - 1].id);
    }
  }, [activeIndex, sources, onSourceSelect]);

  const goToNext = useCallback(() => {
    if (activeIndex < sources.length - 1) {
      onSourceSelect(sources[activeIndex + 1].id);
    }
  }, [activeIndex, sources, onSourceSelect]);

  // 키보드 단축키
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ESC로 닫기
      if (e.key === "Escape") {
        onClose();
        return;
      }

      // 좌/우 화살표로 이동
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goToPrevious();
        return;
      }

      if (e.key === "ArrowRight") {
        e.preventDefault();
        goToNext();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, goToPrevious, goToNext]);

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
      toast.success("내용이 복사되었습니다");
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error("복사에 실패했습니다");
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

  // 탭 카드 배경색 (선택됨) - 중립적인 색상
  const getTabActiveBgColor = () => {
    return "bg-primary/15 dark:bg-primary/20";
  };

  // 탭 카드 배경색 (미선택) - 중립적인 색상
  const getTabInactiveBgColor = () => {
    return "bg-muted/60 hover:bg-muted dark:bg-muted/40 dark:hover:bg-muted/60";
  };

  // 점수에 따른 텍스트 색상 (관련도 표시용)
  const getScoreTextColor = (score: number) => {
    if (score >= 0.8) return "text-emerald-600 dark:text-emerald-400 font-semibold";
    if (score >= 0.6) return "text-amber-600 dark:text-amber-400 font-medium";
    return "text-red-500 dark:text-red-400";
  };

  if (sources.length === 0) {
    return null;
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">참조 문서</h3>
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
            title="현재 문서 복사"
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
            onClick={onClose}
            title="닫기 (ESC)"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* 탭 네비게이션 - 미니 카드 형태 */}
      <div className="flex items-center gap-1.5 px-2 py-3 border-b flex-shrink-0 bg-muted/20">
        {/* 이전 버튼 */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 flex-shrink-0 rounded-full"
          onClick={goToPrevious}
          disabled={activeIndex <= 0}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {/* 탭 카드들 - 1줄 표시, 배경색 + 텍스트색으로 점수 표현 */}
        <div
          ref={tabsContainerRef}
          className="flex-1 overflow-x-auto scrollbar-hide"
        >
          <div className="flex gap-1.5 px-1">
            <TooltipProvider delayDuration={300}>
              {sources.map((source, index) => {
                const isActive = source.id === activeSourceId;
                const scorePercent = source.score * 100;

                return (
                  <Tooltip key={source.id}>
                    <TooltipTrigger asChild>
                      <button
                        data-source-id={source.id}
                        onClick={() => onSourceSelect(source.id)}
                        className={cn(
                          "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all duration-200 whitespace-nowrap",
                          isActive
                            ? cn("shadow-sm", getTabActiveBgColor())
                            : getTabInactiveBgColor()
                        )}
                      >
                        {/* 문서 번호 */}
                        <span className={cn(
                          "font-semibold text-sm",
                          isActive ? "text-foreground" : "text-muted-foreground"
                        )}>
                          #{index + 1}
                        </span>

                        {/* 점수 텍스트 - 색상으로 관련도 표현 */}
                        <span className={cn(
                          "text-xs",
                          getScoreTextColor(source.score)
                        )}>
                          {scorePercent.toFixed(0)}%
                        </span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-[200px]">
                      <div className="text-xs">
                        <p className="font-medium truncate">{source.title}</p>
                        <p className="text-muted-foreground mt-0.5">
                          {getScoreLabel(source.score)} ({source.score.toFixed(3)})
                        </p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </TooltipProvider>
          </div>
        </div>

        {/* 다음 버튼 */}
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

      {/* 메타데이터 바 - 관련도 점수 시각화 포함 */}
      {activeSource && (
        <div className="px-4 py-3 border-b flex-shrink-0 bg-muted/20">
          {/* 상단: 제목 + 관련도 점수 */}
          <div className="flex items-start justify-between gap-3 mb-3">
            {/* 제목 (파일명 또는 headings) */}
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="font-medium text-sm truncate">
                {activeSource.title}
              </span>
            </div>

            {/* 관련도 점수 배지 */}
            <Badge
              variant="outline"
              className={cn("flex-shrink-0 font-semibold", getScoreBadgeColor(activeSource.score))}
            >
              {(activeSource.score * 100).toFixed(0)}%
            </Badge>
          </div>

          {/* 관련도 프로그레스 바 */}
          <div className="mb-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span>{getScoreLabel(activeSource.score)}</span>
              <span className="font-mono">{activeSource.score.toFixed(4)}</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
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

            {/* 원본 링크 */}
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

          {/* 키워드 배지 */}
          {activeSource.keywords && activeSource.keywords.length > 0 && (
            <div className="mt-2">
              <span className="text-xs text-muted-foreground font-medium mr-2">키워드:</span>
              <div className="inline-flex flex-wrap gap-1">
                {activeSource.keywords.slice(0, 8).map((kw, kwIndex) => (
                  <Badge
                    key={kwIndex}
                    variant="secondary"
                    className="text-[0.65rem] px-1.5 py-0 bg-teal-100 dark:bg-teal-500/40 text-teal-800 dark:text-teal-100"
                  >
                    {kw}
                  </Badge>
                ))}
                {activeSource.keywords.length > 8 && (
                  <Badge variant="outline" className="text-[0.65rem] px-1.5 py-0">
                    +{activeSource.keywords.length - 8}
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* 섹션 정보 - title과 다를 때만 표시 */}
          {activeSource.metadata?.section && activeSource.metadata.section !== activeSource.title && (
            <div className="mt-2 text-xs text-muted-foreground">
              <span className="font-medium">섹션:</span> {activeSource.metadata.section}
            </div>
          )}
        </div>
      )}

      {/* 문서 내용 */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-4">
          {activeSource ? (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              {/* 마크다운 렌더링 + 하이라이팅 (테이블, 리스트 등 모두 지원) */}
              <MarkdownMessage
                content={applyMarkdownHighlighting(
                  cleanSourceContent(activeSource.content),
                  activeSource.citedPhrases,
                  activeSource.keywords
                )}
                compact
              />
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-8">
              문서를 선택해주세요
            </div>
          )}
        </div>
      </ScrollArea>

      {/* 하단 네비게이션 힌트 */}
      <div className="px-4 py-2 border-t flex-shrink-0 bg-muted/30">
        <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[0.65rem]">ESC</kbd>
            닫기
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[0.65rem]">←</kbd>
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[0.65rem]">→</kbd>
            문서 이동
          </span>
        </div>
      </div>
    </div>
  );
}
