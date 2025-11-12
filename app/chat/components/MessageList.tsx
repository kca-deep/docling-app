"use client";

import { useEffect, useRef, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Bot } from "lucide-react";
import { MessageBubble } from "./MessageBubble";
import { toast } from "sonner";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  sources?: Source[];
  metadata?: {
    tokens?: number;
    processingTime?: number;
  };
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
  };
}

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
  isStreaming?: boolean;
}

export function MessageList({ messages, isLoading, isStreaming }: MessageListProps) {
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

  const handleRegenerate = () => {
    toast.info("응답 재생성 기능은 준비 중입니다");
  };

  return (
    <ScrollArea
      ref={scrollAreaRef}
      className="h-full w-full"
      type="always"
    >
      <div className="p-4 md:p-6 pb-20">
        <div className="space-y-4 max-w-4xl mx-auto">
          {messages.map((message, index) => (
            <MessageBubble
              key={message.id}
              role={message.role}
              content={message.content}
              timestamp={message.timestamp}
              sources={message.sources}
              metadata={message.metadata}
              onCopy={() => handleCopy(message.content)}
              onRegenerate={handleRegenerate}
              isLast={index === messages.length - 1}
              isStreaming={isLoading && index === messages.length - 1}
            />
          ))}

          {/* 로딩 인디케이터 (스트리밍 중 메시지가 없을 때 또는 비스트리밍 모드) */}
          {isLoading && (
            !isStreaming ||
            (isStreaming && (messages.length === 0 || messages[messages.length - 1].role !== 'assistant'))
          ) && (
            <div className="flex gap-3">
              <Avatar className="h-8 w-8 flex-shrink-0">
                <AvatarFallback className="bg-muted">
                  <Bot className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="rounded-lg p-4 bg-card border border-border">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">답변 생성 중</span>
                    <div className="flex gap-1">
                      <div className="h-2 w-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="h-2 w-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="h-2 w-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
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
              className="fixed bottom-24 right-8 bg-primary text-primary-foreground rounded-full px-4 py-2 shadow-lg hover:shadow-xl transition-all"
            >
              ↓ 새 메시지
            </button>
          )}

          {/* 스크롤 앵커 */}
          <div ref={messagesEndRef} />
        </div>
      </div>
    </ScrollArea>
  );
}