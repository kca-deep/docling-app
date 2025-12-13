"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ChatbotLogo } from "@/components/ui/chatbot-logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Wand2, User, FileText, Copy, Check, RefreshCw, Reply, StopCircle, ChevronRight } from "lucide-react";
import { MarkdownMessage } from "@/components/markdown-message";
import { cn } from "@/lib/utils";
import { useState, memo, useEffect } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ChevronDown, ChevronUp, ExternalLink, Link, Brain } from "lucide-react";
import { SourceArtifactModal } from "./SourceArtifactModal";

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
  messageId: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  model?: string; // 메시지를 생성한 모델 정보
  sources?: Source[];
  reasoningContent?: string; // GPT-OSS 추론 과정
  metadata?: {
    tokens?: number;
    processingTime?: number;
    aborted?: boolean;
  };
  onCopy?: () => void;
  onRegenerate?: () => void;
  onQuote?: () => void;
  onOpenArtifact?: (sources: Source[], messageId: string) => void;
  isLast?: boolean;
  isStreaming?: boolean;
}

export const MessageBubble = memo(function MessageBubble({
  messageId,
  role,
  content,
  timestamp,
  model,
  sources,
  reasoningContent,
  metadata,
  onCopy,
  onRegenerate,
  onQuote,
  onOpenArtifact,
  isLast,
  isStreaming,
}: MessageBubbleProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [thoughtExpanded, setThoughtExpanded] = useState(false);
  const [reasoningExpanded, setReasoningExpanded] = useState(false); // GPT-OSS 추론 과정
  const [openTooltipId, setOpenTooltipId] = useState<string | null>(null);
  const [mobileModalOpen, setMobileModalOpen] = useState(false);

  // Debug: reasoningContent 확인
  if (role === "assistant" && reasoningContent) {
    console.log('[DEBUG MessageBubble] reasoningContent received:', reasoningContent.substring(0, 100));
  }

  // 스트리밍 중 추론 패널 자동 제어
  // - 추론 중 (content 없음): 패널 펼치기
  // - 답변 시작 (content 있음): 패널 접기
  useEffect(() => {
    if (isStreaming && reasoningContent) {
      if (!content) {
        // 추론 중: 펼치기
        setReasoningExpanded(true);
      } else {
        // 답변 시작: 접기
        setReasoningExpanded(false);
      }
    }
  }, [isStreaming, reasoningContent, content]);

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

  const getScoreColor = () => {
    return "text-foreground bg-muted";
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
        "group relative flex gap-4 w-full py-4",
        role === "user" && "flex-row-reverse"
      )}
    >
      {/* 아바타 */}
      {role === "assistant" ? (
        <ChatbotLogo className="h-7 w-7 flex-shrink-0 mt-1" />
      ) : (
        <Avatar className="h-7 w-7 flex-shrink-0 mt-1">
          <AvatarFallback
            className={cn(
              role === "user" && "text-white",
              role === "system" && "bg-muted text-muted-foreground"
            )}
            style={
              role === "user"
                ? { background: "linear-gradient(135deg, var(--chart-1), var(--chart-2))" }
                : undefined
            }
          >
            {role === "system" ? (
              <RefreshCw className="h-3.5 w-3.5" />
            ) : (
              <User className="h-3.5 w-3.5" />
            )}
          </AvatarFallback>
        </Avatar>
      )}

      {/* 메시지 콘텐츠 */}
      <div
        className={cn(
          "flex flex-col gap-1.5 min-w-0",
          role === "user" ? "items-end max-w-[80%]" : "flex-1"
        )}
      >
        {/* 메시지 영역 */}
        <div
          className={cn(
            "transition-all duration-200 animate-in fade-in-0 slide-in-from-bottom-1",
            role === "user" && "text-foreground text-left bg-muted/50 rounded-2xl px-4 py-3",
            role === "system" && "text-muted-foreground italic w-full",
            role === "assistant" && "text-foreground w-full"
          )}
        >
          <div className={cn("min-w-0 link-primary prose-sm", role === "assistant" && "text-foreground/90")}>
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
            ) : role === "assistant" && reasoningContent ? (
              // GPT-OSS 모델: 추론 과정과 답변 분리 표시
              <div className="space-y-3">
                {/* GPT-OSS 추론 과정 (접을 수 있음) */}
                <Collapsible open={reasoningExpanded} onOpenChange={setReasoningExpanded} className="w-full">
                  <div className="rounded-lg border bg-muted/30 overflow-hidden">
                    <CollapsibleTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-between p-3 hover:bg-muted/50 rounded-none"
                      >
                        <div className="flex items-center gap-2">
                          <Brain className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-xs font-medium text-muted-foreground">
                            추론 과정
                          </span>
                          <span className="text-[0.65rem] text-muted-foreground/70">
                            ({reasoningContent.length}자)
                          </span>
                        </div>
                        {reasoningExpanded ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="px-3 pb-3 text-xs text-muted-foreground whitespace-pre-wrap border-t pt-3 max-h-[300px] overflow-y-auto">
                        {reasoningContent}
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>

                {/* 답변 (content가 있을 때만 표시) */}
                {content && <MarkdownMessage content={content} />}
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
            <>
              {/* 모바일: 간단한 버튼으로 모달 열기 */}
              <div className="mt-4 pt-3 border-t border-border/30 sm:hidden">
                <button
                  onClick={() => setMobileModalOpen(true)}
                  className="w-full flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" style={{ color: "var(--chart-2)" }} />
                    <span className="text-sm font-medium">
                      참조문서 {sources.length}개
                    </span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>

                {/* 모바일 모달 */}
                <SourceArtifactModal
                  open={mobileModalOpen}
                  onOpenChange={setMobileModalOpen}
                  sources={sources}
                />
              </div>

              {/* 데스크탑: 기존 UI 유지 */}
              <div className="mt-4 pt-3 border-t border-border/30 space-y-2 hidden sm:block">
                {/* 참조 문서 요약 */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5" style={{ color: "var(--chart-2)" }} />
                    <span className="text-xs font-medium text-muted-foreground">
                      {sources.length}개 참조문서
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs cursor-pointer"
                    onClick={() => onOpenArtifact?.(sources, messageId)}
                    style={{ color: "var(--chart-1)" }}
                  >
                    전체보기
                  </Button>
                </div>

                {/* 참조 문서 요약 리스트 */}
                <div className="flex flex-wrap gap-1.5">
                  <TooltipProvider>
                    {sources.map((source, index) => (
                      <Tooltip
                        key={source.id}
                        open={openTooltipId === source.id}
                        onOpenChange={(open) => {
                          if (!open) setOpenTooltipId(null);
                        }}
                      >
                        <TooltipTrigger asChild>
                          <Badge
                            variant="secondary"
                            className={cn(
                              "cursor-pointer hover:bg-secondary/80 transition-all text-xs px-2 py-1",
                              openTooltipId === source.id && "bg-secondary/80 ring-1 ring-primary/50"
                            )}
                            onClick={(e) => {
                              e.preventDefault();
                              setOpenTooltipId(openTooltipId === source.id ? null : source.id);
                            }}
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
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-80 p-3">
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
                              <Badge variant="outline" className={cn("text-xs", getScoreColor())}>
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
                        </TooltipContent>
                      </Tooltip>
                    ))}
                  </TooltipProvider>
                </div>
              </div>
            </>
          )}

          {/* 메타데이터 표시 */}
          {metadata && (
            <div className="mt-2 flex items-center gap-2">
              {metadata.aborted && (
                <Badge variant="secondary" className="text-xs flex items-center gap-1">
                  <StopCircle className="h-3 w-3" />
                  응답 중단됨
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