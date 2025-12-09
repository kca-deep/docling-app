"use client"

import { Suspense, useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Sparkles, Loader2, AlertCircle } from "lucide-react"
import { useAuth } from "@/components/auth/auth-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"

function LoginForm() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { login, isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()

  // redirect 파라미터 검증 함수 (보안 강화)
  const getSafeRedirect = (redirectParam: string | null): string => {
    if (!redirectParam) return "/"

    // 허용된 경로만 리다이렉트 (상대 경로, 슬래시로 시작)
    // 외부 URL, 프로토콜, 악성 문자열 차단
    const dangerousPatterns = [
      /^https?:\/\//i,           // http://, https://
      /^\/\//,                   // protocol-relative URL
      /[<>'"`;|&$(){}[\]]/,      // 특수문자 차단
      /\bwget\b/i,               // wget 명령
      /\bcurl\b/i,               // curl 명령
      /\bsh\b/i,                 // sh 명령
      /\bbash\b/i,               // bash 명령
      /\bexec\b/i,               // exec
      /\beval\b/i,               // eval
      /\bspawn\b/i,              // spawn
      /%[0-9a-f]{2}/i,           // URL 인코딩된 문자
      /\\/,                      // 백슬래시
      /\n|\r/,                   // 줄바꿈
    ]

    for (const pattern of dangerousPatterns) {
      if (pattern.test(redirectParam)) {
        console.warn(`[SECURITY] Blocked malicious redirect: ${redirectParam}`)
        return "/"
      }
    }

    // 슬래시로 시작하는 상대 경로만 허용
    if (!redirectParam.startsWith("/")) {
      return "/"
    }

    return redirectParam
  }

  // 이미 로그인된 경우 리다이렉트
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      const redirect = getSafeRedirect(searchParams.get("redirect"))
      router.push(redirect)
    }
  }, [isAuthenticated, isLoading, router, searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      await login({ username, password })

      // 로그인 성공 시 리다이렉트 (검증된 경로만)
      const redirect = getSafeRedirect(searchParams.get("redirect"))
      router.push(redirect)
    } catch (err) {
      setError(err instanceof Error ? err.message : "로그인에 실패했습니다.")
    } finally {
      setIsSubmitting(false)
    }
  }

  // 인증 상태 확인 중
  if (isLoading) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // 이미 로그인된 경우 빈 화면 (리다이렉트 중)
  if (isAuthenticated) {
    return null
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-gradient-to-br from-[color:var(--chart-1)]/5 via-background to-[color:var(--chart-3)]/5 p-6">
      <div className="w-full max-w-sm">
        <Card className="shadow-lg border-2">
          <CardHeader className="text-center pb-2">
            {/* Logo */}
            <div className="flex justify-center mb-4">
              <div className="p-4 rounded-xl bg-[color:var(--chart-1)]/10 border-2 border-[color:var(--chart-1)]/20">
                <Sparkles className="h-8 w-8 text-[color:var(--chart-1)]" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold text-foreground">
              KCA-RAG
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Document AI Pipeline
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Error Alert */}
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Username */}
              <div className="space-y-2">
                <Label htmlFor="username">사용자명</Label>
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
                />
              </div>

              {/* Password */}
              <div className="space-y-2">
                <Label htmlFor="password">비밀번호</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="********"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isSubmitting}
                  autoComplete="current-password"
                />
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full bg-[color:var(--chart-1)] hover:bg-[color:var(--chart-1)]/90 text-white"
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
            </form>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="mt-4 text-center text-sm text-muted-foreground">
          관리자 로그인
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen w-full items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  )
}
