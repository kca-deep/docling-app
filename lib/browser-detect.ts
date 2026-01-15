/**
 * 브라우저 감지 및 성능 최적화 유틸리티
 * Edge 브라우저에서 무거운 애니메이션/효과를 비활성화하기 위함
 */

/**
 * Edge 브라우저인지 확인
 * Edge는 Chromium 기반이지만 backdrop-filter, 대형 blur 등에서 성능 저하 발생
 */
export function isEdgeBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Edg\//.test(navigator.userAgent);
}

/**
 * 저사양 환경인지 확인 (하드웨어 동시성 기준)
 */
export function isLowEndDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  // 논리 프로세서 수가 4개 이하면 저사양으로 판단
  return (navigator.hardwareConcurrency ?? 4) <= 4;
}

/**
 * 사용자가 애니메이션 감소를 선호하는지 확인
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * 애니메이션을 줄여야 하는지 종합 판단
 * - Edge 브라우저
 * - 저사양 디바이스
 * - prefers-reduced-motion 설정
 */
export function shouldReduceAnimations(): boolean {
  return prefersReducedMotion() || isEdgeBrowser() || isLowEndDevice();
}

/**
 * backdrop-filter를 사용해도 되는지 확인
 * Edge에서는 backdrop-filter 성능이 좋지 않음
 */
export function canUseBackdropFilter(): boolean {
  if (typeof window === "undefined") return true;
  // Edge가 아니고, CSS backdrop-filter를 지원하는 경우
  return !isEdgeBrowser() && CSS.supports("backdrop-filter", "blur(1px)");
}
