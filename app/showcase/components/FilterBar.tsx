"use client"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface Props {
  type: string
  difficulty: string
  sort: string
  onTypeChange: (v: string) => void
  onDifficultyChange: (v: string) => void
  onSortChange: (v: string) => void
}

export function FilterBar({ type, difficulty, sort, onTypeChange, onDifficultyChange, onSortChange }: Props) {
  return (
    <div className="bg-surface rounded-lg px-3 py-2 border border-border/50">
      <div className="flex flex-wrap gap-2">
      <Select value={type} onValueChange={onTypeChange}>
        <SelectTrigger className="w-28 h-8 text-xs">
          <SelectValue placeholder="유형" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">전체 유형</SelectItem>
          <SelectItem value="prompt">프롬프트</SelectItem>
          <SelectItem value="code">코드</SelectItem>
          <SelectItem value="guide">가이드</SelectItem>
          <SelectItem value="workflow">워크플로</SelectItem>
          <SelectItem value="snippet">스니펫</SelectItem>
        </SelectContent>
      </Select>

      <Select value={difficulty} onValueChange={onDifficultyChange}>
        <SelectTrigger className="w-24 h-8 text-xs">
          <SelectValue placeholder="난이도" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">전체</SelectItem>
          <SelectItem value="beginner">입문</SelectItem>
          <SelectItem value="intermediate">중급</SelectItem>
          <SelectItem value="advanced">고급</SelectItem>
        </SelectContent>
      </Select>

      <Select value={sort} onValueChange={onSortChange}>
        <SelectTrigger className="w-24 h-8 text-xs">
          <SelectValue placeholder="정렬" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="created_at">최신순</SelectItem>
          <SelectItem value="view_count">인기순</SelectItem>
        </SelectContent>
      </Select>
      </div>
    </div>
  )
}
