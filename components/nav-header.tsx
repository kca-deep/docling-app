"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { FileText, Home, Network, Files, Database, MessageSquare, Server, Upload, Sheet } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"
import { cn } from "@/lib/utils"

export function NavHeader() {
  const pathname = usePathname()

  const navItems = [
    { href: "/", label: "Home", icon: Home },
    { href: "/system-architecture", label: "구성도", icon: Server },
    { href: "/parse", label: "문서변환", icon: FileText },
    { href: "/upload", label: "임베딩", icon: Upload },
    { href: "/excel-embedding", label: "Excel", icon: Sheet },
    { href: "/chat?fullscreen=true", label: "AI 챗봇", icon: MessageSquare },
  ]

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="grid grid-cols-[auto_1fr_auto] h-14 items-center px-4 md:px-6 max-w-7xl mx-auto gap-4">
        {/* Logo - Left */}
        <div className="flex items-center">
          <Link href="/" className="group flex items-center gap-3 relative">
            {/* Icon Container with Gradient Background */}
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/80 to-primary/60 rounded-lg blur-sm opacity-75 group-hover:opacity-100 transition-opacity" />
              <div className="relative bg-gradient-to-br from-primary to-primary/80 p-2 rounded-lg shadow-lg group-hover:shadow-xl transition-all">
                <FileText className="h-5 w-5 text-primary-foreground" strokeWidth={2.5} />
              </div>
            </div>

            {/* Text Container */}
            <div className="hidden sm:flex flex-col">
              <div className="flex items-baseline gap-1.5">
                <span className="font-bold text-lg bg-gradient-to-r from-primary via-primary/90 to-primary/70 bg-clip-text text-transparent leading-none tracking-tight">
                  KCA
                </span>
                <span className="font-bold text-lg text-foreground leading-none">RAG</span>
              </div>
              <span className="text-[0.65rem] text-muted-foreground font-medium leading-tight tracking-wider mt-0.5">
                AI PIPELINE
              </span>
            </div>
          </Link>
        </div>

        {/* Navigation - Center */}
        <nav className="hidden md:flex items-center justify-center gap-1">
          {navItems.map((item) => {
            const Icon = item.icon
            // query parameter를 제외한 pathname만 비교
            const itemPathname = item.href.split('?')[0]
            const isActive = pathname === itemPathname

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
                  isActive && "bg-accent"
                )}
              >
                <Icon className="mr-1.5 h-4 w-4 flex-shrink-0" />
                <span>{item.label}</span>
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
              // query parameter를 제외한 pathname만 비교
              const itemPathname = item.href.split('?')[0]
              const isActive = pathname === itemPathname

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors h-9 w-9",
                    isActive
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-accent hover:text-accent-foreground"
                  )}
                  title={item.label}
                >
                  <Icon className="h-4 w-4" />
                  <span className="sr-only">{item.label}</span>
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
