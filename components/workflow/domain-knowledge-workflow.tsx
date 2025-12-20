"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  BookOpen,
  ClipboardList,
  FileEdit,
  Database,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  Users,
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
    icon: <BookOpen className="w-5 h-5" />,
    title: "문헌정보 현행화",
    description: "기존 자료 분석",
    details: [
      "업무 매뉴얼 수집",
      "FAQ 데이터 정리",
    ],
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
  },
  {
    icon: <ClipboardList className="w-5 h-5" />,
    title: "수요기반 설문",
    description: "현업 니즈 파악",
    details: [
      "업무부서 설문",
      "Q&A 수집",
    ],
    color: "text-purple-600 dark:text-purple-400",
    bgColor: "bg-purple-100 dark:bg-purple-900/30",
  },
  {
    icon: <FileEdit className="w-5 h-5" />,
    title: "답변서 작성",
    description: "전문가 검증",
    details: [
      "임피제위원 검증",
      "근거규정 명시",
    ],
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-100 dark:bg-amber-900/30",
  },
  {
    icon: <Database className="w-5 h-5" />,
    title: "데이터 전처리",
    description: "벡터DB 등록",
    details: [
      "임베딩 생성",
      "Qdrant 저장",
    ],
    color: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-100 dark:bg-green-900/30",
  },
]

export function DomainKnowledgeWorkflow() {
  return (
    <Card className="border-2 border-dashed border-red-500/20 bg-gradient-to-br from-red-500/5 to-transparent">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-red-500" />
          도메인지식 정비 워크플로우
          <Badge variant="secondary" className="ml-2 text-xs">
            현업 전문가 검증
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Desktop: Horizontal Layout */}
        <div className="hidden lg:block">
          <div className="flex items-start justify-between gap-2">
            {WORKFLOW_STEPS.map((step, index) => (
              <div key={step.title} className="flex items-start flex-1">
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
                {index < WORKFLOW_STEPS.length - 1 && (
                  <div className="flex items-center justify-center px-1 pt-5">
                    <ArrowRight className="w-4 h-4 text-muted-foreground/50" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Mobile: Compact Grid */}
        <div className="lg:hidden">
          <div className="grid grid-cols-4 gap-1">
            {WORKFLOW_STEPS.map((step) => (
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
          <p className="text-xs text-muted-foreground mt-3 text-center">
            문헌정비 → 설문조사 → 검증 → DB등록
          </p>
        </div>

        {/* Info Badge */}
        <div className="mt-4 flex items-center justify-center gap-2 flex-wrap">
          <Badge variant="outline" className="text-xs gap-1">
            <Users className="w-3 h-3" />
            임피제위원 검증
          </Badge>
          <Badge variant="outline" className="text-xs gap-1">
            <Database className="w-3 h-3" />
            502개 Q&A
          </Badge>
        </div>
      </CardContent>
    </Card>
  )
}
