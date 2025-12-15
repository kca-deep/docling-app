"use client"

import { Suspense, useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Sparkles, Loader2, AlertCircle, ArrowLeft, Lock, User } from "lucide-react"
import { motion } from "framer-motion"
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
      // errorCode를 확인하여 상태별 메시지 표시
      const error = err as Error & { errorCode?: string }
      if (error.errorCode === "PENDING_APPROVAL") {
        setError("가입 승인 대기 중입니다. 관리자 승인 후 로그인할 수 있습니다.")
      } else if (error.errorCode === "REJECTED") {
        setError("가입이 거절되었습니다. 관리자에게 문의하세요.")
      } else {
        setError(error.message || "로그인에 실패했습니다.")
      }
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
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-background" />

        {/* Dynamic Mesh Gradient */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.5 }}
          className="absolute inset-0 overflow-hidden"
        >
          <motion.div
            animate={{
              scale: [1, 1.2, 1],
              rotate: [0, 90, 0],
              x: [0, -100, 0],
              y: [0, -50, 0],
            }}
            transition={{
              duration: 20,
              repeat: Infinity,
              repeatType: "reverse",
              ease: "easeInOut"
            }}
            className="absolute -top-[50%] -left-[50%] w-[200%] h-[200%] bg-[radial-gradient(circle_farthest-corner_at_center,var(--chart-1)_0%,transparent_50%)] opacity-20 dark:opacity-30 blur-[100px]"
          />
          <motion.div
            animate={{
              scale: [1, 1.2, 1],
              rotate: [0, -90, 0],
              x: [0, 100, 0],
              y: [0, 50, 0],
            }}
            transition={{
              duration: 25,
              repeat: Infinity,
              repeatType: "reverse",
              ease: "easeInOut",
              delay: 2
            }}
            className="absolute -bottom-[50%] -right-[50%] w-[200%] h-[200%] bg-[radial-gradient(circle_farthest-corner_at_center,var(--chart-3)_0%,transparent_50%)] opacity-20 dark:opacity-30 blur-[100px]"
          />
        </motion.div>

        {/* Dot pattern overlay */}
        <div
          className="absolute inset-0 opacity-20 dark:opacity-10"
          style={{
            backgroundImage: 'radial-gradient(circle, hsl(var(--foreground) / 0.3) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
            maskImage: 'radial-gradient(circle at center, black, transparent 80%)'
          }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 w-full max-w-md px-6">
        {/* Back to Home */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group"
          >
            <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
            <span>홈으로 돌아가기</span>
          </Link>
        </motion.div>

        {/* Login Card */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <Card className="border-0 shadow-2xl bg-background/60 backdrop-blur-xl overflow-hidden">
            {/* Gradient Border Effect */}
            <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-[color:var(--chart-1)]/20 via-transparent to-[color:var(--chart-3)]/20 pointer-events-none" />

            <CardHeader className="text-center pb-2 pt-8 relative">
              {/* Animated Logo */}
              <motion.div
                className="flex justify-center mb-6"
                whileHover={{ scale: 1.05 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-r from-[color:var(--chart-1)] to-[color:var(--chart-3)] rounded-2xl blur-xl opacity-30 group-hover:opacity-50 transition-opacity" />
                  <div className="relative p-4 rounded-2xl bg-gradient-to-br from-[color:var(--chart-1)]/10 to-[color:var(--chart-3)]/10 border border-[color:var(--chart-1)]/20">
                    {/* Shine Effect */}
                    <motion.div
                      className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-transparent via-white/20 to-transparent"
                      animate={{ x: ["-100%", "200%"] }}
                      transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                    />
                    <Sparkles className="h-10 w-10 text-[color:var(--chart-1)] relative z-10" />
                  </div>
                </div>
              </motion.div>

              <CardTitle className="text-3xl font-bold">
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
                  KCA-RAG
                </span>
              </CardTitle>
              <CardDescription className="text-muted-foreground mt-2">
                Document AI Pipeline
              </CardDescription>
            </CardHeader>

            <CardContent className="pt-6 pb-8 px-8 relative">
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Error Alert */}
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <Alert variant="destructive" className="border-destructive/50 bg-destructive/10">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  </motion.div>
                )}

                {/* Username */}
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

                {/* Password */}
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

                {/* Submit Button */}
                <motion.div
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  className="pt-2"
                >
                  <Button
                    type="submit"
                    className="w-full h-11 bg-gradient-to-r from-[color:var(--chart-1)] to-[color:var(--chart-2)] hover:opacity-90 text-white font-semibold shadow-lg shadow-[color:var(--chart-1)]/20 hover:shadow-[color:var(--chart-1)]/40 transition-all border-0"
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
                </motion.div>
              </form>

              {/* Register Link */}
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
            </CardContent>
          </Card>
        </motion.div>

        {/* Footer */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-8 text-center text-sm text-muted-foreground"
        >
          Document AI Pipeline 로그인
        </motion.p>
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
