"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lightbulb, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface SuggestedPromptsProps {
  collectionName: string;
  onSelect: (prompt: string) => void;
}

export function SuggestedPrompts({ collectionName, onSelect }: SuggestedPromptsProps) {
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
          `http://localhost:8000/api/chat/suggested-prompts/${collectionName}`
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
      <div className="flex items-center justify-center py-8">
        <div className="flex gap-2 items-center text-muted-foreground">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="text-sm">추천 질문 로딩 중...</span>
        </div>
      </div>
    );
  }

  if (prompts.length === 0) {
    return null;
  }

  return (
    <div className="py-6 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* 헤더 */}
      <div className="flex items-center gap-2 px-2">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Sparkles className="h-5 w-5 text-primary animate-pulse" />
            <Sparkles className="h-5 w-5 text-primary absolute inset-0 animate-ping opacity-50" />
          </div>
          <h3 className="text-lg font-semibold">추천 질문</h3>
        </div>
        <div className="flex-1 h-px bg-gradient-to-r from-border to-transparent" />
      </div>

      {/* 질문 카드 그리드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {prompts.slice(0, 6).map((prompt, index) => (
          <Card
            key={index}
            className={cn(
              "group cursor-pointer transition-all duration-300",
              "hover:shadow-lg hover:scale-[1.02] hover:border-primary/50",
              "active:scale-[0.98]",
              "animate-in fade-in slide-in-from-bottom-2"
            )}
            style={{ animationDelay: `${index * 50}ms` }}
            onClick={() => onSelect(prompt)}
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <Lightbulb className="h-4 w-4 text-primary" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-relaxed group-hover:text-primary transition-colors">
                    {prompt}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 하단 힌트 */}
      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground pt-2">
        <span>클릭하여 질문을 선택하거나 직접 입력해보세요</span>
      </div>
    </div>
  );
}
