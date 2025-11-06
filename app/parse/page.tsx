"use client";

import { useState } from "react";
import { Upload, FileText, Loader2, CheckCircle2, XCircle, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { PageContainer } from "@/components/page-container";

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

interface ParseOptions {
  to_formats: string;
  do_ocr: boolean;
  do_table_structure: boolean;
  include_images: boolean;
  table_mode: string;
  image_export_mode: string;
  page_range_start: string;
  page_range_end: string;
  do_formula_enrichment: boolean;
}

export default function ParsePage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ConvertResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [options, setOptions] = useState<ParseOptions>({
    to_formats: "md",
    do_ocr: true,
    do_table_structure: true,
    include_images: true,
    table_mode: "accurate",
    image_export_mode: "embedded",
    page_range_start: "",
    page_range_end: "",
    do_formula_enrichment: false,
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setResult(null);
      setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("to_formats", options.to_formats);
      formData.append("do_ocr", String(options.do_ocr));
      formData.append("do_table_structure", String(options.do_table_structure));
      formData.append("include_images", String(options.include_images));
      formData.append("table_mode", options.table_mode);
      formData.append("image_export_mode", options.image_export_mode);
      formData.append("page_range_start", options.page_range_start || "1");
      formData.append("page_range_end", options.page_range_end || "9223372036854776000");
      formData.append("do_formula_enrichment", String(options.do_formula_enrichment));

      const response = await fetch("http://localhost:8000/api/documents/convert", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`API 호출 실패: ${response.status}`);
      }

      const data: ConvertResult = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setResult(null);
    setError(null);
  };

  return (
    <PageContainer maxWidth="wide">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-4">
          문서 파싱
        </h1>
        <p className="text-lg text-muted-foreground">
          PDF 파일을 업로드하여 마크다운으로 변환하세요
        </p>
      </div>

      <div className="grid lg:grid-cols-[1fr_300px] gap-6">
        <Card>
          <CardContent className="pt-6">
            {!result ? (
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* 파일 업로드 영역 - 최소화 */}
                <div>
                  <Label htmlFor="file-upload" className="text-sm font-medium mb-2 block">
                    문서 파일
                  </Label>
                  <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
                    <input
                      type="file"
                      id="file-upload"
                      className="hidden"
                      accept=".pdf,.docx,.doc,.pptx,.ppt"
                      onChange={handleFileChange}
                    />
                    <label
                      htmlFor="file-upload"
                      className="cursor-pointer flex flex-col items-center space-y-2"
                    >
                      <Upload className="w-8 h-8 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">
                          파일 선택
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          PDF, DOCX, PPTX
                        </p>
                      </div>
                    </label>
                  </div>
                </div>

                {/* 선택된 파일 정보 */}
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

                {/* 에러 메시지 */}
                {error && (
                  <Alert variant="destructive">
                    <XCircle className="h-4 w-4" />
                    <AlertTitle>오류가 발생했습니다</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                {/* 제출 버튼 */}
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
        ) : (
          <div className="space-y-6">
            {/* 성공 메시지 */}
            {result.status === "success" && (
              <>
                <Alert className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
                  <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                  <AlertTitle className="text-green-900 dark:text-green-100">파싱 완료!</AlertTitle>
                  <AlertDescription className="text-green-700 dark:text-green-300">
                    문서가 성공적으로 변환되었습니다. 처리 시간: {result.processing_time?.toFixed(2)}초
                  </AlertDescription>
                </Alert>

                {/* 문서 정보 */}
                {result.document && (
                  <div className="space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle>문서 정보</CardTitle>
                        <CardDescription>변환된 문서의 상세 정보</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
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
                      </CardContent>
                    </Card>

                    {/* 마크다운 내용 - Tabs로 표시 */}
                    {result.document.md_content && (
                      <Card>
                        <CardHeader>
                          <CardTitle>변환된 마크다운</CardTitle>
                          <CardDescription>문서가 마크다운 형식으로 변환되었습니다</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <Tabs defaultValue="preview" className="w-full">
                            <TabsList className="grid w-full grid-cols-2">
                              <TabsTrigger value="preview">미리보기</TabsTrigger>
                              <TabsTrigger value="full">전체 내용</TabsTrigger>
                            </TabsList>
                            <TabsContent value="preview" className="mt-4">
                              <div className="max-h-96 overflow-y-auto bg-muted/50 p-4 rounded-lg border">
                                <pre className="text-sm whitespace-pre-wrap font-mono">
                                  {result.document.md_content.substring(0, 2000)}
                                  {result.document.md_content.length > 2000 && "\n\n... (내용이 잘렸습니다. '전체 내용' 탭을 확인하세요)"}
                                </pre>
                              </div>
                            </TabsContent>
                            <TabsContent value="full" className="mt-4">
                              <div className="max-h-96 overflow-y-auto bg-muted/50 p-4 rounded-lg border">
                                <pre className="text-sm whitespace-pre-wrap font-mono">
                                  {result.document.md_content}
                                </pre>
                              </div>
                              <div className="flex justify-end mt-4">
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
                                  <Download className="w-4 h-4" />
                                  다운로드
                                </Button>
                              </div>
                            </TabsContent>
                          </Tabs>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}
              </>
            )}

            {/* 실패 메시지 */}
            {result.status === "failure" && (
              <Alert variant="destructive">
                <XCircle className="h-5 w-5" />
                <AlertTitle>파싱 실패</AlertTitle>
                <AlertDescription>
                  {result.error || "알 수 없는 오류가 발생했습니다"}
                </AlertDescription>
              </Alert>
            )}

            {/* 다시 시작 버튼 */}
            <div className="flex gap-3">
              <Button
                onClick={handleReset}
                variant="secondary"
                className="flex-1"
                size="lg"
              >
                다른 파일 파싱하기
              </Button>
            </div>
          </div>
        )}
          </CardContent>
        </Card>

        {/* 옵션 사이드바 */}
        <Card className="lg:sticky lg:top-20 h-fit">
          <CardHeader>
            <CardTitle className="text-lg">파싱 옵션</CardTitle>
            <CardDescription>문서 변환 설정</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Output Format */}
            <div className="space-y-2">
              <Label htmlFor="to_formats">출력 형식</Label>
              <Select
                value={options.to_formats}
                onValueChange={(value) =>
                  setOptions({ ...options, to_formats: value })
                }
              >
                <SelectTrigger id="to_formats">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="md">Markdown</SelectItem>
                  <SelectItem value="json">JSON</SelectItem>
                  <SelectItem value="html">HTML</SelectItem>
                  <SelectItem value="text">Text</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* OCR */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="do_ocr">OCR 인식</Label>
                <p className="text-xs text-muted-foreground">
                  이미지 내 텍스트 추출
                </p>
              </div>
              <Switch
                id="do_ocr"
                checked={options.do_ocr}
                onCheckedChange={(checked) =>
                  setOptions({ ...options, do_ocr: checked })
                }
              />
            </div>

            {/* Table Structure */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="do_table_structure">테이블 구조</Label>
                <p className="text-xs text-muted-foreground">
                  표 구조 인식 및 변환
                </p>
              </div>
              <Switch
                id="do_table_structure"
                checked={options.do_table_structure}
                onCheckedChange={(checked) =>
                  setOptions({ ...options, do_table_structure: checked })
                }
              />
            </div>

            {/* Table Mode */}
            <div className="space-y-2">
              <Label htmlFor="table_mode">테이블 모드</Label>
              <Select
                value={options.table_mode}
                onValueChange={(value) =>
                  setOptions({ ...options, table_mode: value })
                }
              >
                <SelectTrigger id="table_mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="accurate">정확도 우선</SelectItem>
                  <SelectItem value="fast">속도 우선</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Include Images */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="include_images">이미지 포함</Label>
                <p className="text-xs text-muted-foreground">
                  문서 내 이미지 포함
                </p>
              </div>
              <Switch
                id="include_images"
                checked={options.include_images}
                onCheckedChange={(checked) =>
                  setOptions({ ...options, include_images: checked })
                }
              />
            </div>

            {/* Image Export Mode */}
            <div className="space-y-2">
              <Label htmlFor="image_export_mode">이미지 내보내기</Label>
              <Select
                value={options.image_export_mode}
                onValueChange={(value) =>
                  setOptions({ ...options, image_export_mode: value })
                }
              >
                <SelectTrigger id="image_export_mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="embedded">임베디드</SelectItem>
                  <SelectItem value="referenced">참조</SelectItem>
                  <SelectItem value="placeholder">플레이스홀더</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Formula Enrichment */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="do_formula_enrichment">수식 인식</Label>
                <p className="text-xs text-muted-foreground">
                  LaTeX 수식 변환
                </p>
              </div>
              <Switch
                id="do_formula_enrichment"
                checked={options.do_formula_enrichment}
                onCheckedChange={(checked) =>
                  setOptions({ ...options, do_formula_enrichment: checked })
                }
              />
            </div>

            {/* Page Range */}
            <div className="space-y-2">
              <Label>페이지 범위</Label>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="시작"
                  type="number"
                  value={options.page_range_start}
                  onChange={(e) =>
                    setOptions({ ...options, page_range_start: e.target.value })
                  }
                />
                <Input
                  placeholder="끝"
                  type="number"
                  value={options.page_range_end}
                  onChange={(e) =>
                    setOptions({ ...options, page_range_end: e.target.value })
                  }
                />
              </div>
              <p className="text-xs text-muted-foreground">
                비어있으면 전체 페이지
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
