"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Loader2, AlertCircle, Lock, User, Mail, Users, CheckCircle2, XCircle } from "lucide-react"
import { useAuth } from "@/components/auth/auth-provider"
import { register, checkDuplicate } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

// debounce 함수
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debouncedValue
}

/**
 * 가입 성공 화면 컴포넌트
 */
function RegisterSuccess({ onNavigateToLogin }: { onNavigateToLogin: () => void }) {
  return (
    <Card className="border shadow-xl bg-background overflow-hidden">
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
          onClick={onNavigateToLogin}
          className="w-full bg-gradient-to-r from-[color:var(--chart-1)] to-[color:var(--chart-2)] hover:opacity-90 text-white font-semibold shadow-lg shadow-[color:var(--chart-1)]/20 border-0"
        >
          로그인 페이지로 이동
        </Button>
      </CardContent>
    </Card>
  )
}

/**
 * 회원가입 폼 컴포넌트
 */
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

  const { isAuthenticated } = useAuth()
  const router = useRouter()

  // debounced values
  const debouncedUsername = useDebounce(username, 500)
  const debouncedEmail = useDebounce(email, 500)

  // 이미 로그인된 경우 리다이렉트
  useEffect(() => {
    if (isAuthenticated) {
      router.push("/")
    }
  }, [isAuthenticated, router])

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
  const passwordStrength = useMemo(() => {
    if (!password) return { score: 0, label: '', color: '' }

    let score = 0
    if (password.length >= 8) score++
    if (/[A-Z]/.test(password)) score++
    if (/[a-z]/.test(password)) score++
    if (/\d/.test(password)) score++
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score++

    if (score <= 2) return { score, label: '약함', color: 'text-red-500' }
    if (score <= 3) return { score, label: '보통', color: 'text-yellow-500' }
    if (score <= 4) return { score, label: '강함', color: 'text-green-500' }
    return { score, label: '매우 강함', color: 'text-green-600' }
  }, [password])

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

  // 이미 로그인된 경우 로딩 표시
  if (isAuthenticated) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // 가입 성공 화면
  if (success) {
    return <RegisterSuccess onNavigateToLogin={() => router.push("/login")} />
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <Alert variant="destructive" className="border-destructive/50 bg-destructive/10">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

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

      <div>
        <Button
          type="submit"
          className="w-full h-10 bg-gradient-to-r from-[color:var(--chart-1)] to-[color:var(--chart-2)] hover:opacity-90 text-white font-semibold shadow-lg shadow-[color:var(--chart-1)]/20 border-0"
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
      </div>

      <div className="text-center text-sm">
        <span className="text-muted-foreground">이미 계정이 있으신가요? </span>
        <Link
          href="/login"
          className="text-[color:var(--chart-1)] hover:text-[color:var(--chart-2)] transition-colors font-medium"
        >
          로그인
        </Link>
      </div>
    </form>
  )
}

/**
 * Export Wrapper
 */
export function RegisterFormWrapper() {
  return <RegisterForm />
}
