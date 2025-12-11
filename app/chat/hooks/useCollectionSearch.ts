import { useMemo } from "react";
import type { CollectionWithMetadata } from "../types/collection-metadata";

export function useCollectionSearch(
  collections: CollectionWithMetadata[],
  query: string
) {
  const filteredCollections = useMemo(() => {
    if (!query.trim()) return collections;

    const normalizedQuery = query.toLowerCase().trim();

    return collections.filter((c) => {
      const { metadata } = c;

      // 컬렉션 이름 검색
      if (c.name.toLowerCase().includes(normalizedQuery)) {
        return true;
      }

      // 한글명 검색
      if (metadata.koreanName?.toLowerCase().includes(normalizedQuery)) {
        return true;
      }

      // 키워드 검색
      if (metadata.keywords?.some((k) =>
        k.toLowerCase().includes(normalizedQuery)
      )) {
        return true;
      }

      // 설명 검색
      if (metadata.plainDescription?.toLowerCase().includes(normalizedQuery)) {
        return true;
      }

      return false;
    });
  }, [collections, query]);

  return {
    filteredCollections,
    hasSearchResults: filteredCollections.length > 0,
  };
}
