"use client";

import { useMemo } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ChevronDown, MessageCircle } from "lucide-react";
import { CollectionCard } from "./CollectionCard";
import {
  parseCollectionMetadata,
  CollectionWithMetadata
} from "../../types/collection-metadata";
import { getIconComponent } from "../../data/icon-map";
import { cn } from "@/lib/utils";
import type { Collection } from "../../types";
import { useState } from "react";

interface CollectionSelectorProps {
  selectedCollection: string;
  onCollectionChange: (collection: string) => void;
  collections: Collection[];
  disabled?: boolean;
}

export function CollectionSelector({
  selectedCollection,
  onCollectionChange,
  collections,
  disabled,
}: CollectionSelectorProps) {
  const [open, setOpen] = useState(false);

  // 메타데이터 파싱 및 컬렉션 확장
  const collectionsWithMetadata: CollectionWithMetadata[] = useMemo(() => {
    return collections.map((c) => ({
      ...c,
      metadata: parseCollectionMetadata(c.description),
    }));
  }, [collections]);

  // 자유대화 가상 컬렉션
  const casualModeCollection: CollectionWithMetadata = useMemo(() => ({
    name: "",
    documents_count: 0,
    points_count: 0,
    vector_size: 0,
    distance: "",
    metadata: {
      koreanName: "자유대화",
      icon: "MessageCircle",
      keywords: ["일상 대화", "RAG 미사용"],
      priority: 1,
      category: "general",
    },
  }), []);

  // 전체 컬렉션 목록: 자유대화 + priority 순 정렬
  const allCollections = useMemo(() => {
    const sorted = [...collectionsWithMetadata].sort((a, b) => {
      // priority 순 (1 > 2 > 3 > undefined)
      const priorityA = a.metadata.priority ?? 999;
      const priorityB = b.metadata.priority ?? 999;
      if (priorityA !== priorityB) return priorityA - priorityB;
      // 같은 priority면 한글명으로 정렬
      const nameA = a.metadata.koreanName || a.name;
      const nameB = b.metadata.koreanName || b.name;
      return nameA.localeCompare(nameB, "ko-KR");
    });
    return [casualModeCollection, ...sorted];
  }, [collectionsWithMetadata, casualModeCollection]);

  // 현재 선택된 컬렉션 표시명
  const selectedDisplayName = useMemo(() => {
    if (!selectedCollection) return "자유대화";
    const collection = collectionsWithMetadata.find(
      (c) => c.name === selectedCollection
    );
    return collection?.metadata.koreanName || selectedCollection;
  }, [selectedCollection, collectionsWithMetadata]);

  // 현재 선택된 컬렉션의 아이콘
  const SelectedIcon = useMemo(() => {
    if (!selectedCollection) return MessageCircle;
    const collection = collectionsWithMetadata.find(
      (c) => c.name === selectedCollection
    );
    return getIconComponent(collection?.metadata.icon);
  }, [selectedCollection, collectionsWithMetadata]);

  const handleSelect = (collectionName: string) => {
    onCollectionChange(collectionName);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "h-8 w-auto min-w-[120px] max-w-[160px] sm:min-w-[160px] sm:max-w-[220px] justify-between gap-1 sm:gap-2 rounded-full",
            "border-muted hover:bg-muted/50 transition-colors"
          )}
        >
          <div className="flex items-center gap-1 sm:gap-1.5 overflow-hidden">
            <SelectedIcon
              className="h-3.5 w-3.5 flex-shrink-0"
              style={{ color: "var(--chart-2)" }}
            />
            <span className="text-xs font-medium truncate">{selectedDisplayName}</span>
          </div>
          <ChevronDown className="h-3 w-3 opacity-50 flex-shrink-0" />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className="w-[calc(100vw-2rem)] sm:w-[560px] md:w-[680px] max-w-[680px] p-0"
        align="start"
        collisionPadding={16}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {/* 헤더 */}
        <div className="px-4 py-3 border-b">
          <h4 className="font-medium text-sm">지식 베이스 선택</h4>
        </div>

        <div className="max-h-[60vh] sm:max-h-[500px] overflow-y-auto p-4">
          {/* 컬렉션 그리드 */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {allCollections.map((collection) => (
              <CollectionCard
                key={collection.name || "casual-mode"}
                collection={collection}
                isSelected={selectedCollection === collection.name}
                onSelect={() => handleSelect(collection.name)}
              />
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
