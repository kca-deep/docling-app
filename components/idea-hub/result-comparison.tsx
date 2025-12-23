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
import { MarkdownMessage } from "@/components/markdown-message"
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

        {/* Consolidated Summary Panel - 검토대상, 유사과제, 불일치 통합 */}
        <Card
          className={cn(
            "mb-4 border-2",
            result.requiresReview
              ? "border-amber-500 bg-amber-50/50 dark:bg-amber-950/20"
              : "border-green-500 bg-green-50/50 dark:bg-green-950/20"
          )}
        >
          <CardContent className="pt-4 pb-4">
            {/* Main Review Status Row */}
            <div className="flex items-center justify-between gap-4 mb-3">
              <div className="flex items-center gap-3">
                {result.requiresReview ? (
                  <div className="p-2 rounded-full bg-amber-100 dark:bg-amber-900/50">
                    <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                  </div>
                ) : (
                  <div className="p-2 rounded-full bg-green-100 dark:bg-green-900/50">
                    <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
                  </div>
                )}
                <div className="text-left">
                  <p className="text-lg font-bold">
                    검토 대상:{" "}
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
                  {result.requiresReview && result.reviewReason && (
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                      {result.reviewReason}
                    </p>
                  )}
                </div>
              </div>

              {/* Status Badges Row */}
              <div className="flex items-center gap-2 flex-wrap justify-end">
                {/* Similar Projects Badge */}
                {result.similarProjects && result.similarProjects.length > 0 ? (
                  <Badge variant="secondary" className="bg-orange-500 hover:bg-orange-500 text-white gap-1">
                    <Copy className="w-3 h-3" />
                    유사과제 {result.similarProjects.length}건
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-green-600 border-green-300 gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    유사과제 없음
                  </Badge>
                )}
                {/* Mismatch Badge */}
                {mismatchItems.length > 0 && (
                  <Badge variant="secondary" className="bg-amber-500 hover:bg-amber-500 text-white gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    불일치 {mismatchItems.length}건
                  </Badge>
                )}
              </div>
            </div>

            {/* Similar Projects Expandable Section */}
            {result.similarProjects && result.similarProjects.length > 0 && (
              <div className="mt-3 pt-3 border-t border-orange-200 dark:border-orange-800">
                <div className="space-y-2">
                  {result.similarProjects.map((proj, idx) => (
                    <div
                      key={proj.submissionId}
                      className={cn(
                        "p-2 rounded-md text-left text-sm flex items-center justify-between gap-2",
                        proj.similarityScore >= 85
                          ? "bg-red-100 dark:bg-red-950/40"
                          : "bg-orange-100 dark:bg-orange-950/40"
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <span className="font-medium truncate block">{proj.projectName}</span>
                        <span className="text-xs text-muted-foreground">{proj.department} | {proj.similarityReason}</span>
                      </div>
                      <Badge
                        variant={proj.similarityScore >= 85 ? "destructive" : "secondary"}
                        className={cn(
                          "shrink-0 text-xs",
                          proj.similarityScore >= 85
                            ? "bg-red-500"
                            : "bg-orange-500 text-white"
                        )}
                      >
                        {proj.similarityScore}%
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* AI 종합의견 */}
        <Card className="mb-4 text-left">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <Brain className="w-5 h-5 text-primary mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-primary mb-2">AI 종합의견</p>
                <div className="text-sm text-foreground">
                  <MarkdownMessage content={result.summary || ""} compact />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Result Table - Required Items */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="w-5 h-5 text-red-500" />
            필수 항목 (1~5번)
          </CardTitle>
        </CardHeader>
        <CardContent className="px-2 sm:px-6">
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
                          <TableCell colSpan={5} className="py-3 px-4">
                            {/* 확장 필드가 있으면 구조화된 UI, 없으면 기존 방식 */}
                            {item.llmJudgment || item.llmQuote || item.llmReasoning ? (
                              <div className="space-y-3">
                                {/* 판단 결과 */}
                                <div className="flex flex-wrap items-start gap-2">
                                  <span className="text-xs font-medium text-primary shrink-0 mt-0.5">📌 판단:</span>
                                  <span className="text-sm font-medium break-words flex-1 min-w-0">{item.llmJudgment || "판단 결과 없음"}</span>
                                  <Badge variant="outline" className="shrink-0">
                                    신뢰도 {Math.round(item.llmConfidence * 100)}%
                                  </Badge>
                                </div>
                                {/* 인용문 */}
                                {item.llmQuote && item.llmQuote !== "관련 언급 없음" && (
                                  <div className="flex items-start gap-2">
                                    <span className="text-xs font-medium text-blue-600 dark:text-blue-400 shrink-0 mt-0.5">📝 인용:</span>
                                    <span className="text-sm italic text-muted-foreground break-words min-w-0">&quot;{item.llmQuote}&quot;</span>
                                  </div>
                                )}
                                {/* 상세 분석 */}
                                {item.llmReasoning && (
                                  <div className="flex items-start gap-2">
                                    <span className="text-xs font-medium text-green-600 dark:text-green-400 shrink-0 mt-0.5">💡 분석:</span>
                                    <span className="text-sm break-words min-w-0">{item.llmReasoning}</span>
                                  </div>
                                )}
                                {/* 교차검증 비교 (불일치 시) */}
                                {item.llmUserComparison && (
                                  <div className="flex items-start gap-2 p-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                                    <span className="text-xs font-medium text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">⚠️ 비교:</span>
                                    <span className="text-sm text-amber-700 dark:text-amber-300 break-words min-w-0">{item.llmUserComparison}</span>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="space-y-2">
                                <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3">
                                  <span className="text-xs text-muted-foreground shrink-0">AI 근거:</span>
                                  <span className="text-sm flex-1 break-words min-w-0">{item.llmEvidence || "판단 근거 없음"}</span>
                                  <Badge variant="outline" className="shrink-0 w-fit">
                                    신뢰도 {Math.round(item.llmConfidence * 100)}%
                                  </Badge>
                                </div>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  )
                })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Result Table - Optional Items */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-blue-500" />
            선택 항목 (6~10번)
          </CardTitle>
        </CardHeader>
        <CardContent className="px-2 sm:px-6">
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
                          <TableCell colSpan={5} className="py-3 px-4">
                            {/* 확장 필드가 있으면 구조화된 UI, 없으면 기존 방식 */}
                            {item.llmJudgment || item.llmQuote || item.llmReasoning ? (
                              <div className="space-y-3">
                                {/* 판단 결과 */}
                                <div className="flex flex-wrap items-start gap-2">
                                  <span className="text-xs font-medium text-primary shrink-0 mt-0.5">📌 판단:</span>
                                  <span className="text-sm font-medium break-words flex-1 min-w-0">{item.llmJudgment || "판단 결과 없음"}</span>
                                  <Badge variant="outline" className="shrink-0">
                                    신뢰도 {Math.round(item.llmConfidence * 100)}%
                                  </Badge>
                                </div>
                                {/* 인용문 */}
                                {item.llmQuote && item.llmQuote !== "관련 언급 없음" && (
                                  <div className="flex items-start gap-2">
                                    <span className="text-xs font-medium text-blue-600 dark:text-blue-400 shrink-0 mt-0.5">📝 인용:</span>
                                    <span className="text-sm italic text-muted-foreground break-words min-w-0">&quot;{item.llmQuote}&quot;</span>
                                  </div>
                                )}
                                {/* 상세 분석 */}
                                {item.llmReasoning && (
                                  <div className="flex items-start gap-2">
                                    <span className="text-xs font-medium text-green-600 dark:text-green-400 shrink-0 mt-0.5">💡 분석:</span>
                                    <span className="text-sm break-words min-w-0">{item.llmReasoning}</span>
                                  </div>
                                )}
                                {/* 교차검증 비교 (불일치 시) */}
                                {item.llmUserComparison && (
                                  <div className="flex items-start gap-2 p-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                                    <span className="text-xs font-medium text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">⚠️ 비교:</span>
                                    <span className="text-sm text-amber-700 dark:text-amber-300 break-words min-w-0">{item.llmUserComparison}</span>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="space-y-2">
                                <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3">
                                  <span className="text-xs text-muted-foreground shrink-0">AI 근거:</span>
                                  <span className="text-sm flex-1 break-words min-w-0">{item.llmEvidence || "판단 근거 없음"}</span>
                                  <Badge variant="outline" className="shrink-0 w-fit">
                                    신뢰도 {Math.round(item.llmConfidence * 100)}%
                                  </Badge>
                                </div>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  )
                })}
            </TableBody>
          </Table>
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
