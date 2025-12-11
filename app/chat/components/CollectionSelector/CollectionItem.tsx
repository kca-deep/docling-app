"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import type { CollectionWithMetadata } from "../../types/collection-metadata";
import { getIconComponent } from "../../data/icon-map";

interface CollectionItemProps {
  collection: CollectionWithMetadata;
  isSelected: boolean;
  onSelect: () => void;
  highlightText?: string;
}

function highlightMatch(text: string, query?: string) {
  if (!query || !text) return text;

  const normalizedQuery = query.toLowerCase();
  const index = text.toLowerCase().indexOf(normalizedQuery);

  if (index === -1) return text;

  return (
    <>
      {text.slice(0, index)}
      <span className="bg-yellow-200 dark:bg-yellow-800 rounded px-0.5">
        {text.slice(index, index + query.length)}
      </span>
      {text.slice(index + query.length)}
    </>
  );
}

export function CollectionItem({
  collection,
  isSelected,
  onSelect,
  highlightText,
}: CollectionItemProps) {
  const { metadata } = collection;
  const Icon = getIconComponent(metadata.icon);
  const displayName = metadata.koreanName || collection.name;
  const keywords = metadata.keywords || [];

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
        <Icon
          className="h-4 w-4"
          style={{ color: "var(--chart-2)" }}
        />
      </div>

      {/* 내용 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">
            {highlightText ? highlightMatch(displayName, highlightText) : displayName}
          </span>
          {isSelected && (
            <Check className="h-3.5 w-3.5 text-primary flex-shrink-0" />
          )}
        </div>

        {/* 키워드 */}
        {keywords.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {keywords.slice(0, 4).map((keyword) => (
              <span
                key={keyword}
                className="text-xs text-muted-foreground"
              >
                {highlightText ? highlightMatch(keyword, highlightText) : keyword}
                {keywords.indexOf(keyword) < Math.min(keywords.length, 4) - 1 && ","}
              </span>
            ))}
            {keywords.length > 4 && (
              <span className="text-xs text-muted-foreground">
                +{keywords.length - 4}
              </span>
            )}
          </div>
        )}
      </div>

      {/* 문서 수 */}
      <div className="flex-shrink-0">
        <Badge variant="secondary" className="text-xs">
          {collection.points_count.toLocaleString()}
        </Badge>
      </div>
    </button>
  );
}
