"use client"

import { useEffect } from "react"
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
import { RichTextEditor } from "@/components/ui/rich-text-editor"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Collapsible,
  CollapsibleContent,
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
  Copy,
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
  Paperclip,
  Download,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { apiEndpoints } from "@/lib/api-config"
import type { FeedbackModalProps } from "./feedback-modal-types"
import { useFeedbackModal } from "./useFeedbackModal"
import {
  DRAFT_GENERATION_STEPS,
  TypingDots,
  AiDraftToggle,
  AiDraftCard,
  RiskLevelIcon,
  formatFileSize,
  RiskLevelBadge,
  AnswerBadge,
} from "./feedback-modal-components"

export function FeedbackModal({
  open,
  onOpenChange,
  submission,
  canEdit,
  onFeedbackUpdated,
}: FeedbackModalProps) {
  const {
    // Form state
    securityReviewRequired, setSecurityReviewRequired,
    administrativeSecurity, setAdministrativeSecurity,
    technicalSecurity, setTechnicalSecurity,
    overallOpinion, setOverallOpinion,
    // AI draft state
    aiDraftAdministrative, aiDraftTechnical, aiDraftOverall,
    // UI state
    isLoading, isGeneratingDraft, generationStep,
    isSaving, isCompleting,
    feedbackStatus, feedbackNotFound,
    // Project detail
    showProjectSheet, setShowProjectSheet,
    projectDetail, isLoadingDetail,
    // Draft collapsible
    showDraftAdmin, setShowDraftAdmin,
    showDraftTech, setShowDraftTech,
    showDraftOverall, setShowDraftOverall,
    // Actions
    loadFeedback, handleGenerateDraft, handleSave, handleComplete,
    applyDraft, copyToClipboard,
  } = useFeedbackModal({
    submissionId: submission?.submission_id,
    canEdit,
    onOpenChange,
    onFeedbackUpdated,
  })

  // Load feedback when modal opens
  useEffect(() => {
    if (open && submission) {
      loadFeedback()
    }
  }, [open, submission, loadFeedback])

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
            ) : feedbackNotFound && !canEdit ? (
              /* 피드백 미작성 안내 (제안자용) */
              <div className="flex flex-col items-center justify-center py-16 flex-1">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <FileText className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">피드백이 아직 작성되지 않았습니다</h3>
                <p className="text-sm text-muted-foreground text-center max-w-sm">
                  담당자가 보안성 검토 피드백을 작성하면 이곳에서 확인하실 수 있습니다.
                </p>
                <Button
                  variant="outline"
                  className="mt-6"
                  onClick={() => onOpenChange(false)}
                >
                  닫기
                </Button>
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
                        {canEdit && aiDraftAdministrative && !isCompleted ? (
                          <AiDraftToggle
                            isOpen={showDraftAdmin}
                            onToggle={() => setShowDraftAdmin(!showDraftAdmin)}
                            onApply={() => applyDraft("administrative")}
                          />
                        ) : isReadOnly && administrativeSecurity && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(administrativeSecurity, "관리적 보안내용")}
                            className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
                          >
                            <Copy className="h-3 w-3" />
                            복사
                          </Button>
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
                        {canEdit && aiDraftTechnical && !isCompleted ? (
                          <AiDraftToggle
                            isOpen={showDraftTech}
                            onToggle={() => setShowDraftTech(!showDraftTech)}
                            onApply={() => applyDraft("technical")}
                          />
                        ) : isReadOnly && technicalSecurity && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(technicalSecurity, "기술적 보안내용")}
                            className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
                          >
                            <Copy className="h-3 w-3" />
                            복사
                          </Button>
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
                        {canEdit && aiDraftOverall && !isCompleted ? (
                          <AiDraftToggle
                            isOpen={showDraftOverall}
                            onToggle={() => setShowDraftOverall(!showDraftOverall)}
                            onApply={() => applyDraft("overall")}
                          />
                        ) : isReadOnly && overallOpinion && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(overallOpinion, "종합의견")}
                            className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
                          >
                            <Copy className="h-3 w-3" />
                            복사
                          </Button>
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

                      {/* Attachments */}
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
