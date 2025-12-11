"use client"

import { useState } from "react"
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Loader2,
  Globe,
  Lock,
  Users,
  ChevronDown,
  Settings,
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
  Database,
  LucideIcon,
} from "lucide-react"
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

interface CreateCollectionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

type Visibility = "public" | "private" | "shared"

export function CreateCollectionModal({
  open,
  onOpenChange,
  onSuccess,
}: CreateCollectionModalProps) {
  const [name, setName] = useState("")
  const [koreanName, setKoreanName] = useState("")
  const [selectedIcon, setSelectedIcon] = useState("Database")
  const [keywords, setKeywords] = useState<string[]>([])
  const [keywordInput, setKeywordInput] = useState("")
  const [isPriority, setIsPriority] = useState(false)
  const [plainDescription, setPlainDescription] = useState("")
  const [visibility, setVisibility] = useState<Visibility>("public")
  const [vectorSize, setVectorSize] = useState("1024")
  const [distance, setDistance] = useState("Cosine")
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [creating, setCreating] = useState(false)

  // 폼 초기화
  const resetForm = () => {
    setName("")
    setKoreanName("")
    setSelectedIcon("Database")
    setKeywords([])
    setKeywordInput("")
    setIsPriority(false)
    setPlainDescription("")
    setVisibility("public")
    setVectorSize("1024")
    setDistance("Cosine")
    setAdvancedOpen(false)
  }

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

  // 컬렉션 생성
  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("컬렉션 이름을 입력해주세요")
      return
    }

    // 이름 유효성 검사 (영문, 숫자, 한글, 공백, 점, 언더스코어, 하이픈만 허용)
    const nameRegex = /^[a-zA-Z0-9가-힣\s._-]+$/
    if (!nameRegex.test(name)) {
      toast.error("컬렉션 이름에 사용할 수 없는 문자가 포함되어 있습니다")
      return
    }

    setCreating(true)
    try {
      const response = await fetch(`${API_BASE_URL}/api/qdrant/collections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
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
      setCreating(false)
    }
  }

  // 모달 닫힐 때 폼 초기화
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      resetForm()
    }
    onOpenChange(open)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>새 컬렉션 생성</DialogTitle>
          <DialogDescription>
            벡터 데이터베이스에 새로운 컬렉션을 생성합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4 max-h-[60vh] overflow-y-auto pr-2">
          {/* 컬렉션 이름 */}
          <div className="space-y-2">
            <Label htmlFor="name">
              컬렉션 이름 <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              placeholder="예: hr-service-regulations"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              영문, 숫자, 하이픈, 언더스코어 권장
            </p>
          </div>

          {/* 한글명 */}
          <div className="space-y-2">
            <Label htmlFor="koreanName">표시명 (한글)</Label>
            <Input
              id="koreanName"
              placeholder="예: 복무·복지"
              value={koreanName}
              onChange={(e) => setKoreanName(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              UI에 표시될 이름입니다
            </p>
          </div>

          {/* 아이콘 선택 */}
          <div className="space-y-2">
            <Label>아이콘</Label>
            <Select value={selectedIcon} onValueChange={setSelectedIcon}>
              <SelectTrigger>
                <SelectValue>
                  {(() => {
                    const option = ICON_OPTIONS.find(o => o.value === selectedIcon)
                    if (option) {
                      const IconComp = option.icon
                      return (
                        <span className="flex items-center gap-2">
                          <IconComp className="h-4 w-4" />
                          {option.label}
                        </span>
                      )
                    }
                    return "아이콘 선택"
                  })()}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {ICON_OPTIONS.map((option) => {
                  const IconComp = option.icon
                  return (
                    <SelectItem key={option.value} value={option.value}>
                      <span className="flex items-center gap-2">
                        <IconComp className="h-4 w-4" />
                        {option.label}
                      </span>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>

          {/* 키워드 */}
          <div className="space-y-2">
            <Label htmlFor="keywords">키워드</Label>
            <div className="flex gap-2">
              <Input
                id="keywords"
                placeholder="키워드 입력 후 Enter"
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyDown={handleKeywordKeyDown}
              />
              <Button type="button" variant="outline" size="sm" onClick={addKeyword}>
                추가
              </Button>
            </div>
            {keywords.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {keywords.map((keyword) => (
                  <Badge key={keyword} variant="secondary" className="gap-1 pr-1">
                    {keyword}
                    <button
                      type="button"
                      onClick={() => removeKeyword(keyword)}
                      className="ml-1 hover:bg-muted rounded-full p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              검색에 사용될 키워드입니다
            </p>
          </div>

          {/* 추천 컬렉션 */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="priority"
              checked={isPriority}
              onCheckedChange={(checked) => setIsPriority(checked === true)}
            />
            <Label htmlFor="priority" className="flex items-center gap-1.5 cursor-pointer">
              <Star className="h-4 w-4 text-amber-500" />
              추천 컬렉션으로 표시
            </Label>
          </div>

          {/* 설명 */}
          <div className="space-y-2">
            <Label htmlFor="plainDescription">설명 (선택)</Label>
            <Textarea
              id="plainDescription"
              placeholder="컬렉션에 대한 간단한 설명"
              value={plainDescription}
              onChange={(e) => setPlainDescription(e.target.value)}
              rows={2}
            />
          </div>

          {/* 공개 설정 */}
          <div className="space-y-3">
            <Label>
              공개 설정 <span className="text-destructive">*</span>
            </Label>
            <RadioGroup
              value={visibility}
              onValueChange={(v) => setVisibility(v as Visibility)}
              className="space-y-3"
            >
              {/* 비공개 */}
              <div
                className={cn(
                  "flex items-start space-x-3 p-3 rounded-lg border cursor-pointer transition-colors",
                  visibility === "private"
                    ? "border-primary bg-primary/5"
                    : "border-muted hover:border-muted-foreground/50"
                )}
                onClick={() => setVisibility("private")}
              >
                <RadioGroupItem value="private" id="private" className="mt-0.5" />
                <div className="flex-1">
                  <Label htmlFor="private" className="flex items-center gap-2 cursor-pointer font-medium">
                    <Lock className="h-4 w-4" />
                    비공개 (Private)
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    본인만 접근 가능
                  </p>
                </div>
              </div>

              {/* 공개 */}
              <div
                className={cn(
                  "flex items-start space-x-3 p-3 rounded-lg border cursor-pointer transition-colors",
                  visibility === "public"
                    ? "border-primary bg-primary/5"
                    : "border-muted hover:border-muted-foreground/50"
                )}
                onClick={() => setVisibility("public")}
              >
                <RadioGroupItem value="public" id="public" className="mt-0.5" />
                <div className="flex-1">
                  <Label htmlFor="public" className="flex items-center gap-2 cursor-pointer font-medium">
                    <Globe className="h-4 w-4" />
                    공개 (Public)
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    모든 사용자가 검색 가능 (비로그인 포함)
                  </p>
                </div>
              </div>

              {/* 공유 */}
              <div
                className={cn(
                  "flex items-start space-x-3 p-3 rounded-lg border cursor-pointer transition-colors",
                  visibility === "shared"
                    ? "border-primary bg-primary/5"
                    : "border-muted hover:border-muted-foreground/50"
                )}
                onClick={() => setVisibility("shared")}
              >
                <RadioGroupItem value="shared" id="shared" className="mt-0.5" />
                <div className="flex-1">
                  <Label htmlFor="shared" className="flex items-center gap-2 cursor-pointer font-medium">
                    <Users className="h-4 w-4" />
                    공유 (Shared)
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    선택한 사용자만 접근 가능
                  </p>
                </div>
              </div>
            </RadioGroup>
          </div>

          {/* 고급 설정 */}
          <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between px-0 hover:bg-transparent">
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Settings className="h-4 w-4" />
                  고급 설정
                </span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 text-muted-foreground transition-transform",
                    advancedOpen && "rotate-180"
                  )}
                />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                {/* 벡터 크기 */}
                <div className="space-y-2">
                  <Label htmlFor="vectorSize">벡터 크기</Label>
                  <Select value={vectorSize} onValueChange={setVectorSize}>
                    <SelectTrigger id="vectorSize">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="384">384 (MiniLM)</SelectItem>
                      <SelectItem value="768">768 (BERT)</SelectItem>
                      <SelectItem value="1024">1024 (BGE-M3)</SelectItem>
                      <SelectItem value="1536">1536 (OpenAI)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* 거리 메트릭 */}
                <div className="space-y-2">
                  <Label htmlFor="distance">거리 메트릭</Label>
                  <Select value={distance} onValueChange={setDistance}>
                    <SelectTrigger id="distance">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Cosine">Cosine</SelectItem>
                      <SelectItem value="Euclid">Euclidean</SelectItem>
                      <SelectItem value="Dot">Dot Product</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={creating}>
            취소
          </Button>
          <Button onClick={handleCreate} disabled={creating || !name.trim()}>
            {creating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                생성 중...
              </>
            ) : (
              "생성"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
