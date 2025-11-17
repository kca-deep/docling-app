"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Loader2, FileText, Search, X } from "lucide-react"
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
    <Card className="min-w-0 overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          <div>
            <CardTitle className="text-lg">저장된 문서 목록</CardTitle>
            <CardDescription className="mt-0.5">
              총 {totalDocs}개 문서 중 {selectedDocs.size}개 선택됨
            </CardDescription>
          </div>
        </div>

        {/* 선택된 문서 표시 */}
        {selectedDocs.size > 0 && (
          <div className="mt-3 p-3 border rounded-lg bg-muted/30">
            <Label className="text-sm font-medium mb-2 block">선택된 문서 ({selectedDocs.size}개)</Label>
            <ScrollArea className="max-h-20">
              <div className="flex flex-wrap gap-2">
                {Array.from(selectedDocsInfo.entries()).map(([id, filename]) => (
                  <Badge
                    key={id}
                    variant="secondary"
                    className="pl-3 pr-1 py-1 flex items-center gap-1 max-w-xs"
                  >
                    <span className="truncate text-xs">{filename}</span>
                    <button
                      onClick={() => onDeselectDocument(id)}
                      className="ml-1 rounded-full hover:bg-muted p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* 검색 입력 */}
        <div className="mt-3 flex gap-2">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="파일명으로 검색..."
              value={searchInput}
              onChange={(e) => onSearchInputChange(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onSearch()}
              className="pl-10"
            />
          </div>
          <Button onClick={onSearch} variant="secondary">
            검색
          </Button>
          {searchQuery && (
            <Button onClick={onSearchReset} variant="outline">
              초기화
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loadingDocuments ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">문서를 불러오는 중...</p>
          </div>
        ) : documents.length === 0 ? (
          <Alert>
            <AlertDescription>
              저장된 문서가 없습니다. 먼저 문서를 파싱하고 저장해주세요.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedDocs.size === documents.length && documents.length > 0}
                      onCheckedChange={onToggleAll}
                    />
                  </TableHead>
                  <TableHead>파일명</TableHead>
                  <TableHead className="text-right">크기</TableHead>
                  <TableHead className="text-right">생성일</TableHead>
                </TableRow>
              </TableHeader>
            </Table>
            <ScrollArea className="max-h-[420px]">
              <Table>
                <TableBody>
                  {documents.map((doc) => (
                    <TableRow
                      key={doc.id}
                      className={selectedDocs.has(doc.id) ? "bg-muted/50" : ""}
                    >
                      <TableCell className="w-12">
                        <Checkbox
                          checked={selectedDocs.has(doc.id)}
                          onCheckedChange={() => onToggleDocument(doc.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium max-w-[200px]">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => onOpenDocumentViewer(doc.id)}
                              className="text-left hover:text-primary hover:underline transition-colors truncate block w-full"
                            >
                              {doc.original_filename}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{doc.original_filename}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {doc.content_length ? `${Math.round(doc.content_length / 1000)}KB` : "-"}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
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
          <div className="mt-4 flex justify-center">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => onPageChange(currentPage - 1)}
                    className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                  />
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext
                    onClick={() => onPageChange(currentPage + 1)}
                    className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
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
