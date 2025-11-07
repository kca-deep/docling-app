"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { FileText, Home, Network, Files, Link2, Database } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"
import { cn } from "@/lib/utils"

export function NavHeader() {
  const pathname = usePathname()

  const navItems = [
    { href: "/", label: "Home", icon: Home },
    { href: "/parse", label: "문서변환", icon: FileText },
    { href: "/url-parse", label: "URL", icon: Link2 },
    { href: "/dify", label: "Dify", icon: Network },
    { href: "/qdrant", label: "Qdrant", icon: Database },
  ]

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="grid grid-cols-3 h-14 items-center px-4 md:px-6 max-w-7xl mx-auto">
        {/* Logo - Left */}
        <div className="flex items-center">
          <Link href="/" className="flex items-center space-x-2">
            <FileText className="h-5 w-5" />
            <span className="font-semibold hidden sm:inline-block">KCA-RAG 파이프라인</span>
          </Link>
        </div>

        {/* Navigation - Center */}
        <nav className="hidden md:flex items-center justify-center gap-0.5">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "inline-flex items-center justify-center whitespace-nowrap rounded-md px-2.5 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
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
              const isActive = pathname === item.href

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
