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
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            컬렉션 설정
          </DialogTitle>
          <DialogDescription>
            {collection.name}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="general" className="flex-1">일반</TabsTrigger>
            <TabsTrigger value="visibility" className="flex-1">공개 설정</TabsTrigger>
            <TabsTrigger value="danger" className="flex-1 text-destructive data-[state=active]:text-destructive">
              위험 영역
            </TabsTrigger>
          </TabsList>

          {/* 일반 탭 */}
          <TabsContent value="general" className="space-y-4 pt-4 max-h-[50vh] overflow-y-auto pr-2">
            {/* 컬렉션 정보 */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">문서 수</Label>
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{collection.documents_count.toLocaleString()}</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">청크 수</Label>
                  <span className="font-medium">{collection.points_count.toLocaleString()}</span>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">벡터 크기</Label>
                  <span className="font-medium">{collection.vector_size}</span>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">거리 메트릭</Label>
                  <span className="font-medium">{collection.distance}</span>
                </div>
              </div>

              <Separator />

              {/* 한글명 */}
              <div className="space-y-2">
                <Label htmlFor="settings-koreanName">표시명 (한글)</Label>
                <Input
                  id="settings-koreanName"
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
                <Label htmlFor="settings-keywords">키워드</Label>
                <div className="flex gap-2">
                  <Input
                    id="settings-keywords"
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
                  id="settings-priority"
                  checked={isPriority}
                  onCheckedChange={(checked) => setIsPriority(checked === true)}
                />
                <Label htmlFor="settings-priority" className="flex items-center gap-1.5 cursor-pointer">
                  <Star className="h-4 w-4 text-amber-500" />
                  추천 컬렉션으로 표시
                </Label>
              </div>

              {/* 설명 */}
              <div className="space-y-2">
                <Label htmlFor="settings-plainDescription">설명</Label>
                <Textarea
                  id="settings-plainDescription"
                  placeholder="컬렉션에 대한 간단한 설명"
                  value={plainDescription}
                  onChange={(e) => setPlainDescription(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
          </TabsContent>

          {/* 공개 설정 탭 */}
          <TabsContent value="visibility" className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>현재 상태</Label>
              <div className="flex items-center gap-2">
                {visibility === "public" && (
                  <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                    <Globe className="h-3 w-3 mr-1" />
                    공개
                  </Badge>
                )}
                {visibility === "private" && (
                  <Badge variant="secondary" className="bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                    <Lock className="h-3 w-3 mr-1" />
                    비공개
                  </Badge>
                )}
                {visibility === "shared" && (
                  <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                    <Users className="h-3 w-3 mr-1" />
                    공유
                  </Badge>
                )}
              </div>
            </div>

            <Separator />

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
                <RadioGroupItem value="private" id="settings-private" className="mt-0.5" />
                <div className="flex-1">
                  <Label htmlFor="settings-private" className="flex items-center gap-2 cursor-pointer font-medium">
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
                <RadioGroupItem value="public" id="settings-public" className="mt-0.5" />
                <div className="flex-1">
                  <Label htmlFor="settings-public" className="flex items-center gap-2 cursor-pointer font-medium">
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
                <RadioGroupItem value="shared" id="settings-shared" className="mt-0.5" />
                <div className="flex-1">
                  <Label htmlFor="settings-shared" className="flex items-center gap-2 cursor-pointer font-medium">
                    <Users className="h-4 w-4" />
                    공유 (Shared)
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    선택한 사용자만 접근 가능
                  </p>
                </div>
              </div>
            </RadioGroup>

            {/* 공유 사용자 선택 (shared일 때만) */}
            {visibility === "shared" && (
              <div className="space-y-2 pt-2">
                <Label>접근 허용 사용자</Label>
                <div className="p-4 rounded-lg border border-dashed text-center text-sm text-muted-foreground">
                  사용자 선택 기능은 준비 중입니다
                </div>
              </div>
            )}
          </TabsContent>

          {/* 위험 영역 탭 */}
          <TabsContent value="danger" className="space-y-4 pt-4">
            <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
                <div className="space-y-2">
                  <h4 className="font-medium text-destructive">컬렉션 삭제</h4>
                  <p className="text-sm text-muted-foreground">
                    컬렉션을 삭제하면 모든 벡터 데이터가 영구적으로 삭제됩니다.
                    이 작업은 되돌릴 수 없습니다.
                  </p>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="mt-2"
                    onClick={() => {
                      onOpenChange(false)
                      onDelete?.()
                    }}
                  >
                    컬렉션 삭제
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            취소
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                저장 중...
              </>
            ) : (
              "저장"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
