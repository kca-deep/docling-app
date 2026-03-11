"use client";

import { useEffect, useRef, useState, memo, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { MessageBubble } from "./MessageBubble";
import { SuggestedPrompts } from "./SuggestedPrompts";
import { ThinkingIndicator } from "./ThinkingIndicator";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Message, Source, CodeExecution } from "../types";
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
  // 피드백 관련 props
  sessionId?: string;
  reasoningLevel?: string;
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
  sessionId,
  reasoningLevel,
}: MessageListProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [userScrolled, setUserScrolled] = useState(false);
  const userScrolledRef = useRef(false); // programmatic scroll과 구분하기 위한 ref
  const isAutoScrollingRef = useRef(false); // 프로그래밍 스크롤 중 표시
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
      isAutoScrollingRef.current = true;
      parentRef.current.scrollTo({
        top: parentRef.current.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto',
      });
      // 프로그래밍 스크롤 완료 후 플래그 리셋
      requestAnimationFrame(() => {
        isAutoScrollingRef.current = false;
      });
    }
  }, []);

  // 자동 스크롤 - 사용자가 수동으로 스크롤하지 않았을 때만
  useEffect(() => {
    if (!userScrolledRef.current) {
      scrollToBottom(false);
    }
  }, [messages, isLoading, scrollToBottom]);

  // 답변 완료 시 (isLoading: true -> false) 자동 스크롤
  useEffect(() => {
    if (prevLoadingRef.current && !isLoading) {
      // 로딩 완료 시에만 userScrolled 리셋하고 하단으로 스크롤
      setUserScrolled(false);
      userScrolledRef.current = false;
      scrollToBottom(true);
      // sources 렌더링 후 재스크롤 (최소 지연)
      const timer = setTimeout(() => {
        scrollToBottom(true);
      }, 100);
      return () => clearTimeout(timer);
    }
    prevLoadingRef.current = isLoading;
  }, [isLoading, scrollToBottom]);

  // 새 메시지(사용자 전송) 추가 시에만 스크롤 리셋
  // 스트리밍 중 메시지 업데이트(코드 실행 등)에서는 리셋하지 않음
  useEffect(() => {
    if (messages.length > prevMessageCountRef.current && !isLoading) {
      // 로딩 중이 아닐 때만 리셋 (사용자가 새 메시지를 보낸 경우)
      setUserScrolled(false);
      userScrolledRef.current = false;
    }
    prevMessageCountRef.current = messages.length;
  }, [messages.length, isLoading]);

  // 스크롤 이벤트 감지 - 사용자의 수동 스크롤만 감지
  useEffect(() => {
    const scrollContainer = parentRef.current;
    if (!scrollContainer) return;

    const handleScroll = () => {
      // 프로그래밍 스크롤은 무시
      if (isAutoScrollingRef.current) return;

      const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
      const isAtBottom = Math.abs(scrollHeight - clientHeight - scrollTop) < 100;

      if (!isAtBottom) {
        // 사용자가 위로 스크롤함
        setUserScrolled(true);
        userScrolledRef.current = true;
      } else {
        // 사용자가 하단에 도달함
        setUserScrolled(false);
        userScrolledRef.current = false;
      }
    };

    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    return () => scrollContainer.removeEventListener('scroll', handleScroll);
  }, []);

  /**
   * 메시지 전체 복사: codeExecutions가 있으면 코드+출력+해석을 모두 포함
   */
  const buildMessageCopyContent = (content: string, codeExecutions?: CodeExecution[]): string => {
    if (!codeExecutions || codeExecutions.length === 0) {
      return content;
    }

    const successfulExecs = codeExecutions.filter((e) => e.status === "success");
    const targetExecs =
      successfulExecs.length > 0
        ? successfulExecs
        : codeExecutions.filter((e) => e.code);

    if (targetExecs.length === 0) {
      return content;
    }

    const parts: string[] = [];

    for (const exec of targetExecs) {
      if (exec.code) {
        parts.push("```python");
        parts.push(exec.code);
        parts.push("```\n");
      }
      if (exec.stdout && exec.stdout.trim()) {
        parts.push("실행 결과:");
        parts.push(exec.stdout);
        parts.push("");
      }
      if (exec.images && exec.images.length > 0) {
        parts.push(`(차트 ${exec.images.length}개 생성됨)\n`);
      }
    }

    // 해석 텍스트 추가 (코드 블록 제거 후)
    const interpretation = content.replace(/```python\s*\n[\s\S]*?```/g, "").trim();
    if (interpretation) {
      parts.push(interpretation);
    }

    return parts.join("\n");
  };

  const handleCopy = async (content: string, codeExecutions?: CodeExecution[]) => {
    try {
      const copyContent = buildMessageCopyContent(content, codeExecutions);
      await navigator.clipboard.writeText(copyContent);
      toast.success("메시지가 복사되었습니다");
    } catch (error) {
      toast.error("복사에 실패했습니다");
    }
  };

  const handleRegenerate = (index: number) => {
    onRegenerate?.(index);
  };

  // 이전 user 메시지 찾기 (피드백용)
  const findPreviousUserQuery = (index: number): string | undefined => {
    for (let i = index - 1; i >= 0; i--) {
      if (messages[i].role === "user") {
        return messages[i].content;
      }
    }
    return undefined;
  };

  // 메시지 렌더링 함수
  const renderMessage = (message: Message, index: number) => {
    const userQuery = message.role === "assistant" ? findPreviousUserQuery(index) : undefined;

    return (
      <MessageBubble
        key={message.id}
        messageId={message.id}
        role={message.role}
        content={message.content}
        timestamp={message.timestamp}
        model={message.model}
        sources={message.sources}
        reasoningContent={message.reasoningContent}
        codeExecutions={message.codeExecutions}
        metadata={message.metadata}
        onCopy={() => handleCopy(message.content, message.codeExecutions)}
        onRegenerate={() => handleRegenerate(index)}
        onQuote={() => onQuote?.(message)}
        onOpenArtifact={onOpenArtifact}
        isLast={index === messages.length - 1}
        isStreaming={isLoading && index === messages.length - 1}
        // 피드백 관련 props
        sessionId={sessionId}
        collectionName={collectionName}
        userQuery={userQuery}
        reasoningLevel={reasoningLevel}
      />
    );
  };

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
            "bg-background/95",
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
