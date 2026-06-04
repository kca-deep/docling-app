"use client"

import Link from "next/link"
import { Eye, Star, User } from "lucide-react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { ShowcaseItem } from "@/lib/showcase"
import { CategoryBadge } from "./CategoryBadge"
import { ItemTypeBadge } from "./ItemTypeBadge"
import { DifficultyBadge } from "./DifficultyBadge"
import { cn } from "@/lib/utils"

interface Props {
  item: ShowcaseItem
  categoryColor: string
  hideCategoryBadge?: boolean
}

export function ShowcaseCard({ item, categoryColor, hideCategoryBadge = false }: Props) {
  return (
    <Link href={`/showcase/${item.id}`} className="group block h-full">
      <Card
        className={cn(
          "h-full flex flex-col transition-all border-border/60 shadow-card hover:border-primary/30 hover:shadow-md hover:bg-elevated",
          item.is_featured && "ring-1 ring-warning/40"
        )}
      >
        {item.is_featured && (
          <div className="h-0.5 w-full bg-warning/50 rounded-t-lg" />
        )}
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-1.5 min-w-0">
              {!hideCategoryBadge && (
                <CategoryBadge name={item.category_name} color={categoryColor} />
              )}
              {item.is_featured && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-warning-bg text-warning">
                  <Star className="h-2.5 w-2.5 fill-current" />
                  Pick
                </span>
              )}
            </div>
            <ItemTypeBadge type={item.item_type} className="flex-shrink-0" />
          </div>
          <h3 className="text-sm font-semibold leading-snug line-clamp-2 group-hover:text-primary transition-colors">
            {item.title}
          </h3>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col gap-2 px-4 pb-4">
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
            {item.summary}
          </p>

          {item.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-auto pt-1">
              {item.tags.slice(0, 3).map((tag) => (
                <span key={tag} className="text-[10px] text-muted-foreground hover:text-primary transition-colors">
                  {tag}
                </span>
              ))}
              {item.tags.length > 3 && (
                <span className="text-[10px] text-muted-foreground">+{item.tags.length - 3}</span>
              )}
            </div>
          )}

          <div className="flex items-center justify-between mt-auto pt-2 border-t border-border/40">
            <div className="flex items-center gap-1.5 min-w-0">
              <DifficultyBadge difficulty={item.difficulty} />
              {item.author_name && (
                <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground truncate max-w-20">
                  <User className="h-2.5 w-2.5 flex-shrink-0" />
                  {item.author_name}
                </span>
              )}
            </div>
            <span className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
              <Eye className="h-3 w-3" />
              {item.view_count.toLocaleString()}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
