"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Upload, FileText, Sheet, Presentation } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ALLOWED_EXTENSIONS } from "./DocumentUploadButton";

interface DocumentDropZoneProps {
  /** 파일 드롭 콜백 */
  onFileDrop: (files: File[]) => void;
  /** 비활성화 여부 */
  disabled?: boolean;
  /** 자식 컴포넌트 */
  children: React.ReactNode;
  /** 클래스명 */
  className?: string;
}

/**
 * 문서 드래그 앤 드롭 영역 컴포넌트
 *
 * - 파일 드래그 시 풀스크린 뿌연 오버레이 표시
 * - 파일 유형별 아이콘 표시
 * - 애니메이션 효과
 * - 허용 확장자만 필터링
 */
export function DocumentDropZone({
  onFileDrop,
  disabled = false,
  children,
  className = "",
}: DocumentDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);

  // 드래그 이벤트 핸들러
  const handleDragEnter = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (disabled) return;

      dragCounterRef.current++;
      if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
        setIsDragging(true);
      }
    },
    [disabled]
  );

  const handleDragLeave = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (disabled) return;

      dragCounterRef.current--;
      if (dragCounterRef.current === 0) {
        setIsDragging(false);
      }
    },
    [disabled]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    },
    []
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      dragCounterRef.current = 0;

      if (disabled) return;

      const files = e.dataTransfer.files;
      if (!files || files.length === 0) return;

      const validFiles: File[] = [];
      const invalidFiles: string[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const ext = "." + file.name.split(".").pop()?.toLowerCase();
        if (ALLOWED_EXTENSIONS.includes(ext)) {
          validFiles.push(file);
        } else {
          invalidFiles.push(file.name);
        }
      }

      if (invalidFiles.length > 0) {
        toast.error("지원하지 않는 파일 형식", {
          description: invalidFiles.length === 1
            ? `"${invalidFiles[0]}"은(는) 업로드할 수 없습니다.`
            : `${invalidFiles.slice(0, 3).join(", ")}${invalidFiles.length > 3 ? ` 외 ${invalidFiles.length - 3}개` : ""} 파일`,
          action: {
            label: "지원 형식 보기",
            onClick: () => {
              toast.info("지원되는 파일 형식", {
                description: ALLOWED_EXTENSIONS.join(", "),
                duration: 5000,
              });
            },
          },
        });
      }

      if (validFiles.length > 0) {
        onFileDrop(validFiles);
      }
    },
    [disabled, onFileDrop]
  );

  // 전역 드래그 이벤트 (창 밖으로 나갔다 오면 초기화)
  useEffect(() => {
    const handleWindowDragLeave = (e: DragEvent) => {
      if (e.clientX === 0 && e.clientY === 0) {
        setIsDragging(false);
        dragCounterRef.current = 0;
      }
    };

    window.addEventListener("dragleave", handleWindowDragLeave);
    return () => window.removeEventListener("dragleave", handleWindowDragLeave);
  }, []);

  return (
    <div
      className={cn("relative", className)}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {children}

      {/* 뿌연 오버레이 (Full-screen Blur Overlay) */}
      {isDragging && !disabled && (
        <div
          className={cn(
            "fixed inset-0 z-[9999] flex items-center justify-center",
            "bg-background/80 backdrop-blur-lg",
            "animate-in fade-in duration-200"
          )}
        >
          {/* 드롭 영역 컨테이너 */}
          <div
            className={cn(
              "relative flex flex-col items-center gap-6 p-10",
              "bg-background/60 backdrop-blur-sm",
              "border-2 border-dashed border-primary/60 rounded-3xl",
              "shadow-2xl shadow-primary/20",
              "animate-pulse"
            )}
          >
            {/* 글로우 효과 */}
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-primary/10 via-transparent to-primary/5" />

            {/* 메인 아이콘 */}
            <div className="relative">
              <div className="absolute inset-0 bg-primary/30 rounded-full blur-2xl scale-150" />
              <div
                className={cn(
                  "relative p-6 rounded-full",
                  "bg-gradient-to-br from-primary/30 to-primary/10",
                  "border-2 border-primary/40"
                )}
              >
                <Upload className="h-12 w-12 text-primary animate-bounce" />
              </div>
            </div>

            {/* 텍스트 */}
            <div className="relative text-center space-y-2">
              <p className="text-2xl font-bold text-foreground">
                파일을 여기에 놓으세요
              </p>
              <p className="text-sm text-muted-foreground">
                문서를 드롭하여 AI와 대화하세요
              </p>
            </div>

            {/* 지원 파일 형식 아이콘들 */}
            <div className="relative flex items-center gap-6 mt-2">
              <div className="flex flex-col items-center gap-1.5 transition-transform hover:scale-110">
                <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30">
                  <FileText className="h-6 w-6 text-red-500" />
                </div>
                <span className="text-xs font-medium text-muted-foreground">PDF</span>
              </div>
              <div className="flex flex-col items-center gap-1.5 transition-transform hover:scale-110">
                <div className="p-3 rounded-xl bg-blue-500/15 border border-blue-500/30">
                  <FileText className="h-6 w-6 text-blue-500" />
                </div>
                <span className="text-xs font-medium text-muted-foreground">DOCX</span>
              </div>
              <div className="flex flex-col items-center gap-1.5 transition-transform hover:scale-110">
                <div className="p-3 rounded-xl bg-green-500/15 border border-green-500/30">
                  <Sheet className="h-6 w-6 text-green-500" />
                </div>
                <span className="text-xs font-medium text-muted-foreground">XLSX</span>
              </div>
              <div className="flex flex-col items-center gap-1.5 transition-transform hover:scale-110">
                <div className="p-3 rounded-xl bg-orange-500/15 border border-orange-500/30">
                  <Presentation className="h-6 w-6 text-orange-500" />
                </div>
                <span className="text-xs font-medium text-muted-foreground">PPTX</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
