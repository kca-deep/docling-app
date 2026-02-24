import { useState, useEffect, useCallback } from "react"
import { toast } from "sonner"
import { apiEndpoints } from "@/lib/api-config"
import type { FeedbackData, ProjectDetail } from "./feedback-modal-types"
import { DRAFT_GENERATION_STEPS } from "./feedback-modal-components"

interface UseFeedbackModalOptions {
  submissionId: string | undefined
  canEdit: boolean
  onOpenChange: (open: boolean) => void
  onFeedbackUpdated?: () => void
}

export function useFeedbackModal({
  submissionId,
  canEdit,
  onOpenChange,
  onFeedbackUpdated,
}: UseFeedbackModalOptions) {
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
  const [feedbackNotFound, setFeedbackNotFound] = useState(false)

  // Project detail sheet state
  const [showProjectSheet, setShowProjectSheet] = useState(false)
  const [projectDetail, setProjectDetail] = useState<ProjectDetail | null>(null)
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)

  // Collapsible state for AI drafts
  const [showDraftAdmin, setShowDraftAdmin] = useState(false)
  const [showDraftTech, setShowDraftTech] = useState(false)
  const [showDraftOverall, setShowDraftOverall] = useState(false)

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
    setFeedbackNotFound(false)
  }

  // Load existing feedback
  const loadFeedback = useCallback(async () => {
    if (!submissionId) return

    setIsLoading(true)
    try {
      const endpoint = canEdit
        ? `${apiEndpoints.selfcheck}/${submissionId}/feedback`
        : `${apiEndpoints.selfcheck}/${submissionId}/feedback/view`

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
        setFeedbackStatus(data.status || (canEdit ? "draft" : "completed"))
        setFeedbackId(data.id || null)
        setFeedbackNotFound(false)
      } else if (response.status === 404) {
        resetForm()
        if (!canEdit) {
          setFeedbackNotFound(true)
        }
      } else if (response.status === 403) {
        if (!canEdit) {
          const errorData = await response.json().catch(() => ({}))
          const errorMessage = errorData.detail || "피드백을 조회할 수 없습니다."
          toast.error(errorMessage)
          onOpenChange(false)
        }
      }
    } catch (error) {
      console.error("Failed to load feedback:", error)
      toast.error("피드백 정보를 불러오는데 실패했습니다.")
    } finally {
      setIsLoading(false)
    }
  }, [submissionId, canEdit, onOpenChange])

  // Load project detail for sheet
  const loadProjectDetail = useCallback(async () => {
    if (!submissionId) return

    setIsLoadingDetail(true)
    try {
      const response = await fetch(
        `${apiEndpoints.selfcheck}/${submissionId}`,
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
  }, [submissionId])

  // Load project detail when sheet opens
  useEffect(() => {
    if (showProjectSheet && !projectDetail && submissionId) {
      loadProjectDetail()
    }
  }, [showProjectSheet, projectDetail, submissionId, loadProjectDetail])

  // Generate AI draft
  const handleGenerateDraft = async () => {
    if (!submissionId) return

    setIsGeneratingDraft(true)
    setGenerationStep(0)

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
        `${apiEndpoints.selfcheck}/${submissionId}/feedback/generate`,
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
    if (!submissionId) return

    setIsSaving(true)
    try {
      const response = await fetch(
        `${apiEndpoints.selfcheck}/${submissionId}/feedback`,
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
    if (!submissionId) return

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
        `${apiEndpoints.selfcheck}/${submissionId}/feedback`,
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
        `${apiEndpoints.selfcheck}/${submissionId}/feedback/complete`,
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

  return {
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
    feedbackStatus, feedbackId, feedbackNotFound,
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
  }
}
