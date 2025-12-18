"use client";

import { X, Loader2, CheckCircle, AlertCircle, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FileIcon, FileIconBadge } from "../utils/file-icons";
import type { ProcessingStage, UploadStatus } from "../hooks/useDocumentUpload";

interface DocumentUploadStatusProps {
  /** 업로드 상태 */
  status: UploadStatus;
  /** 취소/정리 콜백 */
  onClear: () => void;
}

/**
 * 간소화된 3단계 처리 단계 (업로드 → 처리 중 → 완료)
 */
type SimplifiedStage = "uploading" | "processing" | "ready";

const SIMPLIFIED_STEPS: { stage: SimplifiedStage; label: string }[] = [
  { stage: "uploading", label: "업로드" },
  { stage: "processing", label: "처리 중" },
  { stage: "ready", label: "완료" },
];

/**
 * 원본 단계를 간소화된 단계로 변환
 */
function toSimplifiedStage(stage: ProcessingStage): SimplifiedStage {
  if (stage === "uploading") return "uploading";
  if (stage === "ready") return "ready";
  // parsing, chunking, embedding, indexing, error → processing
  return "processing";
}

/**
 * 간소화된 단계 인덱스 반환
 */
function getSimplifiedStageIndex(stage: ProcessingStage): number {
  const simplified = toSimplifiedStage(stage);
  if (stage === "error") return 1; // 처리 중 단계에서 에러
  return SIMPLIFIED_STEPS.findIndex((s) => s.stage === simplified);
}

/**
 * 개별 스텝 아이콘 컴포넌트
 */
function StepIcon({
  status,
  isActive,
}: {
  status: "completed" | "active" | "pending";
  isActive: boolean;
}) {
  if (status === "completed") {
    return (
      <div className="flex items-center justify-center w-5 h-5 rounded-full bg-green-500 text-white">
        <CheckCircle className="h-3 w-3" />
      </div>
    );
  }

  if (status === "active") {
    return (
      <div className="flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground animate-pulse">
        <Loader2 className="h-3 w-3 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center w-5 h-5 rounded-full border-2 border-muted-foreground/30">
      <Circle className="h-2 w-2 text-muted-foreground/30" />
    </div>
  );
}

/**
 * 간소화된 3단계 스테퍼 컴포넌트 (모바일 반응형)
 */
function ProcessingStepper({ currentStage }: { currentStage: ProcessingStage }) {
  const currentIndex = getSimplifiedStageIndex(currentStage);

  return (
    <div className="flex items-center justify-center gap-1 sm:gap-2">
      {SIMPLIFIED_STEPS.map((step, index) => {
        let status: "completed" | "active" | "pending" = "pending";
        if (index < currentIndex) status = "completed";
        else if (index === currentIndex) status = "active";

        const isLast = index === SIMPLIFIED_STEPS.length - 1;

        return (
          <div key={step.stage} className="flex items-center">
            {/* 스텝 */}
            <div className="flex items-center gap-1 sm:gap-1.5">
              <StepIcon status={status} isActive={index === currentIndex} />
              <span
                className={cn(
                  "text-[10px] sm:text-xs font-medium",
                  status === "completed" && "text-green-600",
                  status === "active" && "text-primary",
                  status === "pending" && "text-muted-foreground/50"
                )}
              >
                {step.label}
              </span>
            </div>

            {/* 연결선 (화살표 스타일) - 모바일에서 축소 */}
            {!isLast && (
              <div className="mx-1 sm:mx-2 text-muted-foreground/40">
                <svg width="8" height="8" viewBox="0 0 12 12" fill="none" className="sm:w-3 sm:h-3">
                  <path
                    d="M4 2L8 6L4 10"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * 다중 파일 진행 상태 표시
 */
function MultiFileProgress({
  status,
}: {
  status: UploadStatus;
}) {
  return (
    <div className="space-y-1.5">
      {status.files.slice(0, 3).map((file, index) => {
        const isCompleted = file.stage === "ready";
        const hasError = file.stage === "error";
        const isProcessing = !isCompleted && !hasError;

        return (
          <div key={index} className="flex items-center gap-2 text-xs">
            <FileIcon filename={file.filename} size="sm" />
            <span className="flex-1 truncate max-w-[120px]">{file.filename}</span>
            <span
              className={cn(
                "text-[10px] font-medium",
                isCompleted && "text-green-600",
                hasError && "text-destructive",
                isProcessing && "text-primary"
              )}
            >
              {isCompleted && "완료"}
              {hasError && "오류"}
              {isProcessing && `${file.progress}%`}
            </span>
          </div>
        );
      })}
      {status.files.length > 3 && (
        <div className="text-[10px] text-muted-foreground">
          ... 외 {status.files.length - 3}개 파일
        </div>
      )}
    </div>
  );
}

/**
 * 문서 업로드 진행 상태 표시 컴포넌트
 *
 * - 사용자 메시지 스타일 (우측 정렬)
 * - 3단계 스테퍼 UI
 * - 다중 파일 지원
 * - 파일 유형별 아이콘
 * - 오류 메시지 표시
 */
export function DocumentUploadStatus({
  status,
  onClear,
}: DocumentUploadStatusProps) {
  const isProcessing = !["ready", "error"].includes(status.stage);
  const isReady = status.stage === "ready";
  const hasError = status.stage === "error";
  const isMultiFile = status.totalFiles > 1;
  const currentFilename = status.filename;

  return (
    <div className="py-3 sm:py-4 first:pt-0">
      {/* 우측 정렬 (사용자 메시지 스타일) */}
      <div className="flex justify-end">
        <div
          className={cn(
            "w-auto max-w-[calc(100%-1rem)] sm:max-w-[85%] md:max-w-[70%]",
            "bg-muted/50 dark:bg-muted/30 rounded-2xl rounded-br-md border border-border/50 overflow-hidden",
            "animate-in fade-in slide-in-from-right-2 duration-300"
          )}
        >
          {/* 상단: 파일 정보 + 닫기 버튼 */}
          <div className="flex items-center gap-2 sm:gap-3 px-2.5 sm:px-3 py-2 border-b border-border/30">
            {/* 파일 아이콘 - 모바일에서 숨김 */}
            <div className="hidden sm:block">
              <FileIconBadge
                filename={isMultiFile ? "files.zip" : currentFilename}
                size="sm"
              />
            </div>

            {/* 파일명/상태 */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="font-medium text-xs sm:text-sm truncate max-w-[120px] sm:max-w-none">
                  {isMultiFile
                    ? `${status.totalFiles}개 파일`
                    : currentFilename}
                </span>
                {hasError && (
                  <span className="text-[9px] sm:text-[10px] px-1 sm:px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive font-medium flex-shrink-0">
                    오류
                  </span>
                )}
              </div>
              {isMultiFile && isProcessing && (
                <div className="text-[9px] sm:text-[10px] text-muted-foreground">
                  {status.completedFiles}/{status.totalFiles} 완료
                </div>
              )}
            </div>

            {/* 닫기 버튼 */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onClear}
              className="h-5 w-5 sm:h-6 sm:w-6 flex-shrink-0 hover:bg-destructive/10 hover:text-destructive"
            >
              <X className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
            </Button>
          </div>

          {/* 중간: 스테퍼 UI (처리 중일 때만) */}
          {isProcessing && (
            <div className="px-2 sm:px-3 py-2 sm:py-2.5 bg-background/30">
              <ProcessingStepper currentStage={status.stage} />
            </div>
          )}

          {/* 하단: 다중 파일 진행 상태 또는 오류 메시지 */}
          <div className="px-2.5 sm:px-3 py-1.5 sm:py-2">
            {isProcessing && isMultiFile && (
              <MultiFileProgress status={status} />
            )}

            {isProcessing && !isMultiFile && (
              <div className="flex items-center justify-between text-[10px] sm:text-xs text-muted-foreground">
                <span>처리 중...</span>
                <span className="font-medium text-primary">{status.progress}%</span>
              </div>
            )}

            {hasError && status.error && (
              <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs text-destructive">
                <AlertCircle className="h-3 w-3 sm:h-3.5 sm:w-3.5 flex-shrink-0" />
                <span className="truncate">{status.error}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
