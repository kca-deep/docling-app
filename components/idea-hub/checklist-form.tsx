"use client"

import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { AlertTriangle, CheckCircle2, HelpCircle } from "lucide-react"
import { cn } from "@/lib/utils"

export interface ChecklistItem {
  number: number
  category: "required" | "optional"
  question: string
  shortLabel: string
  userAnswer: "yes" | "no" | "unknown" | null
  userDetails: string
}

interface ChecklistFormProps {
  items: ChecklistItem[]
  onChange: (items: ChecklistItem[]) => void
}

export function ChecklistForm({ items, onChange }: ChecklistFormProps) {
  const requiredItems = items.filter((item) => item.category === "required")
  const optionalItems = items.filter((item) => item.category === "optional")

  const handleAnswerChange = (index: number, answer: "yes" | "no" | "unknown") => {
    const newItems = [...items]
    newItems[index] = { ...newItems[index], userAnswer: answer }
    onChange(newItems)
  }

  const handleDetailsChange = (index: number, details: string) => {
    const newItems = [...items]
    newItems[index] = { ...newItems[index], userDetails: details }
    onChange(newItems)
  }

  const answeredCount = items.filter((item) => item.userAnswer !== null).length

  const renderItem = (item: ChecklistItem, index: number) => {
    const isRequired = item.category === "required"
    const isAnswered = item.userAnswer !== null

    return (
      <div
        key={item.number}
        className={cn(
          "flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 py-3 sm:py-2 px-3 rounded-lg border transition-all duration-200",
          isAnswered ? "border-primary/30 bg-primary/5" : "border-border",
          isRequired && "border-l-4 border-l-red-500"
        )}
      >
        {/* 질문 영역 */}
        <div className="flex items-start sm:items-center gap-2 sm:gap-3 flex-1">
          <Badge
            variant={isRequired ? "destructive" : "secondary"}
            className="shrink-0 mt-0.5 sm:mt-0"
          >
            {item.number}
          </Badge>
          <div className="flex-1 text-sm">
            {item.question}
          </div>
          {/* 모바일에서만 체크 아이콘 표시 */}
          {isAnswered && (
            <CheckCircle2 className="sm:hidden w-4 h-4 text-green-500 shrink-0" />
          )}
        </div>

        {/* 라디오 버튼 영역 */}
        <div className="flex items-center justify-end gap-2 sm:gap-3 pl-7 sm:pl-0">
          <RadioGroup
            value={item.userAnswer || ""}
            onValueChange={(value) =>
              handleAnswerChange(index, value as "yes" | "no" | "unknown")
            }
            className="flex items-center gap-4 sm:gap-3"
          >
            <div className="flex items-center space-x-1.5 sm:space-x-1">
              <RadioGroupItem value="yes" id={`item-${item.number}-yes`} className="h-5 w-5 sm:h-4 sm:w-4" />
              <Label
                htmlFor={`item-${item.number}-yes`}
                className="cursor-pointer font-normal text-sm"
              >
                예
              </Label>
            </div>
            <div className="flex items-center space-x-1.5 sm:space-x-1">
              <RadioGroupItem value="no" id={`item-${item.number}-no`} className="h-5 w-5 sm:h-4 sm:w-4" />
              <Label
                htmlFor={`item-${item.number}-no`}
                className="cursor-pointer font-normal text-sm"
              >
                아니오
              </Label>
            </div>
            <div className="flex items-center space-x-1.5 sm:space-x-1">
              <RadioGroupItem value="unknown" id={`item-${item.number}-unknown`} className="h-5 w-5 sm:h-4 sm:w-4" />
              <Label
                htmlFor={`item-${item.number}-unknown`}
                className="cursor-pointer font-normal text-sm text-muted-foreground"
              >
                모름
              </Label>
            </div>
          </RadioGroup>
          {/* 데스크탑에서만 체크 아이콘 표시 */}
          {isAnswered && (
            <CheckCircle2 className="hidden sm:block w-4 h-4 text-green-500 shrink-0" />
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">체크리스트 직접 선택</h2>
          <p className="text-sm text-muted-foreground">
            각 항목에 대해 해당 여부를 선택해주세요.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted">
          <CheckCircle2 className="w-4 h-4 text-green-500" />
          <span className="text-sm font-medium">
            {answeredCount}/{items.length}
          </span>
        </div>
      </div>

      {/* 필수 항목 */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-500" />
          <h3 className="font-semibold text-sm text-red-600 dark:text-red-400">
            필수 항목 (1~4번)
          </h3>
          <Badge variant="destructive" className="text-xs">
            1개 이상 "예" 시 검토 대상
          </Badge>
        </div>
        <div className="grid gap-2">
          {requiredItems.map((item) =>
            renderItem(item, items.findIndex((i) => i.number === item.number))
          )}
        </div>
      </div>

      {/* 선택 항목 */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-blue-500" />
          <h3 className="font-semibold text-sm text-blue-600 dark:text-blue-400">
            선택 항목 (5~10번)
          </h3>
        </div>
        <div className="grid gap-2">
          {optionalItems.map((item) =>
            renderItem(item, items.findIndex((i) => i.number === item.number))
          )}
        </div>
      </div>

      {/* 안내 메시지 */}
      <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
        <HelpCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
        <p className="text-sm text-amber-700 dark:text-amber-300">
          확실하지 않으면 &quot;모름&quot;을 선택하세요. AI가 과제 내용을 분석하여 해당 여부를 판단해드립니다.
        </p>
      </div>
    </div>
  )
}
