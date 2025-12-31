"use client"

import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Loader2,
  FileText,
  Sparkles,
  Check,
  FileCode,
  MessageSquare,
  Save,
  AlertCircle,
  RefreshCw,
  ChevronsUpDown,
  Copy,
  RotateCcw,
  HelpCircle,
  X,
  Plus,
  Wifi,
  WifiOff,
} from "lucide-react"
import { toast } from "sonner"
import { API_BASE_URL } from "@/lib/api-config"
import { cn } from "@/lib/utils"
import { AnimatedKcaLogo } from "@/components/ui/animated-kca-logo"

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

const TEMPLATES: PromptTemplate[] = [
  { id: "regulation", name: "규정/지침", icon: <FileText className="h-3.5 w-3.5" /> },
  { id: "budget", name: "예산/재무", icon: <FileCode className="h-3.5 w-3.5" /> },
  { id: "casual", name: "일상대화", icon: <MessageSquare className="h-3.5 w-3.5" /> },
  { id: "technical", name: "기술문서", icon: <FileCode className="h-3.5 w-3.5" /> },
  { id: "default", name: "일반 문서", icon: <FileText className="h-3.5 w-3.5" /> },
]

const FALLBACK_MODELS: ModelOption[] = [
  { key: "gpt-oss-20b", label: "GPT-OSS 20B", description: "빠른 응답", status: "healthy" },
  { key: "exaone-4.0-32b", label: "EXAONE 32B", description: "고성능", status: "healthy" },
]

// 타이핑 dots 애니메이션 (셀프진단 스타일)
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

// 모델별 색상 매핑 (ChatHeader와 동일)
const getModelColorClass = (modelKey: string) => {
  if (modelKey.includes("gpt-oss")) {
    return {
      border: "border-violet-500/50",
      text: "text-violet-700 dark:text-violet-300",
      dot: "bg-violet-500",
      primary: "#8B5CF6",
      secondary: "#A78BFA",
    }
  }
  if (modelKey.includes("exaone")) {
    return {
      border: "border-teal-500/50",
      text: "text-teal-700 dark:text-teal-300",
      dot: "bg-teal-500",
      primary: "#14B8A6",
      secondary: "#2DD4BF",
    }
  }
  return {
    border: "border-gray-500/50",
    text: "text-gray-700 dark:text-gray-300",
    dot: "bg-gray-500",
    primary: "#6B7280",
    secondary: "#9CA3AF",
  }
}


interface PromptGeneratorModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  collectionName: string
  onSuccess?: () => void
}

export function PromptGeneratorModal({
  open,
  onOpenChange,
  collectionName,
  onSuccess,
}: PromptGeneratorModalProps) {
  // 문서 상태
  const [documents, setDocuments] = useState<Document[]>([])
  const [selectedDocIds, setSelectedDocIds] = useState<number[]>([])
  const [loadingDocs, setLoadingDocs] = useState(false)
  const [docPopoverOpen, setDocPopoverOpen] = useState(false)

  // 설정 상태
  const [selectedTemplate, setSelectedTemplate] = useState<string>("default")
  const [selectedModel, setSelectedModel] = useState<string>("gpt-oss-20b")
  const [modelOptions, setModelOptions] = useState<ModelOption[]>(FALLBACK_MODELS)
  const [promptFilename, setPromptFilename] = useState("")

  // 생성 상태
  const [generating, setGenerating] = useState(false)
  const [generationProgress, setGenerationProgress] = useState(0)
  const [generationMessage, setGenerationMessage] = useState("")
  const [generationError, setGenerationError] = useState<string | null>(null)
  const [generatedPrompt, setGeneratedPrompt] = useState<GeneratedPrompt | null>(null)
  const [editedPrompt, setEditedPrompt] = useState("")
  const [editedQuestions, setEditedQuestions] = useState<string[]>([])

  // 저장 상태
  const [saving, setSaving] = useState(false)

  // 결과 패널 상태
  const [resultPanelOpen, setResultPanelOpen] = useState(false)
  const [resultTab, setResultTab] = useState<"prompt" | "questions">("prompt")

  // LLM 모델 상태 가져오기
  const fetchLLMModels = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/health/llm-models`, { credentials: "include" })
      if (response.ok) {
        const data = await response.json()
        const models = data.models || []
        setModelOptions(models)

        const currentModel = models.find((m: ModelOption) => m.key === selectedModel)
        if (!currentModel || currentModel.status !== "healthy") {
          const healthyModel = models.find((m: ModelOption) => m.status === "healthy")
          if (healthyModel) setSelectedModel(healthyModel.key)
        }
      }
    } catch (error) {
      console.error("Failed to fetch LLM models:", error)
    }
  }, [selectedModel])

  // 모달 열릴 때 초기화
  useEffect(() => {
    if (open && collectionName) {
      fetchDocuments()
      fetchLLMModels()
      setSelectedDocIds([])
      setSelectedTemplate("default")
      setPromptFilename(`${collectionName}_prompt`)
      setGeneratedPrompt(null)
      setEditedPrompt("")
      setEditedQuestions([])
      setGenerationProgress(0)
      setGenerationMessage("")
      setGenerationError(null)
      setResultPanelOpen(false)
      setResultTab("prompt")
    }
  }, [open, collectionName, fetchLLMModels])

  // 문서 목록 조회
  const fetchDocuments = async () => {
    setLoadingDocs(true)
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/prompts/documents/${encodeURIComponent(collectionName)}`,
        { credentials: "include" }
      )
      if (response.ok) {
        const data = await response.json()
        const docs = data.documents || []
        setDocuments(docs)
        setSelectedDocIds(docs.map((d: Document) => d.id))
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

  // 문서 선택 토글
  const toggleDocument = (docId: number) => {
    setSelectedDocIds((prev) =>
      prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId]
    )
  }

  // 전체 선택/해제
  const toggleSelectAll = () => {
    if (selectedDocIds.length === documents.length) {
      setSelectedDocIds([])
    } else {
      setSelectedDocIds(documents.map((d) => d.id))
    }
  }

  // 프롬프트 생성
  const generatePrompt = async () => {
    setGenerating(true)
    setGenerationProgress(0)
    setGenerationMessage("생성 준비 중...")
    setGenerationError(null)

    try {
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

      // 상태 폴링
      let completed = false
      while (!completed) {
        await new Promise((resolve) => setTimeout(resolve, 500))

        const statusResponse = await fetch(
          `${API_BASE_URL}/api/prompts/generate/${task_id}`,
          { credentials: "include" }
        )

        if (!statusResponse.ok) throw new Error("상태 조회 실패")

        const status = await statusResponse.json()
        setGenerationProgress(status.progress)
        setGenerationMessage(status.message || "")

        if (status.status === "completed") {
          completed = true
          const result = status.result

          setGeneratedPrompt({
            content: result.prompt_content,
            suggestedQuestions: result.suggested_questions,
          })
          setEditedPrompt(result.prompt_content)
          setEditedQuestions([...result.suggested_questions])
          setResultPanelOpen(true)
          toast.success("프롬프트가 생성되었습니다")
        } else if (status.status === "failed") {
          const errorMsg = status.error || "프롬프트 생성 실패"
          setGenerationError(errorMsg)
          throw new Error(errorMsg)
        }
      }
    } catch (error) {
      console.error("Failed to generate prompt:", error)
      const errorMsg = error instanceof Error ? error.message : "프롬프트 생성에 실패했습니다"
      setGenerationError(errorMsg)
      toast.error(errorMsg)
    } finally {
      setGenerating(false)
    }
  }

  // 저장
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

  // 복사
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(editedPrompt)
      toast.success("클립보드에 복사되었습니다")
    } catch {
      toast.error("복사에 실패했습니다")
    }
  }

  // 원본 복원
  const handleReset = () => {
    if (generatedPrompt) {
      setEditedPrompt(generatedPrompt.content)
      setEditedQuestions([...generatedPrompt.suggestedQuestions])
      toast.info("원본으로 복원되었습니다")
    }
  }

  // 질문 수정
  const updateQuestion = (index: number, value: string) => {
    const updated = [...editedQuestions]
    updated[index] = value
    setEditedQuestions(updated)
  }

  // 질문 삭제
  const removeQuestion = (index: number) => {
    setEditedQuestions(editedQuestions.filter((_, i) => i !== index))
  }

  // 질문 추가
  const addQuestion = () => {
    setEditedQuestions([...editedQuestions, ""])
  }

  const selectedModelOption = modelOptions.find(m => m.key === selectedModel)
  const isModelHealthy = selectedModelOption?.status === "healthy"
  const canGenerate = selectedDocIds.length > 0 && promptFilename.trim() !== "" && isModelHealthy && !generating
  const modelColors = selectedModelOption ? getModelColorClass(selectedModelOption.key) : getModelColorClass("")

  const getStatusColor = () => {
    if (!selectedModelOption) return "bg-gray-400"
    switch (selectedModelOption.status) {
      case "healthy": return "bg-green-500"
      case "degraded": return "bg-amber-500"
      case "unhealthy": return "bg-red-500"
      default: return "bg-gray-400"
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "p-0 gap-0 flex flex-row h-[560px] max-h-[90vh] transition-all duration-300 overflow-hidden",
          resultPanelOpen
            ? "w-[960px] max-w-[95vw]"
            : "w-[480px] max-w-[90vw]"
        )}
        showCloseButton={!resultPanelOpen}
      >
        {/* 좌측: 설정 패널 */}
        <div className="w-[480px] flex-shrink-0 flex flex-col">
          {/* 헤더 - 고정 높이로 우측과 정확히 일치 */}
          <div className="h-14 px-5 border-b flex-shrink-0 flex items-center">
            <DialogHeader className="sr-only">
              <DialogTitle>프롬프트 생성</DialogTitle>
              <DialogDescription>{collectionName} 컬렉션</DialogDescription>
            </DialogHeader>
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-primary/10">
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold">프롬프트 생성</h3>
                  <p className="text-xs text-muted-foreground">
                    <code className="px-1 py-0.5 rounded bg-muted text-[10px]">{collectionName}</code>
                  </p>
                </div>
              </div>
              {/* 모델 Badge (ChatHeader 스타일) - X버튼과 겹치지 않도록 여백 추가 */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge
                      variant="outline"
                      className={cn(
                        "gap-1.5 cursor-help transition-colors py-1 px-2",
                        modelColors.border,
                        modelColors.text,
                        !resultPanelOpen && "mr-8"
                      )}
                    >
                      <span className={cn("w-2 h-2 rounded-full", getStatusColor())} />
                      <span className="text-xs font-medium">
                        {selectedModelOption?.label || "LLM"}
                      </span>
                      {isModelHealthy ? (
                        <Wifi className="w-3 h-3" />
                      ) : (
                        <WifiOff className="w-3 h-3" />
                      )}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    <p>모델: {selectedModelOption?.label || "알 수 없음"}</p>
                    <p>상태: {selectedModelOption?.status === "healthy" ? "정상" : "오류"}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>

          {/* 설정 폼 */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {/* 설정 영역 */}
            <div className="grid grid-cols-2 gap-3">
              {/* 템플릿 */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">템플릿</Label>
                <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue>
                      <div className="flex items-center gap-2">
                        {TEMPLATES.find(t => t.id === selectedTemplate)?.icon}
                        <span>{TEMPLATES.find(t => t.id === selectedTemplate)?.name}</span>
                      </div>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {TEMPLATES.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        <div className="flex items-center gap-2">
                          {template.icon}
                          <span>{template.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 파일명 */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">파일명</Label>
                <div className="flex items-center gap-1">
                  <Input
                    value={promptFilename}
                    onChange={(e) => setPromptFilename(e.target.value)}
                    placeholder="prompt"
                    className="h-9 text-sm flex-1"
                  />
                  <Badge variant="outline" className="h-9 px-2 text-xs">.md</Badge>
                </div>
              </div>

              {/* 문서 선택 (전체 너비) */}
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs text-muted-foreground">문서</Label>
                <Popover open={docPopoverOpen} onOpenChange={setDocPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="h-9 w-full justify-between text-sm font-normal"
                      disabled={loadingDocs}
                    >
                      {loadingDocs ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <span>{selectedDocIds.length}/{documents.length}개 선택</span>
                      )}
                      <ChevronsUpDown className="h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-0" align="start">
                    <Command>
                      <CommandInput placeholder="문서 검색..." className="h-9" />
                      <CommandList className="max-h-[200px]">
                        <CommandEmpty className="py-3 text-sm text-center">문서 없음</CommandEmpty>
                        <CommandGroup>
                          <CommandItem onSelect={toggleSelectAll}>
                            <div className={cn(
                              "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border",
                              selectedDocIds.length === documents.length
                                ? "bg-primary border-primary text-primary-foreground"
                                : "border-muted-foreground"
                            )}>
                              {selectedDocIds.length === documents.length && <Check className="h-3 w-3" />}
                            </div>
                            <span className="font-medium">전체 선택</span>
                          </CommandItem>
                          {documents.map((doc) => (
                            <CommandItem key={doc.id} onSelect={() => toggleDocument(doc.id)}>
                              <div className={cn(
                                "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border",
                                selectedDocIds.includes(doc.id)
                                  ? "bg-primary border-primary text-primary-foreground"
                                  : "border-muted-foreground"
                              )}>
                                {selectedDocIds.includes(doc.id) && <Check className="h-3 w-3" />}
                              </div>
                              <span className="truncate text-sm">{doc.original_filename}</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* 생성 버튼 / 진행 상태 / 에러 */}
            <div className="pt-2">
              {!generating && !generationError && (
                <Button
                  onClick={generatePrompt}
                  disabled={!canGenerate}
                  className="w-full h-10"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  {generatedPrompt ? "다시 생성" : "프롬프트 생성"}
                </Button>
              )}

              {/* 생성 중 - KCA-i 애니메이션 로고 (셀프진단 스타일) */}
              {generating && (
                <div className="flex flex-col items-center py-8 space-y-4">
                  <AnimatedKcaLogo />

                  {/* AI Agent 텍스트 */}
                  <motion.p
                    className="text-sm font-medium text-muted-foreground"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                  >
                    프롬프트 생성 AI Agent
                  </motion.p>

                  {/* 현재 단계 메시지 (애니메이션 전환) */}
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={generationMessage}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.3 }}
                      className="text-sm text-center text-foreground/70"
                    >
                      {generationMessage || "생성 준비 중"}
                      <TypingDots />
                    </motion.p>
                  </AnimatePresence>
                </div>
              )}

              {/* 에러 */}
              {generationError && (
                <div className="flex flex-col items-center py-6 space-y-3">
                  <div className="p-3 rounded-full bg-destructive/10">
                    <AlertCircle className="h-6 w-6 text-destructive" />
                  </div>
                  <p className="text-sm text-destructive text-center">{generationError}</p>
                  <Button variant="outline" size="sm" onClick={() => {
                    setGenerationError(null)
                    generatePrompt()
                  }}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    다시 시도
                  </Button>
                </div>
              )}
            </div>

            {/* 생성 완료 시 결과 보기 버튼 */}
            {generatedPrompt && !generating && !resultPanelOpen && (
              <Button
                variant="outline"
                onClick={() => setResultPanelOpen(true)}
                className="w-full"
              >
                <FileText className="h-4 w-4 mr-2" />
                결과 보기
              </Button>
            )}
          </div>

          {/* 좌측 푸터 */}
          <div className="flex items-center justify-end gap-2 px-5 py-3 border-t bg-muted/30 flex-shrink-0">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>
              닫기
            </Button>
          </div>
        </div>

        {/* 우측: 결과 패널 (슬라이드 확장) */}
        {resultPanelOpen && generatedPrompt && (
          <div className="w-[480px] flex-shrink-0 border-l flex flex-col bg-background">
            {/* 결과 패널 헤더 - 좌측과 동일한 고정 높이 */}
            <div className="h-14 px-5 border-b flex-shrink-0 flex items-center">
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center border rounded-lg overflow-hidden">
                  <button
                    onClick={() => setResultTab("prompt")}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 text-xs transition-colors",
                      resultTab === "prompt"
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted"
                    )}
                  >
                    <FileText className="h-3.5 w-3.5" />
                    프롬프트
                  </button>
                  <button
                    onClick={() => setResultTab("questions")}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 text-xs transition-colors",
                      resultTab === "questions"
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted"
                    )}
                  >
                    <HelpCircle className="h-3.5 w-3.5" />
                    질문
                    <span className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded-full ml-0.5",
                      resultTab === "questions"
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-muted-foreground/20 text-muted-foreground"
                    )}>
                      {editedQuestions.length}
                    </span>
                  </button>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setResultPanelOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* 결과 콘텐츠 - 좌측과 동일한 패딩 */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {resultTab === "prompt" ? (
                <div className="flex flex-col h-full">
                  {/* 텍스트 에디터 컨테이너 (오버레이 버튼 포함) */}
                  <div className="relative flex-1">
                    {/* 우측 상단 오버레이 버튼 */}
                    <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
                      {editedPrompt !== generatedPrompt.content && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={handleReset}
                          className="h-7 px-2 text-xs bg-background/80 backdrop-blur-sm shadow-sm"
                        >
                          <RotateCcw className="h-3 w-3 mr-1" />
                          복원
                        </Button>
                      )}
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleCopy}
                        className="h-7 px-2 text-xs bg-background/80 backdrop-blur-sm shadow-sm"
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        복사
                      </Button>
                    </div>
                    <Textarea
                      value={editedPrompt}
                      onChange={(e) => setEditedPrompt(e.target.value)}
                      placeholder="프롬프트 내용..."
                      className="h-full min-h-[340px] resize-none font-mono text-sm pt-10"
                    />
                  </div>
                  <div className="flex justify-end text-[10px] text-muted-foreground pt-2">
                    {editedPrompt.length.toLocaleString()}자 · {editedPrompt.split("\n").length}줄
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {editedQuestions.map((q, i) => (
                    <div key={i} className="flex gap-2">
                      <Input
                        value={q}
                        onChange={(e) => updateQuestion(i, e.target.value)}
                        placeholder={`질문 ${i + 1}`}
                        className="flex-1 h-9 text-sm"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-muted-foreground hover:text-destructive"
                        onClick={() => removeQuestion(i)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={addQuestion} className="w-full h-8 text-xs">
                    <Plus className="h-3 w-3 mr-1" />
                    질문 추가
                  </Button>
                </div>
              )}
            </div>

            {/* 결과 패널 푸터 - 좌측과 동일한 패딩 */}
            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t bg-muted/30 flex-shrink-0">
              <Button size="sm" onClick={savePrompt} disabled={saving || !editedPrompt.trim()}>
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-1" />
                    저장
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
