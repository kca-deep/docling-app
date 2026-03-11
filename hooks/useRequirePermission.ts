"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/auth/auth-provider"
import { UserPermissions } from "@/lib/auth"

/**
 * 페이지 레벨 권한 체크 훅
 * 필요한 권한이 없으면 홈으로 리다이렉트
 *
 * @returns { isReady: boolean } - 권한 확인 완료 여부 (true일 때만 페이지 렌더링)
 */
export function useRequirePermission(
  category: keyof UserPermissions,
  action: string
): { isReady: boolean } {
  const { isAuthenticated, isLoading, hasPermission, user } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (isLoading) return

    if (!isAuthenticated) {
      return // auth-provider의 PROTECTED_ROUTES에서 처리
    }

    // admin은 항상 허용
    if (user?.role === "admin") return

    if (!hasPermission(category, action)) {
      router.replace("/")
    }
  }, [isLoading, isAuthenticated, user, hasPermission, category, action, router])

  if (isLoading) return { isReady: false }
  if (!isAuthenticated) return { isReady: false }
  if (user?.role === "admin") return { isReady: true }

  return { isReady: hasPermission(category, action) }
}
