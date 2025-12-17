"use client";

import { useState, useMemo } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import { CollectionSearchInput } from "./CollectionSearchInput";
import { RecommendedSection } from "./RecommendedSection";
import { FullListSection } from "./FullListSection";
import { CasualModeItem } from "./CasualModeItem";
import { CollectionCard } from "./CollectionCard";
import { useCollectionSearch } from "../../hooks/useCollectionSearch";
import {
  parseCollectionMetadata,
  CollectionWithMetadata
} from "../../types/collection-metadata";
import { getIconComponent } from "../../data/icon-map";
import { cn } from "@/lib/utils";
import { Sparkles } from "lucide-react";
import type { Collection } from "../../types";

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
  const [searchQuery, setSearchQuery] = useState("");
  const [showFullList, setShowFullList] = useState(false);

  // 메타데이터 파싱 및 컬렉션 확장
  const collectionsWithMetadata: CollectionWithMetadata[] = useMemo(() => {
    return collections.map((c) => ({
      ...c,
      metadata: parseCollectionMetadata(c.description),
    }));
  }, [collections]);

  // 추천 컬렉션 (priority === 1)
  const recommendedCollections = useMemo(() => {
    return collectionsWithMetadata
      .filter((c) => c.metadata.priority === 1)
      .sort((a, b) =>
        (a.metadata.koreanName || a.name).localeCompare(
          b.metadata.koreanName || b.name,
          "ko-KR"
        )
      );
  }, [collectionsWithMetadata]);

  // 전체 목록용 컬렉션 (추천 제외)
  const nonRecommendedCollections = useMemo(() => {
    return collectionsWithMetadata.filter((c) => c.metadata.priority !== 1);
  }, [collectionsWithMetadata]);

  // 검색 필터링
  const { filteredCollections, hasSearchResults } = useCollectionSearch(
    collectionsWithMetadata,
    searchQuery
  );

  // 현재 선택된 컬렉션 표시명
  const selectedDisplayName = useMemo(() => {
    if (!selectedCollection) return "일상대화";
    const collection = collectionsWithMetadata.find(
      (c) => c.name === selectedCollection
    );
    return collection?.metadata.koreanName || selectedCollection;
  }, [selectedCollection, collectionsWithMetadata]);

  // 현재 선택된 컬렉션의 아이콘
  const SelectedIcon = useMemo(() => {
    if (!selectedCollection) return Sparkles;
    const collection = collectionsWithMetadata.find(
      (c) => c.name === selectedCollection
    );
    return getIconComponent(collection?.metadata.icon);
  }, [selectedCollection, collectionsWithMetadata]);

  const handleSelect = (collectionName: string) => {
    onCollectionChange(collectionName);
    setOpen(false);
    setSearchQuery("");
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
            "h-8 w-auto min-w-[100px] max-w-[140px] sm:min-w-[140px] sm:max-w-[200px] justify-between gap-1 sm:gap-2 rounded-full",
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
        className="w-[calc(100vw-2rem)] sm:w-[640px] md:w-[800px] max-w-[800px] p-0"
        align="start"
        collisionPadding={16}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {/* 헤더 */}
        <div className="px-3 py-2 border-b">
          <h4 className="font-medium text-sm">지식 베이스 선택</h4>
        </div>

        {/* 검색 입력 */}
        <CollectionSearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="컬렉션 검색..."
        />

        <div className="max-h-[60vh] sm:max-h-[450px] overflow-y-auto">
          {/* 검색 중일 때 */}
          {searchQuery ? (
            <div className="p-3">
              {hasSearchResults ? (
                <>
                  <p className="text-xs text-muted-foreground px-1 py-1 mb-2">
                    검색 결과 ({filteredCollections.length}개)
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5">
                    {filteredCollections.map((c) => (
                      <CollectionCard
                        key={c.name}
                        collection={c}
                        isSelected={selectedCollection === c.name}
                        onSelect={() => handleSelect(c.name)}
                        highlightText={searchQuery}
                      />
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  검색 결과가 없습니다
                </p>
              )}
            </div>
          ) : (
            <>
              {/* 일상대화 - 상단 */}
              <div className="p-2 border-b">
                <CasualModeItem
                  isSelected={!selectedCollection}
                  onSelect={() => handleSelect("")}
                />
              </div>

              {/* 추천 섹션 */}
              {recommendedCollections.length > 0 && (
                <RecommendedSection
                  collections={recommendedCollections}
                  selectedCollection={selectedCollection}
                  onSelect={handleSelect}
                />
              )}

              {/* 전체 목록 (추천 제외) */}
              <FullListSection
                collections={nonRecommendedCollections}
                selectedCollection={selectedCollection}
                onSelect={handleSelect}
                expanded={showFullList}
                onExpandChange={setShowFullList}
              />
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
