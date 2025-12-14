"use client";

import { Star } from "lucide-react";
import { CollectionCard } from "./CollectionCard";
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
    <div className="p-3 border-b">
      <div className="flex items-center gap-1.5 px-1 py-1.5 mb-2">
        <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />
        <span className="text-xs font-medium text-muted-foreground">
          추천 ({collections.length}개)
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5">
        {collections.map((collection) => (
          <CollectionCard
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
