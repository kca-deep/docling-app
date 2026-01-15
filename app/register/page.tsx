import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { AuthLayout } from "@/app/components/auth/AuthLayout"
import { AuthCardCompact } from "@/app/components/auth/AuthCard"
import { RegisterFormWrapper } from "./components/RegisterClient"

/**
 * 회원가입 페이지 (Server Component)
 * 최소한의 스타일로 즉시 렌더링
 */
export default function RegisterPage() {
  return (
    <AuthLayout maxWidth="2xl">
      <div className="mb-4">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>홈으로 돌아가기</span>
        </Link>
      </div>

      <AuthCardCompact title="회원가입" description="KCA AI-Hub 서비스에 가입하세요">
        <RegisterFormWrapper />
      </AuthCardCompact>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        관리자 승인 후 서비스를 이용할 수 있습니다.
      </p>
    </AuthLayout>
  )
}
