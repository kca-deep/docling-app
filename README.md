# KCA-RAG Pipeline

AI 기반 문서 파싱 및 RAG(Retrieval-Augmented Generation) 질의응답 시스템

## 빠른 시작

### 1. Clone

```bash
git clone <repository-url>
cd docling-app
```

### 2. 실행

**Windows (권장):**
```powershell
.\run-app.ps1
```

**수동 실행:**
```bash
# 백엔드 설정
cd backend
python -m venv venv
.\venv\Scripts\activate  # Windows
# source venv/bin/activate  # Linux/Mac
pip install -r requirements.txt
cp .env.example .env

# 백엔드 실행
python -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000

# 프론트엔드 설정 (새 터미널)
cd ..
npm install

# 프론트엔드 실행
npm run dev
```

### 3. 접속

- **프론트엔드**: http://localhost:3000
- **백엔드 API**: http://localhost:8000
- **API 문서**: http://localhost:8000/docs

## 주요 기능

- 문서 파싱 (PDF, DOCX, PPTX → Markdown)
- 벡터 임베딩 및 검색 (Qdrant + BGE-M3)
- RAG 기반 AI 채팅
- 검색 결과 재정렬 (BGE Reranker)
- Dify 플랫폼 연동

## 환경 설정

`backend/.env` 파일에서 외부 서비스 URL 설정 (기본값 사용 가능):

```bash
# 문서 파싱 API
DOCLING_BASE_URL=http://kca-ai.kro.kr:8007

# 벡터 DB
QDRANT_URL=http://kca-ai.kro.kr:6333

# AI 서비스
EMBEDDING_URL=http://kca-ai.kro.kr:8083
LLM_BASE_URL=http://kca-ai.kro.kr:8080
```

> 외부 서비스가 실행되지 않아도 애플리케이션은 시작됩니다.
> 실제 기능 사용 시 해당 서비스 필요

## 프로젝트 구조

```
docling-app/
├── backend/                 # FastAPI 백엔드
│   ├── api/routes/         # API 엔드포인트
│   ├── services/           # 비즈니스 로직
│   ├── models/             # DB 모델
│   └── .env.example        # 환경 변수 템플릿
├── app/                    # Next.js 프론트엔드
│   ├── parse/              # 문서 파싱 페이지
│   ├── qdrant/             # 벡터 DB 관리
│   ├── chat/               # RAG 채팅
│   └── dify/               # Dify 연동
└── run-app.ps1             # 실행 스크립트
```

## 주요 페이지

- **홈**: http://localhost:3000
- **문서 파싱**: http://localhost:3000/parse
- **벡터 DB**: http://localhost:3000/qdrant
- **AI 채팅**: http://localhost:3000/chat

## 개발 문서

- **CLAUDE.md**: 상세 개발 가이드
- **docs/system.md**: 외부 서비스 구조
