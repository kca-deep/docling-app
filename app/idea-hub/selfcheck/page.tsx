"use client"

import { useState, useCallback, useEffect } from "react"
import { PageContainer } from "@/components/page-container"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
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
} from "lucide-react"
import { motion } from "framer-motion"
import Link from "next/link"
import { useAuth } from "@/components/auth/auth-provider"
import { ProjectForm, type ProjectFormData } from "@/components/idea-hub/project-form"
import { ChecklistForm, type ChecklistItem } from "@/components/idea-hub/checklist-form"
import { AnalysisProgress, type AnalysisResult } from "@/components/idea-hub/analysis-progress"
import { ResultComparison } from "@/components/idea-hub/result-comparison"
import { LlmStatusBadge } from "@/components/idea-hub/llm-status-badge"

// 체크리스트 항목 정의 (PDF 문서 기준 질문형)
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
    category: "optional" as const,
    question: "본 과제에서 외부 클라우드 기반 AI 서비스(ChatGPT, Claude 등)를 활용합니까?",
    shortLabel: "외부 클라우드 AI",
  },
  {
    number: 6,
    category: "optional" as const,
    question: "본 과제에서 자체 AI 모델을 구축/학습할 계획이 있습니까?",
    shortLabel: "자체 AI 모델",
  },
  {
    number: 7,
    category: "optional" as const,
    question: "본 과제의 결과물이 대국민 서비스로 제공될 예정입니까?",
    shortLabel: "대국민 서비스",
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
  { number: 3, title: "AI 검증", description: "AI 분석 진행" },
  { number: 4, title: "결과 확인", description: "사용자 vs AI 비교" },
]

export default function SelfCheckPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth()
  const [currentStep, setCurrentStep] = useState(1)
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  // Form data states
  const [projectForm, setProjectForm] = useState<ProjectFormData>({
    projectName: "",
    content: "",
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
      case 3:
        return analysisResult !== null
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

      // Simulate API call (will be replaced with actual API)
      setTimeout(() => {
        // Mock analysis result
        const mockResult: AnalysisResult = {
          submissionId: `selfcheck-${Date.now()}`,
          requiresReview: true,
          reviewReason: "필수항목 2개 해당 (내부시스템 연계, 개인정보 처리)",
          items: checklistItems.map((item) => {
            // Simulate LLM analysis - determine answer based on random factor
            let llmAnswer: "yes" | "no" | "need_check" | null

            if (item.userAnswer === "unknown" || item.userAnswer === null) {
              // User doesn't know, LLM provides its analysis
              llmAnswer = Math.random() > 0.5 ? "yes" : "no"
            } else if (Math.random() > 0.3) {
              // 70% chance: LLM agrees with user
              llmAnswer = item.userAnswer
            } else {
              // 30% chance: LLM disagrees (for demo purposes)
              llmAnswer = item.userAnswer === "yes" ? "no" : "yes"
            }

            return {
              ...item,
              llmAnswer,
              llmConfidence: 0.7 + Math.random() * 0.3,
              llmEvidence: `AI가 과제 내용에서 "${item.shortLabel}" 관련 키워드를 분석한 결과입니다.`,
              llmRiskLevel: (item.category === "required" ? "high" : "medium") as "high" | "medium" | "low",
            }
          }),
          summary: "필수 항목 중 2개가 해당되어 상위기관 보안성 검토가 필요합니다.",
          nextSteps: [
            "보안성 검토 서류 6종 작성",
            "정보보호팀 제출 (security@kca.kr)",
            "CAIO/BAIO 추진과제 선정 회의 상정",
          ],
          usedModel: "gpt-oss-20b",
          analysisTimeMs: 2500,
        }

        setAnalysisResult(mockResult)
        setIsAnalyzing(false)
      }, 3000)
    } else if (currentStep < 4) {
      setCurrentStep((prev) => prev + 1)
    }
  }, [currentStep, checklistItems])

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

  const progress = ((currentStep - 1) / (STEPS.length - 1)) * 100

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
        <div className="max-w-lg mx-auto">
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
        </div>
      </PageContainer>
    )
  }

  // Authenticated - show diagnosis flow
  return (
    <PageContainer maxWidth="wide" className="py-8 space-y-8">
      {/* Background Noise & Gradient */}
      <div className="absolute inset-0 bg-noise opacity-30 pointer-events-none -z-10" />
      <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-amber-500/5 to-transparent -z-10" />

      {/* Page Header */}
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

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Link href="/idea-hub">
            <Button variant="outline" className="gap-2 rounded-full">
              <Home className="h-4 w-4" />
              AI Idea Hub
            </Button>
          </Link>
        </motion.div>
      </div>

      <div className="max-w-6xl mx-auto space-y-6">
        {/* Progress Header */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <Shield className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <CardTitle className="text-lg">
                    Step {currentStep}/{STEPS.length}: {STEPS[currentStep - 1].title}
                  </CardTitle>
                  <CardDescription>
                    {STEPS[currentStep - 1].description}
                  </CardDescription>
                </div>
              </div>
              <LlmStatusBadge />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {/* Progress Bar */}
            <Progress value={progress} className="h-2 mb-4" />

            {/* Step Indicators */}
            <div className="flex justify-between">
              {STEPS.map((step) => (
                <div
                  key={step.number}
                  className={cn(
                    "flex flex-col items-center gap-1",
                    step.number <= currentStep ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  <div
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors",
                      step.number < currentStep
                        ? "bg-primary border-primary text-primary-foreground"
                        : step.number === currentStep
                        ? "border-primary text-primary"
                        : "border-muted-foreground/30"
                    )}
                  >
                    {step.number < currentStep ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : step.number === currentStep && isAnalyzing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <span className="text-sm font-medium">{step.number}</span>
                    )}
                  </div>
                  <span className="text-xs font-medium hidden sm:block">{step.title}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Step Content */}
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
              <AnalysisProgress
                isAnalyzing={isAnalyzing}
                result={analysisResult}
                checklistItems={checklistItems}
              />
            )}

            {currentStep === 4 && analysisResult && (
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
            )}
          </CardContent>
        </Card>

        {/* Navigation Buttons */}
        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={handlePrev}
            disabled={currentStep === 1 || isAnalyzing}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            이전
          </Button>

          {currentStep < 4 && (
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
              ) : currentStep === 3 ? (
                <>
                  결과 확인
                  <ArrowRight className="w-4 h-4" />
                </>
              ) : (
                <>
                  다음
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </PageContainer>
  )
}
