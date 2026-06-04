"use client"

import { useEffect, useState, useRef } from "react"
import { toast } from "sonner"
import { Trash2, MessageSquare, Send, Loader2, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
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

  return (
    <>
      <div className="rounded-lg border p-4 space-y-3" ref={formRef}>
        {/* 헤더 */}
        <div className="flex items-center gap-1.5">
          <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
          <p className="text-xs font-medium text-muted-foreground">
            문의 {total > 0 ? `${total}개` : ""}
          </p>
        </div>

        {/* 댓글 목록 */}
        {loading ? (
          <div className="flex justify-center py-2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : comments.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-2">
            첫 문의를 남겨보세요
          </p>
        ) : (
          <div className="space-y-2">
            {comments.map((c) => (
              <div key={c.id} className="space-y-0.5">
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1 min-w-0">
                    <span className="text-xs font-medium truncate">{c.author_name}</span>
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      · {formatDate(c.created_at)}
                    </span>
                    {c.has_password && !c.author_id && (
                      <Lock className="h-2.5 w-2.5 text-muted-foreground flex-shrink-0" />
                    )}
                  </div>
                  {canDelete(c) && (
                    <button
                      onClick={() => handleDeleteClick(c)}
                      className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0"
                      aria-label="삭제"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
                <p className="text-xs text-foreground/80 break-words whitespace-pre-wrap leading-relaxed">
                  {c.content}
                </p>
              </div>
            ))}

            {hasNext && (
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors w-full text-center py-1 disabled:opacity-50"
              >
                {loadingMore ? "로딩 중..." : "더 보기"}
              </button>
            )}
          </div>
        )}

        <Separator />

        {/* 입력 폼 */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">문의 남기기</p>
          {currentUser ? (
            <div className="text-xs text-muted-foreground px-0.5">
              {currentUser.name || currentUser.username} 으로 등록됩니다
            </div>
          ) : (
            <>
              <Input
                placeholder="이름"
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                className="h-7 text-xs"
                maxLength={100}
              />
              <div className="relative">
                <Input
                  type="password"
                  placeholder="비밀번호 (삭제 시 필요, 선택)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-7 text-xs pr-7"
                  maxLength={100}
                />
                <Lock className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
              </div>
            </>
          )}
          <Textarea
            placeholder="문의 내용을 입력하세요"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="text-xs resize-none min-h-[72px]"
            maxLength={2000}
          />
          <Button
            size="sm"
            className="w-full h-7 text-xs gap-1"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Send className="h-3 w-3" />
            )}
            {submitting ? "등록 중..." : "등록"}
          </Button>
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
