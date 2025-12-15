"use client"

import Link from "next/link"
import { useState, useEffect } from "react"
import { usePathname } from "next/navigation"
import {
  FileText,
  Home,
  MessageSquare,
  Database,
  Sheet as SheetIcon,
  BarChart3,
  Sparkles,
  LogOut,
  LucideIcon,
  FolderCog,
  Menu,
  Users,
  ChevronDown,
  Settings,
  FileStack,
} from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
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
  adminOnly?: boolean
}

interface NavGroup {
  label: string
  icon: LucideIcon
  items: NavItem[]
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

  // 로그인/회원가입 페이지에서는 네비게이션 숨김
  if (pathname === "/login" || pathname === "/register") {
    return null
  }

  // 단일 메뉴 아이템
  const singleItems: NavItem[] = [
    { href: "/", label: "홈", icon: Home, requiresAuth: false },
    { href: "/chat?fullscreen=true", label: "AI챗봇", icon: MessageSquare, requiresAuth: false },
  ]

  // 문서 그룹
  const documentGroup: NavGroup = {
    label: "문서",
    icon: FileStack,
    requiresAuth: true,
    items: [
      { href: "/parse", label: "문서변환", icon: FileText, requiresAuth: true },
      { href: "/upload", label: "문서업로드", icon: Database, requiresAuth: true },
      { href: "/excel-embedding", label: "엑셀업로드", icon: SheetIcon, requiresAuth: true },
    ],
  }

  // 설정 그룹
  const settingsGroup: NavGroup = {
    label: "설정",
    icon: Settings,
    requiresAuth: true,
    items: [
      { href: "/collections", label: "컬렉션", icon: FolderCog, requiresAuth: true },
      { href: "/analytics", label: "통계", icon: BarChart3, requiresAuth: true },
      { href: "/admin/users", label: "사용자 관리", icon: Users, requiresAuth: true, adminOnly: true },
    ],
  }

  // 권한에 따라 그룹 아이템 필터링
  const filterItems = (items: NavItem[]) => {
    return items.filter((item) => {
      if (item.requiresAuth && !isAuthenticated) return false
      if (item.adminOnly && user?.role !== "admin") return false
      return true
    })
  }

  // 그룹 표시 여부 확인
  const shouldShowGroup = (group: NavGroup) => {
    if (group.requiresAuth && !isAuthenticated) return false
    return filterItems(group.items).length > 0
  }

  // 현재 경로가 그룹에 속하는지 확인
  const isGroupActive = (group: NavGroup) => {
    return group.items.some((item) => {
      const itemPathname = item.href.split("?")[0]
      return pathname === itemPathname || pathname.startsWith(`${itemPathname}/`)
    })
  }

  // 단일 아이템 필터링
  const visibleSingleItems = singleItems.filter((item) => {
    if (item.requiresAuth && !isAuthenticated) return false
    return true
  })

  // 모바일 메뉴용 전체 아이템 목록
  const allMobileItems: NavItem[] = [
    ...singleItems,
    ...documentGroup.items,
    ...settingsGroup.items,
  ].filter((item) => {
    if (item.requiresAuth && !isAuthenticated) return false
    if (item.adminOnly && user?.role !== "admin") return false
    return true
  })

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

        {/* Desktop Navigation - md 이상에서 표시 */}
        <nav className="hidden md:flex items-center gap-1">
          {/* 홈 */}
          {visibleSingleItems.filter(item => item.href === "/").map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
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

          {/* 문서 드롭다운 */}
          {shouldShowGroup(documentGroup) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    "relative inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium transition-colors hover:text-foreground outline-none",
                    isGroupActive(documentGroup) ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {isGroupActive(documentGroup) && (
                    <motion.div
                      layoutId="navbar-active"
                      className="absolute inset-0 bg-muted rounded-full -z-10"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                  <documentGroup.icon className="h-4 w-4" />
                  <span>{documentGroup.label}</span>
                  <ChevronDown className="h-3 w-3 opacity-60" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                {filterItems(documentGroup.items).map((item) => {
                  const Icon = item.icon
                  const itemPathname = item.href.split("?")[0]
                  const isActive = pathname === itemPathname
                  return (
                    <DropdownMenuItem key={item.href} asChild>
                      <Link
                        href={item.href}
                        className={cn(
                          "flex items-center gap-2 cursor-pointer",
                          isActive && "bg-muted"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </Link>
                    </DropdownMenuItem>
                  )
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* AI챗봇 */}
          {visibleSingleItems.filter(item => item.href.startsWith("/chat")).map((item) => {
            const Icon = item.icon
            const itemPathname = item.href.split("?")[0]
            const isActive = pathname === itemPathname || pathname.startsWith("/chat")
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

          {/* 설정 드롭다운 */}
          {shouldShowGroup(settingsGroup) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    "relative inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium transition-colors hover:text-foreground outline-none",
                    isGroupActive(settingsGroup) ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {isGroupActive(settingsGroup) && (
                    <motion.div
                      layoutId="navbar-active"
                      className="absolute inset-0 bg-muted rounded-full -z-10"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                  <settingsGroup.icon className="h-4 w-4" />
                  <span>{settingsGroup.label}</span>
                  <ChevronDown className="h-3 w-3 opacity-60" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                {filterItems(settingsGroup.items).map((item, index) => {
                  const Icon = item.icon
                  const itemPathname = item.href.split("?")[0]
                  const isActive = pathname === itemPathname || pathname.startsWith(`${itemPathname}/`)
                  const isAdminItem = item.adminOnly
                  const prevItem = filterItems(settingsGroup.items)[index - 1]
                  const showSeparator = isAdminItem && prevItem && !prevItem.adminOnly

                  return (
                    <div key={item.href}>
                      {showSeparator && <DropdownMenuSeparator />}
                      <DropdownMenuItem asChild>
                        <Link
                          href={item.href}
                          className={cn(
                            "flex items-center gap-2 cursor-pointer",
                            isActive && "bg-muted"
                          )}
                        >
                          <Icon className="h-4 w-4" />
                          <span>{item.label}</span>
                        </Link>
                      </DropdownMenuItem>
                    </div>
                  )
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </nav>

        {/* Right: Mobile Nav + Theme Toggle + Auth */}
        <div className="flex items-center gap-2">
          {/* Mobile Hamburger Menu - md 미만에서 표시 */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild className="md:hidden">
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
                {/* 홈 & AI챗봇 */}
                {visibleSingleItems.map((item) => {
                  const Icon = item.icon
                  const itemPathname = item.href.split("?")[0]
                  const isActive = pathname === itemPathname || (item.href.startsWith("/chat") && pathname.startsWith("/chat"))

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

                {/* 문서 그룹 */}
                {shouldShowGroup(documentGroup) && (
                  <>
                    <div className="px-3 py-2 mt-2">
                      <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                        <documentGroup.icon className="h-4 w-4" />
                        {documentGroup.label}
                      </p>
                    </div>
                    {filterItems(documentGroup.items).map((item) => {
                      const Icon = item.icon
                      const itemPathname = item.href.split("?")[0]
                      const isActive = pathname === itemPathname

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setMobileMenuOpen(false)}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ml-2",
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
                  </>
                )}

                {/* 설정 그룹 */}
                {shouldShowGroup(settingsGroup) && (
                  <>
                    <div className="px-3 py-2 mt-2">
                      <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                        <settingsGroup.icon className="h-4 w-4" />
                        {settingsGroup.label}
                      </p>
                    </div>
                    {filterItems(settingsGroup.items).map((item) => {
                      const Icon = item.icon
                      const itemPathname = item.href.split("?")[0]
                      const isActive = pathname === itemPathname || pathname.startsWith(`${itemPathname}/`)

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setMobileMenuOpen(false)}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ml-2",
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
                  </>
                )}
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
