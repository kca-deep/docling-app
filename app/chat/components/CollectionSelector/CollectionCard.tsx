"use client";

import { cn } from "@/lib/utils";
import { Check, FileText, Database } from "lucide-react";
import type { CollectionWithMetadata } from "../../types/collection-metadata";
import { getIconComponent } from "../../data/icon-map";

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

export function CollectionCard({
  collection,
  isSelected,
  onSelect,
  highlightText,
}: CollectionCardProps) {
  const { metadata } = collection;
  const Icon = getIconComponent(metadata.icon);
  const displayName = metadata.koreanName || collection.name;
  const keywords = metadata.keywords || [];

  return (
    <button
      onClick={onSelect}
      className={cn(
        "flex flex-col p-2.5 rounded-lg border text-left transition-all",
        "hover:border-primary/50 hover:bg-muted/50 hover:shadow-sm",
        isSelected
          ? "border-primary bg-primary/5 ring-2 ring-primary/20"
          : "border-muted bg-card"
      )}
    >
      {/* 상단: 아이콘 + 제목 + 체크 */}
      <div className="flex items-center gap-2 mb-1.5">
        <Icon
          className="h-4 w-4 flex-shrink-0"
          style={{ color: "var(--chart-2)" }}
        />
        <h4 className="font-semibold text-sm truncate flex-1">
          {highlightText ? highlightMatch(displayName, highlightText) : displayName}
        </h4>
        {isSelected && (
          <Check className="h-3.5 w-3.5 text-primary flex-shrink-0" />
        )}
      </div>

      {/* 키워드 (1줄) */}
      {keywords.length > 0 && (
        <p className="text-xs text-muted-foreground truncate mb-1.5">
          {keywords.slice(0, 3).join(", ")}
          {keywords.length > 3 && ` +${keywords.length - 3}`}
        </p>
      )}

      {/* 하단: 문서 수 / 청크 수 */}
      <div className="flex items-center gap-3 pt-1.5 border-t border-muted">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <FileText className="h-3 w-3" />
          <span>{collection.documents_count}</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Database className="h-3 w-3" />
          <span>{formatNumber(collection.points_count)}</span>
        </div>
      </div>
    </button>
  );
}
