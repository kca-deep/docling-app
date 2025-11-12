"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { XIcon } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * LargeDialog - 큰 콘텐츠를 위한 커스텀 Dialog 컴포넌트
 *
 * 기본 Dialog의 제약사항을 해결한 버전:
 * - flex 레이아웃 기본 사용 (grid 대신)
 * - 넓은 화면 크기 지원
 * - 스크롤 가능한 콘텐츠 지원
 * - 패딩/갭 제거로 완전한 제어 가능
 */

function LargeDialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="large-dialog" {...props} />
}

function LargeDialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="large-dialog-trigger" {...props} />
}

function LargeDialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="large-dialog-portal" {...props} />
}

function LargeDialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="large-dialog-close" {...props} />
}

function LargeDialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="large-dialog-overlay"
      className={cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50",
        className
      )}
      {...props}
    />
  )
}

function LargeDialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
}) {
  return (
    <LargeDialogPortal data-slot="large-dialog-portal">
      <LargeDialogOverlay />
      <DialogPrimitive.Content
        data-slot="large-dialog-content"
        className={cn(
          // 기본 스타일 - flex 레이아웃, 큰 사이즈, 패딩/갭 없음
          "bg-background fixed top-[50%] left-[50%] z-50 flex flex-col",
          "w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%]",
          "rounded-lg border shadow-lg",
          // 애니메이션
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          "duration-200",
          // 커스텀 클래스 우선 적용
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="large-dialog-close"
            className="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </LargeDialogPortal>
  )
}

function LargeDialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="large-dialog-header"
      className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
      {...props}
    />
  )
}

function LargeDialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="large-dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    />
  )
}

function LargeDialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="large-dialog-title"
      className={cn("text-lg leading-none font-semibold", className)}
      {...props}
    />
  )
}

function LargeDialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="large-dialog-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  )
}

export {
  LargeDialog,
  LargeDialogClose,
  LargeDialogContent,
  LargeDialogDescription,
  LargeDialogFooter,
  LargeDialogHeader,
  LargeDialogOverlay,
  LargeDialogPortal,
  LargeDialogTitle,
  LargeDialogTrigger,
}
