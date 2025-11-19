"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bot, User, FileText, Copy, Check, RefreshCw, Reply } from "lucide-react";
import { MarkdownMessage } from "@/components/markdown-message";
import { cn } from "@/lib/utils";
import { useState, memo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { ChevronDown, ChevronUp, ExternalLink, Link } from "lucide-react";

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

interface MessageBubbleProps {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  model?: string; // 메시지를 생성한 모델 정보
  sources?: Source[];
  metadata?: {
    tokens?: number;
    processingTime?: number;
  };
  onCopy?: () => void;
  onRegenerate?: () => void;
  onQuote?: () => void;
  isLast?: boolean;
  isStreaming?: boolean;
}

export const MessageBubble = memo(function MessageBubble({
  role,
  content,
  timestamp,
  model,
  sources,
  metadata,
  onCopy,
  onRegenerate,
  onQuote,
  isLast,
  isStreaming,
}: MessageBubbleProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [activeSourceId, setActiveSourceId] = useState<string | null>(null);
  const [thoughtExpanded, setThoughtExpanded] = useState(false);

  // 메시지 내용 파싱: <thought> 태그와 답변 부분 분리
  const parseMessageContent = (content: string, streaming: boolean = false) => {
    // 스트리밍 중: <thought>로 시작하는지 확인
    if (streaming) {
      const thoughtStart = content.indexOf('<thought>');
      if (thoughtStart === -1) {
        // <thought> 태그 없음 - 전체를 답변으로 처리
        return {
          hasThought: false,
          thought: '',
          answer: content,
          thoughtClosed: true,
        };
      }

      const thoughtEnd = content.indexOf('</thought>');

      if (thoughtEnd === -1) {
        // <thought>는 있지만 </thought>가 아직 없음 - 스트리밍 중
        const thoughtContent = content.substring(thoughtStart + 9); // '<thought>'.length = 9
        return {
          hasThought: true,
          thought: thoughtContent,
          answer: '',
          thoughtClosed: false, // 아직 닫히지 않음
        };
      } else {
        // <thought>와 </thought> 모두 있음 - 완성됨
        const thoughtContent = content.substring(thoughtStart + 9, thoughtEnd).trim();
        const answerContent = content.substring(thoughtEnd + 10).trim(); // '</thought>'.length = 10
        return {
          hasThought: true,
          thought: thoughtContent,
          answer: answerContent,
          thoughtClosed: true,
        };
      }
    }

    // 비스트리밍: 기존 로직 (완성된 메시지)
    const thoughtRegex = /<thought>([\s\S]*?)<\/thought>/;
    const thoughtMatch = content.match(thoughtRegex);

    if (thoughtMatch) {
      const thoughtContent = thoughtMatch[1].trim();
      const answerContent = content.replace(thoughtRegex, '').trim();

      return {
        hasThought: true,
        thought: thoughtContent,
        answer: answerContent,
        thoughtClosed: true,
      };
    }

    return {
      hasThought: false,
      thought: '',
      answer: content,
      thoughtClosed: true,
    };
  };

  // EXAONE 모델인지 확인 및 메시지 파싱
  const isExaone = model?.toLowerCase().includes('exaone');
  const parsedContent = isExaone && role === 'assistant' ? parseMessageContent(content, isStreaming) : null;

  // 추론 진행 중 상태 (thinking 애니메이션용)
  const isThinking = isStreaming && parsedContent?.hasThought && !parsedContent?.thoughtClosed;

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

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

  const getScoreColor = (score: number) => {
    if (score >= 0.8) return "text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-950";
    if (score >= 0.6) return "text-yellow-600 bg-yellow-50 dark:text-yellow-400 dark:bg-yellow-950";
    return "text-orange-600 bg-orange-50 dark:text-orange-400 dark:bg-orange-950";
  };

  const truncateFilename = (filename: string, maxLength: number = 30) => {
    if (filename.length <= maxLength) return filename;
    const ext = filename.substring(filename.lastIndexOf('.'));
    const name = filename.substring(0, filename.lastIndexOf('.'));
    const truncated = name.substring(0, maxLength - ext.length - 3);
    return `${truncated}...${ext}`;
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
              ? "bg-gradient-to-br from-blue-600 to-blue-700 text-white"
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
            "rounded-2xl px-4 py-3 w-full transition-colors",
            role === "user"
              ? "bg-gradient-to-br from-blue-600 to-blue-700 text-white"
              : role === "system"
              ? "bg-muted/50"
              : "bg-muted"
          )}
        >
          <div className="w-full min-w-0">
            {parsedContent && parsedContent.hasThought ? (
              // EXAONE 모델: 추론 과정과 답변 분리 표시
              <div className="space-y-3">
                {/* 추론 과정 (접을 수 있음) */}
                {parsedContent.thought && (
                  <Collapsible open={thoughtExpanded} onOpenChange={setThoughtExpanded} className="w-full">
                    <div className="rounded-lg border bg-muted/30 overflow-hidden">
                      <CollapsibleTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-between p-3 hover:bg-muted/50 rounded-none"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-muted-foreground">
                              💭 추론 과정
                            </span>
                            {isThinking && !thoughtExpanded && (
                              <span className="flex items-center gap-1 text-[0.65rem] text-primary animate-pulse">
                                <span className="inline-block w-1 h-1 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                <span className="inline-block w-1 h-1 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                <span className="inline-block w-1 h-1 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                <span className="ml-1">thinking...</span>
                              </span>
                            )}
                          </div>
                          {thoughtExpanded ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="px-3 pb-3 text-xs text-muted-foreground whitespace-pre-wrap border-t pt-3">
                          {parsedContent.thought}
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                )}

                {/* 답변 */}
                {parsedContent.answer && (
                  <MarkdownMessage content={parsedContent.answer} />
                )}
              </div>
            ) : role === "assistant" || role === "system" ? (
              // 기본 마크다운 렌더링
              <MarkdownMessage content={content} />
            ) : (
              // 사용자 메시지
              <p className="text-sm whitespace-pre-wrap break-words">
                {content}
              </p>
            )}
          </div>

          {/* 참조 문서 표시 (스트리밍 중에는 숨김) */}
          {!isStreaming && sources && sources.length > 0 && (
            <div className="mt-3 pt-3 border-t space-y-2">
              {/* 참조 문서 요약 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">
                    {sources.length}개 참조문서
                  </span>
                </div>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-6 text-xs">
                      전체보기
                    </Button>
                  </DialogTrigger>
                <DialogContent className="max-w-6xl w-[95vw] max-h-[80vh] p-0">
                  <DialogHeader className="p-6 pb-3">
                    <DialogTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-primary" />
                      참조 문서
                    </DialogTitle>
                    <DialogDescription>
                      {sources.length}개의 관련 문서를 찾았습니다
                    </DialogDescription>
                  </DialogHeader>
                  <ScrollArea className="max-h-[calc(80vh-120px)] px-6 pb-6">
                    <div className="space-y-3">
                      {sources.map((source, index) => {
                        const isExpanded = expandedIds.has(source.id);

                        return (
                          <Card
                            key={source.id}
                            className={cn(
                              "transition-all cursor-pointer",
                              "hover:shadow-lg hover:border-primary/50",
                              isExpanded && "ring-2 ring-primary/20",
                              activeSourceId === source.id && "ring-2 ring-primary shadow-lg bg-primary/5"
                            )}
                            onClick={() => setActiveSourceId(activeSourceId === source.id ? null : source.id)}
                          >
                            <CardHeader className="pb-3">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <CardTitle className="text-sm font-medium line-clamp-2 group-hover:text-primary transition-colors">
                                    <span className="text-muted-foreground mr-2">
                                      #{index + 1}
                                    </span>
                                    {source.title}
                                  </CardTitle>
                                  {source.metadata && (
                                    <CardDescription className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                                      {source.metadata.file && (
                                        <span className="flex items-center gap-1">
                                          <FileText className="h-3 w-3" />
                                          {source.metadata.file}
                                        </span>
                                      )}
                                      {source.metadata.section && (
                                        <span className="text-muted-foreground">
                                          {source.metadata.section}
                                        </span>
                                      )}
                                      {source.metadata.chunk_index !== undefined && (
                                        <Badge variant="secondary" className="text-[0.65rem] px-1.5 py-0">
                                          청크 #{source.metadata.chunk_index}
                                        </Badge>
                                      )}
                                      {source.metadata.page && (
                                        <span>페이지 {source.metadata.page}</span>
                                      )}
                                      {source.metadata.url && (
                                        <a
                                          href={source.metadata.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="flex items-center gap-1 text-primary hover:underline hover:text-primary/80 transition-colors"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <Link className="h-3 w-3" />
                                          <span>원본 링크</span>
                                          <ExternalLink className="h-3 w-3" />
                                        </a>
                                      )}
                                    </CardDescription>
                                  )}
                                </div>
                                <Badge
                                  variant="outline"
                                  className={cn("flex-shrink-0", getScoreColor(source.score))}
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
                                  <div className={cn(
                                    "text-sm text-muted-foreground",
                                    !isExpanded && "line-clamp-3"
                                  )}>
                                    {source.content}
                                  </div>
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
                                  </div>
                                </div>
                                <CollapsibleContent>
                                  {/* 관련도 점수는 상단 Badge에 이미 표시되어 있으므로 제거 */}
                                </CollapsibleContent>
                              </Collapsible>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </DialogContent>
              </Dialog>
              </div>

              {/* 참조 문서 요약 리스트 */}
              <div className="flex flex-wrap gap-1.5">
                {sources.map((source, index) => (
                  <HoverCard key={source.id} openDelay={200}>
                    <HoverCardTrigger asChild>
                      <Badge
                        variant="secondary"
                        className={cn(
                          "cursor-pointer hover:bg-secondary/80 transition-all text-xs px-2 py-1",
                          activeSourceId === source.id && "ring-2 ring-primary bg-primary/20 scale-105"
                        )}
                        onClick={() => setActiveSourceId(activeSourceId === source.id ? null : source.id)}
                      >
                        <span className="text-muted-foreground mr-1">#{index + 1}</span>
                        <FileText className="h-3 w-3 mr-1" />
                        <span className="max-w-[120px] truncate">
                          {source.metadata?.file ? truncateFilename(source.metadata.file, 20) : source.title}
                        </span>
                        {source.metadata?.chunk_index !== undefined && (
                          <span className="ml-1 text-muted-foreground">
                            (청크 {source.metadata.chunk_index})
                          </span>
                        )}
                      </Badge>
                    </HoverCardTrigger>
                    <HoverCardContent className="w-80" side="top">
                      <div className="space-y-2">
                        <div>
                          <h4 className="text-sm font-semibold mb-1 line-clamp-2">
                            {source.title}
                          </h4>
                          {source.metadata?.section && (
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {source.metadata.section}
                            </p>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          <Badge variant="outline" className={cn("text-xs", getScoreColor(source.score))}>
                            관련도 {(source.score * 100).toFixed(0)}%
                          </Badge>
                          {source.metadata?.chunk_index !== undefined && (
                            <Badge variant="secondary" className="text-xs">
                              청크 #{source.metadata.chunk_index}
                            </Badge>
                          )}
                          {source.metadata?.num_tokens && (
                            <Badge variant="secondary" className="text-xs">
                              {source.metadata.num_tokens} 토큰
                            </Badge>
                          )}
                          {source.metadata?.page && (
                            <Badge variant="secondary" className="text-xs">
                              페이지 {source.metadata.page}
                            </Badge>
                          )}
                        </div>

                        <div className="text-xs text-muted-foreground line-clamp-3 pt-1 border-t">
                          {source.content}
                        </div>
                      </div>
                    </HoverCardContent>
                  </HoverCard>
                ))}
              </div>
            </div>
          )}

          {/* 메타데이터 표시 */}
          {metadata && (
            <div className="mt-2 flex items-center gap-2">
              {metadata.aborted && (
                <Badge variant="destructive" className="text-xs">
                  ⚠️ 응답 중단됨
                </Badge>
              )}
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
          {(role === "assistant" || role === "user") && (
            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
              {role === "assistant" && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={onCopy}
                    title="복사"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                  {isLast && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={onRegenerate}
                      title="재생성"
                    >
                      <RefreshCw className="h-3 w-3" />
                    </Button>
                  )}
                </>
              )}
              {onQuote && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={onQuote}
                  title="이 메시지에 답변하기"
                >
                  <Reply className="h-3 w-3" />
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});