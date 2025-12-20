"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  MessageSquare,
  Search,
  ListOrdered,
  Brain,
  Send,
  ArrowRight,
  CheckCircle2,
  Sparkles,
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
    icon: <MessageSquare className="w-5 h-5" />,
    title: "질의 입력",
    description: "사용자 질문",
    details: [
      "자연어 질의",
      "컬렉션 선택",
    ],
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
  },
  {
    icon: <Search className="w-5 h-5" />,
    title: "벡터 검색",
    description: "Qdrant ANN",
    details: [
      "BGE-M3 임베딩",
      "Cosine 유사도",
    ],
    color: "text-purple-600 dark:text-purple-400",
    bgColor: "bg-purple-100 dark:bg-purple-900/30",
  },
  {
    icon: <ListOrdered className="w-5 h-5" />,
    title: "리랭킹",
    description: "BGE Reranker",
    details: [
      "검색 결과 재순위화",
      "관련성 점수 산출",
    ],
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-100 dark:bg-amber-900/30",
  },
  {
    icon: <Brain className="w-5 h-5" />,
    title: "LLM 생성",
    description: "GPT-OSS / EXAONE",
    details: [
      "컨텍스트 기반 답변",
      "스트리밍 출력",
    ],
    color: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-100 dark:bg-green-900/30",
  },
  {
    icon: <Send className="w-5 h-5" />,
    title: "응답 반환",
    description: "출처 포함",
    details: [
      "답변 + 참조문서",
      "대화 이력 저장",
    ],
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-100 dark:bg-red-900/30",
  },
]

export function RagChatbotWorkflow() {
  return (
    <Card className="border-2 border-dashed border-green-500/20 bg-gradient-to-br from-green-500/5 to-transparent">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-green-500" />
          RAG 챗봇 워크플로우
          <Badge variant="secondary" className="ml-2 text-xs">
            검색 + 생성
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
          <div className="grid grid-cols-5 gap-1">
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
            질의 → 검색 → 리랭킹 → LLM생성 → 응답
          </p>
        </div>

        {/* Info Badge */}
        <div className="mt-4 flex items-center justify-center gap-2 flex-wrap">
          <Badge variant="outline" className="text-xs gap-1">
            <Brain className="w-3 h-3" />
            GPT-OSS 20B
          </Badge>
          <Badge variant="outline" className="text-xs gap-1">
            <ListOrdered className="w-3 h-3" />
            BGE Reranker
          </Badge>
        </div>
      </CardContent>
    </Card>
  )
}
