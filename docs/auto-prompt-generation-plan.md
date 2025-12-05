# 자동 프롬프트 생성 시스템 설계 문서

**버전**: 1.0
**작성일**: 2025-01-17
**상태**: 계획 단계
**목적**: Qdrant 문서 업로드 시 시스템 프롬프트 및 추천 질문 자동 생성

---

## 📋 목차

1. [개요 및 목표](#1-개요-및-목표)
2. [시스템 아키텍처](#2-시스템-아키텍처)
3. [데이터 플로우](#3-데이터-플로우)
4. [API 명세](#4-api-명세)
5. [UI/UX 설계](#5-uiux-설계)
6. [메타 프롬프트 전략](#6-메타-프롬프트-전략)
7. [구현 로드맵](#7-구현-로드맵)
8. [위험 관리](#8-위험-관리)
9. [참고 자료](#9-참고-자료)
10. [메뉴 구조 개편 및 페이지 통합](#10-메뉴-구조-개편-및-페이지-통합)
11. [컬렉션 관리 페이지](#11-컬렉션-관리-페이지)
12. [다음 단계](#12-다음-단계)
13. [버전 히스토리](#13-버전-히스토리)

---

## 1. 개요 및 목표

### 1.1 현재 문제점

**현재 프로세스** (수동):
```
1. 사용자가 문서를 Qdrant에 업로드
2. 개발자가 수동으로 프롬프트 작성 (regulation.md, budget.md)
3. 개발자가 수동으로 mapping.json 수정
4. 개발자가 수동으로 suggested_prompts.json 수정
```

**문제점**:
- ❌ 시간 소모적 (프롬프트 작성에 1-2시간)
- ❌ 일관성 부족 (작성자마다 스타일 차이)
- ❌ 확장성 낮음 (새 컬렉션마다 수동 작업 필요)
- ❌ 사용자 의존성 (개발자가 직접 작성해야 함)

### 1.2 목표

**자동화 프로세스**:
```
1. 사용자가 문서를 Qdrant에 업로드
2. "프롬프트 자동 생성" 버튼 클릭
3. LLM이 문서 분석하여 프롬프트 생성
4. 미리보기 및 수정 (사용자)
5. 저장 → 자동으로 mapping.json, suggested_prompts.json 업데이트
```

**기대 효과**:
- ✅ 작성 시간 단축 (2시간 → 5분)
- ✅ 일관성 보장 (템플릿 기반 생성)
- ✅ 확장성 향상 (무제한 컬렉션 지원)
- ✅ 사용자 친화성 (개발 지식 불필요)

---

## 2. 시스템 아키텍처

### 2.1 전체 구조

```
┌─────────────────────────────────────────────────────────────┐
│                      프론트엔드 (/qdrant)                    │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  문서 업로드 완료                                       │ │
│  │  → [프롬프트 자동 생성] 버튼 클릭                      │ │
│  │  → PromptGeneratorModal 오픈                            │ │
│  │     - 템플릿 선택 (regulation.md / budget.md)          │ │
│  │     - 파일명 입력                                       │ │
│  │  → [생성] 버튼 클릭                                     │ │
│  └────────────────────────────────────────────────────────┘ │
└────────────────────┬────────────────────────────────────────┘
                     │ POST /api/prompts/generate
                     ↓
┌─────────────────────────────────────────────────────────────┐
│                    백엔드 API 레이어                         │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  /api/prompts/generate                                 │ │
│  │  → 백그라운드 작업 시작 (task_id 반환)                 │ │
│  │                                                         │ │
│  │  /api/prompts/generate/{task_id}                       │ │
│  │  → 진행 상태 폴링 (processing → completed)             │ │
│  │                                                         │ │
│  │  /api/prompts/save                                     │ │
│  │  → 파일 저장 (백업 → 쓰기 → 검증)                      │ │
│  └────────────────────────────────────────────────────────┘ │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────────┐
│                   백엔드 서비스 레이어                       │
│  ┌──────────────────┐  ┌──────────────────┐               │
│  │ DocumentSampler  │  │ PromptGenerator  │               │
│  │ Service          │  │ Service          │               │
│  │ - Qdrant에서     │  │ - LLM 호출       │               │
│  │   문서 샘플 추출 │  │ - 메타 프롬프트  │               │
│  │ - 전략적 샘플링  │  │   조합           │               │
│  └──────────────────┘  └──────────────────┘               │
│                                                             │
│  ┌──────────────────┐  ┌──────────────────┐               │
│  │ PromptValidator  │  │ FileManager      │               │
│  │ - 필수 요소 검증 │  │ Service          │               │
│  │ - 품질 체크      │  │ - 백업/복원      │               │
│  └──────────────────┘  │ - 트랜잭션 쓰기  │               │
│                        └──────────────────┘               │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────────┐
│                  외부 서비스 (LLM)                           │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  포트 8080: GPT-OSS 20B / EXAONE 32B / HyperCLOVA X   │ │
│  │  - 메타 프롬프트 + 문서 샘플 → 새 프롬프트 생성       │ │
│  │  - 문서 샘플 → 추천 질문 6개 생성                     │ │
│  └────────────────────────────────────────────────────────┘ │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────────┐
│                    파일 시스템                               │
│  backend/prompts/                                           │
│  ├── regulation.md          (템플릿)                        │
│  ├── budget.md              (템플릿)                        │
│  ├── {new_collection}.md    (생성됨)                        │
│  ├── mapping.json           (자동 업데이트)                 │
│  ├── meta/                                                  │
│  │   └── meta_prompt.md     (메타 프롬프트)                 │
│  └── backups/                                               │
│      └── 2025-01-17_14-30/  (타임스탬프 백업)               │
│                                                             │
│  backend/config/                                            │
│  └── suggested_prompts.json (자동 업데이트)                 │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 주요 컴포넌트

#### Backend Services

| 서비스 | 파일명 | 역할 |
|--------|--------|------|
| **DocumentSelector** | `document_selector_service.py` | SQLite에서 저장된 문서 조회 및 샘플 추출 |
| **PromptGenerator** | `prompt_generator_service.py` | LLM 호출하여 프롬프트 생성 |
| **PromptValidator** | `prompt_validator.py` | 생성된 프롬프트 검증 |
| **FileManager** | `file_manager_service.py` | 파일 쓰기/백업/롤백 |

#### Frontend Components

| 컴포넌트 | 파일명 | 역할 |
|----------|--------|------|
| **PromptGeneratorModal** | `PromptGeneratorModal.tsx` | 프롬프트 생성 모달 |
| **PromptEditor** | `PromptEditor.tsx` | 마크다운 프롬프트 편집기 |
| **SuggestedQuestionsEditor** | `SuggestedQuestionsEditor.tsx` | 질문 목록 편집기 |

---

## 3. 데이터 플로우

### 3.1 전체 워크플로우

```
[사용자 액션]
  │
  ├─ 1. /qdrant 페이지에서 문서 업로드 완료
  │    - 컬렉션: "3. 보안 정책"
  │    - 문서 5개 업로드 완료
  │
  ├─ 2. "프롬프트 자동 생성" 버튼 클릭
  │    ↓
  │    ┌─────────────────────────────────────┐
  │    │  PromptGeneratorModal 오픈          │
  │    │  - 문서 선택: "보안 정책 규정.pdf"  │
  │    │  - 템플릿 선택: regulation.md       │
  │    │  - 파일명: security_policy          │
  │    │  - [생성하기] 버튼                   │
  │    └─────────────────────────────────────┘
  │
  ├─ 3. 생성 요청 전송
  │    POST /api/prompts/generate
  │    {
  │      "collection_name": "3. 보안 정책",
  │      "document_id": 42,
  │      "template": "regulation.md",
  │      "prompt_filename": "security_policy"
  │    }
  │    ↓
  │    Response: { "task_id": "prompt-gen-123" }
  │
  ├─ 4. 백그라운드 처리 (백엔드)
  │    ┌──────────────────────────────────────┐
  │    │ DocumentSelector: 문서 조회 및 샘플  │
  │    │ - SQLite에서 document_id=42 조회    │
  │    │ - md_content 가져오기 (전체 마크다운)│
  │    │ - 전략적 샘플링:                     │
  │    │   • 첫 20% (목차, 서론)              │
  │    │   • 중간 40% (본문)                  │
  │    │   • 끝 20% (부칙, 별표)              │
  │    │ - 총 ~4000 토큰으로 제한             │
  │    └──────────────────────────────────────┘
  │    ↓
  │    ┌──────────────────────────────────────┐
  │    │ PromptGenerator: LLM 호출 (병렬)    │
  │    │                                      │
  │    │ [작업 1] 프롬프트 생성               │
  │    │ - 메타 프롬프트 로드                 │
  │    │ - regulation.md 템플릿 로드          │
  │    │ - 문서 샘플 조합                     │
  │    │ - LLM 호출 (8080 포트)               │
  │    │ - 응답 파싱                          │
  │    │                                      │
  │    │ [작업 2] 추천 질문 생성               │
  │    │ - 문서 샘플 분석                     │
  │    │ - 기존 질문 스타일 학습               │
  │    │ - LLM 호출 (8080 포트)               │
  │    │ - JSON 배열 파싱                     │
  │    └──────────────────────────────────────┘
  │    ↓
  │    ┌──────────────────────────────────────┐
  │    │ PromptValidator: 검증                │
  │    │ - {reasoning_instruction} 존재?     │
  │    │ - 메타정보 섹션 존재?                │
  │    │ - 최소 길이 충족?                    │
  │    │ - 질문 개수 6개?                     │
  │    └──────────────────────────────────────┘
  │    ↓
  │    Result: {
  │      "prompt_content": "# 보안 정책...",
  │      "suggested_questions": [...],
  │      "status": "completed"
  │    }
  │
  ├─ 5. 진행 상태 폴링 (프론트엔드)
  │    GET /api/prompts/generate/prompt-gen-123
  │    - 1초마다 폴링
  │    - 진행률 표시: 0% → 60% → 100%
  │    ↓
  │    ┌─────────────────────────────────────┐
  │    │  미리보기 화면 표시                  │
  │    │  [프롬프트 탭] [추천 질문 탭]        │
  │    │  - 편집 가능                         │
  │    │  - [저장] [재생성] [취소]            │
  │    └─────────────────────────────────────┘
  │
  ├─ 6. 사용자 수정 (선택사항)
  │    - 프롬프트 일부 수정
  │    - 질문 추가/삭제/수정
  │
  └─ 7. 저장 요청
       POST /api/prompts/save
       {
         "collection_name": "3. 보안 정책",
         "prompt_filename": "security_policy.md",
         "prompt_content": "...",
         "suggested_questions": [...],
         "recommended_params": { top_k: 10, ... }
       }
       ↓
       ┌──────────────────────────────────────┐
       │ FileManager: 파일 저장 (트랜잭션)    │
       │                                      │
       │ 1. 백업 생성                         │
       │    - prompts/backups/2025-01-17_... │
       │    - mapping.json 백업               │
       │    - suggested_prompts.json 백업     │
       │                                      │
       │ 2. 새 파일 작성                      │
       │    - prompts/security_policy.md      │
       │                                      │
       │ 3. mapping.json 업데이트             │
       │    {                                 │
       │      "3. 보안 정책": {               │
       │        "prompt_file": "security_...", │
       │        ...                           │
       │      }                               │
       │    }                                 │
       │                                      │
       │ 4. suggested_prompts.json 업데이트   │
       │    {                                 │
       │      "3. 보안 정책": [...]           │
       │    }                                 │
       │                                      │
       │ 5. 검증                              │
       │    - JSON 파싱 성공?                 │
       │    - 파일 쓰기 성공?                 │
       │    - 실패 시 롤백                    │
       └──────────────────────────────────────┘
       ↓
       Success: {
         "backup_path": "prompts/backups/...",
         "files_updated": [...]
       }
```

### 3.2 문서 샘플 추출 전략

**목표**: 선택한 원본 파일의 전체 구조를 대표하는 샘플 추출 (총 4000 토큰 이내)

**데이터 소스**: SQLite의 Document 테이블 (`md_content` 컬럼)

```python
# 의사코드
def extract_document_sample(document_id: int) -> dict:
    """
    SQLite에서 저장된 문서의 md_content 샘플링
    """
    # 1. SQLite에서 문서 조회
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise Exception(f"Document {document_id} not found")

    md_content = document.md_content
    total_length = len(md_content)

    # 2. 전략적 샘플링 (비율 기반)
    start_portion = md_content[:int(total_length * 0.20)]    # 첫 20%
    middle_start = int(total_length * 0.40)
    middle_end = int(total_length * 0.60)
    middle_portion = md_content[middle_start:middle_end]     # 중간 20%
    end_portion = md_content[int(total_length * 0.80):]      # 끝 20%

    samples = {
        "start": start_portion,      # 목차, 서론
        "middle": middle_portion,    # 본문
        "end": end_portion,          # 부칙, 별표
        "filename": document.original_filename,
        "total_pages": extract_page_count(md_content)  # 마크다운에서 페이지 수 추출
    }

    # 3. 토큰 제한 (4000 토큰)
    return truncate_to_token_limit(samples, 4000)
```

**샘플링 전략**:
- **첫 20%**: 목차, 서론, 총칙 → 문서 구조 파악
- **중간 20%** (40-60% 구간): 본문 내용 → 실제 규정/데이터 확인
- **끝 20%**: 부칙, 별표, 서식 → 특수 구조 파악
- **총 60%를 4000 토큰으로 압축**

**장점**:
- ✅ 원본 파일 그대로 사용 (청크 병합 불필요)
- ✅ 페이지 순서 보장
- ✅ 문서 일관성 유지
- ✅ 빠른 처리 (Qdrant 조회 불필요)

---

## 4. API 명세

### 4.1 프롬프트 생성 시작

**엔드포인트**: `POST /api/prompts/generate`

**Request Body**:
```json
{
  "collection_name": "3. 보안 정책",
  "document_id": 42,
  "template": "regulation.md",
  "prompt_filename": "security_policy"
}
```

**Request 파라미터**:
| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `collection_name` | string | ✅ | Qdrant 컬렉션 이름 (매핑용) |
| `document_id` | integer | ✅ | SQLite에 저장된 문서 ID |
| `template` | string | ✅ | 참조 템플릿 (regulation.md, budget.md, default.md) |
| `prompt_filename` | string | ✅ | 생성할 프롬프트 파일명 (확장자 제외) |

**Response** (202 Accepted):
```json
{
  "task_id": "prompt-gen-1737098765432",
  "status": "processing",
  "estimated_time": 25,
  "message": "프롬프트 생성이 시작되었습니다"
}
```

**에러 응답** (400 Bad Request):
```json
{
  "error": "Invalid template name",
  "detail": "Template 'invalid.md' does not exist. Available: regulation.md, budget.md, default.md"
}
```

---

### 4.2 프롬프트 생성 상태 조회

**엔드포인트**: `GET /api/prompts/generate/{task_id}`

**Response** (진행 중):
```json
{
  "task_id": "prompt-gen-1737098765432",
  "status": "processing",
  "progress": 60,
  "current_step": "LLM 프롬프트 생성 중...",
  "elapsed_time": 12
}
```

**Response** (완료):
```json
{
  "task_id": "prompt-gen-1737098765432",
  "status": "completed",
  "progress": 100,
  "elapsed_time": 23,
  "result": {
    "prompt_content": "# 보안 정책 전용 시스템 프롬프트\n\n## 메타정보...",
    "suggested_questions": [
      "정보보안 등급 분류는 어떻게 되나요?",
      "보안사고 발생 시 신고 절차는?",
      "개인정보 보호 의무는 무엇인가요?",
      "외부 반출 승인 절차는?",
      "비밀번호 변경 주기는?",
      "보안 교육은 연간 몇 회인가요?"
    ],
    "metadata": {
      "detected_document_type": "policy",
      "total_pages": 45,
      "word_count": 12500,
      "sections_count": 15,
      "has_tables": true,
      "has_appendix": true
    }
  }
}
```

**Response** (실패):
```json
{
  "task_id": "prompt-gen-1737098765432",
  "status": "failed",
  "progress": 35,
  "error": "LLM timeout: No response after 60 seconds",
  "retry_available": true
}
```

---

### 4.3 프롬프트 저장

**엔드포인트**: `POST /api/prompts/save`

**Request Body**:
```json
{
  "collection_name": "3. 보안 정책",
  "prompt_filename": "security_policy.md",
  "prompt_content": "# 보안 정책 전용...",
  "suggested_questions": [
    "질문 1",
    "질문 2",
    ...
  ],
  "recommended_params": {
    "top_k": 10,
    "temperature": 0.3,
    "reasoning_level": "high"
  },
  "description": "정보보안, 개인정보보호 등 보안 관련 문서"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "backup_path": "prompts/backups/2025-01-17_14-35-22/",
  "files_updated": [
    "prompts/security_policy.md",
    "prompts/mapping.json",
    "config/suggested_prompts.json"
  ],
  "message": "프롬프트가 성공적으로 저장되었습니다"
}
```

**에러 응답** (500 Internal Server Error):
```json
{
  "success": false,
  "error": "File write failed",
  "detail": "Permission denied: prompts/security_policy.md",
  "backup_restored": true,
  "message": "저장 실패. 백업에서 복원되었습니다."
}
```

---

### 4.4 컬렉션의 문서 목록 조회

**엔드포인트**: `GET /api/prompts/documents/{collection_name}`

**Response**:
```json
{
  "collection_name": "3. 보안 정책",
  "documents": [
    {
      "id": 42,
      "original_filename": "보안 정책 규정.pdf",
      "content_length": 12500,
      "processing_time": 15.2,
      "created_at": "2025-01-17T14:20:00"
    },
    {
      "id": 43,
      "original_filename": "개인정보 보호 지침.pdf",
      "content_length": 6800,
      "processing_time": 8.5,
      "created_at": "2025-01-17T14:25:00"
    }
  ],
  "total": 5
}
```

**용도**: 프롬프트 생성 모달에서 문서 선택 드롭다운에 사용

---

### 4.5 템플릿 목록 조회

**엔드포인트**: `GET /api/prompts/templates`

**Response**:
```json
{
  "templates": [
    {
      "filename": "regulation.md",
      "name": "규정/지침 문서용",
      "description": "법령, 규정, 지침 등 조항 구조를 가진 문서에 적합",
      "file_size": 6097,
      "sections": 12,
      "example_collections": ["1. 인사 및 복무"]
    },
    {
      "filename": "budget.md",
      "name": "예산/회계 문서용",
      "description": "예산, 회계, 여비, 법인카드 등 금액 계산이 필요한 문서에 적합",
      "file_size": 13591,
      "sections": 15,
      "example_collections": ["2. 예산관리"]
    },
    {
      "filename": "default.md",
      "name": "범용 문서용",
      "description": "기타 모든 문서 유형에 사용 가능한 기본 템플릿",
      "file_size": 747,
      "sections": 3,
      "example_collections": []
    }
  ]
}
```

---

### 4.6 롤백

**엔드포인트**: `POST /api/prompts/rollback`

**Request Body**:
```json
{
  "backup_path": "prompts/backups/2025-01-17_14-35-22/"
}
```

**Response**:
```json
{
  "success": true,
  "files_restored": [
    "prompts/mapping.json",
    "config/suggested_prompts.json",
    "prompts/security_policy.md"
  ],
  "message": "백업에서 복원되었습니다"
}
```

---

## 5. UI/UX 설계

### 5.1 프롬프트 생성 버튼 (기존 /qdrant 페이지)

**위치**: 문서 업로드 완료 후 컬렉션 카드에 표시

```
┌─────────────────────────────────────────────────────┐
│  컬렉션: 3. 보안 정책                    [삭제]      │
├─────────────────────────────────────────────────────┤
│  벡터 개수: 523                                      │
│  업로드된 문서: 5개                                  │
│  - 보안 정책 규정.pdf                               │
│  - 개인정보 보호 지침.pdf                           │
│  - 정보보안 매뉴얼.pdf                              │
│  - ...                                              │
│  생성일: 2025-01-17                                  │
│                                                     │
│  [문서 추가 업로드]  [🤖 프롬프트 자동 생성]         │
└─────────────────────────────────────────────────────┘
```

**참고**: 프롬프트 생성 시 이 중 1개 파일을 선택하게 됩니다.

---

### 5.2 프롬프트 생성 모달 - Step 1 (문서 및 템플릿 선택)

```
┌───────────────────────────────────────────────────────────┐
│  🤖 자동 프롬프트 생성                        [X]          │
├───────────────────────────────────────────────────────────┤
│                                                           │
│  컬렉션: 3. 보안 정책                                     │
│                                                           │
│  ───────────────────────────────────────────────────────  │
│                                                           │
│  Step 1: 참조 문서 선택                                   │
│                                                           │
│  프롬프트 생성 시 참조할 문서를 선택하세요                │
│                                                           │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ ▼ 문서 선택 (컬렉션에 업로드된 문서)                 │ │
│  ├─────────────────────────────────────────────────────┤ │
│  │ • 보안 정책 규정.pdf (45 페이지, 12,500 자)      ✓  │ │
│  │ • 개인정보 보호 지침.pdf (23 페이지, 6,800 자)      │ │
│  │ • 정보보안 매뉴얼.pdf (67 페이지, 18,900 자)        │ │
│  │ • 보안사고 대응 절차.pdf (12 페이지, 3,200 자)      │ │
│  │ • 접근통제 정책.pdf (18 페이지, 5,400 자)           │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                           │
│  💡 선택한 문서의 내용을 분석하여 프롬프트를 생성합니다   │
│                                                           │
│  ───────────────────────────────────────────────────────  │
│                                                           │
│  Step 2: 템플릿 선택                                      │
│                                                           │
│  어떤 문서 유형과 가장 유사한가요?                        │
│                                                           │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ ⚖️ regulation.md - 규정/지침 문서용                  │ │
│  │ ✓ 법령, 규정, 지침 등 조항 구조를 가진 문서          │ │
│  │   예시: 인사규정, 복무규정, 보안규정                 │ │
│  │   특징: 제○조 제○항 인용, 단서 조항, 별표           │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                           │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ ○ budget.md - 예산/회계 문서용                       │ │
│  │   예산, 회계, 여비, 법인카드 등 금액 계산            │ │
│  │   예시: 예산규칙, 여비규정, 수수료지침               │ │
│  │   특징: 금액 계산, 별표, 증빙서류, 절차              │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                           │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ ○ default.md - 범용 문서용                           │ │
│  │   기타 모든 문서 유형                                │ │
│  │   예시: 보고서, 매뉴얼, 기술문서                     │ │
│  │   특징: 일반적인 Q&A 형식                            │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                           │
│  ───────────────────────────────────────────────────────  │
│                                                           │
│  Step 2: 파일명 설정                                      │
│                                                           │
│  프롬프트 파일명:                                         │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ security_policy                              │ .md   │ │
│  └─────────────────────────────────────────────────────┘ │
│  💡 영문, 숫자, 언더스코어(_)만 사용 가능                 │
│                                                           │
│  ───────────────────────────────────────────────────────  │
│                                                           │
│              [취소]          [다음: 생성하기 →]           │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

---

### 5.3 생성 진행 중 화면

```
┌───────────────────────────────────────────────────────────┐
│  ⏳ 프롬프트 생성 중...                        [X]         │
├───────────────────────────────────────────────────────────┤
│                                                           │
│  ████████████████████░░░░░░░░  75%                        │
│                                                           │
│  ✅ 1. 문서 샘플 추출 완료 (2초)                           │
│      - 첫 3페이지, 중간 3페이지, 끝 2페이지 추출          │
│      - 총 3,245 토큰                                      │
│                                                           │
│  ✅ 2. 템플릿 로드 완료 (0.5초)                            │
│      - regulation.md 로드                                 │
│                                                           │
│  ⏳ 3. LLM 프롬프트 생성 중... (15초 경과)                 │
│      - GPT-OSS 20B 모델 호출                              │
│                                                           │
│  ⏸️ 4. 추천 질문 생성 대기 중                              │
│                                                           │
│  ⏸️ 5. 검증 대기 중                                        │
│                                                           │
│  예상 남은 시간: 약 7초                                   │
│                                                           │
│                          [취소]                           │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

---

### 5.4 미리보기 및 편집 화면

```
┌───────────────────────────────────────────────────────────┐
│  ✅ 생성 완료 - 미리보기 및 수정                [X]         │
├───────────────────────────────────────────────────────────┤
│                                                           │
│  [📄 프롬프트]  [💡 추천 질문]  ← 탭                      │
│                                                           │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ # 보안 정책 전용 시스템 프롬프트                     │ │
│  │                                                      │ │
│  │ ## 메타정보                                          │ │
│  │ - 버전: 1.0                                          │ │
│  │ - 작성일: 2025-01-17                                 │ │
│  │ - 대상 문서 유형: 보안 정책 문서                     │ │
│  │ - 적용 컬렉션: 3. 보안 정책                          │ │
│  │                                                      │ │
│  │ ## 시스템 프롬프트                                   │ │
│  │                                                      │ │
│  │ # 역할 및 목적                                       │ │
│  │ 당신은 한국방송통신전파진흥원의 "보안 정책" 전문...  │ │
│  │                                                      │ │
│  │ {reasoning_instruction}                              │ │
│  │                                                      │ │
│  │ # 보안 정책 문서 구조 이해                           │ │
│  │ ...                                                  │ │
│  │                                                      │ │
│  │ [스크롤 가능, 편집 가능]                              │ │
│  │                                                      │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                           │
│  📊 문서 분석 결과:                                        │
│  - 문서 유형: 정책 (Policy)                               │
│  - 총 페이지: 45                                          │
│  - 섹션 수: 15                                            │
│  - 표 포함: 예                                            │
│                                                           │
│  [💾 저장]  [🔄 재생성]  [❌ 취소]                        │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

**[추천 질문 탭]**:

```
┌───────────────────────────────────────────────────────────┐
│  ✅ 생성 완료 - 미리보기 및 수정                [X]         │
├───────────────────────────────────────────────────────────┤
│                                                           │
│  [📄 프롬프트]  [✓ 💡 추천 질문]  ← 탭                    │
│                                                           │
│  추천 질문 (6개)                                          │
│  💡 사용자가 자주 묻는 질문을 미리 보여줍니다              │
│                                                           │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ 1. [정보보안 등급 분류는 어떻게 되나요?        ] [X]  │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                           │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ 2. [보안사고 발생 시 신고 절차는?             ] [X]  │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                           │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ 3. [개인정보 보호 의무는 무엇인가요?          ] [X]  │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                           │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ 4. [외부 반출 승인 절차는?                    ] [X]  │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                           │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ 5. [비밀번호 변경 주기는?                     ] [X]  │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                           │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ 6. [보안 교육은 연간 몇 회인가요?             ] [X]  │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                           │
│  [+ 질문 추가]                                            │
│                                                           │
│  ───────────────────────────────────────────────────────  │
│                                                           │
│  [💾 저장]  [🔄 재생성]  [❌ 취소]                        │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

---

### 5.5 저장 완료 화면

```
┌───────────────────────────────────────────────────────────┐
│  ✅ 저장 완료!                                 [X]         │
├───────────────────────────────────────────────────────────┤
│                                                           │
│  🎉 프롬프트가 성공적으로 저장되었습니다!                  │
│                                                           │
│  업데이트된 파일:                                         │
│  ✅ prompts/security_policy.md                            │
│  ✅ prompts/mapping.json                                  │
│  ✅ config/suggested_prompts.json                         │
│                                                           │
│  백업 위치:                                               │
│  📁 prompts/backups/2025-01-17_14-35-22/                  │
│                                                           │
│  이제 "3. 보안 정책" 컬렉션에서 채팅하면                  │
│  맞춤형 프롬프트가 자동으로 적용됩니다.                   │
│                                                           │
│              [💬 채팅하러 가기]    [닫기]                  │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

---

## 6. 메타 프롬프트 전략

### 6.1 메타 프롬프트 구조

**파일 위치**: `backend/prompts/meta/meta_prompt.md`

```markdown
# 메타 프롬프트: RAG 시스템 프롬프트 생성기

당신은 RAG(Retrieval-Augmented Generation) 시스템용 전문 시스템 프롬프트를 작성하는 프롬프트 엔지니어입니다.

## 역할
- 주어진 문서 샘플을 분석하여 문서 유형을 파악합니다
- 참조 템플릿의 구조를 따라 새로운 시스템 프롬프트를 작성합니다
- 해당 문서 유형에 최적화된 답변 형식과 프로세스를 설계합니다

## 입력 정보
1. **참조 템플릿**: 구조와 스타일을 따라야 할 기존 프롬프트
2. **문서 샘플**: 새 컬렉션에 업로드된 문서의 일부
   - 첫 부분: 목차, 서론 등
   - 중간 부분: 본문 내용
   - 마지막 부분: 부칙, 별표 등
3. **컬렉션 이름**: 새로운 컬렉션의 이름

## 작성 규칙

### 필수 요구사항
1. ✅ **구조 일관성**: 참조 템플릿과 동일한 구조 유지
   - 메타정보
   - 역할 및 목적
   - {reasoning_instruction} 플레이스홀더
   - 문서 구조 이해
   - 질문 답변 프로세스
   - 답변 형식
   - 제약 사항
   - 특수 상황 처리
   - 자가 점검 체크리스트
   - 권장 파라미터

2. ✅ **플레이스홀더**: `{reasoning_instruction}` 반드시 포함

3. ✅ **맞춤화**: 문서 샘플을 분석하여 내용 수정
   - 문서 유형 자동 감지 (규정/예산/기술문서/보고서 등)
   - 주요 특징 추출 (조항 구조, 표, 계산식, 데이터 등)
   - 도메인 용어 파악 및 반영

4. ✅ **구체성**: 실용적인 예시 포함
   - 답변 형식 예시
   - 계산 과정 예시 (해당 시)
   - 체크리스트

### 품질 기준
- 프롬프트 길이: 최소 3000자 이상
- 섹션 구성: 10개 이상의 주요 섹션
- 예시 포함: 각 섹션마다 구체적인 예시
- 체크리스트: 최소 10개 항목

## 출력 형식
마크다운 형식으로 작성하세요. 주석이나 메타 설명 없이 프롬프트 내용만 출력하세요.

시작은 반드시 다음 형식으로:
```
# {문서 유형} 전용 시스템 프롬프트

## 메타정보
- 버전: 1.0
- 작성일: {오늘 날짜}
- 대상 문서 유형: {문서 유형}
- 적용 컬렉션: {컬렉션 이름}
```

## 예시

[참조 템플릿이 여기 삽입됨]

[문서 샘플이 여기 삽입됨]

위 정보를 바탕으로 새로운 시스템 프롬프트를 작성하세요.
```

### 6.2 LLM 호출 시 실제 프롬프트 조합

```python
# 의사코드
def build_llm_prompt(template_name: str, document_sample: dict, collection_name: str) -> str:
    """
    메타 프롬프트 + 템플릿 + 문서 샘플 조합
    """
    # 1. 메타 프롬프트 로드
    meta_prompt = load_file("prompts/meta/meta_prompt.md")

    # 2. 참조 템플릿 로드
    template_content = load_file(f"prompts/{template_name}")

    # 3. 문서 샘플 포맷팅
    sample_text = f"""
[문서 샘플 - 첫 부분]
{document_sample['start']}

[문서 샘플 - 중간 부분]
{document_sample['middle']}

[문서 샘플 - 마지막 부분]
{document_sample['end']}
"""

    # 4. 최종 프롬프트 조합
    final_prompt = f"""
{meta_prompt}

---

[참조 템플릿]
{template_content}

---

[새 컬렉션 정보]
- 컬렉션 이름: {collection_name}

{sample_text}

---

위 정보를 바탕으로 새로운 시스템 프롬프트를 작성하세요.
"""

    return final_prompt
```

### 6.3 추천 질문 생성 프롬프트

```markdown
# 추천 질문 생성 프롬프트

당신은 사용자가 자주 묻는 질문을 예측하는 전문가입니다.

## 작업
주어진 문서 샘플을 분석하여 6개의 추천 질문을 생성하세요.

## 입력
- 컬렉션 이름: {collection_name}
- 문서 샘플: [문서 내용]

## 참조 질문 스타일
{기존 suggested_prompts.json의 질문 예시}

## 요구사항
1. **개수**: 정확히 6개
2. **다양성**: 다양한 난이도와 유형
   - 기본 정보 질문 (2개): "~는 무엇인가요?", "~는 어떻게 되나요?"
   - 절차/계산 질문 (2개): "~절차는?", "~일수는?", "~금액은?"
   - 조건부/복합 질문 (2개): "~한 경우?", "~와 ~의 차이?"
3. **구체성**: 추상적이지 않고 구체적인 질문
4. **실용성**: 문서에서 답변 가능한 질문
5. **자연스러움**: 실제 사용자가 물어볼 법한 표현

## 출력 형식
JSON 배열 형식으로만 출력하세요. 주석이나 설명 없이 순수한 JSON만 출력하세요.

```json
[
  "질문 1",
  "질문 2",
  "질문 3",
  "질문 4",
  "질문 5",
  "질문 6"
]
```

좋은 질문 예시:
- ✅ "5년 근무 시 연차휴가 일수는?"
- ✅ "서울에서 부산 1박 2일 출장비는?"
- ❌ "이 문서는 무엇에 대한 것인가요?" (너무 추상적)
- ❌ "자세히 설명해주세요" (구체성 부족)
```

---

## 7. 구현 로드맵

### Phase 1: 백엔드 기반 구축 (1주, 5일)

**Day 1-2: 서비스 레이어**
- [ ] `document_selector_service.py`
  - SQLite에서 document_id로 문서 조회
  - md_content 비율 기반 샘플링 (첫 20% + 중간 20% + 끝 20%)
  - 토큰 제한 (4000)
- [ ] `prompt_generator_service.py`
  - LLM API 호출 래퍼
  - 타임아웃 처리 (60초)
  - 재시도 로직 (최대 2회)
- [ ] 메타 프롬프트 작성 및 테스트
  - `prompts/meta/meta_prompt.md`
  - 수동 테스트 (regulation.md 재생성)

**Day 3: 검증 및 파일 관리**
- [ ] `prompt_validator.py`
  - 필수 요소 검증 ({reasoning_instruction}, 메타정보 등)
  - 최소 길이 체크
  - JSON 파싱 테스트
- [ ] `file_manager_service.py`
  - 백업 생성 로직
  - 트랜잭션 기반 파일 쓰기
  - 롤백 기능

**Day 4-5: 백그라운드 작업**
- [ ] 백그라운드 작업 큐 (간단한 딕셔너리 기반)
- [ ] 진행 상태 추적
- [ ] 에러 처리 및 로깅

---

### Phase 2: API 개발 (3일)

**Day 1**:
- [ ] `GET /api/prompts/documents/{collection_name}`
  - 컬렉션에 업로드된 문서 목록 조회
- [ ] `POST /api/prompts/generate`
  - Request 검증 (document_id, collection_name, template)
  - 백그라운드 작업 시작
  - task_id 반환
- [ ] `GET /api/prompts/generate/{task_id}`
  - 진행 상태 조회
  - 결과 반환 (완료 시)

**Day 2**:
- [ ] `POST /api/prompts/save`
  - 파일 저장 로직
  - 백업 생성
  - 검증 및 롤백
- [ ] `GET /api/prompts/templates`
  - 템플릿 목록 조회
  - 메타데이터 포함

**Day 3**:
- [ ] `POST /api/prompts/rollback`
- [ ] API 테스트 (Postman/curl)
- [ ] 에러 응답 표준화

---

### Phase 3: 프론트엔드 UI (1주, 5일)

**Day 1-2: 모달 기본 구조**
- [ ] `PromptGeneratorModal.tsx`
  - 3단계 UI (템플릿 선택, 생성, 미리보기)
  - 탭 전환 (프롬프트 ↔ 질문)
- [ ] `/qdrant` 페이지에 버튼 추가

**Day 3: 편집기**
- [ ] `PromptEditor.tsx`
  - 마크다운 편집기 (react-markdown + textarea)
  - 실시간 미리보기 (선택사항)
- [ ] `SuggestedQuestionsEditor.tsx`
  - 질문 추가/삭제/수정
  - 드래그 앤 드롭 순서 변경 (선택사항)

**Day 4: 진행 상태**
- [ ] 진행률 표시 (progress bar)
- [ ] 단계별 상태 아이콘
- [ ] 폴링 로직 (1초 간격)

**Day 5: 에러 처리 및 피드백**
- [ ] 에러 메시지 표시
- [ ] 재시도 버튼
- [ ] 토스트 알림
- [ ] 로딩 스피너

---

### Phase 4: 테스트 및 검증 (2일)

**Day 1: 기능 테스트**
- [ ] 다양한 문서 유형 테스트
  - 규정 문서 (인사, 보안, 윤리 등)
  - 예산 문서 (구매, 계약, 지출 등)
  - 기술 문서 (매뉴얼, 가이드 등)
- [ ] LLM 응답 품질 검증
  - {reasoning_instruction} 포함 여부
  - 구조 완전성
  - 예시 품질
- [ ] 파일 업데이트 무결성
  - JSON 파싱 성공
  - 기존 매핑 유지
  - 백업 정상 생성

**Day 2: 사용자 시나리오**
- [ ] 신규 컬렉션 생성 → 문서 업로드 → 프롬프트 생성 → 채팅
- [ ] 프롬프트 수정 → 재저장
- [ ] 롤백 테스트
- [ ] 동시 요청 테스트 (여러 컬렉션)

---

### Phase 5: 문서화 및 배포 (1일)

- [ ] 사용자 가이드 작성
  - 프롬프트 생성 방법
  - 템플릿 선택 가이드
  - 수정 팁
- [ ] API 문서 작성 (Swagger/OpenAPI)
- [ ] 메타 프롬프트 튜닝 가이드
- [ ] 트러블슈팅 FAQ

---

## 8. 위험 관리

### 8.1 위험 요소 및 완화 전략

| 위험 | 영향도 | 발생 확률 | 완화 전략 |
|------|--------|----------|----------|
| **LLM 생성 품질 불량** | 높음 | 중간 | • 검증 로직 강화<br>• 사용자 미리보기 필수<br>• 참조 템플릿 품질 관리<br>• 재생성 옵션 제공 |
| **LLM API 타임아웃** | 중간 | 중간 | • 60초 타임아웃 설정<br>• 재시도 로직 (2회)<br>• 백그라운드 처리<br>• 사용자에게 진행 상태 표시 |
| **파일 시스템 충돌** | 높음 | 낮음 | • 파일 잠금(lock) 메커니즘<br>• 트랜잭션 기반 업데이트<br>• 필수 백업<br>• 검증 후 커밋 |
| **JSON 파싱 오류** | 중간 | 낮음 | • LLM 응답 검증<br>• Try-catch 블록<br>• 백업에서 복원<br>• 사용자에게 명확한 오류 메시지 |
| **문서 샘플 부족** | 낮음 | 낮음 | • 최소 페이지 수 체크 (5페이지 이상)<br>• 안내 메시지<br>• 수동 작성 옵션 제공 |
| **비용 증가 (LLM 호출)** | 낮음 | 높음 | • 문서 샘플 크기 제한 (4000 토큰)<br>• 캐싱 전략<br>• 무료 LLM 사용 (자체 서버) |
| **보안 (프롬프트 인젝션)** | 중간 | 낮음 | • 입력 검증 (파일명, 컬렉션 이름)<br>• XSS 방지 (프론트엔드)<br>• 향후 권한 관리 |
| **사용자 실수 (삭제)** | 중간 | 중간 | • 백업 시스템<br>• 롤백 기능<br>• 확인 모달<br>• 되돌리기 버튼 |

### 8.2 에러 처리 전략

**LLM 호출 실패**:
```python
# 의사코드
async def generate_prompt_with_retry(prompt: str, max_retries: int = 2):
    for attempt in range(max_retries):
        try:
            response = await llm_service.call(prompt, timeout=60)
            return response
        except TimeoutError:
            if attempt < max_retries - 1:
                logging.warning(f"Retry {attempt + 1}/{max_retries}")
                await asyncio.sleep(5)
            else:
                raise Exception("LLM timeout after retries")
        except Exception as e:
            logging.error(f"LLM error: {e}")
            raise
```

**파일 쓰기 실패**:
```python
# 의사코드
def save_files_transaction(files_to_write: dict):
    backup_dir = create_backup()

    try:
        for filepath, content in files_to_write.items():
            write_file(filepath, content)

        # 검증
        for filepath in files_to_write.keys():
            if not validate_file(filepath):
                raise ValidationError(f"Invalid file: {filepath}")

        return True

    except Exception as e:
        logging.error(f"File write failed: {e}")
        rollback_from_backup(backup_dir)
        raise
```

### 8.3 모니터링 및 로깅

**로그 레벨**:
- `INFO`: 정상 작업 (생성 시작, 완료)
- `WARNING`: 재시도, 검증 경고
- `ERROR`: LLM 실패, 파일 쓰기 실패
- `CRITICAL`: 백업 실패, 롤백 실패

**로그 예시**:
```
[INFO] 2025-01-17 14:30:15 - Prompt generation started (task_id: prompt-gen-123, collection: 3. 보안 정책)
[INFO] 2025-01-17 14:30:17 - Document sample extracted (8 pages, 3245 tokens)
[INFO] 2025-01-17 14:30:18 - Template loaded: regulation.md
[INFO] 2025-01-17 14:30:42 - LLM response received (24s, 5678 chars)
[INFO] 2025-01-17 14:30:43 - Validation passed
[INFO] 2025-01-17 14:31:05 - Files saved successfully (backup: prompts/backups/2025-01-17_14-30-15/)
```

---

## 9. 참고 자료

### 9.1 관련 문서

- `docs/collection-based-system-prompt-design.md`: 기존 프롬프트 시스템 설계
- `CLAUDE.md`: 프로젝트 전체 구조
- `backend/prompts/regulation.md`: 규정 문서용 프롬프트 예시
- `backend/prompts/budget.md`: 예산 문서용 프롬프트 예시

### 9.2 기술 스택

**백엔드**:
- FastAPI 0.115.0
- SQLAlchemy 2.0.36
- httpx 0.27.2 (LLM API 호출)
- asyncio (백그라운드 작업)

**프론트엔드**:
- Next.js 16.0.1
- React 19.2.0
- Tailwind CSS 4
- shadcn/ui

**외부 서비스**:
- LLM: GPT-OSS 20B / EXAONE 32B (포트 8080-8082)
- Qdrant: Vector DB (포트 6333)

### 9.3 코드 예시 (최소화)

**백엔드 서비스 인터페이스**:
```python
# backend/services/prompt_generator_service.py (interface)
class PromptGeneratorService:
    async def generate_prompt(
        self,
        collection_name: str,
        template: str,
        document_sample: dict
    ) -> str:
        """프롬프트 생성"""
        pass

    async def generate_questions(
        self,
        collection_name: str,
        document_sample: dict
    ) -> list[str]:
        """추천 질문 생성"""
        pass
```

**API 라우터 구조**:
```python
# backend/api/routes/prompts.py
from fastapi import APIRouter, BackgroundTasks

router = APIRouter(prefix="/api/prompts", tags=["prompts"])

@router.post("/generate")
async def start_generation(
    request: PromptGenerateRequest,
    background_tasks: BackgroundTasks
):
    task_id = generate_task_id()
    background_tasks.add_task(
        generate_prompt_background,
        task_id,
        request
    )
    return {"task_id": task_id, "status": "processing"}

@router.get("/generate/{task_id}")
async def get_generation_status(task_id: str):
    return get_task_status(task_id)

@router.post("/save")
async def save_prompt(request: PromptSaveRequest):
    return file_manager.save_files(request)
```

**프론트엔드 컴포넌트 구조**:
```typescript
// app/qdrant/components/PromptGeneratorModal.tsx
export function PromptGeneratorModal({
  collectionName,
  onClose
}: Props) {
  const [step, setStep] = useState<'select' | 'generate' | 'preview'>('select');
  const [template, setTemplate] = useState('regulation.md');
  const [taskId, setTaskId] = useState<string | null>(null);

  // 생성 시작
  const handleGenerate = async () => {
    const response = await fetch('/api/prompts/generate', {
      method: 'POST',
      body: JSON.stringify({ collection_name: collectionName, template })
    });
    const data = await response.json();
    setTaskId(data.task_id);
    setStep('generate');
    startPolling(data.task_id);
  };

  // 상태 폴링
  const startPolling = (id: string) => {
    const interval = setInterval(async () => {
      const status = await fetch(`/api/prompts/generate/${id}`).then(r => r.json());
      if (status.status === 'completed') {
        clearInterval(interval);
        setStep('preview');
      }
    }, 1000);
  };

  // 저장
  const handleSave = async (content: string, questions: string[]) => {
    await fetch('/api/prompts/save', {
      method: 'POST',
      body: JSON.stringify({ collection_name: collectionName, prompt_content: content, suggested_questions: questions })
    });
    onClose();
  };

  return <Modal>...</Modal>;
}
```

---

## 10. 메뉴 구조 개편 및 페이지 통합

### 10.1 현재 문제점

**현재 메뉴 구조 (8개)**:
```
홈 | 문서파싱 | URL파싱 | 벡터업로드 | Excel임베딩 | 채팅 | 분석 | 시스템구조
```

**문제점**:
- 메뉴가 많아 사용자 혼란
- 벡터업로드와 Excel임베딩에 컬렉션 생성/삭제 기능이 중복 (~200줄 코드 중복)
- 컬렉션 관리 기능이 분산되어 있음
- 공개/비공개 설정 기능 추가 시 메뉴가 더 복잡해짐
- 문서파싱과 URL파싱이 유사한 기능인데 분리됨

**현재 페이지별 컬렉션 기능 중복**:
```
┌─────────────────────────────────────────────────────────────┐
│  /upload 페이지                                              │
│  • 컬렉션 선택 ✓                                             │
│  • 컬렉션 생성 (중복)                                        │
│  • 컬렉션 삭제 (중복)                                        │
├─────────────────────────────────────────────────────────────┤
│  /excel-embedding 페이지                                     │
│  • 컬렉션 선택 ✓                                             │
│  • 컬렉션 생성 (중복)                                        │
│  • 컬렉션 삭제 (중복)                                        │
└─────────────────────────────────────────────────────────────┘
```

### 10.2 개선 목표 (방안 B: 메뉴 통합)

**개선된 메뉴 구조 (6개)**:
```
홈 | 문서파싱 | 컬렉션관리 | 데이터업로드 | 채팅 | 분석
     (탭)                      (탭)
```

**통합 내용**:
| 현재 | 개선 후 |
|------|---------|
| 문서파싱 (/parse) | 문서파싱 (/parse) - 파일 업로드 탭 |
| URL파싱 (/url-parse) | 문서파싱 (/parse) - URL 파싱 탭 |
| 벡터업로드 (/upload) | 데이터업로드 (/upload) - 파싱문서 탭 |
| Excel임베딩 (/excel-embedding) | 데이터업로드 (/upload) - Excel 탭 |
| (없음) | 컬렉션관리 (/collections) - 신규 |
| 시스템구조 (/system-architecture) | Footer 또는 설정으로 이동 |

### 10.3 페이지별 역할 재정의

**책임 분리 원칙**:
```
┌─────────────────────────────────────────────────────────────┐
│  /parse (문서 파싱)                                          │
│  • 역할: 문서를 마크다운으로 변환                            │
│  • 탭: [파일 업로드] [URL 파싱]                              │
│  • 결과: 파싱된 문서가 DB에 저장됨                           │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  /collections (컬렉션 관리) ★ 신규                           │
│  • 역할: 컬렉션 생성/삭제/설정 관리                          │
│  • 기능:                                                     │
│    - 컬렉션 CRUD (생성, 조회, 수정, 삭제)                    │
│    - 공개/비공개/공유 설정                                   │
│    - 프롬프트 자동 생성                                      │
│    - 컬렉션별 문서 현황                                      │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  /upload (데이터 업로드)                                     │
│  • 역할: 데이터를 벡터화하여 컬렉션에 업로드                 │
│  • 탭: [파싱 문서] [Excel 파일]                              │
│  • 컬렉션 기능: 선택만 (생성/삭제 제거)                      │
│  • 안내: "컬렉션 관리에서 먼저 생성하세요" 링크              │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  /chat (채팅)                                                │
│  • 역할: 벡터 검색 기반 RAG 채팅                             │
│  • 컬렉션: 접근 가능한 컬렉션만 표시                         │
│    - 비로그인: public 컬렉션만                               │
│    - 로그인: public + 본인 소유 + 공유받은 컬렉션            │
└─────────────────────────────────────────────────────────────┘
```

### 10.4 사용자 워크플로우 변경

**첫 사용 시 (컬렉션 없음)**:
```
1. /parse → 문서 파싱
2. /collections → 컬렉션 생성 (공개 설정 필수)
3. /upload → 컬렉션 선택 → 데이터 업로드
4. /chat → 검색
```

**기존 사용자 (컬렉션 있음)**:
```
1. /upload → 기존 컬렉션 선택 → 업로드
2. 필요시 /collections → 설정 변경
```

**데이터 업로드 페이지에서 컬렉션이 없을 때**:
```
┌─────────────────────────────────────┐
│ 컬렉션                              │
│ ┌───────────────────────────────┐  │
│ │ 컬렉션이 없습니다          ▼  │  │
│ └───────────────────────────────┘  │
│                                     │
│ ⚠️ 업로드할 컬렉션이 없습니다       │
│    먼저 컬렉션을 생성해주세요       │
│    [컬렉션 관리로 이동 →]           │
└─────────────────────────────────────┘
```

### 10.5 코드 변경 영향

**제거되는 코드**:
| 파일 | 제거 내용 | 라인 수 |
|------|----------|---------|
| `/upload/page.tsx` | CreateCollectionDialog, DeleteConfirmDialog, 핸들러 | ~100줄 |
| `/excel-embedding/page.tsx` | 동일한 다이얼로그 및 핸들러 | ~100줄 |
| **총 제거** | | **~200줄** |

**추가되는 코드**:
| 파일 | 추가 내용 | 라인 수 |
|------|----------|---------|
| `/collections/page.tsx` | 컬렉션 관리 페이지 전체 | ~500줄 |
| `/upload/page.tsx` | Excel 탭 통합, 안내 링크 | ~50줄 |
| `/parse/page.tsx` | URL 파싱 탭 통합 | ~50줄 |
| **총 추가** | | **~600줄** |

**순 효과**: 중복 제거로 유지보수성 향상, 기능 통합으로 코드 응집도 증가

### 10.6 라우팅 변경

**리다이렉트 설정**:
```typescript
// 기존 URL 호환성 유지
/qdrant → /upload?tab=documents (기존 유지)
/url-parse → /parse?tab=url (신규)
/excel-embedding → /upload?tab=excel (신규)
```

**nav-header.tsx 변경**:
```typescript
// 현재
{ name: "문서 파싱", href: "/parse" },
{ name: "URL 파싱", href: "/url-parse" },
{ name: "벡터 업로드", href: "/upload" },
{ name: "Excel 임베딩", href: "/excel-embedding" },

// 변경 후
{ name: "문서 파싱", href: "/parse" },
{ name: "컬렉션 관리", href: "/collections" },
{ name: "데이터 업로드", href: "/upload" },
```

---

## 11. 컬렉션 관리 페이지

### 11.1 개요

컬렉션 관리 페이지(`/collections`)는 기존에 분산되어 있던 컬렉션 관련 기능을 통합하는 중앙 관리 페이지입니다.

**통합되는 기능**:
- 컬렉션 CRUD (생성, 조회, 수정, 삭제)
- 공개/비공개/공유 설정
- 프롬프트 자동 생성 (섹션 1-9의 기능)
- 컬렉션별 문서 현황

### 11.2 페이지 UI/UX 설계

**전체 레이아웃**:
```
┌─────────────────────────────────────────────────────────────────┐
│  컬렉션 관리                                    [+ 새 컬렉션]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─ 필터/검색 ─────────────────────────────────────────────────┐│
│  │ [검색: 컬렉션명...]  [공개 상태: 전체 ▼]  [정렬: 최신순 ▼] ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  ┌─ 컬렉션 카드 그리드 ────────────────────────────────────────┐│
│  │                                                             ││
│  │  ┌─────────────────────────────┐ ┌─────────────────────────┐││
│  │  │ 1. 인사 및 복무   [공개]    │ │ 2. 예산관리    [공개]   │││
│  │  │ 벡터: 1,234 | 문서: 12      │ │ 벡터: 856 | 문서: 8     │││
│  │  │ 소유자: admin               │ │ 소유자: admin           │││
│  │  │ 생성일: 2025-01-10          │ │ 생성일: 2025-01-12      │││
│  │  │                             │ │                         │││
│  │  │ [설정] [프롬프트] [삭제]    │ │ [설정] [프롬프트] [삭제]│││
│  │  └─────────────────────────────┘ └─────────────────────────┘││
│  │                                                             ││
│  │  ┌─────────────────────────────┐ ┌─────────────────────────┐││
│  │  │ 3. 보안 정책    [비공개]    │ │ 4. 기술문서    [공유]   │││
│  │  │ 벡터: 523 | 문서: 5         │ │ 벡터: 2,100 | 문서: 15  │││
│  │  │ 소유자: admin               │ │ 공유: user1 외 2명      │││
│  │  │ 생성일: 2025-01-17          │ │ 생성일: 2025-01-15      │││
│  │  │                             │ │                         │││
│  │  │ [설정] [프롬프트] [삭제]    │ │ [설정] [프롬프트] [삭제]│││
│  │  └─────────────────────────────┘ └─────────────────────────┘││
│  │                                                             ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  ┌─ 빠른 이동 ─────────────────────────────────────────────────┐│
│  │ [데이터 업로드하러 가기 →]                                  ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**컬렉션 카드 상세**:
```
┌─────────────────────────────────────────┐
│ 3. 보안 정책                  [비공개]  │
├─────────────────────────────────────────┤
│ 벡터: 523개                             │
│ 업로드된 문서: 5개                      │
│ 소유자: admin                           │
│ 생성일: 2025-01-17                      │
│ 설명: 정보보안, 개인정보보호 문서       │
├─────────────────────────────────────────┤
│ [설정]  [프롬프트 생성]  [삭제]         │
└─────────────────────────────────────────┘

공개 상태 배지:
- [공개]: 초록색 배경
- [비공개]: 회색 배경
- [공유]: 파란색 배경
```

**컬렉션 생성 모달**:
```
┌───────────────────────────────────────────────────────────┐
│  새 컬렉션 생성                                 [X]        │
├───────────────────────────────────────────────────────────┤
│                                                           │
│  컬렉션 이름 *                                            │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ 3. 보안 정책                                         │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                           │
│  설명 (선택)                                              │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ 정보보안, 개인정보보호 관련 내부 문서               │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                           │
│  ───────────────────────────────────────────────────────  │
│                                                           │
│  공개 설정 *                                              │
│                                                           │
│  ○ 비공개 (Private)                                       │
│    본인만 접근 가능                                       │
│                                                           │
│  ● 공개 (Public)                                          │
│    모든 사용자가 검색 가능 (비로그인 포함)               │
│                                                           │
│  ○ 공유 (Shared)                                          │
│    선택한 사용자만 접근 가능                             │
│    [사용자 선택 ▼]                                        │
│                                                           │
│  ───────────────────────────────────────────────────────  │
│                                                           │
│  고급 설정                                                │
│                                                           │
│  벡터 크기: [1024 ▼]                                      │
│  거리 메트릭: [Cosine ▼]                                  │
│                                                           │
│              [취소]          [생성]                       │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

**컬렉션 설정 모달**:
```
┌───────────────────────────────────────────────────────────┐
│  컬렉션 설정: 3. 보안 정책                      [X]        │
├───────────────────────────────────────────────────────────┤
│                                                           │
│  [일반]  [공개 설정]  [위험 영역]  ← 탭                    │
│                                                           │
│  ─────────────── 공개 설정 ───────────────                 │
│                                                           │
│  현재 상태: 비공개                                        │
│                                                           │
│  ○ 비공개 (Private)                             [현재]    │
│                                                           │
│  ○ 공개 (Public)                                          │
│    모든 사용자가 이 컬렉션을 검색할 수 있습니다          │
│                                                           │
│  ○ 공유 (Shared)                                          │
│    접근 허용 사용자:                                      │
│    ┌───────────────────────────────────────────────────┐ │
│    │ □ user1 (김철수)                                  │ │
│    │ □ user2 (박영희)                                  │ │
│    │ □ user3 (이민수)                                  │ │
│    └───────────────────────────────────────────────────┘ │
│                                                           │
│              [취소]          [저장]                       │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

### 11.3 데이터베이스 스키마

**새로운 SQLite 테이블**: `qdrant_collections`

```sql
CREATE TABLE qdrant_collections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    collection_name VARCHAR(255) UNIQUE NOT NULL,
    owner_id INTEGER NOT NULL,
    visibility VARCHAR(20) NOT NULL DEFAULT 'private',
    description TEXT,
    allowed_users JSON,  -- 공유받은 사용자 ID 목록
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
    CHECK (visibility IN ('public', 'private', 'shared'))
);

CREATE INDEX idx_qdrant_collections_owner ON qdrant_collections(owner_id);
CREATE INDEX idx_qdrant_collections_visibility ON qdrant_collections(visibility);
```

**visibility 값**:
| 값 | 설명 |
|---|------|
| `public` | 모든 사용자(비로그인 포함) 접근 가능 |
| `private` | 소유자만 접근 가능 |
| `shared` | 소유자 + allowed_users에 지정된 사용자 접근 가능 |

### 11.4 SQLAlchemy 모델

**파일**: `backend/models/qdrant_collection.py`

```python
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON, CheckConstraint
from sqlalchemy.orm import relationship
from datetime import datetime
from backend.database import Base

class QdrantCollection(Base):
    __tablename__ = "qdrant_collections"

    id = Column(Integer, primary_key=True, autoincrement=True)
    collection_name = Column(String(255), unique=True, nullable=False, index=True)
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    visibility = Column(
        String(20),
        nullable=False,
        default="private",
        index=True
    )
    description = Column(String(500), nullable=True)
    allowed_users = Column(JSON, default=list)  # [user_id1, user_id2, ...]
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    owner = relationship("User", back_populates="collections")

    __table_args__ = (
        CheckConstraint(
            "visibility IN ('public', 'private', 'shared')",
            name="check_visibility"
        ),
    )

    def can_access(self, user_id: int | None) -> bool:
        """사용자가 이 컬렉션에 접근 가능한지 확인"""
        if self.visibility == "public":
            return True
        if user_id is None:
            return False
        if self.owner_id == user_id:
            return True
        if self.visibility == "shared" and user_id in (self.allowed_users or []):
            return True
        return False

    def can_modify(self, user_id: int | None) -> bool:
        """사용자가 이 컬렉션을 수정할 수 있는지 확인"""
        if user_id is None:
            return False
        return self.owner_id == user_id
```

### 11.5 API 명세

#### 11.5.1 컬렉션 생성

**엔드포인트**: `POST /api/qdrant/collections`

**Request Body**:
```json
{
  "collection_name": "3. 보안 정책",
  "vector_size": 1024,
  "distance": "Cosine",
  "visibility": "private",
  "description": "보안 관련 내부 문서 컬렉션"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "collection_name": "3. 보안 정책",
  "visibility": "private",
  "owner_id": 1,
  "message": "컬렉션이 생성되었습니다"
}
```

#### 11.5.2 컬렉션 목록 조회

**엔드포인트**: `GET /api/qdrant/collections`

**동작**:
- 비로그인: `visibility="public"` 컬렉션만 반환
- 로그인: public + 본인 소유 + shared(본인 포함) 컬렉션 반환

**Response**:
```json
{
  "collections": [
    {
      "name": "1. 인사 및 복무",
      "visibility": "public",
      "is_owner": false,
      "vectors_count": 1234,
      "documents_count": 12,
      "description": "인사 및 복무 관련 규정",
      "created_at": "2025-01-10T10:00:00"
    },
    {
      "name": "3. 보안 정책",
      "visibility": "private",
      "is_owner": true,
      "vectors_count": 523,
      "documents_count": 5,
      "description": "보안 관련 내부 문서",
      "created_at": "2025-01-17T14:30:00"
    }
  ]
}
```

#### 11.5.3 컬렉션 삭제

**엔드포인트**: `DELETE /api/qdrant/collections/{collection_name}`

**접근 제어 추가**:
- 소유자만 삭제 가능
- 비소유자 요청 시 403 Forbidden

**에러 응답**:
```json
{
  "detail": "이 컬렉션을 삭제할 권한이 없습니다"
}
```

#### 11.5.4 컬렉션 설정 변경

**엔드포인트**: `PATCH /api/qdrant/collections/{collection_name}/settings`

**Request Body**:
```json
{
  "visibility": "shared",
  "description": "팀 공유용 컬렉션",
  "allowed_users": [2, 3, 5]
}
```

**Response**:
```json
{
  "success": true,
  "collection_name": "3. 보안 정책",
  "visibility": "shared",
  "allowed_users": [2, 3, 5],
  "message": "설정이 변경되었습니다"
}
```

#### 11.5.5 채팅 엔드포인트 접근 제어

**엔드포인트**: `POST /api/chat/` 및 `POST /api/chat/stream`

**접근 제어 추가**:
```python
# 요청한 컬렉션에 대한 접근 권한 확인
collection = collection_crud.get_by_name(db, chat_request.collection_name)
if not collection or not collection.can_access(user.id if user else None):
    raise HTTPException(
        status_code=403,
        detail="이 컬렉션에 접근할 권한이 없습니다"
    )
```

### 11.6 CRUD 서비스

**파일**: `backend/services/collection_crud.py`

```python
from sqlalchemy.orm import Session
from sqlalchemy import or_
from backend.models.qdrant_collection import QdrantCollection
from typing import List, Optional

class CollectionCRUD:
    def create(
        self,
        db: Session,
        collection_name: str,
        owner_id: int,
        visibility: str = "private",
        description: str = None
    ) -> QdrantCollection:
        """컬렉션 메타데이터 생성"""
        collection = QdrantCollection(
            collection_name=collection_name,
            owner_id=owner_id,
            visibility=visibility,
            description=description
        )
        db.add(collection)
        db.commit()
        db.refresh(collection)
        return collection

    def get_by_name(self, db: Session, collection_name: str) -> Optional[QdrantCollection]:
        """컬렉션명으로 조회"""
        return db.query(QdrantCollection).filter(
            QdrantCollection.collection_name == collection_name
        ).first()

    def get_accessible_collections(
        self,
        db: Session,
        user_id: Optional[int],
        qdrant_collection_names: List[str]
    ) -> List[QdrantCollection]:
        """
        사용자가 접근 가능한 컬렉션 목록 조회
        - user_id=None: public 컬렉션만
        - user_id=N: public + 소유 + shared(본인 포함)
        """
        query = db.query(QdrantCollection).filter(
            QdrantCollection.collection_name.in_(qdrant_collection_names)
        )

        if user_id is None:
            # 비로그인: public만
            query = query.filter(QdrantCollection.visibility == "public")
        else:
            # 로그인: public OR 소유자 OR shared에 포함
            query = query.filter(
                or_(
                    QdrantCollection.visibility == "public",
                    QdrantCollection.owner_id == user_id,
                    # SQLite JSON 함수로 allowed_users 확인
                    QdrantCollection.allowed_users.contains(str(user_id))
                )
            )

        return query.all()

    def update_visibility(
        self,
        db: Session,
        collection_name: str,
        visibility: str,
        allowed_users: List[int] = None
    ) -> Optional[QdrantCollection]:
        """컬렉션 공개 설정 변경"""
        collection = self.get_by_name(db, collection_name)
        if collection:
            collection.visibility = visibility
            if allowed_users is not None:
                collection.allowed_users = allowed_users
            db.commit()
            db.refresh(collection)
        return collection

    def delete(self, db: Session, collection_name: str) -> bool:
        """컬렉션 메타데이터 삭제"""
        collection = self.get_by_name(db, collection_name)
        if collection:
            db.delete(collection)
            db.commit()
            return True
        return False

    def check_ownership(
        self,
        db: Session,
        collection_name: str,
        user_id: int
    ) -> bool:
        """컬렉션 소유권 확인"""
        collection = self.get_by_name(db, collection_name)
        return collection and collection.owner_id == user_id

collection_crud = CollectionCRUD()
```

### 11.7 마이그레이션 전략

**기존 컬렉션 처리**:

```python
# backend/scripts/migrate_collections.py
async def migrate_existing_collections():
    """
    기존 Qdrant 컬렉션을 SQLite로 마이그레이션
    기본값: visibility="public" (하위 호환성)
    """
    db = SessionLocal()

    # 1. Qdrant에서 모든 컬렉션 조회
    qdrant_collections = await qdrant_service.get_collections()

    # 2. admin 사용자 조회 (기존 컬렉션의 소유자로 지정)
    admin_user = db.query(User).filter(User.role == "admin").first()
    if not admin_user:
        raise Exception("Admin user not found")

    # 3. 각 컬렉션을 SQLite에 등록
    for col in qdrant_collections:
        existing = collection_crud.get_by_name(db, col.name)
        if not existing:
            collection_crud.create(
                db=db,
                collection_name=col.name,
                owner_id=admin_user.id,
                visibility="public",  # 기존 컬렉션은 public으로 (하위 호환)
                description=f"마이그레이션된 컬렉션 ({col.vectors_count} vectors)"
            )
            print(f"Migrated: {col.name}")
        else:
            print(f"Already exists: {col.name}")

    db.close()
```

**시작 시 자동 마이그레이션**:

```python
# backend/main.py
@app.on_event("startup")
async def startup_event():
    # 기존 로직...
    Base.metadata.create_all(bind=engine)

    # 기존 컬렉션 마이그레이션 (1회성)
    await migrate_existing_collections()
```

### 11.8 통합 구현 로드맵

기존 섹션 7의 구현 로드맵과 메뉴 개편 및 컬렉션 관리 기능을 통합한 로드맵입니다.

> **구현 우선순위 원칙**: 컬렉션 관리 UI를 먼저 완성하여 사용자가 즉시 활용할 수 있도록 합니다. 프롬프트 자동 생성 기능은 컬렉션 관리가 안정화된 후 추가합니다.

**Phase 1: 컬렉션 관리 UI 우선 구현 (4일)**

| 일차 | 작업 |
|------|------|
| Day 1 | • **DB 모델 생성**: `QdrantCollection` SQLAlchemy 모델<br>• **CRUD 서비스**: `collection_crud.py` 구현<br>• **마이그레이션 스크립트**: 기존 Qdrant 컬렉션 → SQLite (visibility="public") |
| Day 2 | • `/collections` 페이지 기본 구조 생성<br>• 컬렉션 목록 카드 UI 구현<br>• 컬렉션 생성 API 수정 (visibility, description 추가) |
| Day 3 | • 컬렉션 생성 모달 (공개 설정 포함)<br>• 컬렉션 삭제 기능 (소유자 권한 확인)<br>• 컬렉션 설정 변경 모달 |
| Day 4 | • 필터/검색 기능 (공개 상태, 이름)<br>• "데이터 업로드하러 가기" 링크<br>• 프롬프트 생성 버튼 (placeholder - 추후 연동) |

**Phase 2: 기존 페이지 수정 및 메뉴 개편 (2일)**

| 일차 | 작업 |
|------|------|
| Day 5 | • `/upload` 페이지에서 컬렉션 생성/삭제 버튼 제거<br>• Excel 탭 통합 (기존 `/excel-embedding` 기능 병합)<br>• 컬렉션 없을 때 안내 메시지 + 링크 추가 |
| Day 6 | • `/parse` 페이지에 URL 파싱 탭 통합<br>• 리다이렉트 설정 (`/excel-embedding` → `/upload?tab=excel`)<br>• `nav-header.tsx` 메뉴 구조 변경 |

**Phase 3: 접근 제어 적용 (2일)**

| 일차 | 작업 |
|------|------|
| Day 7 | • `/api/qdrant/collections` 접근 제어 적용<br>• `/api/chat/collections` 비로그인 시 public만 반환<br>• `/api/chat/` 및 `/api/chat/stream` 컬렉션 접근 권한 확인 |
| Day 8 | • 채팅 페이지 컬렉션 드롭다운에 공개 상태 표시<br>• 비로그인 시 "로그인하여 더 많은 컬렉션 보기" 안내<br>• 데이터 업로드 페이지에서도 접근 가능한 컬렉션만 표시 |

**Phase 4: 컬렉션 관리 테스트 및 안정화 (1일)**

| 일차 | 작업 |
|------|------|
| Day 9 | • 전체 워크플로우 테스트: 문서 파싱 → 컬렉션 생성 → 데이터 업로드 → 채팅<br>• 접근 제어 테스트 (비로그인, 로그인, 소유자)<br>• 버그 수정 및 UX 개선 |

---

**[마일스톤] 컬렉션 관리 기능 완료 (Day 9)**

> 이 시점에서 컬렉션 관리 UI가 완성되며, 사용자는 컬렉션 생성/삭제/설정 변경 및 접근 제어 기능을 사용할 수 있습니다. 프롬프트 자동 생성 버튼은 placeholder 상태입니다.

---

**Phase 5: 프롬프트 자동 생성 백엔드 (4일)**

| 일차 | 작업 |
|------|------|
| Day 10-11 | • 섹션 7의 Phase 1 (백엔드 기반 구축)<br>• `document_selector_service.py`, `prompt_generator_service.py`<br>• 메타 프롬프트 작성 (`backend/prompts/meta/meta_prompt.md`) |
| Day 12-13 | • 섹션 7의 Phase 2 (API 개발)<br>• `/api/prompts/generate`, `/api/prompts/save` 등<br>• `prompt_validator.py`, `file_manager_service.py` |

**Phase 6: 프롬프트 자동 생성 프론트엔드 (2일)**

| 일차 | 작업 |
|------|------|
| Day 14 | • `PromptGeneratorModal.tsx` 구현<br>• 문서 선택, 템플릿 선택 UI<br>• 진행 상태 표시 (progress bar) |
| Day 15 | • 프롬프트/추천 질문 미리보기 및 편집<br>• 저장 기능 연동<br>• 컬렉션 관리 페이지에 프롬프트 생성 버튼 활성화 |

**Phase 7: 최종 테스트 및 문서화 (1일)**

| 일차 | 작업 |
|------|------|
| Day 16 | • 프롬프트 자동 생성 전체 테스트<br>• 다양한 문서 유형 테스트 (규정, 예산, 기술문서)<br>• 사용자 가이드 작성 및 문서화 |

**총 예상 기간: 16일 (약 3-4주)**

**로드맵 요약**:
| Phase | 기간 | 내용 | 마일스톤 |
|-------|------|------|----------|
| Phase 1-4 | Day 1-9 | 컬렉션 관리 UI 완성 | **컬렉션 관리 기능 릴리스 가능** |
| Phase 5-7 | Day 10-16 | 프롬프트 자동 생성 추가 | **전체 기능 완료** |

---

## 12. 다음 단계

### 12.1 즉시 실행 가능한 작업

1. **DB 모델 생성**
   - `backend/models/qdrant_collection.py` 작성
   - `backend/services/collection_crud.py` 작성

2. **메뉴 구조 확정**
   - 최종 메뉴 순서: 홈 | 문서파싱 | 컬렉션관리 | 데이터업로드 | 채팅 | 분석
   - 시스템구조 페이지 처리 방안 결정 (footer 이동 또는 유지)

3. **메타 프롬프트 작성**
   - `backend/prompts/meta/meta_prompt.md` 생성
   - regulation.md를 참조하여 구조 정의

### 12.2 승인 필요 사항

- [ ] 메뉴 구조 개편안 승인
- [ ] 컬렉션 관리 페이지 UI/UX 디자인 승인
- [ ] API 명세 최종 확인
- [ ] 구현 우선순위 조정
- [ ] 메타 프롬프트 초안 검토

### 12.3 추가 논의 사항

- LLM 모델 선택 (GPT-OSS vs EXAONE vs HyperCLOVA)
- 토큰 제한 조정 (4000 → 6000?)
- 추천 질문 개수 (6개 고정 vs 가변)
- 백업 보관 기간 (무제한 vs 30일)
- 컬렉션 공유 기능 범위 (shared visibility 필요 여부)
- 기존 컬렉션 기본 visibility (public vs private)
- 시스템 구조 페이지 위치 (메뉴 유지 vs footer 이동)

---

## 13. 버전 히스토리

| 버전 | 날짜 | 변경 사항 |
|------|------|----------|
| 1.0 | 2025-01-17 | 초안 작성 (Sequential Thinking MCP 기반) |
| 1.1 | 2025-12-05 | 섹션 10 추가: 컬렉션 공개/비공개 설정 기능 |
| 1.2 | 2025-12-05 | 메뉴 구조 개편 (방안 B 적용):<br>• 섹션 10: 메뉴 구조 개편 및 페이지 통합<br>• 섹션 11: 컬렉션 관리 페이지 (기존 섹션 10 통합)<br>• 구현 로드맵 통합 (14일) |
| 1.3 | 2025-12-05 | 구현 로드맵 순서 변경 (11.8):<br>• 컬렉션 관리 UI 우선 구현 (Day 1-9)<br>• 프롬프트 자동 생성은 후순위 (Day 10-16)<br>• Day 9 마일스톤 추가: 컬렉션 관리 기능 릴리스 가능<br>• 총 기간: 14일 → 16일 |

---

**문서 작성자**: Claude (Sequential Thinking MCP)
**검토자**: (TBD)
**승인자**: (TBD)
