"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { FileText, Home, MessageSquare, Database, Sheet, BarChart3, Layers, LogOut, LucideIcon } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"
import { useAuth } from "@/components/auth/auth-provider"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface NavItem {
  href: string
  label: string
  icon: LucideIcon
  requiresAuth?: boolean
}

export function NavHeader() {
  const pathname = usePathname()
  const { isAuthenticated, isLoading, logout, user } = useAuth()

  // 로그인 페이지에서는 네비게이션 숨김
  if (pathname === "/login") {
    return null
  }

  const navItems: NavItem[] = [
    { href: "/", label: "홈", icon: Home, requiresAuth: false },
    { href: "/parse", label: "문서 파싱", icon: FileText, requiresAuth: true },
    { href: "/upload", label: "벡터 업로드", icon: Database, requiresAuth: true },
    { href: "/excel-embedding", label: "엑셀 임베딩", icon: Sheet, requiresAuth: true },
    { href: "/chat?fullscreen=true", label: "AI 챗봇", icon: MessageSquare, requiresAuth: false },
    { href: "/analytics", label: "사용 통계", icon: BarChart3, requiresAuth: true },
  ]

  // 인증 상태에 따라 표시할 메뉴 필터링
  const visibleNavItems = navItems.filter(
    (item) => !item.requiresAuth || isAuthenticated
  )

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-12 items-center justify-between px-4 md:px-6 max-w-7xl mx-auto">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <div
            className="p-1.5 rounded-md bg-gradient-to-br from-blue-500 to-indigo-600 shadow-sm group-hover:shadow-md transition-all duration-300"
          >
            <Layers className="h-4 w-4 text-white" />
          </div>
          <span className="hidden sm:inline font-semibold text-base bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent group-hover:from-blue-500 group-hover:to-purple-500 transition-all duration-300">
            KCA-RAG
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-1">
          {visibleNavItems.map((item) => {
            const Icon = item.icon
            const itemPathname = item.href.split("?")[0]
            const isActive = pathname === itemPathname

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                  isActive
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        {/* Right: Mobile Nav + Theme Toggle + Auth */}
        <div className="flex items-center gap-1">
          {/* Mobile Navigation */}
          <nav className="md:hidden flex items-center gap-0.5">
            {visibleNavItems.map((item) => {
              const Icon = item.icon
              const itemPathname = item.href.split("?")[0]
              const isActive = pathname === itemPathname

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "inline-flex items-center justify-center h-9 w-9 rounded-md transition-colors",
                    isActive
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  )}
                  title={item.label}
                >
                  <Icon className="h-4 w-4" />
                  <span className="sr-only">{item.label}</span>
                </Link>
              )
            })}
          </nav>

          {/* Theme Toggle */}
          <ThemeToggle />

          {/* Auth: Login/Logout */}
          {!isLoading && (
            isAuthenticated ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => logout()}
                className="text-muted-foreground hover:text-foreground gap-1.5"
                title={`${user?.username} 로그아웃`}
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">로그아웃</span>
              </Button>
            ) : (
              <Link href="/login">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-foreground"
                >
                  로그인
                </Button>
              </Link>
            )
          )}
        </div>
      </div>
    </header>
  )
}
