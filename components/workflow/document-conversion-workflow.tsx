"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  FileText,
  Upload,
  Cpu,
  FileCode,
  Database,
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
    icon: <Upload className="w-5 h-5" />,
    title: "파일 업로드",
    description: "문서 검증",
    details: [
      "PDF, DOCX, PPTX, XLSX 등",
      "최대 50MB 지원",
    ],
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
  },
  {
    icon: <Cpu className="w-5 h-5" />,
    title: "파싱 전략 선택",
    description: "Docling / Qwen3-VL",
    details: [
      "Docling: 구조화 문서",
      "Qwen3-VL: 스캔/OCR 문서",
    ],
    color: "text-purple-600 dark:text-purple-400",
    bgColor: "bg-purple-100 dark:bg-purple-900/30",
  },
  {
    icon: <FileCode className="w-5 h-5" />,
    title: "문서 파싱",
    description: "구조 추출",
    details: [
      "테이블/이미지 인식",
      "섹션/헤딩 추출",
    ],
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-100 dark:bg-amber-900/30",
  },
  {
    icon: <FileText className="w-5 h-5" />,
    title: "Markdown 변환",
    description: "형식 변환",
    details: [
      "표준 MD 포맷",
      "메타데이터 포함",
    ],
    color: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-100 dark:bg-green-900/30",
  },
  {
    icon: <Database className="w-5 h-5" />,
    title: "결과 저장",
    description: "SQLite DB",
    details: [
      "문서 이력 관리",
      "카테고리 분류",
    ],
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-100 dark:bg-red-900/30",
  },
]

export function DocumentConversionWorkflow() {
  return (
    <Card className="border-2 border-dashed border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-transparent">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-blue-500" />
          문서변환 워크플로우
          <Badge variant="secondary" className="ml-2 text-xs">
            Docling + Qwen3-VL
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
            업로드 → 전략선택 → 파싱 → MD변환 → 저장
          </p>
        </div>

        {/* Info Badge */}
        <div className="mt-4 flex items-center justify-center gap-2 flex-wrap">
          <Badge variant="outline" className="text-xs gap-1">
            <Cpu className="w-3 h-3" />
            Docling 1.9.0
          </Badge>
          <Badge variant="outline" className="text-xs gap-1">
            <Cpu className="w-3 h-3" />
            Qwen3-VL 8B
          </Badge>
        </div>
      </CardContent>
    </Card>
  )
}
