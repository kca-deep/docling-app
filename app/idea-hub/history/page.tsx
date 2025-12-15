"use client"

import { useState, useEffect, useCallback } from "react"
import { PageContainer } from "@/components/page-container"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  History,
  Search,
  Download,
  Eye,
  MoreVertical,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Calendar,
  User,
  Building2,
  Plus,
  Loader2,
} from "lucide-react"
import { motion } from "framer-motion"
import { useAuth } from "@/components/auth/auth-provider"
import { apiEndpoints } from "@/lib/api-config"
import Link from "next/link"

interface HistoryItem {
  id: number
  submission_id: string
  project_name: string
  department: string
  manager_name: string
  requires_review: boolean
  status: string
  used_model: string | null
  created_at: string
}

export default function HistoryPage() {
  const { isAuthenticated, isLoading } = useAuth()
  const [searchQuery, setSearchQuery] = useState("")
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)

  const fetchHistory = useCallback(async () => {
    setIsLoadingHistory(true)
    try {
      const response = await fetch(apiEndpoints.selfcheckHistory, {
        credentials: "include",
      })
      if (response.ok) {
        const data = await response.json()
        setHistory(data.items || [])
      }
    } catch (error) {
      console.error("Failed to fetch history:", error)
    } finally {
      setIsLoadingHistory(false)
    }
  }, [])

  useEffect(() => {
    if (isAuthenticated) {
      fetchHistory()
    }
  }, [isAuthenticated, fetchHistory])

  const handleDownloadPdf = async (submissionId: string, projectName: string) => {
    try {
      const response = await fetch(
        `${apiEndpoints.selfcheck}/${submissionId}/pdf`,
        {
          credentials: "include",
        }
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
        alert("PDF 다운로드에 실패했습니다.")
      }
    } catch (error) {
      console.error("PDF download error:", error)
      alert("PDF 다운로드 중 오류가 발생했습니다.")
    }
  }

  const filteredHistory = history.filter(
    (item) =>
      item.project_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.manager_name.toLowerCase().includes(searchQuery.toLowerCase())
  )

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
    <PageContainer maxWidth="wide" className="py-8 space-y-8">
      {/* Background Noise & Gradient */}
      <div className="absolute inset-0 bg-noise opacity-30 pointer-events-none -z-10" />
      <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-blue-500/5 to-transparent -z-10" />

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 text-white shadow-lg shadow-blue-500/20">
              <History className="h-5 w-5" />
            </div>
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
              진단 이력
            </span>
          </h1>
          <p className="text-muted-foreground mt-3 text-lg max-w-2xl">
            AI 과제 보안성 셀프진단 이력을 조회하고 결과를 다운로드할 수 있습니다.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Link href="/idea-hub/selfcheck">
            <Button
              size="lg"
              className="gap-2 rounded-full shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 hover:scale-105 active:scale-95 transition-all bg-blue-500 hover:bg-blue-500/90"
            >
              <Plus className="h-5 w-5" />
              새 진단 시작
            </Button>
          </Link>
        </motion.div>
      </div>

      <div className="space-y-6">
        {/* Search Bar */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <History className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <CardTitle className="text-lg">내 진단 이력</CardTitle>
                  <CardDescription>
                    총 {filteredHistory.length}건의 진단 이력이 있습니다.
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="과제명, 부서, 담당자 검색"
                    className="pl-9 w-[200px] sm:w-[250px]"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* History Table */}
        {filteredHistory.length > 0 ? (
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[300px]">과제명</TableHead>
                    <TableHead>담당부서</TableHead>
                    <TableHead>담당자</TableHead>
                    <TableHead className="text-center">검토 대상</TableHead>
                    <TableHead>진단일시</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredHistory.map((item) => (
                    <TableRow key={item.id}>
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
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="w-4 h-4" />
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
                              onClick={() => handleDownloadPdf(item.submission_id, item.project_name)}
                            >
                              <Download className="w-4 h-4" />
                              PDF 다운로드
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-16 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                <History className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">진단 이력이 없습니다</h3>
              <p className="text-muted-foreground mb-6">
                {searchQuery
                  ? "검색 결과가 없습니다. 다른 검색어를 입력해주세요."
                  : "AI 과제 보안성 셀프진단을 진행해보세요."}
              </p>
              {!searchQuery && (
                <Link href="/idea-hub/selfcheck">
                  <Button>셀프진단 시작하기</Button>
                </Link>
              )}
            </CardContent>
          </Card>
        )}

        {/* Summary Cards */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">전체 진단</p>
                  <p className="text-2xl font-bold">{history.length}</p>
                </div>
                <div className="p-3 rounded-full bg-blue-500/10">
                  <FileText className="w-5 h-5 text-blue-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">검토 대상</p>
                  <p className="text-2xl font-bold text-amber-600">
                    {history.filter((h) => h.requires_review).length}
                  </p>
                </div>
                <div className="p-3 rounded-full bg-amber-500/10">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">검토 불필요</p>
                  <p className="text-2xl font-bold text-green-600">
                    {history.filter((h) => !h.requires_review).length}
                  </p>
                </div>
                <div className="p-3 rounded-full bg-green-500/10">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainer>
  )
}
