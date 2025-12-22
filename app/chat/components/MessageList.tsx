"use client";

import { useEffect, useRef, useState, memo, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { MessageBubble } from "./MessageBubble";
import { SuggestedPrompts } from "./SuggestedPrompts";
import { ThinkingIndicator } from "./ThinkingIndicator";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Message, Source } from "../types";
import type { UploadStatus } from "../hooks/useDocumentUpload";

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
  isStreaming?: boolean;
  onRegenerate?: (messageIndex: number) => void;
  onQuote?: (message: Message) => void;
  collectionName?: string;
  onPromptSelect?: (prompt: string) => void;
  onOpenArtifact?: (sources: Source[], messageId: string) => void;
  currentStage?: string;
  documentUploadStatus?: UploadStatus | null;
  isDocumentReady?: boolean;
  uploadedFilenames?: string[];
  onClearDocument?: () => void;
}

// 가상 스크롤링 임계값 (이 개수 이상일 때만 가상화 적용)
const VIRTUALIZATION_THRESHOLD = 20;

export const MessageList = memo(function MessageList({
  messages,
  isLoading,
  isStreaming,
  onRegenerate,
  onQuote,
  collectionName,
  onPromptSelect,
  onOpenArtifact,
  currentStage,
  documentUploadStatus,
  isDocumentReady = false,
  uploadedFilenames = [],
  onClearDocument,
}: MessageListProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [userScrolled, setUserScrolled] = useState(false);
  const prevLoadingRef = useRef(isLoading);
  const prevMessageCountRef = useRef(messages.length);

  // 가상화 적용 여부 결정
  const shouldVirtualize = messages.length >= VIRTUALIZATION_THRESHOLD;

  // 가상 스크롤러 설정
  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 200, // 평균 메시지 높이 추정
    overscan: 5, // 화면 밖 5개 항목 미리 렌더링
    enabled: shouldVirtualize,
  });

  // 스크롤 하단으로 이동
  const scrollToBottom = useCallback((smooth = true) => {
    if (parentRef.current) {
      parentRef.current.scrollTo({
        top: parentRef.current.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto',
      });
      setUserScrolled(false);
    }
  }, []);

  // 자동 스크롤 - 스트리밍 중이거나 사용자가 수동으로 스크롤하지 않았을 때
  useEffect(() => {
    const shouldAutoScroll = isLoading || !userScrolled;
    if (shouldAutoScroll) {
      scrollToBottom(false);
    }
  }, [messages, isLoading, userScrolled, scrollToBottom]);

  // 답변 완료 시 (isLoading: true -> false) 자동 스크롤
  useEffect(() => {
    if (prevLoadingRef.current && !isLoading) {
      scrollToBottom(true);
    }
    prevLoadingRef.current = isLoading;
  }, [isLoading, scrollToBottom]);

  // 새 메시지 추가 시 자동 스크롤 상태 리셋
  useEffect(() => {
    if (messages.length > prevMessageCountRef.current) {
      setUserScrolled(false);
    }
    prevMessageCountRef.current = messages.length;
  }, [messages.length]);

  // 스크롤 이벤트 감지
  useEffect(() => {
    const scrollContainer = parentRef.current;
    if (!scrollContainer) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
      const isAtBottom = Math.abs(scrollHeight - clientHeight - scrollTop) < 50;
      setUserScrolled(!isAtBottom);
    };

    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    return () => scrollContainer.removeEventListener('scroll', handleScroll);
  }, []);

  const handleCopy = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      toast.success("메시지가 복사되었습니다");
    } catch (error) {
      toast.error("복사에 실패했습니다");
    }
  };

  const handleRegenerate = (index: number) => {
    onRegenerate?.(index);
  };

  // 메시지 렌더링 함수
  const renderMessage = (message: Message, index: number) => (
    <MessageBubble
      key={message.id}
      messageId={message.id}
      role={message.role}
      content={message.content}
      timestamp={message.timestamp}
      model={message.model}
      sources={message.sources}
      reasoningContent={message.reasoningContent}
      metadata={message.metadata}
      onCopy={() => handleCopy(message.content)}
      onRegenerate={() => handleRegenerate(index)}
      onQuote={() => onQuote?.(message)}
      onOpenArtifact={onOpenArtifact}
      isLast={index === messages.length - 1}
      isStreaming={isLoading && index === messages.length - 1}
    />
  );

  // 로딩 인디케이터 표시 여부
  const showThinkingIndicator = isLoading && (
    !isStreaming ||
    (isStreaming && (messages.length === 0 || messages[messages.length - 1].role !== 'assistant'))
  );

  return (
    <div className="relative h-full">
      {/* 스크롤 컨테이너 */}
      <div
        ref={parentRef}
        className="h-full w-full overflow-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent"
      >
        <div className="py-4 md:py-6 px-4 md:px-8 lg:px-12 pb-20">
          <div className="max-w-4xl mx-auto">
            {/* 가상 스크롤링 적용 */}
            {shouldVirtualize ? (
              <div
                style={{
                  height: `${virtualizer.getTotalSize()}px`,
                  width: '100%',
                  position: 'relative',
                }}
              >
                {virtualizer.getVirtualItems().map((virtualRow) => {
                  const message = messages[virtualRow.index];
                  return (
                    <div
                      key={virtualRow.key}
                      data-index={virtualRow.index}
                      ref={virtualizer.measureElement}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                      className="border-b border-border/20"
                    >
                      {renderMessage(message, virtualRow.index)}
                    </div>
                  );
                })}
              </div>
            ) : (
              /* 일반 렌더링 (메시지 수가 적을 때) */
              <div className="divide-y divide-border/20">
                {messages.map((message, index) => renderMessage(message, index))}
              </div>
            )}

            {/* 초기 화면 추천 질문 */}
            {messages.length === 0 && !isLoading && !documentUploadStatus && onPromptSelect && (
              <SuggestedPrompts
                collectionName={collectionName || ""}
                onSelect={onPromptSelect}
              />
            )}

            {/* 로딩 인디케이터 */}
            {showThinkingIndicator && (
              <ThinkingIndicator collectionName={collectionName} currentStage={currentStage} />
            )}
          </div>
        </div>
      </div>

      {/* Jump to Latest 버튼 */}
      {userScrolled && messages.length > 0 && (
        <button
          onClick={() => scrollToBottom(true)}
          className={cn(
            "absolute bottom-4 left-1/2 -translate-x-1/2 z-40",
            "bg-background/70 backdrop-blur-xl",
            "border border-white/20",
            "rounded-full",
            "w-10 h-10",
            "flex items-center justify-center",
            "shadow-lg ring-1 ring-white/10",
            "hover:bg-background/90 hover:ring-white/20",
            "hover:shadow-xl hover:scale-105",
            "active:scale-95",
            "transition-all duration-200",
            "animate-in fade-in slide-in-from-bottom-2 duration-300"
          )}
          aria-label="최신 메시지로 이동"
        >
          <ChevronDown className="h-5 w-5 text-muted-foreground" />
        </button>
      )}
    </div>
  );
});
