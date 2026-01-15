import { Sparkles } from "lucide-react"

interface AuthLogoProps {
  size?: "sm" | "md" | "lg"
}

/**
 * 인증 페이지 로고 컴포넌트 (Server Component)
 */
export function AuthLogo({ size = "md" }: AuthLogoProps) {
  const sizeClasses = {
    sm: { container: "p-3 rounded-xl", icon: "h-6 w-6" },
    md: { container: "p-4 rounded-2xl", icon: "h-10 w-10" },
    lg: { container: "p-5 rounded-2xl", icon: "h-12 w-12" },
  }

  const { container, icon } = sizeClasses[size]

  return (
    <div className="flex justify-center">
      <div className={`${container} bg-gradient-to-br from-[color:var(--chart-1)]/10 to-[color:var(--chart-3)]/10 border border-[color:var(--chart-1)]/20`}>
        <Sparkles className={`${icon} text-[color:var(--chart-1)]`} />
      </div>
    </div>
  )
}
