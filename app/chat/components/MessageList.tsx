"use client";

import { useEffect, useRef, useState, memo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageBubble } from "./MessageBubble";
import { SuggestedPrompts } from "./SuggestedPrompts";
import { ThinkingIndicator } from "./ThinkingIndicator";
import { DocumentUploadStatus } from "./DocumentUploadStatus";
import { DocumentActiveCard } from "./DocumentActiveCard";
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
  // 문서 업로드 관련
  documentUploadStatus?: UploadStatus | null;
  isDocumentReady?: boolean;
  uploadedFilenames?: string[];
  onClearDocument?: () => void;
}

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
  // 문서 업로드 관련
  documentUploadStatus,
  isDocumentReady = false,
  uploadedFilenames = [],
  onClearDocument,
}: MessageListProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [userScrolled, setUserScrolled] = useState(false);
  const prevLoadingRef = useRef(isLoading);
  const prevMessageCountRef = useRef(messages.length);

  // 자동 스크롤 - 스트리밍 중이거나 사용자가 수동으로 스크롤하지 않았을 때
  useEffect(() => {
    const shouldAutoScroll = isLoading || !userScrolled;

    if (shouldAutoScroll && scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        // 스크롤을 최하단으로
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages, isLoading, userScrolled]);

  // 답변 완료 시 (isLoading: true -> false) 자동 스크롤
  useEffect(() => {
    if (prevLoadingRef.current && !isLoading) {
      // 답변이 완료되었을 때
      const scrollContainer = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTo({
          top: scrollContainer.scrollHeight,
          behavior: 'smooth'
        });
        setUserScrolled(false); // 자동 스크롤 상태 리셋
      }
    }
    prevLoadingRef.current = isLoading;
  }, [isLoading]);

  // 새 메시지 추가 시 자동 스크롤 상태 리셋
  useEffect(() => {
    if (messages.length > prevMessageCountRef.current) {
      // 새 메시지가 추가되었을 때 (질문 또는 답변 시작)
      setUserScrolled(false);
    }
    prevMessageCountRef.current = messages.length;
  }, [messages.length]);

  // 스크롤 이벤트 감지
  useEffect(() => {
    const scrollContainer = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (!scrollContainer) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
      const isAtBottom = Math.abs(scrollHeight - clientHeight - scrollTop) < 50;
      setUserScrolled(!isAtBottom);
    };

    scrollContainer.addEventListener('scroll', handleScroll);
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

  return (
    <ScrollArea
      ref={scrollAreaRef}
      className="h-full w-full"
      type="always"
    >
      <div className="py-4 md:py-6 px-4 md:px-8 lg:px-12 pb-20">
        {/* Claude 스타일: 메시지 사이 구분선 */}
        <div className="divide-y divide-border/20 max-w-4xl mx-auto">
          {messages.map((message, index) => (
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
          ))}

          {/* 초기 화면 추천 질문 (일상대화 모드에서도 표시) */}
          {messages.length === 0 && !isLoading && !documentUploadStatus && onPromptSelect && (
            <SuggestedPrompts
              collectionName={collectionName || ""}
              onSelect={onPromptSelect}
            />
          )}

          {/* 문서 업로드 상태 (우측 정렬, 사용자 메시지 스타일) */}
          {documentUploadStatus && !isDocumentReady && onClearDocument && (
            <DocumentUploadStatus
              status={documentUploadStatus}
              onClear={onClearDocument}
            />
          )}

          {/* 문서 준비 완료 카드 (우측 정렬, 사용자 메시지 스타일) */}
          {isDocumentReady && uploadedFilenames.length > 0 && onClearDocument && (
            <DocumentActiveCard
              filenames={uploadedFilenames}
              pageCount={documentUploadStatus?.pageCount}
              onRemove={onClearDocument}
            />
          )}

          {/* 로딩 인디케이터 (스트리밍 중 메시지가 없을 때 또는 비스트리밍 모드) */}
          {isLoading && (
            !isStreaming ||
            (isStreaming && (messages.length === 0 || messages[messages.length - 1].role !== 'assistant'))
          ) && (
            <ThinkingIndicator collectionName={collectionName} currentStage={currentStage} />
          )}

          {/* 새 메시지 알림 (사용자가 스크롤했을 때만) */}
          {userScrolled && messages.length > 0 && (
            <button
              onClick={() => {
                const scrollContainer = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
                if (scrollContainer) {
                  scrollContainer.scrollTo({
                    top: scrollContainer.scrollHeight,
                    behavior: 'smooth'
                  });
                  setUserScrolled(false);
                }
              }}
              className="fixed bottom-[160px] left-1/2 -translate-x-1/2 z-50 bg-primary text-primary-foreground rounded-full w-10 h-10 flex items-center justify-center shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95 text-base"
            >
              ↓
            </button>
          )}

          {/* 스크롤 앵커 */}
          <div ref={messagesEndRef} />
        </div>
      </div>
    </ScrollArea>
  );
});