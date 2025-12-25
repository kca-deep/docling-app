"use client"

import { PageContainer } from "@/components/page-container"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  FileText,
  Database,
  Cpu,
  Sparkles,
  Brain,
  Search,
  RotateCcw,
  Shield,
  Upload,
  FileSearch,
  Layers,
  MessageCircle,
} from "lucide-react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } }
}

interface ServiceCardProps {
  name: string
  icon?: React.ReactNode
  description: string
  specs?: string
  accentColor: string
  className?: string
}

function ServiceCard({ name, icon, description, specs, accentColor, className }: ServiceCardProps) {
  return (
    <div className={cn(
      "group relative p-3 rounded-xl border backdrop-blur-sm transition-all duration-300",
      "hover:scale-[1.03] hover:-translate-y-1 hover:shadow-xl cursor-pointer",
      "overflow-hidden",
      className
    )}>
      <div className="flex items-center gap-2 mb-1.5">
        {icon && (
          <div className={cn(
            "p-2 rounded-xl shadow-inner",
            accentColor.replace("bg-gradient-to-r", "bg-gradient-to-br").replace("/80", "/20")
          )}>
            {icon}
          </div>
        )}
        <div className="font-bold text-sm">{name}</div>
      </div>
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        {description}
      </p>
      {specs && (
        <p className="text-[10px] text-muted-foreground/70 leading-relaxed mt-1">
          {specs}
        </p>
      )}

      {/* Hover glow effect */}
      <div className={cn(
        "absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none",
        "bg-gradient-to-t from-transparent via-transparent to-white/5"
      )} />
    </div>
  )
}

// Process Card Component - Card-based pipeline steps for better readability
interface ProcessCardProps {
  icon: React.ReactNode
  label: string
  sublabel: string
  gradientFrom: string
  gradientTo: string
  bgClass: string
  isLast?: boolean
  step?: number
}

function ProcessCard({ icon, label, sublabel, gradientFrom, gradientTo, bgClass, isLast, step }: ProcessCardProps) {
  return (
    <div className="flex items-center">
      <div className={cn(
        "relative group min-w-[90px] p-3 rounded-xl border shadow-md transition-all duration-300",
        "hover:scale-105 hover:shadow-lg hover:-translate-y-0.5",
        bgClass
      )}>
        {/* Step number badge */}
        {step && (
          <div className={cn(
            "absolute -top-2 -left-2 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-md",
            `bg-gradient-to-br ${gradientFrom} ${gradientTo}`
          )}>
            {step}
          </div>
        )}

        <div className="flex flex-col items-center gap-2 pt-1">
          <div className={cn(
            "w-9 h-9 rounded-xl flex items-center justify-center shadow-inner",
            `bg-gradient-to-br ${gradientFrom} ${gradientTo}`
          )}>
            {icon}
          </div>
          <div className="text-center">
            <div className="text-xs font-bold leading-tight">{label}</div>
            <div className="text-[10px] text-muted-foreground leading-tight mt-0.5">{sublabel}</div>
          </div>
        </div>

        {/* Hover glow */}
        <div className={cn(
          "absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none",
          "bg-gradient-to-t from-transparent via-transparent to-white/10"
        )} />
      </div>

      {/* Arrow connector */}
      {!isLast && (
        <div className="flex items-center mx-2">
          <div className="w-6 md:w-8 h-0.5 bg-gradient-to-r from-muted-foreground/50 to-muted-foreground/30 relative">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/40 to-purple-500/40 animate-pulse"
                 style={{ animationDuration: '2s' }} />
          </div>
          <svg className="w-2 h-2 text-muted-foreground/60 -ml-0.5" viewBox="0 0 8 8" fill="currentColor">
            <path d="M0 0 L8 4 L0 8 Z" />
          </svg>
        </div>
      )}
    </div>
  )
}

export default function WorkflowPage() {
  return (
    <PageContainer maxWidth="wide" className="space-y-3">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-gradient-to-br from-primary to-purple-600 shadow-lg shadow-primary/25">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <h1 className="text-xl font-bold bg-gradient-to-r from-primary via-purple-600 to-pink-600 bg-clip-text text-transparent">
          KCA 도메인지식(RAG) 기반 AI Assistant
        </h1>
      </div>

      {/* Main System Architecture Card */}
      <motion.div
        variants={itemVariants}
        initial="hidden"
        animate="show"
      >
        <Card className="overflow-hidden border-0 shadow-2xl bg-gradient-to-br from-background via-background to-muted/30">
          <CardContent className="p-4">
            {/* GPU Infrastructure Container */}
            <div className="relative bg-gradient-to-b from-slate-900 via-slate-850 to-slate-900 dark:from-slate-800 dark:via-slate-750 dark:to-slate-800 rounded-2xl shadow-2xl overflow-hidden">
              {/* Animated background pattern */}
              <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(68,68,68,.05)_50%,transparent_75%,transparent_100%)] bg-[length:250px_250px] animate-[shimmer_3s_linear_infinite]" />

              {/* Inner glow effect */}
              <div className="absolute inset-0 bg-gradient-to-b from-green-500/5 via-transparent to-amber-500/5 pointer-events-none" />

              {/* GPU Header Bar - Compact */}
              <div className="relative border-b border-white/10 px-5 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-green-400 to-emerald-600 shadow-lg shadow-green-500/30">
                      <Cpu className="w-5 h-5 text-white" />
                    </div>
                    <div className="font-black text-lg text-white tracking-tight">
                      NVIDIA RTX 5090
                    </div>
                    <Badge className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-300 text-[10px] border border-green-500/30 gap-1">
                      <Shield className="w-3 h-3" />
                      Self-hosted
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-white/10 text-white/90 text-[10px] border-0 backdrop-blur-sm">32GB VRAM</Badge>
                    <Badge className="bg-white/10 text-white/90 text-[10px] border-0 backdrop-blur-sm">Intel Ultra 9</Badge>
                    <Badge className="bg-white/10 text-white/90 text-[10px] border-0 backdrop-blur-sm">64GB DDR5</Badge>
                  </div>
                </div>
              </div>

              {/* GPU Content Area - All services inside */}
              <div className="relative p-5 space-y-5">
                {/* Semi-transparent inner container */}
                <div className="bg-background/95 dark:bg-background/90 rounded-xl p-5 space-y-5 shadow-inner border border-white/5">

                  {/* RAG Pipeline Flow - Card Based */}
                  <div className="bg-gradient-to-r from-muted/30 via-background to-muted/30 rounded-xl p-4 border shadow-inner">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                        <Sparkles className="w-3.5 h-3.5" />
                        RAG Pipeline Flow
                      </div>
                      <Badge variant="outline" className="text-[9px]">7 Steps</Badge>
                    </div>
                    <div className="flex items-center justify-center overflow-x-auto overflow-y-visible pt-3 pb-2">
                      <div className="flex items-center gap-0 min-w-max">
                        <ProcessCard
                          step={1}
                          icon={<Upload className="w-4 h-4 text-white" />}
                          label="입력"
                          sublabel="문서/질의"
                          gradientFrom="from-slate-600"
                          gradientTo="to-slate-800"
                          bgClass="bg-slate-50/80 dark:bg-slate-900/60 border-slate-300/50 dark:border-slate-700/50"
                        />
                        <ProcessCard
                          step={2}
                          icon={<FileSearch className="w-4 h-4 text-white" />}
                          label="Docling"
                          sublabel="문서 파싱"
                          gradientFrom="from-green-500"
                          gradientTo="to-emerald-600"
                          bgClass="bg-green-50/80 dark:bg-green-950/60 border-green-300/50 dark:border-green-700/50"
                        />
                        <ProcessCard
                          step={3}
                          icon={<Layers className="w-4 h-4 text-white" />}
                          label="Embed"
                          sublabel="벡터 변환"
                          gradientFrom="from-purple-500"
                          gradientTo="to-violet-600"
                          bgClass="bg-purple-50/80 dark:bg-purple-950/60 border-purple-300/50 dark:border-purple-700/50"
                        />
                        <ProcessCard
                          step={4}
                          icon={<Database className="w-4 h-4 text-white" />}
                          label="Qdrant"
                          sublabel="검색/저장"
                          gradientFrom="from-amber-500"
                          gradientTo="to-orange-600"
                          bgClass="bg-amber-50/80 dark:bg-amber-950/60 border-amber-300/50 dark:border-amber-700/50"
                        />
                        <ProcessCard
                          step={5}
                          icon={<RotateCcw className="w-4 h-4 text-white" />}
                          label="Rerank"
                          sublabel="재순위화"
                          gradientFrom="from-blue-500"
                          gradientTo="to-cyan-600"
                          bgClass="bg-blue-50/80 dark:bg-blue-950/60 border-blue-300/50 dark:border-blue-700/50"
                        />
                        <ProcessCard
                          step={6}
                          icon={<Brain className="w-4 h-4 text-white" />}
                          label="LLM"
                          sublabel="답변 생성"
                          gradientFrom="from-purple-600"
                          gradientTo="to-pink-600"
                          bgClass="bg-pink-50/80 dark:bg-pink-950/60 border-pink-300/50 dark:border-pink-700/50"
                        />
                        <ProcessCard
                          step={7}
                          icon={<MessageCircle className="w-4 h-4 text-white" />}
                          label="응답"
                          sublabel="출처 포함"
                          gradientFrom="from-teal-500"
                          gradientTo="to-green-600"
                          bgClass="bg-teal-50/80 dark:bg-teal-950/60 border-teal-300/50 dark:border-teal-700/50"
                          isLast
                        />
                      </div>
                    </div>
                  </div>

                  {/* 3 Column Service Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* LLM 생성 */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 px-1">
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center shadow-lg shadow-purple-500/25">
                          <Brain className="w-3.5 h-3.5 text-white" />
                        </div>
                        <span className="text-xs font-bold bg-gradient-to-r from-purple-600 to-violet-600 bg-clip-text text-transparent uppercase tracking-wide">
                          LLM 생성
                        </span>
                      </div>
                      <div className="space-y-2">
                        <ServiceCard
                          name="GPT-OSS 20B"
                          description="답변 생성 · 2.5초 응답 · 16GB · 96K ctx"
                          specs="llama.cpp 기반, Q4_K_M 양자화, 실시간 채팅 최적화"
                          accentColor="bg-gradient-to-r from-purple-500 to-violet-500"
                          className="bg-purple-50/80 dark:bg-purple-950/40 border-purple-200/50 dark:border-purple-800/50"
                        />
                        <ServiceCard
                          name="EXAONE 4.0 32B"
                          description="고품질 한국어 · 131K ctx · 20GB VRAM"
                          specs="LG AI Research 개발, 복잡한 규정 분석에 최적화"
                          accentColor="bg-gradient-to-r from-violet-500 to-purple-500"
                          className="bg-purple-50/80 dark:bg-purple-950/40 border-purple-200/50 dark:border-purple-800/50"
                        />
                      </div>
                    </div>

                    {/* 벡터 검색 */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 px-1">
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
                          <Search className="w-3.5 h-3.5 text-white" />
                        </div>
                        <span className="text-xs font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent uppercase tracking-wide">
                          벡터 검색
                        </span>
                      </div>
                      <div className="space-y-2">
                        <ServiceCard
                          name="BGE M3 Korean"
                          description="1024차원 · 13ms · 한국어 특화 · GPU"
                          specs="BAAI/bge-m3-korean 모델, CUDA 가속, 배치 처리"
                          accentColor="bg-gradient-to-r from-blue-500 to-cyan-500"
                          className="bg-blue-50/80 dark:bg-blue-950/40 border-blue-200/50 dark:border-blue-800/50"
                        />
                        <ServiceCard
                          name="BGE Reranker"
                          description="재순위화 · 정확도 +10% · Cross-encoder"
                          specs="BAAI/bge-reranker-v2-m3, FP16 추론, 정밀 스코어링"
                          accentColor="bg-gradient-to-r from-cyan-500 to-blue-500"
                          className="bg-blue-50/80 dark:bg-blue-950/40 border-blue-200/50 dark:border-blue-800/50"
                        />
                      </div>
                    </div>

                    {/* 문서처리 */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 px-1">
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-500/25">
                          <FileText className="w-3.5 h-3.5 text-white" />
                        </div>
                        <span className="text-xs font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent uppercase tracking-wide">
                          문서처리
                        </span>
                      </div>
                      <div className="space-y-2">
                        <ServiceCard
                          name="Docling Serve"
                          description="PDF/DOCX 파싱 · 테이블 인식 · Markdown"
                          specs="IBM 오픈소스, 비동기 처리, 문서 구조 추출"
                          accentColor="bg-gradient-to-r from-green-500 to-emerald-500"
                          className="bg-green-50/80 dark:bg-green-950/40 border-green-200/50 dark:border-green-800/50"
                        />
                        <ServiceCard
                          name="Qwen3-VL 8B"
                          description="OCR 폴백 · 스캔 문서 · 비전+언어"
                          specs="저품질 스캔/이미지 PDF 처리, 한글 OCR 특화"
                          accentColor="bg-gradient-to-r from-emerald-500 to-green-500"
                          className="bg-green-50/80 dark:bg-green-950/40 border-green-200/50 dark:border-green-800/50"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Qdrant Vector DB with 16 Collections */}
                  <div className="relative">
                    {/* Glow effect */}
                    <div className="absolute -inset-1 bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-500 rounded-2xl blur opacity-20" />

                    <div className="relative bg-gradient-to-br from-amber-50 via-orange-50/80 to-yellow-50 dark:from-amber-950/60 dark:via-orange-950/40 dark:to-yellow-950/60 rounded-xl border-2 border-amber-400/50 dark:border-amber-600/50 shadow-xl overflow-hidden">
                      {/* Header */}
                      <div className="flex items-center justify-between px-4 py-3 border-b border-amber-300/50 dark:border-amber-700/50 bg-gradient-to-r from-amber-100/50 to-orange-100/50 dark:from-amber-900/30 dark:to-orange-900/30">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/30">
                            <Database className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <div className="font-bold text-sm bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent flex items-center gap-2">
                              KCA 도메인지식 16종
                              <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[9px] border-amber-400/50">
                                Qdrant Vector DB
                              </Badge>
                            </div>
                            <div className="text-[10px] text-amber-700/70 dark:text-amber-300/70">
                              2,502 벡터 · BGE-M3 1024차원 · ANN 검색
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Collections - 2열 균형 배치 */}
                      <div className="p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {/* 왼쪽 열: 큰 그룹 (5개, 3개) */}
                          <div className="space-y-3">
                            {/* 인사/조직 (5) */}
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-purple-600 dark:text-purple-400">인사/조직</span>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {[
                                  { name: "인사관리", chunks: 229 },
                                  { name: "복리후생", chunks: 123 },
                                  { name: "복무관리", chunks: 87 },
                                  { name: "고용형태", chunks: 51 },
                                  { name: "징계소송", chunks: 49 }
                                ].map((col) => (
                                  <span key={col.name} className="text-[11px] px-2.5 py-1 rounded-md bg-purple-100/80 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 border border-purple-200/60 dark:border-purple-700/50 font-medium">
                                    {col.name} <span className="text-purple-500/70 dark:text-purple-400/70">({col.chunks}c)</span>
                                  </span>
                                ))}
                              </div>
                            </div>
                            {/* 행정/지원 (3) */}
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-amber-600 dark:text-amber-400">행정/지원</span>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {[
                                  { name: "문서정보", chunks: 179 },
                                  { name: "시설장비", chunks: 83 },
                                  { name: "기본법규", chunks: 55 }
                                ].map((col) => (
                                  <span key={col.name} className="text-[11px] px-2.5 py-1 rounded-md bg-amber-100/80 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-700/50 font-medium">
                                    {col.name} <span className="text-amber-500/70 dark:text-amber-400/70">({col.chunks}c)</span>
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* 오른쪽 열: 작은 그룹 (2개씩 합침) - 2x2 그리드 */}
                          <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                            {/* 자격/인증 */}
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-blue-600 dark:text-blue-400">자격/인증</span>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {[
                                  { name: "ICT자격검정", chunks: 626 },
                                  { name: "자격검정", chunks: 112 }
                                ].map((col) => (
                                  <span key={col.name} className="text-[11px] px-2.5 py-1 rounded-md bg-blue-100/80 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-700/50 font-medium">
                                    {col.name} <span className="text-blue-500/70 dark:text-blue-400/70">({col.chunks}c)</span>
                                  </span>
                                ))}
                              </div>
                            </div>
                            {/* 재무/보상 */}
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-green-600 dark:text-green-400">재무/보상</span>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {[
                                  { name: "재무회계", chunks: 153 },
                                  { name: "보수급여", chunks: 106 }
                                ].map((col) => (
                                  <span key={col.name} className="text-[11px] px-2.5 py-1 rounded-md bg-green-100/80 dark:bg-green-900/50 text-green-700 dark:text-green-300 border border-green-200/60 dark:border-green-700/50 font-medium">
                                    {col.name} <span className="text-green-500/70 dark:text-green-400/70">({col.chunks}c)</span>
                                  </span>
                                ))}
                              </div>
                            </div>
                            {/* 규정/감사 */}
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-red-600 dark:text-red-400">규정/감사</span>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {[
                                  { name: "청렴감사", chunks: 302 },
                                  { name: "ICT기금사업", chunks: 169 }
                                ].map((col) => (
                                  <span key={col.name} className="text-[11px] px-2.5 py-1 rounded-md bg-red-100/80 dark:bg-red-900/50 text-red-700 dark:text-red-300 border border-red-200/60 dark:border-red-700/50 font-medium">
                                    {col.name} <span className="text-red-500/70 dark:text-red-400/70">({col.chunks}c)</span>
                                  </span>
                                ))}
                              </div>
                            </div>
                            {/* 연구/보안 */}
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-cyan-600 dark:text-cyan-400">연구/보안</span>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {[
                                  { name: "정부AI 보안", chunks: 106 },
                                  { name: "연구사업", chunks: 72 }
                                ].map((col) => (
                                  <span key={col.name} className="text-[11px] px-2.5 py-1 rounded-md bg-cyan-100/80 dark:bg-cyan-900/50 text-cyan-700 dark:text-cyan-300 border border-cyan-200/60 dark:border-cyan-700/50 font-medium">
                                    {col.name} <span className="text-cyan-500/70 dark:text-cyan-400/70">({col.chunks}c)</span>
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                </div>{/* End of inner container */}
              </div>{/* End of GPU content area */}
            </div>{/* End of GPU Infrastructure Container */}
          </CardContent>
        </Card>
      </motion.div>

    </PageContainer>
  )
}
