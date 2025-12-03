/**
 * API Configuration
 * 런타임에 API Base URL을 결정합니다
 *
 * Production 빌드 (kca-ai.kro.kr): 빈 문자열 사용 (nginx 프록시 통해 라우팅)
 * Development (localhost:3000): next.config.ts의 rewrites로 localhost:8000으로 프록시
 *
 * 두 환경 모두 빈 문자열을 사용하여 상대 경로로 API 호출
 * - Production: nginx가 /api를 백엔드로 프록시
 * - Development: next.config.ts rewrites가 /api를 localhost:8000으로 프록시
 */
export const API_BASE_URL = ''
