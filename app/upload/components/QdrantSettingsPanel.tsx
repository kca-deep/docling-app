"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { Loader2, Database, RefreshCw, Trash2, Plus } from "lucide-react"
import { QdrantCollection } from "../types"

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
  return (
    <div className="space-y-3">
      {/* Collection 선택 */}
      <div className="space-y-2">
        <Label htmlFor="qdrant-collection">Collection</Label>
        <Select value={selectedCollection} onValueChange={onSelectedCollectionChange}>
              <SelectTrigger id="qdrant-collection">
                <SelectValue placeholder="Collection 선택" />
              </SelectTrigger>
              <SelectContent>
                {collections.map((col) => (
                  <SelectItem key={col.name} value={col.name}>
                    {col.name} ({col.points_count.toLocaleString()}p)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Collection 관리 버튼 */}
          <div className="flex flex-wrap gap-2">
            <Dialog open={createDialogOpen} onOpenChange={onCreateDialogOpenChange}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="flex-1">
                  <Plus className="h-4 w-4 mr-1" />
                  생성
                </Button>
              </DialogTrigger>
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
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!selectedCollection}
                  className="flex-1"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  삭제
                </Button>
              </DialogTrigger>
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

            <Button
              onClick={onFetchCollections}
              disabled={loadingCollections}
              variant="outline"
              size="sm"
              className="flex-1"
            >
              {loadingCollections ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-1" />
              )}
              새로고침
            </Button>
          </div>

        <Separator />

        {/* 청킹 설정 */}
        <div className="space-y-2">
          <Label htmlFor="qdrant-chunkSize">Chunk Size (토큰)</Label>
          <Input
            id="qdrant-chunkSize"
            type="number"
            value={chunkSize}
            onChange={(e) => onChunkSizeChange(parseInt(e.target.value))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="qdrant-chunkOverlap">Chunk Overlap (토큰)</Label>
          <Input
            id="qdrant-chunkOverlap"
            type="number"
            value={chunkOverlap}
            onChange={(e) => onChunkOverlapChange(parseInt(e.target.value))}
          />
        </div>
    </div>
  )
}
