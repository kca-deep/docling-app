import { cn } from "@/lib/utils"

interface PageContainerProps {
  children: React.ReactNode
  className?: string
  maxWidth?: "default" | "narrow" | "wide" | "full"
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
}: PageContainerProps) {
  return (
    <div
      className={cn(
        "w-full mx-auto px-6 md:px-8 lg:px-12 py-12 md:py-16",
        maxWidthClasses[maxWidth],
        className
      )}
    >
      {children}
    </div>
  )
}
