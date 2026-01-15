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
import { Badge } from "@/components/ui/badge"
import {
  Lock,
  Loader2,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
} from "lucide-react"
import { toast } from "sonner"
import {
  UserListItem,
  resetUserPassword,
} from "@/lib/auth"

interface PasswordResetModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: UserListItem | null
  onUpdated?: () => void
}

export function PasswordResetModal({
  open,
  onOpenChange,
  user,
  onUpdated,
}: PasswordResetModalProps) {
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Password validation
  const passwordMinLength = 8
  const hasMinLength = newPassword.length >= passwordMinLength
  const hasUppercase = /[A-Z]/.test(newPassword)
  const hasLowercase = /[a-z]/.test(newPassword)
  const hasNumber = /\d/.test(newPassword)
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(newPassword)
  const passwordsMatch = newPassword === confirmPassword && newPassword.length > 0

  const isValidPassword = hasMinLength && hasUppercase && hasLowercase && hasNumber && hasSpecial
  const canSubmit = isValidPassword && passwordsMatch && !isSubmitting

  // Reset form when modal closes
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setNewPassword("")
      setConfirmPassword("")
      setShowPassword(false)
      setShowConfirmPassword(false)
      setError(null)
    }
    onOpenChange(isOpen)
  }

  // Handle submit
  const handleSubmit = async () => {
    if (!user || !canSubmit) return

    setIsSubmitting(true)
    setError(null)

    try {
      await resetUserPassword(user.id, newPassword, confirmPassword)
      toast.success(`${user.username} 사용자의 비밀번호가 초기화되었습니다.`)
      handleOpenChange(false)
      onUpdated?.()
    } catch (err) {
      const message = err instanceof Error ? err.message : "비밀번호 초기화에 실패했습니다."
      setError(message)
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Password requirement indicator
  const RequirementIndicator = ({ met, label }: { met: boolean; label: string }) => (
    <div className={`flex items-center gap-1.5 text-xs ${met ? "text-green-600" : "text-muted-foreground"}`}>
      {met ? (
        <CheckCircle2 className="h-3 w-3" />
      ) : (
        <div className="h-3 w-3 rounded-full border border-muted-foreground/50" />
      )}
      {label}
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" />
            비밀번호 초기화
          </DialogTitle>
          <DialogDescription>
            {user && (
              <span className="flex items-center gap-2">
                <span className="font-medium text-foreground">{user.username}</span>
                <Badge variant="outline">{user.name || "-"}</Badge>
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* New Password */}
          <div className="space-y-2">
            <Label htmlFor="new-password">새 비밀번호</Label>
            <div className="relative">
              <Input
                id="new-password"
                type={showPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="새 비밀번호 입력"
                disabled={isSubmitting}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </div>
          </div>

          {/* Password Requirements */}
          {newPassword.length > 0 && (
            <div className="grid grid-cols-2 gap-1.5 p-3 rounded-lg bg-muted/50">
              <RequirementIndicator met={hasMinLength} label="8자 이상" />
              <RequirementIndicator met={hasUppercase} label="대문자 포함" />
              <RequirementIndicator met={hasLowercase} label="소문자 포함" />
              <RequirementIndicator met={hasNumber} label="숫자 포함" />
              <RequirementIndicator met={hasSpecial} label="특수문자 포함" />
            </div>
          )}

          {/* Confirm Password */}
          <div className="space-y-2">
            <Label htmlFor="confirm-password">비밀번호 확인</Label>
            <div className="relative">
              <Input
                id="confirm-password"
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="비밀번호 다시 입력"
                disabled={isSubmitting}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                tabIndex={-1}
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </div>
            {confirmPassword.length > 0 && !passwordsMatch && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                비밀번호가 일치하지 않습니다.
              </p>
            )}
            {passwordsMatch && (
              <p className="text-xs text-green-600 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                비밀번호가 일치합니다.
              </p>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30">
              <p className="text-sm text-destructive flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                {error}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isSubmitting}
          >
            취소
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="gap-1.5"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Lock className="h-4 w-4" />
            )}
            비밀번호 초기화
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
