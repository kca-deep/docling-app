import { Alert, AlertDescription } from "@/components/ui/alert"
import { PageContainer } from "@/components/page-container"

export default function DifyPage() {
  return (
    <PageContainer maxWidth="narrow">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-4">
          Dify 연동
        </h1>
        <p className="text-lg text-muted-foreground">
          Dify AI 플랫폼과 통합하여 문서를 처리합니다
        </p>
      </div>

      <Alert>
        <AlertDescription className="text-center">
          Dify 연동 기능은 현재 개발 중입니다.
        </AlertDescription>
      </Alert>
    </PageContainer>
  )
}
