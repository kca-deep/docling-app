"use client";

import { Star } from "lucide-react";
import { CollectionItem } from "./CollectionItem";
import type { CollectionWithMetadata } from "../../types/collection-metadata";

interface RecommendedSectionProps {
  collections: CollectionWithMetadata[];
  selectedCollection: string;
  onSelect: (collectionName: string) => void;
}

export function RecommendedSection({
  collections,
  selectedCollection,
  onSelect,
}: RecommendedSectionProps) {
  if (collections.length === 0) return null;

  return (
    <div className="p-2 border-b">
      <div className="flex items-center gap-1.5 px-2 py-1.5">
        <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />
        <span className="text-xs font-medium text-muted-foreground">
          추천
        </span>
      </div>
      <div className="space-y-0.5">
        {collections.map((collection) => (
          <CollectionItem
            key={collection.name}
            collection={collection}
            isSelected={selectedCollection === collection.name}
            onSelect={() => onSelect(collection.name)}
          />
        ))}
      </div>
    </div>
  );
}
