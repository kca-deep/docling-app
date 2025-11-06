"use client";

import { useState } from "react";
import { Upload, FileText, Loader2, CheckCircle2, XCircle, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";

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

export default function ParsePage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ConvertResult | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      formData.append("target_type", "inbody");

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
    <div className="container mx-auto px-4 md:px-6 py-16 max-w-4xl">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-4">
          문서 파싱
        </h1>
        <p className="text-lg text-muted-foreground">
          PDF 파일을 업로드하여 마크다운으로 변환하세요
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          {!result ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* 파일 업로드 영역 */}
              <div className="border-2 border-dashed border-muted-foreground/25 rounded-xl p-12 text-center hover:border-primary/50 transition-colors bg-muted/5">
                <input
                  type="file"
                  id="file-upload"
                  className="hidden"
                  accept=".pdf,.docx,.doc,.pptx,.ppt"
                  onChange={handleFileChange}
                />
                <label
                  htmlFor="file-upload"
                  className="cursor-pointer flex flex-col items-center space-y-4"
                >
                  <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center">
                    <Upload className="w-10 h-10 text-primary" />
                  </div>
                  <div>
                    <p className="text-lg font-semibold">
                      파일을 선택하거나 드래그하세요
                    </p>
                    <p className="text-sm text-muted-foreground mt-2">
                      PDF, DOCX, PPTX 파일 지원
                    </p>
                  </div>
                </label>
              </div>

              {/* 선택된 파일 정보 */}
              {file && (
                <Card className="bg-primary/5 border-primary/20">
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <FileText className="w-6 h-6 text-primary" />
                        <div>
                          <p className="font-medium">
                            {file.name}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="secondary">
                              {(file.size / 1024 / 1024).toFixed(2)} MB
                            </Badge>
                            <Badge variant="outline">
                              {file.type || "Unknown type"}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={handleReset}
                      >
                        <XCircle className="w-5 h-5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
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
    </div>
  );
}
