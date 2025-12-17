"use client";

import { useState, useRef, KeyboardEvent, memo } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SettingsPanel } from "./SettingsPanel";
import { CollectionSelector } from "./CollectionSelector";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  ArrowUp,
  StopCircle,
  X,
  Quote,
  Trash2,
  Settings,
  Brain,
} from "lucide-react";
import { DocumentUploadButton } from "./DocumentUploadButton";
import { cn } from "@/lib/utils";
import type { QuotedMessage, Collection, ChatSettings } from "../types";


interface InputAreaProps {
  input: string;
  setInput: (value: string) => void;
  onSend: () => void;
  isLoading: boolean;
  disabled?: boolean;
  quotedMessage?: QuotedMessage | null;
  onClearQuote?: () => void;
  onClearChat?: () => void;
  isFullscreen?: boolean;
  selectedCollection: string;
  onCollectionChange: (collection: string) => void;
  collections: Collection[];
  settings: ChatSettings;
  onSettingsChange: (settings: ChatSettings) => void;
  settingsPanelOpen: boolean;
  onSettingsPanelChange: (open: boolean) => void;
  isStreaming?: boolean;
  onStopStreaming?: () => void;
  deepThinkingEnabled: boolean;
  onDeepThinkingChange: (enabled: boolean) => void;
  // 문서 업로드 관련 (버튼만)
  isDocumentUploading?: boolean;
  isDocumentReady?: boolean;
  onFileSelect?: (files: File[]) => void;
}


export const InputArea = memo(function InputArea({
  input,
  setInput,
  onSend,
  isLoading,
  disabled,
  quotedMessage,
  onClearQuote,
  isStreaming = false,
  onStopStreaming,
  onClearChat,
  isFullscreen,
  selectedCollection,
  onCollectionChange,
  collections,
  settings,
  onSettingsChange,
  settingsPanelOpen,
  onSettingsPanelChange,
  deepThinkingEnabled,
  onDeepThinkingChange,
  // 문서 업로드 관련 (버튼만)
  isDocumentUploading = false,
  isDocumentReady = false,
  onFileSelect,
}: InputAreaProps) {
  const [isComposing, setIsComposing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 자동 포커스 제거 - 모바일에서 키보드가 자동으로 올라오는 문제 방지
  // useEffect(() => {
  //   if (!isLoading && !disabled && textareaRef.current) {
  //     textareaRef.current.focus();
  //   }
  // }, [isLoading, disabled]);

  const handleKeyPress = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // 한글 입력 중에는 무시
    if (isComposing) return;

    // Enter로 전송, Shift+Enter로 줄바꿈
    // 일상대화 모드에서는 disabled 무시
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isLoading && input.trim()) {
        onSend();
      }
    }
  };

  // 일상대화 모드에서는 disabled 무시하고 메시지만 있으면 전송 가능
  const canSend = !isLoading && input.trim().length > 0;

  return (
    <div className="flex-shrink-0 px-4 md:px-6 py-4">
      <div className="max-w-[var(--chat-content-max-width)] mx-auto">
        {/* 인용 메시지 표시 */}
        {quotedMessage && (
          <div className="mb-3 bg-muted/50 border-l-4 border-primary rounded-r-lg p-3 animate-in slide-in-from-bottom-2 duration-300">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Quote className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                  <Badge variant="secondary" className="text-xs">
                    {quotedMessage.role === "user" ? "내 질문" : "AI 답변"}에 대한 답변
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2 pl-5">
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

        {/* ChatGPT 스타일 입력 카드 - Glassmorphism Floating Style */}
        <div className="bg-background/40 backdrop-blur-xl border border-white/10 rounded-[2rem] shadow-2xl transition-all duration-300 hover:shadow-primary/10 group relative overflow-hidden ring-1 ring-white/20 hover:ring-white/30">
          {/* Background Gradient Blend */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-transparent opacity-50 pointer-events-none" />

          {/* 입력 영역 */}
          <div className="relative pt-3 px-4 z-10">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              onCompositionStart={() => setIsComposing(true)}
              onCompositionEnd={() => setIsComposing(false)}
              placeholder={
                isLoading
                  ? "응답 생성 중..."
                  : "메시지를 입력하세요..."
              }
              disabled={isLoading}
              className={cn(
                "min-h-[44px] sm:min-h-[60px] max-h-[150px] sm:max-h-[300px] resize-none border-0 focus-visible:ring-0 shadow-none pr-14 px-3 py-2 bg-transparent text-sm sm:text-base",
                "placeholder:text-muted-foreground/60 selection:bg-primary/20",
                disabled && "opacity-50 cursor-not-allowed"
              )}
            />

            {/* 전송/중단 버튼 (입력창 내부) */}
            <div className="absolute bottom-2 sm:bottom-3 right-3 sm:right-5">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={isStreaming ? onStopStreaming : onSend}
                      disabled={isStreaming ? false : !canSend}
                      size="icon"
                      className={cn(
                        "h-8 w-8 sm:h-10 sm:w-10 rounded-full transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-110 active:scale-95",
                        isStreaming
                          ? "bg-destructive text-destructive-foreground hover:bg-destructive/90 animate-pulse"
                          : !canSend
                            ? "bg-muted text-muted-foreground opacity-50 cursor-not-allowed"
                            : "bg-gradient-to-tr from-violet-600 to-fuchsia-600 text-white animate-pulse hover:animate-none"
                      )}
                    >
                      {isStreaming ? (
                        <StopCircle className="h-5 w-5" />
                      ) : isLoading ? (
                        <div className="h-5 w-5 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                      ) : (
                        <ArrowUp className="h-5 w-5" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p className="text-xs">
                      {isStreaming ? "응답 중단 (ESC)" : isLoading ? "처리 중..." : "메시지 전송 (Enter)"}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>

          {/* 하단 기능 버튼들 - Claude 스타일 */}
          <div className="px-3 sm:px-4 py-2 sm:py-3 flex items-center justify-between gap-1 sm:gap-2">
            {/* 왼쪽: 컬렉션 선택 및 기능 버튼들 */}
            <div className="flex items-center gap-1 sm:gap-2 flex-nowrap overflow-hidden">
              {/* 컬렉션 선택 - 새로운 CollectionSelector 컴포넌트 */}
              <CollectionSelector
                selectedCollection={selectedCollection}
                onCollectionChange={onCollectionChange}
                collections={collections}
                disabled={isLoading}
              />

              {/* 문서 업로드 버튼 */}
              {onFileSelect && (
                <DocumentUploadButton
                  isUploading={isDocumentUploading}
                  isReady={isDocumentReady}
                  onFileSelect={onFileSelect}
                  disabled={isLoading}
                />
              )}

              {/* 심층사고 토글 */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "h-8 w-8 transition-colors",
                        deepThinkingEnabled && "bg-muted"
                      )}
                      style={
                        deepThinkingEnabled
                          ? { backgroundColor: "color-mix(in oklch, var(--chart-5) 15%, transparent)" }
                          : undefined
                      }
                      disabled={isLoading}
                      onClick={() => onDeepThinkingChange(!deepThinkingEnabled)}
                    >
                      <Brain
                        className="h-3.5 w-3.5 transition-colors"
                        style={{
                          color: deepThinkingEnabled ? "var(--chart-5)" : undefined
                        }}
                      />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">
                      {deepThinkingEnabled ? "심층사고 활성화됨" : "심층사고 비활성화됨"}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {/* 대화 초기화 */}
              {onClearChat && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 hover:bg-muted text-muted-foreground hover:text-foreground"
                        disabled={isLoading}
                        onClick={onClearChat}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">대화 초기화</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}

              {/* 고급설정 - 모바일 숨김 */}
              <Popover open={settingsPanelOpen} onOpenChange={onSettingsPanelChange}>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <PopoverTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 hidden sm:inline-flex"
                        >
                          <Settings className="h-3.5 w-3.5" />
                        </Button>
                      </PopoverTrigger>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">고급설정</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <PopoverContent
                  side="top"
                  align="start"
                  className="w-[250px] max-h-[500px] overflow-y-auto p-0"
                >
                  <SettingsPanel
                    settings={settings}
                    onSettingsChange={onSettingsChange}
                  />
                </PopoverContent>
              </Popover>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
});