"use client";

import { useState, useEffect } from "react";
import { Upload, FileText, Loader2, CheckCircle2, XCircle, Download, Trash2, FolderOpen, Save, Settings, Zap, Sparkles, Eye, ChevronDown, StopCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { API_BASE_URL } from "@/lib/api-config";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { PageContainer } from "@/components/page-container";
import { Label } from "@/components/ui/label";
import { MarkdownMessage } from "@/components/markdown-message";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CollectionSelector } from "@/components/ui/collection-selector";
import { QdrantCollection } from "@/app/upload/types";
import { useFileConversion } from "./hooks/useFileConversion";
import type { FileStatus } from "./types";

export default function ParsePage() {
  const {
    files, processing, isDragging,
    parseOptions, setParseOptions,
    selectedCategory, setSelectedCategory,
    isStopRequested,
    successCount, errorCount, pendingCount,
    handleFileChange, handleDragOver, handleDragLeave, handleDrop,
    removeFile, handleProcess, handleStopParsing, handleRestartFailed,
    handleReset, downloadAll, handleSaveDocument, handleSaveAllDocuments,
  } = useFileConversion();

  // Dialog 상태
  const [selectedResult, setSelectedResult] = useState<FileStatus | null>(null);

  // Advanced options collapsible state
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

  // 카테고리(컬렉션) 관련 상태
  const [collections, setCollections] = useState<QdrantCollection[]>([]);
  const [collectionsLoading, setCollectionsLoading] = useState(false);

  const fetchCollections = async () => {
    setCollectionsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/qdrant/collections`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        const sorted = [...(data.collections || [])].sort((a: QdrantCollection, b: QdrantCollection) =>
          a.name.localeCompare(b.name, 'ko-KR')
        );
        setCollections(sorted);
      }
    } catch (err) {
      console.error("컬렉션 목록 로드 실패:", err);
    } finally {
      setCollectionsLoading(false);
    }
  };

  useEffect(() => {
    fetchCollections();
  }, []);

  return (
    <PageContainer maxWidth="wide" className="space-y-4">
      {/* Page Header */}
      <div className="flex items-center">
        <h1 className="text-lg font-semibold flex items-center gap-2">
          <FileText className="h-5 w-5 text-muted-foreground" />
          문서변환
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-6">
        {/* Left Column: File Upload (70%) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="space-y-4"
        >
          {/* File Upload Card */}
          <Card className={cn(
            "min-w-0 overflow-hidden border-border/50 bg-background/60 backdrop-blur-sm",
            processing && files.length > 0 && "flex flex-col max-h-[calc(100vh-180px)]"
          )}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-[color:var(--chart-3)]/10">
                  <Upload className="h-4 w-4 text-[color:var(--chart-3)]" />
                </div>
                파일 업로드
              </CardTitle>
              <CardDescription>변환할 문서 파일을 선택하세요 (다중 선택 가능)</CardDescription>
            </CardHeader>
            <CardContent className={cn(
              "space-y-4",
              processing && files.length > 0 && "flex-1 flex flex-col min-h-0 overflow-hidden"
            )}>
              <div
                className={cn(
                  "relative border-2 border-dashed rounded-2xl text-center transition-all duration-300 overflow-hidden group",
                  processing ? "h-16" : "h-52",
                  isDragging
                    ? "border-[color:var(--chart-3)] bg-[color:var(--chart-3)]/5 scale-[1.01]"
                    : "border-border/50 hover:border-[color:var(--chart-3)]/50 hover:bg-muted/30"
                )}
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
                  className={cn(
                    "cursor-pointer h-full flex items-center justify-center relative z-10",
                    processing ? "flex-row gap-3 px-4" : "flex-col space-y-4"
                  )}
                >
                  <div className={cn(
                    "rounded-full transition-colors",
                    processing ? "p-2" : "p-4",
                    isDragging ? "bg-[color:var(--chart-3)]/20" : "bg-muted/50"
                  )}>
                    <FolderOpen
                      className={cn(
                        "transition-all",
                        processing ? "w-5 h-5" : "w-12 h-12",
                        isDragging ? "text-[color:var(--chart-3)] scale-110" : "text-muted-foreground group-hover:scale-105"
                      )}
                    />
                  </div>
                  <div className={processing ? "text-left" : "text-center"}>
                    <p className={cn("font-medium", processing ? "text-sm" : "text-base")}>
                      {processing ? "파일 추가" : (
                        <>
                          파일 선택 또는{" "}
                          <span className="text-[color:var(--chart-3)]">드래그 앤 드롭</span>
                        </>
                      )}
                    </p>
                    {!processing && (
                      <p className="text-sm text-muted-foreground mt-1">
                        PDF, DOCX, PPTX (다중 선택 가능)
                      </p>
                    )}
                  </div>
                </label>
              </div>

              {files.length > 0 && (
                <div className={cn(
                  processing ? "flex-1 flex flex-col min-h-0 gap-3" : "space-y-3"
                )}>
                  <div className="flex items-center justify-between flex-shrink-0">
                    <h3 className="text-sm font-medium flex items-center gap-2">
                      선택된 파일
                      <Badge variant="secondary" className="bg-[color:var(--chart-3)]/10 text-[color:var(--chart-3)]">
                        {files.length}개
                      </Badge>
                    </h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleReset}
                      disabled={processing}
                      className="hover:bg-destructive/10 hover:text-destructive transition-colors"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      전체 삭제
                    </Button>
                  </div>

                  <ScrollArea className={cn(
                    "w-full rounded-xl border border-border/50 transition-all duration-300",
                    processing
                      ? "h-[calc(100vh-520px)]"
                      : files.length <= 3
                        ? "h-auto max-h-64"
                        : "h-64"
                  )}>
                    <div className="p-3 space-y-1.5">
                      {files.map((fileStatus, index) => (
                        <div
                          key={index}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                            fileStatus.status === "success"
                              ? "bg-[color:var(--chart-2)]/5 hover:bg-[color:var(--chart-2)]/10"
                              : fileStatus.status === "error"
                              ? "bg-destructive/5 hover:bg-destructive/10"
                              : "bg-muted/50 hover:bg-muted"
                          }`}
                        >
                          {/* Status Icon */}
                          <div className="flex-shrink-0">
                            {fileStatus.status === "pending" && (
                              <FileText className="w-4 h-4" style={{ color: "var(--chart-1)" }} />
                            )}
                            {fileStatus.status === "processing" && (
                              <Loader2 className="w-4 h-4 animate-spin" style={{ color: "var(--chart-3)" }} />
                            )}
                            {fileStatus.status === "success" && (
                              <CheckCircle2 className="w-4 h-4" style={{ color: "var(--chart-2)" }} />
                            )}
                            {fileStatus.status === "error" && (
                              <XCircle className="w-4 h-4 text-destructive" />
                            )}
                          </div>

                          {/* File Info - Flexible Width */}
                          <div className="flex-1 min-w-0 overflow-hidden">
                            <p className="text-sm font-medium truncate">{fileStatus.file.name}</p>
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-xs text-muted-foreground">
                                {(fileStatus.file.size / 1024 / 1024).toFixed(2)} MB
                              </p>
                              {fileStatus.progressInfo && fileStatus.status === "processing" && (
                                <p className="text-xs text-muted-foreground">
                                  • 페이지 {fileStatus.progressInfo.current_page}/{fileStatus.progressInfo.total_pages} ({fileStatus.progressInfo.progress_percentage}%)
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Action Buttons - Fixed Width */}
                          <div className="flex items-center gap-1 flex-shrink-0">
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
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => removeFile(index)}
                              disabled={processing}
                            >
                              <XCircle className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                  </div>
                </ScrollArea>

                  {!processing && (successCount > 0 || errorCount > 0) && (
                    <div className="flex gap-4 text-sm p-3 rounded-xl bg-muted/30 border border-border/50">
                      {successCount > 0 && (
                        <div className="flex items-center gap-2 text-[color:var(--chart-2)]">
                          <CheckCircle2 className="w-4 h-4" />
                          <span className="font-medium">성공: {successCount}개</span>
                        </div>
                      )}
                      {errorCount > 0 && (
                        <div className="flex items-center gap-2 text-destructive">
                          <XCircle className="w-4 h-4" />
                          <span className="font-medium">실패: {errorCount}개</span>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 flex-shrink-0">
                    <Button
                      onClick={handleProcess}
                      disabled={files.length === 0 || processing || pendingCount === 0}
                      className={`shadow-lg shadow-[color:var(--chart-3)]/20 hover:shadow-[color:var(--chart-3)]/40 hover:scale-[1.02] active:scale-[0.98] transition-all bg-[color:var(--chart-3)] hover:bg-[color:var(--chart-3)]/90 ${!processing && pendingCount > 0 ? 'flex-1' : ''}`}
                      size="lg"
                    >
                      {processing ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span>{successCount + errorCount}/{files.length}</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-5 h-5" />
                          <span>파싱 시작</span>
                        </>
                      )}
                    </Button>

                    {processing && !isStopRequested && (
                      <Button
                        variant="outline"
                        size="lg"
                        onClick={handleStopParsing}
                        className="border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      >
                        <StopCircle className="w-5 h-5" />
                        <span>중지</span>
                      </Button>
                    )}

                    {processing && isStopRequested && (
                      <Button variant="outline" size="lg" disabled className="border-amber-500/50 text-amber-600">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>중지 중...</span>
                      </Button>
                    )}

                    {!processing && (errorCount > 0 || (isStopRequested && pendingCount > 0)) && (
                      <Button
                        variant="outline"
                        size="lg"
                        onClick={handleRestartFailed}
                        className="border-[color:var(--chart-3)]/50 text-[color:var(--chart-3)] hover:bg-[color:var(--chart-3)]/10"
                      >
                        <RotateCcw className="w-5 h-5" />
                        <span>재시작</span>
                      </Button>
                    )}

                    {successCount > 0 && !processing && (
                      <Button
                        variant="outline"
                        size="lg"
                        onClick={handleSaveAllDocuments}
                        className="border-[color:var(--chart-2)]/50 text-[color:var(--chart-2)] hover:bg-[color:var(--chart-2)]/10"
                      >
                        <Save className="w-5 h-5" />
                        <span>저장</span>
                      </Button>
                    )}

                    {successCount > 0 && !processing && (
                      <Button
                        variant="outline"
                        size="lg"
                        onClick={downloadAll}
                        className="border-border/50 hover:bg-muted/50"
                      >
                        <Download className="w-5 h-5" />
                        <span>다운로드</span>
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Right Column: Parsing Options (30%) - Sticky */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="lg:sticky lg:top-4 lg:self-start"
        >
          <Card className="min-w-0 overflow-hidden border-border/50 bg-background/60 backdrop-blur-sm shadow-xl shadow-[color:var(--chart-3)]/5">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <div className="p-1.5 rounded-lg bg-[color:var(--chart-5)]/10">
                  <Settings className="w-4 h-4 text-[color:var(--chart-5)]" />
                </div>
                파싱 옵션
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Basic Options */}
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Zap className="w-3.5 h-3.5 text-[color:var(--chart-3)]" />
                    파싱 전략
                  </Label>
                  <Select
                    value={parseOptions.strategy}
                    onValueChange={(value: "docling" | "qwen3-vl") =>
                      setParseOptions({ ...parseOptions, strategy: value })
                    }
                  >
                    <SelectTrigger className="w-full h-11 bg-background/50 border-border/50 focus:border-[color:var(--chart-3)]/30 transition-colors">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="qwen3-vl">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-3.5 h-3.5 text-[color:var(--chart-5)]" />
                          <span>Qwen3-VL</span>
                          <Badge variant="secondary" className="text-xs bg-[color:var(--chart-5)]/10 text-[color:var(--chart-5)]">
                            AI
                          </Badge>
                        </div>
                      </SelectItem>
                      <SelectItem value="docling">
                        <div className="flex items-center gap-2">
                          <Zap className="w-3.5 h-3.5 text-[color:var(--chart-3)]" />
                          <span>Docling</span>
                          <Badge variant="secondary" className="text-xs bg-[color:var(--chart-3)]/10 text-[color:var(--chart-3)]">
                            빠름
                          </Badge>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center space-x-2 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                  <Checkbox
                    id="do_ocr"
                    checked={parseOptions.do_ocr}
                    onCheckedChange={(checked) =>
                      setParseOptions({ ...parseOptions, do_ocr: checked as boolean })
                    }
                  />
                  <Label htmlFor="do_ocr" className="text-sm font-normal cursor-pointer flex-1">
                    OCR 인식
                  </Label>
                </div>

                <div className="flex items-center space-x-2 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                  <Checkbox
                    id="include_images"
                    checked={parseOptions.include_images}
                    onCheckedChange={(checked) =>
                      setParseOptions({ ...parseOptions, include_images: checked as boolean })
                    }
                  />
                  <Label htmlFor="include_images" className="text-sm font-normal cursor-pointer flex-1">
                    이미지 포함
                  </Label>
                </div>
              </div>

              <Separator />

              <CollectionSelector
                value={selectedCategory}
                onValueChange={setSelectedCategory}
                collections={collections}
                loading={collectionsLoading}
                onRefresh={fetchCollections}
                showUncategorized={true}
                showManageLink={true}
                variant="modal"
                columns={2}
                label="저장 카테고리"
                modalTitle="저장할 카테고리 선택"
              />

              <Separator />

              {/* Advanced Options - Collapsible */}
              <Collapsible open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full justify-between px-2 hover:bg-muted/50">
                    <span className="text-sm font-medium">고급 옵션</span>
                    <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isAdvancedOpen ? 'rotate-180' : ''}`} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-2 pt-3">
                  <div className="flex items-center space-x-2 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                    <Checkbox
                      id="do_table_structure"
                      checked={parseOptions.do_table_structure}
                      onCheckedChange={(checked) =>
                        setParseOptions({ ...parseOptions, do_table_structure: checked as boolean })
                      }
                    />
                    <Label htmlFor="do_table_structure" className="text-sm font-normal cursor-pointer flex-1">
                      테이블 구조 인식
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                    <Checkbox
                      id="do_formula_enrichment"
                      checked={parseOptions.do_formula_enrichment}
                      onCheckedChange={(checked) =>
                        setParseOptions({ ...parseOptions, do_formula_enrichment: checked as boolean })
                      }
                    />
                    <Label htmlFor="do_formula_enrichment" className="text-sm font-normal cursor-pointer flex-1">
                      수식 인식
                    </Label>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Result Dialog */}
        <Dialog open={!!selectedResult} onOpenChange={(open) => !open && setSelectedResult(null)}>
          <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {selectedResult?.status === "success" ? (
                  <CheckCircle2 className="w-5 h-5 flex-shrink-0" style={{ color: "var(--chart-2)" }} />
                ) : (
                  <XCircle className="w-5 h-5 text-destructive flex-shrink-0" />
                )}
                <span className="truncate">{selectedResult?.file.name}</span>
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-hidden">
              {selectedResult?.status === "success" && selectedResult.result?.document ? (
                <div className="h-full flex flex-col space-y-3">
                  {selectedResult.result.document.md_content && (
                    <Tabs defaultValue="preview" className="flex-1 flex flex-col">
                      <div className="flex items-center justify-between">
                        <TabsList className="grid w-[200px] grid-cols-2">
                          <TabsTrigger value="preview">미리보기</TabsTrigger>
                          <TabsTrigger value="full">전체</TabsTrigger>
                        </TabsList>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => selectedResult && handleSaveDocument(selectedResult)}
                          >
                            <Save className="w-4 h-4 mr-2" />
                            저장
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
                      </div>
                      <TabsContent value="preview" className="flex-1 mt-3">
                        <ScrollArea className="h-[calc(85vh-200px)] w-full rounded-lg border bg-muted/30">
                          <div className="p-4">
                            <MarkdownMessage
                              content={
                                selectedResult.result.document.md_content.substring(0, 2000) +
                                (selectedResult.result.document.md_content.length > 2000
                                  ? "\n\n... (내용이 잘렸습니다. '전체' 탭을 확인하세요)"
                                  : "")
                              }
                            />
                          </div>
                        </ScrollArea>
                      </TabsContent>
                      <TabsContent value="full" className="flex-1 mt-3">
                        <ScrollArea className="h-[calc(85vh-200px)] w-full rounded-lg border bg-muted/30">
                          <div className="p-4">
                            <MarkdownMessage content={selectedResult.result.document.md_content} />
                          </div>
                        </ScrollArea>
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
