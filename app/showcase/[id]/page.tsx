"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { ArrowLeft, Edit2, Trash2, Star, ExternalLink, Eye, Calendar, User, Link2, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { getItemDetail, deleteItem, toggleFeatured, getItems, ShowcaseItemDetail, ShowcaseItem } from "@/lib/showcase"
import { useAuth } from "@/components/auth/auth-provider"
import { CategoryBadge } from "../components/CategoryBadge"
import { ItemTypeBadge } from "../components/ItemTypeBadge"
import { DifficultyBadge } from "../components/DifficultyBadge"
import { CodeBlock } from "../components/CodeBlock"
import { MarkdownPreview } from "../components/MarkdownPreview"
import { ShowcaseCard } from "../components/ShowcaseCard"
import { CommentSection } from "../components/CommentSection"
import { getCategories, ShowcaseCategory } from "@/lib/showcase"

const SESSION_KEY = (id: number) => `showcase_viewed_${id}`

export default function ShowcaseDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { user, isAuthenticated } = useAuth()
  const [item, setItem] = useState<ShowcaseItemDetail | null>(null)
  const [related, setRelated] = useState<ShowcaseItem[]>([])
  const [categories, setCategories] = useState<ShowcaseCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const numId = Number(id)
    const alreadyViewed = sessionStorage.getItem(SESSION_KEY(numId))
    getItemDetail(numId, !alreadyViewed ? true : false)
      .then((data) => {
        setItem(data)
        sessionStorage.setItem(SESSION_KEY(numId), "1")
        return Promise.all([
          getItems({ category: data.category_key, limit: 4 }),
          getCategories(),
        ])
      })
      .then(([rel, cats]) => {
        setRelated(rel.items.filter((i) => i.id !== numId).slice(0, 3))
        setCategories(cats)
      })
      .catch(() => toast.error("아이템을 불러오지 못했습니다."))
      .finally(() => setLoading(false))
  }, [id])

  const handleDelete = async () => {
    try {
      await deleteItem(Number(id))
      toast.success("삭제되었습니다.")
      router.push("/showcase")
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "삭제 실패")
    }
  }

  const handleToggleFeatured = async () => {
    if (!item) return
    try {
      const updated = await toggleFeatured(item.id)
      setItem(updated)
      toast.success(updated.is_featured ? "Featured 설정됨" : "Featured 해제됨")
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "변경 실패")
    }
  }

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const isAdmin = user?.role === "admin"
  const canEdit = isAdmin || (isAuthenticated && user?.id === item?.author_id)

  const colorMap = Object.fromEntries(categories.map((c) => [c.key, c.color]))

  if (loading) {
    return (
      <div className="container max-w-6xl mx-auto px-4 py-6">
        <div className="h-8 w-32 bg-muted animate-pulse rounded mb-6" />
        <div className="grid lg:grid-cols-[1fr_280px] gap-6">
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-6 bg-muted animate-pulse rounded" />)}
          </div>
        </div>
      </div>
    )
  }

  if (!item) return null

  return (
    <div className="container max-w-6xl mx-auto px-4 py-6">
      <Link href="/showcase" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-5">
        <ArrowLeft className="h-4 w-4" />
        목록으로
      </Link>

      <div className="grid lg:grid-cols-[1fr_280px] gap-6 pb-20 lg:pb-0">
        {/* Main content */}
        <div className="space-y-5 min-w-0">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <CategoryBadge name={item.category_name} color={colorMap[item.category_key] ?? "blue"} />
              <ItemTypeBadge type={item.item_type} />
              <DifficultyBadge difficulty={item.difficulty} />
              {item.is_featured && (
                <Badge variant="secondary" className="gap-1 text-xs">
                  <Star className="h-3 w-3 fill-current text-warning" />
                  Featured
                </Badge>
              )}
              {!item.is_published && (
                <Badge variant="outline" className="text-xs text-muted-foreground">비공개</Badge>
              )}
            </div>
            <h1 className="text-2xl font-bold leading-snug">{item.title}</h1>
            <p className="mt-2 text-muted-foreground text-sm">{item.summary}</p>
          </div>

          {item.install_command && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">복사하기</p>
              <CodeBlock code={item.install_command} className="text-sm" />
            </div>
          )}

          <Separator />

          <MarkdownPreview content={item.content} />
        </div>

        {/* Sidebar */}
        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          {/* Meta */}
          <div className="rounded-lg border p-4 space-y-3 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <User className="h-3.5 w-3.5 flex-shrink-0" />
              <span>{item.author_name ?? "알 수 없음"}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
              <span>{new Date(item.created_at).toLocaleDateString("ko-KR")}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Eye className="h-3.5 w-3.5 flex-shrink-0" />
              <span>{item.view_count.toLocaleString()} 조회</span>
            </div>
            {item.source_url && (
              <a
                href={item.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-primary hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5 flex-shrink-0" />
                <span>참고 링크</span>
              </a>
            )}
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors w-full text-left"
            >
              {copied
                ? <Check className="h-3.5 w-3.5 flex-shrink-0 text-success" />
                : <Link2 className="h-3.5 w-3.5 flex-shrink-0" />
              }
              <span>{copied ? "링크 복사됨!" : "링크 복사"}</span>
            </button>
          </div>

          {/* Tags */}
          {item.tags.length > 0 && (
            <div className="rounded-lg border p-4">
              <p className="text-xs font-medium text-muted-foreground mb-2">태그</p>
              <div className="flex flex-wrap gap-1.5">
                {item.tags.map((tag) => (
                  <Link
                    key={tag}
                    href={`/showcase?search=${encodeURIComponent(tag)}`}
                    className="text-xs px-2 py-0.5 rounded bg-muted hover:bg-primary/10 hover:text-primary transition-colors"
                  >
                    {tag}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Comments */}
          <CommentSection itemId={item.id} currentUser={user ?? null} />

          {/* Actions */}
          {(canEdit || isAdmin) && (
            <div className="rounded-lg border p-4 space-y-2">
              {canEdit && (
                <Link href={`/showcase/${item.id}/edit`} className="block">
                  <Button variant="outline" size="sm" className="w-full gap-1.5">
                    <Edit2 className="h-3.5 w-3.5" />
                    수정
                  </Button>
                </Link>
              )}
              {isAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-1.5"
                  onClick={handleToggleFeatured}
                >
                  <Star className={`h-3.5 w-3.5 ${item.is_featured ? "fill-current text-warning" : ""}`} />
                  {item.is_featured ? "Featured 해제" : "Featured 설정"}
                </Button>
              )}
              {canEdit && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" className="w-full gap-1.5">
                      <Trash2 className="h-3.5 w-3.5" />
                      삭제
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>삭제 확인</AlertDialogTitle>
                      <AlertDialogDescription>
                        이 아이템을 삭제하면 복구할 수 없습니다.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>취소</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDelete}>삭제</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          )}

          {/* Related items */}
          {related.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">같은 카테고리</p>
              <div className="space-y-2">
                {related.map((rel) => (
                  <ShowcaseCard key={rel.id} item={rel} categoryColor={colorMap[rel.category_key] ?? "blue"} />
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* 모바일 sticky action bar */}
      {canEdit && (
        <div className="lg:hidden fixed bottom-0 left-0 md:left-60 right-0 z-50 border-t bg-background/95 backdrop-blur-sm px-4 py-3 flex gap-2">
          <Link href={`/showcase/${item.id}/edit`} className="flex-1">
            <Button variant="outline" size="sm" className="w-full gap-1.5">
              <Edit2 className="h-3.5 w-3.5" />
              수정
            </Button>
          </Link>
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={handleToggleFeatured}
            >
              <Star className={`h-3.5 w-3.5 ${item.is_featured ? "fill-yellow-500 text-yellow-500" : ""}`} />
            </Button>
          )}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" className="gap-1.5">
                <Trash2 className="h-3.5 w-3.5" />
                삭제
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>삭제 확인</AlertDialogTitle>
                <AlertDialogDescription>
                  이 아이템을 삭제하면 복구할 수 없습니다.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>취소</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete}>삭제</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </div>
  )
}
