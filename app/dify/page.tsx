import { Alert, AlertDescription } from "@/components/ui/alert"

export default function DifyPage() {
  return (
    <div className="container mx-auto px-4 md:px-6 py-16 max-w-3xl">
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
    </div>
  )
}
