"use client"

import dynamic from "next/dynamic"
import { Suspense } from "react"
import { ProcessTimelineFallback } from "./ProcessTimeline"
import { InfrastructureSectionFallback } from "./InfrastructureSection"

// Phase 2: Dynamic imports - framer-motion 컴포넌트 지연 로드
const ScrollIndicator = dynamic(
  () => import("./HeroBackground").then(mod => ({ default: mod.ScrollIndicator })),
  { ssr: false }
)

const ProcessTimeline = dynamic(
  () => import("./ProcessTimeline").then(mod => ({ default: mod.ProcessTimeline })),
  {
    ssr: false,
    loading: () => <ProcessTimelineFallback />
  }
)

const InfrastructureSection = dynamic(
  () => import("./InfrastructureSection").then(mod => ({ default: mod.InfrastructureSection })),
  {
    ssr: false,
    loading: () => <InfrastructureSectionFallback />
  }
)

// 동적 로드되는 Client Components를 렌더링하는 래퍼
export function ScrollIndicatorWrapper() {
  return <ScrollIndicator />
}

export function ProcessTimelineWrapper() {
  return (
    <Suspense fallback={<ProcessTimelineFallback />}>
      <ProcessTimeline />
    </Suspense>
  )
}

export function InfrastructureSectionWrapper() {
  return (
    <Suspense fallback={<InfrastructureSectionFallback />}>
      <InfrastructureSection />
    </Suspense>
  )
}
