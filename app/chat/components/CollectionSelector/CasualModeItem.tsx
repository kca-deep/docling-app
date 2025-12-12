"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Sparkles, Check } from "lucide-react";

interface CasualModeItemProps {
  isSelected: boolean;
  onSelect: () => void;
}

export function CasualModeItem({ isSelected, onSelect }: CasualModeItemProps) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full flex items-center gap-4 px-4 py-3 rounded-lg text-left transition-all border",
        "hover:border-primary/50 hover:bg-muted/50 hover:shadow-sm",
        isSelected
          ? "border-primary bg-primary/5 ring-2 ring-primary/20"
          : "border-muted bg-card"
      )}
    >
      {/* 아이콘 */}
      <div className="flex-shrink-0">
        <Sparkles className="h-6 w-6 text-muted-foreground" />
      </div>

      {/* 내용 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm">일상대화</span>
          {isSelected && (
            <Check className="h-4 w-4 text-primary flex-shrink-0" />
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          RAG 검색 없이 자유롭게 대화합니다
        </p>
      </div>

      {/* 배지 */}
      <div className="flex-shrink-0">
        <Badge variant="outline" className="text-xs">
          RAG 없음
        </Badge>
      </div>
    </button>
  );
}
