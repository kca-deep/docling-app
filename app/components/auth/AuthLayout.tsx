interface AuthLayoutProps {
  children: React.ReactNode
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl"
}

/**
 * 인증 페이지 공통 레이아웃 (Server Component)
 * 최소한의 스타일로 즉시 렌더링
 */
export function AuthLayout({ children, maxWidth = "md" }: AuthLayoutProps) {
  const maxWidthClasses = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background">
      <div className={`w-full ${maxWidthClasses[maxWidth]} px-6`}>
        {children}
      </div>
    </div>
  )
}
