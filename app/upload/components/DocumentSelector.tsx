"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "@/components/ui/pagination"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Loader2, FileText, Search, X, FileQuestion } from "lucide-react"
import { cn } from "@/lib/utils"
import { Document } from "../types"

interface DocumentSelectorProps {
  documents: Document[]
  selectedDocs: Set<number>
  selectedDocsInfo: Map<number, string>
  currentPage: number
  totalPages: number
  totalDocs: number
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
}

export function DocumentSelector({
  documents,
  selectedDocs,
  selectedDocsInfo,
  currentPage,
  totalPages,
  totalDocs,
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
}: DocumentSelectorProps) {
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
          <div className="mt-4 p-3 border border-[color:var(--chart-1)]/20 rounded-xl bg-[color:var(--chart-1)]/5">
            <Label className="text-sm font-medium mb-2 block text-[color:var(--chart-1)]">
              선택된 문서 ({selectedDocs.size}개)
            </Label>
            <ScrollArea className="max-h-20">
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
            </ScrollArea>
          </div>
        )}

        {/* 검색 입력 - sticky 스타일 */}
        <div className="mt-4 p-1.5 rounded-xl bg-muted/50 border border-border/50">
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
          <div className="border border-border/50 rounded-xl overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedDocs.size === documents.length && documents.length > 0}
                      onCheckedChange={onToggleAll}
                    />
                  </TableHead>
                  <TableHead className="font-semibold">파일명</TableHead>
                  <TableHead className="text-right font-semibold">크기</TableHead>
                  <TableHead className="text-right font-semibold">생성일</TableHead>
                </TableRow>
              </TableHeader>
            </Table>
            <ScrollArea className="max-h-[420px]">
              <Table>
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
                      <TableCell className="w-12" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedDocs.has(doc.id)}
                          onCheckedChange={() => onToggleDocument(doc.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium max-w-[200px]" onClick={(e) => e.stopPropagation()}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => onOpenDocumentViewer(doc.id)}
                              className="text-left hover:text-[color:var(--chart-1)] transition-colors truncate block w-full"
                            >
                              {doc.original_filename}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{doc.original_filename}</p>
                          </TooltipContent>
                        </Tooltip>
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
        )}

        {/* 페이지네이션 */}
        {!loadingDocuments && documents.length > 0 && totalPages > 1 && (
          <div className="mt-4 flex items-center justify-center gap-4">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => onPageChange(currentPage - 1)}
                    className={cn(
                      "transition-all",
                      currentPage === 1
                        ? "pointer-events-none opacity-50"
                        : "cursor-pointer hover:bg-[color:var(--chart-1)]/10"
                    )}
                  />
                </PaginationItem>
                <PaginationItem>
                  <span className="px-4 py-2 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">{currentPage}</span> / {totalPages}
                  </span>
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext
                    onClick={() => onPageChange(currentPage + 1)}
                    className={cn(
                      "transition-all",
                      currentPage === totalPages
                        ? "pointer-events-none opacity-50"
                        : "cursor-pointer hover:bg-[color:var(--chart-1)]/10"
                    )}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
