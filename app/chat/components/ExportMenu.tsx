"use client";

import { useState } from "react";
import {
  Download,
  FileSpreadsheet,
  FileText,
  Copy,
  Loader2,
  File,
  FileCode,
  Text,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { API_BASE_URL } from "@/lib/api-config";
import type { CodeExecution } from "../types";

type ExportType = "excel" | "docx" | "pdf" | "md" | "txt";

interface ExportMenuProps {
  messageContent: string;
  messageId: string;
  codeExecutions?: CodeExecution[];
  disabled?: boolean;
}

/**
 * 데이터 분석 결과(코드+실행결과+해석)를 하나의 마크다운 문서로 조합
 * codeExecutions가 없으면 messageContent를 그대로 반환
 */
function buildExportContent(
  messageContent: string,
  codeExecutions?: CodeExecution[]
): string {
  if (!codeExecutions || codeExecutions.length === 0) {
    return messageContent;
  }

  // 성공한 실행만 포함 (없으면 코드가 있는 마지막 실행)
  const successfulExecs = codeExecutions.filter((e) => e.status === "success");
  const targetExecs =
    successfulExecs.length > 0
      ? successfulExecs
      : codeExecutions.filter((e) => e.code);

  if (targetExecs.length === 0) {
    return messageContent;
  }

  const parts: string[] = [];

  for (const exec of targetExecs) {
    if (exec.code) {
      parts.push("## 분석 코드\n");
      parts.push("```python");
      parts.push(exec.code);
      parts.push("```\n");
    }

    if (exec.stdout && exec.stdout.trim()) {
      parts.push("## 실행 결과\n");
      parts.push(exec.stdout);
      parts.push("");
    }

    if (exec.images && exec.images.length > 0) {
      parts.push(
        `> 차트 ${exec.images.length}개가 생성되었습니다.\n`
      );
    }
  }

  if (messageContent.trim()) {
    parts.push("## 분석\n");
    parts.push(messageContent);
  }

  return parts.join("\n");
}

const EXPORT_OPTIONS: {
  type: ExportType;
  label: string;
  icon: typeof FileSpreadsheet;
  color: string;
  endpoint: string;
  extension: string;
}[] = [
  {
    type: "excel",
    label: "Excel",
    icon: FileSpreadsheet,
    color: "text-green-600",
    endpoint: "/api/chat/export/excel",
    extension: "xlsx",
  },
  {
    type: "docx",
    label: "Word",
    icon: FileText,
    color: "text-blue-600",
    endpoint: "/api/chat/export/docx",
    extension: "docx",
  },
  {
    type: "pdf",
    label: "PDF",
    icon: File,
    color: "text-red-600",
    endpoint: "/api/chat/export/pdf",
    extension: "pdf",
  },
  {
    type: "md",
    label: "MD",
    icon: FileCode,
    color: "text-purple-600",
    endpoint: "/api/chat/export/md",
    extension: "md",
  },
  {
    type: "txt",
    label: "Text",
    icon: Text,
    color: "text-gray-600",
    endpoint: "/api/chat/export/txt",
    extension: "txt",
  },
];

export function ExportMenu({
  messageContent,
  messageId,
  codeExecutions,
  disabled = false,
}: ExportMenuProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportType, setExportType] = useState<ExportType | null>(null);
  const [open, setOpen] = useState(false);

  const handleExport = async (type: ExportType) => {
    const exportContent = buildExportContent(messageContent, codeExecutions);

    if (!exportContent.trim()) {
      toast.error("내보낼 내용이 없습니다.");
      return;
    }

    const option = EXPORT_OPTIONS.find((o) => o.type === type);
    if (!option) return;

    setIsExporting(true);
    setExportType(type);

    try {
      const response = await fetch(`${API_BASE_URL}${option.endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          content: exportContent,
          filename: `chat_export_${messageId}`,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `내보내기 실패: ${response.status}`);
      }

      const data = await response.json();

      if (data.file_id) {
        const downloadUrl = `${API_BASE_URL}/api/chat/export/download/${data.file_id}`;
        const downloadResponse = await fetch(downloadUrl, {
          credentials: "include",
        });

        if (!downloadResponse.ok) {
          throw new Error("파일 다운로드 실패");
        }

        const blob = await downloadResponse.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = data.filename || `export.${option.extension}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        toast.success("다운로드 완료", {
          description: data.filename,
        });
        setOpen(false);
      }
    } catch (error) {
      console.error("Export error:", error);
      toast.error("내보내기 실패", {
        description: error instanceof Error ? error.message : "알 수 없는 오류",
      });
    } finally {
      setIsExporting(false);
      setExportType(null);
    }
  };

  const handleCopy = async () => {
    const exportContent = buildExportContent(messageContent, codeExecutions);

    if (!exportContent.trim()) {
      toast.error("복사할 내용이 없습니다.");
      return;
    }

    try {
      await navigator.clipboard.writeText(exportContent);
      toast.success("클립보드에 복사되었습니다.");
      setOpen(false);
    } catch (error) {
      console.error("Copy error:", error);
      toast.error("복사 실패");
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          disabled={disabled || isExporting}
          title="내보내기"
        >
          {isExporting ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Download className="h-3 w-3" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="left"
        align="end"
        className="w-auto p-2"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <TooltipProvider delayDuration={300}>
          <div className="flex items-center gap-1">
            {EXPORT_OPTIONS.map((option) => {
              const Icon = option.icon;
              const isLoading = exportType === option.type;

              return (
                <Tooltip key={option.type}>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 gap-1.5"
                      onClick={() => handleExport(option.type)}
                      disabled={isExporting}
                    >
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Icon className={`h-4 w-4 ${option.color}`} />
                      )}
                      <span className="text-xs">{option.label}</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    {option.label} 형식으로 저장
                  </TooltipContent>
                </Tooltip>
              );
            })}

            {/* 구분선 */}
            <div className="w-px h-5 bg-border mx-1" />

            {/* 복사 버튼 */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleCopy}
                  disabled={isExporting}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                클립보드에 복사
              </TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </PopoverContent>
    </Popover>
  );
}
