"use client";

import { cn } from "@/lib/utils";
import { Check, FileText, Database, Star } from "lucide-react";
import type { CollectionWithMetadata } from "../../types/collection-metadata";
import { getCategoryStyle } from "../../types/collection-metadata";
import { getIconComponent } from "../../data/icon-map";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface CollectionCardProps {
  collection: CollectionWithMetadata;
  isSelected: boolean;
  onSelect: () => void;
  highlightText?: string;
}

function formatNumber(num: number): string {
  if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, "") + "K";
  }
  return num.toLocaleString();
}

export function CollectionCard({
  collection,
  isSelected,
  onSelect,
}: CollectionCardProps) {
  const { metadata } = collection;
  const Icon = getIconComponent(metadata.icon);
  const displayName = metadata.koreanName || collection.name;
  const keywords = metadata.keywords || [];
  const categoryStyle = getCategoryStyle(metadata.category);

  // 자유대화 모드 여부 (name이 빈 문자열)
  const isCasualMode = collection.name === "";
  // 추천 컬렉션 여부 (priority === 1)
  const isRecommended = metadata.priority === 1;

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onSelect}
            className={cn(
              // 기본 레이아웃
              "relative flex flex-col p-3 rounded-xl border text-left",
              "min-h-[100px]",
              // 트랜지션
              "transition-all duration-200",
              // 호버 효과 (강화)
              "hover:border-primary hover:bg-accent hover:shadow-md",
              "hover:-translate-y-0.5",
              // 클릭 피드백
              "active:scale-[0.98]",
              // 포커스 상태
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
              // 선택 상태 (강화)
              isSelected
                ? "border-primary bg-primary/10 shadow-md ring-1 ring-primary/30"
                : "border-muted bg-card"
            )}
          >
            {/* 선택 체크마크 */}
            {isSelected && (
              <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                <Check className="h-3 w-3 text-primary-foreground" />
              </div>
            )}

            {/* 추천 아이콘 (선택되지 않았을 때만 표시) */}
            {!isSelected && isRecommended && (
              <div className="absolute top-2 right-2">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
              </div>
            )}

            {/* 상단: 아이콘 + 제목 */}
            <div className="flex items-start gap-2.5 mb-2">
              {/* 아이콘 with 배경 */}
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: categoryStyle.bg }}
              >
                <Icon className="h-5 w-5" style={{ color: categoryStyle.color }} />
              </div>

              {/* 제목 */}
              <div className="flex-1 min-w-0 pt-1">
                <h4 className="font-semibold text-sm leading-tight truncate pr-6">
                  {displayName}
                </h4>
              </div>
            </div>

            {/* 중단: 키워드 태그 */}
            {keywords.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {keywords.slice(0, 3).map((keyword) => (
                  <span
                    key={keyword}
                    className="text-xs px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground"
                  >
                    {keyword}
                  </span>
                ))}
                {keywords.length > 3 && (
                  <span className="text-xs px-1.5 py-0.5 rounded-md bg-muted/50 text-muted-foreground">
                    +{keywords.length - 3}
                  </span>
                )}
              </div>
            )}

            {/* 하단: 문서 정보 (자유대화가 아닐 때만) */}
            {!isCasualMode && (
              <div className="flex items-center gap-3 mt-auto pt-2 border-t border-muted">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <FileText className="h-3 w-3" />
                  <span>문서 {collection.documents_count}개</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Database className="h-3 w-3" />
                  <span>청크 {formatNumber(collection.points_count)}개</span>
                </div>
              </div>
            )}

            {/* 자유대화일 때 설명 */}
            {isCasualMode && (
              <p className="text-xs text-muted-foreground mt-auto">
                RAG 검색 없이 자유롭게 대화합니다
              </p>
            )}
          </button>
        </TooltipTrigger>

        {/* 툴팁: 전체 키워드 표시 */}
        {keywords.length > 3 && (
          <TooltipContent side="bottom" className="max-w-[200px]">
            <p className="text-xs">
              <span className="font-medium">키워드:</span> {keywords.join(", ")}
            </p>
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  );
}
