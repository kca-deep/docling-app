"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Pagination, PaginationContent, PaginationItem, PaginationLink } from "@/components/ui/pagination"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Loader2, FileText, Search, X, FileQuestion, Database, FolderInput, Trash2, ChevronLeft, ChevronRight } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { QdrantCollection } from "../types"
import { cn } from "@/lib/utils"
import { Document } from "../types"

interface DocumentSelectorProps {
  documents: Document[]
  selectedDocs: Set<number>
  selectedDocsInfo: Map<number, string>
  currentPage: number
  totalPages: number
  totalDocs: number
  pageSize: number
  searchInput: string
  searchQuery: string
  loadingDocuments: boolean
  onToggleDocument: (id: number, filename?: string) => void
  onToggleAll: () => void
  onDeselectDocument: (id: number) => void
  onSearch: () => void
  onSearchInputChange: (value: string) => void
  onSearchReset: () => void
  onPageChange: (page: number) => void
  onOpenDocumentViewer: (documentId: number) => void
  // 카테고리 필터 관련
  collections?: QdrantCollection[]
  categoryFilter?: string
  onCategoryFilterChange?: (category: string) => void
  // 카테고리 이동 관련
  onMoveCategory?: (documentIds: number[], category: string | null) => void
  movingCategory?: boolean
  // 문서 삭제 관련
  onDeleteSelected?: () => void
  deletingDocuments?: boolean
}

// Pagination constants
const PAGES_PER_BLOCK = 10

export function DocumentSelector({
  documents,
  selectedDocs,
  selectedDocsInfo,
  currentPage,
  totalPages,
  totalDocs,
  pageSize,
  searchInput,
  searchQuery,
  loadingDocuments,
  onToggleDocument,
  onToggleAll,
  onDeselectDocument,
  onSearch,
  onSearchInputChange,
  onSearchReset,
  onPageChange,
  onOpenDocumentViewer,
  // 카테고리 관련
  collections = [],
  categoryFilter = "",
  onCategoryFilterChange,
  onMoveCategory,
  movingCategory = false,
  // 문서 삭제 관련
  onDeleteSelected,
  deletingDocuments = false,
}: DocumentSelectorProps) {
  // Pagination calculations
  const currentBlock = Math.floor((currentPage - 1) / PAGES_PER_BLOCK)
  const startPage = currentBlock * PAGES_PER_BLOCK + 1
  const endPage = Math.min(startPage + PAGES_PER_BLOCK - 1, totalPages)

  const goToPreviousBlock = () => {
    if (currentBlock > 0) {
      onPageChange((currentBlock - 1) * PAGES_PER_BLOCK + PAGES_PER_BLOCK)
    }
  }

  const goToNextBlock = () => {
    if (endPage < totalPages) {
      onPageChange((currentBlock + 1) * PAGES_PER_BLOCK + 1)
    }
  }

  // 카테고리명을 한글명으로 변환하는 함수
  const getCategoryDisplayName = (categoryName: string | null): string => {
    if (!categoryName) return "미분류"
    const collection = collections.find(col => col.name === categoryName)
    if (collection?.description) {
      try {
        const parsed = JSON.parse(collection.description)
        if (parsed.koreanName) return parsed.koreanName
      } catch {
        // JSON 파싱 실패 시 무시
      }
    }
    return categoryName
  }

  return (
    <Card className="min-w-0 overflow-hidden border-border/50 bg-background/60 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-[color:var(--chart-1)]/10 to-[color:var(--chart-2)]/10">
            <FileText className="h-5 w-5 text-[color:var(--chart-1)]" />
          </div>
          <div>
            <CardTitle className="text-lg font-semibold">저장된 문서 목록</CardTitle>
            <CardDescription className="mt-0.5 text-sm">
              총 <span className="font-medium text-foreground">{totalDocs}</span>개 문서 중{" "}
              <span className="font-medium text-[color:var(--chart-1)]">{selectedDocs.size}</span>개 선택됨
            </CardDescription>
          </div>
        </div>

        {/* 선택된 문서 표시 */}
        {selectedDocs.size > 0 && (
          <div className="mt-4 p-3 border border-[color:var(--chart-1)]/20 rounded-xl bg-[color:var(--chart-1)]/5 overflow-hidden">
            <Label className="text-sm font-medium mb-2 block text-[color:var(--chart-1)]">
              선택된 문서 ({selectedDocs.size}개)
            </Label>
            <div className="max-h-24 overflow-y-auto">
              <div className="flex flex-wrap gap-2">
                {Array.from(selectedDocsInfo.entries()).map(([id, filename]) => (
                  <Badge
                    key={id}
                    variant="secondary"
                    className="pl-3 pr-1 py-1.5 flex items-center gap-1 max-w-xs bg-background/80 hover:bg-background transition-colors"
                  >
                    <span className="truncate text-xs">{filename}</span>
                    <button
                      onClick={() => onDeselectDocument(id)}
                      className="ml-1 rounded-full hover:bg-destructive/10 hover:text-destructive p-0.5 transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 검색 및 카테고리 필터 */}
        <div className="mt-4 p-1.5 rounded-xl bg-muted/50 border border-border/50 space-y-2">
          {/* 검색 입력 */}
          <div className="flex gap-2">
            <div className="relative flex-1 group">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-[color:var(--chart-1)] transition-colors" />
              <Input
                placeholder="파일명으로 검색..."
                value={searchInput}
                onChange={(e) => onSearchInputChange(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onSearch()}
                className="pl-10 h-10 bg-background/50 border-transparent focus:bg-background focus:border-[color:var(--chart-1)]/20 rounded-lg transition-all"
              />
            </div>
            <Button onClick={onSearch} variant="secondary" className="h-10 px-4">
              검색
            </Button>
            {searchQuery && (
              <Button onClick={onSearchReset} variant="ghost" className="h-10 px-3">
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* 카테고리 필터 & 이동 - 1열 절반씩 */}
          {collections.length > 0 && (
            <div className="flex gap-2 items-center">
              {/* 카테고리 필터 (50%) */}
              {onCategoryFilterChange && (
                <div className="flex gap-2 items-center flex-1">
                  <Database className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <Select value={categoryFilter} onValueChange={onCategoryFilterChange}>
                    <SelectTrigger className="h-9 bg-background/50 border-transparent focus:border-[color:var(--chart-4)]/20">
                      <SelectValue placeholder="전체 카테고리" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">전체</SelectItem>
                      <SelectItem value="uncategorized">미분류</SelectItem>
                      {collections.map((col) => (
                        <SelectItem key={col.name} value={col.name}>
                          <div className="flex items-center gap-2">
                            <span>{col.description ? (() => { try { const p = JSON.parse(col.description); return p.koreanName || col.name; } catch { return col.name; } })() : col.name}</span>
                            <Badge variant="secondary" className="text-xs">
                              {col.documents_count}
                            </Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* 카테고리 이동 */}
              {onMoveCategory && (
                <div className="flex gap-2 items-center flex-1">
                  <FolderInput className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <Select
                    onValueChange={(value) => {
                      const category = value === "uncategorized" ? null : value
                      onMoveCategory(Array.from(selectedDocs), category)
                    }}
                    disabled={movingCategory || selectedDocs.size === 0}
                  >
                    <SelectTrigger className="h-9 bg-background/50 border-transparent focus:border-[color:var(--chart-2)]/20">
                      <SelectValue placeholder={movingCategory ? "이동 중..." : selectedDocs.size > 0 ? `${selectedDocs.size}개 이동` : "이동할 문서 선택"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="uncategorized">미분류로 이동</SelectItem>
                      {collections.map((col) => (
                        <SelectItem key={col.name} value={col.name}>
                          {col.description ? (() => { try { const p = JSON.parse(col.description); return p.koreanName || col.name; } catch { return col.name; } })() : col.name}으로 이동
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* 선택 삭제 버튼 */}
              {onDeleteSelected && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onDeleteSelected}
                  disabled={deletingDocuments || selectedDocs.size === 0}
                  className="h-9 px-3 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30 flex-shrink-0"
                >
                  {deletingDocuments ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4 mr-1.5" />
                      삭제
                    </>
                  )}
                </Button>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loadingDocuments ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="p-4 rounded-full bg-[color:var(--chart-1)]/10 mb-4">
              <Loader2 className="h-8 w-8 animate-spin text-[color:var(--chart-1)]" />
            </div>
            <p className="text-sm text-muted-foreground">문서를 불러오는 중...</p>
          </div>
        ) : documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 border-2 border-dashed border-border/50 rounded-2xl bg-muted/5">
            <div className="p-4 rounded-full bg-muted/50 mb-4">
              <FileQuestion className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">저장된 문서가 없습니다</h3>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              먼저 문서를 파싱하고 저장해주세요.<br />
              파싱 페이지에서 PDF, DOCX 등의 문서를 업로드할 수 있습니다.
            </p>
          </div>
        ) : (
          <>
            {/* Page Info - Inline */}
            <div className="flex items-center justify-end text-sm text-muted-foreground mb-2">
              전체 {totalDocs}건 중{" "}
              <span className="font-medium text-foreground mx-1">
                {(currentPage - 1) * pageSize + 1}-
                {Math.min(currentPage * pageSize, totalDocs)}
              </span>
              건
            </div>

            <div className="border border-border/50 rounded-xl overflow-hidden">
              <Table>
              <colgroup>
                <col className="w-12" />
                <col />
                <col className="w-28" />
                <col className="w-20" />
                <col className="w-24" />
              </colgroup>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead>
                    <Checkbox
                      checked={selectedDocs.size === documents.length && documents.length > 0}
                      onCheckedChange={onToggleAll}
                    />
                  </TableHead>
                  <TableHead className="font-semibold">파일명</TableHead>
                  <TableHead className="font-semibold">카테고리</TableHead>
                  <TableHead className="text-right font-semibold">크기</TableHead>
                  <TableHead className="text-right font-semibold">생성일</TableHead>
                </TableRow>
              </TableHeader>
            </Table>
            <ScrollArea className="max-h-[420px]">
              <Table>
                <colgroup>
                  <col className="w-12" />
                  <col />
                  <col className="w-28" />
                  <col className="w-20" />
                  <col className="w-24" />
                </colgroup>
                <TableBody>
                  {documents.map((doc) => (
                    <TableRow
                      key={doc.id}
                      className={cn(
                        "transition-colors cursor-pointer",
                        selectedDocs.has(doc.id)
                          ? "bg-[color:var(--chart-1)]/5 hover:bg-[color:var(--chart-1)]/10"
                          : "hover:bg-muted/50"
                      )}
                      onClick={() => onToggleDocument(doc.id)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedDocs.has(doc.id)}
                          onCheckedChange={() => onToggleDocument(doc.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium max-w-[300px]" onClick={(e) => e.stopPropagation()}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => onOpenDocumentViewer(doc.id)}
                              className="text-left hover:text-[color:var(--chart-1)] transition-colors truncate block w-full max-w-full"
                            >
                              {doc.original_filename}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="max-w-md">
                            <p className="break-all">{doc.original_filename}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {doc.category ? (
                          <Badge variant="secondary" className="text-xs bg-[color:var(--chart-4)]/10 text-[color:var(--chart-4)]">
                            {getCategoryDisplayName(doc.category)}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground/50">미분류</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground text-sm">
                        {doc.content_length ? `${Math.round(doc.content_length / 1000)}KB` : "-"}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground text-sm">
                        {new Date(doc.created_at).toLocaleDateString("ko-KR")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
            </div>

            {/* 페이지네이션 */}
            {totalPages > 1 && (
              <div className="flex justify-center mt-4">
                <Pagination>
                  <PaginationContent>
                    {/* Previous Block Button */}
                    <PaginationItem>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1 h-8 px-2"
                        onClick={goToPreviousBlock}
                        disabled={currentBlock === 0}
                      >
                        <ChevronLeft className="h-4 w-4" />
                        <span className="hidden sm:inline">이전</span>
                      </Button>
                    </PaginationItem>

                    {/* Page Numbers */}
                    {Array.from(
                      { length: endPage - startPage + 1 },
                      (_, i) => startPage + i
                    ).map((page) => (
                      <PaginationItem key={page}>
                        <PaginationLink
                          href="#"
                          onClick={(e) => {
                            e.preventDefault()
                            onPageChange(page)
                          }}
                          isActive={page === currentPage}
                          className="h-8 w-8 p-0"
                        >
                          {page}
                        </PaginationLink>
                      </PaginationItem>
                    ))}

                    {/* Next Block Button */}
                    <PaginationItem>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1 h-8 px-2"
                        onClick={goToNextBlock}
                        disabled={endPage >= totalPages}
                      >
                        <span className="hidden sm:inline">이후</span>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
