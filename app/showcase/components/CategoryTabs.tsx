"use client"

import * as icons from "lucide-react"
import { cn } from "@/lib/utils"
import { ShowcaseCategory } from "@/lib/showcase"

const COLOR_MAP: Record<string, string> = {
  blue:   "text-info",
  purple: "text-purple",
  green:  "text-success",
  orange: "text-warning",
  yellow: "text-warning",
  teal:   "text-primary",
  red:    "text-danger",
}

interface Props {
  categories: ShowcaseCategory[]
  selected: string | null
  onSelect: (key: string | null) => void
}

export function CategoryTabs({ categories, selected, onSelect }: Props) {
  return (
    <div className="bg-canvas rounded-xl p-1 border border-border/50 flex flex-wrap gap-1">
      <button
        onClick={() => onSelect(null)}
        className={cn(
          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors border",
          selected === null
            ? "bg-primary text-primary-foreground border-primary shadow-sm"
            : "bg-surface text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
        )}
      >
        전체
      </button>
      {categories.map((cat) => {
        const Icon = ((icons as unknown) as Record<string, React.ElementType>)[cat.icon] ?? icons.Folder
        const isSelected = selected === cat.key
        return (
          <button
            key={cat.key}
            onClick={() => onSelect(isSelected ? null : cat.key)}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors border",
              isSelected
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "bg-surface text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
            )}
          >
            <Icon className={cn("h-3.5 w-3.5", !isSelected && COLOR_MAP[cat.color])} />
            {cat.name}
            <span className="text-xs opacity-70">{cat.item_count}</span>
          </button>
        )
      })}
    </div>
  )
}
