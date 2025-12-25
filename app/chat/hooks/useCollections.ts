"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { API_BASE_URL } from "@/lib/api-config";
import type { Collection } from "../types";

export function useCollections() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);

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
          if (sortedCollections.length > 0) {
            toast.success(`${sortedCollections.length}개의 컬렉션을 불러왔습니다`);
          }
        }
      } catch (error) {
        console.error("Failed to fetch collections:", error);
        toast.error("컬렉션 목록을 불러오는데 실패했습니다");
      } finally {
        setIsLoading(false);
      }
    };

    fetchCollections();
  }, []);

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
