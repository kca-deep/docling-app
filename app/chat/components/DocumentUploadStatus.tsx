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
 * 처리 단계 정의 (순서대로)
 */
const PROCESSING_STEPS: { stage: ProcessingStage; label: string; shortLabel: string }[] = [
  { stage: "uploading", label: "업로드", shortLabel: "업로드" },
  { stage: "parsing", label: "파싱", shortLabel: "파싱" },
  { stage: "chunking", label: "청킹", shortLabel: "청킹" },
  { stage: "embedding", label: "임베딩", shortLabel: "임베딩" },
  { stage: "indexing", label: "인덱싱", shortLabel: "인덱싱" },
  { stage: "ready", label: "완료", shortLabel: "완료" },
];

/**
 * 단계 인덱스 반환
 */
function getStageIndex(stage: ProcessingStage): number {
  if (stage === "error") return -1;
  const index = PROCESSING_STEPS.findIndex((s) => s.stage === stage);
  return index;
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
 * 스테퍼 컴포넌트
 */
function ProcessingStepper({ currentStage }: { currentStage: ProcessingStage }) {
  const currentIndex = getStageIndex(currentStage);

  return (
    <div className="flex items-center justify-between w-full gap-0.5">
      {PROCESSING_STEPS.map((step, index) => {
        let status: "completed" | "active" | "pending" = "pending";
        if (index < currentIndex) status = "completed";
        else if (index === currentIndex) status = "active";

        const isLast = index === PROCESSING_STEPS.length - 1;

        return (
          <div key={step.stage} className="flex items-center flex-1 last:flex-none">
            {/* 스텝 */}
            <div className="flex flex-col items-center gap-0.5">
              <StepIcon status={status} isActive={index === currentIndex} />
              <span
                className={cn(
                  "text-[9px] font-medium whitespace-nowrap",
                  status === "completed" && "text-green-600",
                  status === "active" && "text-primary",
                  status === "pending" && "text-muted-foreground/50"
                )}
              >
                {step.shortLabel}
              </span>
            </div>

            {/* 연결선 */}
            {!isLast && (
              <div
                className={cn(
                  "flex-1 h-0.5 mx-0.5 rounded-full transition-colors",
                  index < currentIndex ? "bg-green-500" : "bg-muted-foreground/20"
                )}
              />
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
 * - 단계별 스테퍼 UI
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
    <div className="bg-muted/50 rounded-xl border border-border/50 overflow-hidden animate-in slide-in-from-bottom-2 duration-300">
      {/* 상단: 파일 정보 + 닫기 버튼 */}
      <div className="flex items-center gap-3 px-3 py-2 border-b border-border/30">
        {/* 파일 아이콘 */}
        <FileIconBadge
          filename={isMultiFile ? "files.zip" : currentFilename}
          size="sm"
        />

        {/* 파일명/상태 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate">
              {isMultiFile
                ? `${status.totalFiles}개 파일`
                : currentFilename}
            </span>
            {isReady && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-600 font-medium">
                준비 완료
              </span>
            )}
            {hasError && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive font-medium">
                오류
              </span>
            )}
          </div>
          {isMultiFile && isProcessing && (
            <div className="text-[10px] text-muted-foreground">
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
          className="h-6 w-6 flex-shrink-0 hover:bg-destructive/10 hover:text-destructive"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>

      {/* 중간: 스테퍼 UI (처리 중일 때만) */}
      {isProcessing && (
        <div className="px-3 py-2.5 bg-background/50">
          <ProcessingStepper currentStage={status.stage} />
        </div>
      )}

      {/* 하단: 다중 파일 진행 상태 또는 완료/오류 메시지 */}
      <div className="px-3 py-2">
        {isProcessing && isMultiFile && (
          <MultiFileProgress status={status} />
        )}

        {isProcessing && !isMultiFile && (
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>처리 중...</span>
            <span className="font-medium text-primary">{status.progress}%</span>
          </div>
        )}

        {isReady && (
          <div className="flex items-center gap-2 text-xs text-green-600">
            <CheckCircle className="h-3.5 w-3.5" />
            <span>
              {status.pageCount > 0 && `${status.pageCount}페이지 `}
              문서 준비 완료 - 질문을 입력하세요
            </span>
          </div>
        )}

        {hasError && status.error && (
          <div className="flex items-center gap-2 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="truncate">{status.error}</span>
          </div>
        )}
      </div>
    </div>
  );
}
