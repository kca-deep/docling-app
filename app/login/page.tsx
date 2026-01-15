import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { AuthLayout } from "@/app/components/auth/AuthLayout"
import { AuthCard } from "@/app/components/auth/AuthCard"
import { LoginFormWrapper } from "./components/LoginClient"

/**
 * 로그인 페이지 (Server Component)
 * 최소한의 스타일로 즉시 렌더링
 */
export default function LoginPage() {
  return (
    <AuthLayout>
      <div className="mb-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>홈으로 돌아가기</span>
        </Link>
      </div>

      <AuthCard title="KCA AI-Hub" description="Document AI Pipeline">
        <LoginFormWrapper />
      </AuthCard>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        Document AI Pipeline 로그인
      </p>
    </AuthLayout>
  )
}
