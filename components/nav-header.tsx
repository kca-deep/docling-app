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
  LogOut,
  LucideIcon,
  FolderCog,
  Menu,
  Users,
  ChevronDown,
  Settings,
  FileStack,
  Lightbulb,
  Shield,
  History,
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
  badge?: number
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
  const [pendingCount, setPendingCount] = useState(0)

  // Scroll detection for immersive header
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10)
    }
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  // 관리자일 때 승인 대기 사용자 수 조회
  useEffect(() => {
    if (user?.role === "admin") {
      fetch("http://localhost:8000/api/auth/pending-count", {
        credentials: "include"
      })
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data?.pending_count !== undefined) {
            setPendingCount(data.pending_count)
          }
        })
        .catch(() => {})
    } else {
      setPendingCount(0)
    }
  }, [user?.role, pathname])

  // 로그인/회원가입 페이지에서는 네비게이션 숨김
  if (pathname === "/login" || pathname === "/register") {
    return null
  }

  // 단일 메뉴 아이템
  const singleItems: NavItem[] = [
    { href: "/", label: "홈", icon: Home, requiresAuth: false },
  ]

  // AI Idea Hub 그룹 (AI챗봇 앞에 위치)
  const ideaHubGroup: NavGroup = {
    label: "AI Idea Hub",
    icon: Lightbulb,
    requiresAuth: false,
    items: [
      { href: "/idea-hub", label: "셀프진단", icon: Shield, requiresAuth: false },
      { href: "/idea-hub/history", label: "진단 이력", icon: History, requiresAuth: true },
    ],
  }

  // KCA-i 챗봇 아이템
  const chatItem: NavItem = { href: "/chat?fullscreen=true", label: "KCA-i", icon: MessageSquare, requiresAuth: false }

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
      { href: "/admin/users", label: "사용자 관리", icon: Users, requiresAuth: true, adminOnly: true, badge: pendingCount > 0 ? pendingCount : undefined },
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
        {/* Logo - 오션 블루 배지 + 그라디언트 Black 이탤릭 */}
        <Link href="/" className="flex items-center gap-2.5 group shrink-0">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-[#06b6d4] via-[#3b82f6] to-[#1e3a8a] hover:opacity-90 transition-opacity shadow-lg shadow-cyan-500/30">
            <img
              src="/logo/kca_small.png"
              alt="KCA"
              className="h-7 w-auto brightness-0 invert"
            />
          </div>
          <span className="text-xl font-black italic tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-[#0066cc] via-[#00a651] to-[#ed1c24] pr-0.5">AI-Hub</span>
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

          {/* KCA-i 챗봇 - ChatHeader 스타일 적용 */}
          {(() => {
            const itemPathname = chatItem.href.split("?")[0]
            const isActive = pathname === itemPathname || pathname.startsWith("/chat")
            return (
              <Link
                href={chatItem.href}
                className={cn(
                  "relative inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium transition-colors hover:text-foreground",
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
                {/* KCA-i 로고 스타일 */}
                <span className="font-extrabold tracking-tight">
                  KCA
                  <span className="text-primary">-</span>
                  <span className="italic text-emerald-500">i</span>
                </span>
              </Link>
            )
          })()}

          {/* AI Idea Hub 드롭다운 */}
          {shouldShowGroup(ideaHubGroup) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    "relative inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium transition-colors hover:text-foreground outline-none cursor-pointer",
                    isGroupActive(ideaHubGroup) ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {isGroupActive(ideaHubGroup) && (
                    <motion.div
                      layoutId="navbar-active"
                      className="absolute inset-0 bg-muted rounded-full -z-10"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                  <ideaHubGroup.icon className="h-4 w-4" />
                  <span>{ideaHubGroup.label}</span>
                  <ChevronDown className="h-3 w-3 opacity-60" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                {filterItems(ideaHubGroup.items).map((item) => {
                  const Icon = item.icon
                  const itemPathname = item.href.split("?")[0]
                  const isActive = pathname === itemPathname || pathname.startsWith(`${itemPathname}/`)
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

          {/* 문서 드롭다운 */}
          {shouldShowGroup(documentGroup) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    "relative inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium transition-colors hover:text-foreground outline-none cursor-pointer",
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

          {/* 설정 드롭다운 */}
          {shouldShowGroup(settingsGroup) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    "relative inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium transition-colors hover:text-foreground outline-none cursor-pointer",
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
                            "flex items-center gap-2 cursor-pointer w-full",
                            isActive && "bg-muted"
                          )}
                        >
                          <Icon className="h-4 w-4" />
                          <span>{item.label}</span>
                          {item.badge && item.badge > 0 && (
                            <span className="ml-auto px-1.5 py-0.5 text-xs font-medium bg-yellow-500 text-white rounded-full min-w-[1.25rem] text-center">
                              {item.badge}
                            </span>
                          )}
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
                <SheetTitle className="flex items-center gap-2.5">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-[#06b6d4] via-[#3b82f6] to-[#1e3a8a] shadow-lg shadow-cyan-500/30">
                    <img
                      src="/logo/kca_small.png"
                      alt="KCA"
                      className="h-7 w-auto brightness-0 invert"
                    />
                  </div>
                  <span className="text-xl font-black italic tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-[#0066cc] via-[#00a651] to-[#ed1c24] pr-0.5">AI-Hub</span>
                </SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-1">
                {/* 홈 */}
                {visibleSingleItems.map((item) => {
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

                {/* KCA-i 챗봇 - ChatHeader 스타일 적용 */}
                {(() => {
                  const itemPathname = chatItem.href.split("?")[0]
                  const isActive = pathname === itemPathname || pathname.startsWith("/chat")
                  return (
                    <Link
                      href={chatItem.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                        isActive
                          ? "bg-muted text-foreground"
                          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                      )}
                    >
                      {/* KCA-i 로고 스타일 */}
                      <span className="font-extrabold tracking-tight">
                        KCA
                        <span className="text-primary">-</span>
                        <span className="italic text-emerald-500">i</span>
                      </span>
                    </Link>
                  )
                })()}

                {/* AI Idea Hub 그룹 */}
                {shouldShowGroup(ideaHubGroup) && (
                  <>
                    <div className="px-3 py-2 mt-2">
                      <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                        <ideaHubGroup.icon className="h-4 w-4" />
                        {ideaHubGroup.label}
                      </p>
                    </div>
                    {filterItems(ideaHubGroup.items).map((item) => {
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
                          {item.badge && item.badge > 0 && (
                            <span className="ml-auto px-1.5 py-0.5 text-xs font-medium bg-yellow-500 text-white rounded-full min-w-[1.25rem] text-center">
                              {item.badge}
                            </span>
                          )}
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
                className="text-muted-foreground hover:text-foreground gap-1.5 rounded-full cursor-pointer"
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
                  className="text-muted-foreground hover:text-foreground rounded-full cursor-pointer"
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
