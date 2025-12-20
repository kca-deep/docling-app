"use client"

import { PageContainer } from "@/components/page-container"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Workflow,
  FileText,
  Database,
  MessageSquare,
  RefreshCcw,
  BookOpen,
  Cpu,
  Server,
  Sparkles,
} from "lucide-react"
import { motion } from "framer-motion"
import {
  DocumentConversionWorkflow,
  VectorEmbeddingWorkflow,
  RagChatbotWorkflow,
  RagImprovementWorkflow,
  DomainKnowledgeWorkflow,
} from "@/components/workflow"

// Stagger animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.15 }
  }
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } }
}

export default function WorkflowPage() {
  return (
    <PageContainer maxWidth="wide" className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold flex items-center gap-2">
          <Workflow className="h-5 w-5 text-muted-foreground" />
          KCA-i 워크플로우
        </h1>
        <Badge variant="secondary" className="gap-1">
          <Server className="w-3 h-3" />
          Self-hosted LLM
        </Badge>
      </div>

      {/* Introduction Card */}
      <motion.div
        variants={itemVariants}
        initial="hidden"
        animate="show"
      >
        <Card className="bg-gradient-to-r from-primary/5 to-transparent border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              KCA-i 지능형 지식·자격 업무지원시스템
            </CardTitle>
            <CardDescription className="text-sm">
              자체 구축 LLM 인프라 기반 RAG 시스템으로, 문서변환부터 챗봇 응답까지 전 과정을 시각화합니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="text-xs gap-1">
                <Cpu className="w-3 h-3" />
                GPT-OSS 20B
              </Badge>
              <Badge variant="outline" className="text-xs gap-1">
                <Cpu className="w-3 h-3" />
                BGE-M3-Korean
              </Badge>
              <Badge variant="outline" className="text-xs gap-1">
                <Database className="w-3 h-3" />
                Qdrant 1.15.5
              </Badge>
              <Badge variant="outline" className="text-xs gap-1">
                <FileText className="w-3 h-3" />
                Docling 1.9.0
              </Badge>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Workflow Cards */}
      <motion.div
        className="space-y-6"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        {/* 1. 문서변환 워크플로우 */}
        <motion.div variants={itemVariants}>
          <div className="space-y-2">
            <h2 className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
              <FileText className="w-4 h-4" />
              STEP 1. 문서변환
            </h2>
            <DocumentConversionWorkflow />
          </div>
        </motion.div>

        {/* 2. 벡터임베딩 워크플로우 */}
        <motion.div variants={itemVariants}>
          <div className="space-y-2">
            <h2 className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
              <Database className="w-4 h-4" />
              STEP 2. 벡터 임베딩
            </h2>
            <VectorEmbeddingWorkflow />
          </div>
        </motion.div>

        {/* 3. RAG 챗봇 워크플로우 */}
        <motion.div variants={itemVariants}>
          <div className="space-y-2">
            <h2 className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
              <MessageSquare className="w-4 h-4" />
              STEP 3. RAG 챗봇 응답
            </h2>
            <RagChatbotWorkflow />
          </div>
        </motion.div>

        {/* 4. 반복적 RAG 개선 워크플로우 */}
        <motion.div variants={itemVariants}>
          <div className="space-y-2">
            <h2 className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
              <RefreshCcw className="w-4 h-4" />
              STEP 4. 반복적 개선
            </h2>
            <RagImprovementWorkflow />
          </div>
        </motion.div>

        {/* 5. 도메인지식 정비 워크플로우 */}
        <motion.div variants={itemVariants}>
          <div className="space-y-2">
            <h2 className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
              <BookOpen className="w-4 h-4" />
              도메인지식 정비 프로세스
            </h2>
            <DomainKnowledgeWorkflow />
          </div>
        </motion.div>
      </motion.div>

      {/* Summary Card */}
      <motion.div
        variants={itemVariants}
        initial="hidden"
        animate="show"
        transition={{ delay: 0.8 }}
      >
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">시스템 구성 요약</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-blue-600 dark:text-blue-400">문서 처리</h3>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• Docling 1.9.0 (구조화 문서)</li>
                  <li>• Qwen3-VL 8B (스캔/OCR)</li>
                  <li>• PDF, DOCX, PPTX, XLSX 지원</li>
                </ul>
              </div>
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-purple-600 dark:text-purple-400">벡터 검색</h3>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• BGE-M3-Korean (1024차원)</li>
                  <li>• Qdrant Vector DB</li>
                  <li>• BGE Reranker v2-m3</li>
                </ul>
              </div>
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-green-600 dark:text-green-400">LLM 응답</h3>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• GPT-OSS 20B Q6_K</li>
                  <li>• EXAONE 4.0 32B</li>
                  <li>• 스트리밍 + 출처 제공</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </PageContainer>
  )
}
