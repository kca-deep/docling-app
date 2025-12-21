"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  FileText,
  Link,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Copy,
  Check,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { cleanSourceContent } from "@/lib/content-sanitizer";
import { MarkdownMessage } from "@/components/markdown-message";
import type { Source } from "../types";

interface SourcePanelProps {
  sources: Source[];
}

/**
 * 인용/키워드 하이라이트 컴포넌트
 * citedPhrases 우선, 없으면 keywords 폴백 (상위 3개만)
 */
function HighlightedText({
  text,
  citedPhrases,
  keywords
}: {
  text: string;
  citedPhrases?: string[];
  keywords?: string[];
}) {
  const highlighted = useMemo(() => {
    // citedPhrases 우선 사용
    const phrasesToHighlight = citedPhrases && citedPhrases.length > 0
      ? citedPhrases
      : keywords?.slice(0, 3);  // keywords 폴백 (상위 3개만)

    if (!phrasesToHighlight || phrasesToHighlight.length === 0) {
      return text;
    }

    // 인용 구절은 긴 것부터 매칭 (긴 문구가 짧은 문구를 포함할 수 있으므로)
    const sortedPhrases = [...phrasesToHighlight].sort((a, b) => b.length - a.length);

    // 패턴 생성
    const escapedPhrases = sortedPhrases.map(phrase =>
      phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    );

    // 인용 구절은 정확히 매칭, 키워드는 조사 변형 포함
    const isKeywordMode = !citedPhrases || citedPhrases.length === 0;
    const pattern = isKeywordMode
      ? new RegExp(`(${escapedPhrases.map(kw => `${kw}[은는이가을를에서로의와과도만]?`).join('|')})`, 'gi')
      : new RegExp(`(${escapedPhrases.join('|')})`, 'gi');

    const parts = text.split(pattern);

    return parts.map((part, index) => {
      // 매칭되는지 확인
      const isMatch = sortedPhrases.some(phrase => {
        if (isKeywordMode) {
          const kwPattern = new RegExp(`^${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[은는이가을를에서로의와과도만]?$`, 'i');
          return kwPattern.test(part);
        }
        return part.toLowerCase() === phrase.toLowerCase();
      });

      if (isMatch) {
        return (
          <mark
            key={index}
            className="bg-sky-200 dark:bg-sky-400/40 text-sky-900 dark:text-sky-100 px-0.5 rounded-sm font-medium"
          >
            {part}
          </mark>
        );
      }
      return part;
    });
  }, [text, citedPhrases, keywords]);

  return <>{highlighted}</>;
}

export function SourcePanel({ sources }: SourcePanelProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleCopy = async (content: string, id: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(id);
      toast.success("내용이 복사되었습니다");
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      toast.error("복사에 실패했습니다");
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 0.8) return "text-foreground bg-muted";
    if (score >= 0.6) return "text-muted-foreground bg-muted/70";
    return "text-muted-foreground/80 bg-muted/50";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 0.8) return "높은 관련도";
    if (score >= 0.6) return "중간 관련도";
    return "낮은 관련도";
  };

  if (sources.length === 0) {
    return (
      <div className="p-4">
        <Card className="bg-muted/50">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground text-center">
              참조 문서가 없습니다
            </p>
            <p className="text-xs text-muted-foreground text-center mt-1">
              질문을 하면 관련 문서가 여기에 표시됩니다
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* 헤더 */}
      <div className="p-4 border-b flex-shrink-0">
        <div className="flex items-center gap-2 mb-2">
          <FileText className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">참조 문서</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          {sources.length}개의 관련 문서를 찾았습니다
        </p>
      </div>

      {/* 소스 목록 */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {sources.map((source, index) => {
            const isExpanded = expandedIds.has(source.id);

            return (
              <Card
                key={source.id}
                className={cn(
                  "transition-all",
                  "hover:shadow-md",
                  isExpanded && "ring-2 ring-primary/20"
                )}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      {/* 제목 - 번호 + title만 표시 */}
                      <CardTitle className="text-sm font-medium line-clamp-2">
                        <span className="text-muted-foreground mr-2">
                          #{index + 1}
                        </span>
                        {source.title}
                      </CardTitle>
                      {/* 메타 정보 - 중복 제거 */}
                      {source.metadata && (
                        <CardDescription className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                          {source.metadata.chunk_index !== undefined && (
                            <Badge variant="secondary" className="text-[0.65rem] px-1.5 py-0">
                              청크 #{source.metadata.chunk_index}
                            </Badge>
                          )}
                          {source.metadata.page && (
                            <Badge variant="outline" className="text-[0.65rem] px-1.5 py-0">
                              페이지 {source.metadata.page}
                            </Badge>
                          )}
                          {source.metadata.url && (
                            <a
                              href={source.metadata.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 hover:underline text-primary"
                            >
                              <Link className="h-3 w-3" />
                              원본
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </CardDescription>
                      )}
                    </div>

                    {/* 점수 배지 */}
                    <Badge
                      variant="outline"
                      className={cn(
                        "flex-shrink-0",
                        getScoreColor(source.score)
                      )}
                    >
                      <span className="font-semibold">
                        {(source.score * 100).toFixed(0)}%
                      </span>
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent>
                  <Collapsible
                    open={isExpanded}
                    onOpenChange={() => toggleExpanded(source.id)}
                  >
                    <div className="space-y-2">
                      {/* 키워드 배지 표시 */}
                      {source.keywords && source.keywords.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {source.keywords.slice(0, 5).map((kw, kwIndex) => (
                            <Badge
                              key={kwIndex}
                              variant="secondary"
                              className="text-[0.65rem] px-1.5 py-0 bg-sky-100 dark:bg-sky-500/30 text-sky-800 dark:text-sky-100"
                            >
                              {kw}
                            </Badge>
                          ))}
                          {source.keywords.length > 5 && (
                            <Badge variant="outline" className="text-[0.65rem] px-1.5 py-0">
                              +{source.keywords.length - 5}
                            </Badge>
                          )}
                        </div>
                      )}

                      {/* 미리보기/전체 내용 */}
                      <div className="text-sm text-foreground bg-muted/30 p-3 rounded-md">
                        {isExpanded ? (
                          <MarkdownMessage content={cleanSourceContent(source.content)} compact />
                        ) : (
                          <p className="line-clamp-3 whitespace-pre-wrap">
                            <HighlightedText
                              text={cleanSourceContent(source.content)}
                              citedPhrases={source.citedPhrases}
                              keywords={source.keywords}
                            />
                          </p>
                        )}
                      </div>

                      {/* 펼치기/접기 및 액션 버튼 */}
                      <div className="flex items-center justify-between pt-2">
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8">
                            {isExpanded ? (
                              <>
                                <ChevronUp className="h-4 w-4 mr-1" />
                                접기
                              </>
                            ) : (
                              <>
                                <ChevronDown className="h-4 w-4 mr-1" />
                                더 보기
                              </>
                            )}
                          </Button>
                        </CollapsibleTrigger>

                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8"
                          onClick={() => handleCopy(source.content, source.id)}
                        >
                          {copiedId === source.id ? (
                            <>
                              <Check className="h-4 w-4 mr-1" />
                              복사됨
                            </>
                          ) : (
                            <>
                              <Copy className="h-4 w-4 mr-1" />
                              복사
                            </>
                          )}
                        </Button>
                      </div>
                    </div>

                    <CollapsibleContent>
                      {/* 추가 정보 (펼쳤을 때만 표시) */}
                      <div className="mt-3 pt-3 border-t border-border space-y-2">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>관련도 점수</span>
                          <span className="font-mono font-medium text-foreground">
                            {source.score.toFixed(4)}
                          </span>
                        </div>
                        <div className="text-xs text-foreground">
                          <Badge variant="secondary" className="mr-1">
                            {getScoreLabel(source.score)}
                          </Badge>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </ScrollArea>

      {/* 푸터 정보 */}
      <div className="p-4 border-t flex-shrink-0 bg-muted/50">
        <div className="text-xs text-muted-foreground text-center">
          <p>상위 {sources.length}개 문서가 검색되었습니다</p>
          <p className="mt-1">점수가 높을수록 질문과의 관련도가 높습니다</p>
        </div>
      </div>
    </div>
  );
}