"use client";

import { useState } from "react";
import { Link2, Loader2, FileText, Download, Save, Settings, Upload, FileSpreadsheet, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { PageContainer } from "@/components/page-container";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import * as XLSX from 'xlsx';

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

interface ParseResult {
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

interface ExcelRow {
  document_name: string;
  url: string;
  category: string;
  created_date: string;
}

export default function UrlParsePage() {
  const [sourceUrl, setSourceUrl] = useState("");
  const [processing, setProcessing] = useState(false);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [result, setResult] = useState<ParseResult | null>(null);

  // 일괄 업로드 관련 state
  const [excelData, setExcelData] = useState<ExcelRow[]>([]);
  const [batchProcessing, setBatchProcessing] = useState(false);

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

  const handleParse = async () => {
    if (!sourceUrl.trim()) {
      toast.error("URL을 입력해주세요");
      return;
    }

    // URL 유효성 검사
    try {
      new URL(sourceUrl);
    } catch (e) {
      toast.error("올바른 URL 형식이 아닙니다");
      return;
    }

    setProcessing(true);
    setResult(null);

    try {
      const requestBody = {
        url: sourceUrl,
        target_type: "inbody",
        to_formats: parseOptions.to_formats,
        do_ocr: parseOptions.do_ocr,
        do_table_structure: parseOptions.do_table_structure,
        include_images: parseOptions.include_images,
        table_mode: parseOptions.table_mode,
        image_export_mode: parseOptions.image_export_mode,
        page_range_start: parseOptions.page_range_start,
        page_range_end: parseOptions.page_range_end,
        do_formula_enrichment: parseOptions.do_formula_enrichment,
        pipeline: parseOptions.pipeline,
      };

      const response = await fetch("http://localhost:8000/api/documents/convert-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`API 호출 실패: ${response.status}`);
      }

      const data = await response.json();
      setResult(data);

      if (data.status === "success") {
        toast.success("문서 파싱이 완료되었습니다!");
      } else {
        toast.error(data.error || "파싱에 실패했습니다");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다");
      setResult({
        task_id: "",
        status: "failure",
        error: err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다",
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!result?.document?.md_content) return;

    const blob = new Blob([result.document.md_content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${result.document.filename || "document"}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSave = async () => {
    if (!result?.document?.md_content) return;

    const saveRequest = {
      task_id: result.task_id,
      original_filename: result.document.filename,
      file_size: result.document.md_content.length,
      file_type: "url",
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
        success: "문서가 저장되었습니다!",
        error: (err) => err.message || "문서 저장에 실패했습니다.",
      }
    );
  };

  // 엑셀 템플릿 다운로드
  const downloadExcelTemplate = () => {
    const template = [
      {
        "메뉴명": "AI 기술 가이드",
        "URL": "https://example.com/ai-guide.pdf",
        "카테고리": "기술문서",
        "작성일자": "2024-01-15"
      },
      {
        "메뉴명": "사용자 매뉴얼",
        "URL": "https://example.com/manual.pdf",
        "카테고리": "매뉴얼",
        "작성일자": "2024-02-20"
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(template);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "URL 목록");

    // 컬럼 너비 설정
    worksheet['!cols'] = [
      { wch: 20 }, // 메뉴명
      { wch: 50 }, // URL
      { wch: 15 }, // 카테고리
      { wch: 12 }  // 작성일자
    ];

    XLSX.writeFile(workbook, "URL_파싱_템플릿.xlsx");
    toast.success("템플릿이 다운로드되었습니다");
  };

  // 엑셀 파일 업로드 처리
  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        // 데이터 변환
        const parsedData: ExcelRow[] = jsonData.map((row: any) => ({
          document_name: row['메뉴명'] || row['document_name'] || '',
          url: row['URL'] || row['url'] || '',
          category: row['카테고리'] || row['category'] || '',
          created_date: row['작성일자'] || row['created_date'] || ''
        }));

        // 유효성 검사
        const invalidRows = parsedData.filter(row => !row.url || !row.document_name);
        if (invalidRows.length > 0) {
          toast.error(`${invalidRows.length}개의 행에 필수 정보(메뉴명, URL)가 누락되었습니다`);
          return;
        }

        setExcelData(parsedData);
        toast.success(`${parsedData.length}개의 URL이 로드되었습니다`);
      } catch (err) {
        toast.error("엑셀 파일 읽기 실패: " + (err instanceof Error ? err.message : "알 수 없는 오류"));
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // 엑셀 데이터 초기화
  const clearExcelData = () => {
    setExcelData([]);
    toast.info("업로드된 데이터가 초기화되었습니다");
  };

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

        {/* Main Tabs - Single URL vs Batch Upload */}
        <Tabs defaultValue="single" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="single">
              <Link2 className="w-4 h-4 mr-2" />
              단일 URL
            </TabsTrigger>
            <TabsTrigger value="batch">
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              일괄 업로드
            </TabsTrigger>
          </TabsList>

          {/* Single URL Tab */}
          <TabsContent value="single" className="space-y-6 mt-6">
            {/* URL Input Section */}
            <Card className="min-w-0 overflow-hidden">
              <CardHeader>
                <CardTitle>문서 URL</CardTitle>
                <CardDescription>파싱할 문서의 URL을 입력하세요</CardDescription>
              </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3">
              <div className="flex-1">
                <Input
                  type="url"
                  placeholder="https://example.com/document.pdf"
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                  disabled={processing}
                  className="h-12 text-base"
                />
              </div>
              <Button
                onClick={handleParse}
                disabled={processing || !sourceUrl.trim()}
                size="lg"
                className="gap-2 min-w-[120px]"
              >
                {processing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    파싱 중...
                  </>
                ) : (
                  <>
                    <Link2 className="w-5 h-5" />
                    파싱 시작
                  </>
                )}
              </Button>
            </div>

            <div className="text-sm text-muted-foreground">
              <p className="font-medium mb-1">지원 형식:</p>
              <p>PDF, DOCX, PPTX 등 다양한 문서 형식의 URL을 지원합니다</p>
            </div>
          </CardContent>
        </Card>

        {/* Result Section */}
        {result && (
          <Card className="min-w-0 overflow-hidden">
            <CardHeader>
              <CardTitle>파싱 결과</CardTitle>
              <CardDescription>변환된 문서를 확인하세요</CardDescription>
            </CardHeader>
            <CardContent>
              {result.status === "success" && result.document ? (
                <div className="space-y-4">
                  {/* Document Info */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">파일명</span>
                      <span className="text-sm font-medium">{result.document.filename}</span>
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
                          <span className="text-sm text-muted-foreground">문자 수</span>
                          <Badge>{result.document.md_content.length.toLocaleString()}</Badge>
                        </div>
                      </>
                    )}
                    {result.processing_time && (
                      <>
                        <Separator />
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">처리 시간</span>
                          <Badge variant="secondary">{result.processing_time.toFixed(2)}초</Badge>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Markdown Content */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium">변환된 마크다운</h4>
                    {result.document.md_content ? (
                      <>
                      <Tabs defaultValue="preview" className="w-full">
                        <TabsList className="grid w-full grid-cols-2">
                          <TabsTrigger value="preview">미리보기</TabsTrigger>
                          <TabsTrigger value="full">전체 내용</TabsTrigger>
                        </TabsList>
                        <TabsContent value="preview" className="mt-4 space-y-4">
                          <ScrollArea className="h-96 w-full rounded-lg border bg-muted/50">
                            <div className="p-4">
                              <pre className="text-sm whitespace-pre-wrap break-words font-mono overflow-x-auto">
                                {result.document.md_content.substring(0, 2000)}
                                {result.document.md_content.length > 2000 &&
                                  "\n\n... (내용이 잘렸습니다. '전체 내용' 탭을 확인하세요)"}
                              </pre>
                            </div>
                          </ScrollArea>
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={handleSave}>
                              <Save className="w-4 h-4 mr-2" />
                              문서 저장
                            </Button>
                            <Button variant="outline" size="sm" onClick={handleDownload}>
                              <Download className="w-4 h-4 mr-2" />
                              다운로드
                            </Button>
                          </div>
                        </TabsContent>
                        <TabsContent value="full" className="mt-4 space-y-4">
                          <ScrollArea className="h-96 w-full rounded-lg border bg-muted/50">
                            <div className="p-4">
                              <pre className="text-sm whitespace-pre-wrap break-words font-mono overflow-x-auto">
                                {result.document.md_content}
                              </pre>
                            </div>
                          </ScrollArea>
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={handleSave}>
                              <Save className="w-4 h-4 mr-2" />
                              문서 저장
                            </Button>
                            <Button variant="outline" size="sm" onClick={handleDownload}>
                              <Download className="w-4 h-4 mr-2" />
                              다운로드
                            </Button>
                          </div>
                        </TabsContent>
                      </Tabs>
                      </>
                    ) : (
                      <Alert>
                        <FileText className="h-4 w-4" />
                        <AlertTitle>내용이 비어있습니다</AlertTitle>
                        <AlertDescription>
                          URL에서 파싱 가능한 문서 내용을 찾을 수 없습니다.
                          PDF, DOCX, PPTX 등의 문서 URL을 입력해주세요.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                </div>
              ) : (
                <Alert variant="destructive">
                  <FileText className="h-4 w-4" />
                  <AlertTitle>파싱 실패</AlertTitle>
                  <AlertDescription>
                    {result.error || "알 수 없는 오류가 발생했습니다"}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        )}
          </TabsContent>

          {/* Batch Upload Tab */}
          <TabsContent value="batch" className="space-y-6 mt-6">
            {/* Template Download & Upload */}
            <Card className="min-w-0 overflow-hidden">
              <CardHeader>
                <CardTitle>엑셀 파일 업로드</CardTitle>
                <CardDescription>
                  템플릿을 다운로드하여 작성한 후 업로드하세요
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={downloadExcelTemplate}
                    className="gap-2"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    템플릿 다운로드
                  </Button>

                  <div className="flex-1">
                    <Input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleExcelUpload}
                      className="cursor-pointer"
                    />
                  </div>

                  {excelData.length > 0 && (
                    <Button
                      variant="destructive"
                      onClick={clearExcelData}
                      className="gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      초기화
                    </Button>
                  )}
                </div>

                {/* Template Info */}
                <div className="text-sm space-y-2">
                  <p className="font-medium">템플릿 필드:</p>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    <li><strong>메뉴명</strong> (필수): 문서 식별용 이름</li>
                    <li><strong>URL</strong> (필수): 파싱할 문서 URL</li>
                    <li><strong>카테고리</strong>: 문서 분류 (예: 기술문서, 매뉴얼)</li>
                    <li><strong>작성일자</strong>: YYYY-MM-DD 형식</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* Uploaded Data Preview */}
            {excelData.length > 0 && (
              <Card className="min-w-0 overflow-hidden">
                <CardHeader>
                  <CardTitle>업로드된 데이터 ({excelData.length}개)</CardTitle>
                  <CardDescription>
                    아래 URL들이 일괄 파싱됩니다
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-96 w-full rounded-lg border">
                    <div className="p-4">
                      <table className="w-full">
                        <thead className="bg-muted">
                          <tr>
                            <th className="p-2 text-left text-sm font-medium">No</th>
                            <th className="p-2 text-left text-sm font-medium">메뉴명</th>
                            <th className="p-2 text-left text-sm font-medium">URL</th>
                            <th className="p-2 text-left text-sm font-medium">카테고리</th>
                            <th className="p-2 text-left text-sm font-medium">작성일자</th>
                          </tr>
                        </thead>
                        <tbody>
                          {excelData.map((row, index) => (
                            <tr key={index} className="border-b hover:bg-muted/50">
                              <td className="p-2 text-sm">{index + 1}</td>
                              <td className="p-2 text-sm font-medium">{row.document_name}</td>
                              <td className="p-2 text-sm text-blue-600 truncate max-w-xs">
                                {row.url}
                              </td>
                              <td className="p-2 text-sm">
                                <Badge variant="outline">{row.category || '-'}</Badge>
                              </td>
                              <td className="p-2 text-sm text-muted-foreground">
                                {row.created_date || '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </ScrollArea>

                  <div className="flex justify-end mt-4">
                    <Button
                      onClick={() => {
                        toast.info("일괄 파싱 기능은 백엔드 API 구현 후 활성화됩니다");
                      }}
                      disabled={batchProcessing}
                      size="lg"
                      className="gap-2"
                    >
                      {batchProcessing ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          파싱 중...
                        </>
                      ) : (
                        <>
                          <Upload className="w-5 h-5" />
                          일괄 파싱 시작
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </PageContainer>
  );
}
