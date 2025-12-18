"use client";

import { useRef, useCallback } from "react";
import { Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface DocumentUploadButtonProps {
  /** 업로드 진행 중 여부 */
  isUploading: boolean;
  /** 문서 준비 완료 여부 */
  isReady: boolean;
  /** 파일 선택 콜백 (단일 또는 다중) */
  onFileSelect: (files: File[]) => void;
  /** 비활성화 여부 */
  disabled?: boolean;
  /** 클래스명 */
  className?: string;
  /** 다중 파일 선택 허용 */
  multiple?: boolean;
}

/** 허용되는 파일 확장자 (엑셀 포함) */
export const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".doc", ".pptx", ".ppt", ".xlsx", ".xls"];

/**
 * 문서 업로드 버튼 컴포넌트
 *
 * - 파일 선택 input 트리거
 * - 허용 확장자 필터링
 * - 업로드 상태에 따른 비활성화
 */
export function DocumentUploadButton({
  isUploading,
  isReady,
  onFileSelect,
  disabled = false,
  className = "",
  multiple = true,
}: DocumentUploadButtonProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const fileList = event.target.files;
      if (!fileList || fileList.length === 0) return;

      const validFiles: File[] = [];
      const invalidFiles: string[] = [];

      // 모든 파일 검증
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        const ext = "." + file.name.split(".").pop()?.toLowerCase();
        if (ALLOWED_EXTENSIONS.includes(ext)) {
          validFiles.push(file);
        } else {
          invalidFiles.push(file.name);
        }
      }

      // 유효하지 않은 파일이 있으면 toast 경고
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

      // 유효한 파일만 전달
      if (validFiles.length > 0) {
        onFileSelect(validFiles);
      }

      // input 초기화 (같은 파일 재선택 허용)
      event.target.value = "";
    },
    [onFileSelect]
  );

  const isDisabled = disabled || isUploading;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleClick}
              disabled={isDisabled}
              className={`h-8 w-8 ${isReady ? "text-primary" : ""} ${className}`}
            >
              <Paperclip className="h-4 w-4" />
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept={ALLOWED_EXTENSIONS.join(",")}
              onChange={handleFileChange}
              multiple={multiple}
              className="hidden"
            />
          </div>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p>
            {isUploading
              ? "문서 처리 중..."
              : isReady
              ? "다른 문서 업로드"
              : "문서 첨부 (PDF, DOCX, PPTX, Excel)"}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
