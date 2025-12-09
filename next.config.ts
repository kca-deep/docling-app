import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === 'production';

// 백엔드 URL (개발 환경용)
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';

const nextConfig: NextConfig = {

  // 개발환경: /api와 /health를 백엔드로 프록시
  ...(!isProduction && {
    async rewrites() {
      return [
        {
          source: '/api/:path*',
          destination: `${BACKEND_URL}/api/:path*`,
        },
        {
          source: '/health',
          destination: `${BACKEND_URL}/health`,
        },
        {
          source: '/health/:path*',
          destination: `${BACKEND_URL}/health/:path*`,
        },
      ];
    },
  }),

  // 환경 변수 노출 (클라이언트에서 사용 가능)
  env: {
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL || '',
  },
};

export default nextConfig;
