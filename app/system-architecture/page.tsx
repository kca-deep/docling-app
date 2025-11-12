"use client"

import { PageContainer } from "@/components/page-container"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Server, Cpu, HardDrive, Network, Database, Boxes, Globe, MonitorPlay, ChevronDown } from "lucide-react"

export default function SystemArchitecturePage() {
  return (
    <PageContainer
      title="시스템 구성도"
      description="RTX 5090 GPU 서버의 하드웨어 및 서비스 구성 정보"
    >
      <div className="space-y-6">
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

                <Accordion type="multiple" defaultValue={["entry", "application", "hardware"]} className="space-y-4 mt-4">
                  {/* Entry Points */}
                  <AccordionItem value="entry" className="border-2 border-purple-500/50 rounded-lg bg-purple-500/5 px-4">
                    <AccordionTrigger className="hover:no-underline py-4">
                      <div className="flex items-center gap-2">
                        <Globe className="h-5 w-5 text-purple-600" />
                        <span className="font-bold text-base text-purple-700 dark:text-purple-400">Entry Points</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="flex gap-4 justify-center pb-4">
                        <div className="bg-background border-2 border-purple-500 rounded-lg p-4 text-center flex-1 max-w-[260px]">
                          <Globe className="h-7 w-7 mx-auto mb-2 text-purple-600" />
                          <p className="font-semibold text-sm mb-1">Dify Platform</p>
                          <p className="text-xs text-muted-foreground mb-2">kca-ai.kro.kr</p>
                          <Badge variant="secondary" className="text-xs">:80, :443</Badge>
                        </div>
                        <div className="bg-background border-2 border-purple-500 rounded-lg p-4 text-center flex-1 max-w-[260px]">
                          <MonitorPlay className="h-7 w-7 mx-auto mb-2 text-purple-600" />
                          <p className="font-semibold text-sm mb-1">Open WebUI</p>
                          <p className="text-xs text-muted-foreground mb-2">localhost</p>
                          <Badge variant="secondary" className="text-xs">:3000</Badge>
                        </div>
                        <div className="bg-background border-2 border-purple-500 rounded-lg p-4 text-center flex-1 max-w-[260px]">
                          <Network className="h-7 w-7 mx-auto mb-2 text-purple-600" />
                          <p className="font-semibold text-sm mb-1">Direct LLM API</p>
                          <p className="text-xs text-muted-foreground mb-2">112.173.179.199</p>
                          <Badge variant="secondary" className="text-xs">:808X</Badge>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* Application Layer */}
                  <AccordionItem value="application" className="border-2 border-blue-500/50 rounded-lg bg-blue-500/5 px-4">
                    <AccordionTrigger className="hover:no-underline py-4">
                      <div className="flex items-center gap-2">
                        <Server className="h-5 w-5 text-blue-600" />
                        <span className="font-bold text-base text-blue-700 dark:text-blue-400">Application Layer</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="flex gap-4 pb-4">
                        {/* Docker 컨테이너 */}
                        <div className="border-2 border-dashed border-green-500/50 rounded-lg p-5 bg-green-500/5 flex-1">
                          <h3 className="font-bold text-center mb-4 text-sm text-green-700 dark:text-green-400 flex items-center justify-center gap-2">
                            <Boxes className="h-4 w-4" />
                            Docker Container
                          </h3>

                          {/* Dify Services */}
                          <div className="space-y-3 mb-4">
                            <div className="bg-background border-2 border-green-600 rounded-lg p-3">
                              <p className="font-semibold text-sm mb-2">Dify Platform</p>
                              <div className="space-y-1.5 text-xs">
                                <div className="flex justify-between items-center">
                                  <span>Nginx</span>
                                  <Badge variant="secondary" className="text-xs">80, 443</Badge>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span>Web UI</span>
                                  <Badge variant="secondary" className="text-xs">3002</Badge>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span>API</span>
                                  <Badge variant="secondary" className="text-xs">5001</Badge>
                                </div>
                              </div>
                            </div>

                            {/* Data Stores */}
                            <div className="bg-background border-2 border-green-600 rounded-lg p-3">
                              <p className="font-semibold text-sm mb-2">Data Stores</p>
                              <div className="flex gap-2 justify-around text-xs">
                                <div className="text-center">
                                  <Database className="h-5 w-5 mx-auto mb-1" />
                                  <p>PostgreSQL</p>
                                </div>
                                <div className="text-center">
                                  <Database className="h-5 w-5 mx-auto mb-1" />
                                  <p>Redis</p>
                                </div>
                                <div className="text-center">
                                  <Database className="h-5 w-5 mx-auto mb-1" />
                                  <p>Weaviate</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* AI Services */}
                        <div className="border-2 border-dashed border-orange-500/50 rounded-lg p-5 bg-orange-500/5 flex-1">
                          <h3 className="font-bold text-center mb-4 text-sm text-orange-700 dark:text-orange-400">AI Services Layer</h3>

                          {/* LLM Models */}
                          <div className="space-y-2 mb-3">
                            <p className="font-semibold text-sm">LLM Models</p>
                            <div className="bg-background border-2 border-orange-600 rounded-lg p-3 space-y-1.5 text-xs">
                              <div className="flex justify-between items-center">
                                <span>GPT-OSS 20B</span>
                                <Badge variant="outline" className="text-xs">8080</Badge>
                              </div>
                              <div className="flex justify-between items-center">
                                <span>EXAONE 32B</span>
                                <Badge variant="outline" className="text-xs">8081</Badge>
                              </div>
                              <div className="flex justify-between items-center">
                                <span>HyperCLOVA X</span>
                                <Badge variant="outline" className="text-xs">8082</Badge>
                              </div>
                              <div className="flex justify-between items-center">
                                <span>Qwen3-VL 8B</span>
                                <Badge className="bg-green-500 text-xs">8084 ✓</Badge>
                              </div>
                            </div>
                          </div>

                          {/* Support Services */}
                          <div className="space-y-2">
                            <p className="font-semibold text-sm">Support Services</p>
                            <div className="bg-background border-2 border-orange-600 rounded-lg p-3 space-y-1.5 text-xs">
                              <div className="flex justify-between items-center">
                                <span>BGE Embedding</span>
                                <Badge className="bg-green-500 text-xs">8083 ✓</Badge>
                              </div>
                              <div className="flex justify-between items-center">
                                <span>BGE Reranker</span>
                                <Badge variant="outline" className="text-xs">8006</Badge>
                              </div>
                              <div className="flex justify-between items-center">
                                <span>Docling API</span>
                                <Badge variant="outline" className="text-xs">8007</Badge>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* Hardware Resources */}
                  <AccordionItem value="hardware" className="border-2 border-slate-500/50 rounded-lg bg-slate-500/5 px-4">
                    <AccordionTrigger className="hover:no-underline py-4">
                      <div className="flex items-center gap-2">
                        <HardDrive className="h-5 w-5 text-slate-600" />
                        <span className="font-bold text-base text-slate-700 dark:text-slate-400">Hardware Resources</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="flex gap-4 pb-4">
                        {/* GPU Layer */}
                        <div className="border-2 border-dashed border-red-500/50 rounded-lg p-5 bg-red-500/5 flex-1">
                          <div className="bg-background border-2 border-red-600 rounded-lg p-5">
                            <div className="text-center mb-4">
                              <Cpu className="h-10 w-10 mx-auto mb-2 text-red-600" />
                              <h3 className="font-bold text-base">GPU Status</h3>
                            </div>

                            {/* GPU 기본 정보 */}
                            <div className="grid grid-cols-2 gap-3 mb-4">
                              <div className="border rounded-lg p-2 bg-muted/30 text-center">
                                <p className="text-muted-foreground text-xs mb-1">사용률</p>
                                <p className="font-semibold text-sm">0%</p>
                              </div>
                              <div className="border rounded-lg p-2 bg-muted/30 text-center">
                                <p className="text-muted-foreground text-xs mb-1">온도</p>
                                <p className="font-semibold text-sm">37°C</p>
                              </div>
                              <div className="border rounded-lg p-2 bg-muted/30 text-center">
                                <p className="text-muted-foreground text-xs mb-1">전력</p>
                                <p className="font-semibold text-sm">7W / 600W</p>
                              </div>
                              <div className="border rounded-lg p-2 bg-muted/30 text-center">
                                <p className="text-muted-foreground text-xs mb-1">VRAM</p>
                                <p className="font-semibold text-sm">87%</p>
                              </div>
                            </div>

                            {/* VRAM 전체 사용량 */}
                            <div className="border rounded-lg p-3 bg-muted/30 mb-3">
                              <div className="flex items-center justify-between mb-2">
                                <p className="text-muted-foreground text-xs">VRAM 사용량</p>
                                <p className="font-semibold text-xs">28504MB / 32607MB</p>
                              </div>
                              <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2">
                                <div className="bg-orange-500 h-2 rounded-full" style={{width: '87%'}}></div>
                              </div>
                            </div>

                            {/* 프로세스별 VRAM */}
                            <div className="space-y-2">
                              <p className="text-xs font-semibold text-muted-foreground">프로세스별 VRAM</p>

                              <div className="border rounded-lg p-2 bg-green-500/10">
                                <div className="flex items-center justify-between mb-1">
                                  <p className="text-xs font-medium">GPT-OSS 20B</p>
                                  <p className="text-xs font-semibold">13.99 GB (43%)</p>
                                </div>
                                <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-1.5">
                                  <div className="bg-green-500 h-1.5 rounded-full" style={{width: '43%'}}></div>
                                </div>
                              </div>

                              <div className="border rounded-lg p-2 bg-green-500/10">
                                <div className="flex items-center justify-between mb-1">
                                  <p className="text-xs font-medium">Qwen3-VL 8B</p>
                                  <p className="text-xs font-semibold">12.21 GB (38%)</p>
                                </div>
                                <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-1.5">
                                  <div className="bg-green-500 h-1.5 rounded-full" style={{width: '38%'}}></div>
                                </div>
                              </div>

                              <div className="border rounded-lg p-2 bg-blue-500/10">
                                <div className="flex items-center justify-between mb-1">
                                  <p className="text-xs font-medium">Docling</p>
                                  <p className="text-xs font-semibold">1.60 GB (5%)</p>
                                </div>
                                <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-1.5">
                                  <div className="bg-blue-500 h-1.5 rounded-full" style={{width: '5%'}}></div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* 스토리지 정보 */}
                        <div className="border-2 border-dashed border-slate-600/50 rounded-lg p-5 bg-slate-600/5 flex-1">
                          <div className="bg-background border-2 rounded-lg p-5">
                            <div className="flex items-center justify-center gap-2 mb-4">
                              <HardDrive className="h-5 w-5" />
                              <h3 className="font-bold text-base">Storage</h3>
                            </div>
                            <div className="space-y-3">
                              <div className="border rounded-lg p-3 bg-muted/30">
                                <div className="flex items-center justify-between mb-2">
                                  <p className="text-muted-foreground text-xs">/ (root)</p>
                                  <p className="font-semibold text-xs">67%</p>
                                </div>
                                <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2 mb-1">
                                  <div className="bg-orange-500 h-2 rounded-full" style={{width: '67%'}}></div>
                                </div>
                                <p className="text-xs text-center text-muted-foreground">62G / 98G</p>
                              </div>

                              <div className="border rounded-lg p-3 bg-muted/30">
                                <div className="flex items-center justify-between mb-2">
                                  <p className="text-muted-foreground text-xs">/models</p>
                                  <p className="font-semibold text-xs">10%</p>
                                </div>
                                <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2 mb-1">
                                  <div className="bg-green-500 h-2 rounded-full" style={{width: '10%'}}></div>
                                </div>
                                <p className="text-xs text-center text-muted-foreground">170G / 1.8T</p>
                              </div>

                              <div className="border rounded-lg p-3 bg-muted/30">
                                <div className="flex items-center justify-between mb-2">
                                  <p className="text-muted-foreground text-xs">/data</p>
                                  <p className="font-semibold text-xs">2%</p>
                                </div>
                                <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2 mb-1">
                                  <div className="bg-green-500 h-2 rounded-full" style={{width: '2%'}}></div>
                                </div>
                                <p className="text-xs text-center text-muted-foreground">12G / 916G</p>
                              </div>
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

        {/* LLM 서비스 상세 */}
        <Collapsible defaultOpen>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>LLM 모델 서비스 상세</CardTitle>
                  <CardDescription>대형 모델 (상호 배타적) 및 소형 모델 정보</CardDescription>
                </div>
                <CollapsibleTrigger asChild>
                  <button className="p-2 hover:bg-muted rounded-md transition-colors">
                    <ChevronDown className="h-5 w-5 transition-transform duration-200 data-[state=open]:rotate-180" />
                  </button>
                </CollapsibleTrigger>
              </div>
            </CardHeader>
            <CollapsibleContent>
              <CardContent>
                <div className="grid grid-cols-4 gap-3">
                  <div className="border-2 border-green-500/50 rounded-lg p-3 bg-green-500/5">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-semibold text-sm">GPT-OSS 20B</p>
                      <Badge className="bg-green-500 text-xs">Running</Badge>
                    </div>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <p>포트: 8080</p>
                      <p>VRAM: ~16GB</p>
                      <p>서버: llama.cpp</p>
                    </div>
                  </div>

                  <div className="border-2 rounded-lg p-3 bg-muted/20">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-semibold text-sm">EXAONE 32B</p>
                      <Badge variant="outline" className="text-xs">Inactive</Badge>
                    </div>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <p>포트: 8081</p>
                      <p>VRAM: ~20GB</p>
                      <p>특징: 131K 컨텍스트</p>
                    </div>
                  </div>

                  <div className="border-2 rounded-lg p-3 bg-muted/20">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-semibold text-sm">HyperCLOVA X</p>
                      <Badge variant="outline" className="text-xs">Inactive</Badge>
                    </div>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <p>포트: 8082</p>
                      <p>VRAM: ~29GB</p>
                      <p>서버: vLLM 0.10.2</p>
                    </div>
                  </div>

                  <div className="border-2 border-green-500/50 rounded-lg p-3 bg-green-500/5">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-semibold text-sm">Qwen3-VL 8B</p>
                      <Badge className="bg-green-500 text-xs">Running</Badge>
                    </div>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <p>포트: 8084</p>
                      <p>VRAM: ~2GB</p>
                      <p>특징: 멀티모달 (Vision)</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* 지원 서비스 상세 */}
        <Collapsible defaultOpen>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>지원 서비스 상세</CardTitle>
                  <CardDescription>임베딩, 리랭킹, 문서 처리 서비스</CardDescription>
                </div>
                <CollapsibleTrigger asChild>
                  <button className="p-2 hover:bg-muted rounded-md transition-colors">
                    <ChevronDown className="h-5 w-5 transition-transform duration-200 data-[state=open]:rotate-180" />
                  </button>
                </CollapsibleTrigger>
              </div>
            </CardHeader>
            <CollapsibleContent>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <div className="border-2 border-green-500/50 rounded-lg p-3 bg-green-500/5">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-semibold text-sm">BGE-M3 Embedding</p>
                      <Badge className="bg-green-500 text-xs">Running</Badge>
                    </div>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <p>포트: 8083</p>
                      <p>VRAM: &lt;1GB</p>
                      <p>용도: 벡터 임베딩</p>
                    </div>
                  </div>

                  <div className="border-2 border-green-500/50 rounded-lg p-3 bg-green-500/5">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-semibold text-sm">BGE Reranker</p>
                      <Badge className="bg-green-500 text-xs">Running</Badge>
                    </div>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <p>포트: 8006</p>
                      <p>VRAM: ~1-2GB</p>
                      <p>용도: 검색 재정렬</p>
                    </div>
                  </div>

                  <div className="border-2 border-green-500/50 rounded-lg p-3 bg-green-500/5">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-semibold text-sm">Docling API</p>
                      <Badge className="bg-green-500 text-xs">Running</Badge>
                    </div>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <p>포트: 8007</p>
                      <p>기술: Python</p>
                      <p>기능: 문서 변환</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      </div>
    </PageContainer>
  )
}
