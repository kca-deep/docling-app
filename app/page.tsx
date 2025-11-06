import Link from "next/link"
import { FileText, Network, ArrowRight } from "lucide-react"
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

export default function HomePage() {
  const features = [
    {
      icon: FileText,
      title: "문서 파싱",
      description: "PDF, DOCX, PPTX 파일을 마크다운으로 변환합니다",
      href: "/parse",
    },
    {
      icon: Network,
      title: "Dify 연동",
      description: "Dify AI 플랫폼과 통합하여 문서를 처리합니다",
      href: "/dify",
    },
  ]

  return (
    <div className="container mx-auto px-4 md:px-6 py-16 max-w-5xl">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">
          문서 파싱 플랫폼
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          문서를 마크다운으로 변환하고 AI 플랫폼과 연동합니다
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {features.map((feature) => {
          const Icon = feature.icon
          return (
            <Link key={feature.href} href={feature.href}>
              <Card className="h-full hover:shadow-md transition-shadow group">
                <CardHeader>
                  <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center mb-4">
                    <Icon className="w-6 h-6" />
                  </div>
                  <CardTitle className="flex items-center justify-between">
                    {feature.title}
                    <ArrowRight className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </CardTitle>
                  <CardDescription>
                    {feature.description}
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
