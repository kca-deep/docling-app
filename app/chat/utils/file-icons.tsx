"use client";

import { FileText, Sheet, Presentation, File } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * 파일 유형별 아이콘 및 색상 정보
 */
export interface FileIconInfo {
  icon: LucideIcon;
  color: string;
  bgColor: string;
  label: string;
}

/**
 * 파일 확장자에서 아이콘 정보 반환
 */
export function getFileIconInfo(filename: string): FileIconInfo {
  const ext = getFileExtension(filename).toLowerCase();

  switch (ext) {
    case ".pdf":
      return {
        icon: FileText,
        color: "#EF4444", // red-500
        bgColor: "rgba(239, 68, 68, 0.1)",
        label: "PDF",
      };
    case ".doc":
    case ".docx":
      return {
        icon: FileText,
        color: "#3B82F6", // blue-500
        bgColor: "rgba(59, 130, 246, 0.1)",
        label: "Word",
      };
    case ".xls":
    case ".xlsx":
      return {
        icon: Sheet,
        color: "#22C55E", // green-500
        bgColor: "rgba(34, 197, 94, 0.1)",
        label: "Excel",
      };
    case ".ppt":
    case ".pptx":
      return {
        icon: Presentation,
        color: "#F97316", // orange-500
        bgColor: "rgba(249, 115, 22, 0.1)",
        label: "PowerPoint",
      };
    default:
      return {
        icon: File,
        color: "#6B7280", // gray-500
        bgColor: "rgba(107, 114, 128, 0.1)",
        label: "File",
      };
  }
}

/**
 * 파일명에서 확장자 추출
 */
export function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf(".");
  if (lastDot === -1) return "";
  return filename.slice(lastDot);
}

/**
 * 파일 유형 라벨 반환
 */
export function getFileTypeLabel(filename: string): string {
  return getFileIconInfo(filename).label;
}

/**
 * 파일 아이콘 컴포넌트
 */
interface FileIconProps {
  filename: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function FileIcon({ filename, className = "", size = "md" }: FileIconProps) {
  const { icon: Icon, color } = getFileIconInfo(filename);

  const sizeClasses = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  };

  return <Icon className={`${sizeClasses[size]} ${className}`} style={{ color }} />;
}

/**
 * 파일 아이콘 배지 컴포넌트 (배경색 포함)
 */
interface FileIconBadgeProps {
  filename: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function FileIconBadge({ filename, className = "", size = "md" }: FileIconBadgeProps) {
  const { icon: Icon, color, bgColor } = getFileIconInfo(filename);

  const sizeClasses = {
    sm: "h-6 w-6",
    md: "h-8 w-8",
    lg: "h-10 w-10",
  };

  const iconSizes = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  };

  return (
    <div
      className={`flex items-center justify-center rounded-lg ${sizeClasses[size]} ${className}`}
      style={{ backgroundColor: bgColor }}
    >
      <Icon className={iconSizes[size]} style={{ color }} />
    </div>
  );
}
