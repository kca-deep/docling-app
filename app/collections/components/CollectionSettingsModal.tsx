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
import {
  AlertTriangle,
  Globe,
  Lock,
  Users,
  Database,
  Settings,
  Loader2,
} from "lucide-react"
import { toast } from "sonner"
import { API_BASE_URL } from "@/lib/api-config"
import { cn } from "@/lib/utils"

interface Collection {
  name: string
  vectors_count: number
  points_count: number
  vector_size: number
  distance: string
  visibility?: "public" | "private" | "shared"
  description?: string
  owner_id?: number
  is_owner?: boolean
  documents_count?: number
  created_at?: string
}

interface CollectionSettingsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  collection: Collection | null
  onSuccess: () => void
}

type Visibility = "public" | "private" | "shared"

export function CollectionSettingsModal({
  open,
  onOpenChange,
  collection,
  onSuccess,
}: CollectionSettingsModalProps) {
  const [activeTab, setActiveTab] = useState("general")
  const [description, setDescription] = useState("")
  const [visibility, setVisibility] = useState<Visibility>("public")
  const [saving, setSaving] = useState(false)

  // collection이 변경되면 폼 초기화
  useEffect(() => {
    if (collection) {
      setDescription(collection.description || "")
      setVisibility(collection.visibility || "public")
    }
  }, [collection])

  // 설정 저장
  const handleSave = async () => {
    if (!collection) return

    setSaving(true)
    try {
      // 추후 백엔드 API 구현 시 활성화
      // const response = await fetch(
      //   `${API_BASE_URL}/api/qdrant/collections/${encodeURIComponent(collection.name)}/settings`,
      //   {
      //     method: "PATCH",
      //     headers: { "Content-Type": "application/json" },
      //     credentials: 'include',
      //     body: JSON.stringify({
      //       visibility,
      //       description,
      //     }),
      //   }
      // )

      // 임시: 성공 메시지 표시
      toast.success("설정이 저장되었습니다 (백엔드 API 준비 중)")
      onOpenChange(false)
      onSuccess()
    } catch (error) {
      console.error("Failed to save settings:", error)
      toast.error("설정 저장에 실패했습니다")
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
          <TabsContent value="general" className="space-y-4 pt-4">
            {/* 컬렉션 정보 */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">벡터 수</Label>
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{collection.vectors_count.toLocaleString()}</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">벡터 크기</Label>
                  <span className="font-medium">{collection.vector_size}</span>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">거리 메트릭</Label>
                  <span className="font-medium">{collection.distance}</span>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">문서 수</Label>
                  <span className="font-medium">{collection.documents_count ?? "-"}</span>
                </div>
              </div>

              <Separator />

              {/* 설명 편집 */}
              <div className="space-y-2">
                <Label htmlFor="description">설명</Label>
                <Textarea
                  id="description"
                  placeholder="컬렉션에 대한 간단한 설명"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
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
                      // 삭제 모달은 부모 컴포넌트에서 처리
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
