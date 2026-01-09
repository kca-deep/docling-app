"use client"

import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { AnimatedKcaLogo } from "@/components/ui/animated-kca-logo"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RichTextEditor } from "@/components/ui/rich-text-editor"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  Loader2,
  Sparkles,
  Save,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Building2,
  User,
  ChevronDown,
  ChevronUp,
  Copy,
  RefreshCw,
  Shield,
  Server,
  FileCheck,
  Eye,
  Edit3,
  Info,
  Phone,
  Mail,
  ClipboardList,
  ChevronRight,
  AlertCircle,
  HelpCircle,
  CheckCircle,
  XCircle,
  CircleDot,
  Paperclip,
  Download,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { apiEndpoints } from "@/lib/api-config"

// Types
interface SubmissionInfo {
  submission_id: string
  project_name: string
  department: string
  manager_name: string
  requires_review: boolean
  review_reason?: string
  created_at: string
}

interface ChecklistItem {
  item_number: number
  item_category: string
  question: string
  short_label: string
  user_answer?: string
  user_details?: string
  llm_answer: string
  llm_confidence: number
  llm_evidence: string
  llm_risk_level: string
  match_status: string
  final_answer?: string
  llm_judgment?: string
  llm_quote?: string
}

interface AttachmentInfo {
  id: number
  original_filename: string
  file_size: number
  mime_type?: string
  extraction_status: string
  created_at: string
}

interface ProjectDetail {
  id: number
  submission_id: string
  project_name: string
  department: string
  manager_name: string
  contact?: string
  email?: string
  project_description?: string
  requires_review: boolean
  review_reason?: string
  summary?: string
  used_model?: string
  status: string
  created_at: string
  items: ChecklistItem[]
  attachments?: AttachmentInfo[]
}

interface FeedbackData {
  id?: number
  submission_id: string
  security_review_required: boolean | null
  administrative_security: string
  technical_security: string
  overall_opinion: string
  ai_draft_administrative?: string
  ai_draft_technical?: string
  ai_draft_overall?: string
  status: "draft" | "in_progress" | "completed"
  created_at?: string
  updated_at?: string
  completed_at?: string
}

interface FeedbackModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  submission: SubmissionInfo | null
  canEdit: boolean
  onFeedbackUpdated?: () => void
}

export function FeedbackModal({
  open,
  onOpenChange,
  submission,
  canEdit,
  onFeedbackUpdated,
}: FeedbackModalProps) {
  // Form state
  const [securityReviewRequired, setSecurityReviewRequired] = useState<boolean | null>(null)
  const [administrativeSecurity, setAdministrativeSecurity] = useState("")
  const [technicalSecurity, setTechnicalSecurity] = useState("")
  const [overallOpinion, setOverallOpinion] = useState("")

  // AI draft state
  const [aiDraftAdministrative, setAiDraftAdministrative] = useState("")
  const [aiDraftTechnical, setAiDraftTechnical] = useState("")
  const [aiDraftOverall, setAiDraftOverall] = useState("")

  // UI state
  const [isLoading, setIsLoading] = useState(false)
  const [isGeneratingDraft, setIsGeneratingDraft] = useState(false)
  const [generationStep, setGenerationStep] = useState(0)
  const [isSaving, setIsSaving] = useState(false)
  const [isCompleting, setIsCompleting] = useState(false)
  const [feedbackStatus, setFeedbackStatus] = useState<"draft" | "in_progress" | "completed">("draft")
  const [feedbackId, setFeedbackId] = useState<number | null>(null)

  // Project detail sheet state
  const [showProjectSheet, setShowProjectSheet] = useState(false)
  const [projectDetail, setProjectDetail] = useState<ProjectDetail | null>(null)
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)

  // Collapsible state for AI drafts
  const [showDraftAdmin, setShowDraftAdmin] = useState(false)
  const [showDraftTech, setShowDraftTech] = useState(false)
  const [showDraftOverall, setShowDraftOverall] = useState(false)

  // Load existing feedback when modal opens
  const loadFeedback = useCallback(async () => {
    if (!submission?.submission_id) return

    setIsLoading(true)
    try {
      const endpoint = canEdit
        ? `${apiEndpoints.selfcheck}/${submission.submission_id}/feedback`
        : `${apiEndpoints.selfcheck}/${submission.submission_id}/feedback/view`

      const response = await fetch(endpoint, {
        credentials: "include",
      })

      if (response.ok) {
        const data: FeedbackData = await response.json()
        setSecurityReviewRequired(data.security_review_required)
        setAdministrativeSecurity(data.administrative_security || "")
        setTechnicalSecurity(data.technical_security || "")
        setOverallOpinion(data.overall_opinion || "")
        setAiDraftAdministrative(data.ai_draft_administrative || "")
        setAiDraftTechnical(data.ai_draft_technical || "")
        setAiDraftOverall(data.ai_draft_overall || "")
        setFeedbackStatus(data.status)
        setFeedbackId(data.id || null)
      } else if (response.status === 404) {
        resetForm()
      } else if (response.status === 403) {
        if (!canEdit) {
          toast.error("피드백이 아직 완료되지 않았습니다.")
          onOpenChange(false)
        }
      }
    } catch (error) {
      console.error("Failed to load feedback:", error)
      toast.error("피드백 정보를 불러오는데 실패했습니다.")
    } finally {
      setIsLoading(false)
    }
  }, [submission?.submission_id, canEdit, onOpenChange])

  // Load project detail for sheet
  const loadProjectDetail = useCallback(async () => {
    if (!submission?.submission_id) return

    setIsLoadingDetail(true)
    try {
      const response = await fetch(
        `${apiEndpoints.selfcheck}/${submission.submission_id}`,
        { credentials: "include" }
      )

      if (response.ok) {
        const data: ProjectDetail = await response.json()
        setProjectDetail(data)
      } else {
        toast.error("과제 정보를 불러오는데 실패했습니다.")
      }
    } catch (error) {
      console.error("Failed to load project detail:", error)
      toast.error("과제 정보를 불러오는데 실패했습니다.")
    } finally {
      setIsLoadingDetail(false)
    }
  }, [submission?.submission_id])

  useEffect(() => {
    if (open && submission) {
      loadFeedback()
    }
  }, [open, submission, loadFeedback])

  // Load project detail when sheet opens
  useEffect(() => {
    if (showProjectSheet && !projectDetail && submission) {
      loadProjectDetail()
    }
  }, [showProjectSheet, projectDetail, submission, loadProjectDetail])

  const resetForm = () => {
    setSecurityReviewRequired(null)
    setAdministrativeSecurity("")
    setTechnicalSecurity("")
    setOverallOpinion("")
    setAiDraftAdministrative("")
    setAiDraftTechnical("")
    setAiDraftOverall("")
    setFeedbackStatus("draft")
    setFeedbackId(null)
  }

  // Generate AI draft
  const handleGenerateDraft = async () => {
    if (!submission?.submission_id) return

    setIsGeneratingDraft(true)
    setGenerationStep(0)

    // 단계별 메시지 순환을 위한 인터벌
    const stepInterval = setInterval(() => {
      setGenerationStep((prev) => {
        if (prev < DRAFT_GENERATION_STEPS.length - 1) {
          return prev + 1
        }
        return prev
      })
    }, 3000)

    try {
      const response = await fetch(
        `${apiEndpoints.selfcheck}/${submission.submission_id}/feedback/generate`,
        {
          method: "POST",
          credentials: "include",
        }
      )

      if (response.ok) {
        const data = await response.json()
        setAiDraftAdministrative(data.administrative_security || "")
        setAiDraftTechnical(data.technical_security || "")
        setAiDraftOverall(data.overall_opinion || "")

        setShowDraftAdmin(true)
        setShowDraftTech(true)
        setShowDraftOverall(true)

        toast.success("AI 초안이 생성되었습니다.")
      } else {
        const errorData = await response.json().catch(() => ({}))
        toast.error(errorData.detail || "AI 초안 생성에 실패했습니다.")
      }
    } catch (error) {
      console.error("Failed to generate draft:", error)
      toast.error("AI 초안 생성 중 오류가 발생했습니다.")
    } finally {
      clearInterval(stepInterval)
      setIsGeneratingDraft(false)
      setGenerationStep(0)
    }
  }

  // Save feedback
  const handleSave = async () => {
    if (!submission?.submission_id) return

    setIsSaving(true)
    try {
      const response = await fetch(
        `${apiEndpoints.selfcheck}/${submission.submission_id}/feedback`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            security_review_required: securityReviewRequired,
            administrative_security: administrativeSecurity,
            technical_security: technicalSecurity,
            overall_opinion: overallOpinion,
          }),
        }
      )

      if (response.ok) {
        const data = await response.json()
        setFeedbackStatus(data.status)
        setFeedbackId(data.id)
        toast.success("피드백이 저장되었습니다.")
        onFeedbackUpdated?.()
      } else {
        const errorData = await response.json().catch(() => ({}))
        toast.error(errorData.detail || "피드백 저장에 실패했습니다.")
      }
    } catch (error) {
      console.error("Failed to save feedback:", error)
      toast.error("피드백 저장 중 오류가 발생했습니다.")
    } finally {
      setIsSaving(false)
    }
  }

  // Complete feedback
  const handleComplete = async () => {
    if (!submission?.submission_id) return

    if (securityReviewRequired === null) {
      toast.error("보안성검토절차 필요 여부를 선택해주세요.")
      return
    }
    if (!administrativeSecurity.trim()) {
      toast.error("관리적 보안내용을 입력해주세요.")
      return
    }
    if (!technicalSecurity.trim()) {
      toast.error("기술적 보안내용을 입력해주세요.")
      return
    }
    if (!overallOpinion.trim()) {
      toast.error("종합의견을 입력해주세요.")
      return
    }

    setIsCompleting(true)
    try {
      const saveResponse = await fetch(
        `${apiEndpoints.selfcheck}/${submission.submission_id}/feedback`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            security_review_required: securityReviewRequired,
            administrative_security: administrativeSecurity,
            technical_security: technicalSecurity,
            overall_opinion: overallOpinion,
          }),
        }
      )

      if (!saveResponse.ok) {
        throw new Error("Save failed")
      }

      const completeResponse = await fetch(
        `${apiEndpoints.selfcheck}/${submission.submission_id}/feedback/complete`,
        {
          method: "POST",
          credentials: "include",
        }
      )

      if (completeResponse.ok) {
        setFeedbackStatus("completed")
        toast.success("피드백이 완료되었습니다. 사용자가 이제 조회할 수 있습니다.")
        onFeedbackUpdated?.()
        onOpenChange(false)
      } else {
        const errorData = await completeResponse.json().catch(() => ({}))
        toast.error(errorData.detail || "피드백 완료 처리에 실패했습니다.")
      }
    } catch (error) {
      console.error("Failed to complete feedback:", error)
      toast.error("피드백 완료 처리 중 오류가 발생했습니다.")
    } finally {
      setIsCompleting(false)
    }
  }

  const applyDraft = (field: "administrative" | "technical" | "overall") => {
    switch (field) {
      case "administrative":
        setAdministrativeSecurity(aiDraftAdministrative)
        toast.success("관리적 보안내용에 AI 초안이 적용되었습니다.")
        break
      case "technical":
        setTechnicalSecurity(aiDraftTechnical)
        toast.success("기술적 보안내용에 AI 초안이 적용되었습니다.")
        break
      case "overall":
        setOverallOpinion(aiDraftOverall)
        toast.success("종합의견에 AI 초안이 적용되었습니다.")
        break
    }
  }

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`${label} AI 초안이 클립보드에 복사되었습니다.`)
    } catch {
      toast.error("클립보드 복사에 실패했습니다.")
    }
  }

  if (!submission) return null

  const isCompleted = feedbackStatus === "completed"
  const isReadOnly = !canEdit || isCompleted

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "max-h-[90vh] p-0 transition-all duration-300",
          showProjectSheet
            ? "w-[1280px] max-w-[95vw]"
            : "w-[700px] max-w-[90vw]"
        )}
      >
        <div className="flex flex-row h-full max-h-[90vh]">
          {/* Left Panel - Feedback Form */}
          <div className={cn(
            "flex flex-col flex-shrink-0 transition-all duration-300",
            showProjectSheet ? "w-[640px]" : "w-full"
          )}>
            <DialogHeader className="px-6 pt-6 pb-4 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isReadOnly ? (
                    <Eye className="h-5 w-5 text-blue-500" />
                  ) : (
                    <Edit3 className="h-5 w-5 text-amber-500" />
                  )}
                  <DialogTitle>
                    {isReadOnly ? "보안성 피드백 조회" : "보안성 피드백 작성"}
                  </DialogTitle>
                </div>
                <Badge
                  variant={
                    feedbackStatus === "completed"
                      ? "default"
                      : feedbackStatus === "in_progress"
                      ? "secondary"
                      : "outline"
                  }
                  className={cn(
                    feedbackStatus === "completed" && "bg-green-500 hover:bg-green-600"
                  )}
                >
                  {feedbackStatus === "completed"
                    ? "완료"
                    : feedbackStatus === "in_progress"
                    ? "작성중"
                    : "대기중"}
                </Badge>
              </div>
              <DialogDescription>
                {isReadOnly
                  ? "보안성 검토 피드백 내용을 확인합니다."
                  : "AI가 생성한 초안을 참고하여 보안성 피드백을 작성합니다."}
              </DialogDescription>
            </DialogHeader>

            {isLoading ? (
              <div className="flex items-center justify-center py-16 flex-1">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <ScrollArea className="flex-1 px-6" style={{ maxHeight: "calc(90vh - 200px)" }}>
                  <div className="space-y-6 pb-6">
                    {/* Project Info Card with View Detail Button */}
                    <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 font-medium">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="truncate max-w-[350px]">{submission.project_name}</span>
                        </div>
                        <Button
                          variant={showProjectSheet ? "secondary" : "outline"}
                          size="sm"
                          onClick={() => setShowProjectSheet(!showProjectSheet)}
                          className="gap-1.5 text-xs flex-shrink-0"
                        >
                          <Info className="h-3.5 w-3.5" />
                          {showProjectSheet ? "정보 닫기" : "과제 정보"}
                          <ChevronRight className={cn(
                            "h-3.5 w-3.5 transition-transform duration-200",
                            showProjectSheet && "rotate-180"
                          )} />
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3.5 w-3.5" />
                          {submission.department}
                        </span>
                        <span className="flex items-center gap-1">
                          <User className="h-3.5 w-3.5" />
                          {submission.manager_name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">AI 판정:</span>
                        {submission.requires_review ? (
                          <Badge variant="destructive" className="gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            검토 필요
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            검토 불필요
                          </Badge>
                        )}
                        {submission.review_reason && (
                          <span className="text-sm text-muted-foreground">
                            ({submission.review_reason})
                          </span>
                        )}
                      </div>
                    </div>

                    {/* AI Draft Generation Button or Progress */}
                    {canEdit && !isCompleted && (
                      <>
                        {isGeneratingDraft ? (
                          /* AI 초안 생성 중 - 애니메이션 UI */
                          <div className="flex flex-col items-center py-8 space-y-4 rounded-lg border bg-muted/20">
                            <AnimatedKcaLogo />

                            {/* AI Agent 텍스트 */}
                            <motion.p
                              className="text-sm font-medium text-muted-foreground"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ delay: 0.3 }}
                            >
                              피드백 초안 AI Agent
                            </motion.p>

                            {/* 현재 단계 메시지 (애니메이션 전환) */}
                            <AnimatePresence mode="wait">
                              <motion.p
                                key={generationStep}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.3 }}
                                className="text-sm text-center text-foreground/70"
                              >
                                {DRAFT_GENERATION_STEPS[generationStep]}
                                <TypingDots />
                              </motion.p>
                            </AnimatePresence>
                          </div>
                        ) : (
                          /* AI 초안 생성 버튼 */
                          <div className="flex justify-end">
                            <Button
                              size="sm"
                              onClick={handleGenerateDraft}
                              className="gap-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-md hover:shadow-lg transition-all"
                            >
                              <Sparkles className="h-4 w-4" />
                              AI 초안 생성
                            </Button>
                          </div>
                        )}
                      </>
                    )}

                    <Separator />

                    {/* 1. Security Review Required */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-blue-500" />
                        <Label className="text-base font-medium">
                          1. 보안성검토절차 필요 여부
                        </Label>
                      </div>
                      <RadioGroup
                        value={securityReviewRequired === null ? "" : securityReviewRequired ? "yes" : "no"}
                        onValueChange={(value) => setSecurityReviewRequired(value === "yes")}
                        disabled={isReadOnly}
                        className="flex gap-6"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="yes" id="review-yes" />
                          <Label htmlFor="review-yes" className="cursor-pointer">
                            필요
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="no" id="review-no" />
                          <Label htmlFor="review-no" className="cursor-pointer">
                            불필요
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>

                    <Separator />

                    {/* 2. Administrative Security */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileCheck className="h-4 w-4 text-green-500" />
                          <Label className="text-base font-medium">
                            2. 관리적 보안내용
                          </Label>
                        </div>
                        {canEdit && aiDraftAdministrative && !isCompleted && (
                          <AiDraftToggle
                            isOpen={showDraftAdmin}
                            onToggle={() => setShowDraftAdmin(!showDraftAdmin)}
                            onApply={() => applyDraft("administrative")}
                          />
                        )}
                      </div>

                      {canEdit && aiDraftAdministrative && !isCompleted && (
                        <Collapsible open={showDraftAdmin} onOpenChange={setShowDraftAdmin}>
                          <CollapsibleContent>
                            <AiDraftCard
                              content={aiDraftAdministrative}
                              onCopy={() => copyToClipboard(aiDraftAdministrative, "관리적 보안내용")}
                            />
                          </CollapsibleContent>
                        </Collapsible>
                      )}

                      <RichTextEditor
                        placeholder="접근권한 관리, API 보안(인증, 암호화), 데이터 수정/변경 기록관리 등에 대한 내용을 작성합니다."
                        value={administrativeSecurity}
                        onChange={setAdministrativeSecurity}
                        disabled={isReadOnly}
                        minHeight="120px"
                      />
                    </div>

                    <Separator />

                    {/* 3. Technical Security */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Server className="h-4 w-4 text-purple-500" />
                          <Label className="text-base font-medium">
                            3. 기술적 보안내용
                          </Label>
                        </div>
                        {canEdit && aiDraftTechnical && !isCompleted && (
                          <AiDraftToggle
                            isOpen={showDraftTech}
                            onToggle={() => setShowDraftTech(!showDraftTech)}
                            onApply={() => applyDraft("technical")}
                          />
                        )}
                      </div>

                      {canEdit && aiDraftTechnical && !isCompleted && (
                        <Collapsible open={showDraftTech} onOpenChange={setShowDraftTech}>
                          <CollapsibleContent>
                            <AiDraftCard
                              content={aiDraftTechnical}
                              onCopy={() => copyToClipboard(aiDraftTechnical, "기술적 보안내용")}
                            />
                          </CollapsibleContent>
                        </Collapsible>
                      )}

                      <RichTextEditor
                        placeholder="운영시스템 OS 보안패치, 프레임워크/라이브러리 보안 업데이트, 외부 서비스 연동 시 보안 고려사항 등을 작성합니다."
                        value={technicalSecurity}
                        onChange={setTechnicalSecurity}
                        disabled={isReadOnly}
                        minHeight="120px"
                      />
                    </div>

                    <Separator />

                    {/* 4. Overall Opinion */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-amber-500" />
                          <Label className="text-base font-medium">
                            4. 종합의견
                          </Label>
                        </div>
                        {canEdit && aiDraftOverall && !isCompleted && (
                          <AiDraftToggle
                            isOpen={showDraftOverall}
                            onToggle={() => setShowDraftOverall(!showDraftOverall)}
                            onApply={() => applyDraft("overall")}
                          />
                        )}
                      </div>

                      {canEdit && aiDraftOverall && !isCompleted && (
                        <Collapsible open={showDraftOverall} onOpenChange={setShowDraftOverall}>
                          <CollapsibleContent>
                            <AiDraftCard
                              content={aiDraftOverall}
                              onCopy={() => copyToClipboard(aiDraftOverall, "종합의견")}
                            />
                          </CollapsibleContent>
                        </Collapsible>
                      )}

                      <RichTextEditor
                        placeholder="내부데이터 활용 적정성, 개인정보 보호 대책, 관리적/기술적 보안대책 요약, 추가 권고사항 등 종합적인 검토의견을 작성합니다."
                        value={overallOpinion}
                        onChange={setOverallOpinion}
                        disabled={isReadOnly}
                        minHeight="150px"
                      />
                    </div>
                  </div>
                </ScrollArea>

                <DialogFooter className="px-6 py-4 border-t flex-shrink-0">
                  {canEdit && !isCompleted ? (
                    <div className="flex w-full justify-between">
                      <Button variant="outline" onClick={() => onOpenChange(false)}>
                        취소
                      </Button>
                      <div className="flex gap-2">
                        <Button
                          variant="secondary"
                          onClick={handleSave}
                          disabled={isSaving || isCompleting}
                          className="gap-2"
                        >
                          {isSaving ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Save className="h-4 w-4" />
                          )}
                          임시저장
                        </Button>
                        <Button
                          onClick={handleComplete}
                          disabled={isSaving || isCompleting}
                          className="gap-2"
                        >
                          {isCompleting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4" />
                          )}
                          피드백 완료
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button onClick={() => onOpenChange(false)}>닫기</Button>
                  )}
                </DialogFooter>
              </>
            )}
          </div>

          {/* Right Panel - Project Detail (expandable) */}
          {showProjectSheet && (
            <div className="w-[640px] flex-shrink-0 border-l flex flex-col bg-muted/20">
              {/* Right Panel Header */}
              <div className="px-6 py-4 border-b flex-shrink-0">
                <div className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5 text-blue-500" />
                  <h3 className="font-semibold">과제 입력 정보</h3>
                </div>
              </div>

              {/* Right Panel Content */}
              <ScrollArea className="flex-1" style={{ maxHeight: "calc(90vh - 80px)" }}>
                <div className="p-6">
                  {isLoadingDetail ? (
                    <div className="flex items-center justify-center py-16">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : projectDetail ? (
                    <div className="space-y-6">
                      {/* Basic Info */}
                      <div className="space-y-4">
                        <h3 className="font-semibold text-sm flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          기본 정보
                        </h3>
                        <div className="rounded-lg border bg-background p-4 space-y-3">
                          <div>
                            <Label className="text-xs text-muted-foreground">과제명</Label>
                            <p className="font-medium">{projectDetail.project_name}</p>
                          </div>
                          <Separator />
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                                <Building2 className="h-3 w-3" />
                                담당부서
                              </Label>
                              <p className="text-sm">{projectDetail.department}</p>
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                                <User className="h-3 w-3" />
                                담당자
                              </Label>
                              <p className="text-sm">{projectDetail.manager_name}</p>
                            </div>
                          </div>
                          {(projectDetail.contact || projectDetail.email) && (
                            <>
                              <Separator />
                              <div className="grid grid-cols-2 gap-4">
                                {projectDetail.contact && (
                                  <div>
                                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                                      <Phone className="h-3 w-3" />
                                      연락처
                                    </Label>
                                    <p className="text-sm">{projectDetail.contact}</p>
                                  </div>
                                )}
                                {projectDetail.email && (
                                  <div>
                                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                                      <Mail className="h-3 w-3" />
                                      이메일
                                    </Label>
                                    <p className="text-sm">{projectDetail.email}</p>
                                  </div>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Attachments - 기본정보 하단에 배치 */}
                      {projectDetail.attachments && projectDetail.attachments.length > 0 && (
                        <div className="space-y-4">
                          <h3 className="font-semibold text-sm flex items-center gap-2">
                            <Paperclip className="h-4 w-4 text-muted-foreground" />
                            첨부문서 ({projectDetail.attachments.length})
                          </h3>
                          <div className="space-y-2">
                            {projectDetail.attachments.map((attachment) => (
                              <div
                                key={attachment.id}
                                className="flex items-center justify-between p-2.5 rounded-md border bg-background"
                              >
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  <FileText className={cn(
                                    "h-4 w-4 shrink-0",
                                    attachment.mime_type === "application/pdf" && "text-red-500",
                                    attachment.mime_type?.includes("word") && "text-blue-500",
                                    attachment.mime_type?.includes("presentation") && "text-orange-500"
                                  )} />
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium truncate">
                                      {attachment.original_filename}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {formatFileSize(attachment.file_size)}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0 ml-2">
                                  {attachment.mime_type === "application/pdf" && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 w-7 p-0"
                                      onClick={() => {
                                        const url = `${apiEndpoints.selfcheck}/${projectDetail.submission_id}/attachments/${attachment.id}/preview`
                                        window.open(url, "_blank")
                                      }}
                                    >
                                      <Eye className="h-3.5 w-3.5" />
                                    </Button>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0"
                                    onClick={async () => {
                                      try {
                                        const response = await fetch(
                                          `${apiEndpoints.selfcheck}/${projectDetail.submission_id}/attachments/${attachment.id}/download`,
                                          { credentials: "include" }
                                        )
                                        if (!response.ok) throw new Error("Download failed")
                                        const blob = await response.blob()
                                        const url = window.URL.createObjectURL(blob)
                                        const a = document.createElement("a")
                                        a.href = url
                                        a.download = attachment.original_filename
                                        document.body.appendChild(a)
                                        a.click()
                                        document.body.removeChild(a)
                                        window.URL.revokeObjectURL(url)
                                      } catch {
                                        toast.error("파일 다운로드에 실패했습니다.")
                                      }
                                    }}
                                  >
                                    <Download className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Project Description */}
                      {projectDetail.project_description && (
                        <div className="space-y-4">
                          <h3 className="font-semibold text-sm flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            과제 내용
                          </h3>
                          <div className="rounded-lg border bg-background p-4">
                            <p className="text-sm whitespace-pre-wrap leading-relaxed">
                              {projectDetail.project_description}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* AI Summary */}
                      {projectDetail.summary && (
                        <div className="space-y-4">
                          <h3 className="font-semibold text-sm flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-blue-500" />
                            AI 종합의견
                          </h3>
                          <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30 p-4">
                            <p className="text-sm whitespace-pre-wrap leading-relaxed">
                              {projectDetail.summary}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Checklist Items */}
                      {projectDetail.items && projectDetail.items.length > 0 && (
                        <div className="space-y-4">
                          <h3 className="font-semibold text-sm flex items-center gap-2">
                            <ClipboardList className="h-4 w-4 text-muted-foreground" />
                            체크리스트 항목별 AI 분석
                          </h3>
                          <Accordion type="multiple" className="w-full">
                            {projectDetail.items.map((item) => (
                              <AccordionItem key={item.item_number} value={`item-${item.item_number}`}>
                                <AccordionTrigger className="text-sm hover:no-underline">
                                  <div className="flex items-center gap-2 text-left">
                                    <RiskLevelIcon riskLevel={item.llm_risk_level} />
                                    <span className="font-medium">
                                      {item.item_number}. {item.short_label}
                                    </span>
                                  </div>
                                </AccordionTrigger>
                                <AccordionContent>
                                  <div className="space-y-3 pt-2">
                                    {/* Question */}
                                    <div>
                                      <Label className="text-xs text-muted-foreground">질문</Label>
                                      <p className="text-sm">{item.question}</p>
                                    </div>

                                    {/* Answers Row */}
                                    <div className="grid grid-cols-2 gap-3">
                                      <div className="rounded-md border bg-background p-2.5">
                                        <Label className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                                          <User className="h-3 w-3" />
                                          사용자 응답
                                        </Label>
                                        <AnswerBadge answer={item.user_answer || "unknown"} />
                                      </div>
                                      <div className="rounded-md border bg-background p-2.5">
                                        <Label className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                                          <Sparkles className="h-3 w-3" />
                                          AI 분석
                                        </Label>
                                        <AnswerBadge answer={item.llm_answer} />
                                      </div>
                                    </div>

                                    {/* User Details */}
                                    {item.user_details && (
                                      <div>
                                        <Label className="text-xs text-muted-foreground">사용자 세부내용</Label>
                                        <p className="text-sm text-muted-foreground mt-1">
                                          {item.user_details}
                                        </p>
                                      </div>
                                    )}

                                    {/* AI Evidence */}
                                    <div className="rounded-md bg-muted/50 p-3">
                                      <Label className="text-xs text-muted-foreground mb-1 block">AI 판단 근거</Label>
                                      <p className="text-sm whitespace-pre-wrap">
                                        {item.llm_evidence}
                                      </p>
                                      {item.llm_quote && (
                                        <div className="mt-2 pl-3 border-l-2 border-blue-300 text-xs text-muted-foreground italic">
                                          &quot;{item.llm_quote}&quot;
                                        </div>
                                      )}
                                    </div>

                                    {/* Risk & Confidence */}
                                    <div className="flex items-center gap-4 text-xs">
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-muted-foreground">위험도:</span>
                                        <RiskLevelBadge level={item.llm_risk_level} />
                                      </div>
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-muted-foreground">신뢰도:</span>
                                        <span className="font-medium">
                                          {Math.round(item.llm_confidence * 100)}%
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </AccordionContent>
                              </AccordionItem>
                            ))}
                          </Accordion>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                      <AlertCircle className="h-8 w-8 mb-2" />
                      <p>과제 정보를 불러올 수 없습니다.</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// AI 초안 생성 단계 메시지
const DRAFT_GENERATION_STEPS = [
  "과제 내용을 분석하고 있어요",
  "관리적 보안내용을 작성하고 있어요",
  "기술적 보안내용을 작성하고 있어요",
  "종합의견을 정리하고 있어요",
]

// 타이핑 dots 애니메이션
function TypingDots() {
  return (
    <span className="inline-flex items-center gap-0.5 ml-1">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="w-1 h-1 rounded-full bg-primary/60"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{
            duration: 1,
            repeat: Infinity,
            delay: i * 0.2,
          }}
        />
      ))}
    </span>
  )
}

// Helper Components

function AiDraftToggle({
  isOpen,
  onToggle,
  onApply,
}: {
  isOpen: boolean
  onToggle: () => void
  onApply: () => void
}) {
  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onToggle}
        className="h-7 px-2 text-xs gap-1 text-blue-600 hover:text-blue-700"
      >
        <Sparkles className="h-3 w-3" />
        AI 초안
        {isOpen ? (
          <ChevronUp className="h-3 w-3" />
        ) : (
          <ChevronDown className="h-3 w-3" />
        )}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onApply}
        className="h-7 px-2 text-xs gap-1"
      >
        <Copy className="h-3 w-3" />
        적용
      </Button>
    </div>
  )
}

function AiDraftCard({
  content,
  onCopy,
}: {
  content: string
  onCopy: () => void
}) {
  return (
    <div className="rounded-md border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30 p-3 text-sm">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-medium">
          <Sparkles className="h-3.5 w-3.5" />
          AI 초안
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCopy}
          className="h-6 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
        >
          <Copy className="h-3 w-3" />
          복사
        </Button>
      </div>
      <p className="whitespace-pre-wrap text-muted-foreground">
        {content}
      </p>
    </div>
  )
}

function RiskLevelIcon({ riskLevel }: { riskLevel: string }) {
  switch (riskLevel) {
    case "high":
      return <AlertTriangle className="h-4 w-4 text-red-500" />
    case "medium":
      return <AlertCircle className="h-4 w-4 text-amber-500" />
    case "low":
      return <CheckCircle className="h-4 w-4 text-green-500" />
    default:
      return <HelpCircle className="h-4 w-4 text-muted-foreground" />
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function RiskLevelBadge({ level }: { level: string }) {
  const config: Record<string, { label: string; className: string }> = {
    high: { label: "높음", className: "text-red-600 bg-red-100 dark:bg-red-950" },
    medium: { label: "보통", className: "text-amber-600 bg-amber-100 dark:bg-amber-950" },
    low: { label: "낮음", className: "text-green-600 bg-green-100 dark:bg-green-950" },
  }
  const { label, className } = config[level] || { label: level, className: "" }

  return (
    <span className={cn("px-1.5 py-0.5 rounded text-xs font-medium", className)}>
      {label}
    </span>
  )
}

function AnswerBadge({ answer }: { answer: string }) {
  const config: Record<string, { label: string; icon: typeof CheckCircle; className: string }> = {
    yes: { label: "예", icon: CheckCircle, className: "text-green-600" },
    no: { label: "아니오", icon: XCircle, className: "text-red-600" },
    unknown: { label: "미확인", icon: HelpCircle, className: "text-muted-foreground" },
    need_check: { label: "확인필요", icon: AlertCircle, className: "text-amber-600" },
  }
  const { label, icon: Icon, className } = config[answer] || config.unknown

  return (
    <div className={cn("flex items-center gap-1 text-sm font-medium", className)}>
      <Icon className="h-3.5 w-3.5" />
      {label}
    </div>
  )
}
