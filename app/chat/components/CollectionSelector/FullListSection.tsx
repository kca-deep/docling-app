"use client";

import { FolderOpen, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CollectionItem } from "./CollectionItem";
import type { CollectionWithMetadata } from "../../types/collection-metadata";

interface FullListSectionProps {
  collections: CollectionWithMetadata[];
  selectedCollection: string;
  onSelect: (collectionName: string) => void;
  expanded: boolean;
  onExpandChange: (expanded: boolean) => void;
}

export function FullListSection({
  collections,
  selectedCollection,
  onSelect,
  expanded,
  onExpandChange,
}: FullListSectionProps) {
  // priority 순으로 정렬 (1 > 2 > 3 > undefined), 같으면 한글명으로 정렬
  const sortedCollections = [...collections].sort((a, b) => {
    const priorityA = a.metadata.priority ?? 999;
    const priorityB = b.metadata.priority ?? 999;
    if (priorityA !== priorityB) return priorityA - priorityB;

    const nameA = a.metadata.koreanName || a.name;
    const nameB = b.metadata.koreanName || b.name;
    return nameA.localeCompare(nameB, "ko-KR");
  });

  return (
    <div className="p-2 border-b">
      {/* 헤더 (접기/펼치기) */}
      <Button
        variant="ghost"
        className="w-full justify-between px-2 py-1.5 h-auto"
        onClick={() => onExpandChange(!expanded)}
      >
        <div className="flex items-center gap-1.5">
          <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">
            전체 목록 ({collections.length}개)
          </span>
        </div>
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
      </Button>

      {/* 목록 */}
      {expanded && (
        <div className="space-y-0.5 mt-1">
          {sortedCollections.map((collection) => (
            <CollectionItem
              key={collection.name}
              collection={collection}
              isSelected={selectedCollection === collection.name}
              onSelect={() => onSelect(collection.name)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
