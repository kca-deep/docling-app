import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { AuthLogo } from "./AuthLogo"

interface AuthCardProps {
  title: string
  description?: string
  children: React.ReactNode
  showLogo?: boolean
  logoSize?: "sm" | "md" | "lg"
  className?: string
}

/**
 * 인증 페이지 카드 컴포넌트 (Server Component)
 */
export function AuthCard({
  title,
  description,
  children,
  showLogo = true,
  logoSize = "md",
  className = "",
}: AuthCardProps) {
  return (
    <Card className={`border shadow-xl bg-background overflow-hidden ${className}`}>
      <CardHeader className="text-center pb-2 pt-8">
        {showLogo && (
          <div className="mb-6">
            <AuthLogo size={logoSize} />
          </div>
        )}
        <CardTitle className="text-3xl font-bold">
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
            {title}
          </span>
        </CardTitle>
        {description && (
          <CardDescription className="text-muted-foreground mt-2">
            {description}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="pt-6 pb-8 px-8">
        {children}
      </CardContent>
    </Card>
  )
}

/**
 * 컴팩트 버전 (회원가입용)
 */
export function AuthCardCompact({
  title,
  description,
  children,
  showLogo = true,
  className = "",
}: AuthCardProps) {
  return (
    <Card className={`border shadow-xl bg-background overflow-hidden ${className}`}>
      <CardHeader className="text-center pb-2 pt-6">
        {showLogo && (
          <div className="mb-4">
            <AuthLogo size="sm" />
          </div>
        )}
        <CardTitle className="text-xl font-bold">
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
            {title}
          </span>
        </CardTitle>
        {description && (
          <CardDescription className="text-muted-foreground mt-1 text-sm">
            {description}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="pt-4 pb-6 px-6">
        {children}
      </CardContent>
    </Card>
  )
}
