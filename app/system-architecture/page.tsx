"use client"

import { PageContainer } from "@/components/page-container"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Server, Cpu, Network, Database, Boxes, Globe, MonitorPlay, ChevronDown } from "lucide-react"

export default function SystemArchitecturePage() {
  return (
    <PageContainer>
      <div className="space-y-6">
        {/* 페이지 헤더 */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">시스템 구성도</h1>
          <p className="text-muted-foreground">RTX 5090 GPU 서버의 하드웨어 및 서비스 구성 정보</p>
        </div>
          <Card className="border-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5" />
                시스템 아키텍처 다이어그램
              </CardTitle>
              <CardDescription>RTX 5090 GPU 서버의 전체 구성도</CardDescription>
            </CardHeader>
            <CardContent>
              {/* RTX 5090 전체 컨테이너 */}
              <div className="border-4 border-red-600/60 rounded-2xl p-6 bg-gradient-to-br from-red-500/10 to-red-600/5 relative">
                {/* RTX 5090 라벨 */}
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-background px-4 py-1 border-2 border-red-600 rounded-full">
                  <div className="flex items-center gap-2">
                    <Cpu className="h-5 w-5 text-red-600" />
                    <span className="font-bold text-base">NVIDIA RTX 5090</span>
                    <Badge variant="secondary" className="text-xs">32GB VRAM</Badge>
                  </div>
                </div>

                <Accordion type="multiple" defaultValue={["entry", "application"]} className="space-y-4 mt-4">
                  {/* Entry Points */}
                  <AccordionItem value="entry" className="border-2 border-purple-500/50 rounded-lg bg-purple-500/5 px-4 overflow-visible">
                    <AccordionTrigger className="hover:no-underline py-4">
                      <div className="flex items-center gap-2">
                        <Globe className="h-5 w-5 text-purple-600" />
                        <span className="font-bold text-base text-purple-700 dark:text-purple-400">Entry Points</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4 pb-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          <div className="bg-background border-2 border-purple-500 rounded-lg p-4 text-center">
                            <Server className="h-7 w-7 mx-auto mb-2 text-purple-600" />
                            <p className="font-semibold text-sm mb-1">KCA RAG 파이프라인</p>
                            <Badge variant="secondary" className="text-xs">:3000</Badge>
                          </div>
                          <div className="bg-background border-2 border-purple-500 rounded-lg p-4 text-center">
                            <Globe className="h-7 w-7 mx-auto mb-2 text-purple-600" />
                            <p className="font-semibold text-sm mb-1">Dify Platform</p>
                            <Badge variant="secondary" className="text-xs">:3002</Badge>
                          </div>
                          <div className="bg-muted/20 border-2 rounded-lg p-4 text-center">
                            <MonitorPlay className="h-7 w-7 mx-auto mb-2 text-muted-foreground" />
                            <div className="flex items-center justify-center gap-2 mb-1">
                              <p className="font-semibold text-sm">Open WebUI</p>
                              <Badge variant="outline" className="text-xs">Inactive</Badge>
                            </div>
                            <Badge variant="secondary" className="text-xs">:3001</Badge>
                          </div>
                        </div>

                        {/* Direct LLM API with expandable details */}
                        <Collapsible defaultOpen className="max-w-full mx-auto">
                          <div className="bg-background border-2 border-purple-500 rounded-lg overflow-hidden">
                            <div className="flex items-center justify-between p-4">
                              <div className="flex items-center gap-4 flex-1">
                                <Network className="h-7 w-7 text-purple-600" />
                                <div className="text-left">
                                  <p className="font-semibold text-sm mb-1">Direct LLM API</p>
                                </div>
                                <Badge variant="secondary" className="text-xs">:808X</Badge>
                              </div>
                              <CollapsibleTrigger asChild>
                                <button className="p-2 hover:bg-muted rounded-md transition-colors">
                                  <ChevronDown className="h-5 w-5 transition-transform duration-200 data-[state=open]:rotate-180" />
                                </button>
                              </CollapsibleTrigger>
                            </div>

                            <CollapsibleContent>
                              <div className="border-t-2 border-purple-500/30 p-4 bg-purple-500/5">
                                <h4 className="font-bold text-sm mb-3 text-purple-700 dark:text-purple-400">LLM 모델 서비스 상세</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                  <div className="border-2 border-green-500/50 rounded-lg p-3 bg-green-500/5">
                                    <div className="flex items-center justify-between mb-2">
                                      <p className="font-semibold text-sm">GPT-OSS 20B</p>
                                      <Badge className="bg-green-500 text-xs">Running</Badge>
                                    </div>
                                    <div className="flex flex-wrap gap-1 mb-2">
                                      <Badge variant="outline" className="text-xs">🇺🇸 미국</Badge>
                                      <Badge variant="secondary" className="text-xs">일반 대화·추론</Badge>
                                    </div>
                                    <div className="space-y-1 text-xs text-muted-foreground">
                                      <p>포트: 8080 | VRAM: ~16GB</p>
                                      <p>서버: llama.cpp</p>
                                    </div>
                                  </div>

                                  <div className="border-2 rounded-lg p-3 bg-muted/20">
                                    <div className="flex items-center justify-between mb-2">
                                      <p className="font-semibold text-sm">EXAONE 32B</p>
                                      <Badge variant="outline" className="text-xs">Inactive</Badge>
                                    </div>
                                    <div className="flex flex-wrap gap-1 mb-2">
                                      <Badge variant="outline" className="text-xs">🇰🇷 한국</Badge>
                                      <Badge variant="secondary" className="text-xs">긴 문서 처리</Badge>
                                    </div>
                                    <div className="space-y-1 text-xs text-muted-foreground">
                                      <p>포트: 8081 | VRAM: ~20GB</p>
                                      <p>특징: 131K 컨텍스트</p>
                                    </div>
                                  </div>

                                  <div className="border-2 rounded-lg p-3 bg-muted/20">
                                    <div className="flex items-center justify-between mb-2">
                                      <p className="font-semibold text-sm">HyperCLOVA X</p>
                                      <Badge variant="outline" className="text-xs">Inactive</Badge>
                                    </div>
                                    <div className="flex flex-wrap gap-1 mb-2">
                                      <Badge variant="outline" className="text-xs">🇰🇷 한국</Badge>
                                      <Badge variant="secondary" className="text-xs">한국어 특화</Badge>
                                    </div>
                                    <div className="space-y-1 text-xs text-muted-foreground">
                                      <p>포트: 8082 | VRAM: ~29GB</p>
                                      <p>서버: vLLM 0.10.2</p>
                                    </div>
                                  </div>

                                  <div className="border-2 border-green-500/50 rounded-lg p-3 bg-green-500/5">
                                    <div className="flex items-center justify-between mb-2">
                                      <p className="font-semibold text-sm">Qwen3-VL 8B</p>
                                      <Badge className="bg-green-500 text-xs">Running</Badge>
                                    </div>
                                    <div className="flex flex-wrap gap-1 mb-2">
                                      <Badge variant="outline" className="text-xs">🇨🇳 중국</Badge>
                                      <Badge variant="secondary" className="text-xs">이미지 이해·OCR</Badge>
                                    </div>
                                    <div className="space-y-1 text-xs text-muted-foreground">
                                      <p>포트: 8084 | VRAM: ~2GB</p>
                                      <p>특징: 멀티모달 (Vision)</p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </CollapsibleContent>
                          </div>
                        </Collapsible>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* Application Layer */}
                  <AccordionItem value="application" className="border-2 border-blue-500/50 rounded-lg bg-blue-500/5 px-4 overflow-visible">
                    <AccordionTrigger className="hover:no-underline py-4">
                      <div className="flex items-center gap-2">
                        <Server className="h-5 w-5 text-blue-600" />
                        <span className="font-bold text-base text-blue-700 dark:text-blue-400">Application Layer</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="pb-4">
                        {/* AI Services - 지원 서비스 상세 카드 */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                          <div className="border-2 border-orange-500/50 rounded-lg p-4 bg-orange-500/5">
                            <div className="flex items-center justify-between mb-3">
                              <p className="font-semibold text-sm">BGE-M3 Embedding</p>
                              <Badge className="bg-green-500 text-xs">Running</Badge>
                            </div>
                            <div className="space-y-1 text-xs text-muted-foreground">
                              <p>포트: 8083</p>
                              <p>VRAM: &lt;1GB</p>
                              <p>용도: 벡터 임베딩</p>
                            </div>
                          </div>

                          <div className="border-2 border-orange-500/50 rounded-lg p-4 bg-orange-500/5">
                            <div className="flex items-center justify-between mb-3">
                              <p className="font-semibold text-sm">BGE Reranker</p>
                              <Badge className="bg-green-500 text-xs">Running</Badge>
                            </div>
                            <div className="space-y-1 text-xs text-muted-foreground">
                              <p>포트: 8006</p>
                              <p>VRAM: ~1-2GB</p>
                              <p>용도: 검색 재정렬</p>
                            </div>
                          </div>

                          <div className="border-2 border-orange-500/50 rounded-lg p-4 bg-orange-500/5">
                            <div className="flex items-center justify-between mb-3">
                              <p className="font-semibold text-sm">Docling API</p>
                              <Badge className="bg-green-500 text-xs">Running</Badge>
                            </div>
                            <div className="space-y-1 text-xs text-muted-foreground">
                              <p>포트: 8007</p>
                              <p>기술: Python</p>
                              <p>기능: 문서 변환</p>
                            </div>
                          </div>

                          <div className="border-2 border-orange-500/50 rounded-lg p-4 bg-orange-500/5">
                            <div className="flex items-center justify-between mb-3">
                              <p className="font-semibold text-sm">Qdrant Vector DB</p>
                              <Badge className="bg-green-500 text-xs">Running</Badge>
                            </div>
                            <div className="space-y-1 text-xs text-muted-foreground">
                              <p>포트: 6333</p>
                              <p>기술: Vector DB</p>
                              <p>기능: 벡터 저장소</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            </CardContent>
          </Card>
        </div>
    </PageContainer>
  )
}
