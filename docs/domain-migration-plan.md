# 도메인 마이그레이션 플랜

> **ai.kca.kr** → **ai.kca.kr** 도메인 변경 및 SSL 인증서 교체

## 목차

1. [변경 개요](#1-변경-개요)
2. [백업 절차](#2-백업-절차)
3. [마이그레이션 절차](#3-마이그레이션-절차)
4. [롤백 절차](#4-롤백-절차)
5. [검증 체크리스트](#5-검증-체크리스트)

---

## 1. 변경 개요

### 1.1 변경 항목

| 항목 | 현재 (ai.kca.kr) | 변경 후 (ai.kca.kr) |
|------|---------------------|---------------------|
| **도메인** | ai.kca.kr | ai.kca.kr |
| **SSL 발급기관** | Let's Encrypt | KICA (한국정보인증) |
| **인증서 유형** | 단일 도메인 | 와일드카드 (*.kca.kr) |
| **인증서 경로** | /etc/letsencrypt/live/ai.kca.kr/ | /etc/ssl/kca/ |
| **인증서 파일** | fullchain.pem, privkey.pem | star_kca_kr_NginX_cert.pem, star_kca_kr_NginX_nopass_key.pem |

### 1.2 영향받는 파일

| 파일 | 변경 유형 | 설명 |
|------|----------|------|
| /etc/nginx/sites-available/ai-platform | 수정 | Nginx SSL 설정 |
| backend/.env | 수정 | CORS ALLOWED_ORIGINS |
| backend/.env.example | 수정 | 예시 URL 업데이트 |
| app/upload/page.tsx | 수정 | Dify URL 하드코딩 제거 |
| CLAUDE.md | 수정 | 문서 URL 참조 |

---

## 2. 백업 절차

### 2.1 백업 디렉토리 생성

```bash
# 백업 디렉토리 생성 (타임스탬프 포함)
export BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
export BACKUP_DIR="/data/docling-app/backups/domain-migration-${BACKUP_DATE}"
sudo mkdir -p ${BACKUP_DIR}
```

### 2.2 Nginx 설정 백업

```bash
# 현재 Nginx 설정 백업
sudo cp /etc/nginx/sites-available/ai-platform ${BACKUP_DIR}/nginx-ai-platform.conf.backup
sudo cp -r /etc/nginx/sites-available ${BACKUP_DIR}/sites-available.backup
sudo cp -r /etc/nginx/sites-enabled ${BACKUP_DIR}/sites-enabled.backup

# 백업 확인
ls -la ${BACKUP_DIR}/
```

### 2.3 백엔드 환경변수 백업

```bash
# .env 파일 백업
cp /data/docling-app/backend/.env ${BACKUP_DIR}/backend.env.backup
cp /data/docling-app/backend/.env.example ${BACKUP_DIR}/backend.env.example.backup
```

### 2.4 프론트엔드 코드 백업

```bash
# 변경될 파일 백업
cp /data/docling-app/app/upload/page.tsx ${BACKUP_DIR}/upload-page.tsx.backup
cp /data/docling-app/CLAUDE.md ${BACKUP_DIR}/CLAUDE.md.backup
```

### 2.5 Let's Encrypt 인증서 위치 기록

```bash
# 기존 인증서 경로 기록 (삭제하지 않음)
echo "Let's Encrypt 인증서 경로:" > ${BACKUP_DIR}/letsencrypt-paths.txt
echo "/etc/letsencrypt/live/ai.kca.kr/fullchain.pem" >> ${BACKUP_DIR}/letsencrypt-paths.txt
echo "/etc/letsencrypt/live/ai.kca.kr/privkey.pem" >> ${BACKUP_DIR}/letsencrypt-paths.txt
```

### 2.6 백업 완료 확인

```bash
# 백업 파일 목록 확인
echo "=== 백업 완료 ==="
ls -la ${BACKUP_DIR}/
echo "백업 디렉토리: ${BACKUP_DIR}"
```

---

## 3. 마이그레이션 절차

### Phase 1: 사전 준비

#### 1.1 DNS 확인

```bash
# ai.kca.kr DNS 레코드 확인
nslookup ai.kca.kr
dig ai.kca.kr +short

# 서버 IP와 일치하는지 확인
curl -s ifconfig.me
```

#### 1.2 인증서 유효성 검증

```bash
# 인증서 정보 확인
openssl x509 -in /data/docling-app/docs/ssl/star_kca_kr_NginX_cert.pem -text -noout | grep -E "(Subject:|Not After|Not Before)"

# 인증서-개인키 매칭 확인 (해시값이 동일해야 함)
echo "인증서 해시:"
openssl x509 -noout -modulus -in /data/docling-app/docs/ssl/star_kca_kr_NginX_cert.pem | md5sum

echo "개인키 해시:"
openssl rsa -noout -modulus -in /data/docling-app/docs/ssl/star_kca_kr_NginX_nopass_key.pem | md5sum
```

#### 1.3 인증서 파일 설치

```bash
# SSL 인증서 디렉토리 생성
sudo mkdir -p /etc/ssl/kca

# 인증서 파일 복사
sudo cp /data/docling-app/docs/ssl/star_kca_kr_NginX_cert.pem /etc/ssl/kca/
sudo cp /data/docling-app/docs/ssl/star_kca_kr_NginX_nopass_key.pem /etc/ssl/kca/

# 권한 설정
sudo chmod 644 /etc/ssl/kca/star_kca_kr_NginX_cert.pem
sudo chmod 600 /etc/ssl/kca/star_kca_kr_NginX_nopass_key.pem
sudo chown root:root /etc/ssl/kca/*.pem

# 확인
ls -la /etc/ssl/kca/
```

### Phase 2: Nginx 설정 변경

#### 2.1 새 Nginx 설정 파일 생성

```bash
# 새 설정 파일 생성
sudo tee /etc/nginx/sites-available/ai-platform-new << 'EOF'
upstream dify {
    server 127.0.0.1:3001;
}
upstream llama {
    server 127.0.0.1:8080;
}
upstream docling {
    server 127.0.0.1:3000;
}
upstream docling_backend {
    server 127.0.0.1:8000;
}

# HTTP 서버 (80) - HTTPS로 리다이렉트
server {
    listen 80;
    server_name ai.kca.kr ai.kca.kr;
    client_max_body_size 100M;

    # Let's Encrypt ACME 챌린지용 (인증서 갱신시 필요)
    location ^~ /.well-known/acme-challenge/ {
        default_type "text/plain";
        root /var/www/html;
    }

    # 나머지는 HTTPS로 리다이렉트
    location / {
        return 301 https://ai.kca.kr$request_uri;
    }
}

# 기존 도메인 리다이렉트 (ai.kca.kr -> ai.kca.kr)
server {
    listen 443 ssl http2;
    server_name ai.kca.kr;
    client_max_body_size 100M;

    # 기존 Let's Encrypt 인증서 유지
    ssl_certificate /etc/letsencrypt/live/ai.kca.kr/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ai.kca.kr/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;

    # 새 도메인으로 리다이렉트
    return 301 https://ai.kca.kr$request_uri;
}

# HTTPS 서버 (443) - 메인 서버
server {
    listen 443 ssl http2;
    server_name ai.kca.kr;
    client_max_body_size 100M;

    # SSL 인증서 설정 (KICA 와일드카드)
    ssl_certificate /etc/ssl/kca/star_kca_kr_NginX_cert.pem;
    ssl_certificate_key /etc/ssl/kca/star_kca_kr_NginX_nopass_key.pem;

    # SSL 보안 설정
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
    ssl_prefer_server_ciphers off;

    # SSL 세션 캐시
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    ssl_session_tickets off;

    # 보안 헤더
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    # ===== 악성 요청 차단 규칙 =====

    # ThinkPHP RCE 공격 차단
    location ~* /index\.php {
        if ($args ~* "(invokefunction|call_user_func|shell_exec|eval|base64_decode)") {
            return 444;
        }
        return 404;
    }

    # 악성 redirect 파라미터 차단
    set $block_redirect 0;
    if ($arg_redirect ~* "(https?://|wget|curl|sh|bash|exec|eval|spawn)") {
        set $block_redirect 1;
    }
    if ($args ~* "(wget|curl|chmod|/bin/|/dev/|\.sh)") {
        set $block_redirect 1;
    }

    # 악성 User-Agent 차단
    if ($http_user_agent ~* "(zgrab|masscan|nuclei|nikto|sqlmap)") {
        return 444;
    }

    # 일반적인 취약점 스캔 경로 차단
    location ~* \.(asp|aspx|jsp|cgi|php)$ {
        return 444;
    }

    # Backend API (FastAPI)
    location /api {
        proxy_pass http://docling_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 600s;
    }

    # Next.js 정적 파일
    location ~ ^/(_next|favicon\.ico) {
        proxy_pass http://docling;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Dify
    location /dify/ {
        proxy_pass http://dify/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # LLM API
    location /llm/ {
        proxy_pass http://llama/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 600s;
    }

    # Frontend (Next.js) - docling-app
    location / {
        # 악성 redirect 파라미터 차단
        if ($block_redirect = 1) {
            return 444;
        }

        proxy_pass http://docling;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 600s;
    }
}
EOF
```

#### 2.2 Nginx 설정 검증 및 적용

```bash
# 설정 문법 검사
sudo nginx -t

# 문법 오류가 없으면 심볼릭 링크 변경
sudo rm /etc/nginx/sites-enabled/ai-platform
sudo ln -s /etc/nginx/sites-available/ai-platform-new /etc/nginx/sites-enabled/ai-platform

# Nginx 재시작
sudo systemctl reload nginx

# 상태 확인
sudo systemctl status nginx
```

### Phase 3: 백엔드 설정 변경

#### 3.1 backend/.env 수정

```bash
# ALLOWED_ORIGINS 변경
sed -i 's|http://ai.kca.kr:3000|https://ai.kca.kr|g' /data/docling-app/backend/.env

# 확인
grep ALLOWED_ORIGINS /data/docling-app/backend/.env
```

#### 3.2 백엔드 서비스 재시작

```bash
sudo systemctl restart docling-app-backend.service
sudo systemctl status docling-app-backend.service
```

### Phase 4: 프론트엔드 코드 변경

#### 4.1 app/upload/page.tsx 수정

파일의 58번째 줄 수정:
```typescript
// 변경 전
const [difyBaseUrl, setDifyBaseUrl] = useState("http://ai.kca.kr:5001/v1")

// 변경 후
const [difyBaseUrl, setDifyBaseUrl] = useState("https://ai.kca.kr:5001/v1")
```

#### 4.2 프론트엔드 빌드 및 재시작

```bash
cd /data/docling-app
npm run build
sudo systemctl restart docling-app-frontend.service
```

### Phase 5: 문서 업데이트

#### 5.1 CLAUDE.md URL 일괄 변경

```bash
sed -i 's/kca-ai\.kro\.kr/ai.kca.kr/g' /data/docling-app/CLAUDE.md
```

#### 5.2 backend/.env.example 업데이트

```bash
sed -i 's/kca-ai\.kro\.kr/ai.kca.kr/g' /data/docling-app/backend/.env.example
```

---

## 4. 롤백 절차

### 4.1 즉시 롤백 (Nginx만)

문제 발생 시 가장 빠른 롤백:

```bash
# 백업된 Nginx 설정 복원
export BACKUP_DIR="/data/docling-app/backups/domain-migration-YYYYMMDD_HHMMSS"  # 실제 경로로 변경

sudo cp ${BACKUP_DIR}/nginx-ai-platform.conf.backup /etc/nginx/sites-available/ai-platform
sudo rm /etc/nginx/sites-enabled/ai-platform
sudo ln -s /etc/nginx/sites-available/ai-platform /etc/nginx/sites-enabled/ai-platform

# Nginx 재시작
sudo nginx -t && sudo systemctl reload nginx
```

### 4.2 전체 롤백

모든 변경사항 복원:

```bash
export BACKUP_DIR="/data/docling-app/backups/domain-migration-YYYYMMDD_HHMMSS"  # 실제 경로로 변경

# 1. Nginx 설정 복원
sudo cp ${BACKUP_DIR}/nginx-ai-platform.conf.backup /etc/nginx/sites-available/ai-platform
sudo rm /etc/nginx/sites-enabled/ai-platform
sudo ln -s /etc/nginx/sites-available/ai-platform /etc/nginx/sites-enabled/ai-platform
sudo nginx -t && sudo systemctl reload nginx

# 2. 백엔드 환경변수 복원
cp ${BACKUP_DIR}/backend.env.backup /data/docling-app/backend/.env
sudo systemctl restart docling-app-backend.service

# 3. 프론트엔드 코드 복원
cp ${BACKUP_DIR}/upload-page.tsx.backup /data/docling-app/app/upload/page.tsx
cd /data/docling-app && npm run build
sudo systemctl restart docling-app-frontend.service

# 4. 문서 복원
cp ${BACKUP_DIR}/CLAUDE.md.backup /data/docling-app/CLAUDE.md
```

### 4.3 롤백 검증

```bash
# 서비스 상태 확인
sudo systemctl status nginx
sudo systemctl status docling-app-backend.service
sudo systemctl status docling-app-frontend.service

# 웹사이트 접속 테스트
curl -I https://ai.kca.kr
```

---

## 5. 검증 체크리스트

### 5.1 마이그레이션 후 검증

#### SSL 인증서 검증

```bash
# 새 도메인 SSL 확인
openssl s_client -connect ai.kca.kr:443 -servername ai.kca.kr 2>/dev/null | openssl x509 -noout -subject -dates

# 기존 도메인 리다이렉트 확인
curl -I https://ai.kca.kr 2>/dev/null | grep -E "(HTTP|Location)"
```

#### 서비스 동작 검증

| 테스트 항목 | 명령어/URL | 예상 결과 |
|------------|-----------|----------|
| 메인 페이지 | https://ai.kca.kr | 200 OK |
| API 상태 | https://ai.kca.kr/api/health | 200 OK, JSON 응답 |
| 기존 도메인 리다이렉트 | https://ai.kca.kr | 301 -> https://ai.kca.kr |
| Dify | https://ai.kca.kr/dify/ | Dify 페이지 로드 |

#### 브라우저 검증

1. https://ai.kca.kr 접속
2. 자물쇠 아이콘 클릭 → 인증서 정보 확인
3. 발급자: KICA (한국정보인증)
4. 도메인: *.kca.kr

### 5.2 체크리스트

- [ ] DNS 전파 완료 확인
- [ ] SSL 인증서 유효성 확인
- [ ] Nginx 설정 문법 검사 통과
- [ ] 새 도메인 HTTPS 접속 성공
- [ ] 기존 도메인 리다이렉트 동작
- [ ] 백엔드 API 정상 응답
- [ ] 프론트엔드 페이지 로드 성공
- [ ] 로그인 기능 정상
- [ ] 채팅 기능 정상
- [ ] 파일 업로드 기능 정상

---

## 부록: 빠른 참조

### 주요 경로

| 항목 | 경로 |
|------|------|
| Nginx 설정 | /etc/nginx/sites-available/ai-platform |
| 새 SSL 인증서 | /etc/ssl/kca/star_kca_kr_NginX_cert.pem |
| 새 SSL 개인키 | /etc/ssl/kca/star_kca_kr_NginX_nopass_key.pem |
| 기존 SSL 인증서 | /etc/letsencrypt/live/ai.kca.kr/ |
| 백엔드 환경변수 | /data/docling-app/backend/.env |

### 서비스 명령어

```bash
# Nginx
sudo nginx -t                    # 설정 검사
sudo systemctl reload nginx      # 설정 리로드
sudo systemctl restart nginx     # 재시작

# 백엔드
sudo systemctl restart docling-app-backend.service
sudo systemctl status docling-app-backend.service

# 프론트엔드
sudo systemctl restart docling-app-frontend.service
sudo systemctl status docling-app-frontend.service
```

### 문제 해결

| 문제 | 해결 방법 |
|------|----------|
| Nginx 시작 실패 | `sudo nginx -t`로 설정 오류 확인 |
| SSL 인증서 오류 | 인증서-개인키 해시 매칭 확인 |
| 502 Bad Gateway | 백엔드/프론트엔드 서비스 상태 확인 |
| CORS 오류 | backend/.env의 ALLOWED_ORIGINS 확인 |

---

**문서 작성일**: 2025-12-09
**작성자**: Claude Code
