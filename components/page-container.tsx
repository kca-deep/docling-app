import { cn } from "@/lib/utils"

interface PageContainerProps {
  children: React.ReactNode
  className?: string
  maxWidth?: "default" | "narrow" | "wide" | "full"
  title?: string
  description?: string
}

const maxWidthClasses = {
  narrow: "max-w-4xl",
  default: "max-w-6xl",
  wide: "max-w-7xl",
  full: "max-w-full",
}

export function PageContainer({
  children,
  className,
  maxWidth = "default",
  title,
  description,
}: PageContainerProps) {
  return (
    <div
      className={cn(
        "w-full mx-auto px-4 md:px-6 lg:px-8 py-4 md:py-6",
        maxWidthClasses[maxWidth],
        className
      )}
    >
      {(title || description) && (
        <div className="mb-8">
          {title && <h1 className="text-3xl font-bold tracking-tight">{title}</h1>}
          {description && <p className="text-muted-foreground mt-2">{description}</p>}
        </div>
      )}
      {children}
    </div>
  )
}
