"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { FileStack } from "lucide-react"
import { QdrantCollection } from "../types"
import { CollectionSelector } from "@/components/ui/collection-selector"

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
  return (
    <div className="space-y-4">
      {/* Collection 선택 - 모달 방식 */}
      <CollectionSelector
        value={selectedCollection}
        onValueChange={onSelectedCollectionChange}
        collections={collections}
        loading={loadingCollections}
        onRefresh={onFetchCollections}
        showUncategorized={false}
        showManageLink={true}
        variant="modal"
        columns={2}
        label="Collection"
        modalTitle="업로드할 컬렉션 선택"
      />

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
