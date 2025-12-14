"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Loader2,
  FileText,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Check,
  FileCode,
  MessageSquare,
  Save,
  AlertCircle,
  Cpu,
  Zap,
} from "lucide-react"
import { toast } from "sonner"
import { API_BASE_URL } from "@/lib/api-config"
import { cn } from "@/lib/utils"
import { PromptEditor } from "./PromptEditor"
import { SuggestedQuestionsEditor } from "./SuggestedQuestionsEditor"

interface Document {
  id: number
  original_filename: string
  file_type: string
  created_at: string
  page_count?: number
}

interface PromptTemplate {
  id: string
  name: string
  description: string
  icon: React.ReactNode
}

interface GeneratedPrompt {
  content: string
  suggestedQuestions: string[]
}

interface ModelOption {
  key: string
  label: string
  description: string
  status: "healthy" | "unhealthy" | "degraded" | "unconfigured" | "error"
  error?: string
}

// 모델별 아이콘 매핑
const getModelIcon = (modelKey: string) => {
  if (modelKey.includes("gpt-oss")) {
    return <Sparkles className="h-4 w-4" style={{ color: "var(--chart-1)" }} />
  }
  if (modelKey.includes("exaone") && modelKey.includes("32b")) {
    return <Cpu className="h-4 w-4" style={{ color: "var(--chart-2)" }} />
  }
  if (modelKey.includes("exaone")) {
    return <Zap className="h-4 w-4" style={{ color: "var(--chart-3)" }} />
  }
  return <Sparkles className="h-4 w-4" style={{ color: "var(--chart-4)" }} />
}

// 상태 표시 점
const StatusDot = ({ status }: { status: string }) => (
  <span
    className={cn(
      "w-2 h-2 rounded-full shrink-0",
      status === "healthy" ? "bg-green-500" : "bg-red-500"
    )}
  />
)

interface PromptGeneratorModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  collectionName: string
  onSuccess?: () => void
}

const TEMPLATES: PromptTemplate[] = [
  {
    id: "regulation",
    name: "규정/지침",
    description: "인사규정, 복무지침, 내규 등 규정 문서에 최적화된 프롬프트",
    icon: <FileText className="h-4 w-4" />,
  },
  {
    id: "budget",
    name: "예산/재무",
    description: "예산안, 결산서, 재무제표 등 재무 문서에 최적화된 프롬프트",
    icon: <FileCode className="h-4 w-4" />,
  },
  {
    id: "casual",
    name: "일상대화",
    description: "친근하고 자연스러운 대화형 응답에 최적화된 프롬프트",
    icon: <MessageSquare className="h-4 w-4" />,
  },
  {
    id: "technical",
    name: "기술문서",
    description: "API 문서, 시스템 설계서, 매뉴얼 등 기술 문서에 최적화된 프롬프트",
    icon: <FileCode className="h-4 w-4" />,
  },
  {
    id: "default",
    name: "일반 문서",
    description: "기본 RAG 프롬프트 (범용적으로 사용 가능)",
    icon: <FileText className="h-4 w-4" />,
  },
]

const STEPS = [
  { id: 1, name: "문서 선택", description: "프롬프트 생성에 사용할 문서 선택" },
  { id: 2, name: "생성 설정", description: "LLM 및 템플릿 선택" },
  { id: 3, name: "파일명 입력", description: "저장할 프롬프트 파일명 입력" },
  { id: 4, name: "생성 및 편집", description: "프롬프트 생성 결과 확인 및 편집" },
]

// 초기 fallback 모델 목록
const FALLBACK_MODELS: ModelOption[] = [
  { key: "gpt-oss-20b", label: "GPT-OSS 20B", description: "빠른 응답, 범용", status: "healthy" },
  { key: "exaone-deep-7.8b", label: "EXAONE 7.8B", description: "경량화, 빠른 추론", status: "healthy" },
  { key: "exaone-4.0-32b", label: "EXAONE 32B", description: "고성능, 장문 처리", status: "healthy" },
]

export function PromptGeneratorModal({
  open,
  onOpenChange,
  collectionName,
  onSuccess,
}: PromptGeneratorModalProps) {
  // Step state
  const [currentStep, setCurrentStep] = useState(1)

  // Step 1: Document selection
  const [documents, setDocuments] = useState<Document[]>([])
  const [selectedDocIds, setSelectedDocIds] = useState<number[]>([])
  const [loadingDocs, setLoadingDocs] = useState(false)

  // Step 2: LLM and Template selection
  const [selectedTemplate, setSelectedTemplate] = useState<string>("default")
  const [selectedModel, setSelectedModel] = useState<string>("gpt-oss-20b")
  const [modelOptions, setModelOptions] = useState<ModelOption[]>(FALLBACK_MODELS)
  const [isLoadingModels, setIsLoadingModels] = useState(true)

  // Step 3: Filename
  const [promptFilename, setPromptFilename] = useState("")

  // Step 4: Generation and editing
  const [generating, setGenerating] = useState(false)
  const [generationProgress, setGenerationProgress] = useState(0)
  const [generatedPrompt, setGeneratedPrompt] = useState<GeneratedPrompt | null>(null)
  const [editedPrompt, setEditedPrompt] = useState("")
  const [editedQuestions, setEditedQuestions] = useState<string[]>([])

  // Saving state
  const [saving, setSaving] = useState(false)

  // LLM 모델 상태 가져오기
  const fetchLLMModels = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/health/llm-models`, {
        credentials: "include"
      })
      if (response.ok) {
        const data = await response.json()
        const models = data.models || []
        setModelOptions(models)

        // 현재 선택된 모델이 unhealthy면 healthy한 모델로 전환
        const currentModel = models.find((m: ModelOption) => m.key === selectedModel)
        if (!currentModel || currentModel.status !== "healthy") {
          const healthyModel = models.find((m: ModelOption) => m.status === "healthy")
          if (healthyModel) {
            setSelectedModel(healthyModel.key)
          }
        }
      }
    } catch (error) {
      console.error("Failed to fetch LLM models:", error)
    } finally {
      setIsLoadingModels(false)
    }
  }, [selectedModel])

  // Load documents and LLM models when modal opens
  useEffect(() => {
    if (open && collectionName) {
      fetchDocuments()
      fetchLLMModels()
      // Reset state
      setCurrentStep(1)
      setSelectedDocIds([])
      setSelectedTemplate("default")
      setPromptFilename(`${collectionName}_prompt`)
      setGeneratedPrompt(null)
      setEditedPrompt("")
      setEditedQuestions([])
      setGenerationProgress(0)
    }
  }, [open, collectionName])

  // Fetch documents in the collection
  const fetchDocuments = async () => {
    setLoadingDocs(true)
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/prompts/documents/${encodeURIComponent(collectionName)}`,
        { credentials: "include" }
      )
      if (response.ok) {
        const data = await response.json()
        setDocuments(data.documents || [])
      } else {
        toast.error("문서 목록을 불러오는데 실패했습니다")
      }
    } catch (error) {
      console.error("Failed to fetch documents:", error)
      toast.error("문서 목록을 불러오는데 실패했습니다")
    } finally {
      setLoadingDocs(false)
    }
  }

  // Toggle document selection
  const toggleDocument = (docId: number) => {
    setSelectedDocIds((prev) =>
      prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId]
    )
  }

  // Select all documents
  const selectAllDocuments = () => {
    if (selectedDocIds.length === documents.length) {
      setSelectedDocIds([])
    } else {
      setSelectedDocIds(documents.map((d) => d.id))
    }
  }

  // Generate prompt using real API
  const generatePrompt = async () => {
    setGenerating(true)
    setGenerationProgress(0)

    try {
      // 1. Start generation task
      const startResponse = await fetch(`${API_BASE_URL}/api/prompts/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          collection_name: collectionName,
          document_ids: selectedDocIds,
          template_type: selectedTemplate,
          prompt_filename: promptFilename,
          model: selectedModel,
        }),
      })

      if (!startResponse.ok) {
        const error = await startResponse.json()
        throw new Error(error.detail || "프롬프트 생성 시작 실패")
      }

      const { task_id } = await startResponse.json()

      // 2. Poll for status
      let completed = false
      while (!completed) {
        await new Promise((resolve) => setTimeout(resolve, 1000))

        const statusResponse = await fetch(
          `${API_BASE_URL}/api/prompts/generate/${task_id}`,
          { credentials: "include" }
        )

        if (!statusResponse.ok) {
          throw new Error("상태 조회 실패")
        }

        const status = await statusResponse.json()
        setGenerationProgress(status.progress)

        if (status.status === "completed") {
          completed = true
          const result = status.result

          setGeneratedPrompt({
            content: result.prompt_content,
            suggestedQuestions: result.suggested_questions,
          })
          setEditedPrompt(result.prompt_content)
          setEditedQuestions([...result.suggested_questions])

          toast.success("프롬프트가 생성되었습니다")
        } else if (status.status === "failed") {
          throw new Error(status.error || "프롬프트 생성 실패")
        }
      }
    } catch (error) {
      console.error("Failed to generate prompt:", error)
      toast.error(error instanceof Error ? error.message : "프롬프트 생성에 실패했습니다")
    } finally {
      setGenerating(false)
    }
  }

  // Generate mock prompt based on template
  const generateMockPrompt = (): GeneratedPrompt => {
    const templateContents: Record<string, GeneratedPrompt> = {
      regulation: {
        content: `# ${collectionName} 규정 문서 RAG 시스템 프롬프트

## 역할
당신은 ${collectionName} 컬렉션에 포함된 규정 및 지침 문서를 기반으로 질문에 답변하는 AI 어시스턴트입니다.

## 지침
1. **정확성 우선**: 규정 문서에 명시된 내용만을 기반으로 답변하세요.
2. **출처 명시**: 답변 시 관련 규정의 조항 번호나 페이지를 함께 안내하세요.
3. **명확한 구분**: 규정에 명시된 내용과 일반적인 해석을 명확히 구분하세요.
4. **불확실성 인정**: 규정에 없는 내용은 "해당 규정에서 확인되지 않습니다"라고 안내하세요.

## 답변 형식
- 핵심 답변을 먼저 제시
- 근거가 되는 규정 조항 인용
- 추가 참고사항이나 예외 사항 안내

## 주의사항
- 규정 간 충돌이 있을 경우 상위 규정을 우선
- 최신 개정 내용을 우선적으로 참조
- 법률 자문이 필요한 사항은 전문가 상담 권유`,
        suggestedQuestions: [
          "이 규정의 적용 대상은 누구인가요?",
          "주요 용어의 정의를 알려주세요.",
          "위반 시 처분 절차는 어떻게 되나요?",
          "예외 조항이 있나요?",
          "최근 개정된 내용이 있나요?",
        ],
      },
      budget: {
        content: `# ${collectionName} 재무 문서 RAG 시스템 프롬프트

## 역할
당신은 ${collectionName} 컬렉션에 포함된 예산 및 재무 문서를 기반으로 질문에 답변하는 AI 어시스턴트입니다.

## 지침
1. **수치 정확성**: 금액, 비율 등 수치 정보는 정확히 인용하세요.
2. **맥락 설명**: 예산 항목의 전후 맥락과 용도를 함께 설명하세요.
3. **비교 분석**: 가능한 경우 전년도 대비 변화를 함께 안내하세요.
4. **단위 명시**: 모든 금액은 단위(원, 천원, 백만원 등)를 명확히 표기하세요.

## 답변 형식
- 핵심 수치 먼저 제시
- 관련 예산 항목 설명
- 참조 페이지 또는 표 번호 안내

## 주의사항
- 집행 현황과 계획을 구분하여 안내
- 예산 변경 사항 반영 여부 확인
- 민감한 재무 정보는 공개 범위 내에서 답변`,
        suggestedQuestions: [
          "총 예산 규모는 얼마인가요?",
          "주요 지출 항목은 무엇인가요?",
          "전년도 대비 증감된 항목이 있나요?",
          "예비비 규모와 사용 계획은?",
          "사업별 예산 배분 현황을 알려주세요.",
        ],
      },
      casual: {
        content: `# ${collectionName} 일상대화 시스템 프롬프트

## 역할
당신은 친근하고 도움이 되는 대화 AI입니다. 자연스럽고 편안한 대화를 나눕니다.

## 대화 스타일
1. **친근한 어투**: 자연스럽고 편안한 대화체를 사용하세요.
2. **공감과 경청**: 사용자의 이야기에 공감하고 적극적으로 경청하세요.
3. **실용적 조언**: 필요시 실용적이고 건설적인 조언을 제공하세요.
4. **명확한 표현**: 이해하기 쉬운 언어로 소통하세요.

## 답변 형식
- 자연스러운 대화체로 응답
- 필요시 추가 질문으로 맥락 파악
- 관련 팁이나 추천 정보 제공

## 주의사항
- 의료, 법률, 금융 등 전문 분야는 전문가 상담 권장
- 불확실한 정보는 추측임을 명시
- 부적절한 요청은 정중히 거절`,
        suggestedQuestions: [
          "오늘 어떤 도움이 필요하신가요?",
          "추천해줄 만한 것이 있을까요?",
          "이것에 대해 어떻게 생각하세요?",
          "조언이 필요한 부분이 있나요?",
          "더 알고 싶은 것이 있으신가요?",
        ],
      },
      technical: {
        content: `# ${collectionName} 기술문서 RAG 시스템 프롬프트

## 역할
당신은 ${collectionName} 컬렉션에 포함된 기술 문서(API 문서, 시스템 설계서, 매뉴얼 등)를 기반으로 질문에 답변하는 AI 어시스턴트입니다.

## 지침
1. **코드 정확성**: 코드, 명령어, 설정값은 원문 그대로 정확히 인용하세요.
2. **버전 명시**: 해당 정보가 적용되는 버전을 함께 안내하세요.
3. **단계별 안내**: 설치, 설정, 사용 절차는 순서대로 명확하게 안내하세요.
4. **예제 포함**: 가능한 경우 실제 사용 예제를 함께 제공하세요.

## 답변 형식
- 핵심 답변 먼저 제시
- 코드/명령어는 코드 블록으로 표시
- 파라미터/설정은 표 형식으로 정리
- 주의사항 및 호환성 정보 안내

## 주의사항
- 버전별 차이가 있을 경우 명시
- 보안 관련 설정은 주의사항 강조
- 문서에 없는 내용은 공식 문서 확인 권장`,
        suggestedQuestions: [
          "이 API의 사용 방법은 어떻게 되나요?",
          "설치 및 설정 절차를 알려주세요.",
          "필수 파라미터와 옵션을 설명해주세요.",
          "이 오류의 해결 방법은 무엇인가요?",
          "시스템 요구사항은 무엇인가요?",
        ],
      },
      default: {
        content: `# ${collectionName} RAG 시스템 프롬프트

## 역할
당신은 ${collectionName} 컬렉션에 포함된 문서를 기반으로 질문에 답변하는 AI 어시스턴트입니다.

## 지침
1. **문서 기반 답변**: 제공된 문서 내용을 기반으로 정확하게 답변하세요.
2. **출처 명시**: 답변에 사용된 문서의 출처를 함께 안내하세요.
3. **명확한 표현**: 이해하기 쉬운 언어로 설명하세요.
4. **불확실성 인정**: 문서에 없는 내용은 솔직히 "확인되지 않습니다"라고 안내하세요.

## 답변 형식
- 질문에 대한 핵심 답변 먼저 제시
- 상세 설명 및 근거 제공
- 관련 참고 정보 안내

## 주의사항
- 문서에 명시된 정보만 활용
- 개인적인 추측이나 의견은 배제
- 추가 정보가 필요한 경우 안내`,
        suggestedQuestions: [
          "이 문서의 주요 내용은 무엇인가요?",
          "관련 정책이나 절차가 있나요?",
          "핵심 용어를 설명해주세요.",
          "최근 변경된 내용이 있나요?",
          "추가 참고 자료가 있나요?",
        ],
      },
    }

    return templateContents[selectedTemplate] || templateContents.default
  }

  // Save prompt using real API
  const savePrompt = async () => {
    setSaving(true)
    try {
      const response = await fetch(`${API_BASE_URL}/api/prompts/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          collection_name: collectionName,
          prompt_filename: promptFilename,
          prompt_content: editedPrompt,
          suggested_questions: editedQuestions,
          description: `${collectionName} 컬렉션 프롬프트`,
          recommended_params: {
            top_k: 10,
            temperature: 0.3,
            reasoning_level: "medium",
          },
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || "저장 실패")
      }

      const result = await response.json()
      toast.success(result.message || `'${promptFilename}.md' 프롬프트가 저장되었습니다`)
      onOpenChange(false)
      onSuccess?.()
    } catch (error) {
      console.error("Failed to save prompt:", error)
      toast.error(error instanceof Error ? error.message : "프롬프트 저장에 실패했습니다")
    } finally {
      setSaving(false)
    }
  }

  // Navigation
  const selectedModelOption = modelOptions.find(m => m.key === selectedModel)
  const isSelectedModelHealthy = selectedModelOption?.status === "healthy"

  const canGoNext = () => {
    switch (currentStep) {
      case 1:
        return selectedDocIds.length > 0
      case 2:
        return selectedTemplate !== "" && selectedModel !== "" && isSelectedModelHealthy
      case 3:
        return promptFilename.trim() !== ""
      case 4:
        return editedPrompt.trim() !== ""
      default:
        return false
    }
  }

  const goNext = () => {
    if (currentStep === 3 && !generatedPrompt) {
      // Start generation when moving to step 4
      setCurrentStep(4)
      generatePrompt()
    } else if (currentStep < 4) {
      setCurrentStep(currentStep + 1)
    }
  }

  const goBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh] flex flex-col">
        <DialogHeader className="pb-4 border-b">
          <div className="flex items-start gap-3">
            <div className="p-3 rounded-xl bg-gradient-to-br from-[color:var(--chart-1)] to-[color:var(--chart-2)] text-white shadow-lg">
              <Sparkles className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-lg font-bold">
                프롬프트 자동 생성
              </DialogTitle>
              <DialogDescription className="mt-1 flex items-center gap-2 text-sm">
                <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{collectionName}</span>
                <span className="text-muted-foreground/50">·</span>
                <span>{documents.length}개 문서 기반</span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Step indicator - Progress bar style */}
        <div className="py-4 space-y-3">
          {/* Step labels */}
          <div className="flex justify-between px-2">
            {STEPS.map((step) => (
              <div key={step.id} className="flex flex-col items-center flex-1">
                <span
                  className={cn(
                    "text-xs font-medium transition-colors",
                    currentStep === step.id
                      ? "text-[color:var(--chart-1)]"
                      : currentStep > step.id
                      ? "text-foreground"
                      : "text-muted-foreground"
                  )}
                >
                  {step.name}
                </span>
                {/* Step summary - show below current/completed steps */}
                <span className="text-[10px] text-muted-foreground mt-0.5 h-4">
                  {currentStep > step.id && step.id === 1 && selectedDocIds.length > 0 && (
                    `${selectedDocIds.length}개 선택`
                  )}
                  {currentStep > step.id && step.id === 2 && (
                    `${modelOptions.find(m => m.key === selectedModel)?.label?.split(" ")[0] || "LLM"}`
                  )}
                  {currentStep > step.id && step.id === 3 && promptFilename && (
                    `${promptFilename}.md`
                  )}
                  {currentStep === step.id && "진행 중"}
                </span>
              </div>
            ))}
          </div>
          {/* Progress bar */}
          <div className="relative h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-[color:var(--chart-1)] to-[color:var(--chart-2)] rounded-full transition-all duration-500"
              style={{ width: `${((currentStep - 1) / (STEPS.length - 1)) * 100}%` }}
            />
            {/* Step dots */}
            <div className="absolute inset-0 flex justify-between items-center px-0">
              {STEPS.map((step) => (
                <div
                  key={step.id}
                  className={cn(
                    "w-4 h-4 rounded-full border-2 transition-all flex items-center justify-center",
                    currentStep > step.id
                      ? "bg-[color:var(--chart-1)] border-[color:var(--chart-1)]"
                      : currentStep === step.id
                      ? "bg-background border-[color:var(--chart-1)] ring-4 ring-[color:var(--chart-1)]/20"
                      : "bg-background border-muted-foreground/30"
                  )}
                >
                  {currentStep > step.id && (
                    <Check className="h-2.5 w-2.5 text-white" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Step content */}
        <div className="flex-1 overflow-hidden py-4">
          {/* Step 1: Document Selection */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium">
                  프롬프트 생성에 사용할 문서 선택
                </Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={selectAllDocuments}
                  disabled={loadingDocs || documents.length === 0}
                >
                  {selectedDocIds.length === documents.length ? "전체 해제" : "전체 선택"}
                </Button>
              </div>

              {loadingDocs ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : documents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <AlertCircle className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    이 컬렉션에 업로드된 문서가 없습니다.
                  </p>
                </div>
              ) : (
                <ScrollArea className="h-[280px] rounded-md border p-4">
                  <div className="space-y-3">
                    {documents.map((doc) => (
                      <div
                        key={doc.id}
                        className={cn(
                          "flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-colors",
                          selectedDocIds.includes(doc.id)
                            ? "border-primary bg-primary/5"
                            : "border-muted hover:border-muted-foreground/50"
                        )}
                        onClick={() => toggleDocument(doc.id)}
                      >
                        <Checkbox
                          checked={selectedDocIds.includes(doc.id)}
                          onCheckedChange={() => toggleDocument(doc.id)}
                        />
                        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {doc.original_filename}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {doc.file_type.toUpperCase()}
                            {doc.page_count && ` | ${doc.page_count}페이지`}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}

              <p className="text-sm text-muted-foreground">
                {selectedDocIds.length}개 문서 선택됨
              </p>
            </div>
          )}

          {/* Step 2: Generation Settings - LLM & Template */}
          {currentStep === 2 && (
            <div className="space-y-5">
              {/* LLM Selection */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">생성에 사용할 LLM</Label>
                <Select value={selectedModel} onValueChange={setSelectedModel}>
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {(() => {
                        const model = modelOptions.find(m => m.key === selectedModel)
                        if (!model) return "LLM 선택..."
                        return (
                          <div className="flex items-center gap-2">
                            <StatusDot status={model.status} />
                            {getModelIcon(model.key)}
                            <span>{model.label}</span>
                          </div>
                        )
                      })()}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {modelOptions.map((model) => (
                      <SelectItem
                        key={model.key}
                        value={model.key}
                        disabled={model.status !== "healthy"}
                        className={cn(model.status !== "healthy" && "opacity-50")}
                      >
                        <div className="flex items-center gap-2">
                          <StatusDot status={model.status} />
                          {getModelIcon(model.key)}
                          <div className="flex flex-col">
                            <span className="font-medium">{model.label}</span>
                            <span className="text-xs text-muted-foreground">
                              {model.status === "healthy"
                                ? model.description
                                : model.error || "서버에 연결할 수 없습니다"}
                            </span>
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Template Selection */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">문서 유형에 맞는 템플릿</Label>
                <div className="grid grid-cols-3 gap-2">
                  {TEMPLATES.map((template, index) => {
                    const isSelected = selectedTemplate === template.id
                    const colorVar = (index % 4) + 1
                    return (
                      <div
                        key={template.id}
                        className={cn(
                          "relative p-2.5 rounded-lg border cursor-pointer transition-all",
                          isSelected
                            ? "border-[color:var(--chart-" + colorVar + ")] bg-[color:var(--chart-" + colorVar + ")]/5"
                            : "border-muted hover:border-muted-foreground/50"
                        )}
                        onClick={() => setSelectedTemplate(template.id)}
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className={cn(
                              "w-7 h-7 rounded flex items-center justify-center shrink-0 transition-colors",
                              isSelected ? "" : "bg-muted text-muted-foreground"
                            )}
                            style={isSelected ? {
                              backgroundColor: `color-mix(in srgb, var(--chart-${colorVar}) 15%, transparent)`,
                              color: `var(--chart-${colorVar})`
                            } : undefined}
                          >
                            {template.icon}
                          </div>
                          <span className="text-xs font-medium truncate">{template.name}</span>
                          {isSelected && (
                            <Check className="h-3.5 w-3.5 ml-auto shrink-0" style={{ color: `var(--chart-${colorVar})` }} />
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Filename Input */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="filename" className="text-base font-medium">
                  프롬프트 파일명
                </Label>
                <p className="text-sm text-muted-foreground">
                  생성된 프롬프트가 저장될 파일명을 입력하세요.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Input
                  id="filename"
                  value={promptFilename}
                  onChange={(e) => setPromptFilename(e.target.value)}
                  placeholder="예: 인사규정_prompt"
                  className="flex-1"
                />
                <span className="text-sm text-muted-foreground">.md</span>
              </div>

              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-sm font-medium mb-2">생성 요약</p>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p>
                    선택된 문서: <Badge variant="secondary">{selectedDocIds.length}개</Badge>
                  </p>
                  <p>
                    템플릿:{" "}
                    <Badge variant="secondary">
                      {TEMPLATES.find((t) => t.id === selectedTemplate)?.name}
                    </Badge>
                  </p>
                  <p>
                    저장 경로:{" "}
                    <code className="text-xs bg-muted px-1 py-0.5 rounded">
                      backend/prompts/{promptFilename}.md
                    </code>
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Generation and Editing */}
          {currentStep === 4 && (
            <div className="space-y-4 h-full">
              {generating ? (
                <div className="flex flex-col items-center justify-center py-8">
                  {/* Animated icon */}
                  <div className="relative mb-6">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[color:var(--chart-1)] to-[color:var(--chart-2)] flex items-center justify-center shadow-lg">
                      <Sparkles className="h-10 w-10 text-white animate-pulse" />
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-background border-2 border-[color:var(--chart-1)] flex items-center justify-center">
                      <Loader2 className="h-3 w-3 animate-spin text-[color:var(--chart-1)]" />
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="w-64 space-y-2 mb-4">
                    <div className="relative h-3 bg-muted rounded-full overflow-hidden">
                      <div
                        className="absolute inset-y-0 left-0 bg-gradient-to-r from-[color:var(--chart-1)] to-[color:var(--chart-2)] rounded-full transition-all duration-500"
                        style={{ width: `${generationProgress}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>
                        {generationProgress < 30 ? "문서 분석 중..." :
                         generationProgress < 60 ? "프롬프트 생성 중..." :
                         generationProgress < 90 ? "추천 질문 생성 중..." : "마무리 중..."}
                      </span>
                      <span className="font-mono">{generationProgress}%</span>
                    </div>
                  </div>

                  {/* Generation steps */}
                  <div className="flex gap-3 text-xs">
                    {[
                      { label: "문서 분석", threshold: 30 },
                      { label: "프롬프트 생성", threshold: 60 },
                      { label: "추천 질문", threshold: 90 },
                    ].map((phase, i) => (
                      <div
                        key={phase.label}
                        className={cn(
                          "flex items-center gap-1.5 px-2 py-1 rounded-full transition-colors",
                          generationProgress >= phase.threshold
                            ? "bg-[color:var(--chart-1)]/10 text-[color:var(--chart-1)]"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {generationProgress >= phase.threshold ? (
                          <Check className="h-3 w-3" />
                        ) : generationProgress >= phase.threshold - 30 ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <div className="w-3 h-3 rounded-full border border-current" />
                        )}
                        <span>{phase.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : generatedPrompt ? (
                <Tabs defaultValue="prompt" className="w-full h-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="prompt" className="flex items-center gap-2">
                      <FileCode className="h-4 w-4" />
                      시스템 프롬프트
                    </TabsTrigger>
                    <TabsTrigger value="questions" className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      추천 질문
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="prompt" className="mt-4">
                    <PromptEditor
                      value={editedPrompt}
                      onChange={setEditedPrompt}
                      className="h-[280px]"
                    />
                  </TabsContent>
                  <TabsContent value="questions" className="mt-4">
                    <SuggestedQuestionsEditor
                      questions={editedQuestions}
                      onChange={setEditedQuestions}
                    />
                  </TabsContent>
                </Tabs>
              ) : (
                <div className="flex items-center justify-center py-12">
                  <AlertCircle className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
            </div>
          )}
        </div>

        <Separator />

        {/* Footer with navigation */}
        <DialogFooter className="flex-row justify-between sm:justify-between">
          <Button
            variant="outline"
            onClick={goBack}
            disabled={currentStep === 1 || generating || saving}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            이전
          </Button>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={generating || saving}
            >
              취소
            </Button>

            {currentStep === 4 && generatedPrompt ? (
              <Button onClick={savePrompt} disabled={saving || !editedPrompt.trim()}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    저장 중...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    저장
                  </>
                )}
              </Button>
            ) : (
              <Button onClick={goNext} disabled={!canGoNext() || generating}>
                {currentStep === 3 ? (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    생성 시작
                  </>
                ) : (
                  <>
                    다음
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </>
                )}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
