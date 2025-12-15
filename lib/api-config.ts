/**
 * API Configuration
 * 런타임에 API Base URL을 결정합니다
 *
 * 환경별 동작:
 * - Production: NEXT_PUBLIC_API_BASE_URL 환경변수 사용 (없으면 빈 문자열 -> nginx 프록시)
 * - Development: next.config.ts의 rewrites로 localhost:8000으로 프록시
 *
 * 환경변수 설정:
 * - .env.local (개발): NEXT_PUBLIC_API_BASE_URL= (빈 문자열)
 * - .env.production: NEXT_PUBLIC_API_BASE_URL=https://api.yourdomain.com
 */

/**
 * API Base URL 결정
 * 브라우저/서버 환경에 따라 적절한 URL 반환
 */
const getApiBaseUrl = (): string => {
  // Production 환경에서는 상대 경로 사용 (nginx 프록시)
  if (process.env.NODE_ENV === 'production') {
    return ''
  }

  // 개발 환경에서는 환경변수 또는 기본값 사용
  const envUrl = process.env.NEXT_PUBLIC_API_BASE_URL
  if (envUrl !== undefined) {
    return envUrl
  }

  // 기본값: 빈 문자열 (상대 경로 사용)
  return ''
}

export const API_BASE_URL = getApiBaseUrl()

/**
 * API 엔드포인트 헬퍼
 * 일관된 엔드포인트 접근을 위한 상수
 */
export const apiEndpoints = {
  // 문서 관련
  documents: `${API_BASE_URL}/api/documents`,
  documentConvert: `${API_BASE_URL}/api/documents/convert`,

  // 채팅 관련
  chat: `${API_BASE_URL}/api/chat`,
  chatStream: `${API_BASE_URL}/api/chat/stream`,
  chatCollections: `${API_BASE_URL}/api/chat/collections`,

  // Qdrant 관련
  qdrant: `${API_BASE_URL}/api/qdrant`,
  qdrantCollections: `${API_BASE_URL}/api/qdrant/collections`,
  qdrantUpload: `${API_BASE_URL}/api/qdrant/upload`,
  qdrantSearch: `${API_BASE_URL}/api/qdrant/search`,

  // Dify 관련
  dify: `${API_BASE_URL}/api/dify`,
  difyConfig: `${API_BASE_URL}/api/dify/config`,
  difyDatasets: `${API_BASE_URL}/api/dify/datasets`,
  difyUpload: `${API_BASE_URL}/api/dify/upload`,

  // 인증 관련
  auth: `${API_BASE_URL}/api/auth`,
  authLogin: `${API_BASE_URL}/api/auth/login`,
  authLogout: `${API_BASE_URL}/api/auth/logout`,
  authVerify: `${API_BASE_URL}/api/auth/verify`,

  // 분석 관련
  analytics: `${API_BASE_URL}/api/analytics`,

  // 시스템
  health: `${API_BASE_URL}/health`,
  healthReady: `${API_BASE_URL}/health/ready`,
  healthLive: `${API_BASE_URL}/health/live`,
  healthLlmModels: `${API_BASE_URL}/api/health/llm-models`,

  // 셀프진단 관련
  selfcheck: `${API_BASE_URL}/api/selfcheck`,
  selfcheckLlmStatus: `${API_BASE_URL}/api/selfcheck/llm-status`,
  selfcheckDepartments: `${API_BASE_URL}/api/selfcheck/departments`,
  selfcheckChecklist: `${API_BASE_URL}/api/selfcheck/checklist`,
  selfcheckAnalyze: `${API_BASE_URL}/api/selfcheck/analyze`,
  selfcheckHistory: `${API_BASE_URL}/api/selfcheck/history`,
} as const

/**
 * API 요청 타입
 */
export type ApiEndpoint = keyof typeof apiEndpoints
