"use client";

import { Files, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { FileIcon, getFileIconInfo } from "../utils/file-icons";

interface ActiveDocumentBadgeProps {
  /** 파일명 목록 */
  filenames: string[];
  /** 페이지 수 (선택적) */
  pageCount?: number;
  /** 삭제 콜백 */
  onRemove: () => void;
}

/**
 * 활성 문서 배지 컴포넌트
 *
 * - 현재 채팅에 연결된 업로드 문서 표시 (다중 파일 지원)
 * - 파일 유형별 색상 아이콘
 * - 삭제 버튼 포함
 */
export function ActiveDocumentBadge({
  filenames,
  pageCount,
  onRemove,
}: ActiveDocumentBadgeProps) {
  const isMultiFile = filenames.length > 1;
  const firstFilename = filenames[0] || "";

  // 긴 파일명 축약
  const displayName = isMultiFile
    ? `${filenames.length}개 파일`
    : firstFilename.length > 20
      ? firstFilename.slice(0, 17) + "..."
      : firstFilename;

  // 단일 파일일 경우 해당 파일의 색상 사용
  const iconInfo = !isMultiFile ? getFileIconInfo(firstFilename) : null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="secondary"
            className="gap-1.5 pl-2 pr-1 py-1 h-auto max-w-[200px] hover:bg-secondary/80 transition-colors cursor-default"
            style={
              iconInfo
                ? { backgroundColor: iconInfo.bgColor, borderColor: `${iconInfo.color}30` }
                : undefined
            }
          >
            {isMultiFile ? (
              <Files className="h-3 w-3 flex-shrink-0 text-primary" />
            ) : (
              <FileIcon filename={firstFilename} size="sm" />
            )}
            <span className="truncate text-xs font-normal">{displayName}</span>
            {pageCount !== undefined && pageCount > 0 && (
              <span className="text-xs text-muted-foreground">
                ({pageCount}p)
              </span>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              className="h-4 w-4 ml-0.5 hover:bg-destructive/20 hover:text-destructive"
            >
              <X className="h-2.5 w-2.5" />
            </Button>
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[250px]">
          {isMultiFile ? (
            <>
              <p className="font-medium mb-1">{filenames.length}개 파일</p>
              <ul className="space-y-1">
                {filenames.slice(0, 5).map((name, i) => {
                  const info = getFileIconInfo(name);
                  const Icon = info.icon;
                  return (
                    <li key={i} className="flex items-center gap-1.5 text-xs">
                      <Icon className="h-3 w-3 flex-shrink-0" style={{ color: info.color }} />
                      <span className="truncate">{name}</span>
                    </li>
                  );
                })}
                {filenames.length > 5 && (
                  <li className="text-xs text-muted-foreground">
                    ... 외 {filenames.length - 5}개
                  </li>
                )}
              </ul>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <FileIcon filename={firstFilename} size="sm" />
              <span className="font-medium">{firstFilename}</span>
            </div>
          )}
          {pageCount !== undefined && pageCount > 0 && (
            <p className="text-xs text-muted-foreground mt-1.5 pt-1.5 border-t border-border/50">
              {pageCount}페이지 | 클릭하여 제거
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
