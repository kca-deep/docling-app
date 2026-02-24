"use client";

import { useMemo } from "react";
import { MessageCircle } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
} from "@/components/ui/select";
import {
  parseCollectionMetadata,
  CollectionWithMetadata,
} from "../../types/collection-metadata";
import { getIconComponent } from "../../data/icon-map";
import type { Collection } from "../../types";

const CASUAL_MODE_VALUE = "__casual__";

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
  const collectionsWithMetadata: CollectionWithMetadata[] = useMemo(() => {
    return collections.map((c) => ({
      ...c,
      metadata: parseCollectionMetadata(c.description),
    }));
  }, [collections]);

  const sortedCollections = useMemo(() => {
    return [...collectionsWithMetadata].sort((a, b) => {
      const priorityA = a.metadata.priority ?? 999;
      const priorityB = b.metadata.priority ?? 999;
      if (priorityA !== priorityB) return priorityA - priorityB;
      const nameA = a.metadata.koreanName || a.name;
      const nameB = b.metadata.koreanName || b.name;
      return nameA.localeCompare(nameB, "ko-KR");
    });
  }, [collectionsWithMetadata]);

  const selectedDisplayName = useMemo(() => {
    if (!selectedCollection) return "자유대화";
    const collection = collectionsWithMetadata.find(
      (c) => c.name === selectedCollection
    );
    return collection?.metadata.koreanName || selectedCollection;
  }, [selectedCollection, collectionsWithMetadata]);

  const SelectedIcon = useMemo(() => {
    if (!selectedCollection) return MessageCircle;
    const collection = collectionsWithMetadata.find(
      (c) => c.name === selectedCollection
    );
    return getIconComponent(collection?.metadata.icon);
  }, [selectedCollection, collectionsWithMetadata]);

  const selectValue = selectedCollection === "" ? CASUAL_MODE_VALUE : selectedCollection;

  const handleValueChange = (value: string) => {
    onCollectionChange(value === CASUAL_MODE_VALUE ? "" : value);
  };

  return (
    <Select value={selectValue} onValueChange={handleValueChange} disabled={disabled}>
      <SelectTrigger
        size="sm"
        className="h-8 w-auto min-w-[120px] max-w-[160px] sm:min-w-[160px] sm:max-w-[220px] rounded-full border-muted hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-1 sm:gap-1.5 overflow-hidden">
          <SelectedIcon
            className="h-3.5 w-3.5 flex-shrink-0"
            style={{ color: "var(--chart-2)" }}
          />
          <span className="text-xs font-medium truncate">{selectedDisplayName}</span>
        </div>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={CASUAL_MODE_VALUE}>
          <MessageCircle className="h-4 w-4" />
          자유대화
        </SelectItem>
        <SelectSeparator />
        {sortedCollections.map((collection) => {
          const Icon = getIconComponent(collection.metadata.icon);
          return (
            <SelectItem key={collection.name} value={collection.name}>
              <Icon className="h-4 w-4" />
              {collection.metadata.koreanName || collection.name}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
