"use client"

import { Suspense, useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Sparkles, Loader2, AlertCircle, ArrowLeft, Lock, User, Mail, Users, CheckCircle2, XCircle } from "lucide-react"
import { motion } from "framer-motion"
import { useAuth } from "@/components/auth/auth-provider"
import { register, checkDuplicate } from "@/lib/auth"
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

// debounce 함수
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debouncedValue
}

function RegisterForm() {
  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [passwordConfirm, setPasswordConfirm] = useState("")
  const [name, setName] = useState("")
  const [teamName, setTeamName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // 중복 체크 상태
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'duplicate'>('idle')
  const [emailStatus, setEmailStatus] = useState<'idle' | 'checking' | 'available' | 'duplicate' | 'invalid_domain'>('idle')

  const { isAuthenticated, isLoading } = useAuth()
  const router = useRouter()

  // debounced values
  const debouncedUsername = useDebounce(username, 500)
  const debouncedEmail = useDebounce(email, 500)

  // 이미 로그인된 경우 리다이렉트
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push("/")
    }
  }, [isAuthenticated, isLoading, router])

  // 아이디 중복 체크
  useEffect(() => {
    if (debouncedUsername.length >= 4) {
      setUsernameStatus('checking')
      checkDuplicate('username', debouncedUsername)
        .then(result => {
          setUsernameStatus(result.is_duplicate ? 'duplicate' : 'available')
        })
        .catch(() => {
          setUsernameStatus('idle')
        })
    } else {
      setUsernameStatus('idle')
    }
  }, [debouncedUsername])

  // 이메일 중복 체크
  useEffect(() => {
    if (debouncedEmail.includes('@')) {
      // 도메인 체크
      const domain = debouncedEmail.split('@')[1]?.toLowerCase()
      if (domain && domain !== 'kca.kr') {
        setEmailStatus('invalid_domain')
        return
      }

      setEmailStatus('checking')
      checkDuplicate('email', debouncedEmail)
        .then(result => {
          setEmailStatus(result.is_duplicate ? 'duplicate' : 'available')
        })
        .catch(() => {
          setEmailStatus('idle')
        })
    } else {
      setEmailStatus('idle')
    }
  }, [debouncedEmail])

  // 비밀번호 강도 체크
  const getPasswordStrength = useCallback((pwd: string) => {
    if (!pwd) return { score: 0, label: '', color: '' }

    let score = 0
    if (pwd.length >= 8) score++
    if (/[A-Z]/.test(pwd)) score++
    if (/[a-z]/.test(pwd)) score++
    if (/\d/.test(pwd)) score++
    if (/[!@#$%^&*(),.?":{}|<>]/.test(pwd)) score++

    if (score <= 2) return { score, label: '약함', color: 'text-red-500' }
    if (score <= 3) return { score, label: '보통', color: 'text-yellow-500' }
    if (score <= 4) return { score, label: '강함', color: 'text-green-500' }
    return { score, label: '매우 강함', color: 'text-green-600' }
  }, [])

  const passwordStrength = getPasswordStrength(password)
  const passwordsMatch = password && passwordConfirm && password === passwordConfirm

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      await register({
        username,
        email,
        password,
        password_confirm: passwordConfirm,
        name,
        team_name: teamName || undefined,
      })
      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "회원가입에 실패했습니다.")
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

  // 가입 성공 화면
  if (success) {
    return (
      <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-background" />
        </div>

        <div className="relative z-10 w-full max-w-md px-6">
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.6 }}
          >
            <Card className="border-0 shadow-2xl bg-background/60 backdrop-blur-xl overflow-hidden">
              <CardHeader className="text-center pb-2 pt-8">
                <div className="flex justify-center mb-6">
                  <div className="p-4 rounded-full bg-green-100 dark:bg-green-900/30">
                    <CheckCircle2 className="h-12 w-12 text-green-600 dark:text-green-400" />
                  </div>
                </div>
                <CardTitle className="text-2xl font-bold">회원가입 완료</CardTitle>
                <CardDescription className="text-muted-foreground mt-2">
                  관리자 승인 후 로그인할 수 있습니다.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6 pb-8 px-8">
                <p className="text-sm text-muted-foreground text-center mb-6">
                  가입 신청이 완료되었습니다.<br />
                  관리자가 승인하면 이메일로 안내드리겠습니다.
                </p>
                <Button
                  onClick={() => router.push("/login")}
                  className="w-full"
                >
                  로그인 페이지로 이동
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    )
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
      <div className="relative z-10 w-full max-w-2xl px-6">
        {/* Back to Home */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-4"
        >
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group"
          >
            <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
            <span>홈으로 돌아가기</span>
          </Link>
        </motion.div>

        {/* Register Card */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <Card className="border-0 shadow-2xl bg-background/60 backdrop-blur-xl overflow-hidden">
            {/* Gradient Border Effect */}
            <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-[color:var(--chart-1)]/20 via-transparent to-[color:var(--chart-3)]/20 pointer-events-none" />

            <CardHeader className="text-center pb-2 pt-6 relative">
              {/* Animated Logo */}
              <motion.div
                className="flex justify-center mb-4"
                whileHover={{ scale: 1.05 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-r from-[color:var(--chart-1)] to-[color:var(--chart-3)] rounded-xl blur-lg opacity-30 group-hover:opacity-50 transition-opacity" />
                  <div className="relative p-3 rounded-xl bg-gradient-to-br from-[color:var(--chart-1)]/10 to-[color:var(--chart-3)]/10 border border-[color:var(--chart-1)]/20">
                    <Sparkles className="h-8 w-8 text-[color:var(--chart-1)] relative z-10" />
                  </div>
                </div>
              </motion.div>

              <CardTitle className="text-xl font-bold">
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
                  회원가입
                </span>
              </CardTitle>
              <CardDescription className="text-muted-foreground mt-1 text-sm">
                KCA-RAG 서비스에 가입하세요
              </CardDescription>
            </CardHeader>

            <CardContent className="pt-4 pb-6 px-6 relative">
              <form onSubmit={handleSubmit} className="space-y-4">
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

                {/* 2-column grid */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Username */}
                  <div className="space-y-1.5">
                    <Label htmlFor="username" className="text-sm font-medium">
                      아이디
                    </Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="username"
                        type="text"
                        placeholder="4자 이상, 영문/숫자/_"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                        disabled={isSubmitting}
                        autoComplete="username"
                        autoFocus
                        className="pl-10 pr-10 h-10 bg-background/50 border-border/50 focus:border-[color:var(--chart-1)] focus:ring-[color:var(--chart-1)]/20 transition-colors"
                      />
                      {usernameStatus === 'checking' && (
                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                      )}
                      {usernameStatus === 'available' && (
                        <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
                      )}
                      {usernameStatus === 'duplicate' && (
                        <XCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-red-500" />
                      )}
                    </div>
                    {usernameStatus === 'duplicate' && (
                      <p className="text-xs text-red-500">이미 사용 중인 아이디입니다.</p>
                    )}
                  </div>

                  {/* Email */}
                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-sm font-medium">
                      이메일 <span className="text-xs text-muted-foreground">(@kca.kr)</span>
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="example@kca.kr"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        disabled={isSubmitting}
                        autoComplete="email"
                        className="pl-10 pr-10 h-10 bg-background/50 border-border/50 focus:border-[color:var(--chart-1)] focus:ring-[color:var(--chart-1)]/20 transition-colors"
                      />
                      {emailStatus === 'checking' && (
                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                      )}
                      {emailStatus === 'available' && (
                        <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
                      )}
                      {(emailStatus === 'duplicate' || emailStatus === 'invalid_domain') && (
                        <XCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-red-500" />
                      )}
                    </div>
                    {emailStatus === 'duplicate' && (
                      <p className="text-xs text-red-500">이미 사용 중인 이메일입니다.</p>
                    )}
                    {emailStatus === 'invalid_domain' && (
                      <p className="text-xs text-red-500">@kca.kr 도메인만 사용 가능합니다.</p>
                    )}
                  </div>

                  {/* Password */}
                  <div className="space-y-1.5">
                    <Label htmlFor="password" className="text-sm font-medium">
                      비밀번호
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="password"
                        type="password"
                        placeholder="8자 이상"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        disabled={isSubmitting}
                        autoComplete="new-password"
                        className="pl-10 h-10 bg-background/50 border-border/50 focus:border-[color:var(--chart-1)] focus:ring-[color:var(--chart-1)]/20 transition-colors"
                      />
                    </div>
                    {password && (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all ${
                              passwordStrength.score <= 2 ? 'bg-red-500' :
                              passwordStrength.score <= 3 ? 'bg-yellow-500' :
                              'bg-green-500'
                            }`}
                            style={{ width: `${(passwordStrength.score / 5) * 100}%` }}
                          />
                        </div>
                        <span className={`text-xs ${passwordStrength.color}`}>
                          {passwordStrength.label}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Password Confirm */}
                  <div className="space-y-1.5">
                    <Label htmlFor="passwordConfirm" className="text-sm font-medium">
                      비밀번호 확인
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="passwordConfirm"
                        type="password"
                        placeholder="비밀번호 재입력"
                        value={passwordConfirm}
                        onChange={(e) => setPasswordConfirm(e.target.value)}
                        required
                        disabled={isSubmitting}
                        autoComplete="new-password"
                        className="pl-10 pr-10 h-10 bg-background/50 border-border/50 focus:border-[color:var(--chart-1)] focus:ring-[color:var(--chart-1)]/20 transition-colors"
                      />
                      {passwordConfirm && (
                        passwordsMatch ? (
                          <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-red-500" />
                        )
                      )}
                    </div>
                    {passwordConfirm && !passwordsMatch && (
                      <p className="text-xs text-red-500">비밀번호가 일치하지 않습니다.</p>
                    )}
                  </div>

                  {/* Name */}
                  <div className="space-y-1.5">
                    <Label htmlFor="name" className="text-sm font-medium">
                      이름
                    </Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="name"
                        type="text"
                        placeholder="실명"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        disabled={isSubmitting}
                        autoComplete="name"
                        className="pl-10 h-10 bg-background/50 border-border/50 focus:border-[color:var(--chart-1)] focus:ring-[color:var(--chart-1)]/20 transition-colors"
                      />
                    </div>
                  </div>

                  {/* Team Name */}
                  <div className="space-y-1.5">
                    <Label htmlFor="teamName" className="text-sm font-medium">
                      팀명 <span className="text-muted-foreground text-xs">(선택)</span>
                    </Label>
                    <div className="relative">
                      <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="teamName"
                        type="text"
                        placeholder="소속 팀"
                        value={teamName}
                        onChange={(e) => setTeamName(e.target.value)}
                        disabled={isSubmitting}
                        className="pl-10 h-10 bg-background/50 border-border/50 focus:border-[color:var(--chart-1)] focus:ring-[color:var(--chart-1)]/20 transition-colors"
                      />
                    </div>
                  </div>
                </div>

                {/* Submit Button */}
                <motion.div
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                >
                  <Button
                    type="submit"
                    className="w-full h-10 bg-gradient-to-r from-[color:var(--chart-1)] to-[color:var(--chart-2)] hover:opacity-90 text-white font-semibold shadow-lg shadow-[color:var(--chart-1)]/20 hover:shadow-[color:var(--chart-1)]/40 transition-all border-0"
                    disabled={
                      isSubmitting ||
                      !username ||
                      !email ||
                      !password ||
                      !passwordConfirm ||
                      !name ||
                      !passwordsMatch ||
                      usernameStatus === 'duplicate' ||
                      emailStatus === 'duplicate' ||
                      emailStatus === 'invalid_domain'
                    }
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        가입 중...
                      </>
                    ) : (
                      "회원가입"
                    )}
                  </Button>
                </motion.div>

                {/* Login Link */}
                <div className="text-center text-sm">
                  <span className="text-muted-foreground">이미 계정이 있으신가요? </span>
                  <Link
                    href="/login"
                    className="text-[color:var(--chart-1)] hover:underline font-medium"
                  >
                    로그인
                  </Link>
                </div>
              </form>
            </CardContent>
          </Card>
        </motion.div>

        {/* Footer */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-4 text-center text-xs text-muted-foreground"
        >
          관리자 승인 후 서비스를 이용할 수 있습니다.
        </motion.p>
      </div>
    </div>
  )
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen w-full items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <RegisterForm />
    </Suspense>
  )
}
