"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sun, Moon, Maximize, Minimize, Wifi, WifiOff, Loader2 } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { API_BASE_URL } from "@/lib/api-config";

interface ModelOption {
  key: string;
  label: string;
  description: string;
  status: "healthy" | "unhealthy" | "degraded" | "unconfigured" | "error";
  error?: string;
  latency_ms?: number;
}

interface ChatHeaderProps {
  isFullscreen: boolean;
  onFullscreenToggle: () => void;
  theme: string | undefined;
  onThemeToggle: () => void;
  mounted: boolean;
  selectedModel: string;
  onModelChange?: (model: string) => void;
}

// 모델별 색상 매핑 (GPT-OSS: 보라색 계열, EXAONE: 청록색 계열)
const getModelColorClass = (modelKey: string) => {
  if (modelKey.includes("gpt-oss")) {
    return {
      border: "border-violet-500/50",
      text: "text-violet-700 dark:text-violet-300",
      dot: "bg-violet-500",
    };
  }
  if (modelKey.includes("exaone")) {
    return {
      border: "border-teal-500/50",
      text: "text-teal-700 dark:text-teal-300",
      dot: "bg-teal-500",
    };
  }
  return {
    border: "border-gray-500/50",
    text: "text-gray-700 dark:text-gray-300",
    dot: "bg-gray-500",
  };
};

export function ChatHeader({
  isFullscreen,
  onFullscreenToggle,
  theme,
  onThemeToggle,
  mounted,
  selectedModel,
  onModelChange,
}: ChatHeaderProps) {
  // 초기 fallback 모델 목록
  const fallbackModels: ModelOption[] = [
    { key: "gpt-oss-20b", label: "GPT-OSS 20B", description: "빠른 응답, 범용", status: "healthy" },
    { key: "exaone-4.0-32b", label: "EXAONE 32B", description: "고성능, 장문 처리", status: "healthy" },
  ];

  const [modelOptions, setModelOptions] = useState<ModelOption[]>(fallbackModels);
  const [isLoadingModels, setIsLoadingModels] = useState(true);

  // EventSource 재연결 관련 refs
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);
  const MAX_RECONNECT_ATTEMPTS = 3;

  // EventSource 연결 함수
  const connectEventSource = useCallback(() => {
    // 기존 연결 정리
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const eventSource = new EventSource(`${API_BASE_URL}/api/health/llm-models/stream`);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.models) {
          setModelOptions(data.models);
          setIsLoadingModels(false);
          // 성공적으로 데이터 수신 시 재연결 카운터 리셋
          reconnectAttemptsRef.current = 0;
        }
      } catch (e) {
        console.error("LLM models SSE parse error:", e);
      }
    };

    eventSource.onerror = () => {
      console.warn("LLM models SSE connection error");
      eventSource.close();
      eventSourceRef.current = null;

      // 마운트된 상태에서만 재연결 시도
      if (isMountedRef.current && reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
        // 지수 백오프: 1초, 2초, 4초
        const delay = Math.pow(2, reconnectAttemptsRef.current) * 1000;
        console.log(`SSE reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current + 1}/${MAX_RECONNECT_ATTEMPTS})`);

        reconnectTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            reconnectAttemptsRef.current++;
            connectEventSource();
          }
        }, delay);
      } else if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
        console.warn("Max SSE reconnection attempts reached, using fallback data");
        setIsLoadingModels(false);
      }
    };
  }, []);

  // SSE로 LLM 모델 상태 실시간 구독
  useEffect(() => {
    isMountedRef.current = true;
    connectEventSource();

    return () => {
      isMountedRef.current = false;
      // EventSource 정리
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      // 재연결 타임아웃 정리
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, [connectEventSource]);

  // 자동 스위칭 로직 (별도 useEffect로 분리)
  useEffect(() => {
    if (!onModelChange) return;

    const currentModel = modelOptions.find(m => m.key === selectedModel);
    if (currentModel && currentModel.status === "unhealthy") {
      const healthyModel = modelOptions.find(m => m.status === "healthy");
      if (healthyModel && healthyModel.key !== selectedModel) {
        onModelChange(healthyModel.key);
      }
    }
  }, [modelOptions, selectedModel, onModelChange]);

  const selectedModelOption = modelOptions.find(m => m.key === selectedModel);

  const getStatusColor = () => {
    if (!selectedModelOption) return "bg-gray-400";
    switch (selectedModelOption.status) {
      case "healthy":
        return "bg-green-500";
      case "degraded":
        return "bg-amber-500";
      case "unhealthy":
        return "bg-red-500";
      default:
        return "bg-gray-400";
    }
  };

  const getStatusIcon = () => {
    if (isLoadingModels) {
      return <Loader2 className="w-3 h-3 animate-spin" />;
    }
    if (!selectedModelOption || selectedModelOption.status === "unhealthy") {
      return <WifiOff className="w-3 h-3" />;
    }
    return <Wifi className="w-3 h-3" />;
  };

  return (
    <div
      className={cn(
        "relative flex items-center justify-center flex-shrink-0 transition-all duration-300",
        isFullscreen ? "bg-background/98" : "bg-background"
      )}
    >
      {/* 상단 그라데이션 라인 */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px]"
        style={{
          background: "linear-gradient(90deg, var(--chart-1), var(--chart-2), var(--chart-3), var(--chart-2), var(--chart-1))",
        }}
      />

      {/* 메인 콘텐츠 영역 */}
      <div className="w-full px-4 py-2 flex items-center justify-center">
        {/* 중앙 텍스트 - 선명한 타이포그래피 */}
        <div className="flex items-center gap-3">
          {/* KCA-i 로고 */}
          <span className="font-extrabold text-2xl tracking-tight text-foreground">
            KCA
            <span className="text-primary">-</span>
            <span
              className="italic"
              style={{ color: "var(--chart-2)" }}
            >
              i
            </span>
          </span>
          {/* 구분선 */}
          <span className="w-px h-6 bg-border" />
          {/* LLM 상태 배지 (모델별 색상 적용) */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                {(() => {
                  const modelColors = selectedModelOption
                    ? getModelColorClass(selectedModelOption.key)
                    : { border: "border-gray-500/50", text: "text-gray-700 dark:text-gray-300", dot: "bg-gray-500" };

                  return (
                    <Badge
                      variant="outline"
                      className={cn(
                        "gap-1.5 cursor-help transition-colors py-1 px-2.5",
                        modelColors.border,
                        modelColors.text
                      )}
                    >
                      <span className={cn("w-2 h-2 rounded-full", getStatusColor())} />
                      <span className="text-xs font-medium">
                        {isLoadingModels ? "연결 중..." : selectedModelOption?.label || "LLM"}
                      </span>
                      {getStatusIcon()}
                    </Badge>
                  );
                })()}
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                <div className="space-y-1">
                  <p className="font-medium">AI 모델</p>
                  <p>모델: {selectedModelOption?.label || "알 수 없음"}</p>
                  <p>
                    상태:{" "}
                    {selectedModelOption?.status === "healthy"
                      ? "정상"
                      : selectedModelOption?.status === "degraded"
                      ? "지연"
                      : selectedModelOption?.status === "unhealthy"
                      ? "장애"
                      : "확인 중"}
                  </p>
                  {selectedModelOption?.latency_ms && (
                    <p>응답시간: {selectedModelOption.latency_ms}ms</p>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* 하단 그라데이션 라인 */}
      <div
        className="absolute bottom-0 left-0 right-0 h-[1px]"
        style={{
          background: "linear-gradient(90deg, transparent, var(--chart-1), var(--chart-2), var(--chart-3), var(--chart-2), var(--chart-1), transparent)",
        }}
      />

      {/* 오른쪽: 컨트롤 버튼들 */}
      <div className="absolute right-3 flex items-center gap-0.5">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground/60 hover:text-foreground hover:bg-muted/50"
                onClick={onThemeToggle}
              >
                {mounted && theme === "dark" ? (
                  <Sun className="h-3.5 w-3.5" />
                ) : (
                  <Moon className="h-3.5 w-3.5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">
                {mounted && theme === "dark" ? "라이트 모드" : "다크 모드"}
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground/60 hover:text-foreground hover:bg-muted/50"
                onClick={onFullscreenToggle}
              >
                {isFullscreen ? (
                  <Minimize className="h-3.5 w-3.5" />
                ) : (
                  <Maximize className="h-3.5 w-3.5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">
                {isFullscreen ? "전체화면 종료" : "전체화면"}
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}
