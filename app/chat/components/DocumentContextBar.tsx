"use client";

import { Files, X, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { FileIcon } from "../utils/file-icons";
import type { ProcessingStage } from "../hooks/useDocumentUpload";

interface DocumentContextBarProps {
  /** 파일명 목록 */
  filenames: string[];
  /** 페이지 수 */
  pageCount?: number;
  /** 처리 진행 중 여부 */
  isProcessing: boolean;
  /** 진행률 (0-100) */
  progress?: number;
  /** 현재 처리 단계 */
  stage?: ProcessingStage;
  /** 에러 메시지 */
  error?: string | null;
  /** 삭제 콜백 */
  onRemove: () => void;
}

/**
 * 처리 단계별 표시 텍스트
 */
function getStageText(stage?: ProcessingStage): string {
  switch (stage) {
    case "uploading":
      return "업로드 중";
    case "parsing":
      return "문서 분석 중";
    case "chunking":
      return "청크 분할 중";
    case "embedding":
      return "임베딩 생성 중";
    case "indexing":
      return "인덱싱 중";
    case "ready":
      return "준비 완료";
    case "error":
      return "오류 발생";
    default:
      return "처리 중";
  }
}

/**
 * 문서 컨텍스트 바 컴포넌트
 *
 * 입력창 상단에 고정 표시되어 현재 업로드/처리 상태를 보여줍니다.
 * - 진행 중: 프로그레스 바 + 단계 텍스트
 * - 완료: 준비완료 배지
 * - 에러: 에러 메시지 표시
 */
export function DocumentContextBar({
  filenames,
  pageCount,
  isProcessing,
  progress = 0,
  stage,
  error,
  onRemove,
}: DocumentContextBarProps) {
  const fileCount = filenames.length;
  const isMultiFile = fileCount > 1;
  const firstFilename = filenames[0] || "";
  const hasError = stage === "error" || !!error;
  const isReady = stage === "ready" && !isProcessing;

  // 파일명 truncate
  const displayFilename = isMultiFile
    ? `${fileCount}개 파일`
    : firstFilename.length > 25
      ? firstFilename.slice(0, 22) + "..."
      : firstFilename;

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 px-4 py-2.5",
        "bg-muted/40 backdrop-blur-sm",
        "border-b",
        hasError ? "border-destructive/30 bg-destructive/5" : "border-border/40",
        "animate-in slide-in-from-bottom-2 duration-200"
      )}
    >
      {/* 좌측: 파일 정보 */}
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        {/* 파일 아이콘 */}
        <div className="flex-shrink-0">
          {isMultiFile ? (
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Files className="h-4 w-4 text-primary" />
            </div>
          ) : (
            <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
              <FileIcon filename={firstFilename} size="sm" />
            </div>
          )}
        </div>

        {/* 파일명 + 상태 */}
        <div className="flex flex-col min-w-0 gap-0.5">
          <span className="text-sm font-medium truncate">
            {displayFilename}
          </span>
          <span className={cn(
            "text-xs",
            hasError ? "text-destructive" : "text-muted-foreground"
          )}>
            {hasError ? (
              <span className="flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {error || "처리 중 오류 발생"}
              </span>
            ) : isReady ? (
              pageCount ? `${pageCount}페이지 · 질문을 입력하세요` : "질문을 입력하세요"
            ) : (
              <span className="flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                {getStageText(stage)}
                {progress > 0 && ` ${progress}%`}
              </span>
            )}
          </span>
        </div>
      </div>

      {/* 우측: 상태 표시 + 삭제 버튼 */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* 진행 바 또는 완료 배지 */}
        {isProcessing && !hasError ? (
          <div className="hidden sm:block w-20">
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        ) : isReady ? (
          <Badge
            variant="outline"
            className="hidden sm:flex items-center gap-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-xs"
          >
            <CheckCircle className="h-3 w-3" />
            준비완료
          </Badge>
        ) : hasError ? (
          <Badge
            variant="outline"
            className="hidden sm:flex items-center gap-1 bg-destructive/10 text-destructive border-destructive/30 text-xs"
          >
            <AlertCircle className="h-3 w-3" />
            오류
          </Badge>
        ) : null}

        {/* 삭제 버튼 */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onRemove}
          className="h-7 w-7 hover:bg-destructive/10 hover:text-destructive transition-colors"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
