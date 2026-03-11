import { useState, useEffect, useCallback } from "react"
import { toast } from "sonner"
import { format } from "date-fns"
import { type DateRange } from "react-day-picker"
import { apiEndpoints } from "@/lib/api-config"
import type { HistoryItem } from "../types"
import { ITEMS_PER_PAGE, PAGES_PER_BLOCK } from "../types"

interface UseSubmissionHistoryOptions {
  isAuthenticated: boolean
  isAdmin: boolean
}

export function useSubmissionHistory({ isAuthenticated, isAdmin }: UseSubmissionHistoryOptions) {
  const [searchQuery, setSearchQuery] = useState("")
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined)
  const [isDownloading, setIsDownloading] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)

  // 삭제 관련 상태
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // 피드백 모달 상태
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false)
  const [selectedSubmission, setSelectedSubmission] = useState<HistoryItem | null>(null)

  // 관리자 전체 보기 모드 (관리자는 기본 전체 보기)
  const [viewAll, setViewAll] = useState(true)

  // =========================================================
  // Data Fetching
  // =========================================================

  const fetchHistory = useCallback(async () => {
    setIsLoadingHistory(true)
    try {
      const params = new URLSearchParams()
      params.set("limit", "500")
      if (dateRange?.from) {
        params.set("start_date", format(dateRange.from, "yyyy-MM-dd"))
      }
      if (dateRange?.to) {
        params.set("end_date", format(dateRange.to, "yyyy-MM-dd"))
      }
      if (isAdmin && viewAll) {
        params.set("view_all", "true")
      }

      const response = await fetch(`${apiEndpoints.selfcheckHistory}?${params.toString()}`, {
        credentials: "include",
      })
      if (response.ok) {
        const data = await response.json()
        setHistory(data.items || [])
        setSelectedIds(new Set())
      }
    } catch (error) {
      console.error("Failed to fetch history:", error)
    } finally {
      setIsLoadingHistory(false)
    }
  }, [dateRange, isAdmin, viewAll])

  useEffect(() => {
    if (isAuthenticated) {
      fetchHistory()
    }
  }, [isAuthenticated, fetchHistory])

  // =========================================================
  // Download Handlers
  // =========================================================

  const handleDownloadPdf = async (submissionId: string, projectName: string) => {
    try {
      const response = await fetch(
        `${apiEndpoints.selfcheck}/${submissionId}/pdf`,
        { credentials: "include" }
      )
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `selfcheck_${projectName.slice(0, 20)}_${submissionId.slice(0, 8)}.pdf`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)
      } else {
        toast.error("PDF 다운로드에 실패했습니다.")
      }
    } catch (error) {
      console.error("PDF download error:", error)
      toast.error("PDF 다운로드 중 오류가 발생했습니다.")
    }
  }

  const handleExcelDownload = async () => {
    if (selectedIds.size === 0) {
      toast.warning("내보낼 항목을 선택해주세요.")
      return
    }

    setIsDownloading(true)
    try {
      const response = await fetch(`${apiEndpoints.selfcheck}/export/excel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ submission_ids: Array.from(selectedIds) }),
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `selfcheck_export_${format(new Date(), "yyyyMMdd_HHmmss")}.xlsx`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)
      } else {
        toast.error("Excel 다운로드에 실패했습니다.")
      }
    } catch (error) {
      console.error("Excel download error:", error)
      toast.error("Excel 다운로드 중 오류가 발생했습니다.")
    } finally {
      setIsDownloading(false)
    }
  }

  const handleBulkPdfDownload = async (mode: "individual" | "merged") => {
    if (selectedIds.size === 0) {
      toast.warning("내보낼 항목을 선택해주세요.")
      return
    }

    setIsDownloading(true)
    try {
      const response = await fetch(`${apiEndpoints.selfcheck}/export/pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          submission_ids: Array.from(selectedIds),
          mode,
        }),
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        const timestamp = format(new Date(), "yyyyMMdd_HHmmss")
        a.download = mode === "merged"
          ? `selfcheck_merged_${timestamp}.pdf`
          : `selfcheck_reports_${timestamp}.zip`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)
      } else {
        toast.error("PDF 다운로드에 실패했습니다.")
      }
    } catch (error) {
      console.error("PDF download error:", error)
      toast.error("PDF 다운로드 중 오류가 발생했습니다.")
    } finally {
      setIsDownloading(false)
    }
  }

  // =========================================================
  // Selection Handlers
  // =========================================================

  const toggleSelectAll = (paginatedItems: HistoryItem[]) => {
    const currentPageIds = paginatedItems.map(item => item.submission_id)
    const allSelected = currentPageIds.every(id => selectedIds.has(id))

    if (allSelected) {
      const newSet = new Set(selectedIds)
      currentPageIds.forEach(id => newSet.delete(id))
      setSelectedIds(newSet)
    } else {
      const newSet = new Set(selectedIds)
      currentPageIds.forEach(id => newSet.add(id))
      setSelectedIds(newSet)
    }
  }

  const toggleSelect = (submissionId: string) => {
    const newSet = new Set(selectedIds)
    if (newSet.has(submissionId)) {
      newSet.delete(submissionId)
    } else {
      newSet.add(submissionId)
    }
    setSelectedIds(newSet)
  }

  // =========================================================
  // Delete Handlers
  // =========================================================

  const clearDateFilter = () => {
    setDateRange(undefined)
  }

  const handleDelete = async (submissionId: string) => {
    setIsDeleting(true)
    try {
      const response = await fetch(`${apiEndpoints.selfcheck}/${submissionId}`, {
        method: "DELETE",
        credentials: "include",
      })

      if (response.ok) {
        setHistory((prev) => prev.filter((item) => item.submission_id !== submissionId))
        setSelectedIds((prev) => {
          const newSet = new Set(prev)
          newSet.delete(submissionId)
          return newSet
        })
        setDeleteTarget(null)
        toast.success("삭제되었습니다.")
      } else {
        const errorData = await response.json().catch(() => ({}))
        toast.error(errorData.detail || "삭제에 실패했습니다.")
      }
    } catch (error) {
      console.error("Delete error:", error)
      toast.error("삭제 중 오류가 발생했습니다.")
    } finally {
      setIsDeleting(false)
    }
  }

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return

    setIsDeleting(true)
    try {
      const response = await fetch(apiEndpoints.selfcheckBulkDelete, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ submission_ids: Array.from(selectedIds) }),
      })

      if (response.ok) {
        const result = await response.json()
        // 삭제된 건만 목록에서 제거 (건너뛴 건은 유지)
        const deletedIds = new Set(
          result.skipped_details
            ? Array.from(selectedIds).filter(
                (id) => !result.skipped_details.some((s: { submission_id: string }) => s.submission_id === id)
              )
            : Array.from(selectedIds)
        )
        setHistory((prev) =>
          prev.filter((item) => !deletedIds.has(item.submission_id))
        )
        setSelectedIds(new Set())
        setShowBulkDeleteDialog(false)
        toast.success(result.message)
      } else {
        const errorData = await response.json().catch(() => ({}))
        toast.error(errorData.detail || "삭제에 실패했습니다.")
      }
    } catch (error) {
      console.error("Bulk delete error:", error)
      toast.error("삭제 중 오류가 발생했습니다.")
    } finally {
      setIsDeleting(false)
    }
  }

  // =========================================================
  // Submit (최종제출)
  // =========================================================

  const [submitTarget, setSubmitTarget] = useState<{ id: string; name: string } | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (submissionId: string) => {
    setIsSubmitting(true)
    try {
      const response = await fetch(`${apiEndpoints.selfcheck}/${submissionId}/submit`, {
        method: "POST",
        credentials: "include",
      })

      if (response.ok) {
        setHistory((prev) =>
          prev.map((item) =>
            item.submission_id === submissionId
              ? { ...item, status: "submitted" }
              : item
          )
        )
        setSubmitTarget(null)
        toast.success("최종제출이 완료되었습니다.")
      } else {
        const errorData = await response.json().catch(() => ({}))
        toast.error(errorData.detail || "최종제출에 실패했습니다.")
      }
    } catch (error) {
      console.error("Submit error:", error)
      toast.error("최종제출 중 오류가 발생했습니다.")
    } finally {
      setIsSubmitting(false)
    }
  }

  // =========================================================
  // Feedback
  // =========================================================

  const openFeedbackModal = (item: HistoryItem) => {
    setSelectedSubmission(item)
    setFeedbackModalOpen(true)
  }

  // =========================================================
  // Filtering & Pagination
  // =========================================================

  const filteredHistory = history.filter(
    (item) =>
      item.project_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.manager_name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const totalPages = Math.ceil(filteredHistory.length / ITEMS_PER_PAGE)
  const currentBlock = Math.floor((currentPage - 1) / PAGES_PER_BLOCK)
  const startPage = currentBlock * PAGES_PER_BLOCK + 1
  const endPage = Math.min(startPage + PAGES_PER_BLOCK - 1, totalPages)

  const paginatedHistory = filteredHistory.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  )

  // Reset page when search/filter changes
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, dateRange])

  // Ensure currentPage is valid when totalPages changes
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages)
    }
  }, [totalPages, currentPage])

  const goToPreviousBlock = () => {
    if (currentBlock > 0) {
      setCurrentPage((currentBlock - 1) * PAGES_PER_BLOCK + PAGES_PER_BLOCK)
    }
  }

  const goToNextBlock = () => {
    if (endPage < totalPages) {
      setCurrentPage((currentBlock + 1) * PAGES_PER_BLOCK + 1)
    }
  }

  const isAllSelected = paginatedHistory.length > 0 &&
    paginatedHistory.every(item => selectedIds.has(item.submission_id))

  return {
    // Search & filter
    searchQuery, setSearchQuery,
    dateRange, setDateRange, clearDateFilter,
    viewAll, setViewAll,
    // Data
    history, isLoadingHistory, fetchHistory,
    filteredHistory, paginatedHistory,
    // Selection
    selectedIds, toggleSelect, toggleSelectAll, isAllSelected,
    // Download
    isDownloading, handleDownloadPdf, handleExcelDownload, handleBulkPdfDownload,
    // Delete
    deleteTarget, setDeleteTarget, showBulkDeleteDialog, setShowBulkDeleteDialog,
    isDeleting, handleDelete, handleBulkDelete,
    // Submit
    submitTarget, setSubmitTarget, isSubmitting, handleSubmit,
    // Feedback
    feedbackModalOpen, setFeedbackModalOpen, selectedSubmission, openFeedbackModal,
    // Pagination
    currentPage, setCurrentPage, totalPages,
    startPage, endPage, currentBlock,
    goToPreviousBlock, goToNextBlock,
  }
}
