"use client"

import { useState, useCallback, useEffect } from "react"
import { PageContainer } from "@/components/page-container"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  ArrowLeft,
  ArrowRight,
  Shield,
  CheckCircle2,
  Loader2,
  Lightbulb,
  Home,
  LogIn,
  UserPlus,
  ChevronRight,
} from "lucide-react"
import { motion } from "framer-motion"

// Stagger animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 }
  }
}

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } }
}

import Link from "next/link"
import { useAuth } from "@/components/auth/auth-provider"
import { apiEndpoints } from "@/lib/api-config"
import { ProjectForm, type ProjectFormData } from "@/components/idea-hub/project-form"
import { ChecklistForm, type ChecklistItem } from "@/components/idea-hub/checklist-form"
import { AnalysisProgress, type AnalysisResult } from "@/components/idea-hub/analysis-progress"
import { ResultComparison } from "@/components/idea-hub/result-comparison"
import { LlmStatusBadge } from "@/components/idea-hub/llm-status-badge"

// 체크리스트 항목 정의 (필수: 1-5, 선택: 6-10)
export const CHECKLIST_QUESTIONS = [
  {
    number: 1,
    category: "required" as const,
    question: "본 과제에서 내부 정보시스템(업무포털, 무선국검사, 자격검정 등)과 연계가 필요합니까?",
    shortLabel: "내부시스템 연계",
  },
  {
    number: 2,
    category: "required" as const,
    question: "본 과제에서 개인정보(성명, 주민등록번호, 연락처 등)를 수집/처리/저장합니까?",
    shortLabel: "개인정보 처리",
  },
  {
    number: 3,
    category: "required" as const,
    question: "본 과제에서 민감정보(건강정보, 사상/신념, 정치적 견해 등)를 활용합니까?",
    shortLabel: "민감정보 활용",
  },
  {
    number: 4,
    category: "required" as const,
    question: "본 과제에서 비공개 업무자료(내부문서, 대외비 등)를 AI 서비스에 입력합니까?",
    shortLabel: "비공개자료 AI입력",
  },
  {
    number: 5,
    category: "required" as const,
    question: "본 과제의 결과물이 대국민 서비스로 제공될 예정입니까?",
    shortLabel: "대국민 서비스",
  },
  {
    number: 6,
    category: "optional" as const,
    question: "본 과제에서 외부 클라우드 기반 AI 서비스(ChatGPT, Claude 등)를 활용합니까?",
    shortLabel: "외부 클라우드 AI",
  },
  {
    number: 7,
    category: "optional" as const,
    question: "본 과제에서 자체 AI 모델을 구축/학습할 계획이 있습니까?",
    shortLabel: "자체 AI 모델",
  },
  {
    number: 8,
    category: "optional" as const,
    question: "본 과제에서 외부 API 연동(OpenAI API, 외부 데이터 수집 등)이 필요합니까?",
    shortLabel: "외부 API 연동",
  },
  {
    number: 9,
    category: "optional" as const,
    question: "본 과제에서 생성된 결과물의 정확성/윤리성 검증 절차를 마련하였습니까?",
    shortLabel: "검증 절차",
  },
  {
    number: 10,
    category: "optional" as const,
    question: "본 과제에서 활용하는 AI 서비스의 이용약관 및 저작권 관련 사항을 확인하였습니까?",
    shortLabel: "이용약관 확인",
  },
]

const STEPS = [
  { number: 1, title: "과제 정보", description: "과제명 및 내용 입력" },
  { number: 2, title: "체크리스트", description: "항목별 직접 선택" },
  { number: 3, title: "AI 검증", description: "AI 분석 및 결과 확인" },
]

export default function SelfCheckPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth()
  const [currentStep, setCurrentStep] = useState(1)
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  // Form data states - 예시 데이터로 초기화 (각 체크리스트 항목 관련 정보 포함)
  const [projectForm, setProjectForm] = useState<ProjectFormData>({
    projectName: "AI 기반 민원 자동응답 시스템",
    content: `본 과제는 민원 자동응답 AI 챗봇 시스템을 구축하는 것입니다.

[수행 정보]
- 자체수행 여부: 발의부서에서 바이브코딩으로 자체 구축
- 수행주체: OO부서 (외주개발 없음)

[체크리스트 관련 정보]
1. 내부시스템 연계: 업무포털, 민원관리시스템과 API 연동 예정
2. 개인정보 수집: 민원인 성명, 연락처 수집 (처리 후 1년 보관)
3. 민감정보: 건강정보, 정치적 견해 등 민감정보는 수집하지 않음
4. 비공개자료: 내부문서, 대외비 자료는 AI에 입력하지 않음
5. 외부 클라우드 AI: ChatGPT API를 활용하여 자연어 처리 수행
6. 자체 AI 모델: 별도 AI 모델 구축/학습 계획 없음, 외부 API만 활용
7. 대국민 서비스: 일반 국민 대상 민원 응답 서비스로 제공 예정
8. 외부 API 연동: OpenAI API(ChatGPT)와 연동하여 답변 생성
9. 검증 절차: 생성된 답변은 담당자가 검수 후 발송하는 절차 마련
10. 이용약관: ChatGPT 이용약관 및 저작권 사항 검토 완료`,
    department: "",
    managerName: "",
    email: "",
  })

  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>(
    CHECKLIST_QUESTIONS.map((q) => ({
      number: q.number,
      category: q.category,
      question: q.question,
      shortLabel: q.shortLabel,
      userAnswer: null,
      userDetails: "",
    }))
  )

  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)

  // Update form with user info when authenticated
  useEffect(() => {
    if (user) {
      setProjectForm((prev) => ({
        ...prev,
        department: user.team_name || "",
        managerName: user.name || user.username,
        email: user.email || "",
      }))
    }
  }, [user])

  // Step validation
  const isStep1Valid = projectForm.projectName && projectForm.content.length >= 50
  const isStep2Valid = checklistItems.every((item) => item.userAnswer !== null)

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return isStep1Valid
      case 2:
        return isStep2Valid
      default:
        return true
    }
  }

  // Navigation handlers
  const handleNext = useCallback(async () => {
    if (currentStep === 2) {
      // Start analysis
      setCurrentStep(3)
      setIsAnalyzing(true)

      try {
        // Call actual API
        const response = await fetch(apiEndpoints.selfcheckAnalyze, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            project_name: projectForm.projectName,
            department: projectForm.department,
            manager_name: projectForm.managerName,
            contact: "",
            email: projectForm.email,
            project_description: projectForm.content,
            checklist_items: checklistItems.map((item) => ({
              number: item.number,
              user_answer: item.userAnswer || "unknown",
              user_details: item.userDetails || null,
            })),
          }),
        })

        if (response.ok) {
          const data = await response.json()
          // Map API response to AnalysisResult
          const result: AnalysisResult = {
            submissionId: data.submission_id,
            requiresReview: data.requires_review,
            reviewReason: data.review_reason || "",
            items: data.items.map((item: {
              item_number: number
              item_category: string
              question: string
              short_label: string
              user_answer: string | null
              user_details: string | null
              llm_answer: string
              llm_confidence: number
              llm_evidence: string
              llm_risk_level: string
              match_status: string
              final_answer: string | null
              // 확장 필드 (방안 C)
              llm_judgment?: string | null
              llm_quote?: string | null
              llm_reasoning?: string | null
              llm_user_comparison?: string | null
            }) => ({
              number: item.item_number,
              category: item.item_category as "required" | "optional",
              question: item.question,
              shortLabel: item.short_label,
              userAnswer: item.user_answer as "yes" | "no" | "unknown" | null,
              userDetails: item.user_details || "",
              llmAnswer: item.llm_answer as "yes" | "no" | "need_check" | null,
              llmConfidence: item.llm_confidence,
              llmEvidence: item.llm_evidence,
              llmRiskLevel: item.llm_risk_level as "high" | "medium" | "low",
              // 확장 필드 (방안 C: 교차검증 통합)
              llmJudgment: item.llm_judgment || null,
              llmQuote: item.llm_quote || null,
              llmReasoning: item.llm_reasoning || null,
              llmUserComparison: item.llm_user_comparison || null,
            })),
            summary: data.summary,
            nextSteps: data.next_steps,
            usedModel: data.used_model,
            analysisTimeMs: data.analysis_time_ms,
            isSaved: data.is_saved,
            // 유사과제 정보 매핑
            similarProjects: data.similar_projects?.map((proj: {
              submission_id: string
              project_name: string
              department: string
              manager_name: string
              similarity_score: number
              similarity_reason: string
              created_at: string
            }) => ({
              submissionId: proj.submission_id,
              projectName: proj.project_name,
              department: proj.department,
              managerName: proj.manager_name,
              similarityScore: proj.similarity_score,
              similarityReason: proj.similarity_reason,
              createdAt: proj.created_at,
            })) || [],
          }
          setAnalysisResult(result)
        } else if (response.status === 401) {
          alert("로그인이 필요합니다.")
          setCurrentStep(1)
        } else if (response.status === 503) {
          alert("현재 AI 모델이 사용 불가능합니다. 잠시 후 다시 시도해주세요.")
          setCurrentStep(2)
        } else {
          const errorData = await response.json().catch(() => ({}))
          alert(errorData.detail || "분석 중 오류가 발생했습니다.")
          setCurrentStep(2)
        }
      } catch (error) {
        console.error("Analysis error:", error)
        alert("분석 요청 중 오류가 발생했습니다. 네트워크 연결을 확인해주세요.")
        setCurrentStep(2)
      } finally {
        setIsAnalyzing(false)
      }
    } else if (currentStep < 3) {
      setCurrentStep((prev) => prev + 1)
    }
  }, [currentStep, checklistItems, projectForm])

  const handlePrev = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1)
    }
  }, [currentStep])

  const handleRestart = useCallback(() => {
    setCurrentStep(1)
    setProjectForm({
      projectName: "",
      content: "",
      department: user?.team_name || "",
      managerName: user?.name || user?.username || "",
      email: user?.email || "",
    })
    setChecklistItems(
      CHECKLIST_QUESTIONS.map((q) => ({
        number: q.number,
        category: q.category,
        question: q.question,
        shortLabel: q.shortLabel,
        userAnswer: null,
        userDetails: "",
      }))
    )
    setAnalysisResult(null)
  }, [user])

  // Loading state
  if (authLoading) {
    return (
      <PageContainer maxWidth="wide" className="py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex items-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            <span className="text-muted-foreground">로딩 중...</span>
          </div>
        </div>
      </PageContainer>
    )
  }

  // Not authenticated - show login prompt
  if (!isAuthenticated) {
    return (
      <PageContainer maxWidth="wide" className="py-8 space-y-8">
        {/* Background */}
        <div className="absolute inset-0 bg-noise opacity-30 pointer-events-none -z-10" />
        <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-amber-500/5 to-transparent -z-10" />

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 relative z-10">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/20">
                <Shield className="h-5 w-5" />
              </div>
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
                보안성 셀프진단
              </span>
            </h1>
            <p className="text-muted-foreground mt-3 text-lg max-w-2xl">
              과제 내용을 입력하면 AI가 보안성 검토 체크리스트를 자동으로 분석합니다.
            </p>
          </motion.div>
        </div>

        {/* Login Required Card */}
        <motion.div
          className="max-w-lg mx-auto"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Card className="border-2 border-amber-200 dark:border-amber-800">
            <CardHeader className="text-center pb-4">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <Shield className="w-8 h-8 text-amber-600 dark:text-amber-400" />
              </div>
              <CardTitle className="text-xl">로그인이 필요합니다</CardTitle>
              <CardDescription className="text-base">
                보안성 셀프진단은 로그인한 사용자만 이용할 수 있습니다.
                <br />
                회원 정보를 기반으로 담당자 정보가 자동으로 입력됩니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <Link href="/login?redirect=/idea-hub/selfcheck" className="flex-1">
                  <Button className="w-full gap-2" size="lg">
                    <LogIn className="w-4 h-4" />
                    로그인
                  </Button>
                </Link>
                <Link href="/register" className="flex-1">
                  <Button variant="outline" className="w-full gap-2" size="lg">
                    <UserPlus className="w-4 h-4" />
                    회원가입
                  </Button>
                </Link>
              </div>
              <div className="text-center">
                <Link href="/idea-hub" className="text-sm text-muted-foreground hover:underline">
                  AI Idea Hub로 돌아가기
                </Link>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </PageContainer>
    )
  }

  // Authenticated - show diagnosis flow
  return (
    <PageContainer maxWidth="wide" className="space-y-4">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold flex items-center gap-2">
          <Shield className="h-5 w-5 text-muted-foreground" />
          보안성 셀프진단
        </h1>
        <Link href="/idea-hub">
          <Button variant="outline" size="sm" className="gap-1.5">
            <Home className="h-4 w-4" />
            AI Idea Hub
          </Button>
        </Link>
      </div>

      <motion.div
        className="max-w-6xl mx-auto space-y-6"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        {/* Progress Header - 브레드크럼 스타일 */}
        <motion.div variants={itemVariants} className="flex items-center justify-between px-4 py-3 rounded-lg bg-muted/50 border">
          <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
            {STEPS.map((step, index) => (
              <div key={step.number} className="flex items-center">
                <div
                  className={cn(
                    "flex items-center gap-1.5 text-sm transition-colors",
                    step.number < currentStep && "text-green-600 dark:text-green-400",
                    step.number === currentStep && "text-primary font-medium",
                    step.number > currentStep && "text-muted-foreground"
                  )}
                >
                  {step.number < currentStep ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : step.number === currentStep ? (
                    isAnalyzing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border-2 border-primary flex items-center justify-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                      </div>
                    )
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30" />
                  )}
                  <span className="hidden sm:inline">{step.title}</span>
                  <span className="sm:hidden">{step.number}</span>
                </div>
                {index < STEPS.length - 1 && (
                  <ChevronRight className="w-4 h-4 text-muted-foreground/50 mx-1" />
                )}
              </div>
            ))}
          </div>
          <LlmStatusBadge />
        </motion.div>

        {/* Step Content */}
        <motion.div variants={itemVariants}>
        <Card className="min-h-[400px]">
          <CardContent className="pt-6">
            {currentStep === 1 && (
              <ProjectForm
                value={projectForm}
                onChange={setProjectForm}
                user={user}
              />
            )}

            {currentStep === 2 && (
              <ChecklistForm
                items={checklistItems}
                onChange={setChecklistItems}
              />
            )}

            {currentStep === 3 && (
              <div className="space-y-6">
                {/* 분석 진행 중 */}
                {isAnalyzing && (
                  <AnalysisProgress
                    isAnalyzing={isAnalyzing}
                    result={analysisResult}
                    checklistItems={checklistItems}
                  />
                )}

                {/* 분석 완료 - 결과 인라인 표시 */}
                {!isAnalyzing && analysisResult && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                  >
                    <ResultComparison
                      result={analysisResult}
                      projectInfo={{
                        projectName: projectForm.projectName,
                        department: projectForm.department,
                        managerName: projectForm.managerName,
                        contact: "",
                        email: projectForm.email,
                      }}
                      onRestart={handleRestart}
                    />
                  </motion.div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
        </motion.div>

        {/* Navigation Buttons */}
        <motion.div variants={itemVariants} className="flex justify-between">
          <Button
            variant="outline"
            onClick={handlePrev}
            disabled={currentStep === 1 || isAnalyzing}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            이전
          </Button>

          {currentStep < 3 && (
            <Button
              onClick={handleNext}
              disabled={!canProceed() || isAnalyzing}
              className="gap-2"
            >
              {currentStep === 2 ? (
                <>
                  AI 검증 시작
                  <Shield className="w-4 h-4" />
                </>
              ) : (
                <>
                  다음
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
          )}
        </motion.div>
      </motion.div>
    </PageContainer>
  )
}
