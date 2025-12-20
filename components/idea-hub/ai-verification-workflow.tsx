"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  FileText,
  Database,
  Brain,
  GitCompare,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Search,
  ListChecks,
  Shield,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface WorkflowStep {
  icon: React.ReactNode
  title: string
  description: string
  details: string[]
  color: string
  bgColor: string
}

const WORKFLOW_STEPS: WorkflowStep[] = [
  {
    icon: <FileText className="w-5 h-5" />,
    title: "텍스트 임베딩",
    description: "BGE-M3-Korean",
    details: [
      "과제명 + 과제내용 분석",
      "1024차원 벡터로 변환",
    ],
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
  },
  {
    icon: <Search className="w-5 h-5" />,
    title: "유사과제 검색",
    description: "벡터 유사도 분석",
    details: [
      "기존 과제와 비교",
      "코사인 유사도 계산",
    ],
    color: "text-purple-600 dark:text-purple-400",
    bgColor: "bg-purple-100 dark:bg-purple-900/30",
  },
  {
    icon: <Brain className="w-5 h-5" />,
    title: "LLM 분석",
    description: "GPT-OSS 20B",
    details: [
      "점검항목 1~10번 개별 분석",
      "과제 내용 기반 판단",
    ],
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-100 dark:bg-amber-900/30",
  },
  {
    icon: <GitCompare className="w-5 h-5" />,
    title: "교차검증",
    description: "사용자 vs AI 비교",
    details: [
      "선택 결과 대조",
      "불일치 항목 표시",
    ],
    color: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-100 dark:bg-green-900/30",
  },
  {
    icon: <Shield className="w-5 h-5" />,
    title: "최종 판정",
    description: "검토 대상 결정",
    details: [
      "필수항목 기준 판정",
      "PDF 결과서 생성",
    ],
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-100 dark:bg-red-900/30",
  },
]

export function AIVerificationWorkflow() {
  return (
    <Card className="border-2 border-dashed border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          AI 검증 프로세스
          <Badge variant="secondary" className="ml-2 text-xs">
            자동화
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Desktop: Horizontal Layout */}
        <div className="hidden lg:block">
          <div className="flex items-start justify-between gap-2">
            {WORKFLOW_STEPS.map((step, index) => (
              <div key={step.title} className="flex items-start flex-1">
                {/* Step Card */}
                <div className="flex-1 text-center">
                  <div
                    className={cn(
                      "w-12 h-12 mx-auto rounded-xl flex items-center justify-center mb-2",
                      step.bgColor
                    )}
                  >
                    <span className={step.color}>{step.icon}</span>
                  </div>
                  <h4 className="font-semibold text-sm mb-0.5">{step.title}</h4>
                  <p className="text-xs text-muted-foreground mb-2">
                    {step.description}
                  </p>
                  <ul className="text-xs text-muted-foreground space-y-0.5">
                    {step.details.map((detail, i) => (
                      <li key={i} className="flex items-center justify-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0" />
                        <span>{detail}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                {/* Arrow */}
                {index < WORKFLOW_STEPS.length - 1 && (
                  <div className="flex items-center justify-center px-1 pt-5">
                    <ArrowRight className="w-4 h-4 text-muted-foreground/50" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Tablet: Compact Horizontal */}
        <div className="hidden md:block lg:hidden">
          <div className="flex items-center justify-between gap-1 overflow-x-auto pb-2">
            {WORKFLOW_STEPS.map((step, index) => (
              <div key={step.title} className="flex items-center">
                <div className="flex flex-col items-center text-center min-w-[80px]">
                  <div
                    className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center mb-1",
                      step.bgColor
                    )}
                  >
                    <span className={step.color}>{step.icon}</span>
                  </div>
                  <span className="text-xs font-medium">{step.title}</span>
                </div>
                {index < WORKFLOW_STEPS.length - 1 && (
                  <ArrowRight className="w-3 h-3 text-muted-foreground/40 mx-1 shrink-0" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Mobile: Compact Grid */}
        <div className="md:hidden">
          <div className="grid grid-cols-5 gap-1">
            {WORKFLOW_STEPS.map((step, index) => (
              <div key={step.title} className="flex flex-col items-center text-center">
                <div
                  className={cn(
                    "w-9 h-9 rounded-lg flex items-center justify-center mb-1",
                    step.bgColor
                  )}
                >
                  <span className={cn(step.color, "[&>svg]:w-4 [&>svg]:h-4")}>
                    {step.icon}
                  </span>
                </div>
                <span className="text-[10px] font-medium leading-tight">
                  {step.title.split(' ')[0]}
                </span>
              </div>
            ))}
          </div>
          {/* Mobile: Process description */}
          <p className="text-xs text-muted-foreground mt-3 text-center">
            임베딩 → 유사과제검색 → LLM분석 → 교차검증 → 판정
          </p>
        </div>

        {/* Info Badge */}
        <div className="mt-4 flex items-center justify-center gap-2 flex-wrap">
          <Badge variant="outline" className="text-xs gap-1">
            <Database className="w-3 h-3" />
            BGE-M3-Korean
          </Badge>
          <Badge variant="outline" className="text-xs gap-1">
            <Brain className="w-3 h-3" />
            GPT-OSS 20B
          </Badge>
          <Badge variant="outline" className="text-xs gap-1">
            <ListChecks className="w-3 h-3" />
            10개 점검항목
          </Badge>
        </div>
      </CardContent>
    </Card>
  )
}
