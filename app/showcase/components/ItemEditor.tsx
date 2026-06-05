"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Wand2, ImagePlus, X, RotateCcw, Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { RichTextEditor } from "@/components/ui/rich-text-editor"
import {
  ShowcaseCategory,
  ShowcaseItemCreate,
  ShowcaseItemDetail,
  ShowcaseExtractSuggestion,
  uploadShowcaseImages,
  showcaseImageUrl,
  extractFromFile,
  EXTRACT_ALLOWED_EXTS,
  EXTRACT_MAX_MB,
  EXTRACT_TIMEOUT_MS,
  SHOWCASE_MAX_IMAGES,
} from "@/lib/showcase"
import { TagInput } from "./TagInput"
import { MarkdownPreview } from "./MarkdownPreview"
import { AutoFillButton } from "./AutoFillButton"

// 유형 Tabs 옵션 (프리필 검증용 단일 출처)
const VALID_ITEM_TYPES = ["prompt", "code", "guide", "workflow", "snippet"]

interface Props {
  categories: ShowcaseCategory[]
  initial?: ShowcaseItemDetail
  onSubmit: (data: ShowcaseItemCreate) => Promise<ShowcaseItemDetail>
  submitLabel?: string
}

// 유형별 본문 시작 템플릿 (굵게/목록만 사용 — 서식 편집기 지원 범위)
const BODY_TEMPLATES: Record<string, string> = {
  prompt:
    "**목적**\n\n어떤 상황에 쓰는 프롬프트인지 적어주세요.\n\n**프롬프트**\n\n여기에 프롬프트 전문을 붙여넣으세요.\n\n**사용 예시**\n\n실제 입력과 결과 예시를 적어주세요.",
  code:
    "**설명**\n\n이 코드가 하는 일을 적어주세요.\n\n**사용 방법**\n\n- 1단계\n- 2단계\n\n**주의사항**\n\n",
  guide:
    "**개요**\n\n무엇을 배우는 가이드인지 적어주세요.\n\n**따라하기**\n\n- 1단계\n- 2단계\n- 3단계\n\n**팁**\n\n",
  workflow:
    "**목적**\n\n이 워크플로가 자동화하는 작업을 적어주세요.\n\n**흐름**\n\n- 1단계\n- 2단계\n\n**필요한 도구**\n\n",
  snippet:
    "**설명**\n\n이 스니펫의 용도를 적어주세요.\n\n**내용**\n\n여기에 붙여넣으세요.",
}

// 모든 템플릿 공통 꼬리말 (기존 별도 입력 항목을 본문으로 흡수)
const TEMPLATE_TAIL =
  "\n\n**복사용 명령어**\n\n바로 복사해서 쓸 명령어가 있다면 적어주세요.\n\n**참고 링크**\n\n관련 문서나 출처 URL을 적어주세요."

// 마크다운에서 대략적인 일반 텍스트 추출 (요약 자동 생성용)
function toPlainText(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_~`-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export function ItemEditor({ categories, initial, onSubmit, submitLabel = "등록" }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [bodyMode, setBodyMode] = useState<"rich" | "markdown">("rich")
  const [uploadingImage, setUploadingImage] = useState(false)

  const [extracting, setExtracting] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState<ShowcaseItemCreate>({
    category_key:    initial?.category_key ?? categories[0]?.key ?? "",
    title:           initial?.title ?? "",
    summary:         initial?.summary ?? "",
    content:         initial?.content ?? "",
    item_type:       initial?.item_type ?? "prompt",
    difficulty:      initial?.difficulty ?? "beginner",
    tags:            initial?.tags ?? [],
    install_command: initial?.install_command ?? "",
    source_url:      initial?.source_url ?? "",
    thumbnail_url:   initial?.thumbnail_url ?? "",
    image_urls:      initial?.image_urls ?? (initial?.thumbnail_url ? [initial.thumbnail_url] : []),
    is_published:    initial?.is_published ?? true,
  })

  const set = <K extends keyof ShowcaseItemCreate>(key: K, val: ShowcaseItemCreate[K]) =>
    setForm((prev) => ({ ...prev, [key]: val }))

  // === 문서 자동 추출 → 폼 프리필 (보조 입력, 하이브리드 입력 보호) ===
  // 추출 후 대기 중인 제안(입력 보호 모달용)과 되돌리기 스냅샷 상태.
  const [pending, setPending] = useState<{ suggestion: ShowcaseExtractSuggestion; warnings: string[] } | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [undoSnapshot, setUndoSnapshot] = useState<ShowcaseItemCreate | null>(null)

  // "의미 있게 입력된 필드"(프리필이 덮어쓸 수 있는 사용자 입력) 존재 여부.
  // category_key/item_type은 기본값이 있으므로 보호 판정에서 제외.
  const hasMeaningfulInput = (f: ShowcaseItemCreate) =>
    !!(f.title.trim() || f.summary.trim() || f.content.trim() || f.tags.length)

  const normalizeSuggestedTags = (tags?: string[]): string[] => {
    const seen = new Set<string>()
    const out: string[] = []
    for (const raw of tags ?? []) {
      const t = raw.startsWith("#") ? raw : `#${raw}`
      if (!seen.has(t)) {
        seen.add(t)
        out.push(t)
      }
      if (out.length >= 10) break
    }
    return out
  }

  // 제안값을 유효 옵션으로 보정해 폼에 반영.
  // mode="overwrite": 제공된 필드 모두 덮어씀. mode="fillEmpty": 비어있는 필드만 채움.
  // 프리필 직전 prev 스냅샷을 되돌리기용으로 저장한다.
  const applyPrefill = (s: ShowcaseExtractSuggestion, mode: "overwrite" | "fillEmpty") => {
    setForm((prev) => {
      setUndoSnapshot(prev) // 최신 폼을 되돌리기 스냅샷으로 캡처
      const next = { ...prev }
      const fill = mode === "fillEmpty"

      const cat = s.category_key && categories.some((c) => c.key === s.category_key) ? s.category_key : undefined
      if (cat && (!fill || !prev.category_key || prev.category_key === categories[0]?.key))
        next.category_key = cat

      const type = s.item_type && VALID_ITEM_TYPES.includes(s.item_type) ? s.item_type : undefined
      if (type && (!fill || prev.item_type === "prompt")) next.item_type = type

      if (s.title?.trim() && (!fill || !prev.title.trim())) next.title = s.title.trim()
      if (s.summary?.trim() && (!fill || !prev.summary.trim())) next.summary = s.summary.trim()
      if (s.content?.trim() && (!fill || !prev.content.trim())) next.content = s.content

      const tags = normalizeSuggestedTags(s.tags)
      if (tags.length && (!fill || prev.tags.length === 0)) next.tags = tags

      // difficulty/thumbnail/install_command/source_url 은 자동 작성 범위 밖(미변경)
      return next
    })
  }

  const doPrefill = (s: ShowcaseExtractSuggestion, warnings: string[], mode: "overwrite" | "fillEmpty") => {
    applyPrefill(s, mode)
    setConfirmOpen(false)
    setPending(null)
    toast.success("문서 내용으로 채웠어요. 검토 후 저장하세요.")
    warnings.forEach((w) => toast.warning(w))
  }

  const handleUndo = () => {
    if (undoSnapshot) setForm(undoSnapshot)
    setUndoSnapshot(null)
    toast.message("자동 채움을 되돌렸어요.")
  }

  const handleExtractFile = async (file: File) => {
    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase()
    if (!EXTRACT_ALLOWED_EXTS.includes(ext)) {
      toast.error(`지원하지 않는 형식입니다. (${EXTRACT_ALLOWED_EXTS.join(", ")})`)
      return
    }
    if (file.size > EXTRACT_MAX_MB * 1024 * 1024) {
      toast.error(`파일 크기는 ${EXTRACT_MAX_MB}MB 이하여야 합니다.`)
      return
    }

    setUndoSnapshot(null) // 이전 되돌리기 배너 정리
    const abort = new AbortController()
    abortRef.current = abort
    const timer = setTimeout(() => abort.abort(new DOMException("timeout", "TimeoutError")), EXTRACT_TIMEOUT_MS)
    setExtracting(true)
    try {
      const res = await extractFromFile(file, abort.signal)
      const warnings = res.warnings ?? []
      // 하이브리드: 입력값이 없으면 즉시 일괄 프리필, 있으면 확인 모달.
      if (hasMeaningfulInput(form)) {
        setPending({ suggestion: res.suggestion, warnings })
        setConfirmOpen(true)
      } else {
        doPrefill(res.suggestion, warnings, "overwrite")
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "TimeoutError") {
        toast.error("문서 분석이 너무 오래 걸려 중단했어요. 다시 시도하거나 직접 입력해 주세요.")
      } else if (abort.signal.aborted) {
        // 사용자가 취소: 별도 안내 없이 조용히 종료
      } else {
        toast.error(err instanceof Error ? err.message : "문서 분석에 실패했습니다.")
      }
    } finally {
      clearTimeout(timer)
      setExtracting(false)
      abortRef.current = null
    }
  }

  const handleCancelExtract = () =>
    abortRef.current?.abort(new DOMException("canceled", "AbortError"))

  // === 대표 이미지(갤러리) — 다중 업로드 + 클릭으로 대표 지정 ===
  const handleImageFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList).filter((f) => f.type.startsWith("image/"))
    if (files.length === 0) {
      toast.error("이미지 파일만 업로드할 수 있습니다.")
      return
    }
    const remaining = SHOWCASE_MAX_IMAGES - form.image_urls.length
    if (remaining <= 0) {
      toast.error(`이미지는 최대 ${SHOWCASE_MAX_IMAGES}개까지 등록할 수 있습니다.`)
      return
    }
    const pick = files.slice(0, remaining)
    if (files.length > remaining) {
      toast.warning(`최대 ${SHOWCASE_MAX_IMAGES}개까지만 등록되어 ${pick.length}개만 업로드합니다.`)
    }

    setUploadingImage(true)
    try {
      const { urls } = await uploadShowcaseImages(pick)
      setForm((prev) => {
        const next = [...prev.image_urls, ...urls].slice(0, SHOWCASE_MAX_IMAGES)
        return {
          ...prev,
          image_urls: next,
          // 대표가 없으면 첫 업로드 이미지를 대표로 지정
          thumbnail_url: prev.thumbnail_url || next[0] || "",
        }
      })
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "이미지 업로드에 실패했습니다.")
    } finally {
      setUploadingImage(false)
    }
  }

  // 클릭으로 대표 이미지 지정
  const setRepresentative = (url: string) => set("thumbnail_url", url)

  // 개별 이미지 삭제 (대표 삭제 시 남은 첫 이미지로 대표 재지정)
  const removeImage = (url: string) => {
    setForm((prev) => {
      const next = prev.image_urls.filter((u) => u !== url)
      const thumb = prev.thumbnail_url === url ? next[0] ?? "" : prev.thumbnail_url
      return { ...prev, image_urls: next, thumbnail_url: thumb }
    })
  }

  const insertTemplate = () => {
    set("content", (BODY_TEMPLATES[form.item_type] ?? BODY_TEMPLATES.guide) + TEMPLATE_TAIL)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.title.trim().length < 2) {
      toast.error("제목을 2자 이상 입력하세요.")
      return
    }
    if (form.content.trim().length < 10) {
      toast.error("본문을 10자 이상 입력하세요.")
      return
    }

    // 요약을 비워두면 본문에서 자동 생성 (백엔드 최소 10자 보장)
    let summary = form.summary.trim()
    if (!summary) {
      const derived = toPlainText(form.content).slice(0, 150).trim()
      summary = derived.length >= 10 ? derived : form.content.trim().slice(0, 150)
    }

    setLoading(true)
    try {
      const result = await onSubmit({
        ...form,
        summary,
        install_command: form.install_command || undefined,
        source_url: form.source_url || undefined,
      })
      toast.success("저장되었습니다.")
      router.push(`/showcase/${result.id}`)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "저장에 실패했습니다.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* AI 기반 자동 작성 (보조 입력) — 신규 작성에서만, 입력 폼 우측 상단에 버튼으로 노출 */}
      {!initial && (
        <div className="space-y-2">
          <div className="flex items-center justify-end">
            <AutoFillButton
              onFile={handleExtractFile}
              extracting={extracting}
              onCancel={handleCancelExtract}
              disabled={loading}
            />
          </div>
          {/* 되돌리기 배너 (프리필 직후 1회) */}
          {undoSnapshot && (
            <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
              <span className="text-muted-foreground">문서 내용으로 자동 채웠어요.</span>
              <div className="flex items-center gap-1">
                <Button type="button" variant="ghost" size="sm" onClick={handleUndo}>
                  <RotateCcw className="mr-1 h-3.5 w-3.5" />
                  되돌리기
                </Button>
                <button
                  type="button"
                  onClick={() => setUndoSnapshot(null)}
                  className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  title="닫기"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 분류 (라벨 옆 Tabs 선택) */}
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <Label className="w-[68px] flex-shrink-0 pt-1.5">카테고리 *</Label>
          <Tabs
            value={form.category_key}
            onValueChange={(v) => set("category_key", v)}
            className="min-w-0 flex-1"
          >
            <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
              {categories.map((cat) => (
                <TabsTrigger key={cat.key} value={cat.key} className="h-7 flex-none text-xs">
                  {cat.name}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        <div className="flex items-start gap-3">
          <Label className="w-[68px] flex-shrink-0 pt-1.5">유형 *</Label>
          <Tabs
            value={form.item_type}
            onValueChange={(v) => set("item_type", v)}
            className="min-w-0 flex-1"
          >
            <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
              <TabsTrigger value="prompt" className="h-7 flex-none text-xs">프롬프트</TabsTrigger>
              <TabsTrigger value="code" className="h-7 flex-none text-xs">코드</TabsTrigger>
              <TabsTrigger value="guide" className="h-7 flex-none text-xs">가이드</TabsTrigger>
              <TabsTrigger value="workflow" className="h-7 flex-none text-xs">워크플로</TabsTrigger>
              <TabsTrigger value="snippet" className="h-7 flex-none text-xs">스니펫</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* 제목 */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label>제목 *</Label>
          <span className="text-xs text-muted-foreground">{form.title.length}/200</span>
        </div>
        <Input
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          maxLength={200}
          placeholder="무엇을 공유하는지 한 줄로 설명하세요"
        />
      </div>

      {/* 본문 */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label>본문 *</Label>
          <div className="flex items-center gap-3">
            {!form.content.trim() && (
              <button
                type="button"
                onClick={insertTemplate}
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <Wand2 className="h-3.5 w-3.5" />
                기본 템플릿 채우기
              </button>
            )}
            <button
              type="button"
              onClick={() => setBodyMode((m) => (m === "rich" ? "markdown" : "rich"))}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              {bodyMode === "rich" ? "마크다운 직접 입력" : "서식 편집기로 전환"}
            </button>
          </div>
        </div>

        {bodyMode === "rich" ? (
          <RichTextEditor
            format="markdown"
            enableRichBlocks
            value={form.content}
            onChange={(v) => set("content", v)}
            minHeight="240px"
            placeholder="툴바 버튼으로 서식을 지정하며 작성하세요. 마크다운 문법을 몰라도 됩니다."
          />
        ) : (
          <Tabs defaultValue="edit">
            <TabsList className="h-8">
              <TabsTrigger value="edit" className="text-xs px-3">편집</TabsTrigger>
              <TabsTrigger value="preview" className="text-xs px-3">미리보기</TabsTrigger>
            </TabsList>
            <TabsContent value="edit" className="mt-2">
              <Textarea
                value={form.content}
                onChange={(e) => set("content", e.target.value)}
                rows={12}
                className="font-mono text-sm"
                placeholder="마크다운으로 작성하세요..."
              />
            </TabsContent>
            <TabsContent value="preview" className="mt-2">
              <div className="min-h-48 p-4 border rounded-md bg-muted/30">
                {form.content ? (
                  <MarkdownPreview content={form.content} />
                ) : (
                  <p className="text-sm text-muted-foreground">본문을 입력하면 미리보기가 표시됩니다.</p>
                )}
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* 추가 정보 (항상 표시) */}
      <div className="space-y-4 rounded-lg border border-border/60 p-4">
        <div className="text-sm font-medium text-muted-foreground">추가 정보 (선택)</div>

        {/* 대표 이미지 갤러리 — 다중 업로드 + 클릭으로 대표 지정 */}
        <div className="space-y-1.5">
          <Label>
            대표 이미지{" "}
            <span className="text-xs text-muted-foreground">
              (여러 장 업로드 후 클릭해서 대표를 지정하세요 · 최대 {SHOWCASE_MAX_IMAGES}장)
            </span>
          </Label>

          <div className="flex flex-wrap gap-3">
            {form.image_urls.map((url) => {
              const isRep = form.thumbnail_url === url
              return (
                <div
                  key={url}
                  onClick={() => setRepresentative(url)}
                  className={`group relative h-28 w-28 cursor-pointer overflow-hidden rounded-md border-2 transition-colors ${
                    isRep ? "border-primary ring-2 ring-primary/40" : "border-border hover:border-primary/50"
                  }`}
                  title={isRep ? "대표 이미지" : "클릭해서 대표로 지정"}
                >
                  <img
                    src={showcaseImageUrl(url)}
                    alt="첨부 이미지"
                    className="h-full w-full object-cover"
                  />
                  {isRep && (
                    <span className="absolute left-1 top-1 inline-flex items-center gap-0.5 rounded bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
                      <Star className="h-2.5 w-2.5 fill-current" />
                      대표
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      removeImage(url)
                    }}
                    className="absolute right-1 top-1 rounded-full border border-border bg-background/90 p-0.5 opacity-0 shadow transition-opacity hover:bg-muted group-hover:opacity-100"
                    title="이미지 제거"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )
            })}

            {form.image_urls.length < SHOWCASE_MAX_IMAGES && (
              <div
                role="button"
                tabIndex={uploadingImage ? -1 : 0}
                onClick={() => {
                  if (!uploadingImage) galleryInputRef.current?.click()
                }}
                onKeyDown={(e) => {
                  if ((e.key === "Enter" || e.key === " ") && !uploadingImage) {
                    e.preventDefault()
                    galleryInputRef.current?.click()
                  }
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault()
                  if (uploadingImage) return
                  if (e.dataTransfer.files?.length) handleImageFiles(e.dataTransfer.files)
                }}
                className={`flex h-28 w-28 flex-col items-center justify-center gap-1.5 rounded-md border border-dashed border-border bg-muted/20 text-muted-foreground outline-none transition-colors hover:border-primary/50 hover:text-foreground focus-visible:border-primary/60 focus-visible:ring-2 focus-visible:ring-primary/30 ${
                  uploadingImage ? "pointer-events-none opacity-60" : "cursor-pointer"
                }`}
              >
                <ImagePlus className="h-5 w-5" />
                <span className="px-1 text-center text-[11px] leading-tight">
                  {uploadingImage ? "업로드 중..." : "이미지 추가 (여러 장)"}
                </span>
              </div>
            )}
            {/* 숨김 input — 항상 마운트 */}
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) handleImageFiles(e.target.files)
                e.target.value = ""
              }}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label>
              요약 <span className="text-xs text-muted-foreground">(비워두면 본문에서 자동 생성)</span>
            </Label>
            <span className="text-xs text-muted-foreground">{form.summary.length}/500</span>
          </div>
          <Textarea
            value={form.summary}
            onChange={(e) => set("summary", e.target.value)}
            maxLength={500}
            rows={2}
            placeholder="카드에 표시되는 짧은 설명"
          />
        </div>

        <div className="space-y-1.5">
          <Label>태그 <span className="text-xs text-muted-foreground">(최대 10개)</span></Label>
          <TagInput value={form.tags} onChange={(tags) => set("tags", tags)} />
        </div>
      </div>

      <div className="flex gap-2 justify-end pt-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          취소
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? "저장 중..." : submitLabel}
        </Button>
      </div>

      {/* 입력 보호 확인 모달 (이미 입력값이 있을 때) */}
      <AlertDialog
        open={confirmOpen}
        onOpenChange={(o) => {
          if (!o) {
            setConfirmOpen(false)
            setPending(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>이미 입력한 내용이 있어요</AlertDialogTitle>
            <AlertDialogDescription>
              문서에서 추출한 내용을 어떻게 반영할까요? 직접 입력하신 값은 &lsquo;빈 칸만 채우기&rsquo;로 보존할 수 있어요.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setConfirmOpen(false)
                setPending(null)
              }}
            >
              취소
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => pending && doPrefill(pending.suggestion, pending.warnings, "overwrite")}
            >
              제안값으로 모두 바꾸기
            </Button>
            <Button
              type="button"
              onClick={() => pending && doPrefill(pending.suggestion, pending.warnings, "fillEmpty")}
            >
              빈 칸만 채우기
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  )
}
