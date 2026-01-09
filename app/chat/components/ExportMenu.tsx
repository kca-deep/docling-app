"use client";

import { useState } from "react";
import { Download, FileSpreadsheet, FileText, Copy, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { API_BASE_URL } from "@/lib/api-config";

interface ExportMenuProps {
  messageContent: string;
  messageId: string;
  disabled?: boolean;
}

export function ExportMenu({ messageContent, messageId, disabled = false }: ExportMenuProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportType, setExportType] = useState<string | null>(null);

  const handleExport = async (type: "excel" | "docx") => {
    if (!messageContent.trim()) {
      toast.error("내보낼 내용이 없습니다.");
      return;
    }

    setIsExporting(true);
    setExportType(type);

    try {
      const endpoint = type === "excel"
        ? "/api/chat/export/excel"
        : "/api/chat/export/docx";

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          content: messageContent,
          filename: `chat_export_${messageId}`,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `내보내기 실패: ${response.status}`);
      }

      const data = await response.json();

      if (data.file_id) {
        // 파일 다운로드 트리거
        const downloadUrl = `${API_BASE_URL}/api/chat/export/download/${data.file_id}`;
        const downloadResponse = await fetch(downloadUrl, { credentials: "include" });

        if (!downloadResponse.ok) {
          throw new Error("파일 다운로드 실패");
        }

        const blob = await downloadResponse.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = data.filename || `export.${type === "excel" ? "xlsx" : "docx"}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        toast.success("다운로드 완료", {
          description: data.filename,
        });
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
    if (!messageContent.trim()) {
      toast.error("복사할 내용이 없습니다.");
      return;
    }

    try {
      await navigator.clipboard.writeText(messageContent);
      toast.success("클립보드에 복사되었습니다.");
    } catch (error) {
      console.error("Copy error:", error);
      toast.error("복사 실패");
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
          disabled={disabled || isExporting}
          title="내보내기"
        >
          {isExporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>내보내기</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => handleExport("excel")}
          disabled={isExporting}
        >
          {exportType === "excel" ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <FileSpreadsheet className="mr-2 h-4 w-4" />
          )}
          Excel로 다운로드
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleExport("docx")}
          disabled={isExporting}
        >
          {exportType === "docx" ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <FileText className="mr-2 h-4 w-4" />
          )}
          Word로 다운로드
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleCopy} disabled={isExporting}>
          <Copy className="mr-2 h-4 w-4" />
          클립보드에 복사
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
