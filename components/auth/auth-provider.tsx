"use client"

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from "react"
import { useRouter, usePathname } from "next/navigation"
import {
  User,
  UserPermissions,
  AuthStatus,
  LoginCredentials,
  login as apiLogin,
  logout as apiLogout,
  verifyAuth,
  getMyPermissions,
  hasPermission as checkPermission,
  getDefaultPermissions,
  getAdminPermissions,
} from "@/lib/auth"

// === 타입 정의 ===

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  isGuest: boolean
  permissions: UserPermissions | null
  login: (credentials: LoginCredentials) => Promise<void>
  logout: () => Promise<void>
  checkAuth: () => Promise<void>
  hasPermission: (category: keyof UserPermissions, action: string) => boolean
}

// === Context 생성 ===

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// === 보호된 경로 목록 ===
const PROTECTED_ROUTES = ["/parse", "/upload", "/excel-embedding", "/analytics", "/collections", "/admin"]

// === 보안: pathname 검증 함수 ===
const sanitizePathname = (path: string): string => {
  // 위험한 패턴 차단
  const dangerousPatterns = [
    /^https?:\/\//i,           // 외부 URL
    /^\/\//,                   // protocol-relative URL
    /[<>'"`;|&$(){}[\]]/,      // 특수문자
    /%[0-9a-f]{2}/i,           // URL 인코딩된 문자
    /\\/,                      // 백슬래시
    /\n|\r/,                   // 줄바꿈
  ]

  for (const pattern of dangerousPatterns) {
    if (pattern.test(path)) {
      console.warn(`[SECURITY] Blocked malicious pathname: ${path}`)
      return "/"
    }
  }

  // 슬래시로 시작하는 상대 경로만 허용
  if (!path.startsWith("/")) {
    return "/"
  }

  return path
}

// === Provider 컴포넌트 ===

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [permissions, setPermissions] = useState<UserPermissions | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

  const isAuthenticated = user !== null
  const isGuest = !isAuthenticated

  /**
   * 인증 상태 확인
   */
  const checkAuth = useCallback(async () => {
    try {
      setIsLoading(true)
      const status: AuthStatus = await verifyAuth()

      if (status.authenticated && status.user) {
        setUser(status.user)

        // 권한 정보 조회
        try {
          const permResponse = await getMyPermissions()
          setPermissions(permResponse.permissions)
          // 사용자 객체에도 권한 정보 추가
          setUser({ ...status.user, permissions: permResponse.permissions })
        } catch {
          // 권한 조회 실패 시 기본값 사용
          const defaultPerms = status.user.role === 'admin'
            ? getAdminPermissions()
            : getDefaultPermissions()
          setPermissions(defaultPerms)
          setUser({ ...status.user, permissions: defaultPerms })
        }
      } else {
        setUser(null)
        setPermissions(null)
      }
    } catch (error) {
      console.error("Auth check failed:", error)
      setUser(null)
      setPermissions(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * 로그인
   */
  const login = useCallback(async (credentials: LoginCredentials) => {
    const loggedInUser = await apiLogin(credentials)
    setUser(loggedInUser)

    // 로그인 후 권한 정보 조회
    try {
      const permResponse = await getMyPermissions()
      setPermissions(permResponse.permissions)
      setUser({ ...loggedInUser, permissions: permResponse.permissions })
    } catch {
      const defaultPerms = loggedInUser.role === 'admin'
        ? getAdminPermissions()
        : getDefaultPermissions()
      setPermissions(defaultPerms)
      setUser({ ...loggedInUser, permissions: defaultPerms })
    }
  }, [])

  /**
   * 로그아웃
   */
  const logout = useCallback(async () => {
    try {
      await apiLogout()
    } finally {
      setUser(null)
      setPermissions(null)
      router.push("/login")
    }
  }, [router])

  /**
   * 권한 확인
   */
  const hasPermission = useCallback((category: keyof UserPermissions, action: string): boolean => {
    return checkPermission(user, category, action)
  }, [user])

  /**
   * 초기 인증 상태 확인
   */
  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  /**
   * 보호된 경로 접근 시 리다이렉트
   */
  useEffect(() => {
    if (isLoading) return

    const isProtectedRoute = PROTECTED_ROUTES.some(
      (route) => pathname === route || pathname.startsWith(`${route}/`)
    )

    if (isProtectedRoute && !isAuthenticated) {
      const safePath = sanitizePathname(pathname)
      router.push(`/login?redirect=${encodeURIComponent(safePath)}`)
    }
  }, [pathname, isAuthenticated, isLoading, router])

  const value: AuthContextType = {
    user,
    isAuthenticated,
    isLoading,
    isGuest,
    permissions,
    login,
    logout,
    checkAuth,
    hasPermission,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// === Hook ===

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)

  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }

  return context
}

// === 보호된 경로 확인 유틸리티 ===

export function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  )
}
