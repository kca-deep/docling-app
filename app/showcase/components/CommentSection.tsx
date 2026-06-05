"use client"

import { useEffect, useState, useRef } from "react"
import { toast } from "sonner"
import { Trash2, MessageSquare, Send, Loader2, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog"
import {
  getComments,
  createComment,
  deleteComment,
  ShowcaseComment,
} from "@/lib/showcase"

const PAGE_LIMIT = 5

interface CurrentUser {
  id: number
  name?: string
  username: string
  role: string
}

interface CommentSectionProps {
  itemId: number
  currentUser: CurrentUser | null
}

export function CommentSection({ itemId, currentUser }: CommentSectionProps) {
  const [comments, setComments] = useState<ShowcaseComment[]>([])
  const [total, setTotal] = useState(0)
  const [hasNext, setHasNext] = useState(false)
  const [skip, setSkip] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  // 작성 폼 상태
  const [submitting, setSubmitting] = useState(false)
  const [authorName, setAuthorName] = useState("")
  const [content, setContent] = useState("")
  const [password, setPassword] = useState("")
  const [focused, setFocused] = useState(false)

  // 삭제 모달 상태
  const [deleteTarget, setDeleteTarget] = useState<ShowcaseComment | null>(null)
  const [deletePassword, setDeletePassword] = useState("")
  const [deleting, setDeleting] = useState(false)

  const formRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getComments(itemId, { skip: 0, limit: PAGE_LIMIT })
      .then((res) => {
        if (cancelled) return
        setComments(res.comments)
        setTotal(res.total)
        setHasNext(res.has_next)
        setSkip(PAGE_LIMIT)
      })
      .catch(() => toast.error("댓글을 불러오지 못했습니다."))
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [itemId])

  const handleLoadMore = async () => {
    setLoadingMore(true)
    try {
      const res = await getComments(itemId, { skip, limit: PAGE_LIMIT })
      setComments((prev) => [...prev, ...res.comments])
      setTotal(res.total)
      setHasNext(res.has_next)
      setSkip((prev) => prev + PAGE_LIMIT)
    } catch {
      toast.error("댓글을 불러오지 못했습니다.")
    } finally {
      setLoadingMore(false)
    }
  }

  const handleSubmit = async () => {
    const name = currentUser ? (currentUser.name || currentUser.username) : authorName.trim()
    if (!name) {
      toast.error("이름을 입력해주세요.")
      return
    }
    if (!content.trim()) {
      toast.error("내용을 입력해주세요.")
      return
    }
    // 비로그인 사용자가 비밀번호를 입력했다면 최소 길이 확인
    if (!currentUser && password && password.length < 4) {
      toast.error("비밀번호는 4자 이상 입력해주세요.")
      return
    }
    setSubmitting(true)
    try {
      const created = await createComment(itemId, {
        author_name: name,
        content: content.trim(),
        password: !currentUser && password ? password : undefined,
      })
      setComments((prev) => [...prev, created])
      setTotal((prev) => prev + 1)
      setContent("")
      setFocused(false)
      if (!currentUser) {
        setAuthorName("")
        setPassword("")
      }
      toast.success("등록되었습니다.")
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "등록 실패")
    } finally {
      setSubmitting(false)
    }
  }

  // 삭제 버튼 노출 조건
  const canDelete = (comment: ShowcaseComment): boolean => {
    if (!currentUser) return comment.has_password  // 비로그인: 비밀번호 있는 댓글만
    if (currentUser.role === "admin") return true
    return comment.author_id !== null && comment.author_id === currentUser.id
  }

  // 삭제 클릭 핸들러
  const handleDeleteClick = (comment: ShowcaseComment) => {
    // 비로그인 + 비밀번호 보호 댓글 → 모달 표시
    if (!currentUser && comment.has_password) {
      setDeleteTarget(comment)
      setDeletePassword("")
      return
    }
    // 로그인 사용자 → 바로 삭제
    doDelete(comment, undefined)
  }

  const doDelete = async (comment: ShowcaseComment, pwd: string | undefined) => {
    try {
      await deleteComment(itemId, comment.id, pwd)
      setComments((prev) => prev.filter((c) => c.id !== comment.id))
      setTotal((prev) => prev - 1)
      toast.success("삭제되었습니다.")
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "삭제 실패")
    }
  }

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return
    if (!deletePassword.trim()) {
      toast.error("비밀번호를 입력해주세요.")
      return
    }
    setDeleting(true)
    try {
      await deleteComment(itemId, deleteTarget.id, deletePassword)
      setComments((prev) => prev.filter((c) => c.id !== deleteTarget.id))
      setTotal((prev) => prev - 1)
      setDeleteTarget(null)
      setDeletePassword("")
      toast.success("삭제되었습니다.")
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "비밀번호가 일치하지 않습니다.")
    } finally {
      setDeleting(false)
    }
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })

  // 평소엔 컴팩트, 포커스/작성 중일 때만 확장 (idle 공간 최소화)
  const expanded = focused || content.trim().length > 0

  return (
    <>
      <div className="rounded-lg border p-4 sm:p-5" ref={formRef}>
        {/* 헤더 */}
        <div className="flex items-center gap-2 mb-3">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-semibold">문의 {total}개</p>
        </div>

        {/* 2단: 좌(목록) / 우(입력 폼) */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          {/* 목록 */}
          <div className="min-w-0">
            {loading ? (
              <div className="flex min-h-[80px] items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : comments.length === 0 ? (
              <div className="flex min-h-[80px] items-center justify-center">
                <p className="text-sm text-muted-foreground">첫 문의를 남겨보세요</p>
              </div>
            ) : (
              <div className="space-y-4">
                {comments.map((c) => (
                  <div key={c.id} className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-sm font-medium truncate">{c.author_name}</span>
                        <span className="text-xs text-muted-foreground flex-shrink-0">
                          · {formatDate(c.created_at)}
                        </span>
                        {c.has_password && !c.author_id && (
                          <Lock className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                        )}
                      </div>
                      {canDelete(c) && (
                        <button
                          onClick={() => handleDeleteClick(c)}
                          className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0"
                          aria-label="삭제"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    <p className="text-sm text-foreground/80 break-words whitespace-pre-wrap leading-relaxed">
                      {c.content}
                    </p>
                  </div>
                ))}

                {hasNext && (
                  <button
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors w-full text-center py-1.5 disabled:opacity-50"
                  >
                    {loadingMore ? "로딩 중..." : "더 보기"}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* 입력 폼 (focus-expand: 평소 컴팩트, 작성 시 확장) */}
          <div className="space-y-2 border-t pt-4 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6">
            <Textarea
              placeholder="문의를 남겨보세요"
              aria-label="문의 내용"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onFocus={() => setFocused(true)}
              className={cn(
                "text-sm resize-none transition-[min-height] duration-150",
                expanded ? "min-h-[80px]" : "min-h-[40px]"
              )}
              maxLength={2000}
            />
            {expanded && (
              <>
                {!currentUser && (
                  <div className="space-y-2">
                    <Input
                      placeholder="이름"
                      value={authorName}
                      onChange={(e) => setAuthorName(e.target.value)}
                      className="h-9 text-sm"
                      maxLength={100}
                    />
                    <div className="relative">
                      <Input
                        type="password"
                        placeholder="비밀번호 (삭제 시 필요, 선택)"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="h-9 text-sm pr-8"
                        maxLength={100}
                      />
                      <Lock className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  {currentUser && (
                    <span className="text-[11px] text-muted-foreground truncate">
                      {currentUser.name || currentUser.username} 으로 등록
                    </span>
                  )}
                  <Button
                    size="sm"
                    className="ml-auto h-8 text-sm gap-1.5"
                    onClick={handleSubmit}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    {submitting ? "등록 중..." : "등록"}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 비밀번호 확인 삭제 모달 */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) { setDeleteTarget(null); setDeletePassword("") } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>댓글 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              작성 시 입력한 비밀번호를 입력하면 삭제됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            type="password"
            placeholder="비밀번호"
            value={deletePassword}
            onChange={(e) => setDeletePassword(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleConfirmDelete() }}
            className="mt-1"
            autoFocus
          />
          <AlertDialogFooter className="mt-2">
            <AlertDialogCancel disabled={deleting}>취소</AlertDialogCancel>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleConfirmDelete}
              disabled={deleting}
            >
              {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
              삭제
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
