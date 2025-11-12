"use client"

import { PageContainer } from "@/components/page-container"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Server, Cpu, HardDrive, Network, Database, Boxes, Globe, MonitorPlay } from "lucide-react"

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
              <div className="p-6 space-y-6">
                {/* Entry Points */}
                <div className="border-2 border-dashed border-purple-500/50 rounded-lg p-6 bg-purple-500/5">
                  <h3 className="font-bold text-center mb-5 text-base text-purple-700 dark:text-purple-400">Entry Points</h3>
                  <div className="flex gap-4 justify-center">
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
                </div>

                {/* Application Layer - Docker 영역과 AI Services 영역을 나란히 배치 */}
                <div className="flex gap-4">
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

                {/* GPU & Storage - 하단에 나란히 배치 */}
                <div className="flex gap-4">
                  {/* GPU Layer */}
                  <div className="border-2 border-dashed border-red-500/50 rounded-lg p-5 bg-red-500/5 flex-1">
                    <div className="bg-background border-2 border-red-600 rounded-lg p-5 text-center">
                      <Cpu className="h-10 w-10 mx-auto mb-3 text-red-600" />
                      <h3 className="font-bold text-base mb-2">NVIDIA RTX 5090</h3>
                      <p className="text-xs text-muted-foreground mb-3">32GB VRAM (30.75GB 사용 가능)</p>
                      <div className="space-y-2">
                        <div className="border rounded-lg p-3 bg-muted/30">
                          <p className="text-muted-foreground mb-1 text-xs">대형 모델</p>
                          <p className="font-semibold text-xs">1개만 동시 실행</p>
                        </div>
                        <div className="border rounded-lg p-3 bg-muted/30">
                          <p className="text-muted-foreground mb-1 text-xs">소형 모델</p>
                          <p className="font-semibold text-xs">여러 개 동시 가능</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 스토리지 정보 */}
                  <div className="border-2 border-dashed border-slate-500/50 rounded-lg p-5 bg-slate-500/5 flex-1">
                    <div className="bg-background border-2 rounded-lg p-5">
                      <div className="flex items-center justify-center gap-2 mb-4">
                        <HardDrive className="h-5 w-5" />
                        <h3 className="font-bold text-base">Storage</h3>
                      </div>
                      <div className="space-y-3">
                        <div className="border rounded-lg p-3 text-center bg-muted/30">
                          <p className="text-muted-foreground text-xs mb-1">/models</p>
                          <p className="font-semibold text-sm">1.8TB</p>
                          <p className="text-xs text-muted-foreground mt-1">(9% 사용)</p>
                        </div>
                        <div className="border rounded-lg p-3 text-center bg-muted/30">
                          <p className="text-muted-foreground text-xs mb-1">Root</p>
                          <p className="font-semibold text-xs">시스템 및 애플리케이션</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

        {/* LLM 서비스 상세 */}
        <Card>
          <CardHeader>
            <CardTitle>LLM 모델 서비스 상세</CardTitle>
            <CardDescription>대형 모델 (상호 배타적) 및 소형 모델 정보</CardDescription>
          </CardHeader>
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
        </Card>

        {/* 지원 서비스 상세 */}
        <Card>
          <CardHeader>
            <CardTitle>지원 서비스 상세</CardTitle>
            <CardDescription>임베딩, 리랭킹, 문서 처리 서비스</CardDescription>
          </CardHeader>
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
        </Card>
      </div>
    </PageContainer>
  )
}
