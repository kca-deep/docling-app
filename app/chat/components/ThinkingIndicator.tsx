"use client";

import { useEffect, useState, memo } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Wand2, Search, FileText, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface ThinkingStage {
  id: string;
  label: string;
  icon: React.ElementType;
  colorVar: string;
}

const THINKING_STAGES: ThinkingStage[] = [
  { id: "analyze", label: "분석", icon: FileText, colorVar: "var(--chart-1)" },
  { id: "search", label: "검색", icon: Search, colorVar: "var(--chart-2)" },
  { id: "generate", label: "생성", icon: Sparkles, colorVar: "var(--chart-3)" },
];

// 단계별 진행 시간 (ms)
const STAGE_DURATION = 2500;

interface ThinkingIndicatorProps {
  className?: string;
}

export const ThinkingIndicator = memo(function ThinkingIndicator({
  className,
}: ThinkingIndicatorProps) {
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);

  // 단계 자동 진행
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStageIndex((prev) => {
        // 마지막 단계에 도달하면 유지
        if (prev >= THINKING_STAGES.length - 1) return prev;
        return prev + 1;
      });
    }, STAGE_DURATION);

    return () => clearInterval(interval);
  }, []);

  // 경과 시간 카운터
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const currentStage = THINKING_STAGES[currentStageIndex];

  return (
    <div className={cn("flex gap-3 w-full", className)}>
      {/* Avatar with gradient background */}
      <Avatar className="h-8 w-8 flex-shrink-0">
        <AvatarFallback
          className="relative overflow-hidden"
          style={{
            background: `linear-gradient(135deg, ${currentStage.colorVar}, color-mix(in oklch, ${currentStage.colorVar} 60%, var(--muted)))`,
          }}
        >
          <Wand2 className="h-4 w-4 text-white" />
          {/* Orbital ring effect */}
          <div
            className="absolute inset-0 rounded-full border-2 border-transparent animate-spin"
            style={{
              borderTopColor: "rgba(255,255,255,0.6)",
              animationDuration: "1.5s",
            }}
          />
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 max-w-[calc(100%-3rem)]">
        <div
          className="rounded-2xl px-4 py-3 transition-all duration-300"
          style={{
            background: `color-mix(in oklch, ${currentStage.colorVar} 8%, var(--muted))`,
          }}
        >
          {/* Orbital Spinner + Message */}
          <div className="flex items-center gap-3 mb-3">
            <OrbitalSpinner colorVar={currentStage.colorVar} />
            <div className="flex flex-col">
              <span
                className="text-sm font-medium transition-colors duration-300"
                style={{ color: currentStage.colorVar }}
              >
                KCA-i가 {currentStage.label} 중입니다...
              </span>
              <span className="text-xs text-muted-foreground">
                {elapsedTime}초 경과
              </span>
            </div>
          </div>

          {/* Progress Stages */}
          <div className="flex items-center gap-2">
            {THINKING_STAGES.map((stage, index) => {
              const StageIcon = stage.icon;
              const isCompleted = index < currentStageIndex;
              const isCurrent = index === currentStageIndex;
              const isPending = index > currentStageIndex;

              return (
                <div key={stage.id} className="flex items-center gap-2">
                  <Badge
                    variant={isCurrent ? "default" : "outline"}
                    className={cn(
                      "gap-1.5 px-2 py-0.5 text-xs transition-all duration-300",
                      isPending && "opacity-40"
                    )}
                    style={
                      isCurrent
                        ? {
                            background: `linear-gradient(135deg, ${stage.colorVar}, color-mix(in oklch, ${stage.colorVar} 70%, transparent))`,
                            borderColor: "transparent",
                            color: "white",
                          }
                        : isCompleted
                        ? {
                            borderColor: stage.colorVar,
                            color: stage.colorVar,
                            background: `color-mix(in oklch, ${stage.colorVar} 10%, transparent)`,
                          }
                        : undefined
                    }
                  >
                    <StageIcon
                      className={cn(
                        "h-3 w-3",
                        isCurrent && "animate-pulse"
                      )}
                    />
                    {stage.label}
                    {isCompleted && (
                      <span className="ml-0.5">✓</span>
                    )}
                  </Badge>
                  {index < THINKING_STAGES.length - 1 && (
                    <div
                      className="w-4 h-0.5 rounded-full transition-all duration-300"
                      style={{
                        background: isCompleted
                          ? stage.colorVar
                          : "var(--muted-foreground)",
                        opacity: isCompleted ? 1 : 0.3,
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
});

// Orbital Spinner Component
interface OrbitalSpinnerProps {
  colorVar: string;
}

function OrbitalSpinner({ colorVar }: OrbitalSpinnerProps) {
  return (
    <div className="relative h-6 w-6">
      {/* Center dot */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-2 w-2 rounded-full animate-pulse"
        style={{ background: colorVar }}
      />

      {/* Orbital ring 1 */}
      <div
        className="absolute inset-0 rounded-full border-2 border-transparent animate-spin"
        style={{
          borderTopColor: colorVar,
          borderRightColor: `color-mix(in oklch, ${colorVar} 30%, transparent)`,
          animationDuration: "1s",
        }}
      />

      {/* Orbital ring 2 (reverse) */}
      <div
        className="absolute inset-1 rounded-full border border-transparent animate-spin"
        style={{
          borderBottomColor: `color-mix(in oklch, ${colorVar} 50%, transparent)`,
          animationDuration: "1.5s",
          animationDirection: "reverse",
        }}
      />

      {/* Orbiting dots */}
      <div
        className="absolute inset-0 animate-spin"
        style={{ animationDuration: "2s" }}
      >
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 h-1.5 w-1.5 rounded-full"
          style={{ background: colorVar }}
        />
      </div>
      <div
        className="absolute inset-0 animate-spin"
        style={{ animationDuration: "2s", animationDelay: "0.5s" }}
      >
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full opacity-60"
          style={{ background: colorVar }}
        />
      </div>
    </div>
  );
}
