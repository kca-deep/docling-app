"use client";

import { useEffect, useState, memo, useMemo } from "react";
import { Wand2, Search, FileText, Sparkles, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface ThinkingStage {
  id: string;
  label: string;
  icon: React.ElementType;
  colorVar: string;
  hints: string[];
}

const THINKING_STAGES: ThinkingStage[] = [
  {
    id: "analyze",
    label: "분석",
    icon: FileText,
    colorVar: "var(--chart-1)",
    hints: [
      "질문을 분석하고 있습니다",
      "핵심 키워드를 추출 중",
      "질문 의도 파악 중",
    ],
  },
  {
    id: "search",
    label: "검색",
    icon: Search,
    colorVar: "var(--chart-2)",
    hints: [
      "문서에서 정보를 찾는 중",
      "유사 내용 검색 중",
      "관련 소스 탐색 중",
    ],
  },
  {
    id: "rerank",
    label: "재순위",
    icon: ArrowUpDown,
    colorVar: "var(--chart-4)",
    hints: [
      "검색 결과를 재정렬 중",
      "관련도 순으로 정리 중",
      "최적의 문서 선별 중",
    ],
  },
  {
    id: "generate",
    label: "생성",
    icon: Sparkles,
    colorVar: "var(--chart-3)",
    hints: [
      "답변을 생성하고 있습니다",
      "정보를 종합하는 중",
      "응답을 구성하는 중",
    ],
  },
];

// 단계 ID -> 인덱스 매핑
const STAGE_INDEX_MAP: Record<string, number> = {
  analyze: 0,
  search: 1,
  rerank: 2,
  generate: 3,
};

// 단계별 진행 시간 (ms) - fallback용
const STAGE_DURATION = 2500;

interface ThinkingIndicatorProps {
  className?: string;
  collectionName?: string;
  currentStage?: string; // 백엔드에서 전송한 실제 단계
}

export const ThinkingIndicator = memo(function ThinkingIndicator({
  className,
  collectionName,
  currentStage: externalStage,
}: ThinkingIndicatorProps) {
  const [fallbackStageIndex, setFallbackStageIndex] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [currentHint, setCurrentHint] = useState("");

  // 실제 단계 인덱스 계산 (외부 props 우선, 없으면 fallback)
  const currentStageIndex = useMemo(() => {
    if (externalStage && STAGE_INDEX_MAP[externalStage] !== undefined) {
      return STAGE_INDEX_MAP[externalStage];
    }
    return fallbackStageIndex;
  }, [externalStage, fallbackStageIndex]);

  // 단계 자동 진행 (외부 단계가 없을 때만 작동)
  useEffect(() => {
    if (externalStage) return; // 외부 단계가 있으면 자동 진행 비활성화

    const interval = setInterval(() => {
      setFallbackStageIndex((prev) => {
        if (prev >= THINKING_STAGES.length - 1) return prev;
        return prev + 1;
      });
    }, STAGE_DURATION);

    return () => clearInterval(interval);
  }, [externalStage]);

  // 경과 시간 카운터
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // 힌트 메시지 변경
  useEffect(() => {
    const stage = THINKING_STAGES[currentStageIndex];
    if (stage) {
      const randomHint = stage.hints[Math.floor(Math.random() * stage.hints.length)];
      setCurrentHint(randomHint);
    }
  }, [currentStageIndex]);

  const currentStage = THINKING_STAGES[currentStageIndex] || THINKING_STAGES[0];

  // 진행률 계산 (0-100)
  const progressPercent = ((currentStageIndex + 1) / THINKING_STAGES.length) * 100;

  return (
    <div className={cn("w-full", className)}>
      {/* 인디케이터 카드 - 단계별 배경색 */}
      <div
        className="relative overflow-hidden rounded-xl border transition-all duration-500"
        style={{
          backgroundColor: `color-mix(in oklch, ${currentStage.colorVar} 8%, var(--background))`,
          borderColor: `color-mix(in oklch, ${currentStage.colorVar} 25%, var(--border))`,
        }}
      >
        {/* 좌측 액센트 바 */}
        <div
          className="absolute left-0 top-0 bottom-0 w-1 transition-all duration-500"
          style={{
            background: currentStage.colorVar,
          }}
        />

        {/* 카드 콘텐츠 */}
        <div className="relative pl-4 pr-4 py-3">
          {/* 단일 행: 모든 요소 */}
          <div className="flex items-center gap-3">
            {/* 글로우 아이콘 */}
            <div className="relative flex-shrink-0">
              <div
                className="absolute inset-0 rounded-lg blur-md opacity-40 animate-pulse"
                style={{ backgroundColor: currentStage.colorVar }}
              />
              <div
                className="relative h-8 w-8 rounded-lg flex items-center justify-center shadow-md transition-all duration-500"
                style={{
                  background: `linear-gradient(135deg, ${currentStage.colorVar}, color-mix(in oklch, ${currentStage.colorVar} 70%, var(--background)))`,
                }}
              >
                <Wand2 className="h-4 w-4 text-white" strokeWidth={2} />
              </div>
            </div>

            {/* 메시지 + 힌트 */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className="text-sm font-semibold whitespace-nowrap transition-colors duration-300"
                  style={{ color: currentStage.colorVar }}
                >
                  KCA-i 응답 생성 중
                </span>
                {collectionName && (
                  <span className="hidden sm:inline-flex items-center gap-2">
                    <span className="text-muted-foreground/40">•</span>
                    <span className="text-xs text-muted-foreground truncate max-w-[120px]">
                      {collectionName}
                    </span>
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 truncate animate-in fade-in duration-300">
                {currentHint}
              </p>
            </div>

            {/* 고정 너비 진행률 바 + 단계 인디케이터 */}
            <div className="flex items-center gap-3 flex-shrink-0">
              {/* 고정 너비 진행률 바 */}
              <div className="w-14 h-1.5 bg-muted/50 rounded-full overflow-hidden hidden sm:block">
                <div
                  className="h-full rounded-full transition-all duration-700 ease-out"
                  style={{
                    width: `${progressPercent}%`,
                    background: `linear-gradient(90deg, ${THINKING_STAGES[0].colorVar}, ${currentStage.colorVar})`,
                  }}
                />
              </div>

              {/* 단계 인디케이터 (점 + 텍스트) - 모바일 숨김 */}
              <div className="hidden sm:flex items-center gap-1">
                {THINKING_STAGES.map((stage, index) => {
                  const isCompleted = index < currentStageIndex;
                  const isCurrent = index === currentStageIndex;
                  const isPending = index > currentStageIndex;

                  return (
                    <div
                      key={stage.id}
                      className={cn(
                        "relative flex items-center gap-1 px-2 py-1 rounded-md transition-all duration-300",
                        isCurrent && "shadow-sm",
                      )}
                      style={{
                        backgroundColor: isCurrent
                          ? `color-mix(in oklch, ${stage.colorVar} 15%, var(--background))`
                          : "transparent",
                      }}
                    >
                      {/* 점 */}
                      <div
                        className={cn(
                          "relative h-2 w-2 rounded-full transition-all duration-300",
                          isCurrent && "scale-110"
                        )}
                        style={{
                          backgroundColor: isCompleted || isCurrent
                            ? stage.colorVar
                            : "var(--muted)",
                          opacity: isPending ? 0.4 : 1,
                        }}
                      >
                        {/* 현재 단계 펄스 효과 */}
                        {isCurrent && (
                          <div
                            className="absolute inset-0 rounded-full animate-ping opacity-50"
                            style={{ backgroundColor: stage.colorVar }}
                          />
                        )}
                      </div>

                      {/* 라벨 */}
                      <span
                        className={cn(
                          "text-xs font-medium transition-all duration-300",
                          isPending && "opacity-40"
                        )}
                        style={{
                          color: isCompleted || isCurrent
                            ? stage.colorVar
                            : "var(--muted-foreground)",
                        }}
                      >
                        {isCompleted ? "✓" : stage.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* 경과 시간 */}
              <div
                className="text-xs sm:text-sm font-mono font-semibold tabular-nums min-w-[2rem] sm:min-w-[2.5rem] text-right"
                style={{ color: currentStage.colorVar }}
              >
                {elapsedTime}
                <span className="text-xs font-normal text-muted-foreground ml-0.5">초</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
