"use client";

import { useState, useRef, KeyboardEvent, useEffect, memo } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Send,
  Mic,
  StopCircle,
  Trash2,
  Command,
  X,
  Quote,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface QuotedMessage {
  role: "user" | "assistant";
  content: string;
}

interface InputAreaProps {
  input: string;
  setInput: (value: string) => void;
  onSend: () => void;
  isLoading: boolean;
  disabled?: boolean;
  onClear?: () => void;
  quotedMessage?: QuotedMessage | null;
  onClearQuote?: () => void;
}

export const InputArea = memo(function InputArea({
  input,
  setInput,
  onSend,
  isLoading,
  disabled,
  onClear,
  quotedMessage,
  onClearQuote,
}: InputAreaProps) {
  const [isComposing, setIsComposing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 로딩이 끝나고 활성화되면 포커스
  useEffect(() => {
    if (!isLoading && !disabled && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isLoading, disabled]);

  const handleKeyPress = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // 한글 입력 중에는 무시
    if (isComposing) return;

    // Enter로 전송, Shift+Enter로 줄바꿈
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!disabled && !isLoading && input.trim()) {
        onSend();
      }
    }
  };

  const canSend = !disabled && !isLoading && input.trim().length > 0;

  return (
    <div className="flex-shrink-0 border-t bg-muted/20 backdrop-blur px-2 py-2 sm:px-4 sm:py-3">
      <div className="max-w-[var(--chat-content-max-width)] mx-auto p-2 sm:p-4 bg-gradient-to-br from-card to-muted/20 rounded-lg">
        {/* 인용 메시지 표시 */}
        {quotedMessage && (
          <div className="mb-2 sm:mb-3 bg-muted/50 border-l-4 border-primary rounded-r-lg p-2 sm:p-3 animate-in slide-in-from-bottom-2 duration-300">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
                  <Quote className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                  <Badge variant="secondary" className="text-xs">
                    {quotedMessage.role === "user" ? "내 질문" : "AI 답변"}에 대한 답변
                  </Badge>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2 pl-4 sm:pl-5">
                  {quotedMessage.content}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 flex-shrink-0"
                onClick={onClearQuote}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}

        {/* 입력 영역 */}
        <div className="flex gap-2 items-end">
          <div className="flex-1 relative">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              onCompositionStart={() => setIsComposing(true)}
              onCompositionEnd={() => setIsComposing(false)}
              placeholder={
                disabled
                  ? "먼저 컬렉션을 선택해주세요..."
                  : "메시지를 입력하세요..."
              }
              disabled={disabled || isLoading}
              className={cn(
                "min-h-[60px] sm:min-h-[80px] max-h-[200px] resize-none pr-2 sm:pr-12",
                "focus:ring-2 focus:ring-primary/20",
                disabled && "opacity-50 cursor-not-allowed"
              )}
            />

            {/* 입력 도움말 */}
            <div className="absolute bottom-2 right-2 hidden sm:flex items-center gap-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <Command className="h-3 w-3" />
                      <span>Enter</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>전송: Enter</p>
                    <p>줄바꿈: Shift + Enter</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>

          {/* 액션 버튼들 */}
          <div className="flex items-end gap-1 sm:gap-2">
            {/* 추가 액션 버튼들 */}
            <div className="hidden sm:flex flex-col gap-1.5">
              {/* 음성 입력 (준비 중) */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "h-9 w-9 rounded-xl transition-all",
                        "hover:bg-primary/10 hover:scale-105",
                        "opacity-40 cursor-not-allowed"
                      )}
                      disabled={true}
                    >
                      <Mic className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left">
                    <p className="text-xs">음성 입력 (준비 중)</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {/* 대화 초기화 */}
              {onClear && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                          "h-9 w-9 rounded-xl transition-all",
                          "hover:bg-destructive/10 hover:scale-105 hover:text-destructive",
                          isLoading && "opacity-40 cursor-not-allowed"
                        )}
                        disabled={isLoading}
                        onClick={onClear}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="left">
                      <p className="text-xs">대화 초기화</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>

            {/* 모바일 대화 초기화 버튼 */}
            {onClear && (
              <div className="sm:hidden">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                          "h-10 w-10 rounded-xl transition-all",
                          "hover:bg-destructive/10 hover:text-destructive",
                          isLoading && "opacity-40 cursor-not-allowed"
                        )}
                        disabled={isLoading}
                        onClick={onClear}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <p className="text-xs">대화 초기화</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            )}

            {/* 전송 버튼 */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={onSend}
                    disabled={!canSend}
                    size="icon"
                    className={cn(
                      "h-10 w-10 sm:h-12 sm:w-12 rounded-xl sm:rounded-2xl transition-all shadow-lg",
                      canSend
                        ? "hover:scale-110 hover:shadow-xl bg-gradient-to-br from-primary to-primary/80"
                        : "opacity-50 cursor-not-allowed",
                      isLoading && "animate-pulse"
                    )}
                  >
                    {isLoading ? (
                      <StopCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                    ) : (
                      <Send className="h-4 w-4 sm:h-5 sm:w-5" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p className="text-xs font-medium">
                    {isLoading ? "전송 중..." : "메시지 전송"}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {/* 문자 수 카운터 */}
        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
          <span className="truncate">
            <span className="hidden sm:inline">{input.length} / 4000 글자</span>
            <span className="sm:hidden">{input.length} / 4000</span>
            {input.length > 3500 && (
              <span className="text-yellow-600 ml-1 sm:ml-2">
                <span className="hidden sm:inline">(글자 수 제한에 근접)</span>
                <span className="sm:hidden">(!)</span>
              </span>
            )}
          </span>
          {isLoading && (
            <span className="flex items-center gap-1 flex-shrink-0">
              <div className="h-2 w-2 bg-primary rounded-full animate-pulse" />
              <span className="hidden sm:inline">응답 생성 중...</span>
              <span className="sm:hidden">생성 중...</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
});