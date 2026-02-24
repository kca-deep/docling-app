import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { API_BASE_URL } from "@/lib/api-config";
import type { FileStatus, ParseOptions, ProgressInfo, SaveResult } from "../types";

const MAX_FILE_SIZE_MB = 50;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export function useFileConversion() {
  const [files, setFiles] = useState<FileStatus[]>([]);
  const [processing, setProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const [parseOptions, setParseOptions] = useState<ParseOptions>({
    strategy: "qwen3-vl",
    do_ocr: true,
    do_table_structure: true,
    include_images: true,
    do_formula_enrichment: false,
  });

  const [selectedCategory, setSelectedCategory] = useState<string>("__uncategorized__");
  const [isStopRequested, setIsStopRequested] = useState(false);
  const stopRequestedRef = useRef(false);

  // 폴링 인터벌 추적 (메모리 누수 방지)
  const pollingIntervalsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const pollingResolversRef = useRef<Map<string, () => void>>(new Map());

  // 파일 상태 ref (handleProcess에서 최신 상태 참조용)
  const filesRef = useRef<FileStatus[]>(files);
  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  // 컴포넌트 언마운트 시 모든 폴링 정리
  useEffect(() => {
    return () => {
      pollingIntervalsRef.current.forEach((interval) => {
        clearInterval(interval);
      });
      pollingIntervalsRef.current.clear();
      pollingResolversRef.current.forEach((resolve) => {
        resolve();
      });
      pollingResolversRef.current.clear();
    };
  }, []);

  const validateFileSize = (file: File): boolean => {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      toast.error(`"${file.name}" 파일이 너무 큽니다. 최대 ${MAX_FILE_SIZE_MB}MB까지 허용됩니다.`);
      return false;
    }
    return true;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const validFiles = Array.from(e.target.files).filter(validateFileSize);
      if (validFiles.length === 0) return;
      const newFiles = validFiles.map(file => ({
        file,
        status: "pending" as const,
        progress: 0,
      }));
      setFiles(prev => [...prev, ...newFiles]);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (processing) return;
    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles && droppedFiles.length > 0) {
      const validFiles = Array.from(droppedFiles).filter(validateFileSize);
      if (validFiles.length === 0) return;
      const newFiles = validFiles.map(file => ({
        file,
        status: "pending" as const,
        progress: 0,
      }));
      setFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const clearPollingInterval = (taskId: string, pollInterval: NodeJS.Timeout) => {
    clearInterval(pollInterval);
    pollingIntervalsRef.current.delete(taskId);
    pollingResolversRef.current.delete(taskId);
  };

  const pollBatchProgress = async (taskId: string, index: number): Promise<void> => {
    return new Promise((resolve) => {
      pollingResolversRef.current.set(taskId, resolve);

      const pollInterval = setInterval(async () => {
        if (stopRequestedRef.current) {
          clearPollingInterval(taskId, pollInterval);
          resolve();
          return;
        }

        try {
          const response = await fetch(`${API_BASE_URL}/api/documents/progress/${taskId}`, {
            credentials: 'include'
          });

          if (response.ok) {
            const progressData: ProgressInfo = await response.json();

            setFiles(prev => prev.map((f, i) =>
              i === index ? {
                ...f,
                progressInfo: progressData,
                progress: Math.min(50 + progressData.progress_percentage / 2, 99)
              } : f
            ));

            if (progressData.status === "completed") {
              clearPollingInterval(taskId, pollInterval);
              setFiles(prev => prev.map((f, i) =>
                i === index ? {
                  ...f,
                  status: "success",
                  progress: 100,
                  result: {
                    task_id: taskId,
                    status: "success",
                    document: {
                      filename: progressData.filename,
                      md_content: progressData.md_content,
                      processing_time: progressData.processing_time
                    },
                    processing_time: progressData.processing_time
                  }
                } : f
              ));
              resolve();
            } else if (progressData.status === "failed") {
              clearPollingInterval(taskId, pollInterval);
              setFiles(prev => prev.map((f, i) =>
                i === index ? {
                  ...f,
                  status: "error",
                  progress: 100,
                  result: {
                    task_id: taskId,
                    status: "failure",
                    error: progressData.error_message || "파싱 실패"
                  }
                } : f
              ));
              resolve();
            }
          } else if (response.status === 404) {
            clearPollingInterval(taskId, pollInterval);
            resolve();
          }
        } catch (err) {
          console.error(`[Batch] Error polling progress for file ${index}:`, err);
        }
      }, 2000);

      pollingIntervalsRef.current.set(taskId, pollInterval);
    });
  };

  const processFile = async (fileStatus: FileStatus, index: number): Promise<void> => {
    setFiles(prev => prev.map((f, i) =>
      i === index ? { ...f, status: "processing", progress: 10 } : f
    ));

    try {
      const formData = new FormData();
      formData.append("file", fileStatus.file);
      formData.append("strategy", parseOptions.strategy);
      formData.append("do_ocr", parseOptions.do_ocr.toString());
      formData.append("do_table_structure", parseOptions.do_table_structure.toString());
      formData.append("include_images", parseOptions.include_images.toString());
      formData.append("do_formula_enrichment", parseOptions.do_formula_enrichment.toString());

      setFiles(prev => prev.map((f, i) =>
        i === index ? { ...f, progress: 30 } : f
      ));

      const response = await fetch(`${API_BASE_URL}/api/documents/convert`, {
        method: "POST",
        credentials: 'include',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API 호출 실패: ${response.status} - ${errorText}`);
      }

      const result = await response.json();

      if (result.status === "processing" && parseOptions.strategy === "qwen3-vl") {
        setFiles(prev => prev.map((f, i) =>
          i === index ? { ...f, result, progress: 50 } : f
        ));
        await pollBatchProgress(result.task_id, index);
      } else if (result.status === "success") {
        setFiles(prev => prev.map((f, i) =>
          i === index ? { ...f, status: "success", progress: 100, result } : f
        ));
      } else {
        setFiles(prev => prev.map((f, i) =>
          i === index ? { ...f, status: "error", progress: 100, result } : f
        ));
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다";
      toast.error(`파일 "${fileStatus.file.name}" 파싱 실패: ${errorMessage}`);
      setFiles(prev => prev.map((f, i) =>
        i === index ? {
          ...f,
          status: "error",
          progress: 100,
          result: { task_id: "", status: "failure", error: errorMessage }
        } : f
      ));
    }
  };

  const handleStopParsing = () => {
    stopRequestedRef.current = true;
    setIsStopRequested(true);

    pollingIntervalsRef.current.forEach((interval) => {
      clearInterval(interval);
    });
    pollingIntervalsRef.current.clear();

    pollingResolversRef.current.forEach((resolve) => {
      resolve();
    });
    pollingResolversRef.current.clear();

    setFiles(prev => prev.map(f =>
      f.status === "processing"
        ? { ...f, status: "pending" as const, progress: 0, progressInfo: undefined, result: undefined }
        : f
    ));

    toast.info("파싱이 중지되었습니다.");
  };

  const handleProcess = async () => {
    setProcessing(true);
    stopRequestedRef.current = false;
    setIsStopRequested(false);

    const currentFiles = filesRef.current;
    for (let i = 0; i < currentFiles.length; i++) {
      if (stopRequestedRef.current) {
        toast.info("파싱이 중지되었습니다. 완료된 문서까지 저장할 수 있습니다.");
        break;
      }
      const latestFiles = filesRef.current;
      if (latestFiles[i]?.status === "pending") {
        await processFile(latestFiles[i], i);
      }
    }

    setProcessing(false);

    if (!stopRequestedRef.current) {
      toast.success("일괄 파싱이 완료되었습니다!");
    }
  };

  const handleRestartFailed = () => {
    stopRequestedRef.current = false;
    setIsStopRequested(false);
    setFiles(prev => {
      const updatedFiles = prev.map(f =>
        (f.status === "error" || f.status === "processing")
          ? { ...f, status: "pending" as const, progress: 0, progressInfo: undefined, result: undefined }
          : f
      );
      setTimeout(() => {
        const hasPending = updatedFiles.some(f => f.status === "pending");
        if (hasPending) {
          handleProcess();
        }
      }, 0);
      return updatedFiles;
    });
  };

  const handleReset = () => {
    setFiles([]);
  };

  const downloadAll = () => {
    files.forEach(fileStatus => {
      if (fileStatus.status === "success" && fileStatus.result?.document?.md_content) {
        const blob = new Blob([fileStatus.result.document.md_content], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${fileStatus.result.document.filename}.md`;
        a.click();
        URL.revokeObjectURL(url);
      }
    });
    toast.success("모든 파일이 다운로드되었습니다!");
  };

  const handleSaveDocument = async (fileStatus: FileStatus) => {
    if (!fileStatus.result?.document?.md_content) return;

    const saveRequest = {
      task_id: fileStatus.result.task_id,
      original_filename: fileStatus.result.document.filename,
      file_size: fileStatus.file.size,
      file_type: fileStatus.file.name.split('.').pop() || '',
      md_content: fileStatus.result.document.md_content,
      processing_time: fileStatus.result.processing_time,
      parse_options: parseOptions,
      category: selectedCategory === "__uncategorized__" ? null : selectedCategory,
    };

    toast.promise(
      fetch(`${API_BASE_URL}/api/documents/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify(saveRequest),
      }).then(async (response) => {
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.detail || "문서 저장에 실패했습니다");
        }
        return response.json();
      }),
      {
        loading: "문서 저장 중...",
        success: `"${fileStatus.result.document.filename}" 저장 완료!`,
        error: (err) => err.message || "문서 저장에 실패했습니다.",
      }
    );
  };

  const handleSaveAllDocuments = async () => {
    const successFiles = files.filter(f => f.status === "success" && f.result?.document?.md_content);
    if (successFiles.length === 0) return;

    const savePromises = successFiles.map(fileStatus => {
      const saveRequest = {
        task_id: fileStatus.result!.task_id,
        original_filename: fileStatus.result!.document!.filename,
        file_size: fileStatus.file.size,
        file_type: fileStatus.file.name.split('.').pop() || '',
        md_content: fileStatus.result!.document!.md_content!,
        processing_time: fileStatus.result!.processing_time,
        parse_options: parseOptions,
        category: selectedCategory === "__uncategorized__" ? null : selectedCategory,
      };

      return fetch(`${API_BASE_URL}/api/documents/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify(saveRequest),
      }).then(async (response) => {
        if (!response.ok) {
          const error = await response.json();
          if (error.detail?.includes("이미 저장된 문서")) {
            return { skipped: true };
          }
          throw new Error(error.detail || "문서 저장 실패");
        }
        return response.json();
      });
    });

    toast.promise(
      Promise.all(savePromises),
      {
        loading: `${successFiles.length}개 문서 저장 중...`,
        success: (results) => {
          const saved = results.filter((r: SaveResult) => !r.skipped).length;
          const skipped = results.filter((r: SaveResult) => r.skipped).length;
          return `${saved}개 저장 완료${skipped > 0 ? `, ${skipped}개 이미 저장됨` : ''}!`;
        },
        error: "일부 문서 저장에 실패했습니다.",
      }
    );
  };

  const successCount = files.filter(f => f.status === "success").length;
  const errorCount = files.filter(f => f.status === "error").length;
  const pendingCount = files.filter(f => f.status === "pending").length;

  return {
    files,
    processing,
    isDragging,
    parseOptions,
    setParseOptions,
    selectedCategory,
    setSelectedCategory,
    isStopRequested,
    successCount,
    errorCount,
    pendingCount,
    handleFileChange,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    removeFile,
    handleProcess,
    handleStopParsing,
    handleRestartFailed,
    handleReset,
    downloadAll,
    handleSaveDocument,
    handleSaveAllDocuments,
  };
}
