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
        "w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left transition-colors",
        "hover:bg-muted/50",
        isSelected && "bg-primary/10 border-l-2 border-primary"
      )}
    >
      {/* 아이콘 */}
      <div className="flex-shrink-0 mt-0.5">
        <Sparkles className="h-4 w-4 text-muted-foreground" />
      </div>

      {/* 내용 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">일상대화</span>
          {isSelected && (
            <Check className="h-3.5 w-3.5 text-primary flex-shrink-0" />
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          RAG 검색 없이 자유 대화
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
