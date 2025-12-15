"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ChevronDown,
  Download,
  RotateCcw,
  Save,
  FileText,
  Shield,
  ArrowRight,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { AnalysisResult, AnalysisResultItem } from "./analysis-progress"

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
  if (item.userAnswer === "unknown") {
    return "reference" // AI 결과 참조
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
  const [finalAnswers, setFinalAnswers] = useState<Record<number, string>>(
    Object.fromEntries(
      result.items.map((item) => {
        const status = getMatchStatus(item)
        // Default: use user's answer for match/keep, AI's answer for reference, user's for mismatch
        let defaultAnswer: string | null = item.userAnswer
        if (status === "reference" && item.llmAnswer) {
          defaultAnswer = item.llmAnswer
        }
        return [item.number, defaultAnswer || ""]
      })
    )
  )

  const mismatchItems = result.items.filter(
    (item) => getMatchStatus(item) === "mismatch"
  )

  const requiredYesCount = result.items.filter(
    (item) =>
      item.category === "required" &&
      (finalAnswers[item.number] === "yes" || item.llmAnswer === "yes")
  ).length

  const handleDownloadPdf = async () => {
    // TODO: Implement PDF download
    alert("PDF 다운로드 기능은 백엔드 연동 후 사용 가능합니다.")
  }

  const handleSave = async () => {
    // TODO: Implement save
    alert("저장 기능은 로그인 후 사용 가능합니다.")
  }

  return (
    <div className="space-y-6">
      {/* Header with Result Summary */}
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold mb-4">분석 결과 확인</h2>

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
              사용자 선택과 AI 분석 결과가 다른 항목입니다. 아래에서 최종 선택을 확인해주세요.
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
        <CardContent>
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
                  return (
                    <Collapsible key={item.number} asChild>
                      <>
                        <TableRow
                          className={cn(
                            status === "mismatch" && "bg-amber-50 dark:bg-amber-950/10"
                          )}
                        >
                          <TableCell>
                            <Badge variant="outline">{item.number}</Badge>
                          </TableCell>
                          <TableCell>
                            <CollapsibleTrigger className="flex items-center gap-2 hover:text-primary transition-colors">
                              <span className="text-sm">{item.shortLabel}</span>
                              <ChevronDown className="w-4 h-4" />
                            </CollapsibleTrigger>
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
                        <CollapsibleContent asChild>
                          <TableRow className="bg-muted/30">
                            <TableCell colSpan={5} className="p-4">
                              <div className="space-y-3">
                                <div>
                                  <p className="text-xs text-muted-foreground mb-1">
                                    AI 판단 근거
                                  </p>
                                  <p className="text-sm">{item.llmEvidence}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground">
                                    신뢰도:
                                  </span>
                                  <Badge variant="outline">
                                    {Math.round(item.llmConfidence * 100)}%
                                  </Badge>
                                </div>
                                {status === "mismatch" && (
                                  <div className="pt-2 border-t">
                                    <p className="text-sm font-medium mb-2">
                                      최종 선택:
                                    </p>
                                    <RadioGroup
                                      value={finalAnswers[item.number]}
                                      onValueChange={(v) =>
                                        setFinalAnswers((prev) => ({
                                          ...prev,
                                          [item.number]: v,
                                        }))
                                      }
                                      className="flex gap-4"
                                    >
                                      <div className="flex items-center space-x-2">
                                        <RadioGroupItem
                                          value="yes"
                                          id={`final-${item.number}-yes`}
                                        />
                                        <Label htmlFor={`final-${item.number}-yes`}>
                                          예
                                        </Label>
                                      </div>
                                      <div className="flex items-center space-x-2">
                                        <RadioGroupItem
                                          value="no"
                                          id={`final-${item.number}-no`}
                                        />
                                        <Label htmlFor={`final-${item.number}-no`}>
                                          아니오
                                        </Label>
                                      </div>
                                      <div className="flex items-center space-x-2">
                                        <RadioGroupItem
                                          value="need_check"
                                          id={`final-${item.number}-check`}
                                        />
                                        <Label htmlFor={`final-${item.number}-check`}>
                                          확인필요
                                        </Label>
                                      </div>
                                    </RadioGroup>
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        </CollapsibleContent>
                      </>
                    </Collapsible>
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
            선택 항목 (5~10번)
          </CardTitle>
        </CardHeader>
        <CardContent>
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
                  return (
                    <TableRow key={item.number}>
                      <TableCell>
                        <Badge variant="outline">{item.number}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">{item.shortLabel}</TableCell>
                      <TableCell className="text-center">
                        {formatAnswer(item.userAnswer)}
                      </TableCell>
                      <TableCell className="text-center">
                        {formatAnswer(item.llmAnswer)}
                      </TableCell>
                      <TableCell className="text-center">
                        {getStatusBadge(status)}
                      </TableCell>
                    </TableRow>
                  )
                })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Next Steps */}
      {result.requiresReview && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-5 h-5" />
              다음 단계 안내
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3">
              {result.nextSteps.map((step, index) => (
                <li key={index} className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-medium">
                    {index + 1}
                  </span>
                  <span className="text-sm">{step}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap justify-center gap-3 pt-4">
        <Button variant="outline" onClick={onRestart} className="gap-2">
          <RotateCcw className="w-4 h-4" />
          처음부터 다시
        </Button>
        <Button variant="outline" onClick={handleSave} className="gap-2">
          <Save className="w-4 h-4" />
          저장
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
