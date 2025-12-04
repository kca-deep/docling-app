"use client";

import { useEffect, useState, memo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lightbulb, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { API_BASE_URL } from "@/lib/api-config";

interface SuggestedPromptsProps {
  collectionName: string;
  onSelect: (prompt: string) => void;
}

export const SuggestedPrompts = memo(function SuggestedPrompts({ collectionName, onSelect }: SuggestedPromptsProps) {
  const [prompts, setPrompts] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPrompts = async () => {
      if (!collectionName) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const response = await fetch(
          `${API_BASE_URL}/api/chat/suggested-prompts/${collectionName}`
        );

        if (response.ok) {
          const data = await response.json();
          setPrompts(data.prompts || []);
        }
      } catch (error) {
        console.error("Failed to fetch suggested prompts:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPrompts();
  }, [collectionName]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-2">
        <div className="flex gap-2 items-center text-muted-foreground">
          <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
          <span className="text-xs">추천 질문 로딩 중...</span>
        </div>
      </div>
    );
  }

  if (prompts.length === 0) {
    return null;
  }

  return (
    <div className="py-1 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* 웰컴 섹션 */}
      <div className="flex flex-col items-center text-center py-6">
        <div
          className="h-14 w-14 rounded-2xl flex items-center justify-center mb-4"
          style={{ background: "linear-gradient(135deg, var(--chart-3), var(--chart-1))" }}
        >
          <span className="text-2xl font-bold text-white">K</span>
        </div>
        <h2
          className="text-xl font-semibold mb-2 bg-clip-text text-transparent"
          style={{ backgroundImage: "linear-gradient(90deg, var(--chart-3), var(--chart-1))" }}
        >
          KCA-i에 오신 것을 환영합니다
        </h2>
        <p className="text-sm text-muted-foreground max-w-md">
          문서 기반 AI 어시스턴트입니다.<br />
          업로드된 문서에서 정확한 답변을 찾아드립니다.
        </p>
      </div>

      {/* 추천 질문 헤더 */}
      <div className="flex items-center gap-2 px-0.5">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Sparkles className="h-4 w-4 animate-pulse" style={{ color: "var(--chart-3)" }} />
            <Sparkles className="h-4 w-4 absolute inset-0 animate-ping opacity-50" style={{ color: "var(--chart-3)" }} />
          </div>
          <h3 className="text-sm font-semibold">추천 질문</h3>
        </div>
        <div
          className="flex-1 h-px"
          style={{ background: "linear-gradient(to right, var(--chart-3), transparent)" }}
        />
      </div>

      {/* 질문 카드 그리드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {prompts.slice(0, 6).map((prompt, index) => (
          <Card
            key={index}
            className={cn(
              "group cursor-pointer transition-all duration-300",
              "hover:shadow-lg hover:scale-[1.02]",
              "active:scale-[0.98]",
              "animate-in fade-in slide-in-from-bottom-2"
            )}
            style={{
              animationDelay: `${index * 50}ms`,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "color-mix(in oklch, var(--chart-3) 50%, transparent)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "";
            }}
            onClick={() => onSelect(prompt)}
          >
            <CardContent className="px-3 py-2.5">
              <div className="flex items-start gap-2">
                <div className="flex-shrink-0 mt-0.5">
                  <div
                    className="h-6 w-6 rounded-full flex items-center justify-center transition-colors"
                    style={{ backgroundColor: "color-mix(in oklch, var(--chart-3) 15%, transparent)" }}
                  >
                    <Lightbulb className="h-3.5 w-3.5" style={{ color: "var(--chart-3)" }} />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-snug group-hover:text-foreground/80 transition-colors line-clamp-2">
                    {prompt}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 하단 힌트 */}
      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground mt-2">
        <span>클릭하여 질문을 선택하거나 직접 입력해보세요</span>
      </div>
    </div>
  );
});
