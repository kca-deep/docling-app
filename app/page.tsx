import { FloatingChatButton } from "@/components/floating-chat-button"
import { HeroSection } from "./components/home/HeroSection"
import {
  ScrollIndicatorWrapper,
  ProcessTimelineWrapper,
  InfrastructureSectionWrapper,
} from "./components/home/HomeClient"

// Server Component - SSR로 즉시 렌더링
// HeroSection은 정적 콘텐츠로 즉시 HTML 출력
// 애니메이션/API 호출 컴포넌트는 Client Component로 분리하여 동적 로드
export default function HomePage() {
  return (
    <>
      {/* Hero Section */}
      <div className="relative w-full text-center min-h-[calc(100vh-4rem)] lg:min-h-[85vh] flex flex-col justify-center overflow-hidden">
        {/* Hero Content - Server Component (즉시 렌더링, 정적 콘텐츠) */}
        <HeroSection />

        {/* Scroll Indicator - Client Component (동적 로드) */}
        <ScrollIndicatorWrapper />
      </div>

      {/* Process Flow Timeline - Client Component (동적 로드 + 폴백) */}
      <ProcessTimelineWrapper />

      {/* 시스템 인프라 섹션 - Client Component (Lazy API 호출) */}
      <InfrastructureSectionWrapper />

      {/* 플로팅 챗봇 버튼 */}
      <FloatingChatButton />
    </>
  )
}
