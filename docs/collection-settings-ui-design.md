# Collection Settings UI 설계 문서

> 컬렉션별 추천 질문(Suggested Questions)과 시스템 프롬프트(System Prompt) 관리 UI 기능 설계

## 1. 개요

### 1.1 현재 상태

현재 컬렉션별 설정은 파일 기반으로 수동 관리됩니다:

| 항목 | 파일 위치 | 현재 방식 |
|-----|----------|----------|
| 추천 질문 | `backend/config/suggested_prompts.json` | JSON 직접 편집 |
| 프롬프트 매핑 | `backend/prompts/mapping.json` | JSON 직접 편집 |
| 프롬프트 내용 | `backend/prompts/*.md` | 파일 직접 작성 |

### 1.2 목표

1. **UI 기반 관리**: 웹 인터페이스에서 추천 질문과 시스템 프롬프트를 직접 편집
2. **LLM 자동 생성**: 내부 LLM을 활용하여 문서 기반으로 추천 질문과 프롬프트 자동 생성
3. **중앙화된 설정**: SQLite DB에 설정 통합 저장

---

## 2. 전체 기능 개요

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Collection Settings 관리                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐             │
│  │  수동 편집   │    │  LLM 생성   │    │   미리보기   │             │
│  └─────────────┘    └─────────────┘    └─────────────┘             │
│         │                  │                  │                     │
│         ▼                  ▼                  ▼                     │
│  ┌─────────────────────────────────────────────────────────┐       │
│  │                                                         │       │
│  │   1. 추천 질문 관리 (Suggested Questions)               │       │
│  │      - 수동 추가/수정/삭제/순서변경                      │       │
│  │      - LLM 자동 생성 (문서 기반)                        │       │
│  │                                                         │       │
│  │   2. 시스템 프롬프트 관리 (System Prompt)               │       │
│  │      - 마크다운 에디터                                  │       │
│  │      - LLM 자동 생성 (문서 분석 기반)                   │       │
│  │      - 템플릿 선택                                      │       │
│  │                                                         │       │
│  │   3. 권장 파라미터 설정                                 │       │
│  │      - top_k, temperature, reasoning_level              │       │
│  │                                                         │       │
│  └─────────────────────────────────────────────────────────┘       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. LLM 자동 생성 기능

### 3.1 추천 질문 자동 생성

**흐름:**
```
사용자가 "질문 생성" 버튼 클릭
    ↓
컬렉션의 문서 샘플 추출 (Qdrant에서 랜덤 청크 N개)
    ↓
LLM에 문서 컨텍스트 + 생성 프롬프트 전송
    ↓
생성된 질문 목록 반환
    ↓
사용자가 선택/수정 후 저장
```

**생성 프롬프트 예시:**
```
당신은 문서 분석 전문가입니다.
아래 문서 내용을 분석하여 사용자들이 자주 물어볼 만한 질문 10개를 생성해주세요.

[요구사항]
- 문서의 핵심 내용을 다루는 질문
- 실용적이고 구체적인 질문
- 다양한 주제를 커버하는 질문
- 한국어로 작성

[문서 내용]
{document_chunks}

[출력 형식]
JSON 배열로 출력: ["질문1", "질문2", ...]
```

### 3.2 시스템 프롬프트 자동 생성

**흐름:**
```
사용자가 "프롬프트 생성" 버튼 클릭
    ↓
컬렉션 문서 메타데이터 분석 (문서명, 섹션 구조)
    ↓
문서 샘플 청크 추출
    ↓
LLM에 분석 요청 + 프롬프트 생성 지시
    ↓
생성된 프롬프트 반환
    ↓
사용자가 수정 후 저장
```

**생성 프롬프트 예시:**
```
당신은 RAG 시스템 프롬프트 설계 전문가입니다.
아래 문서 정보를 분석하여 최적의 시스템 프롬프트를 작성해주세요.

[문서 정보]
- 컬렉션명: {collection_name}
- 문서 목록: {document_names}
- 문서 유형: {document_types}
- 샘플 내용: {sample_chunks}

[요구사항]
1. 문서의 특성에 맞는 전문가 페르소나 설정
2. 답변 형식 및 스타일 가이드
3. 인용 방식 지정
4. {reasoning_instruction} 플레이스홀더 포함

[출력]
마크다운 형식의 시스템 프롬프트
```

### 3.3 사용 가능한 LLM 모델

| 모델 | 포트 | VRAM | 특징 |
|-----|------|------|------|
| GPT-OSS 20B | 8080 | ~16GB | 범용, 기본 선택 |
| EXAONE 32B | 8081 | ~20GB | 131K 컨텍스트, 긴 문서 분석에 적합 |
| HyperCLOVA X 14B | 8082 | ~29GB | 한국어 최적화 |

---

## 4. Backend API 설계

### 4.1 Collection Settings CRUD

```python
# backend/api/routes/collection_settings.py

# 설정 조회/저장
GET    /api/collection-settings                    # 전체 목록
GET    /api/collection-settings/{collection}       # 특정 컬렉션
POST   /api/collection-settings                    # 신규 생성
PUT    /api/collection-settings/{collection}       # 수정
DELETE /api/collection-settings/{collection}       # 삭제

# LLM 자동 생성
POST   /api/collection-settings/generate/questions # 추천 질문 생성
POST   /api/collection-settings/generate/prompt    # 시스템 프롬프트 생성
```

### 4.2 Request/Response 스키마

```python
# 설정 저장 요청
class CollectionSettingsRequest(BaseModel):
    collection_name: str
    suggested_questions: List[str] = []
    system_prompt: str = ""
    recommended_params: RecommendedParams = None
    description: str = ""

class RecommendedParams(BaseModel):
    top_k: int = 5
    temperature: float = 0.7
    reasoning_level: str = "medium"  # low, medium, high

# LLM 생성 요청
class GenerateQuestionsRequest(BaseModel):
    collection_name: str
    num_questions: int = 10          # 생성할 질문 수
    sample_chunks: int = 20          # 참조할 청크 수
    llm_model: str = "gpt-oss-20b"   # 사용할 LLM
    temperature: float = 0.7

class GeneratePromptRequest(BaseModel):
    collection_name: str
    sample_chunks: int = 30
    llm_model: str = "gpt-oss-20b"
    include_template: str = None     # 기본 템플릿 선택
    temperature: float = 0.5

# 생성 응답
class GenerateQuestionsResponse(BaseModel):
    questions: List[str]
    source_documents: List[str]      # 참조한 문서명
    model_used: str

class GeneratePromptResponse(BaseModel):
    prompt: str
    document_analysis: DocumentAnalysis  # 문서 분석 결과
    model_used: str

class DocumentAnalysis(BaseModel):
    document_count: int
    total_chunks: int
    keywords: List[str]
    document_type: str
```

### 4.3 새로운 서비스 클래스

```python
# backend/services/collection_settings_service.py

class CollectionSettingsService:
    """컬렉션 설정 생성 및 관리 서비스"""

    async def generate_suggested_questions(
        self,
        collection_name: str,
        num_questions: int = 10,
        sample_chunks: int = 20,
        llm_model: str = "gpt-oss-20b"
    ) -> List[str]:
        """
        1. Qdrant에서 컬렉션의 랜덤 청크 추출
        2. LLM에 질문 생성 요청
        3. JSON 파싱하여 질문 목록 반환
        """

    async def generate_system_prompt(
        self,
        collection_name: str,
        sample_chunks: int = 30,
        llm_model: str = "gpt-oss-20b",
        template: str = None
    ) -> str:
        """
        1. 컬렉션 문서 메타데이터 수집
        2. 대표 청크 샘플링
        3. LLM에 프롬프트 생성 요청
        4. 마크다운 프롬프트 반환
        """

    async def analyze_collection(
        self,
        collection_name: str
    ) -> CollectionAnalysis:
        """
        컬렉션 문서 분석 결과 반환
        - 문서 수, 총 청크 수
        - 주요 키워드
        - 문서 유형 추정
        """
```

---

## 5. Database 스키마

### 5.1 SQLAlchemy 모델

```python
# backend/models/collection_settings.py

from sqlalchemy import Column, Integer, String, Text, JSON, DateTime
from sqlalchemy.sql import func
from backend.database import Base

class CollectionSettings(Base):
    __tablename__ = "collection_settings"

    id = Column(Integer, primary_key=True)
    collection_name = Column(String, unique=True, nullable=False, index=True)

    # 추천 질문 (JSON 배열)
    suggested_questions = Column(JSON, default=[])

    # 시스템 프롬프트
    system_prompt = Column(Text, default="")

    # 권장 파라미터
    recommended_params = Column(JSON, default={
        "top_k": 5,
        "temperature": 0.7,
        "reasoning_level": "medium"
    })

    # 메타데이터
    description = Column(String, default="")

    # 생성 이력 (LLM 생성 시 기록)
    generation_history = Column(JSON, default=[])
    # 예: [{"type": "questions", "model": "gpt-oss-20b", "timestamp": "...", "count": 10}]

    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())
```

### 5.2 generation_history 구조

```json
[
  {
    "type": "questions",
    "model": "gpt-oss-20b",
    "timestamp": "2025-12-03T10:30:00Z",
    "count": 10,
    "sample_chunks": 20
  },
  {
    "type": "prompt",
    "model": "exaone-32b",
    "timestamp": "2025-12-03T11:00:00Z",
    "template": "regulation",
    "sample_chunks": 30
  }
]
```

---

## 6. Frontend UI 설계

### 6.1 페이지 구조

```
/collection-settings
├── layout
│   ├── 좌측: CollectionSelector (컬렉션 목록)
│   └── 우측: SettingsEditor (탭 기반 편집기)
│
└── components/
    ├── CollectionSelector.tsx      # 컬렉션 선택 사이드바
    ├── SettingsEditor.tsx          # 메인 편집 영역
    ├── SuggestedQuestionsTab.tsx   # 추천 질문 관리 탭
    ├── SystemPromptTab.tsx         # 프롬프트 관리 탭
    ├── ParametersTab.tsx           # 파라미터 설정 탭
    ├── LLMGenerateDialog.tsx       # LLM 생성 모달
    └── PromptPreview.tsx           # 프롬프트 미리보기
```

### 6.2 메인 레이아웃

```
┌────────────────────────────────────────────────────────────────────────┐
│  Collection Settings                                    [저장] [초기화] │
├───────────────┬────────────────────────────────────────────────────────┤
│               │                                                        │
│  Collections  │  ┌──────────────────────────────────────────────────┐ │
│               │  │ [추천 질문]  [시스템 프롬프트]  [파라미터]        │ │
│  ● 인사및복무 │  ├──────────────────────────────────────────────────┤ │
│  ○ 예산관리   │  │                                                  │ │
│  ○ 기금관리   │  │  추천 질문 (4개)                    [+ 추가]     │ │
│  ○ 자격검정   │  │                                                  │ │
│               │  │  ┌────────────────────────────────────────┐      │ │
│               │  │  │ ≡ 연차휴가는 몇 일이고...        [✎][×]│      │ │
│               │  │  │ ≡ 경조사 휴가는 어떤...          [✎][×]│      │ │
│               │  │  │ ≡ 육아휴직 및 육아기...          [✎][×]│      │ │
│               │  │  │ ≡ 병가는 연간 몇 일...           [✎][×]│      │ │
│               │  │  └────────────────────────────────────────┘      │ │
│               │  │                                                  │ │
│ ──────────────│  │  ┌────────────────────────────────────────────┐  │ │
│               │  │  │  LLM으로 질문 자동 생성                    │  │ │
│  컬렉션 분석  │  │  │                                            │  │ │
│  ──────────── │  │  │  모델: [GPT-OSS 20B     ▼]                │  │ │
│  문서: 12개   │  │  │  생성 개수: [10]                           │  │ │
│  청크: 1,234개│  │  │  샘플 청크: [20]                           │  │ │
│               │  │  │                                            │  │ │
│               │  │  │           [질문 생성하기]                  │  │ │
│               │  │  └────────────────────────────────────────────┘  │ │
│               │  │                                                  │ │
│               │  └──────────────────────────────────────────────────┘ │
└───────────────┴────────────────────────────────────────────────────────┘
```

### 6.3 시스템 프롬프트 탭

```
┌──────────────────────────────────────────────────────────────────────┐
│ [추천 질문]  [시스템 프롬프트]  [파라미터]                           │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │ 템플릿 선택: [규정/법령 문서 ▼]  [적용]    [LLM 생성] [미리보기] ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │ # 인사규정 전문가 시스템 프롬프트                               ││
│  │                                                                 ││
│  │ 당신은 한국정보통신진흥협회의 인사규정 전문가입니다.            ││
│  │                                                                 ││
│  │ ## 역할                                                         ││
│  │ - 인사규정, 복무규정, 보수규정에 대한 정확한 답변 제공          ││
│  │ - 관련 조항을 정확히 인용하여 답변                              ││
│  │                                                                 ││
│  │ ## 답변 형식                                                    ││
│  │ {reasoning_instruction}                                         ││
│  │                                                                 ││
│  │ ## 인용 규칙                                                    ││
│  │ - 반드시 [파일명, 페이지] 형식으로 출처 명시                    ││
│  │ _                                                               ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                      │
│  플레이스홀더 안내:                                                  │
│  - {reasoning_instruction} - reasoning_level에 따라 자동 대체됨     │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### 6.4 LLM 생성 모달

```
┌─────────────────────────────────────────────────────────┐
│  시스템 프롬프트 자동 생성                         [×]  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  컬렉션: 1. 인사 및 복무                                │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ 문서 분석 결과                                   │   │
│  │ ─────────────────────────────────────────────── │   │
│  │ - 문서 수: 12개                                  │   │
│  │ - 총 청크: 1,234개                               │   │
│  │ - 주요 키워드: 휴가, 근무시간, 보수, 징계...     │   │
│  │ - 문서 유형: 규정/법령 문서                      │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  생성 옵션                                              │
│  ───────────                                            │
│  LLM 모델:     [EXAONE 32B (긴 문서)    ▼]             │
│  샘플 청크 수: [30                       ]             │
│  기본 템플릿:  [규정/법령 문서           ▼]             │
│  Temperature:  [0.5                      ]             │
│                                                         │
│  [ ] 기존 프롬프트에 병합 (체크 해제 시 대체)          │
│                                                         │
│              [취소]  [프롬프트 생성]                    │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 6.5 파라미터 설정 탭

```
┌──────────────────────────────────────────────────────────────────────┐
│ [추천 질문]  [시스템 프롬프트]  [파라미터]                           │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  권장 RAG 파라미터                                                   │
│  ─────────────────                                                   │
│                                                                      │
│  검색 설정                                                           │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │ Top-K (검색 문서 수)                                            ││
│  │ [━━━━━━━━━━●━━━━━━━━━━] 10                                      ││
│  │ 1                                              20               ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                      │
│  생성 설정                                                           │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │ Temperature (창의성)                                            ││
│  │ [━━━●━━━━━━━━━━━━━━━━━] 0.3                                     ││
│  │ 0                                               1               ││
│  │                                                                 ││
│  │ Reasoning Level (추론 수준)                                     ││
│  │ ( ) Low - 간결한 답변                                           ││
│  │ ( ) Medium - 균형 잡힌 답변                                     ││
│  │ (●) High - 상세한 분석과 추론                                   ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                      │
│  설명                                                                │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │ 인사규정, 복무규정, 보수규정 등 법령 문서를 위한 컬렉션입니다.  ││
│  │ 정확한 조항 인용이 필요하므로 낮은 Temperature를 권장합니다.    ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 7. 프롬프트 템플릿 라이브러리

### 7.1 템플릿 정의

```python
# backend/config/prompt_templates.py

PROMPT_TEMPLATES = {
    "regulation": {
        "name": "규정/법령 문서",
        "description": "법령, 규정, 규칙 등 공식 문서용",
        "template": """
당신은 {organization}의 {domain} 전문가입니다.

## 역할
- {domain} 관련 규정에 대한 정확한 답변 제공
- 관련 조항을 정확히 인용하여 답변

## 답변 형식
{reasoning_instruction}

## 인용 규칙
- 반드시 [파일명, 페이지] 형식으로 출처 명시
- 조항 번호가 있는 경우 함께 인용
"""
    },
    "technical": {
        "name": "기술 문서",
        "description": "매뉴얼, API 문서, 기술 가이드용",
        "template": """
당신은 기술 문서 전문가입니다.

## 역할
- 기술적 질문에 대한 정확하고 실용적인 답변 제공
- 코드 예시나 단계별 설명 포함

## 답변 형식
{reasoning_instruction}

## 특이사항
- 버전 정보가 중요한 경우 명시
- 실제 적용 가능한 예시 제공
"""
    },
    "faq": {
        "name": "FAQ/Q&A",
        "description": "자주 묻는 질문 형식 문서용",
        "template": """
당신은 고객 지원 전문가입니다.

## 역할
- 자주 묻는 질문에 대한 명확하고 친절한 답변 제공
- 관련 정보를 함께 안내

## 답변 형식
{reasoning_instruction}

## 스타일
- 친근하고 이해하기 쉬운 언어 사용
- 필요시 단계별 안내 제공
"""
    },
    "general": {
        "name": "일반 문서",
        "description": "범용 문서용 기본 템플릿",
        "template": """
당신은 문서 기반 질의응답 전문가입니다.

## 역할
- 제공된 문서를 기반으로 정확한 답변 제공
- 문서에 없는 내용은 추측하지 않음

## 답변 형식
{reasoning_instruction}

## 인용
- 답변의 근거가 되는 문서 출처 명시
"""
    }
}
```

### 7.2 템플릿 변수

| 변수 | 설명 | 자동 대체 여부 |
|-----|------|--------------|
| `{organization}` | 조직명 | LLM 생성 시 문서에서 추출 |
| `{domain}` | 도메인/분야 | LLM 생성 시 문서에서 추출 |
| `{reasoning_instruction}` | 추론 수준 지시 | 런타임에 자동 대체 |

---

## 8. 구현 파일 구조

### 8.1 Backend

```
backend/
├── api/routes/
│   ├── collection_settings.py      # [신규] 설정 API 라우터
│   └── chat.py                     # [수정] suggested-prompts 엔드포인트 리팩토링
├── models/
│   ├── collection_settings.py      # [신규] SQLAlchemy 모델
│   └── schemas.py                  # [수정] 요청/응답 스키마 추가
├── services/
│   ├── collection_settings_crud.py # [신규] DB CRUD 함수
│   ├── collection_settings_service.py # [신규] LLM 생성 서비스
│   └── prompt_loader.py            # [수정] DB 우선 조회로 변경
├── config/
│   ├── prompt_templates.py         # [신규] 템플릿 정의
│   └── settings.py                 # [수정] 신규 설정 추가
└── main.py                         # [수정] 라우터 등록, 모델 import
```

### 8.2 Frontend

```
app/
├── collection-settings/
│   ├── page.tsx                    # [신규] 메인 페이지
│   └── components/
│       ├── CollectionSelector.tsx  # [신규] 컬렉션 선택 사이드바
│       ├── SettingsEditor.tsx      # [신규] 메인 편집 영역
│       ├── SuggestedQuestionsTab.tsx # [신규] 추천 질문 탭
│       ├── SystemPromptTab.tsx     # [신규] 프롬프트 탭
│       ├── ParametersTab.tsx       # [신규] 파라미터 탭
│       ├── LLMGenerateDialog.tsx   # [신규] LLM 생성 모달
│       ├── QuestionItem.tsx        # [신규] 드래그 가능한 질문 아이템
│       └── PromptPreview.tsx       # [신규] 프롬프트 미리보기
└── components/
    └── nav-header.tsx              # [수정] 메뉴 추가
```

---

## 9. 데이터 마이그레이션

### 9.1 마이그레이션 스크립트

기존 파일 기반 설정을 DB로 이관:

```python
# backend/scripts/migrate_collection_settings.py

import json
import asyncio
from pathlib import Path
from backend.database import SessionLocal
from backend.models.collection_settings import CollectionSettings

async def migrate_existing_settings():
    """
    1. backend/config/suggested_prompts.json 읽기
    2. backend/prompts/mapping.json 읽기
    3. backend/prompts/*.md 파일들 읽기
    4. collection_settings 테이블에 통합 저장
    5. 기존 파일 백업 (선택)
    """

    db = SessionLocal()

    try:
        # 1. 추천 질문 로드
        suggested_prompts_path = Path("backend/config/suggested_prompts.json")
        suggested_prompts = {}
        if suggested_prompts_path.exists():
            with open(suggested_prompts_path, "r", encoding="utf-8") as f:
                suggested_prompts = json.load(f)

        # 2. 매핑 정보 로드
        mapping_path = Path("backend/prompts/mapping.json")
        mapping = {}
        if mapping_path.exists():
            with open(mapping_path, "r", encoding="utf-8") as f:
                mapping = json.load(f)

        # 3. 각 컬렉션별 설정 생성
        collection_prompts = mapping.get("collection_prompts", {})

        for collection_name, config in collection_prompts.items():
            # 프롬프트 파일 읽기
            prompt_file = config.get("prompt_file", "default.md")
            prompt_path = Path(f"backend/prompts/{prompt_file}")
            system_prompt = ""
            if prompt_path.exists():
                with open(prompt_path, "r", encoding="utf-8") as f:
                    system_prompt = f.read()

            # DB에 저장
            settings = CollectionSettings(
                collection_name=collection_name,
                suggested_questions=suggested_prompts.get(collection_name, []),
                system_prompt=system_prompt,
                recommended_params=config.get("recommended_params", {}),
                description=config.get("description", "")
            )

            db.merge(settings)  # upsert

        db.commit()
        print("Migration completed successfully!")

    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(migrate_existing_settings())
```

### 9.2 실행 방법

```bash
# 가상환경 활성화 후
cd backend
python -m scripts.migrate_collection_settings
```

---

## 10. 기술 스택

### 10.1 추가 의존성

**Backend (requirements.txt 추가 없음)**
- 기존 라이브러리로 구현 가능

**Frontend (package.json 추가 고려)**

| 라이브러리 | 용도 | 필수 여부 |
|-----------|------|----------|
| `@dnd-kit/core` | 드래그 앤 드롭 | 선택 (Phase 3) |
| `@uiw/react-md-editor` | 마크다운 에디터 | 선택 (textarea 대체 가능) |

### 10.2 기존 활용 라이브러리

- `react-hook-form` + `zod`: 폼 관리 및 검증
- shadcn/ui: Tabs, Card, Input, Button, Slider, Dialog
- `sonner`: 토스트 알림
- `lucide-react`: 아이콘

---

## 11. 구현 우선순위

| Phase | 항목 | 상세 | 예상 작업량 |
|-------|-----|------|-----------|
| **1** | DB 모델 + CRUD API | 기본 설정 저장/조회 | 중 |
| **1** | 기본 UI 페이지 | 컬렉션 선택, 탭 구조, 수동 편집 | 중 |
| **2** | LLM 질문 생성 | 추천 질문 자동 생성 API + UI | 중 |
| **2** | LLM 프롬프트 생성 | 시스템 프롬프트 자동 생성 API + UI | 중 |
| **3** | 템플릿 라이브러리 | 프롬프트 템플릿 선택 기능 | 소 |
| **3** | 드래그 앤 드롭 | 질문 순서 변경 | 소 |
| **4** | 마이그레이션 스크립트 | 기존 파일 → DB 이관 | 소 |
| **4** | PromptLoader 리팩토링 | 파일 대신 DB 우선 조회 | 소 |
| **5** | 생성 이력 관리 | LLM 생성 히스토리 조회/복원 | 소 |

---

## 12. 고려사항

### 12.1 기술적 고려사항

1. **캐싱 전략**
   - 현재: 파일 mtime 기반 캐싱
   - 변경 후: DB updated_at 기반 또는 Redis 캐싱 고려

2. **동시성 처리**
   - 여러 사용자가 동시에 같은 컬렉션 설정 수정 시
   - 낙관적 잠금(optimistic locking) 또는 마지막 저장 우선 정책

3. **LLM 생성 타임아웃**
   - 대용량 컬렉션의 경우 생성 시간 증가
   - 프론트엔드에서 적절한 로딩 표시 및 타임아웃 처리

### 12.2 UX 고려사항

1. **자동 저장 vs 수동 저장**
   - 현재 설계: 명시적 저장 버튼
   - 대안: 변경 감지 후 자동 저장 (debounce)

2. **LLM 생성 결과 검토**
   - 생성된 질문/프롬프트를 바로 적용하지 않고 검토 단계 제공
   - 개별 질문 선택/해제 기능

3. **실행 취소 기능**
   - 변경 전 상태로 복원 기능 필요 여부 검토

### 12.3 보안 고려사항

1. **권한 관리**
   - 현재: 인증 없음
   - 향후: 관리자 전용 페이지로 분리 가능

2. **입력 검증**
   - 시스템 프롬프트에 악의적인 내용 삽입 방지
   - 최대 길이 제한

---

## 13. API 예시

### 13.1 설정 조회

```bash
GET /api/collection-settings/1.%20인사%20및%20복무

Response:
{
  "id": 1,
  "collection_name": "1. 인사 및 복무",
  "suggested_questions": [
    "연차휴가는 몇 일이고 어떻게 사용하나요?",
    "경조사 휴가는 어떤 경우에 며칠씩 받을 수 있나요?"
  ],
  "system_prompt": "당신은 인사규정 전문가입니다...",
  "recommended_params": {
    "top_k": 10,
    "temperature": 0.3,
    "reasoning_level": "high"
  },
  "description": "인사규정, 복무규정 등 법령 문서",
  "generation_history": [...],
  "created_at": "2025-12-03T10:00:00Z",
  "updated_at": "2025-12-03T15:30:00Z"
}
```

### 13.2 LLM 질문 생성

```bash
POST /api/collection-settings/generate/questions

Request:
{
  "collection_name": "1. 인사 및 복무",
  "num_questions": 10,
  "sample_chunks": 20,
  "llm_model": "gpt-oss-20b",
  "temperature": 0.7
}

Response:
{
  "questions": [
    "연차휴가 일수는 근속연수에 따라 어떻게 달라지나요?",
    "병가 사용 시 필요한 증빙서류는 무엇인가요?",
    "육아휴직 신청 조건과 기간은 어떻게 되나요?",
    ...
  ],
  "source_documents": [
    "복무 규정(2025년도 06월 27일 개정).pdf",
    "인사규정.pdf"
  ],
  "model_used": "gpt-oss-20b"
}
```

### 13.3 LLM 프롬프트 생성

```bash
POST /api/collection-settings/generate/prompt

Request:
{
  "collection_name": "1. 인사 및 복무",
  "sample_chunks": 30,
  "llm_model": "exaone-32b",
  "include_template": "regulation",
  "temperature": 0.5
}

Response:
{
  "prompt": "# 인사규정 전문가 시스템 프롬프트\n\n당신은 한국정보통신진흥협회의...",
  "document_analysis": {
    "document_count": 12,
    "total_chunks": 1234,
    "keywords": ["휴가", "근무시간", "보수", "징계", "복무"],
    "document_type": "규정/법령 문서"
  },
  "model_used": "exaone-32b"
}
```

---

## 14. 관련 문서

- [System Architecture](./system.md)
- [Collection Based System Prompt Design](./collection-based-system-prompt-design.md)
- [BGE Reranker Integration Guide](./bge-reranker-integration-guide.md)
- [Integrated RAG Implementation](./integrated-rag-implementation.md)
