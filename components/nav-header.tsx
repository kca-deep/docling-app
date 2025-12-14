"use client"

import Link from "next/link"
import { useState, useEffect } from "react"
import { usePathname } from "next/navigation"
import { FileText, Home, MessageSquare, Database, Sheet as SheetIcon, BarChart3, Sparkles, LogOut, LucideIcon, FolderCog, Menu, X } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { ThemeToggle } from "@/components/theme-toggle"
import { useAuth } from "@/components/auth/auth-provider"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { motion } from "framer-motion"

interface NavItem {
  href: string
  label: string
  icon: LucideIcon
  requiresAuth?: boolean
}

export function NavHeader() {
  const pathname = usePathname()
  const { isAuthenticated, isLoading, logout, user } = useAuth()
  const [isScrolled, setIsScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Scroll detection for immersive header
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10)
    }
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  // 로그인 페이지에서는 네비게이션 숨김
  if (pathname === "/login") {
    return null
  }

  const isChatPage = pathname.startsWith("/chat")

  const navItems: NavItem[] = [
    { href: "/", label: "홈", icon: Home, requiresAuth: false },
    { href: "/collections", label: "컬렉션", icon: FolderCog, requiresAuth: true },
    { href: "/parse", label: "문서변환", icon: FileText, requiresAuth: true },
    { href: "/upload", label: "문서업로드", icon: Database, requiresAuth: true },
    { href: "/excel-embedding", label: "엑셀업로드", icon: SheetIcon, requiresAuth: true },
    { href: "/chat?fullscreen=true", label: "AI챗봇", icon: MessageSquare, requiresAuth: false },
    { href: "/analytics", label: "통계", icon: BarChart3, requiresAuth: true },
  ]

  // 인증 상태에 따라 표시할 메뉴 필터링
  const visibleNavItems = navItems.filter(
    (item) => !item.requiresAuth || isAuthenticated
  )

  return (
    <header
      className={cn(
        "z-50 w-full transition-all duration-300 sticky top-0 border-b border-border/40",
        isScrolled
          ? "bg-background/60 backdrop-blur-xl border-border/40 supports-[backdrop-filter]:bg-background/60"
          : "bg-background/95 backdrop-blur-sm"
      )}
    >
      <div className="flex h-14 items-center justify-between px-4 md:px-6 max-w-7xl mx-auto">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="relative overflow-hidden p-2 rounded-lg bg-[color:var(--chart-1)]/10 border border-[color:var(--chart-1)]/20 group-hover:bg-[color:var(--chart-1)]/20 transition-all duration-300">
            <motion.div
              className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-transparent"
              animate={{ x: ["-100%", "200%"] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
            />
            <Sparkles className="h-5 w-5 text-[color:var(--chart-1)]" />
          </div>
          <div className="hidden sm:flex flex-col leading-none">
            <span className="font-bold text-base text-foreground tracking-tight">KCA-RAG</span>
            <span className="text-[10px] text-muted-foreground font-medium tracking-widest uppercase">Document AI</span>
          </div>
        </Link>



        {/* Desktop Navigation - lg 이상에서 텍스트 + 아이콘 */}
        <nav className="hidden lg:flex items-center gap-1">
          {visibleNavItems.map((item) => {
            const Icon = item.icon
            const itemPathname = item.href.split("?")[0]
            const isActive = pathname === itemPathname

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative inline-flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium transition-colors hover:text-foreground",
                  isActive ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="navbar-active"
                    className="absolute inset-0 bg-muted rounded-full -z-10"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        {/* Right: Mobile Nav + Theme Toggle + Auth */}
        <div className="flex items-center gap-2">
          {/* Tablet Navigation - sm~lg 사이에서 아이콘만 표시 */}
          <nav className="hidden sm:flex lg:hidden items-center gap-0.5">
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

          {/* Mobile Hamburger Menu - sm 미만에서 표시 */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild className="sm:hidden">
              <Button
                variant="ghost"
                size="sm"
                className="h-9 w-9 p-0"
              >
                <Menu className="h-5 w-5" />
                <span className="sr-only">메뉴 열기</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[280px] sm:w-[320px]">
              <SheetHeader className="border-b pb-4 mb-4">
                <SheetTitle className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-[color:var(--chart-1)]/10 border border-[color:var(--chart-1)]/20">
                    <Sparkles className="h-4 w-4 text-[color:var(--chart-1)]" />
                  </div>
                  <span className="font-bold">KCA-RAG</span>
                </SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-1">
                {visibleNavItems.map((item) => {
                  const Icon = item.icon
                  const itemPathname = item.href.split("?")[0]
                  const isActive = pathname === itemPathname

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
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
              {/* 모바일 메뉴 하단 인증 버튼 */}
              <div className="absolute bottom-6 left-4 right-4 border-t pt-4">
                {!isLoading && (
                  isAuthenticated ? (
                    <Button
                      variant="outline"
                      className="w-full justify-start gap-2"
                      onClick={() => {
                        logout()
                        setMobileMenuOpen(false)
                      }}
                    >
                      <LogOut className="h-4 w-4" />
                      <span>로그아웃</span>
                      {user?.username && (
                        <span className="ml-auto text-xs text-muted-foreground">
                          {user.username}
                        </span>
                      )}
                    </Button>
                  ) : (
                    <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                      <Button variant="outline" className="w-full">
                        로그인
                      </Button>
                    </Link>
                  )
                )}
              </div>
            </SheetContent>
          </Sheet>

          {/* Theme Toggle */}
          <ThemeToggle />

          {/* Auth: Login/Logout */}
          {!isLoading && (
            isAuthenticated ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => logout()}
                className="text-muted-foreground hover:text-foreground gap-1.5 rounded-full"
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
                  className="text-muted-foreground hover:text-foreground rounded-full"
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
