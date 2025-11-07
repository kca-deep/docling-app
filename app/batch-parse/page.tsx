"use client";

import { useState } from "react";
import { Upload, FileText, Loader2, CheckCircle2, XCircle, Download, Trash2, FolderOpen, Save, Settings } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";

interface FileStatus {
  file: File;
  status: "pending" | "processing" | "success" | "error";
  progress: number;
  result?: {
    task_id: string;
    document?: {
      filename: string;
      md_content?: string;
      processing_time?: number;
    };
    error?: string;
    processing_time?: number;
  };
}

interface ParseOptions {
  to_formats: string;
  do_ocr: boolean;
  do_table_structure: boolean;
  include_images: boolean;
  table_mode: string;
  image_export_mode: string;
  page_range_start: number;
  page_range_end: number;
  do_formula_enrichment: boolean;
  pipeline: string;
}

export default function BatchParsePage() {
  const [files, setFiles] = useState<FileStatus[]>([]);
  const [processing, setProcessing] = useState(false);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

  // 파싱 옵션 상태
  const [parseOptions, setParseOptions] = useState<ParseOptions>({
    to_formats: "md",
    do_ocr: true,
    do_table_structure: true,
    include_images: true,
    table_mode: "accurate",
    image_export_mode: "embedded",
    page_range_start: 1,
    page_range_end: 9223372036854776000,
    do_formula_enrichment: false,
    pipeline: "standard",
  });

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

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const processFile = async (fileStatus: FileStatus, index: number): Promise<void> => {
    // Update status to processing
    setFiles(prev => prev.map((f, i) =>
      i === index ? { ...f, status: "processing", progress: 10 } : f
    ));

    try {
      const formData = new FormData();
      formData.append("file", fileStatus.file);
      formData.append("to_formats", parseOptions.to_formats);
      formData.append("do_ocr", parseOptions.do_ocr.toString());
      formData.append("do_table_structure", parseOptions.do_table_structure.toString());
      formData.append("include_images", parseOptions.include_images.toString());
      formData.append("table_mode", parseOptions.table_mode);
      formData.append("image_export_mode", parseOptions.image_export_mode);
      formData.append("page_range_start", parseOptions.page_range_start.toString());
      formData.append("page_range_end", parseOptions.page_range_end.toString());
      formData.append("do_formula_enrichment", parseOptions.do_formula_enrichment.toString());
      formData.append("pipeline", parseOptions.pipeline);

      // Simulate progress
      setFiles(prev => prev.map((f, i) =>
        i === index ? { ...f, progress: 30 } : f
      ));

      const response = await fetch("http://localhost:8000/api/documents/convert", {
        method: "POST",
        body: formData,
      });

      setFiles(prev => prev.map((f, i) =>
        i === index ? { ...f, progress: 80 } : f
      ));

      if (!response.ok) {
        throw new Error(`API 호출 실패: ${response.status}`);
      }

      const result = await response.json();

      setFiles(prev => prev.map((f, i) =>
        i === index ? {
          ...f,
          status: result.status === "success" ? "success" : "error",
          progress: 100,
          result
        } : f
      ));
    } catch (err) {
      setFiles(prev => prev.map((f, i) =>
        i === index ? {
          ...f,
          status: "error",
          progress: 100,
          result: {
            task_id: "",
            error: err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다"
          }
        } : f
      ));
    }
  };

  const handleBatchProcess = async () => {
    setProcessing(true);

    // Process files one by one (sequential)
    for (let i = 0; i < files.length; i++) {
      if (files[i].status === "pending") {
        await processFile(files[i], i);
      }
    }

    setProcessing(false);
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

    // 모든 파일을 순차적으로 저장
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
          // 이미 저장된 문서는 무시
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
          const saved = results.filter(r => !r.skipped).length;
          const skipped = results.filter(r => r.skipped).length;
          return `${saved}개 저장 완료${skipped > 0 ? `, ${skipped}개 이미 저장됨` : ''}!`;
        },
        error: "일부 문서 저장에 실패했습니다.",
      }
    );
  };

  const successCount = files.filter(f => f.status === "success").length;
  const errorCount = files.filter(f => f.status === "error").length;
  const processingCount = files.filter(f => f.status === "processing").length;
  const pendingCount = files.filter(f => f.status === "pending").length;

  return (
    <PageContainer maxWidth="wide">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-4">
          다중 파일 일괄 파싱
        </h1>
        <p className="text-lg text-muted-foreground">
          여러 개의 PDF 파일을 한 번에 업로드하여 마크다운으로 변환하세요
        </p>
      </div>

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
            {/* Basic Options */}
            <div className="grid grid-cols-4 gap-3">
              <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                <Label htmlFor="do_ocr" className="flex flex-col gap-1 cursor-pointer flex-1">
                  <span className="font-medium text-sm">OCR 인식</span>
                  <span className="text-xs text-muted-foreground font-normal">
                    이미지 내 텍스트
                  </span>
                </Label>
                <Switch
                  id="do_ocr"
                  checked={parseOptions.do_ocr}
                  onCheckedChange={(checked) =>
                    setParseOptions({ ...parseOptions, do_ocr: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                <Label htmlFor="do_table_structure" className="flex flex-col gap-1 cursor-pointer flex-1">
                  <span className="font-medium text-sm">테이블 구조</span>
                  <span className="text-xs text-muted-foreground font-normal">
                    표 형식 데이터
                  </span>
                </Label>
                <Switch
                  id="do_table_structure"
                  checked={parseOptions.do_table_structure}
                  onCheckedChange={(checked) =>
                    setParseOptions({ ...parseOptions, do_table_structure: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                <Label htmlFor="include_images" className="flex flex-col gap-1 cursor-pointer flex-1">
                  <span className="font-medium text-sm">이미지 포함</span>
                  <span className="text-xs text-muted-foreground font-normal">
                    문서 내 이미지
                  </span>
                </Label>
                <Switch
                  id="include_images"
                  checked={parseOptions.include_images}
                  onCheckedChange={(checked) =>
                    setParseOptions({ ...parseOptions, include_images: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                <Label htmlFor="do_formula_enrichment" className="flex flex-col gap-1 cursor-pointer flex-1">
                  <span className="font-medium text-sm">수식 인식</span>
                  <span className="text-xs text-muted-foreground font-normal">
                    수학 공식
                  </span>
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

            {/* Advanced Options (Collapsible) */}
            <Collapsible open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen}>
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full flex items-center justify-between p-2 hover:bg-accent hover:text-accent-foreground"
                >
                  <span className="text-sm font-medium">고급 옵션</span>
                  <ChevronDown
                    className={`w-4 h-4 transition-transform duration-200 ${
                      isAdvancedOpen ? "rotate-180" : ""
                    }`}
                  />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-4">
                <div className="grid grid-cols-4 gap-3">
                  <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                    <Label htmlFor="to_formats" className="text-sm whitespace-nowrap mr-2">
                      출력 형식
                    </Label>
                    <Select
                      value={parseOptions.to_formats}
                      onValueChange={(value) =>
                        setParseOptions({ ...parseOptions, to_formats: value })
                      }
                    >
                      <SelectTrigger id="to_formats" className="h-9 w-auto min-w-[100px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="md">Markdown</SelectItem>
                        <SelectItem value="json">JSON</SelectItem>
                        <SelectItem value="html">HTML</SelectItem>
                        <SelectItem value="text">Text</SelectItem>
                        <SelectItem value="doctags">Doctags</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                    <Label htmlFor="table_mode" className="text-sm whitespace-nowrap mr-2">
                      테이블 모드
                    </Label>
                    <Select
                      value={parseOptions.table_mode}
                      onValueChange={(value) =>
                        setParseOptions({ ...parseOptions, table_mode: value })
                      }
                    >
                      <SelectTrigger id="table_mode" className="h-9 w-auto min-w-[100px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fast">Fast</SelectItem>
                        <SelectItem value="accurate">Accurate</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                    <Label htmlFor="image_export_mode" className="text-sm whitespace-nowrap mr-2">
                      이미지 모드
                    </Label>
                    <Select
                      value={parseOptions.image_export_mode}
                      onValueChange={(value) =>
                        setParseOptions({ ...parseOptions, image_export_mode: value })
                      }
                    >
                      <SelectTrigger id="image_export_mode" className="h-9 w-auto min-w-[100px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="placeholder">Placeholder</SelectItem>
                        <SelectItem value="embedded">Embedded</SelectItem>
                        <SelectItem value="referenced">Referenced</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                    <Label htmlFor="pipeline" className="text-sm whitespace-nowrap mr-2">
                      파이프라인
                    </Label>
                    <Select
                      value={parseOptions.pipeline}
                      onValueChange={(value) =>
                        setParseOptions({ ...parseOptions, pipeline: value })
                      }
                    >
                      <SelectTrigger id="pipeline" className="h-9 w-auto min-w-[100px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="standard">Standard</SelectItem>
                        <SelectItem value="legacy">Legacy</SelectItem>
                        <SelectItem value="vlm">VLM</SelectItem>
                        <SelectItem value="asr">ASR</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </CardContent>
        </Card>

        {/* File Upload Section */}
        <Card className="min-w-0 overflow-hidden">
          <CardHeader>
            <CardTitle>파일 업로드</CardTitle>
            <CardDescription>변환할 문서 파일을 선택하세요 (다중 선택 가능)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* File Upload Area */}
            <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
              <input
                type="file"
                id="batch-file-upload"
                className="hidden"
                accept=".pdf,.docx,.doc,.pptx,.ppt"
                onChange={handleFileChange}
                multiple
                disabled={processing}
              />
              <label
                htmlFor="batch-file-upload"
                className="cursor-pointer flex flex-col items-center space-y-3"
              >
                <FolderOpen className="w-12 h-12 text-muted-foreground" />
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

            {/* File List */}
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
                            <p className="text-xs text-muted-foreground">
                              {(fileStatus.file.size / 1024 / 1024).toFixed(2)} MB
                            </p>
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

                {/* Progress Summary */}
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

                {/* Status Summary */}
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

                {/* Action Buttons */}
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

        {/* Results Section */}
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
                            {/* Document Info */}
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

                            {/* Markdown Content Preview */}
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
                                        <pre className="text-sm whitespace-pre-wrap break-words font-mono overflow-x-auto">
                                          {fileStatus.result.document.md_content.substring(0, 1000)}
                                          {fileStatus.result.document.md_content.length > 1000 &&
                                            "\n\n... (내용이 잘렸습니다. '전체 내용' 탭을 확인하세요)"
                                          }
                                        </pre>
                                      </div>
                                    </ScrollArea>
                                    <div className="flex justify-end gap-2">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleSaveDocument(fileStatus)}
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
                                        <pre className="text-sm whitespace-pre-wrap break-words font-mono overflow-x-auto">
                                          {fileStatus.result.document.md_content}
                                        </pre>
                                      </div>
                                    </ScrollArea>
                                    <div className="flex justify-end gap-2">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleSaveDocument(fileStatus)}
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
      </div>
    </PageContainer>
  );
}
