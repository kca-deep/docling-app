"use client"

import Link from "next/link"
import { useState, useEffect } from "react"
import { usePathname } from "next/navigation"
import {
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
  User,
  FileText,
} from "lucide-react"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/components/auth/auth-provider"
import { UserPermissions } from "@/lib/auth"
import { cn } from "@/lib/utils"
import { API_BASE_URL } from "@/lib/api-config"
import { AnimatePresence, motion } from "framer-motion"

interface NavItem {
  href: string
  label: string
  icon: LucideIcon
  requiresAuth?: boolean
  adminOnly?: boolean
  permission?: {
    category: keyof UserPermissions
    action: string
  }
}

interface NavGroup {
  id: string
  label: string
  icon: LucideIcon
  items: NavItem[]
  requiresAuth?: boolean
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const { isAuthenticated, isLoading, logout, user, hasPermission } = useAuth()
  const [openGroups, setOpenGroups] = useState<Set<string>>(
    new Set(["ideaHub", "document", "settings"])
  )
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    if (user?.role !== "admin") {
      setPendingCount(0)
      return
    }
    const es = new EventSource(`${API_BASE_URL}/api/auth/pending-count/stream`)
    es.onmessage = (e) => {
      try {
        const d = JSON.parse(e.data)
        if (d?.pending_count !== undefined) setPendingCount(d.pending_count)
      } catch {}
    }
    es.onerror = () => {
      fetch(`${API_BASE_URL}/api/auth/pending-count`, { credentials: "include" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d?.pending_count !== undefined) setPendingCount(d.pending_count)
        })
        .catch(() => {})
    }
    return () => es.close()
  }, [user?.role])

  const chatItem: NavItem = {
    href: "/chat?collection=kca-reguration",
    label: "KCA-i",
    icon: MessageSquare,
  }

  const groups: NavGroup[] = [
    {
      id: "ideaHub",
      label: "Idea Hub",
      icon: Lightbulb,
      requiresAuth: false,
      items: [
        { href: "/idea-hub", label: "셀프진단", icon: Shield },
        {
          href: "/idea-hub/history",
          label: "진단 이력",
          icon: History,
          requiresAuth: true,
          permission: { category: "selfcheck", action: "history" },
        },
      ],
    },
    {
      id: "document",
      label: "임베딩",
      icon: FileStack,
      requiresAuth: true,
      items: [
        { href: "/parse", label: "문서변환", icon: FileText, requiresAuth: true, adminOnly: true, permission: { category: "documents", action: "parse" } },
        { href: "/upload", label: "벡터임베딩", icon: Database, requiresAuth: true, adminOnly: true, permission: { category: "qdrant", action: "upload" } },
        { href: "/excel-embedding", label: "엑셀임베딩", icon: SheetIcon, requiresAuth: true, adminOnly: true, permission: { category: "excel", action: "upload" } },
        { href: "/collections", label: "컬렉션", icon: FolderCog, requiresAuth: true, adminOnly: true, permission: { category: "qdrant", action: "collections" } },
      ],
    },
    {
      id: "settings",
      label: "설정",
      icon: Settings,
      requiresAuth: true,
      items: [
        { href: "/analytics", label: "통계", icon: BarChart3, requiresAuth: true, adminOnly: true, permission: { category: "analytics", action: "view" } },
        { href: "/admin/users", label: "사용자 관리", icon: Users, requiresAuth: true, adminOnly: true, permission: { category: "admin", action: "users" } },
      ],
    },
  ]

  const filterItems = (items: NavItem[]) =>
    items.filter((item) => {
      if (item.requiresAuth && !isAuthenticated) return false
      if (item.permission) {
        if (user?.role !== "admin" && !hasPermission(item.permission.category, item.permission.action))
          return false
      } else if (item.adminOnly && user?.role !== "admin") {
        return false
      }
      return true
    })

  const shouldShowGroup = (group: NavGroup) => {
    if (group.requiresAuth && !isAuthenticated) return false
    return filterItems(group.items).length > 0
  }

  const isItemActive = (href: string) => {
    const p = href.split("?")[0]
    return pathname === p || pathname.startsWith(`${p}/`)
  }

  const isGroupActive = (group: NavGroup) =>
    group.items.some((item) => isItemActive(item.href))

  const toggleGroup = (id: string) =>
    setOpenGroups((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {/* KCA-i */}
        <Link
          href={chatItem.href}
          onClick={onNavigate}
          className={cn(
            "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors",
            isItemActive(chatItem.href)
              ? "bg-primary/10 text-primary font-semibold"
              : "text-foreground/85 hover:bg-muted hover:text-foreground font-medium"
          )}
        >
          <MessageSquare className="h-4 w-4 flex-shrink-0" />
          <span className="font-extrabold tracking-tight">
            KCA<span className="text-primary">-</span>
            <span className="italic text-emerald-500">i</span>
          </span>
        </Link>

        {/* Groups */}
        {groups.map((group) => {
          if (!shouldShowGroup(group)) return null
          const items = filterItems(group.items)
          const isOpen = openGroups.has(group.id)
          const GroupIcon = group.icon

          return (
            <div key={group.id}>
              <button
                onClick={() => toggleGroup(group.id)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  isGroupActive(group)
                    ? "text-foreground"
                    : "text-foreground/85 hover:bg-muted hover:text-foreground"
                )}
              >
                <GroupIcon className="h-4 w-4 flex-shrink-0" />
                <span className="flex-1 text-left">{group.label}</span>
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 opacity-50 transition-transform duration-200",
                    isOpen ? "rotate-0" : "-rotate-90"
                  )}
                />
              </button>

              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.18, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <div className="ml-3 pl-3 border-l border-border/40 mt-0.5 mb-1 space-y-0.5">
                      {items.map((item) => {
                        const Icon = item.icon
                        const active = isItemActive(item.href)
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={onNavigate}
                            className={cn(
                              "flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-sm transition-colors",
                              active
                                ? "bg-primary/10 text-primary font-medium"
                                : "text-foreground/85 hover:bg-muted hover:text-foreground"
                            )}
                          >
                            <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                            <span>{item.label}</span>
                          </Link>
                        )
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </nav>

      {/* Bottom */}
      <div className="border-t px-2 py-2 flex-shrink-0 space-y-0.5">
        {/* Admin pending badge */}
        {user?.role === "admin" && pendingCount > 0 && (
          <Link
            href="/admin/users"
            onClick={onNavigate}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-yellow-600 dark:text-yellow-400 hover:bg-muted transition-colors"
          >
            <Users className="h-4 w-4 flex-shrink-0" />
            <span className="flex-1">승인 대기</span>
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-yellow-500 text-[10px] font-bold text-white">
              {pendingCount > 9 ? "9+" : pendingCount}
            </span>
          </Link>
        )}

        {/* User / Logout */}
        {!isLoading && isAuthenticated && (
          <button
            onClick={() => {
              logout()
              onNavigate?.()
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-foreground/85 hover:bg-muted hover:text-foreground transition-colors"
          >
            <User className="h-4 w-4 flex-shrink-0" />
            <span className="flex-1 text-left truncate text-xs">{user?.username}</span>
            <LogOut className="h-3.5 w-3.5 flex-shrink-0" />
          </button>
        )}
        {!isLoading && !isAuthenticated && (
          <Link
            href="/login"
            onClick={onNavigate}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-foreground/85 hover:bg-muted hover:text-foreground transition-colors"
          >
            <User className="h-4 w-4 flex-shrink-0" />
            <span>로그인</span>
          </Link>
        )}
      </div>
    </div>
  )
}

// Desktop sidebar
export function SideNav() {
  const pathname = usePathname()
  if (pathname === "/login" || pathname === "/register") return null

  return (
    <aside className="hidden md:flex flex-col w-60 border-r bg-background sticky top-0 h-screen flex-shrink-0 z-40">
      <SidebarContent />
    </aside>
  )
}

// Mobile top bar + Sheet drawer
export function SideNavMobileBar() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  if (pathname === "/login" || pathname === "/register") return null

  return (
    <>
      <div className="md:hidden flex-shrink-0 h-12 border-b bg-background/95 backdrop-blur-sm flex items-center gap-3 px-4 sticky top-0 z-40">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setOpen(true)}
        >
          <Menu className="h-5 w-5" />
        </Button>
        <Link href="/" className="flex items-center gap-2">
          <div className="flex items-center justify-center w-7 h-7 rounded-full kca-logo-gradient">
            <img src="/logo/kca_small.png" alt="KCA" className="h-4 w-auto brightness-0 invert" />
          </div>
          <span className="text-sm font-black italic tracking-tighter kca-brand-text">
            AI-Hub
          </span>
        </Link>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <SheetTitle className="sr-only">메뉴</SheetTitle>
          <SidebarContent onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </>
  )
}
