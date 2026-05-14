"use client"

import { Suspense, useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Loader2, AlertCircle, Lock, User } from "lucide-react"
import { useAuth } from "@/components/auth/auth-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"

/**
 * 로그인 폼 컴포넌트 (useSearchParams 사용)
 */
function LoginForm() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { login, isAuthenticated } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()

  // redirect 파라미터 검증 함수 (보안 강화)
  const getSafeRedirect = (redirectParam: string | null): string => {
    if (!redirectParam) return "/"

    const dangerousPatterns = [
      /^https?:\/\//i,
      /^\/\//,
      /[<>'"`;\|&$(){}[\]]/,
      /\bwget\b/i,
      /\bcurl\b/i,
      /\bsh\b/i,
      /\bbash\b/i,
      /\bexec\b/i,
      /\beval\b/i,
      /\bspawn\b/i,
      /%[0-9a-f]{2}/i,
      /\\/,
      /\n|\r/,
    ]

    for (const pattern of dangerousPatterns) {
      if (pattern.test(redirectParam)) {
        console.warn(`[SECURITY] Blocked malicious redirect: ${redirectParam}`)
        return "/"
      }
    }

    if (!redirectParam.startsWith("/")) {
      return "/"
    }

    return redirectParam
  }

  // 이미 로그인된 경우 리다이렉트
  useEffect(() => {
    if (isAuthenticated) {
      const redirect = getSafeRedirect(searchParams.get("redirect"))
      router.push(redirect)
    }
  }, [isAuthenticated, router, searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      await login({ username, password })
      const redirect = getSafeRedirect(searchParams.get("redirect"))
      router.push(redirect)
    } catch (err) {
      const error = err as Error & { errorCode?: string }
      if (error.errorCode === "PENDING_APPROVAL") {
        setError("가입 승인 대기 중입니다. 관리자 승인 후 로그인할 수 있습니다.")
      } else if (error.errorCode === "REJECTED") {
        setError("가입이 거절되었습니다. 관리자에게 문의하세요.")
      } else if (error.errorCode === "ACCOUNT_LOCKED") {
        setError(error.message || "로그인 시도가 너무 많아 계정이 잠겼습니다. 잠시 후 다시 시도해주세요.")
      } else {
        setError(error.message || "로그인에 실패했습니다.")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  // 이미 로그인된 경우 로딩 표시
  if (isAuthenticated) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <Alert variant="destructive" className="border-destructive/50 bg-destructive/10">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="username" className="text-sm font-medium">
          사용자명
        </Label>
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="username"
            type="text"
            placeholder="admin"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            disabled={isSubmitting}
            autoComplete="username"
            autoFocus
            className="pl-10 h-11 bg-background/50 border-border/50 focus:border-[color:var(--chart-1)] focus:ring-[color:var(--chart-1)]/20 transition-colors"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="password" className="text-sm font-medium">
          비밀번호
        </Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="password"
            type="password"
            placeholder="********"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={isSubmitting}
            autoComplete="current-password"
            className="pl-10 h-11 bg-background/50 border-border/50 focus:border-[color:var(--chart-1)] focus:ring-[color:var(--chart-1)]/20 transition-colors"
          />
        </div>
      </div>

      <div className="pt-2">
        <Button
          type="submit"
          className="w-full h-11 bg-gradient-to-r from-[color:var(--chart-1)] to-[color:var(--chart-2)] hover:opacity-90 text-white font-semibold shadow-lg shadow-[color:var(--chart-1)]/20 border-0"
          disabled={isSubmitting || !username || !password}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              로그인 중...
            </>
          ) : (
            "로그인"
          )}
        </Button>
      </div>

      <div className="mt-6 pt-6 border-t border-border/50">
        <p className="text-center text-sm text-muted-foreground">
          계정이 없으신가요?{" "}
          <Link
            href="/register"
            className="font-medium text-[color:var(--chart-1)] hover:text-[color:var(--chart-2)] transition-colors"
          >
            회원가입
          </Link>
        </p>
      </div>
    </form>
  )
}

/**
 * Suspense Wrapper (useSearchParams 때문에 필요)
 */
export function LoginFormWrapper() {
  return (
    <Suspense fallback={<div className="h-[300px]" />}>
      <LoginForm />
    </Suspense>
  )
}
