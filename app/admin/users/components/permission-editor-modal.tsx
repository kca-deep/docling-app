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
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Shield,
  Loader2,
  RotateCcw,
  Save,
  FileText,
  Database,
  MessageSquare,
  BarChart3,
  Sheet,
  Settings,
  ClipboardCheck,
  ExternalLink,
} from "lucide-react"
import { toast } from "sonner"
import {
  UserListItem,
  UserPermissions,
  getUserPermissions,
  updateUserPermissions,
  resetUserPermissions,
  getDefaultPermissions,
} from "@/lib/auth"

interface PermissionEditorModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: UserListItem | null
  onUpdated?: () => void
}

interface PermissionCategory {
  key: keyof UserPermissions
  label: string
  icon: React.ReactNode
  description: string
  actions: {
    key: string
    label: string
    description: string
  }[]
}

const PERMISSION_CATEGORIES: PermissionCategory[] = [
  {
    key: "selfcheck",
    label: "셀프진단",
    icon: <ClipboardCheck className="h-4 w-4" />,
    description: "보안성 셀프진단 기능",
    actions: [
      { key: "execute", label: "진단 실행", description: "셀프진단 실행 가능" },
      { key: "history", label: "이력 조회", description: "본인 진단 이력 조회" },
    ],
  },
  {
    key: "documents",
    label: "문서 관리",
    icon: <FileText className="h-4 w-4" />,
    description: "문서 파싱 및 관리",
    actions: [
      { key: "parse", label: "문서 파싱", description: "문서 변환 실행 가능" },
      { key: "view", label: "문서 조회", description: "파싱된 문서 조회 가능" },
      { key: "delete", label: "문서 삭제", description: "문서 삭제 가능" },
    ],
  },
  {
    key: "qdrant",
    label: "벡터 DB",
    icon: <Database className="h-4 w-4" />,
    description: "Qdrant 벡터 데이터베이스",
    actions: [
      { key: "upload", label: "업로드", description: "벡터 임베딩 업로드 가능" },
      { key: "collections", label: "컬렉션 관리", description: "컬렉션 생성/삭제 가능" },
    ],
  },
  {
    key: "dify",
    label: "Dify 연동",
    icon: <ExternalLink className="h-4 w-4" />,
    description: "Dify AI 플랫폼 연동",
    actions: [
      { key: "upload", label: "업로드", description: "Dify 문서 업로드 가능" },
      { key: "config", label: "설정 관리", description: "Dify 설정 변경 가능" },
    ],
  },
  {
    key: "chat",
    label: "AI 채팅",
    icon: <MessageSquare className="h-4 w-4" />,
    description: "RAG 기반 AI 채팅",
    actions: [
      { key: "use", label: "채팅 사용", description: "AI 채팅 사용 가능" },
      { key: "all_collections", label: "전체 컬렉션", description: "모든 컬렉션 접근 가능" },
    ],
  },
  {
    key: "analytics",
    label: "분석",
    icon: <BarChart3 className="h-4 w-4" />,
    description: "사용 통계 및 분석",
    actions: [
      { key: "view", label: "통계 조회", description: "사용 통계 조회 가능" },
    ],
  },
  {
    key: "excel",
    label: "엑셀 임베딩",
    icon: <Sheet className="h-4 w-4" />,
    description: "엑셀 파일 처리",
    actions: [
      { key: "upload", label: "엑셀 업로드", description: "엑셀 파일 업로드 가능" },
    ],
  },
  {
    key: "admin",
    label: "관리자",
    icon: <Settings className="h-4 w-4" />,
    description: "시스템 관리 기능",
    actions: [
      { key: "users", label: "사용자 관리", description: "사용자 관리 가능" },
      { key: "system", label: "시스템 설정", description: "시스템 설정 변경 가능" },
    ],
  },
]

export function PermissionEditorModal({
  open,
  onOpenChange,
  user,
  onUpdated,
}: PermissionEditorModalProps) {
  const [permissions, setPermissions] = useState<UserPermissions | null>(null)
  const [originalPermissions, setOriginalPermissions] = useState<UserPermissions | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Fetch permissions when modal opens
  const fetchPermissions = useCallback(async () => {
    if (!user) return

    setIsLoading(true)
    try {
      const response = await getUserPermissions(user.id)
      setPermissions(response.permissions)
      setOriginalPermissions(response.permissions)
    } catch (error) {
      console.error("Failed to fetch permissions:", error)
      toast.error("권한 정보를 불러오는데 실패했습니다.")
      // 기본값 사용
      const defaultPerms = getDefaultPermissions()
      setPermissions(defaultPerms)
      setOriginalPermissions(defaultPerms)
    } finally {
      setIsLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (open && user) {
      fetchPermissions()
    }
  }, [open, user, fetchPermissions])

  // Check if permissions have changed
  const hasChanges = JSON.stringify(permissions) !== JSON.stringify(originalPermissions)

  // Toggle permission
  const togglePermission = (category: keyof UserPermissions, action: string) => {
    if (!permissions) return

    setPermissions({
      ...permissions,
      [category]: {
        ...(permissions[category] as Record<string, boolean>),
        [action]: !(permissions[category] as Record<string, boolean>)?.[action],
      },
    })
  }

  // Save permissions
  const handleSave = async () => {
    if (!user || !permissions) return

    setIsSaving(true)
    try {
      await updateUserPermissions(user.id, permissions)
      toast.success(`${user.username} 사용자의 권한이 저장되었습니다.`)
      setOriginalPermissions(permissions)
      onUpdated?.()
      onOpenChange(false)
    } catch (error) {
      console.error("Failed to save permissions:", error)
      toast.error("권한 저장에 실패했습니다.")
    } finally {
      setIsSaving(false)
    }
  }

  // Reset to default
  const handleReset = async () => {
    if (!user) return

    setIsSaving(true)
    try {
      const response = await resetUserPermissions(user.id)
      setPermissions(response.permissions)
      setOriginalPermissions(response.permissions)
      toast.success(`${user.username} 사용자의 권한이 기본값으로 초기화되었습니다.`)
      onUpdated?.()
    } catch (error) {
      console.error("Failed to reset permissions:", error)
      toast.error("권한 초기화에 실패했습니다.")
    } finally {
      setIsSaving(false)
    }
  }

  // Get permission value
  const getPermissionValue = (category: keyof UserPermissions, action: string): boolean => {
    if (!permissions) return false
    const categoryPerms = permissions[category] as Record<string, boolean> | undefined
    return categoryPerms?.[action] ?? false
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            권한 설정
          </DialogTitle>
          <DialogDescription>
            {user && (
              <span className="flex items-center gap-2">
                <span className="font-medium text-foreground">{user.username}</span>
                <Badge variant="outline">{user.name || "-"}</Badge>
                {user.role === "admin" && (
                  <Badge className="bg-purple-500/10 text-purple-600 border-purple-500/30">
                    관리자
                  </Badge>
                )}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {user?.role === "admin" ? (
          <div className="py-8 text-center text-muted-foreground">
            <Shield className="h-12 w-12 mx-auto mb-4 text-purple-500/50" />
            <p className="font-medium text-foreground mb-2">관리자 계정</p>
            <p className="text-sm">
              관리자는 모든 권한을 자동으로 보유합니다.
              <br />
              권한 설정은 일반 사용자에게만 적용됩니다.
            </p>
          </div>
        ) : isLoading ? (
          <div className="space-y-4 py-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto py-2 pr-2 -mr-2">
            <div className="space-y-6">
              {PERMISSION_CATEGORIES.map((category, idx) => (
                <div key={category.key}>
                  {idx > 0 && <Separator className="mb-6" />}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-md bg-muted text-muted-foreground">
                        {category.icon}
                      </div>
                      <div>
                        <h4 className="font-medium text-sm">{category.label}</h4>
                        <p className="text-xs text-muted-foreground">{category.description}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 ml-8">
                      {category.actions.map((action) => (
                        <div
                          key={`${category.key}-${action.key}`}
                          className="flex items-center justify-between p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
                        >
                          <div className="space-y-0.5">
                            <Label
                              htmlFor={`${category.key}-${action.key}`}
                              className="text-sm font-medium cursor-pointer"
                            >
                              {action.label}
                            </Label>
                            <p className="text-xs text-muted-foreground">
                              {action.description}
                            </p>
                          </div>
                          <Switch
                            id={`${category.key}-${action.key}`}
                            checked={getPermissionValue(category.key, action.key)}
                            onCheckedChange={() => togglePermission(category.key, action.key)}
                            disabled={isSaving}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter className="flex-shrink-0 pt-4 border-t gap-2">
          {user?.role !== "admin" && (
            <>
              <Button
                variant="outline"
                onClick={handleReset}
                disabled={isSaving || isLoading}
                className="gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                기본값으로 초기화
              </Button>
              <div className="flex-1" />
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSaving}
              >
                취소
              </Button>
              <Button
                onClick={handleSave}
                disabled={isSaving || isLoading || !hasChanges}
                className="gap-2"
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                저장
              </Button>
            </>
          )}
          {user?.role === "admin" && (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              닫기
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
