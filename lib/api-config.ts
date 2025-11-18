/**
 * API Configuration
 * 환경 변수에서 API Base URL을 가져옵니다
 * 빈 문자열('')을 사용하면 상대 경로로 API를 호출하여 nginx 프록시를 통해 라우팅됩니다
 */
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || ''
