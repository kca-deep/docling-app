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

## 10. 다음 단계

### 10.1 즉시 실행 가능한 작업

1. **메타 프롬프트 작성** (30분)
   - `backend/prompts/meta/meta_prompt.md` 생성
   - regulation.md를 참조하여 구조 정의

2. **수동 테스트** (1시간)
   - 메타 프롬프트를 LLM에 직접 입력
   - regulation.md 재생성 시도
   - 품질 평가

3. **백엔드 서비스 스켈레톤 작성** (2시간)
   - `document_sampler_service.py` (기본 구조만)
   - `prompt_generator_service.py` (기본 구조만)

### 10.2 승인 필요 사항

- [ ] 메타 프롬프트 초안 검토
- [ ] API 명세 최종 확인
- [ ] UI/UX 디자인 승인
- [ ] 구현 우선순위 조정

### 10.3 추가 논의 사항

- LLM 모델 선택 (GPT-OSS vs EXAONE vs HyperCLOVA)
- 토큰 제한 조정 (4000 → 6000?)
- 추천 질문 개수 (6개 고정 vs 가변)
- 백업 보관 기간 (무제한 vs 30일)

---

## 11. 버전 히스토리

| 버전 | 날짜 | 변경 사항 |
|------|------|----------|
| 1.0 | 2025-01-17 | 초안 작성 (Sequential Thinking MCP 기반) |

---

**문서 작성자**: Claude (Sequential Thinking MCP)
**검토자**: (TBD)
**승인자**: (TBD)
