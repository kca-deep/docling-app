import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === 'production';

const nextConfig: NextConfig = {
  // 운영환경에서만 basePath 적용
  ...(isProduction && {
    basePath: '/domain',
    assetPrefix: '/domain',
  }),

  // 개발환경: /api를 localhost:8000으로 프록시
  ...(!isProduction && {
    async rewrites() {
      return [
        {
          source: '/api/:path*',
          destination: 'http://localhost:8000/api/:path*',
        },
      ];
    },
  }),
};

export default nextConfig;
