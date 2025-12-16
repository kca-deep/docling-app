"use client"

import { useState, useEffect } from "react"
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
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertTriangle,
  Globe,
  Lock,
  Users,
  Database,
  Settings,
  Loader2,
  Star,
  X,
  Landmark,
  Briefcase,
  Calendar,
  Wallet,
  Gift,
  Scale,
  Shield,
  CreditCard,
  Search,
  FileText,
  Award,
  FlaskConical,
  Building,
  LucideIcon,
  RefreshCw,
  Trash2,
} from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { API_BASE_URL } from "@/lib/api-config"
import { cn } from "@/lib/utils"

// 아이콘 옵션 정의
const ICON_OPTIONS: { value: string; label: string; icon: LucideIcon }[] = [
  { value: "Database", label: "데이터베이스", icon: Database },
  { value: "Landmark", label: "기관/법률", icon: Landmark },
  { value: "Briefcase", label: "업무/복무", icon: Briefcase },
  { value: "Users", label: "인사/조직", icon: Users },
  { value: "Calendar", label: "일정/휴가", icon: Calendar },
  { value: "Wallet", label: "급여/수당", icon: Wallet },
  { value: "Gift", label: "복지/혜택", icon: Gift },
  { value: "Scale", label: "규정/정책", icon: Scale },
  { value: "Shield", label: "보안/안전", icon: Shield },
  { value: "CreditCard", label: "재무/회계", icon: CreditCard },
  { value: "Search", label: "검색/조회", icon: Search },
  { value: "FileText", label: "문서/서식", icon: FileText },
  { value: "Award", label: "평가/성과", icon: Award },
  { value: "FlaskConical", label: "연구/실험", icon: FlaskConical },
  { value: "Building", label: "시설/자산", icon: Building },
]

// 메타데이터 타입
interface CollectionMetadata {
  koreanName?: string
  icon?: string
  keywords?: string[]
  priority?: number
  plainDescription?: string
}

// description JSON 파싱 함수
function parseMetadata(description?: string): CollectionMetadata {
  if (!description) return {}
  try {
    const parsed = JSON.parse(description)
    if (typeof parsed === 'object' && parsed !== null) {
      return {
        koreanName: parsed.koreanName,
        icon: parsed.icon,
        keywords: Array.isArray(parsed.keywords) ? parsed.keywords : undefined,
        priority: typeof parsed.priority === 'number' ? parsed.priority : undefined,
        plainDescription: parsed.plainDescription,
      }
    }
  } catch {
    return { plainDescription: description }
  }
  return {}
}

interface Collection {
  name: string
  documents_count: number
  points_count: number
  vector_size: number
  distance: string
  visibility?: "public" | "private" | "shared"
  description?: string
  owner_id?: number
  is_owner?: boolean
  created_at?: string
}

// 컬렉션 내 문서 정보 (API 응답)
interface CollectionDocumentInfo {
  document_id: number | null
  filename: string
  chunk_count: number
  source_type: "document" | "excel"
  source_file?: string
}

interface CollectionSettingsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  collection: Collection | null
  onSuccess: () => void
  onDelete?: () => void
}

type Visibility = "public" | "private" | "shared"

export function CollectionSettingsModal({
  open,
  onOpenChange,
  collection,
  onSuccess,
  onDelete,
}: CollectionSettingsModalProps) {
  const [activeTab, setActiveTab] = useState("general")
  const [koreanName, setKoreanName] = useState("")
  const [selectedIcon, setSelectedIcon] = useState("Database")
  const [keywords, setKeywords] = useState<string[]>([])
  const [keywordInput, setKeywordInput] = useState("")
  const [isPriority, setIsPriority] = useState(false)
  const [plainDescription, setPlainDescription] = useState("")
  const [visibility, setVisibility] = useState<Visibility>("public")
  const [saving, setSaving] = useState(false)

  // 문서 관리 탭 상태
  const [documents, setDocuments] = useState<CollectionDocumentInfo[]>([])
  const [loadingDocs, setLoadingDocs] = useState(false)
  const [selectedDocs, setSelectedDocs] = useState<CollectionDocumentInfo[]>([])
  const [deleting, setDeleting] = useState(false)

  // collection이 변경되면 폼 초기화
  useEffect(() => {
    if (collection) {
      const metadata = parseMetadata(collection.description)
      setKoreanName(metadata.koreanName || "")
      setSelectedIcon(metadata.icon || "Database")
      setKeywords(metadata.keywords || [])
      setIsPriority(metadata.priority === 1)
      setPlainDescription(metadata.plainDescription || "")
      setVisibility(collection.visibility || "public")
      setKeywordInput("")
    }
  }, [collection])

  // 키워드 추가
  const addKeyword = () => {
    const trimmed = keywordInput.trim()
    if (trimmed && !keywords.includes(trimmed)) {
      setKeywords([...keywords, trimmed])
      setKeywordInput("")
    }
  }

  // 키워드 삭제
  const removeKeyword = (keyword: string) => {
    setKeywords(keywords.filter(k => k !== keyword))
  }

  // 키워드 입력 시 Enter 또는 콤마로 추가
  const handleKeywordKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault()
      addKeyword()
    }
  }

  // description JSON 생성
  const buildDescriptionJson = (): string | null => {
    const metadata: Record<string, unknown> = {}

    if (koreanName.trim()) {
      metadata.koreanName = koreanName.trim()
    }
    if (selectedIcon && selectedIcon !== "Database") {
      metadata.icon = selectedIcon
    }
    if (keywords.length > 0) {
      metadata.keywords = keywords
    }
    if (isPriority) {
      metadata.priority = 1
    }
    if (plainDescription.trim()) {
      metadata.plainDescription = plainDescription.trim()
    }

    // 메타데이터가 없으면 null 반환
    if (Object.keys(metadata).length === 0) {
      return null
    }

    return JSON.stringify(metadata)
  }

  // 문서 목록 조회
  const fetchDocuments = async () => {
    if (!collection) return
    setLoadingDocs(true)
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/qdrant/collections/${encodeURIComponent(collection.name)}/documents`,
        { credentials: 'include' }
      )
      if (response.ok) {
        const data = await response.json()
        setDocuments(data.documents || [])
        setSelectedDocs([])
      } else {
        const error = await response.json()
        toast.error(error.detail || "문서 목록을 불러오는데 실패했습니다")
      }
    } catch (error) {
      console.error("Failed to fetch documents:", error)
      toast.error("문서 목록을 불러오는데 실패했습니다")
    } finally {
      setLoadingDocs(false)
    }
  }

  // 탭 변경 시 문서 목록 로드
  useEffect(() => {
    if (activeTab === "documents" && collection) {
      fetchDocuments()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, collection?.name])

  // 문서 선택 토글
  const toggleSelectDoc = (doc: CollectionDocumentInfo) => {
    setSelectedDocs((prev) => {
      const isSelected = prev.some(
        (d) => d.document_id === doc.document_id && d.filename === doc.filename
      )
      if (isSelected) {
        return prev.filter(
          (d) => !(d.document_id === doc.document_id && d.filename === doc.filename)
        )
      } else {
        return [...prev, doc]
      }
    })
  }

  // 전체 선택/해제
  const toggleSelectAll = () => {
    if (selectedDocs.length === documents.length) {
      setSelectedDocs([])
    } else {
      setSelectedDocs([...documents])
    }
  }

  // 문서가 선택되었는지 확인
  const isDocSelected = (doc: CollectionDocumentInfo) => {
    return selectedDocs.some(
      (d) => d.document_id === doc.document_id && d.filename === doc.filename
    )
  }

  // 선택된 문서 삭제
  const handleDeleteSelected = async () => {
    if (selectedDocs.length === 0 || !collection) return

    const confirmed = window.confirm(
      `${selectedDocs.length}개 문서를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`
    )
    if (!confirmed) return

    setDeleting(true)
    try {
      const documentIds = selectedDocs
        .filter((d) => d.source_type === "document" && d.document_id !== null)
        .map((d) => d.document_id as number)
      const sourceFiles = selectedDocs
        .filter((d) => d.source_type === "excel")
        .map((d) => d.source_file || d.filename)

      const response = await fetch(
        `${API_BASE_URL}/api/qdrant/collections/${encodeURIComponent(collection.name)}/documents`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          credentials: 'include',
          body: JSON.stringify({
            document_ids: documentIds.length > 0 ? documentIds : undefined,
            source_files: sourceFiles.length > 0 ? sourceFiles : undefined
          })
        }
      )

      if (response.ok) {
        const result = await response.json()
        toast.success(result.message)
        setSelectedDocs([])
        fetchDocuments()
        onSuccess()
      } else {
        const error = await response.json()
        toast.error(error.detail || "삭제에 실패했습니다")
      }
    } catch (error) {
      console.error("Failed to delete documents:", error)
      toast.error("삭제 중 오류가 발생했습니다")
    } finally {
      setDeleting(false)
    }
  }

  // 단일 문서 삭제
  const handleDeleteSingle = async (doc: CollectionDocumentInfo) => {
    if (!collection) return

    const confirmed = window.confirm(
      `"${doc.filename}" 문서를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`
    )
    if (!confirmed) return

    setDeleting(true)
    try {
      const body: { document_ids?: number[]; source_files?: string[] } = {}

      if (doc.source_type === "document" && doc.document_id !== null) {
        body.document_ids = [doc.document_id]
      } else {
        body.source_files = [doc.source_file || doc.filename]
      }

      const response = await fetch(
        `${API_BASE_URL}/api/qdrant/collections/${encodeURIComponent(collection.name)}/documents`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          credentials: 'include',
          body: JSON.stringify(body)
        }
      )

      if (response.ok) {
        const result = await response.json()
        toast.success(result.message)
        fetchDocuments()
        onSuccess()
      } else {
        const error = await response.json()
        toast.error(error.detail || "삭제에 실패했습니다")
      }
    } catch (error) {
      console.error("Failed to delete document:", error)
      toast.error("삭제 중 오류가 발생했습니다")
    } finally {
      setDeleting(false)
    }
  }

  // 설정 저장
  const handleSave = async () => {
    if (!collection) return

    setSaving(true)
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/qdrant/collections/${encodeURIComponent(collection.name)}/settings`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: 'include',
          body: JSON.stringify({
            visibility,
            description: buildDescriptionJson(),
          }),
        }
      )

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || "설정 저장에 실패했습니다")
      }

      toast.success("설정이 저장되었습니다")
      onOpenChange(false)
      onSuccess()
    } catch (error) {
      console.error("Failed to save settings:", error)
      toast.error(error instanceof Error ? error.message : "설정 저장에 실패했습니다")
    } finally {
      setSaving(false)
    }
  }

  if (!collection) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="pb-4 border-b">
          {(() => {
            const metadata = parseMetadata(collection.description)
            const IconComp = ICON_OPTIONS.find(o => o.value === (metadata.icon || "Database"))?.icon || Database
            const displayName = metadata.koreanName || collection.name
            return (
              <div className="flex items-start gap-3">
                <div className="p-3 rounded-xl bg-[color:var(--chart-1)]/10 text-[color:var(--chart-1)] flex-shrink-0">
                  <IconComp className="h-6 w-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <DialogTitle className="text-lg font-bold truncate">
                      {displayName}
                    </DialogTitle>
                    {metadata.priority === 1 && (
                      <Badge className="bg-amber-500/90 text-white text-[10px] px-1.5 py-0 h-5 gap-0.5 flex-shrink-0">
                        <Star className="h-3 w-3 fill-current" />
                        추천
                      </Badge>
                    )}
                  </div>
                  <DialogDescription className="mt-1 flex items-center gap-2 text-sm">
                    <span className="font-mono text-xs">{collection.name}</span>
                    <span className="text-muted-foreground/50">·</span>
                    <span>{collection.documents_count}문서</span>
                    <span className="text-muted-foreground/50">·</span>
                    <span>{collection.points_count.toLocaleString()}청크</span>
                  </DialogDescription>
                </div>
              </div>
            )
          })()}
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex-1 flex flex-col min-h-0">
          <TabsList className="w-full grid grid-cols-4 h-auto flex-shrink-0">
            <TabsTrigger value="general" className="flex items-center justify-center gap-1.5 py-2 text-xs sm:text-sm">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">일반</span>
            </TabsTrigger>
            <TabsTrigger value="visibility" className="flex items-center justify-center gap-1.5 py-2 text-xs sm:text-sm">
              <Globe className="h-4 w-4" />
              <span className="hidden sm:inline">공개</span>
            </TabsTrigger>
            <TabsTrigger value="documents" className="flex items-center justify-center gap-1.5 py-2 text-xs sm:text-sm">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">문서</span>
            </TabsTrigger>
            <TabsTrigger value="danger" className="flex items-center justify-center gap-1.5 py-2 text-xs sm:text-sm text-destructive data-[state=active]:text-destructive">
              <AlertTriangle className="h-4 w-4" />
              <span className="hidden sm:inline">위험</span>
            </TabsTrigger>
          </TabsList>

          {/* 일반 탭 */}
          <TabsContent value="general" className="flex-1 overflow-y-auto space-y-3 pt-4 pr-3 -mr-1">
            {/* 표시 설정 섹션 */}
            <div className="rounded-lg border bg-card p-4 space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Settings className="h-4 w-4" />
                표시 설정
              </div>

              {/* 한글명 */}
              <div className="space-y-2">
                <Label htmlFor="settings-koreanName" className="text-sm">표시명 (한글)</Label>
                <Input
                  id="settings-koreanName"
                  placeholder="예: 복무·복지"
                  value={koreanName}
                  onChange={(e) => setKoreanName(e.target.value)}
                  className="h-9"
                />
              </div>

              {/* 아이콘 선택 */}
              <div className="space-y-2">
                <Label className="text-sm">아이콘</Label>
                <div className="grid grid-cols-5 gap-1.5 p-2 rounded-lg border bg-muted/10">
                  {ICON_OPTIONS.map((option) => {
                    const IconComp = option.icon
                    const isSelected = selectedIcon === option.value
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setSelectedIcon(option.value)}
                        className={cn(
                          "p-2 rounded-md transition-all flex flex-col items-center gap-0.5",
                          "hover:bg-muted focus:outline-none",
                          isSelected
                            ? "bg-[color:var(--chart-1)]/10 text-[color:var(--chart-1)] ring-1 ring-[color:var(--chart-1)]/30"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                        title={option.label}
                      >
                        <IconComp className="h-4 w-4" />
                        <span className="text-[8px] truncate w-full text-center leading-tight">
                          {option.label.split('/')[0]}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* 검색 설정 섹션 */}
            <div className="rounded-lg border bg-card p-4 space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Search className="h-4 w-4" />
                검색 설정
              </div>

              {/* 키워드 */}
              <div className="space-y-2">
                <Label htmlFor="settings-keywords" className="text-sm">키워드</Label>
                <div className="flex gap-2">
                  <Input
                    id="settings-keywords"
                    placeholder="키워드 입력 후 Enter"
                    value={keywordInput}
                    onChange={(e) => setKeywordInput(e.target.value)}
                    onKeyDown={handleKeywordKeyDown}
                    className="h-9"
                  />
                  <Button type="button" variant="outline" size="sm" onClick={addKeyword} className="h-9 px-3">
                    추가
                  </Button>
                </div>
                {keywords.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {keywords.map((keyword) => (
                      <Badge key={keyword} variant="secondary" className="gap-1 pr-1 text-xs">
                        {keyword}
                        <button
                          type="button"
                          onClick={() => removeKeyword(keyword)}
                          className="ml-0.5 hover:bg-muted rounded-full p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* 설명 */}
              <div className="space-y-2">
                <Label htmlFor="settings-plainDescription" className="text-sm">설명</Label>
                <Textarea
                  id="settings-plainDescription"
                  placeholder="컬렉션에 대한 간단한 설명"
                  value={plainDescription}
                  onChange={(e) => setPlainDescription(e.target.value)}
                  rows={2}
                  className="resize-none text-sm"
                />
              </div>
            </div>

            {/* 추천 설정 섹션 */}
            <div
              className={cn(
                "rounded-lg border p-4 cursor-pointer transition-all",
                isPriority
                  ? "bg-amber-500/5 border-amber-500/30"
                  : "bg-card hover:border-muted-foreground/30"
              )}
              onClick={() => setIsPriority(!isPriority)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "p-2 rounded-lg",
                    isPriority ? "bg-amber-500/20 text-amber-600" : "bg-muted text-muted-foreground"
                  )}>
                    <Star className={cn("h-4 w-4", isPriority && "fill-current")} />
                  </div>
                  <div>
                    <div className="font-medium text-sm">추천 컬렉션</div>
                    <div className="text-xs text-muted-foreground">메인 화면에 우선 표시됩니다</div>
                  </div>
                </div>
                <div className={cn(
                  "w-10 h-6 rounded-full transition-colors relative",
                  isPriority ? "bg-amber-500" : "bg-muted"
                )}>
                  <div className={cn(
                    "absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all",
                    isPriority ? "left-5" : "left-1"
                  )} />
                </div>
              </div>
            </div>

            {/* 기술 정보 (축소) */}
            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>벡터 차원: {collection.vector_size}</span>
                <span>거리 함수: {collection.distance}</span>
              </div>
            </div>
          </TabsContent>

          {/* 공개 설정 탭 */}
          <TabsContent value="visibility" className="flex-1 overflow-y-auto space-y-3 pt-4 pr-3 -mr-1">
            <div className="space-y-3">
              {/* 비공개 */}
              <div
                className={cn(
                  "rounded-lg border p-4 cursor-pointer transition-all",
                  visibility === "private"
                    ? "border-orange-500/50 bg-orange-500/5 ring-1 ring-orange-500/20"
                    : "bg-card hover:border-muted-foreground/30"
                )}
                onClick={() => setVisibility("private")}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "p-2.5 rounded-lg",
                    visibility === "private"
                      ? "bg-orange-500/20 text-orange-600"
                      : "bg-muted text-muted-foreground"
                  )}>
                    <Lock className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">비공개</div>
                    <div className="text-xs text-muted-foreground">본인만 접근 가능</div>
                  </div>
                  <div className={cn(
                    "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
                    visibility === "private"
                      ? "border-orange-500 bg-orange-500"
                      : "border-muted-foreground/30"
                  )}>
                    {visibility === "private" && (
                      <div className="w-2 h-2 rounded-full bg-white" />
                    )}
                  </div>
                </div>
              </div>

              {/* 공개 */}
              <div
                className={cn(
                  "rounded-lg border p-4 cursor-pointer transition-all",
                  visibility === "public"
                    ? "border-green-500/50 bg-green-500/5 ring-1 ring-green-500/20"
                    : "bg-card hover:border-muted-foreground/30"
                )}
                onClick={() => setVisibility("public")}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "p-2.5 rounded-lg",
                    visibility === "public"
                      ? "bg-green-500/20 text-green-600"
                      : "bg-muted text-muted-foreground"
                  )}>
                    <Globe className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">공개</div>
                    <div className="text-xs text-muted-foreground">모든 사용자가 검색 가능</div>
                  </div>
                  <div className={cn(
                    "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
                    visibility === "public"
                      ? "border-green-500 bg-green-500"
                      : "border-muted-foreground/30"
                  )}>
                    {visibility === "public" && (
                      <div className="w-2 h-2 rounded-full bg-white" />
                    )}
                  </div>
                </div>
              </div>

              {/* 공유 */}
              <div
                className={cn(
                  "rounded-lg border p-4 cursor-pointer transition-all",
                  visibility === "shared"
                    ? "border-blue-500/50 bg-blue-500/5 ring-1 ring-blue-500/20"
                    : "bg-card hover:border-muted-foreground/30"
                )}
                onClick={() => setVisibility("shared")}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "p-2.5 rounded-lg",
                    visibility === "shared"
                      ? "bg-blue-500/20 text-blue-600"
                      : "bg-muted text-muted-foreground"
                  )}>
                    <Users className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">공유</div>
                    <div className="text-xs text-muted-foreground">선택한 사용자만 접근</div>
                  </div>
                  <div className={cn(
                    "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
                    visibility === "shared"
                      ? "border-blue-500 bg-blue-500"
                      : "border-muted-foreground/30"
                  )}>
                    {visibility === "shared" && (
                      <div className="w-2 h-2 rounded-full bg-white" />
                    )}
                  </div>
                </div>
              </div>

              {/* 공유 사용자 선택 (shared일 때만) */}
              {visibility === "shared" && (
                <div className="rounded-lg border border-dashed bg-muted/20 p-4 mt-2">
                  <div className="text-center">
                    <Users className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground">사용자 선택 기능은 준비 중입니다</p>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* 문서 관리 탭 */}
          <TabsContent value="documents" className="flex-1 overflow-y-auto space-y-4 pt-4 pr-3 -mr-1">
            <div className="space-y-4">
              {/* 헤더 */}
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">업로드된 문서</h4>
                  <p className="text-sm text-muted-foreground">
                    컬렉션에 업로드된 문서를 관리합니다
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchDocuments}
                  disabled={loadingDocs || deleting}
                >
                  <RefreshCw className={cn("h-4 w-4 mr-2", loadingDocs && "animate-spin")} />
                  새로고침
                </Button>
              </div>

              {/* 문서 목록 */}
              {loadingDocs ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : documents.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>업로드된 문서가 없습니다</p>
                </div>
              ) : (
                <>
                  {/* 선택 삭제 버튼 */}
                  {selectedDocs.length > 0 && (
                    <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                      <span className="text-sm">{selectedDocs.length}개 선택됨</span>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleDeleteSelected}
                        disabled={deleting}
                      >
                        {deleting ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                            삭제 중...
                          </>
                        ) : (
                          "선택 삭제"
                        )}
                      </Button>
                    </div>
                  )}

                  {/* 문서 테이블 */}
                  <div className="border rounded-lg max-h-[40vh] overflow-y-auto">
                    <Table>
                      <TableHeader className="sticky top-0 bg-background z-10">
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="w-10">
                            <Checkbox
                              checked={documents.length > 0 && selectedDocs.length === documents.length}
                              onCheckedChange={toggleSelectAll}
                              disabled={deleting}
                            />
                          </TableHead>
                          <TableHead>파일명</TableHead>
                          <TableHead className="w-24 text-right">청크 수</TableHead>
                          <TableHead className="w-20 text-center">유형</TableHead>
                          <TableHead className="w-16"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {documents.map((doc, index) => (
                          <TableRow key={`${doc.document_id || doc.filename}-${index}`}>
                            <TableCell>
                              <Checkbox
                                checked={isDocSelected(doc)}
                                onCheckedChange={() => toggleSelectDoc(doc)}
                                disabled={deleting}
                              />
                            </TableCell>
                            <TableCell className="font-medium">
                              <span className="truncate block max-w-[120px] sm:max-w-[180px]" title={doc.filename}>
                                {doc.filename}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              {doc.chunk_count.toLocaleString()}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="secondary" className="text-xs">
                                {doc.source_type === "excel" ? "Excel" : "문서"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => handleDeleteSingle(doc)}
                                disabled={deleting}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* 합계 표시 */}
                  <div className="text-sm text-muted-foreground text-right">
                    총 {documents.length}개 문서, {documents.reduce((sum, d) => sum + d.chunk_count, 0).toLocaleString()}개 청크
                  </div>
                </>
              )}
            </div>
          </TabsContent>

          {/* 위험 영역 탭 */}
          <TabsContent value="danger" className="flex-1 overflow-y-auto space-y-4 pt-4 pr-3 -mr-1">
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 overflow-hidden">
              {/* 경고 헤더 */}
              <div className="bg-destructive/10 px-4 py-3 border-b border-destructive/20">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  <h4 className="font-semibold text-destructive">위험 영역</h4>
                </div>
              </div>

              {/* 삭제 정보 */}
              <div className="p-4 space-y-4">
                <div className="space-y-2">
                  <p className="text-sm font-medium">이 작업은 되돌릴 수 없습니다!</p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-destructive/60" />
                      모든 벡터 데이터가 영구 삭제됩니다
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-destructive/60" />
                      {collection.documents_count}개 문서, {collection.points_count.toLocaleString()}개 청크 삭제
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-destructive/60" />
                      관련 프롬프트 설정도 삭제됩니다
                    </li>
                  </ul>
                </div>

                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={() => {
                    onOpenChange(false)
                    onDelete?.()
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  컬렉션 삭제
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex-shrink-0 border-t pt-4 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            취소
          </Button>
          <Button onClick={handleSave} disabled={saving} className="min-w-[80px]">
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "저장"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
