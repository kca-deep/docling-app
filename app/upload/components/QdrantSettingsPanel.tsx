"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Loader2, Database, RefreshCw, Trash2, Plus, Layers, FileStack } from "lucide-react"
import { QdrantCollection } from "../types"
import { cn } from "@/lib/utils"

interface QdrantSettingsPanelProps {
  selectedCollection: string
  collections: QdrantCollection[]
  chunkSize: number
  chunkOverlap: number
  loadingCollections: boolean
  createDialogOpen: boolean
  deleteDialogOpen: boolean
  newCollectionName: string
  distance: string
  deleting: boolean
  onSelectedCollectionChange: (value: string) => void
  onChunkSizeChange: (value: number) => void
  onChunkOverlapChange: (value: number) => void
  onFetchCollections: () => void
  onCreateDialogOpenChange: (open: boolean) => void
  onDeleteDialogOpenChange: (open: boolean) => void
  onNewCollectionNameChange: (value: string) => void
  onDistanceChange: (value: string) => void
  onCreateCollection: () => void
  onDeleteCollection: () => void
}

export function QdrantSettingsPanel({
  selectedCollection,
  collections,
  chunkSize,
  chunkOverlap,
  loadingCollections,
  createDialogOpen,
  deleteDialogOpen,
  newCollectionName,
  distance,
  deleting,
  onSelectedCollectionChange,
  onChunkSizeChange,
  onChunkOverlapChange,
  onFetchCollections,
  onCreateDialogOpenChange,
  onDeleteDialogOpenChange,
  onNewCollectionNameChange,
  onDistanceChange,
  onCreateCollection,
  onDeleteCollection,
}: QdrantSettingsPanelProps) {
  // 선택된 컬렉션 정보 찾기
  const selectedCollectionInfo = collections.find(col => col.name === selectedCollection)

  return (
    <div className="space-y-4">
      {/* Collection 선택 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="qdrant-collection" className="text-sm font-semibold">Collection</Label>
          {selectedCollectionInfo && (
            <div className="flex items-center gap-1.5">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className="text-xs gap-1">
                      <Layers className="h-3 w-3" />
                      {selectedCollectionInfo.points_count.toLocaleString()}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">총 포인트 수</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="secondary" className="text-xs gap-1">
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
          <SelectTrigger id="qdrant-collection" className="h-10">
            <SelectValue placeholder="Collection 선택" />
          </SelectTrigger>
          <SelectContent>
            {collections.map((col) => (
              <SelectItem key={col.name} value={col.name}>
                <div className="flex items-center justify-between w-full gap-3">
                  <span className="font-medium">{col.name}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {col.points_count.toLocaleString()}p
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {col.vectors_count.toLocaleString()}v
                    </Badge>
                  </div>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Collection 관리 버튼 - Chat 스타일 */}
      <div className="flex items-center gap-1.5 justify-end">
        <Dialog open={createDialogOpen} onOpenChange={onCreateDialogOpenChange}>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-9 w-9">
                    <Plus className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">새 Collection 생성</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>새 Collection 생성</DialogTitle>
                  <DialogDescription>
                    새로운 Qdrant Collection을 생성합니다
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="newCollectionName">Collection 이름</Label>
                    <Input
                      id="newCollectionName"
                      placeholder="예: documents"
                      value={newCollectionName}
                      onChange={(e) => onNewCollectionNameChange(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Vector 크기</Label>
                    <Input value="1024 (BGE-M3 고정)" disabled />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="qdrant-distance">Distance Metric</Label>
                    <Select value={distance} onValueChange={onDistanceChange}>
                      <SelectTrigger id="qdrant-distance">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Cosine">Cosine</SelectItem>
                        <SelectItem value="Euclidean">Euclidean</SelectItem>
                        <SelectItem value="Dot">Dot</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => onCreateDialogOpenChange(false)}>
                    취소
                  </Button>
                  <Button onClick={onCreateCollection}>
                    <Database className="h-4 w-4 mr-2" />
                    생성
                  </Button>
                </DialogFooter>
              </DialogContent>
        </Dialog>

        <Dialog open={deleteDialogOpen} onOpenChange={onDeleteDialogOpenChange}>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <DialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={!selectedCollection}
                    className="h-9 w-9"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">Collection 삭제</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Collection 삭제</DialogTitle>
                  <DialogDescription>
                    정말로 이 Collection을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                  <Alert>
                    <AlertDescription>
                      <strong>{selectedCollection}</strong> Collection이 삭제됩니다.
                    </AlertDescription>
                  </Alert>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => onDeleteDialogOpenChange(false)}>
                    취소
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={onDeleteCollection}
                    disabled={deleting}
                  >
                    {deleting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        삭제 중...
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-4 w-4 mr-2" />
                        삭제
                      </>
                    )}
                  </Button>
                </DialogFooter>
          </DialogContent>
        </Dialog>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={onFetchCollections}
                disabled={loadingCollections}
                variant="ghost"
                size="icon"
                className="h-9 w-9"
              >
                {loadingCollections ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
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
        <div className="flex items-center gap-2">
          <div className="h-1 w-1 rounded-full bg-foreground" />
          <Label className="text-sm font-semibold">청킹 설정</Label>
        </div>

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
                className="pr-12"
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
                className="pr-12"
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
