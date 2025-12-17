"use client";

import { Files, X, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FileIcon, FileIconBadge, getFileIconInfo } from "../utils/file-icons";

interface DocumentActiveCardProps {
  /** 파일명 목록 */
  filenames: string[];
  /** 페이지 수 (선택적) */
  pageCount?: number;
  /** 삭제 콜백 */
  onRemove: () => void;
}

/**
 * 활성 문서 카드 컴포넌트 (MessageList 내 표시용)
 *
 * - 사용자 메시지 스타일 (우측 정렬)
 * - 다중 파일 지원
 * - 파일 유형별 아이콘
 * - 삭제 버튼 포함
 */
export function DocumentActiveCard({
  filenames,
  pageCount,
  onRemove,
}: DocumentActiveCardProps) {
  const isMultiFile = filenames.length > 1;
  const firstFilename = filenames[0] || "";

  return (
    <div className="py-3 sm:py-4 first:pt-0">
      {/* 우측 정렬 (사용자 메시지 스타일) */}
      <div className="flex justify-end">
        <div
          className={cn(
            "flex flex-col gap-1.5 sm:gap-2 max-w-[calc(100%-1rem)] sm:max-w-[85%] md:max-w-[70%]",
            "animate-in fade-in slide-in-from-right-2 duration-300"
          )}
        >
          {/* 메인 카드 */}
          <div
            className={cn(
              "flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 rounded-2xl rounded-br-md",
              "bg-primary text-primary-foreground",
              "shadow-sm"
            )}
          >
            {/* 파일 아이콘 - 모바일에서 숨김 */}
            {isMultiFile ? (
              <div className="hidden sm:flex -space-x-1.5 flex-shrink-0">
                {filenames.slice(0, 3).map((name, i) => (
                  <div
                    key={i}
                    className="relative w-6 h-6 rounded bg-primary-foreground/20 flex items-center justify-center"
                    style={{ zIndex: 3 - i }}
                  >
                    <FileIcon filename={name} size="sm" className="text-primary-foreground" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="hidden sm:flex w-8 h-8 rounded-lg bg-primary-foreground/20 items-center justify-center flex-shrink-0">
                <FileIcon filename={firstFilename} size="sm" className="text-primary-foreground" />
              </div>
            )}

            {/* 텍스트 정보 */}
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-xs sm:text-sm font-medium truncate">
                {isMultiFile
                  ? `${filenames.length}개 파일`
                  : firstFilename.length > 20
                    ? firstFilename.slice(0, 17) + "..."
                    : firstFilename}
              </span>
              <span className="text-[10px] sm:text-xs text-primary-foreground/70">
                {pageCount !== undefined && pageCount > 0 && `${pageCount}p · `}
                준비 완료
              </span>
            </div>

            {/* 완료 체크 */}
            <CheckCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary-foreground/80 flex-shrink-0" />

            {/* 삭제 버튼 */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onRemove}
              className="h-5 w-5 sm:h-6 sm:w-6 flex-shrink-0 hover:bg-primary-foreground/20 text-primary-foreground/70 hover:text-primary-foreground"
            >
              <X className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
            </Button>
          </div>

          {/* 다중 파일 목록 (우측 정렬) - 모바일에서 숨김 */}
          {isMultiFile && filenames.length <= 5 && (
            <div className="hidden sm:flex flex-wrap justify-end gap-1.5">
              {filenames.map((name, i) => {
                const info = getFileIconInfo(name);
                const Icon = info.icon;
                return (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs bg-muted/80 text-muted-foreground"
                  >
                    <Icon className="h-3 w-3 flex-shrink-0" style={{ color: info.color }} />
                    <span className="truncate max-w-[100px]">{name}</span>
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
