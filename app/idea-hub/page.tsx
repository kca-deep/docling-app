"use client"

import Link from "next/link"
import { PageContainer } from "@/components/page-container"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Shield,
  ClipboardCheck,
  History,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Lightbulb,
  Plus,
} from "lucide-react"
import { motion } from "framer-motion"

export default function IdeaHubPage() {
  return (
    <PageContainer maxWidth="wide" className="py-8 space-y-8">
      {/* Background Noise & Gradient */}
      <div className="absolute inset-0 bg-noise opacity-30 pointer-events-none -z-10" />
      <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-amber-500/5 to-transparent -z-10" />

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/20">
              <Lightbulb className="h-5 w-5" />
            </div>
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
              AI Idea Hub
            </span>
          </h1>
          <p className="text-muted-foreground mt-3 text-lg max-w-2xl">
            AI 과제 보안성 셀프진단으로 상위기관 검토 대상 여부를 사전에 확인하세요.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Link href="/idea-hub/selfcheck">
            <Button
              size="lg"
              className="gap-2 rounded-full shadow-lg shadow-amber-500/20 hover:shadow-amber-500/40 hover:scale-105 active:scale-95 transition-all bg-amber-500 hover:bg-amber-500/90"
            >
              <Plus className="h-5 w-5" />
              새 진단 시작
            </Button>
          </Link>
        </motion.div>
      </div>

      <div className="space-y-8">

        {/* Feature Cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* 셀프진단 카드 */}
          <Card className="group hover:shadow-lg transition-all duration-300 hover:border-primary/50">
            <CardHeader>
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <ClipboardCheck className="w-6 h-6 text-primary" />
              </div>
              <CardTitle className="flex items-center gap-2">
                보안성 셀프진단
              </CardTitle>
              <CardDescription>
                AI가 과제 내용을 분석하여 10개 체크리스트 항목의 해당 여부를 자동으로 판단합니다.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/idea-hub/selfcheck">
                <Button variant="outline" className="w-full gap-2">
                  진단하기
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* 진단 이력 카드 */}
          <Card className="group hover:shadow-lg transition-all duration-300 hover:border-primary/50">
            <CardHeader>
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center mb-4 group-hover:bg-blue-500/20 transition-colors">
                <History className="w-6 h-6 text-blue-500" />
              </div>
              <CardTitle className="flex items-center gap-2">
                진단 이력
              </CardTitle>
              <CardDescription>
                이전에 수행한 셀프진단 결과를 조회하고 PDF로 다운로드할 수 있습니다.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/idea-hub/history">
                <Button variant="outline" className="w-full gap-2">
                  이력 조회
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* 검토 대상 안내 카드 */}
          <Card className="group hover:shadow-lg transition-all duration-300 hover:border-primary/50">
            <CardHeader>
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center mb-4 group-hover:bg-amber-500/20 transition-colors">
                <FileText className="w-6 h-6 text-amber-500" />
              </div>
              <CardTitle className="flex items-center gap-2">
                검토 대상 안내
              </CardTitle>
              <CardDescription>
                상위기관 보안성 검토가 필요한 경우 제출해야 할 서류와 절차를 안내합니다.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground space-y-2">
                <p className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  필수항목 1~4번 중 하나라도 &quot;예&quot;인 경우
                </p>
                <p className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  상위기관 보안성 검토 대상
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 체크리스트 항목 안내 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              보안성 검토 체크리스트 항목
            </CardTitle>
            <CardDescription>
              AI 과제 추진 시 검토해야 할 10개 항목입니다. 필수 항목(1~4번) 중 하나라도 &quot;예&quot;인 경우 상위기관 검토 대상입니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {/* 필수 항목 */}
              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2 text-red-600 dark:text-red-400">
                  <AlertTriangle className="w-4 h-4" />
                  필수 항목 (1~4번)
                </h3>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2 p-2 rounded-lg bg-red-50 dark:bg-red-950/20">
                    <Badge variant="outline" className="shrink-0 mt-0.5">1</Badge>
                    <span>본 과제에서 내부 정보시스템(업무포털, 무선국검사, 자격검정 등)과 연계가 필요합니까?</span>
                  </li>
                  <li className="flex items-start gap-2 p-2 rounded-lg bg-red-50 dark:bg-red-950/20">
                    <Badge variant="outline" className="shrink-0 mt-0.5">2</Badge>
                    <span>본 과제에서 개인정보(성명, 주민등록번호, 연락처 등)를 수집/처리/저장합니까?</span>
                  </li>
                  <li className="flex items-start gap-2 p-2 rounded-lg bg-red-50 dark:bg-red-950/20">
                    <Badge variant="outline" className="shrink-0 mt-0.5">3</Badge>
                    <span>본 과제에서 민감정보(건강정보, 사상/신념, 정치적 견해 등)를 활용합니까?</span>
                  </li>
                  <li className="flex items-start gap-2 p-2 rounded-lg bg-red-50 dark:bg-red-950/20">
                    <Badge variant="outline" className="shrink-0 mt-0.5">4</Badge>
                    <span>본 과제에서 비공개 업무자료(내부문서, 대외비 등)를 AI 서비스에 입력합니까?</span>
                  </li>
                </ul>
              </div>

              {/* 선택 항목 */}
              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2 text-blue-600 dark:text-blue-400">
                  <CheckCircle2 className="w-4 h-4" />
                  선택 항목 (5~10번)
                </h3>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2 p-2 rounded-lg bg-blue-50 dark:bg-blue-950/20">
                    <Badge variant="outline" className="shrink-0 mt-0.5">5</Badge>
                    <span>본 과제에서 외부 클라우드 기반 AI 서비스(ChatGPT, Claude 등)를 활용합니까?</span>
                  </li>
                  <li className="flex items-start gap-2 p-2 rounded-lg bg-blue-50 dark:bg-blue-950/20">
                    <Badge variant="outline" className="shrink-0 mt-0.5">6</Badge>
                    <span>본 과제에서 자체 AI 모델을 구축/학습할 계획이 있습니까?</span>
                  </li>
                  <li className="flex items-start gap-2 p-2 rounded-lg bg-blue-50 dark:bg-blue-950/20">
                    <Badge variant="outline" className="shrink-0 mt-0.5">7</Badge>
                    <span>본 과제의 결과물이 대국민 서비스로 제공될 예정입니까?</span>
                  </li>
                  <li className="flex items-start gap-2 p-2 rounded-lg bg-blue-50 dark:bg-blue-950/20">
                    <Badge variant="outline" className="shrink-0 mt-0.5">8</Badge>
                    <span>본 과제에서 외부 API 연동(OpenAI API, 외부 데이터 수집 등)이 필요합니까?</span>
                  </li>
                  <li className="flex items-start gap-2 p-2 rounded-lg bg-blue-50 dark:bg-blue-950/20">
                    <Badge variant="outline" className="shrink-0 mt-0.5">9</Badge>
                    <span>본 과제에서 생성된 결과물의 정확성/윤리성 검증 절차를 마련하였습니까?</span>
                  </li>
                  <li className="flex items-start gap-2 p-2 rounded-lg bg-blue-50 dark:bg-blue-950/20">
                    <Badge variant="outline" className="shrink-0 mt-0.5">10</Badge>
                    <span>본 과제에서 활용하는 AI 서비스의 이용약관 및 저작권 관련 사항을 확인하였습니까?</span>
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  )
}
