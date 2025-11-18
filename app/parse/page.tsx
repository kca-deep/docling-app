"use client";

import { useState } from "react";
import { Upload, FileText, Loader2, CheckCircle2, XCircle, Download, Trash2, FolderOpen, Save, Settings, Zap, Sparkles, Image, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { API_BASE_URL } from "@/lib/api-config";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { PageContainer } from "@/components/page-container";
import { Label } from "@/components/ui/label";
import { MarkdownMessage } from "@/components/markdown-message";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface ConvertResult {
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

interface ProgressInfo {
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

interface ParseOptions {
  strategy: "docling" | "qwen3-vl";
  do_ocr: boolean;
  do_table_structure: boolean;
  include_images: boolean;
  do_formula_enrichment: boolean;
}

interface FileStatus {
  file: File;
  status: "pending" | "processing" | "success" | "error";
  progress: number;
  result?: ConvertResult;
  progressInfo?: ProgressInfo;  // qwen3-vl 진행률 정보
  pollingInterval?: NodeJS.Timeout;  // polling interval ID
}

interface SaveResult {
  skipped?: boolean;
}

export default function ParsePage() {
  // 일괄 파일 상태
  const [files, setFiles] = useState<FileStatus[]>([]);
  const [processing, setProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // 공통 옵션 상태
  const [parseOptions, setParseOptions] = useState<ParseOptions>({
    strategy: "docling",
    do_ocr: true,
    do_table_structure: true,
    include_images: true,
    do_formula_enrichment: false,
  });

  // Dialog 상태
  const [selectedResult, setSelectedResult] = useState<FileStatus | null>(null);

  // 일괄 파일 핸들러
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files).map(file => ({
        file,
        status: "pending" as const,
        progress: 0,
      }));
      setFiles(prev => [...prev, ...newFiles]);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (processing) return;

    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles && droppedFiles.length > 0) {
      const newFiles = Array.from(droppedFiles).map(file => ({
        file,
        status: "pending" as const,
        progress: 0,
      }));
      setFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const processFile = async (fileStatus: FileStatus, index: number): Promise<void> => {
    setFiles(prev => prev.map((f, i) =>
      i === index ? { ...f, status: "processing", progress: 10 } : f
    ));

    try {
      const formData = new FormData();
      formData.append("file", fileStatus.file);
      formData.append("strategy", parseOptions.strategy);
      formData.append("do_ocr", parseOptions.do_ocr.toString());
      formData.append("do_table_structure", parseOptions.do_table_structure.toString());
      formData.append("include_images", parseOptions.include_images.toString());
      formData.append("do_formula_enrichment", parseOptions.do_formula_enrichment.toString());

      setFiles(prev => prev.map((f, i) =>
        i === index ? { ...f, progress: 30 } : f
      ));

      const response = await fetch(`${API_BASE_URL}/api/documents/convert`, {
        method: "POST",
        body: formData,
      });

      console.log(`[Batch] Response status for file ${index}:`, response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Batch] API error for file ${index}:`, errorText);
        throw new Error(`API 호출 실패: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log(`[Batch] File ${index} convert result:`, result);
      console.log(`[Batch] Result status:`, result.status);
      console.log(`[Batch] Is Qwen3-VL?`, parseOptions.strategy === "qwen3-vl");

      // qwen3-vl의 경우 status가 "processing"이면 polling 시작
      if (result.status === "processing" && parseOptions.strategy === "qwen3-vl") {
        console.log(`[Batch] Starting polling for file ${index}, task_id:`, result.task_id);

        setFiles(prev => prev.map((f, i) =>
          i === index ? { ...f, result, progress: 50 } : f
        ));

        // polling 시작
        await pollBatchProgress(result.task_id, index);
      } else if (result.status === "success") {
        // docling 등 동기 처리는 바로 완료
        setFiles(prev => prev.map((f, i) =>
          i === index ? {
            ...f,
            status: "success",
            progress: 100,
            result
          } : f
        ));
      } else {
        // 에러 처리
        setFiles(prev => prev.map((f, i) =>
          i === index ? {
            ...f,
            status: "error",
            progress: 100,
            result
          } : f
        ));
      }
    } catch (err) {
      console.error(`[Batch] Error processing file ${index}:`, err);
      const errorMessage = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다";
      toast.error(`파일 "${fileStatus.file.name}" 파싱 실패: ${errorMessage}`);
      setFiles(prev => prev.map((f, i) =>
        i === index ? {
          ...f,
          status: "error",
          progress: 100,
          result: {
            task_id: "",
            status: "failure",
            error: errorMessage
          }
        } : f
      ));
    }
  };

  // 일괄 파싱용 진행률 polling
  const pollBatchProgress = async (taskId: string, index: number): Promise<void> => {
    return new Promise((resolve) => {
      const pollInterval = setInterval(async () => {
        try {
          const response = await fetch(`${API_BASE_URL}/api/documents/progress/${taskId}`);

          if (response.ok) {
            const progressData: ProgressInfo = await response.json();
            console.log(`[Batch] Progress for file ${index}:`, progressData);

            // 진행률 업데이트
            setFiles(prev => prev.map((f, i) =>
              i === index ? {
                ...f,
                progressInfo: progressData,
                progress: Math.min(50 + progressData.progress_percentage / 2, 99)  // 50-99% 범위
              } : f
            ));

            // 완료 시
            if (progressData.status === "completed") {
              clearInterval(pollInterval);
              setFiles(prev => prev.map((f, i) =>
                i === index ? {
                  ...f,
                  status: "success",
                  progress: 100,
                  result: {
                    task_id: taskId,
                    status: "success",
                    document: {
                      filename: progressData.filename,
                      md_content: progressData.md_content,
                      processing_time: progressData.processing_time
                    },
                    processing_time: progressData.processing_time
                  }
                } : f
              ));
              resolve();
            } else if (progressData.status === "failed") {
              clearInterval(pollInterval);
              setFiles(prev => prev.map((f, i) =>
                i === index ? {
                  ...f,
                  status: "error",
                  progress: 100,
                  result: {
                    task_id: taskId,
                    status: "failure",
                    error: progressData.error_message || "파싱 실패"
                  }
                } : f
              ));
              resolve();
            }
          } else if (response.status === 404) {
            console.warn(`[Batch] Progress not found for task ${taskId}, stopping polling`);
            clearInterval(pollInterval);
            resolve();
          }
        } catch (err) {
          console.error(`[Batch] Error polling progress for file ${index}:`, err);
        }
      }, 2000);  // 2초마다 polling
    });
  };

  const handleProcess = async () => {
    setProcessing(true);

    for (let i = 0; i < files.length; i++) {
      if (files[i].status === "pending") {
        await processFile(files[i], i);
      }
    }

    setProcessing(false);
    toast.success("일괄 파싱이 완료되었습니다!");
  };

  const handleReset = () => {
    setFiles([]);
  };

  const downloadAll = () => {
    files.forEach(fileStatus => {
      if (fileStatus.status === "success" && fileStatus.result?.document?.md_content) {
        const blob = new Blob([fileStatus.result.document.md_content], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${fileStatus.result.document.filename}.md`;
        a.click();
        URL.revokeObjectURL(url);
      }
    });
    toast.success("모든 파일이 다운로드되었습니다!");
  };

  const handleSaveDocument = async (fileStatus: FileStatus) => {
    if (!fileStatus.result?.document?.md_content) return;

    const saveRequest = {
      task_id: fileStatus.result.task_id,
      original_filename: fileStatus.result.document.filename,
      file_size: fileStatus.file.size,
      file_type: fileStatus.file.name.split('.').pop() || '',
      md_content: fileStatus.result.document.md_content,
      processing_time: fileStatus.result.processing_time,
      parse_options: parseOptions,
    };

    toast.promise(
      fetch(`${API_BASE_URL}/api/documents/save`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(saveRequest),
      }).then(async (response) => {
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.detail || "문서 저장에 실패했습니다");
        }
        return response.json();
      }),
      {
        loading: "문서 저장 중...",
        success: `"${fileStatus.result.document.filename}" 저장 완료!`,
        error: (err) => err.message || "문서 저장에 실패했습니다.",
      }
    );
  };

  const handleSaveAllDocuments = async () => {
    const successFiles = files.filter(f => f.status === "success" && f.result?.document?.md_content);

    if (successFiles.length === 0) return;

    const savePromises = successFiles.map(fileStatus => {
      const saveRequest = {
        task_id: fileStatus.result!.task_id,
        original_filename: fileStatus.result!.document!.filename,
        file_size: fileStatus.file.size,
        file_type: fileStatus.file.name.split('.').pop() || '',
        md_content: fileStatus.result!.document!.md_content!,
        processing_time: fileStatus.result!.processing_time,
        parse_options: parseOptions,
      };

      return fetch(`${API_BASE_URL}/api/documents/save`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(saveRequest),
      }).then(async (response) => {
        if (!response.ok) {
          const error = await response.json();
          if (error.detail?.includes("이미 저장된 문서")) {
            return { skipped: true };
          }
          throw new Error(error.detail || "문서 저장 실패");
        }
        return response.json();
      });
    });

    toast.promise(
      Promise.all(savePromises),
      {
        loading: `${successFiles.length}개 문서 저장 중...`,
        success: (results) => {
          const saved = results.filter((r: SaveResult) => !r.skipped).length;
          const skipped = results.filter((r: SaveResult) => r.skipped).length;
          return `${saved}개 저장 완료${skipped > 0 ? `, ${skipped}개 이미 저장됨` : ''}!`;
        },
        error: "일부 문서 저장에 실패했습니다.",
      }
    );
  };

  const successCount = files.filter(f => f.status === "success").length;
  const errorCount = files.filter(f => f.status === "error").length;
  const pendingCount = files.filter(f => f.status === "pending").length;

  return (
    <PageContainer maxWidth="wide" className="py-4">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-4">
        {/* Left Column: File Upload (70%) */}
        <div className="space-y-4">
          {/* File Upload Card */}
        <Card className="min-w-0 overflow-hidden">
          <CardHeader>
            <CardTitle>파일 업로드</CardTitle>
            <CardDescription>변환할 문서 파일을 선택하세요 (다중 선택 가능)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragging
                  ? "border-primary bg-primary/10"
                  : "border-muted-foreground/25 hover:border-primary/50"
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <input
                type="file"
                id="file-upload"
                className="hidden"
                accept=".pdf,.docx,.doc,.pptx,.ppt"
                onChange={handleFileChange}
                multiple
                disabled={processing}
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer flex flex-col items-center space-y-3"
              >
                <FolderOpen className={`w-12 h-12 ${isDragging ? "text-primary" : "text-muted-foreground"}`} />
                <div>
                  <p className="text-base font-medium">
                    파일 선택 또는 드래그 앤 드롭
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    PDF, DOCX, PPTX (다중 선택 가능)
                  </p>
                </div>
              </label>
            </div>

            {files.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">
                    선택된 파일 ({files.length}개)
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleReset}
                    disabled={processing}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    전체 삭제
                  </Button>
                </div>

                <ScrollArea className={`w-full rounded-lg border ${files.length <= 3 ? 'h-auto max-h-64' : 'h-64'}`}>
                  <div className="p-4 space-y-2">
                    {files.map((fileStatus, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-muted rounded-lg"
                      >
                        <div className="flex items-center space-x-3 flex-1 min-w-0">
                          <div className="flex-shrink-0">
                            {fileStatus.status === "pending" && (
                              <FileText className="w-5 h-5 text-muted-foreground" />
                            )}
                            {fileStatus.status === "processing" && (
                              <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                            )}
                            {fileStatus.status === "success" && (
                              <CheckCircle2 className="w-5 h-5 text-green-500" />
                            )}
                            {fileStatus.status === "error" && (
                              <XCircle className="w-5 h-5 text-red-500" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{fileStatus.file.name}</p>
                            <div className="flex items-center gap-2">
                              <p className="text-xs text-muted-foreground">
                                {(fileStatus.file.size / 1024 / 1024).toFixed(2)} MB
                              </p>
                              {/* qwen3-vl 진행률 표시 */}
                              {fileStatus.progressInfo && fileStatus.status === "processing" && (
                                <p className="text-xs text-blue-600 dark:text-blue-400">
                                  • 페이지 {fileStatus.progressInfo.current_page}/{fileStatus.progressInfo.total_pages} ({fileStatus.progressInfo.progress_percentage}%)
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Badge variant={
                              fileStatus.status === "success" ? "default" :
                              fileStatus.status === "error" ? "destructive" :
                              fileStatus.status === "processing" ? "secondary" :
                              "outline"
                            }>
                              {fileStatus.status === "pending" && "대기"}
                              {fileStatus.status === "processing" && "처리중"}
                              {fileStatus.status === "success" && "완료"}
                              {fileStatus.status === "error" && "실패"}
                            </Badge>
                            {(fileStatus.status === "success" || fileStatus.status === "error") && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2"
                                onClick={() => setSelectedResult(fileStatus)}
                              >
                                <Eye className="w-3.5 h-3.5 mr-1" />
                                결과
                              </Button>
                            )}
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 ml-2 flex-shrink-0"
                          onClick={() => removeFile(index)}
                          disabled={processing}
                        >
                          <XCircle className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>

                {processing && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>전체 진행률</span>
                      <span className="font-medium">
                        {successCount + errorCount} / {files.length}
                      </span>
                    </div>
                    <Progress
                      value={((successCount + errorCount) / files.length) * 100}
                      className="h-2"
                    />
                  </div>
                )}

                {!processing && (successCount > 0 || errorCount > 0) && (
                  <div className="flex gap-4 text-sm">
                    {successCount > 0 && (
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        <span>성공: {successCount}개</span>
                      </div>
                    )}
                    {errorCount > 0 && (
                      <div className="flex items-center gap-2">
                        <XCircle className="w-4 h-4 text-red-500" />
                        <span>실패: {errorCount}개</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-3">
                  <Button
                    onClick={handleProcess}
                    disabled={files.length === 0 || processing || pendingCount === 0}
                    className="flex-1"
                    size="lg"
                  >
                    {processing ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>파싱 중... ({successCount + errorCount}/{files.length})</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-5 h-5" />
                        <span>파싱 시작</span>
                      </>
                    )}
                  </Button>
                  {successCount > 0 && !processing && (
                    <>
                      <Button
                        variant="outline"
                        onClick={handleSaveAllDocuments}
                        size="lg"
                      >
                        <Save className="w-5 h-5" />
                        전체 저장
                      </Button>
                      <Button
                        variant="outline"
                        onClick={downloadAll}
                        size="lg"
                      >
                        <Download className="w-5 h-5" />
                        전체 다운로드
                      </Button>
                    </>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        </div>

        {/* Right Column: Parsing Options (30%) - Sticky */}
        <div className="lg:sticky lg:top-4 lg:self-start">
          <Card className="min-w-0 overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Settings className="w-4 h-4" />
                파싱 옵션
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Parsing Strategy Selection - Compact Select */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">파싱 전략</Label>
                <Select
                  value={parseOptions.strategy}
                  onValueChange={(value: "docling" | "qwen3-vl") =>
                    setParseOptions({ ...parseOptions, strategy: value })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="docling">
                      <div className="flex items-center gap-2">
                        <Zap className="w-3.5 h-3.5" />
                        <span>Docling</span>
                        <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                          빠름
                        </Badge>
                      </div>
                    </SelectItem>
                    <SelectItem value="qwen3-vl">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Qwen3-VL</span>
                        <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                          AI
                        </Badge>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Advanced Options - Inline Checkboxes */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">상세 옵션</Label>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="do_ocr"
                      checked={parseOptions.do_ocr}
                      onCheckedChange={(checked) =>
                        setParseOptions({ ...parseOptions, do_ocr: checked as boolean })
                      }
                    />
                    <Label htmlFor="do_ocr" className="text-sm font-normal cursor-pointer">
                      OCR 인식
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="do_table_structure"
                      checked={parseOptions.do_table_structure}
                      onCheckedChange={(checked) =>
                        setParseOptions({ ...parseOptions, do_table_structure: checked as boolean })
                      }
                    />
                    <Label htmlFor="do_table_structure" className="text-sm font-normal cursor-pointer">
                      테이블 구조
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="include_images"
                      checked={parseOptions.include_images}
                      onCheckedChange={(checked) =>
                        setParseOptions({ ...parseOptions, include_images: checked as boolean })
                      }
                    />
                    <Label htmlFor="include_images" className="text-sm font-normal cursor-pointer">
                      이미지 포함
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="do_formula_enrichment"
                      checked={parseOptions.do_formula_enrichment}
                      onCheckedChange={(checked) =>
                        setParseOptions({ ...parseOptions, do_formula_enrichment: checked as boolean })
                      }
                    />
                    <Label htmlFor="do_formula_enrichment" className="text-sm font-normal cursor-pointer">
                      수식 인식
                    </Label>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Result Dialog */}
        <Dialog open={!!selectedResult} onOpenChange={(open) => !open && setSelectedResult(null)}>
          <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                {selectedResult?.status === "success" ? (
                  <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                )}
                <span className="truncate">{selectedResult?.file.name}</span>
                {selectedResult?.result?.processing_time && (
                  <Badge variant="outline" className="flex-shrink-0">
                    {selectedResult.result.processing_time.toFixed(2)}초
                  </Badge>
                )}
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-hidden">
              {selectedResult?.status === "success" && selectedResult.result?.document ? (
                <div className="h-full flex flex-col space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">파일명</span>
                      <span className="font-medium">{selectedResult.result.document.filename}</span>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Task ID</span>
                      <Badge variant="outline">{selectedResult.result.task_id}</Badge>
                    </div>
                    {selectedResult.result.document.md_content && (
                      <>
                        <Separator />
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">문자 수</span>
                          <Badge>{selectedResult.result.document.md_content.length.toLocaleString()}</Badge>
                        </div>
                      </>
                    )}
                  </div>

                  {selectedResult.result.document.md_content && (
                    <Tabs defaultValue="preview" className="flex-1 flex flex-col">
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="preview">미리보기</TabsTrigger>
                        <TabsTrigger value="full">전체 내용</TabsTrigger>
                      </TabsList>
                      <TabsContent value="preview" className="flex-1 mt-4 space-y-4">
                        <ScrollArea className="h-[calc(85vh-350px)] w-full rounded-lg border bg-muted/50">
                          <div className="p-4">
                            <MarkdownMessage
                              content={
                                selectedResult.result.document.md_content.substring(0, 2000) +
                                (selectedResult.result.document.md_content.length > 2000
                                  ? "\n\n... (내용이 잘렸습니다. '전체 내용' 탭을 확인하세요)"
                                  : "")
                              }
                            />
                          </div>
                        </ScrollArea>
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => selectedResult && handleSaveDocument(selectedResult)}
                          >
                            <Save className="w-4 h-4 mr-2" />
                            문서 저장
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              if (selectedResult?.result?.document?.md_content) {
                                const blob = new Blob([selectedResult.result.document.md_content], { type: 'text/markdown' });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = `${selectedResult.result.document.filename}.md`;
                                a.click();
                                URL.revokeObjectURL(url);
                              }
                            }}
                          >
                            <Download className="w-4 h-4 mr-2" />
                            다운로드
                          </Button>
                        </div>
                      </TabsContent>
                      <TabsContent value="full" className="flex-1 mt-4 space-y-4">
                        <ScrollArea className="h-[calc(85vh-350px)] w-full rounded-lg border bg-muted/50">
                          <div className="p-4">
                            <MarkdownMessage content={selectedResult.result.document.md_content} />
                          </div>
                        </ScrollArea>
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => selectedResult && handleSaveDocument(selectedResult)}
                          >
                            <Save className="w-4 h-4 mr-2" />
                            문서 저장
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              if (selectedResult?.result?.document?.md_content) {
                                const blob = new Blob([selectedResult.result.document.md_content], { type: 'text/markdown' });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = `${selectedResult.result.document.filename}.md`;
                                a.click();
                                URL.revokeObjectURL(url);
                              }
                            }}
                          >
                            <Download className="w-4 h-4 mr-2" />
                            다운로드
                          </Button>
                        </div>
                      </TabsContent>
                    </Tabs>
                  )}
                </div>
              ) : (
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertTitle>파싱 실패</AlertTitle>
                  <AlertDescription>
                    {selectedResult?.result?.error || "알 수 없는 오류가 발생했습니다"}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </DialogContent>
        </Dialog>
    </PageContainer>
  );
}
