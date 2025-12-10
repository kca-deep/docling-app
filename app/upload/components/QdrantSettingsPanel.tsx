"use client"

import Link from "next/link"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Loader2, RefreshCw, Layers, FileStack, Settings, Globe, Lock, Users } from "lucide-react"
import { QdrantCollection } from "../types"

interface QdrantSettingsPanelProps {
  selectedCollection: string
  collections: QdrantCollection[]
  chunkSize: number
  chunkOverlap: number
  loadingCollections: boolean
  onSelectedCollectionChange: (value: string) => void
  onChunkSizeChange: (value: number) => void
  onChunkOverlapChange: (value: number) => void
  onFetchCollections: () => void
}

// Visibility icon helper
function VisibilityIcon({ visibility }: { visibility?: string }) {
  switch (visibility) {
    case "private":
      return <Lock className="h-3 w-3" />
    case "shared":
      return <Users className="h-3 w-3" />
    default:
      return <Globe className="h-3 w-3" />
  }
}

export function QdrantSettingsPanel({
  selectedCollection,
  collections,
  chunkSize,
  chunkOverlap,
  loadingCollections,
  onSelectedCollectionChange,
  onChunkSizeChange,
  onChunkOverlapChange,
  onFetchCollections,
}: QdrantSettingsPanelProps) {
  // 선택된 컬렉션 정보 찾기
  const selectedCollectionInfo = collections.find(col => col.name === selectedCollection)

  return (
    <div className="space-y-4">
      {/* Collection 선택 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label htmlFor="qdrant-collection" className="text-sm font-semibold flex items-center gap-2">
            <Layers className="h-4 w-4 text-[color:var(--chart-1)]" />
            Collection
          </Label>
          {selectedCollectionInfo && (
            <div className="flex items-center gap-1.5">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className="text-xs gap-1 border-[color:var(--chart-1)]/30">
                      <VisibilityIcon visibility={selectedCollectionInfo.visibility} />
                      {selectedCollectionInfo.visibility || "public"}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">공개 설정</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="secondary" className="text-xs gap-1 bg-[color:var(--chart-1)]/10 text-[color:var(--chart-1)]">
                      <FileStack className="h-3 w-3" />
                      {selectedCollectionInfo.vectors_count.toLocaleString()}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">벡터 수</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}
        </div>
        <Select value={selectedCollection} onValueChange={onSelectedCollectionChange}>
          <SelectTrigger id="qdrant-collection" className="h-11 bg-background/50 border-border/50 focus:border-[color:var(--chart-1)]/30 transition-colors">
            <SelectValue placeholder="Collection 선택" />
          </SelectTrigger>
          <SelectContent>
            {collections.length === 0 ? (
              <div className="px-2 py-3 text-center text-sm text-muted-foreground">
                접근 가능한 컬렉션이 없습니다
              </div>
            ) : (
              collections.map((col) => (
                <SelectItem key={col.name} value={col.name}>
                  <div className="flex items-center justify-between w-full gap-3">
                    <span className="font-medium">{col.name}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs gap-1">
                        <VisibilityIcon visibility={col.visibility} />
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {col.vectors_count.toLocaleString()}v
                      </Badge>
                    </div>
                  </div>
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Collection 관리 링크 및 새로고침 */}
      <div className="flex items-center gap-1.5 justify-between">
        <Link href="/collections">
          <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-[color:var(--chart-1)] transition-colors">
            <Settings className="h-3.5 w-3.5" />
            컬렉션 관리
          </Button>
        </Link>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={onFetchCollections}
                disabled={loadingCollections}
                variant="ghost"
                size="icon"
                className="h-8 w-8 hover:bg-[color:var(--chart-1)]/10 hover:text-[color:var(--chart-1)] transition-colors"
              >
                {loadingCollections ? (
                  <Loader2 className="h-4 w-4 animate-spin text-[color:var(--chart-1)]" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">Collection 목록 새로고침</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <Separator className="my-4" />

      {/* 청킹 설정 - 개선된 레이아웃 */}
      <div className="space-y-3">
        <Label className="text-sm font-semibold flex items-center gap-2">
          <FileStack className="h-4 w-4 text-[color:var(--chart-1)]" />
          청킹 설정
        </Label>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Label htmlFor="qdrant-chunkSize" className="text-xs text-muted-foreground cursor-help flex items-center gap-1">
                    Chunk Size
                  </Label>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">문서를 나눌 토큰 단위</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <div className="relative">
              <Input
                id="qdrant-chunkSize"
                type="number"
                value={chunkSize}
                onChange={(e) => onChunkSizeChange(parseInt(e.target.value))}
                className="pr-12 bg-background/50 border-border/50 focus:border-[color:var(--chart-1)]/30 transition-colors"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                토큰
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Label htmlFor="qdrant-chunkOverlap" className="text-xs text-muted-foreground cursor-help flex items-center gap-1">
                    Chunk Overlap
                  </Label>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">청크 간 중복 토큰 수</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <div className="relative">
              <Input
                id="qdrant-chunkOverlap"
                type="number"
                value={chunkOverlap}
                onChange={(e) => onChunkOverlapChange(parseInt(e.target.value))}
                className="pr-12 bg-background/50 border-border/50 focus:border-[color:var(--chart-1)]/30 transition-colors"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                토큰
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
