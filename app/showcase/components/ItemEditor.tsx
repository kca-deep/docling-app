"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ShowcaseCategory, ShowcaseItemCreate, ShowcaseItemDetail } from "@/lib/showcase"
import { TagInput } from "./TagInput"
import { MarkdownPreview } from "./MarkdownPreview"

interface Props {
  categories: ShowcaseCategory[]
  initial?: ShowcaseItemDetail
  onSubmit: (data: ShowcaseItemCreate) => Promise<ShowcaseItemDetail>
  submitLabel?: string
}

export function ItemEditor({ categories, initial, onSubmit, submitLabel = "등록" }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

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
    is_published:    initial?.is_published ?? true,
  })

  const set = <K extends keyof ShowcaseItemCreate>(key: K, val: ShowcaseItemCreate[K]) =>
    setForm((prev) => ({ ...prev, [key]: val }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim() || !form.summary.trim() || !form.content.trim()) {
      toast.error("제목, 요약, 내용은 필수 항목입니다.")
      return
    }
    setLoading(true)
    try {
      const result = await onSubmit({
        ...form,
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>카테고리 *</Label>
          <Select value={form.category_key} onValueChange={(v) => set("category_key", v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat.key} value={cat.key}>{cat.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>유형 *</Label>
          <Select value={form.item_type} onValueChange={(v) => set("item_type", v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="prompt">프롬프트</SelectItem>
              <SelectItem value="code">코드</SelectItem>
              <SelectItem value="guide">가이드</SelectItem>
              <SelectItem value="workflow">워크플로</SelectItem>
              <SelectItem value="snippet">스니펫</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>제목 * <span className="text-xs text-muted-foreground">(2~200자)</span></Label>
        <Input
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          maxLength={200}
          placeholder="무엇을 공유하는지 한 줄로 설명하세요"
        />
      </div>

      <div className="space-y-1.5">
        <Label>요약 * <span className="text-xs text-muted-foreground">(10~500자)</span></Label>
        <Textarea
          value={form.summary}
          onChange={(e) => set("summary", e.target.value)}
          maxLength={500}
          rows={2}
          placeholder="카드에 표시되는 짧은 설명"
        />
      </div>

      <div className="space-y-1.5">
        <Label>본문 * <span className="text-xs text-muted-foreground">(마크다운 지원)</span></Label>
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
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>복사용 명령어 / 주요 코드 <span className="text-xs text-muted-foreground">(선택)</span></Label>
          <Input
            value={form.install_command}
            onChange={(e) => set("install_command", e.target.value)}
            placeholder="예: /imagine a cat"
            className="font-mono text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <Label>참고 URL <span className="text-xs text-muted-foreground">(선택)</span></Label>
          <Input
            value={form.source_url}
            onChange={(e) => set("source_url", e.target.value)}
            type="url"
            placeholder="https://"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>난이도</Label>
          <Select value={form.difficulty} onValueChange={(v) => set("difficulty", v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="beginner">입문</SelectItem>
              <SelectItem value="intermediate">중급</SelectItem>
              <SelectItem value="advanced">고급</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>공개 설정</Label>
          <Select
            value={form.is_published ? "true" : "false"}
            onValueChange={(v) => set("is_published", v === "true")}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="true">공개</SelectItem>
              <SelectItem value="false">비공개</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>태그 <span className="text-xs text-muted-foreground">(최대 10개)</span></Label>
        <TagInput value={form.tags} onChange={(tags) => set("tags", tags)} />
      </div>

      <div className="flex gap-2 justify-end pt-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          취소
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? "저장 중..." : submitLabel}
        </Button>
      </div>
    </form>
  )
}
