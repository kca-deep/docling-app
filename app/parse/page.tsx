"use client";

import { useState, useEffect } from "react";
import { Upload, FileText, Loader2, CheckCircle2, XCircle, Download, Trash2, FolderOpen, Save, Settings, Files, Zap, Shield, Sparkles, Layout, Image } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { PageContainer } from "@/components/page-container";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { MarkdownMessage } from "@/components/markdown-message";

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
  // 단일 파일 상태
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ConvertResult | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [progressInfo, setProgressInfo] = useState<ProgressInfo | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  // 일괄 파일 상태
  const [files, setFiles] = useState<FileStatus[]>([]);
  const [processing, setProcessing] = useState(false);
  const [isBatchDragging, setIsBatchDragging] = useState(false);

  // 공통 옵션 상태
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);
  const [parseOptions, setParseOptions] = useState<ParseOptions>({
    strategy: "docling",
    do_ocr: true,
    do_table_structure: true,
    include_images: true,
    do_formula_enrichment: false,
  });

  // 진행률 polling useEffect
  useEffect(() => {
    if (!isPolling || !result?.task_id) {
      return;
    }

    const pollProgress = async () => {
      try {
        console.log("Polling progress for task_id:", result.task_id);
        const response = await fetch(`http://localhost:8000/api/documents/progress/${result.task_id}`);

        if (response.ok) {
          const data: ProgressInfo = await response.json();
          console.log("Progress data received:", data);
          setProgressInfo(data);

          // 완료 시 result를 업데이트하고 polling 중지
          if (data.status === "completed") {
            setIsPolling(false);
            setLoading(false);
            setResult({
              task_id: data.task_id,
              status: "success",
              document: {
                filename: data.filename,
                md_content: data.md_content,
                processing_time: data.processing_time
              },
              processing_time: data.processing_time
            });
            toast.success("문서 파싱이 완료되었습니다!");
          } else if (data.status === "failed") {
            setIsPolling(false);
            setLoading(false);
            setResult({
              task_id: data.task_id,
              status: "failure",
              error: data.error_message || "파싱에 실패했습니다"
            });
            toast.error(data.error_message || "파싱에 실패했습니다");
          }
        } else if (response.status === 404) {
          // 진행률 정보가 없으면 polling 중지
          setIsPolling(false);
          setLoading(false);
        }
      } catch (err) {
        console.error("진행률 조회 실패:", err);
      }
    };

    // 즉시 한 번 실행
    pollProgress();

    // 2초마다 polling
    const intervalId = setInterval(pollProgress, 2000);

    // cleanup: 컴포넌트 언마운트 또는 polling 중지 시 interval 제거
    return () => {
      clearInterval(intervalId);
    };
  }, [isPolling, result?.task_id]);

  // 단일 파일 핸들러
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setResult(null);
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

    if (loading) return;

    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles && droppedFiles[0]) {
      setFile(droppedFiles[0]);
      setResult(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setResult(null);
    setProgressInfo(null);

    // qwen3-vl 전략이면 polling 시작
    if (parseOptions.strategy === "qwen3-vl") {
      setIsPolling(true);
    }

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("strategy", parseOptions.strategy);
      formData.append("do_ocr", String(parseOptions.do_ocr));
      formData.append("do_table_structure", String(parseOptions.do_table_structure));
      formData.append("include_images", String(parseOptions.include_images));
      formData.append("do_formula_enrichment", String(parseOptions.do_formula_enrichment));

      const response = await fetch("http://localhost:8000/api/documents/convert", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`API 호출 실패: ${response.status}`);
      }

      const data: ConvertResult = await response.json();
      console.log("Convert API response:", data);
      console.log("Current strategy:", parseOptions.strategy);
      console.log("isPolling will be:", parseOptions.strategy === "qwen3-vl");
      setResult(data);

      if (data.status === "success") {
        toast.success("문서 파싱이 완료되었습니다!");
        setLoading(false);
        setIsPolling(false);
      } else if (data.status === "processing") {
        // qwen3-vl의 경우 백그라운드 처리 중
        // loading은 true 유지, polling이 계속됨
        console.log("Status is processing, keeping loading=true and isPolling=true");
        toast.info("문서 파싱을 시작했습니다. 진행률을 확인하세요.");
      } else {
        toast.error(data.error || "파싱에 실패했습니다");
        setLoading(false);
        setIsPolling(false);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다");
      setResult({
        task_id: "",
        status: "failure",
        error: err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다",
      });
      setLoading(false);
      setIsPolling(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setResult(null);
    setProgressInfo(null);
    setIsPolling(false);
  };

  const handleSaveDocument = async () => {
    if (!result?.document?.md_content || !file) return;

    const saveRequest = {
      task_id: result.task_id,
      original_filename: result.document.filename,
      file_size: file.size,
      file_type: file.name.split('.').pop() || '',
      md_content: result.document.md_content,
      processing_time: result.processing_time,
      parse_options: parseOptions,
    };

    toast.promise(
      fetch("http://localhost:8000/api/documents/save", {
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
        success: "문서가 성공적으로 저장되었습니다!",
        error: (err) => err.message || "문서 저장에 실패했습니다.",
      }
    );
  };

  // 일괄 파일 핸들러
  const handleBatchFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files).map(file => ({
        file,
        status: "pending" as const,
        progress: 0,
      }));
      setFiles(prev => [...prev, ...newFiles]);
    }
  };

  const handleBatchDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsBatchDragging(true);
  };

  const handleBatchDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsBatchDragging(false);
  };

  const handleBatchDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsBatchDragging(false);

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

      const response = await fetch("http://localhost:8000/api/documents/convert", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`API 호출 실패: ${response.status}`);
      }

      const result = await response.json();
      console.log(`[Batch] File ${index} convert result:`, result);

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
      setFiles(prev => prev.map((f, i) =>
        i === index ? {
          ...f,
          status: "error",
          progress: 100,
          result: {
            task_id: "",
            status: "failure",
            error: err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다"
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
          const response = await fetch(`http://localhost:8000/api/documents/progress/${taskId}`);

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

  const handleBatchProcess = async () => {
    setProcessing(true);

    for (let i = 0; i < files.length; i++) {
      if (files[i].status === "pending") {
        await processFile(files[i], i);
      }
    }

    setProcessing(false);
    toast.success("일괄 파싱이 완료되었습니다!");
  };

  const handleBatchReset = () => {
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

  const handleSaveBatchDocument = async (fileStatus: FileStatus) => {
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
      fetch("http://localhost:8000/api/documents/save", {
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

      return fetch("http://localhost:8000/api/documents/save", {
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
    <PageContainer maxWidth="wide" className="py-6">
      <div className="space-y-6">
        {/* Parsing Options Section */}
        <Card className="min-w-0 overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              파싱 옵션
            </CardTitle>
            <CardDescription>문서 파싱 시 적용할 옵션을 설정하세요</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Parsing Strategy Selection */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">파싱 전략</Label>
              <RadioGroup
                value={parseOptions.strategy}
                onValueChange={(value: "docling" | "qwen3-vl") =>
                  setParseOptions({ ...parseOptions, strategy: value })
                }
                className="grid grid-cols-2 gap-3"
              >
                <div className="relative">
                  <RadioGroupItem
                    value="docling"
                    id="strategy-docling"
                    className="peer sr-only"
                  />
                  <Label
                    htmlFor="strategy-docling"
                    className="flex flex-col gap-2 rounded-lg border-2 border-muted bg-muted/30 p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 cursor-pointer transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                        <span className="text-sm font-semibold">Docling</span>
                      </div>
                      <Badge variant="secondary" className="text-xs font-normal bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        빠름
                      </Badge>
                    </div>
                    <ul className="text-xs text-muted-foreground space-y-1.5">
                      <li className="flex items-center gap-2">
                        <Zap className="w-3 h-3 flex-shrink-0" />
                        <span>빠른 처리 속도 및 안정성</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <FileText className="w-3 h-3 flex-shrink-0" />
                        <span>일반 PDF, DOCX 문서 최적화</span>
                      </li>
                    </ul>
                  </Label>
                </div>
                <div className="relative">
                  <RadioGroupItem
                    value="qwen3-vl"
                    id="strategy-qwen3-vl"
                    className="peer sr-only"
                  />
                  <Label
                    htmlFor="strategy-qwen3-vl"
                    className="flex flex-col gap-2 rounded-lg border-2 border-muted bg-muted/30 p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 cursor-pointer transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                        <span className="text-sm font-semibold">Qwen3-VL</span>
                      </div>
                      <Badge variant="secondary" className="text-xs font-normal bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                        보통
                      </Badge>
                    </div>
                    <ul className="text-xs text-muted-foreground space-y-1.5">
                      <li className="flex items-center gap-2">
                        <Sparkles className="w-3 h-3 flex-shrink-0" />
                        <span>AI 기반 고급 문서 분석</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Image className="w-3 h-3 flex-shrink-0" />
                        <span>복잡한 레이아웃 및 이미지 특화</span>
                      </li>
                    </ul>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Collapsible Advanced Options */}
            <Collapsible open={isOptionsOpen} onOpenChange={setIsOptionsOpen}>
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full flex items-center justify-between p-2 hover:bg-accent hover:text-accent-foreground"
                >
                  <span className="text-sm font-medium">상세 옵션</span>
                  <ChevronDown
                    className={`w-4 h-4 transition-transform duration-200 ${
                      isOptionsOpen ? "rotate-180" : ""
                    }`}
                  />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-3">
                <div className="grid grid-cols-4 gap-3">
                  <div className="flex items-center justify-between p-2.5 rounded-lg border bg-muted/30">
                    <Label htmlFor="do_ocr" className="text-sm cursor-pointer">
                      OCR 인식
                    </Label>
                    <Switch
                      id="do_ocr"
                      checked={parseOptions.do_ocr}
                      onCheckedChange={(checked) =>
                        setParseOptions({ ...parseOptions, do_ocr: checked })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-lg border bg-muted/30">
                    <Label htmlFor="do_table_structure" className="text-sm cursor-pointer">
                      테이블 구조
                    </Label>
                    <Switch
                      id="do_table_structure"
                      checked={parseOptions.do_table_structure}
                      onCheckedChange={(checked) =>
                        setParseOptions({ ...parseOptions, do_table_structure: checked })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-lg border bg-muted/30">
                    <Label htmlFor="include_images" className="text-sm cursor-pointer">
                      이미지 포함
                    </Label>
                    <Switch
                      id="include_images"
                      checked={parseOptions.include_images}
                      onCheckedChange={(checked) =>
                        setParseOptions({ ...parseOptions, include_images: checked })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-lg border bg-muted/30">
                    <Label htmlFor="do_formula_enrichment" className="text-sm cursor-pointer">
                      수식 인식
                    </Label>
                    <Switch
                      id="do_formula_enrichment"
                      checked={parseOptions.do_formula_enrichment}
                      onCheckedChange={(checked) =>
                        setParseOptions({ ...parseOptions, do_formula_enrichment: checked })
                      }
                    />
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </CardContent>
        </Card>

        {/* Main Tabs - Single File vs Batch */}
        <Tabs defaultValue="single" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="single">
              <FileText className="w-4 h-4 mr-2" />
              단일 파일
            </TabsTrigger>
            <TabsTrigger value="batch">
              <Files className="w-4 h-4 mr-2" />
              일괄 파싱
            </TabsTrigger>
          </TabsList>

          {/* Single File Tab */}
          <TabsContent value="single" className="space-y-6 mt-6">
            <Card className="min-w-0 overflow-hidden">
              <CardHeader>
                <CardTitle>파일 업로드</CardTitle>
                <CardDescription>변환할 문서 파일을 선택하세요</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                {(!result || result.status === "processing") ? (
                  <>
                  <form onSubmit={handleSubmit} className="space-y-6">
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
                        disabled={loading}
                      />
                      <label
                        htmlFor="file-upload"
                        className="cursor-pointer flex flex-col items-center space-y-3"
                      >
                        <Upload className={`w-12 h-12 ${isDragging ? "text-primary" : "text-muted-foreground"}`} />
                        <div>
                          <p className="text-base font-medium">
                            파일 선택 또는 드래그 앤 드롭
                          </p>
                          <p className="text-sm text-muted-foreground mt-2">
                            PDF, DOCX, PPTX
                          </p>
                        </div>
                      </label>
                    </div>

                    {file && (
                      <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div className="flex items-center space-x-2">
                          <FileText className="w-4 h-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">{file.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {(file.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={handleReset}
                        >
                          <XCircle className="w-4 h-4" />
                        </Button>
                      </div>
                    )}

                    <Button
                      type="submit"
                      disabled={!file || loading}
                      className="w-full"
                      size="lg"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span>파싱 중...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-5 h-5" />
                          <span>문서 파싱 시작</span>
                        </>
                      )}
                    </Button>
                  </form>

                  {/* 진행률 표시 (form 밖으로 이동하여 리렌더링 보장) */}
                  {/* 디버깅: 조건 체크 */}
                  {console.log("🔍 Progress Box Debug (OUTSIDE FORM):", {
                    loading,
                    hasProgressInfo: !!progressInfo,
                    strategy: parseOptions.strategy,
                    shouldShow: loading && !!progressInfo && parseOptions.strategy === "qwen3-vl",
                    progressInfo
                  })}

                  {/* 항상 표시하는 임시 디버깅 박스 */}
                  {loading && parseOptions.strategy === "qwen3-vl" && !progressInfo && (
                    <div className="space-y-3 mt-4 p-4 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg border border-yellow-300 dark:border-yellow-700">
                      <div className="flex items-center gap-2 text-sm text-yellow-800 dark:text-yellow-200">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>진행률 정보를 불러오는 중... (progressInfo is null)</span>
                      </div>
                    </div>
                  )}

                  {loading && progressInfo && parseOptions.strategy === "qwen3-vl" && (
                    <div className="space-y-3 mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border-2 border-blue-300 dark:border-blue-700"
                      style={{
                        minHeight: '120px',
                        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                      }}
                    >
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{progressInfo.filename}</span>
                        <span className="text-muted-foreground">
                          페이지 {progressInfo.current_page} / {progressInfo.total_pages}
                        </span>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>진행률: {progressInfo.progress_percentage}%</span>
                          <span>
                            {progressInfo.estimated_remaining_time !== null && progressInfo.estimated_remaining_time !== undefined
                              ? `예상 남은 시간: ${Math.ceil(progressInfo.estimated_remaining_time)}초`
                              : "예상 시간 계산 중..."}
                          </span>
                        </div>
                        <Progress value={progressInfo.progress_percentage} className="h-2" />
                      </div>

                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>
                          {progressInfo.status === "processing"
                            ? `페이지 ${progressInfo.current_page} 처리 중...`
                            : "처리 중..."}
                        </span>
                      </div>
                    </div>
                  )}
                  </>
                ) : (
                  <div className="space-y-6">
                    {result.status === "success" && (
                      <>
                        <Alert className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
                          <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                          <AlertTitle className="text-green-900 dark:text-green-100">파싱 완료!</AlertTitle>
                          <AlertDescription className="text-green-700 dark:text-green-300">
                            문서가 성공적으로 변환되었습니다. 처리 시간: {result.processing_time?.toFixed(2)}초
                          </AlertDescription>
                        </Alert>

                        {result.document && (
                          <div className="space-y-4 w-full">
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">파일명</span>
                                <span className="font-medium">{result.document.filename}</span>
                              </div>
                              <Separator />
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">Task ID</span>
                                <Badge variant="outline">{result.task_id}</Badge>
                              </div>
                              {result.document.md_content && (
                                <>
                                  <Separator />
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm text-muted-foreground">총 문자 수</span>
                                    <Badge>{result.document.md_content.length.toLocaleString()}</Badge>
                                  </div>
                                </>
                              )}
                            </div>

                            {result.document.md_content && (
                              <div className="space-y-3">
                                <h4 className="text-sm font-medium">변환된 마크다운</h4>
                                <Tabs defaultValue="preview" className="w-full">
                                  <TabsList className="grid w-full grid-cols-2">
                                    <TabsTrigger value="preview">미리보기</TabsTrigger>
                                    <TabsTrigger value="full">전체 내용</TabsTrigger>
                                  </TabsList>
                                  <TabsContent value="preview" className="mt-4 space-y-4">
                                    <ScrollArea className="h-96 w-full rounded-lg border bg-muted/50">
                                      <div className="p-4">
                                        <MarkdownMessage
                                          content={
                                            result.document.md_content.substring(0, 2000) +
                                            (result.document.md_content.length > 2000
                                              ? "\n\n... (내용이 잘렸습니다. '전체 내용' 탭을 확인하세요)"
                                              : "")
                                          }
                                        />
                                      </div>
                                    </ScrollArea>
                                    <div className="flex justify-end gap-2">
                                      <Button variant="outline" size="sm" onClick={handleSaveDocument}>
                                        <Save className="w-4 h-4 mr-2" />
                                        문서 저장
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                          const blob = new Blob([result.document!.md_content!], { type: 'text/markdown' });
                                          const url = URL.createObjectURL(blob);
                                          const a = document.createElement('a');
                                          a.href = url;
                                          a.download = `${result.document!.filename}.md`;
                                          a.click();
                                          URL.revokeObjectURL(url);
                                        }}
                                      >
                                        <Download className="w-4 h-4 mr-2" />
                                        다운로드
                                      </Button>
                                    </div>
                                  </TabsContent>
                                  <TabsContent value="full" className="mt-4 space-y-4">
                                    <ScrollArea className="h-96 w-full rounded-lg border bg-muted/50">
                                      <div className="p-4">
                                        <MarkdownMessage content={result.document.md_content} />
                                      </div>
                                    </ScrollArea>
                                    <div className="flex justify-end gap-2">
                                      <Button variant="outline" size="sm" onClick={handleSaveDocument}>
                                        <Save className="w-4 h-4 mr-2" />
                                        문서 저장
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                          const blob = new Blob([result.document!.md_content!], { type: 'text/markdown' });
                                          const url = URL.createObjectURL(blob);
                                          const a = document.createElement('a');
                                          a.href = url;
                                          a.download = `${result.document!.filename}.md`;
                                          a.click();
                                          URL.revokeObjectURL(url);
                                        }}
                                      >
                                        <Download className="w-4 h-4 mr-2" />
                                        다운로드
                                      </Button>
                                    </div>
                                  </TabsContent>
                                </Tabs>
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}

                    {result.status === "failure" && (
                      <Alert variant="destructive">
                        <XCircle className="h-5 w-5" />
                        <AlertTitle>파싱 실패</AlertTitle>
                        <AlertDescription>
                          {result.error || "알 수 없는 오류가 발생했습니다"}
                        </AlertDescription>
                      </Alert>
                    )}

                    <Button
                      onClick={handleReset}
                      variant="secondary"
                      className="w-full"
                      size="lg"
                    >
                      다른 파일 파싱하기
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Batch Tab */}
          <TabsContent value="batch" className="space-y-6 mt-6">
            <Card className="min-w-0 overflow-hidden">
              <CardHeader>
                <CardTitle>파일 업로드</CardTitle>
                <CardDescription>변환할 문서 파일을 선택하세요 (다중 선택 가능)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                    isBatchDragging
                      ? "border-primary bg-primary/10"
                      : "border-muted-foreground/25 hover:border-primary/50"
                  }`}
                  onDragOver={handleBatchDragOver}
                  onDragLeave={handleBatchDragLeave}
                  onDrop={handleBatchDrop}
                >
                  <input
                    type="file"
                    id="batch-file-upload"
                    className="hidden"
                    accept=".pdf,.docx,.doc,.pptx,.ppt"
                    onChange={handleBatchFileChange}
                    multiple
                    disabled={processing}
                  />
                  <label
                    htmlFor="batch-file-upload"
                    className="cursor-pointer flex flex-col items-center space-y-3"
                  >
                    <FolderOpen className={`w-12 h-12 ${isBatchDragging ? "text-primary" : "text-muted-foreground"}`} />
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
                        onClick={handleBatchReset}
                        disabled={processing}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        전체 삭제
                      </Button>
                    </div>

                    <ScrollArea className="h-64 w-full rounded-lg border">
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
                              <div className="flex-shrink-0">
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
                        onClick={handleBatchProcess}
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
                            <span>일괄 파싱 시작</span>
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

            {files.some(f => f.status === "success" || f.status === "error") && (
              <Card className="min-w-0 overflow-hidden">
                <CardHeader>
                  <CardTitle>파싱 결과</CardTitle>
                  <CardDescription>각 파일의 변환 결과를 확인하세요</CardDescription>
                </CardHeader>
                <CardContent>
                  <Accordion type="single" collapsible className="w-full">
                    {files.map((fileStatus, index) => {
                      if (fileStatus.status !== "success" && fileStatus.status !== "error") {
                        return null;
                      }

                      return (
                        <AccordionItem key={index} value={`item-${index}`}>
                          <AccordionTrigger>
                            <div className="flex items-center gap-3 w-full">
                              {fileStatus.status === "success" ? (
                                <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                              ) : (
                                <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                              )}
                              <span className="truncate text-left flex-1">
                                {fileStatus.file.name}
                              </span>
                              {fileStatus.result?.processing_time && (
                                <Badge variant="outline" className="flex-shrink-0">
                                  {fileStatus.result.processing_time.toFixed(2)}초
                                </Badge>
                              )}
                            </div>
                          </AccordionTrigger>
                          <AccordionContent>
                            {fileStatus.status === "success" && fileStatus.result?.document ? (
                              <div className="space-y-4 pt-4">
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm text-muted-foreground">파일명</span>
                                    <span className="text-sm font-medium">
                                      {fileStatus.result.document.filename}
                                    </span>
                                  </div>
                                  <Separator />
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm text-muted-foreground">Task ID</span>
                                    <Badge variant="outline">{fileStatus.result.task_id}</Badge>
                                  </div>
                                  {fileStatus.result.document.md_content && (
                                    <>
                                      <Separator />
                                      <div className="flex items-center justify-between">
                                        <span className="text-sm text-muted-foreground">문자 수</span>
                                        <Badge>
                                          {fileStatus.result.document.md_content.length.toLocaleString()}
                                        </Badge>
                                      </div>
                                    </>
                                  )}
                                </div>

                                {fileStatus.result.document.md_content && (
                                  <div className="space-y-3">
                                    <h4 className="text-sm font-medium">변환된 마크다운</h4>
                                    <Tabs defaultValue="preview" className="w-full">
                                      <TabsList className="grid w-full grid-cols-2">
                                        <TabsTrigger value="preview">미리보기</TabsTrigger>
                                        <TabsTrigger value="full">전체 내용</TabsTrigger>
                                      </TabsList>
                                      <TabsContent value="preview" className="mt-4 space-y-4">
                                        <ScrollArea className="h-64 w-full rounded-lg border bg-muted/50">
                                          <div className="p-4">
                                            <MarkdownMessage
                                              content={
                                                fileStatus.result.document.md_content.substring(0, 1000) +
                                                (fileStatus.result.document.md_content.length > 1000
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
                                            onClick={() => handleSaveBatchDocument(fileStatus)}
                                          >
                                            <Save className="w-4 h-4 mr-2" />
                                            문서 저장
                                          </Button>
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                              const blob = new Blob(
                                                [fileStatus.result!.document!.md_content!],
                                                { type: 'text/markdown' }
                                              );
                                              const url = URL.createObjectURL(blob);
                                              const a = document.createElement('a');
                                              a.href = url;
                                              a.download = `${fileStatus.result!.document!.filename}.md`;
                                              a.click();
                                              URL.revokeObjectURL(url);
                                            }}
                                          >
                                            <Download className="w-4 h-4 mr-2" />
                                            다운로드
                                          </Button>
                                        </div>
                                      </TabsContent>
                                      <TabsContent value="full" className="mt-4 space-y-4">
                                        <ScrollArea className="h-64 w-full rounded-lg border bg-muted/50">
                                          <div className="p-4">
                                            <MarkdownMessage content={fileStatus.result.document.md_content} />
                                          </div>
                                        </ScrollArea>
                                        <div className="flex justify-end gap-2">
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleSaveBatchDocument(fileStatus)}
                                          >
                                            <Save className="w-4 h-4 mr-2" />
                                            문서 저장
                                          </Button>
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                              const blob = new Blob(
                                                [fileStatus.result!.document!.md_content!],
                                                { type: 'text/markdown' }
                                              );
                                              const url = URL.createObjectURL(blob);
                                              const a = document.createElement('a');
                                              a.href = url;
                                              a.download = `${fileStatus.result!.document!.filename}.md`;
                                              a.click();
                                              URL.revokeObjectURL(url);
                                            }}
                                          >
                                            <Download className="w-4 h-4 mr-2" />
                                            다운로드
                                          </Button>
                                        </div>
                                      </TabsContent>
                                    </Tabs>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <Alert variant="destructive" className="mt-4">
                                <XCircle className="h-4 w-4" />
                                <AlertTitle>파싱 실패</AlertTitle>
                                <AlertDescription>
                                  {fileStatus.result?.error || "알 수 없는 오류가 발생했습니다"}
                                </AlertDescription>
                              </Alert>
                            )}
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </PageContainer>
  );
}
