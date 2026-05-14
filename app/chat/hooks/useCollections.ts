"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { API_BASE_URL } from "@/lib/api-config";
import type { Collection } from "../types";

export function useCollections() {
  const searchParams = useSearchParams();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [initialCollectionApplied, setInitialCollectionApplied] = useState(false);

  // 컬렉션 목록 로드
  useEffect(() => {
    const fetchCollections = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/chat/collections`, {
          credentials: 'include'
        });
        if (response.ok) {
          const data = await response.json();
          const sortedCollections = [...(data.collections || [])].sort((a, b) =>
            a.name.localeCompare(b.name, 'ko-KR')
          );
          setCollections(sortedCollections);

        }
      } catch (error) {
        console.error("Failed to fetch collections:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCollections();
  }, []);

  // URL의 collection 파라미터로 초기 컬렉션 선택 (fetch 완료 후 1회만)
  useEffect(() => {
    if (initialCollectionApplied || collections.length === 0) return;

    const collectionParam = searchParams?.get("collection");
    if (collectionParam && collections.some((c) => c.name === collectionParam)) {
      setSelectedCollection(collectionParam);
    }
    setInitialCollectionApplied(true);
  }, [collections, searchParams, initialCollectionApplied]);

  // 컬렉션 변경 (외부에서 호출할 수 있도록 콜백 제공)
  const changeCollection = useCallback((newCollection: string) => {
    if (newCollection !== selectedCollection) {
      setSelectedCollection(newCollection);
      return true; // 변경됨
    }
    return false; // 동일하여 변경 안됨
  }, [selectedCollection]);

  return {
    collections,
    selectedCollection,
    setSelectedCollection: changeCollection,
    isLoadingCollections: isLoading,
  };
}
