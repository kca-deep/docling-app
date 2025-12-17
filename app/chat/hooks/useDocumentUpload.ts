"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { API_BASE_URL } from "@/lib/api-config";

/**
 * 문서 처리 단계
 */
export type ProcessingStage =
  | "uploading"
  | "parsing"
  | "chunking"
  | "embedding"
  | "indexing"
  | "ready"
  | "error";

/**
 * 개별 파일 업로드 상태
 */
export interface FileUploadStatus {
  filename: string;
  stage: ProcessingStage;
  progress: number;
  error: string | null;
  pageCount: number;
  taskId: string | null;
}

/**
 * 전체 업로드 상태
 */
export interface UploadStatus {
  stage: ProcessingStage;
  progress: number;
  filename: string;
  collectionName: string | null;
  error: string | null;
  pageCount: number;
  /** 개별 파일 상태 목록 */
  files: FileUploadStatus[];
  /** 전체 파일 수 */
  totalFiles: number;
  /** 완료된 파일 수 */
  completedFiles: number;
}

/**
 * 문서 업로드 훅 반환 타입
 */
export interface UseDocumentUploadReturn {
  /** 현재 업로드 상태 */
  status: UploadStatus | null;
  /** 업로드 진행 중 여부 */
  isUploading: boolean;
  /** 문서 준비 완료 여부 */
  isReady: boolean;
  /** 오류 발생 여부 */
  hasError: boolean;
  /** 문서 업로드 시작 (다중 파일 지원) */
  uploadDocuments: (files: File[], sessionId?: string) => Promise<void>;
  /** 업로드 취소 및 정리 */
  clearDocument: () => Promise<void>;
  /** 임시 컬렉션명 */
  tempCollectionName: string | null;
  /** 업로드된 파일명 목록 */
  uploadedFilenames: string[];
}

/**
 * 채팅 문서 업로드 관리 훅 (다중 파일 지원)
 *
 * - 여러 파일 업로드 지원
 * - 첫 번째 파일은 새 컬렉션 생성, 나머지는 기존 컬렉션에 추가
 * - SSE로 진행률 실시간 수신
 * - 임시 컬렉션 관리
 */
export function useDocumentUpload(): UseDocumentUploadReturn {
  const [status, setStatus] = useState<UploadStatus | null>(null);
  const [tempCollectionName, setTempCollectionName] = useState<string | null>(null);
  const [uploadedFilenames, setUploadedFilenames] = useState<string[]>([]);

  const eventSourcesRef = useRef<Map<string, EventSource>>(new Map());
  const abortControllerRef = useRef<AbortController | null>(null);

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      eventSourcesRef.current.forEach((es) => es.close());
      eventSourcesRef.current.clear();
      abortControllerRef.current?.abort();
    };
  }, []);

  /**
   * 단일 파일 업로드 및 SSE 추적
   */
  const uploadSingleFile = useCallback(
    async (
      file: File,
      sessionId: string,
      existingCollectionName: string | null,
      onProgress: (status: FileUploadStatus, collectionName: string | null) => void,
      onComplete: (collectionName: string | null, error: string | null) => void
    ): Promise<void> => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("session_id", sessionId);
      if (existingCollectionName) {
        formData.append("collection_name", existingCollectionName);
      }

      try {
        const response = await fetch(
          `${API_BASE_URL}/api/chat/documents/upload`,
          {
            method: "POST",
            body: formData,
            signal: abortControllerRef.current?.signal,
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || "업로드에 실패했습니다");
        }

        const data = await response.json();
        const taskId = data.task_id;

        // SSE 연결
        await new Promise<void>((resolve, reject) => {
          const eventSource = new EventSource(
            `${API_BASE_URL}/api/chat/documents/status/${taskId}`
          );
          eventSourcesRef.current.set(taskId, eventSource);

          eventSource.onmessage = (event) => {
            try {
              const data = JSON.parse(event.data);

              const fileStatus: FileUploadStatus = {
                filename: file.name,
                stage: data.stage as ProcessingStage,
                progress: data.progress || 0,
                error: data.error || null,
                pageCount: data.page_count || 0,
                taskId,
              };

              onProgress(fileStatus, data.collection_name || null);

              if (data.stage === "ready") {
                eventSource.close();
                eventSourcesRef.current.delete(taskId);
                onComplete(data.collection_name, null);
                resolve();
              } else if (data.stage === "error") {
                eventSource.close();
                eventSourcesRef.current.delete(taskId);
                onComplete(null, data.error || "처리 중 오류 발생");
                reject(new Error(data.error || "처리 중 오류 발생"));
              }
            } catch (e) {
              console.error("Failed to parse SSE message:", e);
            }
          };

          eventSource.onerror = () => {
            eventSource.close();
            eventSourcesRef.current.delete(taskId);
            onComplete(null, "연결이 끊어졌습니다");
            reject(new Error("연결이 끊어졌습니다"));
          };
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "업로드에 실패했습니다";
        onComplete(null, errorMessage);
        throw error;
      }
    },
    []
  );

  /**
   * 다중 문서 업로드 시작
   * - 기존 컬렉션이 있으면 해당 컬렉션에 추가 (추가 모드)
   * - 없으면 새 컬렉션 생성
   */
  const uploadDocuments = useCallback(
    async (files: File[], sessionId?: string) => {
      if (files.length === 0) return;

      // 기존 연결 정리
      eventSourcesRef.current.forEach((es) => es.close());
      eventSourcesRef.current.clear();
      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();

      const actualSessionId = sessionId || Math.random().toString(36).substring(2, 14);

      // 기존 컬렉션이 있으면 추가 모드, 없으면 새로 생성
      const existingCollection = tempCollectionName;
      const existingFilenames = existingCollection ? uploadedFilenames : [];

      // 초기 상태 설정
      const initialFileStatuses: FileUploadStatus[] = files.map((f) => ({
        filename: f.name,
        stage: "uploading" as ProcessingStage,
        progress: 0,
        error: null,
        pageCount: 0,
        taskId: null,
      }));

      // 기존 파일 목록에 새 파일 추가
      const allFilenames = [...existingFilenames, ...files.map((f) => f.name)];

      setStatus({
        stage: "uploading",
        progress: 0,
        filename: files.length === 1 ? files[0].name : `${files.length}개 파일`,
        collectionName: existingCollection,
        error: null,
        pageCount: 0,
        files: initialFileStatuses,
        totalFiles: files.length,
        completedFiles: 0,
      });
      setUploadedFilenames(allFilenames);
      // 기존 컬렉션이 있으면 유지, 없으면 null (새로 생성됨)
      // setTempCollectionName은 첫 파일 업로드 완료 시 설정됨

      // 기존 컬렉션이 있으면 그것을 사용, 없으면 첫 파일에서 생성
      let currentCollectionName: string | null = existingCollection;
      let completedCount = 0;
      let hasError = false;
      let totalPageCount = 0;

      // 순차적으로 파일 업로드
      for (let i = 0; i < files.length; i++) {
        if (hasError) break;

        const file = files[i];

        try {
          await uploadSingleFile(
            file,
            actualSessionId,
            currentCollectionName, // 첫 번째는 null, 이후는 생성된 컬렉션명
            (fileStatus, collectionName) => {
              // 컬렉션명 저장
              if (collectionName && !currentCollectionName) {
                currentCollectionName = collectionName;
                setTempCollectionName(collectionName);
              }

              // 전체 상태 업데이트
              setStatus((prev) => {
                if (!prev) return null;

                const updatedFiles = [...prev.files];
                updatedFiles[i] = fileStatus;

                // 전체 진행률 계산
                const overallProgress = Math.round(
                  updatedFiles.reduce((sum, f) => sum + f.progress, 0) / files.length
                );

                return {
                  ...prev,
                  stage: fileStatus.stage,
                  progress: overallProgress,
                  filename: fileStatus.filename,
                  collectionName: currentCollectionName,
                  files: updatedFiles,
                  pageCount: totalPageCount + fileStatus.pageCount,
                };
              });
            },
            (collectionName, error) => {
              if (error) {
                hasError = true;
                setStatus((prev) => {
                  if (!prev) return null;
                  const updatedFiles = [...prev.files];
                  updatedFiles[i] = {
                    ...updatedFiles[i],
                    stage: "error",
                    error,
                  };
                  return {
                    ...prev,
                    stage: "error",
                    error,
                    files: updatedFiles,
                  };
                });
              } else {
                completedCount++;
                if (collectionName) {
                  currentCollectionName = collectionName;
                }

                // 현재 파일의 페이지 수 누적
                setStatus((prev) => {
                  if (!prev) return null;
                  totalPageCount = prev.files.reduce((sum, f) => sum + f.pageCount, 0);
                  return {
                    ...prev,
                    completedFiles: completedCount,
                    pageCount: totalPageCount,
                  };
                });
              }
            }
          );
        } catch (error) {
          console.error(`Upload failed for ${file.name}:`, error);
          // 에러는 onComplete에서 처리됨
          break;
        }
      }

      // 모든 파일 완료 시 최종 상태 업데이트
      if (!hasError && completedCount === files.length) {
        setStatus((prev) => {
          if (!prev) return null;
          // 전체 파일 수 (기존 + 새로 추가)
          const totalFileCount = allFilenames.length;
          return {
            ...prev,
            stage: "ready",
            progress: 100,
            filename: totalFileCount === 1 ? allFilenames[0] : `${totalFileCount}개 파일`,
          };
        });
      }
    },
    [uploadSingleFile, tempCollectionName, uploadedFilenames]
  );

  /**
   * 업로드 취소 및 임시 컬렉션 삭제
   */
  const clearDocument = useCallback(async () => {
    // SSE 연결 종료
    eventSourcesRef.current.forEach((es) => es.close());
    eventSourcesRef.current.clear();
    abortControllerRef.current?.abort();

    // 임시 컬렉션 삭제
    if (tempCollectionName) {
      try {
        await fetch(
          `${API_BASE_URL}/api/chat/documents/${tempCollectionName}`,
          {
            method: "DELETE",
          }
        );
      } catch (error) {
        console.error("Failed to delete temp collection:", error);
      }
    }

    // 상태 초기화
    setStatus(null);
    setTempCollectionName(null);
    setUploadedFilenames([]);
  }, [tempCollectionName]);

  // 파생 상태
  const isUploading =
    status !== null &&
    status.stage !== "ready" &&
    status.stage !== "error";

  const isReady = status?.stage === "ready";
  const hasError = status?.stage === "error";

  return {
    status,
    isUploading,
    isReady,
    hasError,
    uploadDocuments,
    clearDocument,
    tempCollectionName,
    uploadedFilenames,
  };
}
