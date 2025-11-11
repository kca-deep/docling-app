"use client";

import { useState, useRef, KeyboardEvent } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Send,
  Paperclip,
  Mic,
  StopCircle,
  Trash2,
  Command,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface InputAreaProps {
  input: string;
  setInput: (value: string) => void;
  onSend: () => void;
  isLoading: boolean;
  disabled?: boolean;
  onClear?: () => void;
  onFileUpload?: (file: File) => void;
}

export function InputArea({
  input,
  setInput,
  onSend,
  isLoading,
  disabled,
  onClear,
  onFileUpload,
}: InputAreaProps) {
  const [isComposing, setIsComposing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onFileUpload) {
      onFileUpload(file);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (const item of items) {
      if (item.type.indexOf("image") === 0) {
        const file = item.getAsFile();
        if (file && onFileUpload) {
          e.preventDefault();
          onFileUpload(file);
        }
      }
    }
  };

  const canSend = !disabled && !isLoading && input.trim().length > 0;

  return (
    <div className="flex-shrink-0 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="p-4">
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
              onPaste={handlePaste}
              placeholder={
                disabled
                  ? "먼저 컬렉션을 선택해주세요..."
                  : "메시지를 입력하세요... (Enter: 전송, Shift+Enter: 줄바꿈)"
              }
              disabled={disabled || isLoading}
              className={cn(
                "min-h-[80px] max-h-[200px] resize-none pr-12",
                "focus:ring-2 focus:ring-primary/20",
                disabled && "opacity-50 cursor-not-allowed"
              )}
            />

            {/* 입력 도움말 */}
            <div className="absolute bottom-2 right-2 flex items-center gap-1">
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
          <div className="flex flex-col gap-2">
            {/* 전송 버튼 */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={onSend}
                    disabled={!canSend}
                    size="icon"
                    className={cn(
                      "h-10 w-10 transition-all",
                      canSend && "hover:scale-105"
                    )}
                  >
                    {isLoading ? (
                      <StopCircle className="h-5 w-5 animate-pulse" />
                    ) : (
                      <Send className="h-5 w-5" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {isLoading ? "전송 중..." : "메시지 전송"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* 추가 액션 버튼들 */}
            <div className="flex gap-1">
              {/* 파일 첨부 */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      disabled={disabled || isLoading}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Paperclip className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>파일 첨부</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {/* 음성 입력 (준비 중) */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      disabled={true}
                    >
                      <Mic className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>음성 입력 (준비 중)</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {/* 대화 초기화 */}
              {onClear && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        disabled={isLoading}
                        onClick={onClear}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>대화 초기화</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </div>
        </div>

        {/* 문자 수 카운터 */}
        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {input.length} / 4000 글자
            {input.length > 3500 && (
              <span className="text-yellow-600 ml-2">
                (글자 수 제한에 근접)
              </span>
            )}
          </span>
          {isLoading && (
            <span className="flex items-center gap-1">
              <div className="h-2 w-2 bg-primary rounded-full animate-pulse" />
              응답 생성 중...
            </span>
          )}
        </div>

        {/* 숨겨진 파일 입력 */}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".txt,.md,.pdf,.doc,.docx"
          onChange={handleFileSelect}
        />
      </div>
    </div>
  );
}