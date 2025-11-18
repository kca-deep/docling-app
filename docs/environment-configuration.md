# 개발환경 vs 운영환경 설정 가이드

## 📋 개요

프로덕션 배포 시 nginx 리버스 프록시 환경에서 발생하는 경로 설정 문제를 해결하고, Git을 통한 개발/운영 환경 간 충돌 없이 관리하기 위한 가이드입니다.

## 🎯 문제 상황

### 운영 환경 변경 사항

프로덕션 배포를 위해 다음과 같은 변경이 필요했습니다:

#### 1. `next.config.ts` - Next.js 기본 설정

```typescript
// 변경 전
const nextConfig: NextConfig = {
  /* config options here */
};

// 변경 후
const nextConfig: NextConfig = {
  basePath: '/docling',        // nginx의 /docling 경로와 매칭
  assetPrefix: '/docling',     // 정적 파일도 /docling 경로 사용
};
```

**목적**: nginx에서 `/docling` 경로로 서비스하기 위한 설정

#### 2. `lib/api-config.ts` - API 기본 URL 설정

```typescript
// 변경 전
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000'

// 변경 후
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || ''
```

**목적**: CORS 문제 해결을 위해 상대 경로 사용

#### 3. 컴포넌트 파일들 - API 호출 경로 수정

모든 컴포넌트에서 하드코딩된 `http://localhost:8000/api/...`를 `/api/...`로 변경:

| 파일 | 변경 개수 | 주요 변경 내용 |
|------|-----------|----------------|
| `app/chat/components/ChatContainer.tsx` | 4곳 | fetch 호출 경로 |
| `app/chat/components/SuggestedPrompts.tsx` | 1곳 | fetch 호출 경로 |
| `app/parse/page.tsx` | 4곳 | fetch 호출 경로 |
| `app/url-parse/page.tsx` | 2곳 | fetch 호출 경로 |
| `app/upload/page.tsx` | 변경 없음 | 이미 API_BASE_URL 사용 |

### 환경별 차이점

| 항목 | 개발환경 | 운영환경 |
|------|----------|----------|
| **프론트엔드 URL** | `localhost:3000` | `kca-ai.kro.kr/docling` |
| **백엔드 URL** | `localhost:8000` | `kca-ai.kro.kr/api` (nginx 프록시) |
| **basePath 필요성** | ❌ 불필요 | ✅ 필요 (`/docling`) |
| **API 호출 방식** | CORS (다른 포트) | 상대 경로 (같은 도메인) |

### 직면한 문제

1. **basePath 설정 시** → 개발환경에서 `localhost:3000/docling` 접속 필요
2. **API_BASE_URL을 빈 문자열로 변경 시** → 개발환경에서 API 호출 실패 (`localhost:3000/api` → 백엔드 없음)
3. **Git 충돌** → 운영 설정을 커밋하면 개발환경에서 작동 불가

## ✅ 해결 방안

### 전략: 환경 변수 + Next.js Rewrites + 조건부 설정

```
┌─────────────────────────────────────────────────────────────┐
│ 개발환경                                                      │
├─────────────────────────────────────────────────────────────┤
│ 1. basePath 없음 (localhost:3000)                           │
│ 2. /api 요청을 localhost:8000으로 rewrites                   │
│ 3. 코드는 상대 경로 (/api/...) 사용                         │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 운영환경                                                      │
├─────────────────────────────────────────────────────────────┤
│ 1. basePath: /docling                                       │
│ 2. nginx가 /api를 백엔드로 프록시                            │
│ 3. 코드는 상대 경로 (/api/...) 사용 (개발과 동일)           │
└─────────────────────────────────────────────────────────────┘
```

## 🔧 구현 방법

### 1️⃣ 환경 변수 파일 생성

#### `.env.development` (개발용 - Git에 커밋)

```bash
# Frontend Environment Variables (Development)
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NODE_ENV=development
```

#### `.env.production.local` (운영용 - Git 제외)

```bash
# Frontend Environment Variables (Production)
NEXT_PUBLIC_API_BASE_URL=
NODE_ENV=production
```

### 2️⃣ `next.config.ts` 수정

```typescript
import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === 'production';

const nextConfig: NextConfig = {
  // 운영환경에서만 basePath 적용
  ...(isProduction && {
    basePath: '/docling',
    assetPrefix: '/docling',
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
```

**핵심 로직**:
- `NODE_ENV === 'production'`일 때만 basePath 적용
- 개발환경에서는 rewrites로 `/api` 요청을 `localhost:8000`으로 프록시
- 조건부 스프레드 연산자로 환경별 설정 분리

### 3️⃣ `.gitignore` 수정

```gitignore
# Environment variables
.env*
!**/.env.example
!.env.development  # 개발 설정은 커밋 허용
```

**중요**: `.env.production.local`은 서버에만 존재하고 Git에 커밋하지 않음

### 4️⃣ 코드 변경 (상대 경로 사용)

모든 API 호출을 상대 경로로 변경 (이미 수정된 내용 유지):

```typescript
// ✅ 좋은 예 (환경 독립적)
fetch('/api/chat/collections')
fetch('/api/documents/convert')

// ❌ 나쁜 예 (환경 의존적)
fetch('http://localhost:8000/api/chat/collections')
```

## 📁 파일별 변경 요약

| 파일 | 변경 내용 | Git 커밋 여부 |
|------|-----------|---------------|
| `next.config.ts` | 환경별 조건부 설정 추가 | ✅ 커밋 |
| `.env.development` | 개발용 환경 변수 (새로 생성) | ✅ 커밋 |
| `.env.production.local` | 운영용 환경 변수 (새로 생성) | ❌ 서버에만 생성 |
| `.gitignore` | `.env.development` 예외 추가 | ✅ 커밋 |
| `lib/api-config.ts` | 변경 없음 (현재 상태 유지) | - |
| 컴포넌트 파일들 | 상대 경로로 변경 | ✅ 커밋 |

## 🔄 작동 원리

### 개발 환경 시나리오

```
1. 개발자가 localhost:3000 접속
2. /api/chat 요청 발생
3. Next.js rewrites가 자동으로 localhost:8000/api/chat로 전달
4. 백엔드(FastAPI)가 응답
5. 프론트엔드가 응답 처리
```

**장점**: CORS 문제 없음 (Next.js가 프록시 역할)

### 운영 환경 시나리오

```
1. 사용자가 kca-ai.kro.kr/docling 접속
2. /api/chat 요청 발생 (실제로는 /docling에서 시작하므로 절대 경로가 됨)
3. nginx가 /api를 백엔드로 프록시 (location /api { ... })
4. 백엔드(FastAPI)가 응답
5. 프론트엔드가 응답 처리
```

**장점**: 같은 도메인이므로 CORS 설정 불필요

## 🚀 배포 프로세스

### 개발 환경 설정

```bash
# 1. 저장소 클론
git clone <repository-url>
cd docling-app

# 2. 환경 변수는 자동으로 .env.development 사용
# (이미 Git에 포함되어 있음)

# 3. 의존성 설치
npm install
cd backend
python -m venv venv
.\venv\Scripts\activate  # Windows
source venv/bin/activate  # Linux/Mac
pip install -r requirements.txt

# 4. 실행
cd ..
.\run-app.ps1  # 또는 개별 실행
```

### 운영 환경 배포

```bash
# 1. 서버에서 저장소 업데이트
cd /path/to/docling-app
git pull origin main

# 2. .env.production.local 생성 (최초 1회만)
cat > .env.production.local << EOF
NEXT_PUBLIC_API_BASE_URL=
NODE_ENV=production
EOF

# 3. 프론트엔드 빌드
npm install
npm run build

# 4. 서비스 재시작
pm2 restart docling-frontend
# 또는
systemctl restart docling-frontend
```

## 📊 환경 변수 우선순위

Next.js는 다음 순서로 환경 변수를 로드합니다:

1. `.env.production.local` (프로덕션, 최우선)
2. `.env.local` (모든 환경, Git 제외)
3. `.env.production` (프로덕션)
4. `.env.development` (개발)
5. `.env` (기본값)

**권장 사항**:
- 개발: `.env.development` 사용 (Git 커밋)
- 운영: `.env.production.local` 사용 (Git 제외, 보안)

## ⚠️ 주의사항

### Git 관리

```bash
# ✅ Git에 커밋해야 할 것
- .env.development         # 개발 설정 (팀 공유)
- .env.example            # 예제 파일
- next.config.ts          # 환경별 로직
- 컴포넌트 변경 사항      # 상대 경로 사용

# ❌ Git에 커밋하지 말아야 할 것
- .env.production.local   # 운영 설정 (보안, 서버별 차이)
- .env.local              # 로컬 오버라이드
- .env                    # 실제 환경 변수 (예제 제외)
```

### nginx 설정 참고

운영 서버의 nginx 설정 예시:

```nginx
server {
    listen 80;
    server_name kca-ai.kro.kr;

    # 프론트엔드 (Next.js)
    location /docling {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # 백엔드 (FastAPI)
    location /api {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

### 테스트 체크리스트

#### 개발 환경

- [ ] `npm run dev` 실행 시 `localhost:3000`에서 접속 가능
- [ ] API 호출이 `localhost:8000`으로 정상 작동
- [ ] 브라우저 개발자 도구에서 CORS 에러 없음
- [ ] 파일 업로드, 채팅 등 모든 기능 작동

#### 운영 환경

- [ ] `npm run build` 빌드 성공
- [ ] `kca-ai.kro.kr/docling`에서 접속 가능
- [ ] API 호출이 `/api`를 통해 정상 작동
- [ ] 정적 파일(CSS, JS, 이미지) 로드 정상
- [ ] 모든 페이지 라우팅 작동

## 🎯 장점 요약

### ✅ 이 방식의 이점

1. **Git 충돌 방지**
   - 환경별 설정이 완전히 분리됨
   - `.env.production.local`은 서버에만 존재

2. **코드 일원화**
   - 모든 환경에서 동일한 코드 사용
   - 상대 경로로 환경 독립적

3. **개발 경험 개선**
   - CORS 문제 없음 (rewrites 프록시)
   - 환경 전환 시 코드 변경 불필요

4. **보안 강화**
   - 운영 환경 변수가 Git에 노출되지 않음
   - 팀원별 로컬 설정 가능 (`.env.local`)

5. **유지보수 용이**
   - 환경별 설정이 명확히 분리됨
   - 새로운 개발자 온보딩 간소화

## 📚 참고 자료

- [Next.js Environment Variables](https://nextjs.org/docs/basic-features/environment-variables)
- [Next.js Rewrites](https://nextjs.org/docs/api-reference/next.config.js/rewrites)
- [Next.js basePath](https://nextjs.org/docs/api-reference/next.config.js/basepath)

## 🔄 업데이트 이력

| 날짜 | 버전 | 내용 |
|------|------|------|
| 2025-01-XX | 1.0 | 초안 작성 - 환경별 설정 가이드 |

---

**문서 작성자**: AI Assistant
**마지막 업데이트**: 2025년 1월
