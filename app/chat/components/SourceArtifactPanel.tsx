"use client";

import { useEffect, useCallback, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

/**
 * 코드 블록으로 감싸진 콘텐츠에서 코드 블록 구분자를 제거
 * Docling 청킹 결과가 ``` 코드 블록으로 감싸져 있을 때 마크다운 렌더링을 위해 제거
 */
function stripCodeBlockWrapper(content: string): string {
  const lines = content.split('\n');
  const result: string[] = [];
  let inCodeBlock = false;
  let codeBlockLang = '';

  for (const line of lines) {
    const trimmed = line.trim();

    // 코드 블록 시작/종료 감지
    if (trimmed.startsWith('```')) {
      if (!inCodeBlock) {
        // 코드 블록 시작
        inCodeBlock = true;
        codeBlockLang = trimmed.slice(3).trim();
        // 언어 지정이 없거나 markdown인 경우 코드 블록 구분자 제거
        if (!codeBlockLang || codeBlockLang === 'markdown' || codeBlockLang === 'md') {
          continue; // 구분자 제거
        }
      } else {
        // 코드 블록 종료
        inCodeBlock = false;
        if (!codeBlockLang || codeBlockLang === 'markdown' || codeBlockLang === 'md') {
          continue; // 구분자 제거
        }
      }
    }

    result.push(line);
  }

  return result.join('\n').trim();
}

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

  // 점수에 따른 색상
  const getScoreColor = (score: number) => {
    if (score >= 0.8) return "bg-green-500/10 text-green-600 dark:text-green-400";
    if (score >= 0.6) return "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400";
    return "bg-red-500/10 text-red-600 dark:text-red-400";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 0.8) return "높은 관련도";
    if (score >= 0.6) return "중간 관련도";
    return "낮은 관련도";
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

      {/* 탭 네비게이션 - 번호만 표시 (파일명 중복 제거) */}
      <div className="flex items-center gap-1 px-2 py-2 border-b flex-shrink-0 bg-muted/30">
        {/* 이전 버튼 */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 flex-shrink-0"
          onClick={goToPrevious}
          disabled={activeIndex <= 0}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {/* 탭들 - 번호와 점수만 표시 */}
        <div
          ref={tabsContainerRef}
          className="flex-1 overflow-x-auto scrollbar-hide"
        >
          <Tabs
            value={activeSourceId || ""}
            onValueChange={onSourceSelect}
            className="w-auto"
          >
            <TabsList className="h-auto p-1 bg-muted/50">
              {sources.map((source, index) => (
                <TabsTrigger
                  key={source.id}
                  value={source.id}
                  data-source-id={source.id}
                  className="flex-none h-7 px-2.5 text-xs gap-1 overflow-hidden"
                >
                  <span className="font-medium">#{index + 1}</span>
                  <span className="text-muted-foreground text-[10px]">
                    {(source.score * 100).toFixed(0)}%
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        {/* 다음 버튼 */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 flex-shrink-0"
          onClick={goToNext}
          disabled={activeIndex >= sources.length - 1}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* 메타데이터 바 - 중복 제거 */}
      {activeSource && (
        <div className="px-4 py-3 border-b flex-shrink-0 bg-muted/20">
          {/* 제목 (파일명 또는 headings) */}
          <div className="flex items-center gap-2 mb-2">
            <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span className="font-medium text-sm truncate">
              {activeSource.title}
            </span>
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
              <MarkdownMessage content={stripCodeBlockWrapper(activeSource.content)} compact />
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
