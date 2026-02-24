export interface ConvertResult {
  task_id: string;
  status: string;
  document?: {
    filename: string;
    md_content?: string;
    processing_time?: number;
  };
  error?: string;
  processing_time?: number;
}

export interface ProgressInfo {
  task_id: string;
  filename: string;
  status: "processing" | "completed" | "failed";
  current_page: number;
  total_pages: number;
  progress_percentage: number;
  elapsed_time: number;
  estimated_remaining_time?: number;
  error_message?: string;
  updated_at: string;
  md_content?: string;
  processing_time?: number;
}

export interface ParseOptions {
  strategy: "docling" | "qwen3-vl";
  do_ocr: boolean;
  do_table_structure: boolean;
  include_images: boolean;
  do_formula_enrichment: boolean;
}

export interface FileStatus {
  file: File;
  status: "pending" | "processing" | "success" | "error";
  progress: number;
  result?: ConvertResult;
  progressInfo?: ProgressInfo;
  pollingInterval?: NodeJS.Timeout;
}

export interface SaveResult {
  skipped?: boolean;
}
