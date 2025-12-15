"use client"

import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { AlertCircle, CheckCircle2, FileText, User, Building2, Mail } from "lucide-react"
import { cn } from "@/lib/utils"
import type { User as AuthUser } from "@/lib/auth"

export interface ProjectFormData {
  projectName: string
  content: string
  // User info (from auth)
  department: string
  managerName: string
  email: string
}

interface ProjectFormProps {
  value: ProjectFormData
  onChange: (value: ProjectFormData) => void
  user: AuthUser | null
}

const MINIMUM_LENGTH = 50
const RECOMMENDED_LENGTH = 200

export function ProjectForm({ value, onChange, user }: ProjectFormProps) {
  const contentLength = value.content.length
  const isMinimumMet = contentLength >= MINIMUM_LENGTH
  const isRecommendedMet = contentLength >= RECOMMENDED_LENGTH

  const handleChange = (field: keyof ProjectFormData, fieldValue: string) => {
    onChange({ ...value, [field]: fieldValue })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">과제 정보 입력</h2>
          <p className="text-sm text-muted-foreground">
            AI 과제의 기본 정보와 내용을 입력해주세요.
          </p>
        </div>
      </div>

      <div className="grid gap-4">
        {/* 담당자 정보 (사용자 프로필에서 자동) */}
        <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 border">
          <div className="flex items-center gap-2 text-sm">
            <Building2 className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">부서:</span>
            <span className="font-medium">{user?.team_name || "-"}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <User className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">담당자:</span>
            <span className="font-medium">{user?.name || user?.username || "-"}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Mail className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">이메일:</span>
            <span className="font-medium">{user?.email || "-"}</span>
          </div>
        </div>

        {/* 과제명 */}
        <div className="space-y-2">
          <Label htmlFor="projectName" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            과제명 <span className="text-red-500">*</span>
          </Label>
          <Input
            id="projectName"
            placeholder="예: AI 기반 민원 자동응답 시스템"
            value={value.projectName}
            onChange={(e) => handleChange("projectName", e.target.value)}
            className="h-10"
          />
        </div>

        {/* 과제 내용 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="projectDesc" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              과제 내용 <span className="text-red-500">*</span>
            </Label>
            <div className="flex items-center gap-2">
              <Badge
                variant={isMinimumMet ? "default" : "destructive"}
                className={cn(
                  "text-xs",
                  isMinimumMet && !isRecommendedMet && "bg-amber-500 hover:bg-amber-500"
                )}
              >
                {contentLength}/{MINIMUM_LENGTH}자
              </Badge>
              {isMinimumMet && (
                <Badge variant={isRecommendedMet ? "default" : "secondary"} className="text-xs">
                  {isRecommendedMet ? (
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      권장 충족
                    </span>
                  ) : (
                    `${RECOMMENDED_LENGTH}자 권장`
                  )}
                </Badge>
              )}
            </div>
          </div>

          <Textarea
            id="projectDesc"
            placeholder="예시:
본 과제는 KCA 업무포털에 접수되는 민원을 AI 챗봇으로 자동 응답하는 시스템을 구축하는 것입니다.

주요 기능:
1. 기존 FAQ 데이터를 학습하여 자주 묻는 질문에 자동 응답
2. ChatGPT API를 활용한 자연어 처리
3. 민원인의 성명, 연락처를 수집하여 처리 결과 안내

대상: 일반 국민 (대국민 서비스)
연계 시스템: 업무포털, 민원관리시스템"
            value={value.content}
            onChange={(e) => handleChange("content", e.target.value)}
            className="min-h-[200px] resize-none"
          />

          {!isMinimumMet && (
            <p className="text-sm text-destructive flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              최소 {MINIMUM_LENGTH}자 이상 입력해주세요. ({MINIMUM_LENGTH - contentLength}자 부족)
            </p>
          )}
        </div>
      </div>

      {/* 안내 메시지 */}
      <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
        <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <p className="text-sm text-blue-700 dark:text-blue-300">
          AI 서비스/기술, 처리할 데이터 종류, 연계 시스템, 서비스 대상 등을 포함하면 더 정확한 분석이 가능합니다.
        </p>
      </div>
    </div>
  )
}
