"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  AlertTriangle,
  Brain,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ChevronDown,
  Download,
  RotateCcw,
  FileText,
  Shield,
  ArrowRight,
  Copy,
  Calendar,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { apiEndpoints } from "@/lib/api-config"
import type { AnalysisResult, AnalysisResultItem, SimilarProject } from "./analysis-progress"

// ProjectInfo type for result display
export interface ProjectInfo {
  projectName: string
  department: string
  managerName: string
  contact: string
  email: string
}

interface ResultComparisonProps {
  result: AnalysisResult
  projectInfo: ProjectInfo
  onRestart: () => void
}

type MatchStatus = "match" | "mismatch" | "reference" | "keep"

function getMatchStatus(item: AnalysisResultItem): MatchStatus {
  // userAnswer가 null이거나 "unknown"이면 AI 결과 참조
  if (item.userAnswer === null || item.userAnswer === "unknown") {
    return "reference"
  }
  if (item.llmAnswer === "need_check") {
    return "keep" // 사용자 선택 유지
  }
  if (item.userAnswer === item.llmAnswer) {
    return "match"
  }
  return "mismatch"
}

function getStatusBadge(status: MatchStatus) {
  switch (status) {
    case "match":
      return (
        <Badge variant="default" className="bg-green-500 hover:bg-green-500 gap-1">
          <CheckCircle2 className="w-3 h-3" />
          일치
        </Badge>
      )
    case "mismatch":
      return (
        <Badge variant="destructive" className="bg-amber-500 hover:bg-amber-500 gap-1">
          <AlertTriangle className="w-3 h-3" />
          불일치
        </Badge>
      )
    case "reference":
      return (
        <Badge variant="secondary" className="bg-blue-500 hover:bg-blue-500 text-white gap-1">
          <HelpCircle className="w-3 h-3" />
          참조
        </Badge>
      )
    case "keep":
      return (
        <Badge variant="outline" className="gap-1">
          <CheckCircle2 className="w-3 h-3" />
          유지
        </Badge>
      )
  }
}

function formatAnswer(answer: string | null) {
  switch (answer) {
    case "yes":
      return "예"
    case "no":
      return "아니오"
    case "unknown":
      return "모름"
    case "need_check":
      return "확인필요"
    default:
      return "-"
  }
}

export function ResultComparison({ result, projectInfo, onRestart }: ResultComparisonProps) {
  // 기본적으로 모든 항목을 펼침
  const [expandedItems, setExpandedItems] = useState<Set<number>>(
    new Set(result.items.map(item => item.number))
  )

  const toggleItem = (itemNumber: number) => {
    setExpandedItems((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(itemNumber)) {
        newSet.delete(itemNumber)
      } else {
        newSet.add(itemNumber)
      }
      return newSet
    })
  }

  const mismatchItems = result.items.filter(
    (item) => getMatchStatus(item) === "mismatch"
  )

  const handleDownloadPdf = async () => {
    try {
      const response = await fetch(
        `${apiEndpoints.selfcheck}/${result.submissionId}/pdf`,
        {
          credentials: "include",
        }
      )
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `selfcheck_${projectInfo.projectName.slice(0, 20)}_${result.submissionId.slice(0, 8)}.pdf`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)
      } else if (response.status === 401) {
        alert("로그인이 필요합니다.")
      } else {
        alert("PDF 다운로드에 실패했습니다.")
      }
    } catch (error) {
      console.error("PDF download error:", error)
      alert("PDF 다운로드 중 오류가 발생했습니다.")
    }
  }

  return (
    <div className="space-y-6">
      {/* Header with Result Summary */}
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold mb-4">분석 결과 확인</h2>

        {/* AI 종합의견 */}
        <Card className="mb-4 text-left">
          <CardContent className="pt-4">
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <Brain className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-sm text-primary mb-2">AI 종합의견</p>
                  <div className="text-sm text-muted-foreground space-y-1">
                    {/* 필수항목 중 "예" 응답 항목 */}
                    {result.items.filter(i => i.category === "required" && i.llmAnswer === "yes").length > 0 ? (
                      <p>
                        <span className="text-amber-600 dark:text-amber-400 font-medium">주의:</span>{" "}
                        필수 항목 중{" "}
                        {result.items
                          .filter(i => i.category === "required" && i.llmAnswer === "yes")
                          .map(i => `${i.number}번(${i.shortLabel})`)
                          .join(", ")}
                        이(가) "예"로 분석되어 상위기관 보안성 검토가 필요합니다.
                      </p>
                    ) : (
                      <p>
                        <span className="text-green-600 dark:text-green-400 font-medium">양호:</span>{" "}
                        필수 항목(1~4번)에서 보안 검토가 필요한 항목이 발견되지 않았습니다.
                      </p>
                    )}
                    {/* 선택항목 중 "예" 응답 항목 */}
                    {result.items.filter(i => i.category === "optional" && i.llmAnswer === "yes").length > 0 && (
                      <p>
                        <span className="text-blue-600 dark:text-blue-400 font-medium">참고:</span>{" "}
                        선택 항목 중{" "}
                        {result.items
                          .filter(i => i.category === "optional" && i.llmAnswer === "yes")
                          .map(i => `${i.number}번(${i.shortLabel})`)
                          .join(", ")}
                        이(가) "예"로 분석되었습니다. 해당 사항에 대한 추가 검토를 권장합니다.
                      </p>
                    )}
                    {/* 불일치 항목 */}
                    {mismatchItems.length > 0 && (
                      <p>
                        <span className="text-amber-600 dark:text-amber-400 font-medium">확인필요:</span>{" "}
                        {mismatchItems.length}개 항목에서 사용자 선택과 AI 분석 결과가 다릅니다.
                        해당 항목의 AI 근거를 확인해주세요.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Similar Projects Section */}
        {result.similarProjects && result.similarProjects.length > 0 && (
          <Card className="mb-4 text-left border-2 border-orange-400 bg-orange-50 dark:bg-orange-950/20">
            <CardContent className="pt-4">
              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <Copy className="w-5 h-5 text-orange-600 dark:text-orange-400 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium text-sm text-orange-700 dark:text-orange-300 mb-2">
                      유사 과제 발견 ({result.similarProjects.length}건)
                    </p>
                    <div className="space-y-2">
                      {result.similarProjects.map((proj, idx) => (
                        <div
                          key={proj.submissionId}
                          className={cn(
                            "p-3 rounded-lg border",
                            proj.similarityScore >= 85
                              ? "bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-700"
                              : "bg-white dark:bg-gray-900 border-orange-200 dark:border-orange-800"
                          )}
                        >
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <p className="font-medium text-sm">
                              {idx + 1}. {proj.projectName}
                              <span className="text-muted-foreground font-normal ml-1">
                                ({proj.department}, {proj.managerName})
                              </span>
                            </p>
                            <Badge
                              variant={proj.similarityScore >= 85 ? "destructive" : "secondary"}
                              className={cn(
                                "shrink-0",
                                proj.similarityScore >= 85
                                  ? "bg-red-500 hover:bg-red-500"
                                  : "bg-orange-500 hover:bg-orange-500 text-white"
                              )}
                            >
                              {proj.similarityScore}%
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {proj.createdAt ? new Date(proj.createdAt).toLocaleDateString('ko-KR') : '-'}
                            </span>
                            <span className="flex-1">{proj.similarityReason}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-orange-600 dark:text-orange-400 mt-2">
                      * 유사한 과제가 이미 진행 중일 수 있습니다. 중복 추진 여부를 확인하시기 바랍니다.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* No Similar Projects Message */}
        {(!result.similarProjects || result.similarProjects.length === 0) && (
          <Card className="mb-4 text-left border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0" />
                <p className="text-sm text-green-700 dark:text-green-300">
                  유사 과제가 발견되지 않았습니다.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Review Status Card */}
        <Card
          className={cn(
            "border-2",
            result.requiresReview
              ? "border-amber-500 bg-amber-50 dark:bg-amber-950/20"
              : "border-green-500 bg-green-50 dark:bg-green-950/20"
          )}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-center gap-3 mb-3">
              {result.requiresReview ? (
                <AlertTriangle className="w-8 h-8 text-amber-600 dark:text-amber-400" />
              ) : (
                <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
              )}
              <div className="text-left">
                <p className="text-lg font-bold">
                  상위기관 보안성 검토 대상:{" "}
                  <span
                    className={
                      result.requiresReview
                        ? "text-amber-700 dark:text-amber-300"
                        : "text-green-700 dark:text-green-300"
                    }
                  >
                    {result.requiresReview ? "예" : "아니오"}
                  </span>
                </p>
                {result.requiresReview && (
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    {result.reviewReason}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Mismatch Warning */}
      {mismatchItems.length > 0 && (
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-amber-700 dark:text-amber-300">
              <AlertTriangle className="w-4 h-4" />
              불일치 항목 ({mismatchItems.length}건)
            </CardTitle>
            <CardDescription className="text-amber-600 dark:text-amber-400">
              사용자 선택과 AI 분석 결과가 다른 항목입니다. 해당 항목의 AI 근거를 확인해주세요.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Result Table - Required Items */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="w-5 h-5 text-red-500" />
            필수 항목 (1~4번)
          </CardTitle>
        </CardHeader>
        <CardContent className="px-2 sm:px-6">
          <div className="overflow-x-auto -mx-2 sm:mx-0">
            <div className="min-w-[480px] px-2 sm:px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>점검 항목</TableHead>
                <TableHead className="w-20 text-center">내 선택</TableHead>
                <TableHead className="w-20 text-center">AI 분석</TableHead>
                <TableHead className="w-20 text-center">상태</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.items
                .filter((item) => item.category === "required")
                .map((item) => {
                  const status = getMatchStatus(item)
                  const isExpanded = expandedItems.has(item.number)
                  return (
                    <>
                      <TableRow
                        key={item.number}
                        className={cn(
                          status === "mismatch" && "bg-amber-50 dark:bg-amber-950/10"
                        )}
                      >
                        <TableCell>
                          <Badge variant="outline">{item.number}</Badge>
                        </TableCell>
                        <TableCell>
                          <button
                            type="button"
                            onClick={() => toggleItem(item.number)}
                            className="flex items-center gap-2 hover:text-primary transition-colors cursor-pointer text-left"
                          >
                            <span className="text-sm">{item.shortLabel}</span>
                            <ChevronDown className={cn("w-4 h-4 transition-transform", isExpanded && "rotate-180")} />
                          </button>
                        </TableCell>
                        <TableCell className="text-center">
                          <span
                            className={cn(
                              "font-medium",
                              item.userAnswer === "yes" && "text-red-600",
                              item.userAnswer === "no" && "text-green-600"
                            )}
                          >
                            {formatAnswer(item.userAnswer)}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span
                            className={cn(
                              "font-medium",
                              item.llmAnswer === "yes" && "text-red-600",
                              item.llmAnswer === "no" && "text-green-600"
                            )}
                          >
                            {formatAnswer(item.llmAnswer)}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          {getStatusBadge(status)}
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow key={`${item.number}-detail`} className="bg-muted/30">
                          <TableCell colSpan={5} className="py-2 px-4">
                            <div className="space-y-2">
                              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                                <span className="text-xs text-muted-foreground shrink-0">AI 근거:</span>
                                <span className="text-sm flex-1">{item.llmEvidence || "판단 근거 없음"}</span>
                                <Badge variant="outline" className="shrink-0 w-fit">
                                  신뢰도 {Math.round(item.llmConfidence * 100)}%
                                </Badge>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  )
                })}
            </TableBody>
          </Table>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Result Table - Optional Items */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-blue-500" />
            선택 항목 (5~10번)
          </CardTitle>
        </CardHeader>
        <CardContent className="px-2 sm:px-6">
          <div className="overflow-x-auto -mx-2 sm:mx-0">
            <div className="min-w-[480px] px-2 sm:px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>점검 항목</TableHead>
                <TableHead className="w-20 text-center">내 선택</TableHead>
                <TableHead className="w-20 text-center">AI 분석</TableHead>
                <TableHead className="w-20 text-center">상태</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.items
                .filter((item) => item.category === "optional")
                .map((item) => {
                  const status = getMatchStatus(item)
                  const isExpanded = expandedItems.has(item.number)
                  return (
                    <>
                      <TableRow key={item.number}>
                        <TableCell>
                          <Badge variant="outline">{item.number}</Badge>
                        </TableCell>
                        <TableCell>
                          <button
                            type="button"
                            onClick={() => toggleItem(item.number)}
                            className="flex items-center gap-2 hover:text-primary transition-colors cursor-pointer text-left"
                          >
                            <span className="text-sm">{item.shortLabel}</span>
                            <ChevronDown className={cn("w-4 h-4 transition-transform", isExpanded && "rotate-180")} />
                          </button>
                        </TableCell>
                        <TableCell className="text-center">
                          <span
                            className={cn(
                              "font-medium",
                              item.userAnswer === "yes" && "text-red-600",
                              item.userAnswer === "no" && "text-green-600"
                            )}
                          >
                            {formatAnswer(item.userAnswer)}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span
                            className={cn(
                              "font-medium",
                              item.llmAnswer === "yes" && "text-red-600",
                              item.llmAnswer === "no" && "text-green-600"
                            )}
                          >
                            {formatAnswer(item.llmAnswer)}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          {getStatusBadge(status)}
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow key={`${item.number}-detail`} className="bg-muted/30">
                          <TableCell colSpan={5} className="py-2 px-4">
                            <div className="space-y-2">
                              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                                <span className="text-xs text-muted-foreground shrink-0">AI 근거:</span>
                                <span className="text-sm flex-1">{item.llmEvidence || "판단 근거 없음"}</span>
                                <Badge variant="outline" className="shrink-0 w-fit">
                                  신뢰도 {Math.round(item.llmConfidence * 100)}%
                                </Badge>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  )
                })}
            </TableBody>
          </Table>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Next Steps - Responsive Stepper */}
      {result.requiresReview && (
        <Card className="border-primary/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-5 h-5" />
              다음 단계 안내
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Desktop: Horizontal Stepper */}
            <div className="hidden sm:flex items-start justify-between relative py-4">
              {/* Connector Line */}
              <div className="absolute top-[calc(1rem+12px)] left-[calc(16.67%-12px)] right-[calc(16.67%-12px)] h-0.5 bg-muted-foreground/20" />

              {result.nextSteps.map((step, index) => {
                const isFirst = index === 0
                return (
                  <div
                    key={index}
                    className="flex flex-col items-center flex-1 relative z-10"
                  >
                    {/* Step Circle */}
                    <div
                      className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-colors",
                        isFirst
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background text-muted-foreground border-muted-foreground/30"
                      )}
                    >
                      {index + 1}
                    </div>

                    {/* Step Label */}
                    <div className="mt-3 text-center px-2">
                      <p className={cn(
                        "text-sm font-medium",
                        isFirst ? "text-foreground" : "text-muted-foreground"
                      )}>
                        {step.split(':')[0] || step}
                      </p>
                      {step.includes(':') && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {step.split(':').slice(1).join(':').trim()}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Mobile: Vertical Timeline */}
            <div className="sm:hidden space-y-0">
              {result.nextSteps.map((step, index) => {
                const isFirst = index === 0
                const isLast = index === result.nextSteps.length - 1
                return (
                  <div key={index} className="flex gap-3">
                    {/* Timeline */}
                    <div className="flex flex-col items-center">
                      <div
                        className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-colors shrink-0",
                          isFirst
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background text-muted-foreground border-muted-foreground/30"
                        )}
                      >
                        {index + 1}
                      </div>
                      {!isLast && (
                        <div className="w-0.5 flex-1 min-h-[24px] bg-muted-foreground/20" />
                      )}
                    </div>

                    {/* Content */}
                    <div className={cn("flex-1 pb-4", isLast && "pb-0")}>
                      <p className={cn(
                        "text-sm font-medium",
                        isFirst ? "text-foreground" : "text-muted-foreground"
                      )}>
                        {step.split(':')[0] || step}
                      </p>
                      {step.includes(':') && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {step.split(':').slice(1).join(':').trim()}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap justify-center gap-3 pt-4">
        <Button variant="outline" onClick={onRestart} className="gap-2">
          <RotateCcw className="w-4 h-4" />
          처음부터 다시
        </Button>
        <Button onClick={handleDownloadPdf} className="gap-2">
          <Download className="w-4 h-4" />
          PDF 다운로드
        </Button>
      </div>

      {/* Disclaimer */}
      <p className="text-xs text-muted-foreground text-center">
        본 결과는 AI가 자동 분석한 것이며, 최종 판단은 정보보호팀의 검토를 거쳐야 합니다.
        <br />
        분석모델: {result.usedModel} | 소요시간: {(result.analysisTimeMs / 1000).toFixed(1)}초
      </p>
    </div>
  )
}
