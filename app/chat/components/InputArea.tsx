"use client";

import { useState, useRef, KeyboardEvent, useEffect, memo } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SettingsPanel } from "./SettingsPanel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Database } from "lucide-react";
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
  Sparkles,
  Zap,
  Trash2,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface QuotedMessage {
  role: "user" | "assistant";
  content: string;
}

interface ModelOption {
  value: string;
  label: string;
  description: string;
  icon?: React.ReactNode;
}

interface Collection {
  name: string;
  vectors_count: number;
  points_count: number;
  vector_size: number;
  distance: string;
}

interface ChatSettings {
  model: string;
  reasoningLevel: string;
  temperature: number;
  maxTokens: number;
  topP: number;
  topK: number;
  frequencyPenalty: number;
  presencePenalty: number;
  streamMode: boolean;
  useReranking: boolean;
}

interface InputAreaProps {
  input: string;
  setInput: (value: string) => void;
  onSend: () => void;
  isLoading: boolean;
  disabled?: boolean;
  quotedMessage?: QuotedMessage | null;
  onClearQuote?: () => void;
  selectedModel: string;
  onModelChange: (model: string) => void;
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
  selectedModel,
  onModelChange,
  onClearChat,
  isFullscreen,
  selectedCollection,
  onCollectionChange,
  collections,
  settings,
  onSettingsChange,
  settingsPanelOpen,
  onSettingsPanelChange,
}: InputAreaProps) {
  const [isComposing, setIsComposing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 사용 가능한 모델 목록
  const modelOptions: ModelOption[] = [
    {
      value: "gpt-oss-20b",
      label: "GPT-OSS 20B",
      description: "빠른 응답, 범용 질문에 적합",
      icon: <Sparkles className="h-4 w-4" />,
    },
    {
      value: "exaone-deep-7.8b",
      label: "EXAONE 7.8B",
      description: "경량화, 빠른 추론",
      icon: <Zap className="h-4 w-4" />,
    },
  ];

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
  const selectedModelOption = modelOptions.find(m => m.value === selectedModel);

  return (
    <div className={cn(
      "flex-shrink-0 border-t px-4 py-4",
      isFullscreen ? "bg-slate-50/90 backdrop-blur-xl dark:bg-slate-900/90" : "bg-background"
    )}>
      <div className="max-w-[800px] mx-auto">
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

        {/* Claude 스타일 입력 카드 - 통합된 디자인 */}
        <div className="bg-card border rounded-2xl shadow-sm hover:shadow-md transition-shadow">
          {/* 입력 영역 */}
          <div className="relative pt-3 px-4">
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
                  : "메시지를 입력하세요... (Enter로 전송, Shift+Enter로 줄바꿈)"
              }
              disabled={disabled || isLoading}
              className={cn(
                "min-h-[60px] max-h-[300px] resize-none border-0 focus-visible:ring-0 shadow-none pr-14 px-0",
                "placeholder:text-muted-foreground/60",
                disabled && "opacity-50 cursor-not-allowed"
              )}
            />

            {/* 전송/중단 버튼 (입력창 내부) */}
            <div className="absolute bottom-3 right-3">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={isStreaming ? onStopStreaming : onSend}
                      disabled={isStreaming ? false : !canSend}
                      size="icon"
                      className={cn(
                        "h-9 w-9 rounded-full transition-all",
                        isStreaming
                          ? "bg-destructive hover:bg-destructive/90"
                          : canSend
                          ? "bg-primary hover:bg-primary/90"
                          : "opacity-30 cursor-not-allowed bg-muted"
                      )}
                    >
                      {isStreaming ? (
                        <StopCircle className="h-5 w-5" />
                      ) : isLoading ? (
                        <div className="h-5 w-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
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
          <div className="px-4 py-3 flex items-center justify-between gap-2">
            {/* 왼쪽: 컬렉션 선택 및 기능 버튼들 */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* 컬렉션 선택 */}
              <Select value={selectedCollection} onValueChange={onCollectionChange}>
                <SelectTrigger className="h-8 w-auto min-w-[140px] border-muted hover:bg-muted/50 transition-colors gap-2 rounded-full">
                  <div className="flex items-center gap-1.5">
                    <Database className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium">{selectedCollection || "컬렉션 선택"}</span>
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {collections.length === 0 ? (
                    <div className="p-2 text-center text-sm text-muted-foreground">
                      컬렉션이 없습니다
                    </div>
                  ) : (
                    collections.map((collection) => (
                      <SelectItem key={collection.name} value={collection.name}>
                        <div className="flex items-center justify-between gap-2">
                          <span>{collection.name}</span>
                          <Badge variant="secondary" className="ml-2 text-xs">
                            {collection.points_count.toLocaleString()}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>

              {/* 대화 초기화 */}
              {onClearChat && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
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

              {/* 고급설정 */}
              <Popover open={settingsPanelOpen} onOpenChange={onSettingsPanelChange}>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <PopoverTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
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

            {/* 오른쪽: 모델 선택 */}
            <div className="flex items-center gap-2">
              <Select value={selectedModel} onValueChange={onModelChange}>
                <SelectTrigger className="h-8 w-auto border-muted hover:bg-muted/50 transition-colors gap-2 rounded-full">
                  <div className="flex items-center gap-1.5">
                    {selectedModelOption?.icon}
                    <span className="text-xs font-medium">{selectedModelOption?.label}</span>
                  </div>
                </SelectTrigger>
                <SelectContent align="end">
                  {modelOptions.map((model) => (
                    <SelectItem key={model.value} value={model.value}>
                      <div className="flex items-center gap-2">
                        {model.icon}
                        <div className="flex flex-col">
                          <span className="font-medium">{model.label}</span>
                          <span className="text-xs text-muted-foreground">
                            {model.description}
                          </span>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});