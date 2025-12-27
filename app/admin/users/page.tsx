"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { PageContainer } from "@/components/page-container"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Users,
  Search,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Trash2,
  UserCheck,
  UserX,
  Shield,
  Mail,
  Building,
  Calendar,
  Loader2,
  Key,
} from "lucide-react"
import { toast } from "sonner"
import { motion, AnimatePresence } from "framer-motion"
import { useAuth } from "@/components/auth/auth-provider"
import {
  getUsers,
  getPendingUsers,
  approveUser,
  rejectUser,
  deleteUser,
  UserListItem,
} from "@/lib/auth"
import { PermissionEditorModal } from "./components/permission-editor-modal"

type StatusFilter = "all" | "pending" | "approved" | "rejected"

export default function AdminUsersPage() {
  const router = useRouter()
  const { user, isLoading: authLoading, isAuthenticated } = useAuth()

  const [users, setUsers] = useState<UserListItem[]>([])
  const [filteredUsers, setFilteredUsers] = useState<UserListItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")

  // Modal states
  const [approveModalOpen, setApproveModalOpen] = useState(false)
  const [rejectModalOpen, setRejectModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [permissionModalOpen, setPermissionModalOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<UserListItem | null>(null)
  const [rejectReason, setRejectReason] = useState("")
  const [actionLoading, setActionLoading] = useState(false)

  // Check admin access
  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated) {
        router.push("/login?redirect=/admin/users")
        return
      }
      if (user?.role !== "admin") {
        toast.error("관리자 권한이 필요합니다.")
        router.push("/")
        return
      }
    }
  }, [authLoading, isAuthenticated, user, router])

  // Fetch users
  const fetchUsers = useCallback(async () => {
    if (!user || user.role !== "admin") return

    setIsLoading(true)
    try {
      const data = await getUsers()
      setUsers(data)
    } catch (error) {
      console.error("Failed to fetch users:", error)
      toast.error("사용자 목록을 불러오는데 실패했습니다.")
    } finally {
      setIsLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (user?.role === "admin") {
      fetchUsers()
    }
  }, [user, fetchUsers])

  // Filter users based on search and status
  useEffect(() => {
    let result = users

    // Status filter
    if (statusFilter !== "all") {
      result = result.filter((u) => u.status === statusFilter)
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      result = result.filter(
        (u) =>
          u.username.toLowerCase().includes(query) ||
          u.email?.toLowerCase().includes(query) ||
          u.name?.toLowerCase().includes(query) ||
          u.team_name?.toLowerCase().includes(query)
      )
    }

    setFilteredUsers(result)
  }, [users, statusFilter, searchQuery])

  // Status badge component
  const StatusBadge = ({ status }: { status: string }) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30">
            <Clock className="h-3 w-3 mr-1" />
            대기
          </Badge>
        )
      case "approved":
        return (
          <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
            <CheckCircle className="h-3 w-3 mr-1" />
            승인
          </Badge>
        )
      case "rejected":
        return (
          <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30">
            <XCircle className="h-3 w-3 mr-1" />
            거절
          </Badge>
        )
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  // Role badge component
  const RoleBadge = ({ role }: { role: string }) => {
    if (role === "admin") {
      return (
        <Badge variant="secondary" className="bg-purple-500/10 text-purple-600 border-purple-500/30">
          <Shield className="h-3 w-3 mr-1" />
          관리자
        </Badge>
      )
    }
    return (
      <Badge variant="outline" className="text-muted-foreground">
        사용자
      </Badge>
    )
  }

  // Handle approve
  const handleApprove = async () => {
    if (!selectedUser) return

    setActionLoading(true)
    try {
      await approveUser(selectedUser.id)
      toast.success(`${selectedUser.username} 사용자가 승인되었습니다.`)
      setApproveModalOpen(false)
      setSelectedUser(null)
      fetchUsers()
    } catch (error) {
      console.error("Failed to approve user:", error)
      toast.error("사용자 승인에 실패했습니다.")
    } finally {
      setActionLoading(false)
    }
  }

  // Handle reject
  const handleReject = async () => {
    if (!selectedUser) return

    setActionLoading(true)
    try {
      await rejectUser(selectedUser.id, rejectReason || undefined)
      toast.success(`${selectedUser.username} 사용자가 거절되었습니다.`)
      setRejectModalOpen(false)
      setSelectedUser(null)
      setRejectReason("")
      fetchUsers()
    } catch (error) {
      console.error("Failed to reject user:", error)
      toast.error("사용자 거절에 실패했습니다.")
    } finally {
      setActionLoading(false)
    }
  }

  // Handle delete
  const handleDelete = async () => {
    if (!selectedUser) return

    setActionLoading(true)
    try {
      await deleteUser(selectedUser.id)
      toast.success(`${selectedUser.username} 사용자가 삭제되었습니다.`)
      setDeleteModalOpen(false)
      setSelectedUser(null)
      fetchUsers()
    } catch (error) {
      console.error("Failed to delete user:", error)
      toast.error("사용자 삭제에 실패했습니다.")
    } finally {
      setActionLoading(false)
    }
  }

  // Count by status
  const statusCounts = {
    all: users.length,
    pending: users.filter((u) => u.status === "pending").length,
    approved: users.filter((u) => u.status === "approved").length,
    rejected: users.filter((u) => u.status === "rejected").length,
  }

  // Loading state for auth
  if (authLoading) {
    return (
      <PageContainer maxWidth="wide" className="py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </PageContainer>
    )
  }

  // Not authorized
  if (!isAuthenticated || user?.role !== "admin") {
    return null
  }

  return (
    <PageContainer maxWidth="wide" className="space-y-4">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold flex items-center gap-2">
          <Users className="h-5 w-5 text-muted-foreground" />
          사용자 관리
        </h1>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchUsers}
          disabled={isLoading}
        >
          <RefreshCw className={`h-4 w-4 mr-1.5 ${isLoading ? "animate-spin" : ""}`} />
          새로고침
        </Button>
      </div>

      {/* Stats Cards - Compact Layout */}
      <div className="grid grid-cols-4 gap-2">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border/40 bg-background/80">
          <Users className="h-5 w-5 text-muted-foreground/50" />
          <div>
            <p className="text-xs text-muted-foreground">전체</p>
            <p className="text-lg font-bold">{statusCounts.all}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-yellow-500/30 bg-yellow-500/5">
          <Clock className="h-5 w-5 text-yellow-500/50" />
          <div>
            <p className="text-xs text-muted-foreground">대기</p>
            <p className="text-lg font-bold text-yellow-600">{statusCounts.pending}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-green-500/30 bg-green-500/5">
          <CheckCircle className="h-5 w-5 text-green-500/50" />
          <div>
            <p className="text-xs text-muted-foreground">승인</p>
            <p className="text-lg font-bold text-green-600">{statusCounts.approved}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-red-500/30 bg-red-500/5">
          <XCircle className="h-5 w-5 text-red-500/50" />
          <div>
            <p className="text-xs text-muted-foreground">거절</p>
            <p className="text-lg font-bold text-red-600">{statusCounts.rejected}</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Card className="border-border/40 bg-background/80 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="text-lg">사용자 목록</CardTitle>
                <CardDescription>
                  등록된 사용자 {filteredUsers.length}명
                </CardDescription>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="이름, 이메일, 팀명 검색..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
              <TabsList className="mb-4">
                <TabsTrigger value="all" className="gap-2">
                  전체
                  <Badge variant="secondary" className="ml-1">{statusCounts.all}</Badge>
                </TabsTrigger>
                <TabsTrigger value="pending" className="gap-2">
                  대기
                  {statusCounts.pending > 0 && (
                    <Badge className="ml-1 bg-yellow-500">{statusCounts.pending}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="approved" className="gap-2">
                  승인
                  <Badge variant="secondary" className="ml-1">{statusCounts.approved}</Badge>
                </TabsTrigger>
                <TabsTrigger value="rejected" className="gap-2">
                  거절
                  <Badge variant="secondary" className="ml-1">{statusCounts.rejected}</Badge>
                </TabsTrigger>
              </TabsList>

              {isLoading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>
                    {searchQuery
                      ? "검색 결과가 없습니다."
                      : statusFilter === "pending"
                      ? "대기 중인 사용자가 없습니다."
                      : "등록된 사용자가 없습니다."}
                  </p>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>사용자</TableHead>
                        <TableHead>이메일</TableHead>
                        <TableHead>팀</TableHead>
                        <TableHead>상태</TableHead>
                        <TableHead>역할</TableHead>
                        <TableHead>가입일</TableHead>
                        <TableHead className="text-right">액션</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <AnimatePresence mode="popLayout">
                        {filteredUsers.map((u) => (
                          <motion.tr
                            key={u.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="border-b transition-colors hover:bg-muted/50"
                          >
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-medium">{u.name || "-"}</span>
                                <span className="text-sm text-muted-foreground">@{u.username}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <Mail className="h-3 w-3" />
                                {u.email || "-"}
                              </div>
                            </TableCell>
                            <TableCell>
                              {u.team_name ? (
                                <div className="flex items-center gap-1 text-sm">
                                  <Building className="h-3 w-3" />
                                  {u.team_name}
                                </div>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <StatusBadge status={u.status} />
                            </TableCell>
                            <TableCell>
                              <RoleBadge role={u.role} />
                            </TableCell>
                            <TableCell>
                              {u.created_at ? (
                                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                  <Calendar className="h-3 w-3" />
                                  {new Date(u.created_at).toLocaleDateString("ko-KR")}
                                </div>
                              ) : (
                                "-"
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                {u.status === "pending" && (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-500/10"
                                      onClick={() => {
                                        setSelectedUser(u)
                                        setApproveModalOpen(true)
                                      }}
                                      title="승인"
                                    >
                                      <UserCheck className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-500/10"
                                      onClick={() => {
                                        setSelectedUser(u)
                                        setRejectModalOpen(true)
                                      }}
                                      title="거절"
                                    >
                                      <UserX className="h-4 w-4" />
                                    </Button>
                                  </>
                                )}
                                {u.status === "approved" && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10"
                                    onClick={() => {
                                      setSelectedUser(u)
                                      setPermissionModalOpen(true)
                                    }}
                                    title="권한 설정"
                                  >
                                    <Key className="h-4 w-4" />
                                  </Button>
                                )}
                                {u.role !== "admin" && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                    onClick={() => {
                                      setSelectedUser(u)
                                      setDeleteModalOpen(true)
                                    }}
                                    title="삭제"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </motion.tr>
                        ))}
                      </AnimatePresence>
                    </TableBody>
                  </Table>
                </div>
              )}
            </Tabs>
          </CardContent>
        </Card>
      </motion.div>

      {/* Approve Modal */}
      <Dialog open={approveModalOpen} onOpenChange={setApproveModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <UserCheck className="h-5 w-5" />
              사용자 승인
            </DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-4 pt-2">
                <p className="text-sm text-muted-foreground">
                  <strong className="text-foreground">{selectedUser?.username}</strong> 사용자를 승인하시겠습니까?
                </p>
                {selectedUser && (
                  <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground w-14">이름</span>
                      <span className="text-foreground font-medium">{selectedUser.name || "-"}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground w-14">이메일</span>
                      <span className="text-foreground font-medium">{selectedUser.email || "-"}</span>
                    </div>
                    {selectedUser.team_name && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground w-14">팀</span>
                        <span className="text-foreground font-medium">{selectedUser.team_name}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setApproveModalOpen(false)}>
              취소
            </Button>
            <Button
              onClick={handleApprove}
              disabled={actionLoading}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {actionLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <UserCheck className="h-4 w-4 mr-2" />
              )}
              승인
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Modal */}
      <Dialog open={rejectModalOpen} onOpenChange={setRejectModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <UserX className="h-5 w-5" />
              사용자 거절
            </DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-4 pt-2">
                <p className="text-sm text-muted-foreground">
                  <strong className="text-foreground">{selectedUser?.username}</strong> 사용자의 가입을 거절하시겠습니까?
                </p>
                {selectedUser && (
                  <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground w-14">이름</span>
                      <span className="text-foreground font-medium">{selectedUser.name || "-"}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground w-14">이메일</span>
                      <span className="text-foreground font-medium">{selectedUser.email || "-"}</span>
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">거절 사유 (선택)</label>
                  <Textarea
                    placeholder="거절 사유를 입력하세요..."
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    className="resize-none"
                  />
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setRejectModalOpen(false)}>
              취소
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <UserX className="h-4 w-4 mr-2" />
              )}
              거절
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Alert Dialog */}
      <AlertDialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              사용자 삭제
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 pt-2">
                <p className="text-sm text-muted-foreground">
                  정말로 <strong className="text-foreground">{selectedUser?.username}</strong> 사용자를 삭제하시겠습니까?
                </p>
                <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-3 text-sm">
                  <p className="text-destructive font-medium mb-1">주의:</p>
                  <p className="text-muted-foreground">이 작업은 되돌릴 수 없습니다.</p>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4">
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={actionLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {actionLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Permission Editor Modal */}
      <PermissionEditorModal
        open={permissionModalOpen}
        onOpenChange={setPermissionModalOpen}
        user={selectedUser}
        onUpdated={fetchUsers}
      />
    </PageContainer>
  )
}
