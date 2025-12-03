"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { FileText, Home, Network, Files, Database, MessageSquare, Server, Upload, Sheet, BarChart3, LucideIcon } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"
import { cn } from "@/lib/utils"

interface NavItem {
  href: string
  label: string
  icon: LucideIcon
  colorVar: string
}

export function NavHeader() {
  const pathname = usePathname()

  const navItems: NavItem[] = [
    { href: "/", label: "Home", icon: Home, colorVar: "var(--chart-1)" },
    { href: "/system-architecture", label: "구성도", icon: Server, colorVar: "var(--chart-5)" },
    { href: "/parse", label: "문서변환", icon: FileText, colorVar: "var(--chart-1)" },
    { href: "/upload", label: "임베딩", icon: Upload, colorVar: "var(--chart-2)" },
    { href: "/excel-embedding", label: "Excel", icon: Sheet, colorVar: "var(--chart-2)" },
    { href: "/chat?fullscreen=true", label: "AI 챗봇", icon: MessageSquare, colorVar: "var(--chart-3)" },
    { href: "/analytics", label: "통계", icon: BarChart3, colorVar: "var(--chart-4)" },
  ]

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="grid grid-cols-[auto_1fr_auto] h-14 items-center px-4 md:px-6 max-w-7xl mx-auto gap-4">
        {/* Logo - Left */}
        <div className="flex items-center">
          <Link href="/" className="group flex items-center gap-3 relative">
            {/* Icon Container with Gradient Background */}
            <div className="relative">
              <div
                className="absolute inset-0 rounded-lg blur-sm opacity-75 group-hover:opacity-100 transition-opacity"
                style={{ background: "linear-gradient(135deg, var(--chart-1), var(--chart-2), var(--chart-3))" }}
              />
              <div
                className="relative p-2 rounded-lg shadow-lg group-hover:shadow-xl transition-all"
                style={{ background: "linear-gradient(135deg, var(--chart-1), var(--chart-2))" }}
              >
                <FileText className="h-5 w-5 text-white" strokeWidth={2.5} />
              </div>
            </div>

            {/* Text Container */}
            <div className="hidden sm:flex flex-col">
              <div className="flex items-baseline gap-1.5">
                <span
                  className="font-bold text-lg leading-none tracking-tight bg-clip-text text-transparent"
                  style={{ backgroundImage: "linear-gradient(90deg, var(--chart-1), var(--chart-2), var(--chart-3))" }}
                >
                  KCA
                </span>
                <span className="font-bold text-lg text-foreground leading-none">RAG</span>
              </div>
              <span
                className="text-[0.65rem] font-medium leading-tight tracking-wider mt-0.5 bg-clip-text text-transparent"
                style={{ backgroundImage: "linear-gradient(90deg, var(--chart-1), var(--chart-2))" }}
              >
                AI PIPELINE
              </span>
            </div>
          </Link>
        </div>

        {/* Navigation - Center */}
        <nav className="hidden md:flex items-center justify-center gap-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const itemPathname = item.href.split('?')[0]
            const isActive = pathname === itemPathname

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-all",
                  isActive
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
                style={{
                  backgroundColor: isActive ? `color-mix(in oklch, ${item.colorVar} 15%, transparent)` : undefined,
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = `color-mix(in oklch, ${item.colorVar} 10%, transparent)`
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'transparent'
                  }
                }}
              >
                <Icon
                  className="mr-1.5 h-4 w-4 flex-shrink-0 transition-colors"
                  style={{ color: item.colorVar }}
                />
                <span>{item.label}</span>
                {/* Active Indicator */}
                {isActive && (
                  <span
                    className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full"
                    style={{ backgroundColor: item.colorVar }}
                  />
                )}
              </Link>
            )
          })}
        </nav>

        {/* Mobile Navigation & Theme Toggle - Right */}
        <div className="flex items-center justify-end gap-1">
          {/* Mobile menu */}
          <div className="md:hidden flex gap-0.5">
            {navItems.map((item) => {
              const Icon = item.icon
              const itemPathname = item.href.split('?')[0]
              const isActive = pathname === itemPathname

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "relative inline-flex items-center justify-center rounded-md text-sm font-medium transition-all h-9 w-9"
                  )}
                  style={{
                    backgroundColor: isActive ? `color-mix(in oklch, ${item.colorVar} 15%, transparent)` : undefined,
                  }}
                  title={item.label}
                >
                  <Icon
                    className="h-4 w-4 transition-colors"
                    style={{ color: isActive ? item.colorVar : undefined }}
                  />
                  <span className="sr-only">{item.label}</span>
                  {/* Active Indicator */}
                  {isActive && (
                    <span
                      className="absolute bottom-0.5 left-1.5 right-1.5 h-0.5 rounded-full"
                      style={{ backgroundColor: item.colorVar }}
                    />
                  )}
                </Link>
              )
            })}
          </div>

          {/* Theme Toggle */}
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
