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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
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
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Globe,
  Lock,
  Users,
  Database,
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
  Plus,
  Check,
  ChevronsUpDown,
  Trash2,
  FileSpreadsheet,
  Upload,
  Table,
  FolderCog,
  AlertTriangle,
  Sparkles,
  LucideIcon,
} from "lucide-react"
import { toast } from "sonner"
import { API_BASE_URL } from "@/lib/api-config"
import { cn } from "@/lib/utils"

// 통합 아이콘 옵션 (15개)
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

// 메타데이터 파싱
interface CollectionMetadata {
  koreanName?: string
  icon?: string
  keywords?: string[]
  priority?: number
}

function parseMetadata(description?: string): CollectionMetadata {
  if (!description) return {}
  try {
    const parsed = JSON.parse(description)
    if (typeof parsed === "object" && parsed !== null) {
      return {
        koreanName: parsed.koreanName,
        icon: parsed.icon,
        keywords: Array.isArray(parsed.keywords) ? parsed.keywords : undefined,
        priority: typeof parsed.priority === "number" ? parsed.priority : undefined,
      }
    }
  } catch {
    return {}
  }
  return {}
}

// 컬렉션 타입
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
  allowed_users?: number[]
}

interface ShareableUser {
  id: number
  username: string
  name: string | null
  team_name: string | null
}

interface CollectionDocument {
  document_id: number | null
  filename: string
  chunk_count: number
  source_type: "document" | "excel"
}

type Visibility = "public" | "private" | "shared"

// Props 타입
interface CollectionModalProps {
  mode: "create" | "edit"
  collection?: Collection | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  onDelete?: () => void
}

export function CollectionModal({
  mode,
  collection,
  open,
  onOpenChange,
  onSuccess,
  onDelete,
}: CollectionModalProps) {
  // 공통 상태
  const [name, setName] = useState("")
  const [koreanName, setKoreanName] = useState("")
  const [selectedIcon, setSelectedIcon] = useState("Database")
  const [keywords, setKeywords] = useState<string[]>([])
  const [keywordInput, setKeywordInput] = useState("")
  const [keywordPopoverOpen, setKeywordPopoverOpen] = useState(false)
  const [isPriority, setIsPriority] = useState(false)
  const [visibility, setVisibility] = useState<Visibility>("public")
  const [saving, setSaving] = useState(false)

  // create 전용 (기본값 사용)
  const vectorSize = "1024"
  const distance = "Cosine"

  // edit 전용
  const [allowedUsers, setAllowedUsers] = useState<number[]>([])
  const [availableUsers, setAvailableUsers] = useState<ShareableUser[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [userPopoverOpen, setUserPopoverOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  // 문서 패널 (edit 전용)
  const [docsPanelOpen, setDocsPanelOpen] = useState(false)
  const [collectionDocs, setCollectionDocs] = useState<CollectionDocument[]>([])
  const [loadingDocs, setLoadingDocs] = useState(false)
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set())
  const [deletingDocs, setDeletingDocs] = useState(false)
  const [docDeleteDialogOpen, setDocDeleteDialogOpen] = useState(false)

  // 폼 초기화
  const resetForm = useCallback(() => {
    setName("")
    setKoreanName("")
    setSelectedIcon("Database")
    setKeywords([])
    setKeywordInput("")
    setIsPriority(false)
    setVisibility("public")
    setAllowedUsers([])
    setDocsPanelOpen(false)
    setSelectedDocs(new Set())
  }, [])

  // 모달 열릴 때 초기화
  useEffect(() => {
    if (open) {
      if (mode === "edit" && collection) {
        const metadata = parseMetadata(collection.description)
        setName(collection.name)
        setKoreanName(metadata.koreanName || "")
        setSelectedIcon(metadata.icon || "Database")
        setKeywords(metadata.keywords || [])
        setIsPriority(metadata.priority === 1)
        setVisibility(collection.visibility || "public")
        setAllowedUsers(collection.allowed_users || [])
      } else {
        resetForm()
      }
    }
  }, [open, mode, collection, resetForm])

  // 모달 닫힐 때
  useEffect(() => {
    if (!open) {
      setDocsPanelOpen(false)
      setDeleteDialogOpen(false)
    }
  }, [open])

  // 키워드 관리
  const addKeyword = () => {
    const trimmed = keywordInput.trim()
    if (trimmed && !keywords.includes(trimmed)) {
      setKeywords([...keywords, trimmed])
      setKeywordInput("")
    }
  }

  const removeKeyword = (keyword: string) => {
    setKeywords(keywords.filter((k) => k !== keyword))
  }

  const handleKeywordKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      addKeyword()
    }
  }

  // description JSON 빌드
  const buildDescriptionJson = (): string | null => {
    const metadata: Record<string, unknown> = {}
    if (koreanName.trim()) metadata.koreanName = koreanName.trim()
    if (selectedIcon && selectedIcon !== "Database") metadata.icon = selectedIcon
    if (keywords.length > 0) metadata.keywords = keywords
    if (isPriority) metadata.priority = 1
    if (Object.keys(metadata).length === 0) return null
    return JSON.stringify(metadata)
  }

  // 공유 사용자 조회
  const fetchShareableUsers = async () => {
    setLoadingUsers(true)
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/users/shareable`, {
        credentials: "include",
      })
      if (response.ok) {
        const data = await response.json()
        setAvailableUsers(data)
      }
    } catch (error) {
      console.error("Failed to fetch shareable users:", error)
    } finally {
      setLoadingUsers(false)
    }
  }

  useEffect(() => {
    if (visibility === "shared" && availableUsers.length === 0) {
      fetchShareableUsers()
    }
  }, [visibility, availableUsers.length])

  const toggleUserSelection = (userId: number) => {
    setAllowedUsers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    )
  }

  // 문서 관리 (edit 전용)
  const fetchCollectionDocuments = async () => {
    if (!collection) return
    setLoadingDocs(true)
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/qdrant/collections/${encodeURIComponent(collection.name)}/documents`,
        { credentials: "include" }
      )
      if (response.ok) {
        const data = await response.json()
        setCollectionDocs(data.documents || [])
      }
    } catch (error) {
      console.error("Failed to fetch collection documents:", error)
    } finally {
      setLoadingDocs(false)
    }
  }

  const openDocsPanel = () => {
    setDocsPanelOpen(true)
    setSelectedDocs(new Set())
    fetchCollectionDocuments()
  }

  const toggleDocSelection = (docKey: string) => {
    setSelectedDocs((prev) => {
      const next = new Set(prev)
      if (next.has(docKey)) next.delete(docKey)
      else next.add(docKey)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedDocs.size === collectionDocs.length) {
      setSelectedDocs(new Set())
    } else {
      const allKeys = collectionDocs.map((doc) =>
        doc.source_type === "document" ? `doc:${doc.document_id}` : `excel:${doc.filename}`
      )
      setSelectedDocs(new Set(allKeys))
    }
  }

  // 선택된 문서들의 총 청크 개수 계산
  const selectedDocsChunkCount = collectionDocs
    .filter((doc) => {
      const key = doc.source_type === "document" ? `doc:${doc.document_id}` : `excel:${doc.filename}`
      return selectedDocs.has(key)
    })
    .reduce((sum, doc) => sum + doc.chunk_count, 0)

  const deleteSelectedDocuments = async () => {
    if (!collection || selectedDocs.size === 0) return

    setDocDeleteDialogOpen(false)
    setDeletingDocs(true)
    try {
      const documentIds: number[] = []
      const filenames: string[] = []

      selectedDocs.forEach((key) => {
        if (key.startsWith("doc:")) {
          const id = parseInt(key.replace("doc:", ""), 10)
          if (!isNaN(id)) documentIds.push(id)
        } else if (key.startsWith("excel:")) {
          filenames.push(key.replace("excel:", ""))
        }
      })

      const response = await fetch(
        `${API_BASE_URL}/api/qdrant/collections/${encodeURIComponent(collection.name)}/documents`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            document_ids: documentIds.length > 0 ? documentIds : undefined,
            filenames: filenames.length > 0 ? filenames : undefined,
          }),
        }
      )

      if (response.ok) {
        const result = await response.json()
        const docCount = selectedDocs.size  // 문서 수 (프론트엔드)
        const chunkCount = result.deleted_count || selectedDocsChunkCount  // 청크 수 (백엔드)
        toast.success(`${docCount}개 문서 (${chunkCount.toLocaleString()}개 청크)가 삭제되었습니다`)
        setSelectedDocs(new Set())
        fetchCollectionDocuments()
        onSuccess()
      } else {
        const error = await response.json()
        toast.error(error.detail || "문서 삭제에 실패했습니다")
      }
    } catch (error) {
      console.error("Failed to delete documents:", error)
      toast.error("문서 삭제 중 오류가 발생했습니다")
    } finally {
      setDeletingDocs(false)
    }
  }

  // 생성 처리
  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("컬렉션 이름을 입력해주세요")
      return
    }

    const nameRegex = /^[a-zA-Z0-9가-힣\s._-]+$/
    if (!nameRegex.test(name)) {
      toast.error("컬렉션 이름에 사용할 수 없는 문자가 포함되어 있습니다")
      return
    }

    setSaving(true)
    try {
      const response = await fetch(`${API_BASE_URL}/api/qdrant/collections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          collection_name: name.trim(),
          vector_size: parseInt(vectorSize),
          distance: distance,
          visibility: visibility,
          description: buildDescriptionJson(),
        }),
      })

      if (response.ok) {
        toast.success(`'${name}' 컬렉션이 생성되었습니다`)
        resetForm()
        onOpenChange(false)
        onSuccess()
      } else {
        const error = await response.json()
        toast.error(error.detail || "컬렉션 생성에 실패했습니다")
      }
    } catch (error) {
      console.error("Failed to create collection:", error)
      toast.error("컬렉션 생성에 실패했습니다")
    } finally {
      setSaving(false)
    }
  }

  // 저장 처리 (edit)
  const handleSave = async () => {
    if (!collection) return
    setSaving(true)
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/qdrant/collections/${encodeURIComponent(collection.name)}/settings`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            visibility,
            description: buildDescriptionJson(),
            allowed_users: visibility === "shared" ? allowedUsers : null,
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

  // 삭제 확인
  const handleConfirmDelete = () => {
    setDeleteDialogOpen(false)
    onOpenChange(false)
    onDelete?.()
  }

  const handleSubmit = mode === "create" ? handleCreate : handleSave
  const canSubmit = mode === "create" ? name.trim() !== "" : true

  const SelectedIconComp = ICON_OPTIONS.find((o) => o.value === selectedIcon)?.icon || Database
  const metadata = collection ? parseMetadata(collection.description) : {}
  const displayName = metadata.koreanName || collection?.name || ""
  const HeaderIconComp = ICON_OPTIONS.find((o) => o.value === (metadata.icon || "Database"))?.icon || Database

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className={cn(
            "p-0 gap-0 flex flex-row h-[580px] max-h-[90vh] transition-all duration-300 overflow-hidden",
            docsPanelOpen ? "w-[960px] max-w-[95vw]" : "w-[480px] max-w-[90vw]"
          )}
          showCloseButton={!docsPanelOpen}
        >
          {/* 좌측: 메인 패널 */}
          <div className="w-[480px] flex-shrink-0 flex flex-col">
            {/* 헤더 */}
            <div className="h-14 px-5 border-b flex-shrink-0 flex items-center">
              <DialogHeader className="sr-only">
                <DialogTitle>{mode === "create" ? "새 컬렉션" : "컬렉션 설정"}</DialogTitle>
                <DialogDescription>컬렉션 설정</DialogDescription>
              </DialogHeader>
              <div className="flex items-center gap-3 w-full">
                <div
                  className={cn(
                    "p-2 rounded-lg",
                    mode === "create" ? "bg-primary/10" : "bg-muted"
                  )}
                >
                  {mode === "create" ? (
                    <Sparkles className="h-4 w-4 text-primary" />
                  ) : (
                    <HeaderIconComp className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold truncate">
                    {mode === "create" ? "새 컬렉션 생성" : displayName || collection?.name}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {mode === "create" ? (
                      "벡터 데이터베이스에 새 컬렉션을 생성합니다"
                    ) : (
                      <span>
                        {collection?.documents_count}문서 · {collection?.points_count.toLocaleString()}청크
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* 폼 영역 */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {/* 컬렉션 이름 (create 전용) */}
              {mode === "create" && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">
                    컬렉션 이름 <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    placeholder="예: hr-service-regulations"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-9"
                    autoFocus
                  />
                  <p className="text-[10px] text-muted-foreground">
                    영문, 숫자, 한글, 하이픈, 언더스코어 사용 가능
                  </p>
                </div>
              )}

              {/* 표시명 + 아이콘 */}
              <div className="grid grid-cols-[1fr_140px] gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">표시명</Label>
                  <Input
                    placeholder="예: 복무·복지 규정"
                    value={koreanName}
                    onChange={(e) => setKoreanName(e.target.value)}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">아이콘</Label>
                  <Select value={selectedIcon} onValueChange={setSelectedIcon}>
                    <SelectTrigger className="h-9">
                      <SelectValue>
                        <div className="flex items-center gap-2">
                          <SelectedIconComp className="h-4 w-4" />
                          <span className="text-xs">{ICON_OPTIONS.find((o) => o.value === selectedIcon)?.label}</span>
                        </div>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <div className="grid grid-cols-3 gap-1 p-1">
                        {ICON_OPTIONS.map((option) => {
                          const Icon = option.icon
                          return (
                            <SelectItem
                              key={option.value}
                              value={option.value}
                              className="flex-col items-center justify-center p-2 cursor-pointer"
                            >
                              <Icon className="h-4 w-4 mb-1" />
                              <span className="text-[10px]">{option.label}</span>
                            </SelectItem>
                          )
                        })}
                      </div>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* 키워드 */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium">키워드</Label>
                  <Popover open={keywordPopoverOpen} onOpenChange={setKeywordPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
                        <Plus className="h-3 w-3 mr-1" />
                        추가
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-56 p-3" align="end">
                      <Input
                        placeholder="키워드 입력 후 Enter"
                        value={keywordInput}
                        onChange={(e) => setKeywordInput(e.target.value)}
                        onKeyDown={handleKeywordKeyDown}
                        className="h-8"
                        autoFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="flex flex-wrap gap-1.5 min-h-[32px] p-2 rounded-md border bg-muted/30">
                  {keywords.length === 0 ? (
                    <span className="text-xs text-muted-foreground">검색용 키워드를 추가하세요</span>
                  ) : (
                    keywords.map((keyword) => (
                      <Badge key={keyword} variant="secondary" className="h-6 gap-1 pr-1">
                        {keyword}
                        <button
                          onClick={() => removeKeyword(keyword)}
                          className="ml-0.5 hover:bg-muted rounded-full p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))
                  )}
                </div>
              </div>

              {/* 공개 설정 */}
              <div className="space-y-2">
                <Label className="text-xs font-medium">공개 범위</Label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: "private", label: "비공개", icon: Lock, desc: "나만 접근" },
                    { value: "public", label: "공개", icon: Globe, desc: "모든 사용자" },
                    { value: "shared", label: "공유", icon: Users, desc: "선택한 사용자" },
                  ].map((option) => {
                    const Icon = option.icon
                    const isSelected = visibility === option.value
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setVisibility(option.value as Visibility)}
                        className={cn(
                          "flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all",
                          isSelected
                            ? "border-primary bg-primary/5"
                            : "border-muted hover:border-muted-foreground/30"
                        )}
                      >
                        <Icon className={cn("h-4 w-4", isSelected ? "text-primary" : "text-muted-foreground")} />
                        <span className={cn("text-xs font-medium", isSelected && "text-primary")}>
                          {option.label}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{option.desc}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* 공유 대상 (shared 선택 시) */}
              <AnimatePresence>
                {visibility === "shared" && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-1.5 pt-1">
                      <Label className="text-xs font-medium">공유 대상</Label>
                      <Popover open={userPopoverOpen} onOpenChange={setUserPopoverOpen}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full h-9 justify-between">
                            <span className="text-sm">
                              {allowedUsers.length > 0 ? `${allowedUsers.length}명 선택됨` : "공유 대상 선택"}
                            </span>
                            <ChevronsUpDown className="h-4 w-4 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64 p-0" align="start">
                          <Command>
                            <CommandInput placeholder="사용자 검색..." className="h-9" />
                            <CommandList>
                              <CommandEmpty>{loadingUsers ? "로딩 중..." : "결과 없음"}</CommandEmpty>
                              <CommandGroup>
                                {availableUsers.map((user) => (
                                  <CommandItem
                                    key={user.id}
                                    value={user.name || user.username}
                                    onSelect={() => toggleUserSelection(user.id)}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        allowedUsers.includes(user.id) ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    <span>{user.name || user.username}</span>
                                    {user.team_name && (
                                      <span className="ml-auto text-xs text-muted-foreground">{user.team_name}</span>
                                    )}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* 추천 컬렉션 */}
              <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                <div className="flex items-center gap-2">
                  <Star className={cn("h-4 w-4", isPriority ? "text-amber-500 fill-amber-500" : "text-muted-foreground")} />
                  <span className="text-sm">추천 컬렉션으로 표시</span>
                </div>
                <Switch checked={isPriority} onCheckedChange={setIsPriority} />
              </div>
            </div>

            {/* 푸터 */}
            <div className="flex items-center justify-between px-5 py-3 border-t bg-muted/30 flex-shrink-0">
              <div className="flex gap-1.5">
                {mode === "edit" && (
                  <>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant={docsPanelOpen ? "secondary" : "ghost"}
                            size="sm"
                            className="h-8 px-3"
                            onClick={openDocsPanel}
                          >
                            <FolderCog className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>문서 관리</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-3 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => setDeleteDialogOpen(true)}
                          >
                            <AlertTriangle className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>컬렉션 삭제</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>
                  취소
                </Button>
                <Button size="sm" onClick={handleSubmit} disabled={saving || !canSubmit}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === "create" ? "생성" : "저장"}
                </Button>
              </div>
            </div>
          </div>

          {/* 우측: 문서 패널 (edit 전용) */}
          {docsPanelOpen && mode === "edit" && collection && (
            <div className="w-[480px] flex-shrink-0 border-l flex flex-col bg-background">
              {/* 문서 패널 헤더 */}
              <div className="h-14 px-5 border-b flex-shrink-0 flex items-center">
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    <FolderCog className="h-4 w-4" />
                    <div>
                      <span className="text-sm font-medium">문서 관리</span>
                      <p className="text-[10px] text-muted-foreground">{collectionDocs.length}개 문서</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDocsPanelOpen(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* 바로가기 버튼 */}
              <div className="flex gap-2 px-5 py-3 border-b bg-muted/20">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 h-8 text-xs"
                  onClick={() => {
                    onOpenChange(false)
                    window.location.href = `/upload?collection=${encodeURIComponent(collection.name)}`
                  }}
                >
                  <Upload className="h-3.5 w-3.5 mr-1.5" />
                  벡터 임베딩
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 h-8 text-xs"
                  onClick={() => {
                    onOpenChange(false)
                    window.location.href = `/excel-embedding?collection=${encodeURIComponent(collection.name)}`
                  }}
                >
                  <Table className="h-3.5 w-3.5 mr-1.5" />
                  엑셀 임베딩
                </Button>
              </div>

              {/* 문서 목록 */}
              <div className="flex-1 overflow-y-auto">
                {loadingDocs ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : collectionDocs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <FileText className="h-10 w-10 text-muted-foreground/50 mb-3" />
                    <p className="text-sm text-muted-foreground">업로드된 문서가 없습니다</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {/* 전체 선택 */}
                    <div className="flex items-center gap-3 px-5 py-2.5 bg-muted/30 sticky top-0">
                      <Checkbox
                        checked={selectedDocs.size === collectionDocs.length && collectionDocs.length > 0}
                        onCheckedChange={toggleSelectAll}
                      />
                      <span className="text-xs text-muted-foreground">
                        {selectedDocs.size > 0 ? `${selectedDocs.size}개 선택됨` : "전체 선택"}
                      </span>
                    </div>

                    {/* 문서 리스트 */}
                    {collectionDocs.map((doc) => {
                      const docKey =
                        doc.source_type === "document" ? `doc:${doc.document_id}` : `excel:${doc.filename}`
                      const isSelected = selectedDocs.has(docKey)

                      return (
                        <div
                          key={docKey}
                          className={cn(
                            "flex items-center gap-3 px-5 py-3 cursor-pointer transition-colors",
                            isSelected ? "bg-primary/5" : "hover:bg-muted/50"
                          )}
                          onClick={() => toggleDocSelection(docKey)}
                        >
                          <Checkbox checked={isSelected} onCheckedChange={() => toggleDocSelection(docKey)} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              {doc.source_type === "excel" ? (
                                <FileSpreadsheet className="h-4 w-4 text-green-600 flex-shrink-0" />
                              ) : (
                                <FileText className="h-4 w-4 text-blue-600 flex-shrink-0" />
                              )}
                              <span className="text-sm truncate">{doc.filename}</span>
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-0.5 ml-6">
                              {doc.chunk_count.toLocaleString()}개 청크
                              {doc.source_type === "excel" && " · Excel"}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* 문서 패널 푸터 */}
              <div className="flex items-center justify-between px-5 py-3 border-t bg-muted/30 flex-shrink-0">
                <span className="text-xs text-muted-foreground">
                  {selectedDocs.size > 0 ? `${selectedDocs.size}개 선택됨` : "문서를 선택하세요"}
                </span>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={selectedDocs.size === 0 || deletingDocs}
                  onClick={() => setDocDeleteDialogOpen(true)}
                >
                  {deletingDocs ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4 mr-1" />
                      삭제
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 삭제 확인 AlertDialog */}
      {mode === "edit" && collection && (
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent className="max-w-sm">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                컬렉션 삭제
              </AlertDialogTitle>
              <AlertDialogDescription>
                <strong>{displayName || collection.name}</strong> 컬렉션을 삭제합니다.
                <br />
                {collection.documents_count}개 문서, {collection.points_count.toLocaleString()}개 청크가 모두
                삭제됩니다.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>취소</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive hover:bg-destructive/90">
                삭제
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* 문서 삭제 확인 AlertDialog */}
      <AlertDialog open={docDeleteDialogOpen} onOpenChange={setDocDeleteDialogOpen}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              문서 삭제
            </AlertDialogTitle>
            <AlertDialogDescription>
              선택한 <strong>{selectedDocs.size}개 문서</strong>를 삭제합니다.
              <br />
              총 <strong>{selectedDocsChunkCount.toLocaleString()}개 청크</strong>가 함께 삭제됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={deleteSelectedDocuments} className="bg-destructive hover:bg-destructive/90">
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
