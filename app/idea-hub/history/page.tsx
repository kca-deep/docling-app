"use client"

import { useState, useEffect } from "react"
import { ko } from "date-fns/locale"
import { format } from "date-fns"
import { PageContainer } from "@/components/page-container"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Calendar } from "@/components/ui/calendar"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
} from "@/components/ui/pagination"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  History,
  Search,
  Download,
  MoreVertical,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Calendar as CalendarIcon,
  User,
  Building2,
  Plus,
  Loader2,
  FileSpreadsheet,
  Package,
  Merge,
  ChevronDown,
  RotateCcw,
  X,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
} from "lucide-react"
import { motion } from "framer-motion"
import { useAuth } from "@/components/auth/auth-provider"
import { FeedbackModal } from "@/components/idea-hub/feedback-modal"
import { FeedbackStatusIndicator } from "@/components/idea-hub/feedback-status-badge"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { useSubmissionHistory } from "./hooks/useSubmissionHistory"
import { ITEMS_PER_PAGE } from "./types"

// Stagger animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 }
  }
}

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } }
}

export default function HistoryPage() {
  const { user, isAuthenticated, isLoading } = useAuth()
  const isAdmin = user?.role === "admin"
  const canWriteFeedback = isAdmin || (user?.permissions?.selfcheck?.feedback === true)

  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640)
    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  const {
    searchQuery, setSearchQuery,
    dateRange, setDateRange, clearDateFilter,
    viewAll, setViewAll,
    history, isLoadingHistory, fetchHistory,
    filteredHistory, paginatedHistory,
    selectedIds, toggleSelect, toggleSelectAll, isAllSelected,
    isDownloading, handleDownloadPdf, handleExcelDownload, handleBulkPdfDownload,
    deleteTarget, setDeleteTarget, showBulkDeleteDialog, setShowBulkDeleteDialog,
    isDeleting, handleDelete, handleBulkDelete,
    feedbackModalOpen, setFeedbackModalOpen, selectedSubmission, openFeedbackModal,
    currentPage, setCurrentPage, totalPages,
    startPage, endPage, currentBlock,
    goToPreviousBlock, goToNextBlock,
  } = useSubmissionHistory({ isAuthenticated, isAdmin })

  if (isLoading) {
    return (
      <PageContainer
        title="진단 이력"
        description="AI 과제 보안성 셀프진단 이력을 조회합니다"
      >
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-pulse text-muted-foreground">로딩 중...</div>
        </div>
      </PageContainer>
    )
  }

  if (!isAuthenticated) {
    return (
      <PageContainer
        title="진단 이력"
        description="AI 과제 보안성 셀프진단 이력을 조회합니다"
      >
        <Card className="max-w-md mx-auto mt-12">
          <CardHeader className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-amber-600 dark:text-amber-400" />
            </div>
            <CardTitle>로그인이 필요합니다</CardTitle>
            <CardDescription>
              진단 이력 조회는 로그인한 사용자만 이용할 수 있습니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Link href="/login">
              <Button>로그인</Button>
            </Link>
          </CardContent>
        </Card>
      </PageContainer>
    )
  }

  return (
    <PageContainer maxWidth="wide" className="space-y-4">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold flex items-center gap-2">
          <History className="h-5 w-5 text-muted-foreground" />
          진단 이력
        </h1>
        <Link href="/idea-hub/selfcheck">
          <Button size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" />
            새 진단
          </Button>
        </Link>
      </div>

      <div className="space-y-4">
        {/* Search & Filter Bar */}
        <Card>
          <CardContent className="py-3 px-4">
            <div className="flex flex-col gap-3">
              {/* Top Row: Title and Controls */}
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-blue-500/10">
                    <History className="w-4 h-4 text-blue-500" />
                  </div>
                  <span className="font-semibold">내 진단 이력</span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Date Range Picker */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className={cn(
                          "h-8 justify-start text-left font-normal gap-2",
                          !dateRange && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="h-3.5 w-3.5" />
                        {dateRange?.from ? (
                          dateRange.to ? (
                            <>
                              {format(dateRange.from, "yy.MM.dd")} - {format(dateRange.to, "yy.MM.dd")}
                            </>
                          ) : (
                            format(dateRange.from, "yy.MM.dd")
                          )
                        ) : (
                          "기간 선택"
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        initialFocus
                        mode="range"
                        defaultMonth={dateRange?.from}
                        selected={dateRange}
                        onSelect={setDateRange}
                        numberOfMonths={isMobile ? 1 : 2}
                        locale={ko}
                      />
                    </PopoverContent>
                  </Popover>

                  {dateRange && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2"
                      onClick={clearDateFilter}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}

                  {/* Admin: View All Toggle */}
                  {isAdmin && (
                    <Button
                      variant={viewAll ? "default" : "outline"}
                      size="sm"
                      className="h-8 text-xs gap-1.5"
                      onClick={() => setViewAll(!viewAll)}
                    >
                      <User className="h-3.5 w-3.5" />
                      {viewAll ? "전체 보기" : "내 이력"}
                    </Button>
                  )}

                  {/* Search Input */}
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                      placeholder="과제명, 부서, 담당자 검색"
                      className="pl-8 h-8 text-sm w-[180px] sm:w-[200px]"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>

                  {/* Refresh Button */}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2"
                    onClick={fetchHistory}
                    disabled={isLoadingHistory}
                  >
                    <RotateCcw className={cn("h-3.5 w-3.5", isLoadingHistory && "animate-spin")} />
                  </Button>
                </div>
              </div>

              {/* Stats Row */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <motion.div
                  className="flex flex-wrap items-center gap-1.5"
                  variants={containerVariants}
                  initial="hidden"
                  animate="show"
                >
                  <motion.div variants={itemVariants} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-xs">
                    <FileText className="w-3 h-3 text-blue-500" />
                    <span className="text-muted-foreground">전체</span>
                    <span className="font-semibold">{history.length}</span>
                  </motion.div>
                  <motion.div variants={itemVariants} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-xs">
                    <AlertTriangle className="w-3 h-3 text-amber-500" />
                    <span className="text-muted-foreground">검토 대상</span>
                    <span className="font-semibold text-amber-600">{history.filter((h) => h.requires_review).length}</span>
                  </motion.div>
                  <motion.div variants={itemVariants} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/20 text-xs">
                    <CheckCircle2 className="w-3 h-3 text-green-500" />
                    <span className="text-muted-foreground">검토 불필요</span>
                    <span className="font-semibold text-green-600">{history.filter((h) => !h.requires_review).length}</span>
                  </motion.div>
                </motion.div>

                {/* Bulk Download Buttons */}
                {selectedIds.size > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {selectedIds.size}건 선택
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1.5"
                      onClick={handleExcelDownload}
                      disabled={isDownloading}
                    >
                      {isDownloading ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <FileSpreadsheet className="w-3 h-3" />
                      )}
                      Excel
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs gap-1.5"
                          disabled={isDownloading}
                        >
                          {isDownloading ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <FileText className="w-3 h-3" />
                          )}
                          PDF
                          <ChevronDown className="w-3 h-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleBulkPdfDownload("individual")}>
                          <Package className="w-4 h-4 mr-2" />
                          개별 PDF (ZIP)
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleBulkPdfDownload("merged")}>
                          <Merge className="w-4 h-4 mr-2" />
                          병합 PDF (단일)
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    {/* 관리자 전용 삭제 버튼 */}
                    {isAdmin && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                        onClick={() => setShowBulkDeleteDialog(true)}
                        disabled={isDeleting}
                      >
                        {isDeleting ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Trash2 className="w-3 h-3" />
                        )}
                        삭제
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* History Table */}
        {filteredHistory.length > 0 ? (
          <>
            {/* Page Info - Inline */}
            <div className="flex items-center justify-end text-sm text-muted-foreground">
              전체 {filteredHistory.length}건 중{" "}
              <span className="font-medium text-foreground mx-1">
                {(currentPage - 1) * ITEMS_PER_PAGE + 1}-
                {Math.min(currentPage * ITEMS_PER_PAGE, filteredHistory.length)}
              </span>
              건
            </div>

            {/* Desktop: Table View */}
            <Card className="hidden md:block">
              <CardContent className="pt-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40px]">
                        <Checkbox
                          checked={isAllSelected}
                          onCheckedChange={() => toggleSelectAll(paginatedHistory)}
                          aria-label="전체 선택"
                        />
                      </TableHead>
                      <TableHead className="w-[280px]">과제명</TableHead>
                      <TableHead>담당부서</TableHead>
                      <TableHead>담당자</TableHead>
                      <TableHead className="text-center">검토 대상</TableHead>
                      <TableHead className="text-center">피드백</TableHead>
                      <TableHead>진단일시</TableHead>
                      <TableHead className="w-[80px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedHistory.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.has(item.submission_id)}
                            onCheckedChange={() => toggleSelect(item.submission_id)}
                            aria-label={`${item.project_name} 선택`}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-muted-foreground" />
                            <span className="font-medium">{item.project_name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-muted-foreground" />
                            <span>{item.department}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-muted-foreground" />
                            <span>{item.manager_name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          {item.requires_review ? (
                            <Badge variant="destructive" className="gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              예
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              아니오
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <FeedbackStatusIndicator
                            status={item.feedback_status || "none"}
                            onClick={() => openFeedbackModal(item)}
                            canEdit={canWriteFeedback}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <CalendarIcon className="w-4 h-4" />
                            <span>{item.created_at.slice(0, 16).replace("T", " ")}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                className="gap-2"
                                onClick={() => openFeedbackModal(item)}
                              >
                                <MessageSquare className="w-4 h-4" />
                                {canWriteFeedback
                                  ? (item.feedback_status === "completed" ? "피드백 보기" : "피드백 작성")
                                  : "피드백 보기"}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="gap-2"
                                onClick={() => handleDownloadPdf(item.submission_id, item.project_name)}
                              >
                                <Download className="w-4 h-4" />
                                PDF 다운로드
                              </DropdownMenuItem>
                              {isAdmin && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="gap-2 text-red-600 focus:text-red-600"
                                    onClick={() => setDeleteTarget({ id: item.submission_id, name: item.project_name })}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                    삭제
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Mobile: Card List View */}
            <div className="md:hidden space-y-3">
              {/* Mobile Select All */}
              <div className="flex items-center gap-2 px-1">
                <Checkbox
                  checked={isAllSelected}
                  onCheckedChange={() => toggleSelectAll(paginatedHistory)}
                  aria-label="전체 선택"
                />
                <span className="text-sm text-muted-foreground">전체 선택</span>
              </div>

              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="show"
                className="space-y-3"
              >
              {paginatedHistory.map((item) => (
                <motion.div key={item.id} variants={itemVariants}>
                <Card className="p-4">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={selectedIds.has(item.submission_id)}
                      onCheckedChange={() => toggleSelect(item.submission_id)}
                      aria-label={`${item.project_name} 선택`}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0 space-y-2">
                      {/* Header: Project Name + Review Badge */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                          <span className="font-medium truncate">{item.project_name}</span>
                        </div>
                        {item.requires_review ? (
                          <Badge variant="destructive" className="gap-1 shrink-0">
                            <AlertTriangle className="w-3 h-3" />
                            검토대상
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="gap-1 shrink-0">
                            <CheckCircle2 className="w-3 h-3" />
                            불필요
                          </Badge>
                        )}
                      </div>

                      {/* Department + Manager */}
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5" />
                          {item.department}
                        </span>
                        <span className="flex items-center gap-1">
                          <User className="w-3.5 h-3.5" />
                          {item.manager_name}
                        </span>
                      </div>

                      {/* Footer: Date + Actions */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <CalendarIcon className="w-3 h-3" />
                            {item.created_at.slice(0, 16).replace("T", " ")}
                          </span>
                          <FeedbackStatusIndicator
                            status={item.feedback_status || "none"}
                            onClick={() => openFeedbackModal(item)}
                            canEdit={canWriteFeedback}
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs gap-1"
                            onClick={() => handleDownloadPdf(item.submission_id, item.project_name)}
                          >
                            <Download className="w-3.5 h-3.5" />
                            PDF
                          </Button>
                          {isAdmin && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs gap-1 text-red-600 hover:text-red-700"
                              onClick={() => setDeleteTarget({ id: item.submission_id, name: item.project_name })}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
                </motion.div>
              ))}
              </motion.div>
            </div>

            {/* Pagination */}
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
                            setCurrentPage(page)
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
        ) : (
          <Card>
            <CardContent className="py-16 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                <History className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">진단 이력이 없습니다</h3>
              <p className="text-muted-foreground mb-6">
                {searchQuery || dateRange
                  ? "검색 결과가 없습니다. 다른 조건으로 검색해주세요."
                  : "AI 과제 보안성 셀프진단을 진행해보세요."}
              </p>
              {!searchQuery && !dateRange && (
                <Link href="/idea-hub/selfcheck">
                  <Button>셀프진단 시작하기</Button>
                </Link>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* 단일 삭제 확인 다이얼로그 */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>진단 결과 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{deleteTarget?.name}&quot; 진단 결과를 삭제하시겠습니까?
              <br />
              <span className="text-red-500 font-medium">
                이 작업은 되돌릴 수 없으며, DB와 벡터 DB에서 모두 삭제됩니다.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>취소</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deleteTarget && handleDelete(deleteTarget.id)}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  삭제 중...
                </>
              ) : (
                "삭제"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 일괄 삭제 확인 다이얼로그 */}
      <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>선택 항목 일괄 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              선택한 <span className="font-semibold text-foreground">{selectedIds.size}건</span>의 진단 결과를 삭제하시겠습니까?
              <br />
              <span className="text-red-500 font-medium">
                이 작업은 되돌릴 수 없으며, DB와 벡터 DB에서 모두 삭제됩니다.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>취소</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={handleBulkDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  삭제 중...
                </>
              ) : (
                `${selectedIds.size}건 삭제`
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 피드백 모달 */}
      <FeedbackModal
        open={feedbackModalOpen}
        onOpenChange={setFeedbackModalOpen}
        submission={selectedSubmission ? {
          submission_id: selectedSubmission.submission_id,
          project_name: selectedSubmission.project_name,
          department: selectedSubmission.department,
          manager_name: selectedSubmission.manager_name,
          requires_review: selectedSubmission.requires_review,
          review_reason: selectedSubmission.review_reason,
          created_at: selectedSubmission.created_at,
        } : null}
        canEdit={canWriteFeedback && selectedSubmission?.feedback_status !== "completed"}
        onFeedbackUpdated={fetchHistory}
      />
    </PageContainer>
  )
}
