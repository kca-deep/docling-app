# 컬렉션별 시스템 프롬프트 적용 설계

## 개요
RAG 시스템에서 Qdrant 컬렉션별로 서로 다른 시스템 프롬프트를 적용하여, 문서 유형에 최적화된 답변을 제공하기 위한 설계 문서입니다.

**목적:**
- 규정 문서, 기술 문서, FAQ 등 문서 유형별 맞춤형 프롬프트 제공
- 코드 수정 없이 프롬프트 관리 가능한 구조
- 기존 시스템과의 하위 호환성 유지

**작성일:** 2025-01-14
**설계 도구:** Sequential Thinking MCP

---

## 현재 구조 분석

### 기존 시스템 프롬프트 관리 방식

**위치:** `backend/services/llm_service.py` - `build_rag_messages()` 메서드

**문제점:**
1. 시스템 프롬프트가 코드에 하드코딩되어 있음 (라인 178-185)
2. 모든 컬렉션에 동일한 범용 프롬프트 적용
3. reasoning_level만 구분 가능 (low/medium/high)
4. 문서 유형별 최적화 불가능

**현재 데이터 흐름:**
```
RAGService.chat(collection_name, query, ...)
  → LLMService.build_rag_messages(query, docs, reasoning_level)
    → 하드코딩된 시스템 프롬프트 사용
  → LLM API 호출
```

---

## 설계 방안

### 아키텍처 개선안

#### 1. 파일 기반 프롬프트 관리 (채택)

**장점:**
- 개발자/비개발자 모두 프롬프트 수정 가능 (마크다운 파일 편집)
- Git으로 버전 관리 용이
- 프롬프트와 코드 분리로 유지보수 쉬움
- 파일 수정 시 자동 반영 (캐싱 + 파일 수정 시간 체크)
- 초기 구현 간단

**단점:**
- 파일 읽기 오버헤드 (캐싱으로 완화)

**대안으로 고려했지만 채택하지 않은 방안:**
- **DB 기반**: 추가 테이블/마이그레이션 필요, 초기 세팅 복잡
- **환경변수**: 긴 프롬프트 관리 어려움, 가독성 떨어짐

---

## 디렉토리 구조

```
backend/
├── prompts/                          # 새로 생성
│   ├── __init__.py                   # 빈 파일
│   ├── mapping.json                  # 컬렉션-프롬프트 매핑 설정
│   ├── default.md                    # 기본 범용 프롬프트
│   ├── regulation.md                 # 규정 문서용 (복무규정 등)
│   ├── technical.md                  # 기술 문서용
│   └── faq.md                        # FAQ 문서용 (예시)
├── services/
│   ├── prompt_loader.py              # 새로 생성: 프롬프트 로딩 서비스
│   ├── llm_service.py                # 수정 필요
│   └── rag_service.py                # 수정 필요
└── config/
    └── settings.py                   # 수정 필요 (PROMPTS_DIR 추가)
```

---

## 주요 컴포넌트 설계

### 1. PromptLoader 서비스

**파일:** `backend/services/prompt_loader.py`

**역할:**
- 프롬프트 파일 읽기 및 캐싱
- 컬렉션 이름 기반 프롬프트 매핑
- Fallback 처리 (매핑 없으면 default.md 사용)
- 파일 변경 감지 및 자동 재로드

**주요 메서드:**
```python
class PromptLoader:
    def __init__(self, prompts_dir: str):
        """프롬프트 디렉토리 경로 설정"""

    def get_system_prompt(
        self,
        collection_name: Optional[str],
        reasoning_level: str = "medium"
    ) -> str:
        """
        컬렉션에 맞는 시스템 프롬프트 반환

        Fallback 순서:
        1. collection_name이 None → default.md
        2. mapping에 없음 → default.md
        3. 파일 읽기 실패 → default.md
        4. 성공 → 해당 프롬프트
        """

    def _load_mapping(self) -> dict:
        """mapping.json 파일 로드"""

    def _read_prompt_file(self, filename: str) -> str:
        """
        프롬프트 파일 읽기 (캐싱 적용)
        파일 수정 시간(mtime) 체크하여 변경 시에만 재로드
        """

    def reload_prompts(self):
        """모든 프롬프트 캐시 초기화 및 재로드"""
```

**캐싱 전략:**
```python
self.cache = {
    "regulation.md": (
        "프롬프트 내용...",  # content
        1705234567.123      # last_modified_time
    )
}
```

---

### 2. 매핑 파일 설계

**파일:** `backend/prompts/mapping.json`

**구조:**
```json
{
  "version": "1.0",
  "collection_prompts": {
    "regulation_docs": {
      "prompt_file": "regulation.md",
      "description": "규정, 지침 등 법령 문서 전용",
      "recommended_params": {
        "top_k": 10,
        "temperature": 0.3,
        "reasoning_level": "high"
      }
    },
    "tech_docs": {
      "prompt_file": "technical.md",
      "description": "기술 매뉴얼, API 문서 등",
      "recommended_params": {
        "top_k": 5,
        "temperature": 0.5,
        "reasoning_level": "medium"
      }
    },
    "general_kb": {
      "prompt_file": "default.md",
      "description": "일반 지식 베이스",
      "recommended_params": {
        "top_k": 5,
        "temperature": 0.7,
        "reasoning_level": "medium"
      }
    }
  },
  "default_prompt": "default.md",
  "fallback_behavior": "use_default"
}
```

**필드 설명:**
- `prompt_file`: 사용할 프롬프트 파일명 (.md)
- `description`: 해당 컬렉션의 용도 설명
- `recommended_params`: 권장 RAG 파라미터 (향후 프론트엔드에서 활용 가능)

---

### 3. 프롬프트 파일 포맷

**위치:** `backend/prompts/*.md`

**표준 구조:**
```markdown
# [프롬프트 이름]

## 메타정보
- 버전: 1.0
- 작성일: YYYY-MM-DD
- 대상 문서 유형: [설명]
- 적용 컬렉션: collection_name_1, collection_name_2

## 시스템 프롬프트

당신은 [역할]입니다.

{reasoning_instruction}

[상세 지침...]

## 권장 파라미터
- top_k: 10
- temperature: 0.3
- reasoning_level: high
```

**플레이스홀더 지원:**
- `{reasoning_instruction}`: reasoning_level에 따라 자동 대체
  - low: "답변은 간단하고 명확하게 작성하세요."
  - medium: "답변은 적절한 수준의 설명과 함께 작성하세요."
  - high: "답변은 깊이 있는 분석과 추론을 포함하여 상세하게 작성하세요."

---

### 4. LLMService 수정사항

**파일:** `backend/services/llm_service.py`

**변경 사항:**

**1) `__init__` 메서드 수정**
```python
# 변경 전
def __init__(self, base_url: str, model: str = "gpt-oss-20b"):
    self.base_url = base_url
    self.model = model
    self.client = httpx.AsyncClient(...)

# 변경 후
def __init__(
    self,
    base_url: str,
    model: str = "gpt-oss-20b",
    prompt_loader: Optional[PromptLoader] = None
):
    self.base_url = base_url
    self.model = model
    self.client = httpx.AsyncClient(...)
    self.prompt_loader = prompt_loader or PromptLoader()  # 기본값으로 fallback
```

**2) `build_rag_messages` 메서드 수정**
```python
# 변경 전
def build_rag_messages(
    self,
    query: str,
    retrieved_docs: List[Dict[str, Any]],
    reasoning_level: str = "medium",
    chat_history: Optional[List[Dict[str, str]]] = None
) -> List[Dict[str, str]]:
    # 하드코딩된 시스템 프롬프트 사용
    system_content = """당신은 문서 기반 질의응답을 수행하는 AI 어시스턴트입니다.
    ..."""

# 변경 후
def build_rag_messages(
    self,
    query: str,
    retrieved_docs: List[Dict[str, Any]],
    reasoning_level: str = "medium",
    chat_history: Optional[List[Dict[str, str]]] = None,
    collection_name: Optional[str] = None  # 추가
) -> List[Dict[str, str]]:
    # PromptLoader에서 동적으로 프롬프트 가져오기
    system_content = self.prompt_loader.get_system_prompt(
        collection_name=collection_name,
        reasoning_level=reasoning_level
    )
```

**하위 호환성 유지:**
- `collection_name`이 `None`이면 default.md 사용
- 기존 코드에서 `collection_name` 없이 호출해도 정상 동작

---

### 5. RAGService 수정사항

**파일:** `backend/services/rag_service.py`

**변경 사항:**

**`chat()` 메서드:**
```python
# 변경 전 (라인 314-324)
llm_response = await self.generate(
    query=query,
    retrieved_docs=retrieved_docs,
    reasoning_level=reasoning_level,
    temperature=temperature,
    max_tokens=max_tokens,
    top_p=top_p,
    frequency_penalty=frequency_penalty,
    presence_penalty=presence_penalty,
    chat_history=chat_history
)

# 변경 후
llm_response = await self.generate(
    query=query,
    retrieved_docs=retrieved_docs,
    reasoning_level=reasoning_level,
    temperature=temperature,
    max_tokens=max_tokens,
    top_p=top_p,
    frequency_penalty=frequency_penalty,
    presence_penalty=presence_penalty,
    chat_history=chat_history,
    collection_name=collection_name  # 추가
)
```

**`generate()` 메서드:**
```python
# 파라미터 추가
async def generate(
    self,
    query: str,
    retrieved_docs: List[Dict[str, Any]],
    reasoning_level: str = "medium",
    temperature: float = 0.7,
    max_tokens: int = 2000,
    top_p: float = 0.9,
    frequency_penalty: float = 0.0,
    presence_penalty: float = 0.0,
    chat_history: Optional[List[Dict[str, str]]] = None,
    collection_name: Optional[str] = None  # 추가
) -> Dict[str, Any]:
    # build_rag_messages 호출 시 collection_name 전달
    messages = self.llm_service.build_rag_messages(
        query=query,
        retrieved_docs=retrieved_docs,
        reasoning_level=reasoning_level,
        chat_history=chat_history,
        collection_name=collection_name  # 추가
    )
```

**`chat_stream()` 메서드도 동일하게 수정**

---

## 데이터 흐름

### 개선 후 전체 흐름

```
1. 사용자 질문 입력
   ↓
2. RAGService.chat(collection_name="regulation_docs", query="연차휴가는?", ...)
   ↓
3. Retrieve 단계: Qdrant 검색
   - await self.retrieve(collection_name, query, top_k, ...)
   - 검색 결과: retrieved_docs
   ↓
4. 프롬프트 로딩
   - collection_name="regulation_docs"
   - PromptLoader.get_system_prompt("regulation_docs", "medium")
     → mapping.json 조회
     → "regulation.md" 매핑 확인
     → regulation.md 파일 읽기 (캐시에서 또는 파일에서)
     → {reasoning_instruction} 플레이스홀더 대체
     → 최종 시스템 프롬프트 반환
   ↓
5. Generate 단계: 메시지 구성
   - LLMService.build_rag_messages(query, docs, reasoning_level, collection_name)
     → 시스템 프롬프트 (regulation.md 내용)
     → 검색된 문서 컨텍스트
     → 사용자 질문
     → 메시지 배열 반환
   ↓
6. LLM API 호출
   - LLMService.chat_completion(messages, temperature, ...)
   ↓
7. 응답 반환
   - answer: "연차휴가는 1년간 8할 이상 근무 시 15일..."
   - retrieved_docs: [...]
   - usage: {...}
```

---

## 구현 우선순위

### P0: 필수 (최우선 구현)

1. **디렉토리 및 파일 생성**
   - `backend/prompts/` 디렉토리 생성
   - `backend/prompts/__init__.py` (빈 파일)
   - `backend/prompts/mapping.json`
   - `backend/prompts/default.md` (기존 하드코딩 프롬프트 복사)
   - `backend/prompts/regulation.md` (`docs/system-prompt-regulation-chatbot.md` 활용)

2. **PromptLoader 서비스 구현**
   - `backend/services/prompt_loader.py` 생성
   - 캐싱 메커니즘 구현
   - Fallback 로직 구현

3. **LLMService 수정**
   - `__init__`에 `prompt_loader` 파라미터 추가
   - `build_rag_messages`에 `collection_name` 파라미터 추가
   - 하드코딩 프롬프트 → PromptLoader 호출로 변경

4. **RAGService 수정**
   - `generate()`, `generate_stream()` 메서드에 `collection_name` 파라미터 추가
   - `chat()`, `chat_stream()`에서 `collection_name` 전달

5. **테스트**
   - 기존 기능 동작 확인 (collection_name 없이 호출)
   - regulation_docs 컬렉션으로 테스트
   - 프롬프트 파일 수정 후 자동 반영 확인

---

### P1: 권장 (안정화 후)

6. **환경변수 추가**
   - `backend/config/settings.py`에 `PROMPTS_DIR` 추가
   - 기본값: `"backend/prompts"`

7. **프롬프트 검증 로직**
   - 프롬프트 파일에 필수 플레이스홀더 존재 여부 확인
   - 파일이 존재하지 않는 경우 경고 로그

8. **로깅 개선**
   - 어떤 프롬프트 파일이 사용되었는지 로그 기록
   ```python
   print(f"[INFO] Using prompt file: {prompt_file} for collection: {collection_name}")
   ```

9. **추가 프롬프트 파일 작성**
   - `technical.md` - 기술 문서용
   - `faq.md` - FAQ 문서용
   - 각 컬렉션에 맞는 프롬프트 최적화

---

### P2: 향후 확장 (필요 시)

10. **프롬프트 관리 API 구축**
    - `GET /api/admin/prompts` - 모든 프롬프트 목록
    - `GET /api/admin/prompts/{prompt_file}` - 특정 프롬프트 내용 조회
    - `PUT /api/admin/prompts/{prompt_file}` - 프롬프트 업데이트
    - `POST /api/admin/prompts/reload` - 캐시 초기화

11. **프론트엔드 연동**
    - 컬렉션 선택 시 권장 파라미터 자동 설정
    - `GET /api/rag/collections/{collection_name}/config`로 권장값 제공

12. **디버그 모드**
    - 응답에 사용된 프롬프트 파일명 포함
    ```json
    {
      "answer": "...",
      "debug_info": {
        "prompt_file": "regulation.md",
        "collection_name": "regulation_docs"
      }
    }
    ```

13. **A/B 테스팅 지원**
    - 같은 컬렉션에 여러 프롬프트 버전 적용
    - 성능 비교 및 최적화

---

## 마이그레이션 전략

### Phase 1: 기반 구조 구축 (기존 기능 유지)

**목표:** 새로운 구조 도입하되 기존 시스템은 그대로 동작

- PromptLoader 생성
- backend/prompts/ 디렉토리 생성
- default.md만 먼저 생성 (기존 하드코딩 프롬프트 복사)
- mapping.json은 빈 상태 (`{}`)로 시작

**검증:**
- 기존 RAG 쿼리가 정상 동작하는지 확인
- default.md가 올바르게 로드되는지 확인

---

### Phase 2: LLMService 수정 (하위 호환성 유지)

**목표:** collection_name 파라미터 추가하되 기존 호출 방식도 지원

- `build_rag_messages()`에 `collection_name` 파라미터 추가 (Optional)
- `collection_name=None`이면 기존 방식(default.md) 사용
- `collection_name`이 있으면 PromptLoader 사용

**검증:**
- collection_name 없이 호출: default.md 사용 확인
- collection_name="regulation_docs": regulation.md 사용 확인

---

### Phase 3: RAGService 수정

**목표:** collection_name을 LLMService에 전달

- `generate()`, `chat()` 등에서 collection_name 파라미터 전달
- 이미 collection_name을 받고 있으므로 추가 변경 최소

**검증:**
- 전체 RAG 파이프라인에서 올바른 프롬프트 사용 확인

---

### Phase 4: 프롬프트 순차 추가

**목표:** 컬렉션별로 최적화된 프롬프트 점진적 적용

- regulation.md 생성 (docs의 규정용 프롬프트 활용)
- mapping.json에 "regulation_docs" 매핑 추가
- 테스트 및 성능 확인
- 다른 컬렉션용 프롬프트 순차적으로 추가

**검증:**
- 각 컬렉션별 답변 품질 개선 확인
- A/B 테스트 (기존 프롬프트 vs 새 프롬프트)

---

## 예시: regulation.md 프롬프트

**파일:** `backend/prompts/regulation.md`

**내용:** `docs/system-prompt-regulation-chatbot.md`에 저장된 프롬프트를 그대로 사용

**추가 작업:**
- `{reasoning_instruction}` 플레이스홀더 삽입
- 메타정보 섹션 추가

**위치:**
```markdown
# 역할 및 목적
당신은 한국방송통신전파진흥원의 "복무 규정" 전문 상담 AI입니다. 직원들의 복무 관련 질문에 정확하고 신뢰할 수 있는 답변을 제공하는 것이 목적입니다.

{reasoning_instruction}

# 규정 문서 구조 이해
...
```

PromptLoader가 `{reasoning_instruction}`을 reasoning_level에 맞게 자동 대체.

---

## 향후 개선 방향

### 1. 프롬프트 템플릿 엔진

현재는 간단한 문자열 치환(`{reasoning_instruction}`)만 지원하지만, 향후 Jinja2 등 템플릿 엔진 도입 가능:

```markdown
당신은 {{ role }}입니다.

{% if reasoning_level == 'high' %}
답변은 깊이 있는 분석과 추론을 포함하여 상세하게 작성하세요.
{% else %}
답변은 간단하고 명확하게 작성하세요.
{% endif %}
```

### 2. 프롬프트 버전 관리

mapping.json에 버전 정보 추가:
```json
{
  "regulation_docs": {
    "prompt_file": "regulation_v2.md",
    "version": "2.0",
    "changelog": "단서 조항 확인 프로세스 강화"
  }
}
```

### 3. 프롬프트 성능 모니터링

프롬프트별 성능 지표 수집:
- 답변 품질 점수 (사용자 평가)
- 평균 응답 시간
- 토큰 사용량

→ 데이터 기반 프롬프트 최적화

### 4. 다국어 지원

컬렉션 + 언어 조합:
```json
{
  "regulation_docs": {
    "ko": "regulation_ko.md",
    "en": "regulation_en.md"
  }
}
```

---

## 보안 고려사항

### 1. 프롬프트 파일 접근 권한

- 프롬프트 파일은 읽기 전용으로 설정
- 서버 프로세스만 읽을 수 있도록 권한 제한

### 2. 프롬프트 인젝션 방지

- 사용자 입력이 시스템 프롬프트에 직접 삽입되지 않도록 검증
- 플레이스홀더는 화이트리스트 방식으로만 대체

### 3. 민감 정보 포함 금지

- 프롬프트 파일에 API 키, 비밀번호 등 포함 금지
- Git에 커밋되므로 민감 정보는 환경변수로 관리

---

## 테스트 시나리오

### 1. 기본 동작 테스트

**시나리오:** collection_name 없이 호출
```python
response = await rag_service.chat(
    collection_name=None,
    query="테스트 질문"
)
```
**예상 결과:** default.md 프롬프트 사용

---

### 2. 컬렉션별 프롬프트 테스트

**시나리오:** regulation_docs 컬렉션으로 호출
```python
response = await rag_service.chat(
    collection_name="regulation_docs",
    query="연차휴가는 며칠인가요?"
)
```
**예상 결과:** regulation.md 프롬프트 사용, 조항 인용 포함

---

### 3. Fallback 테스트

**시나리오:** 존재하지 않는 컬렉션 이름
```python
response = await rag_service.chat(
    collection_name="nonexistent_collection",
    query="질문"
)
```
**예상 결과:** default.md 프롬프트 사용, 에러 없이 정상 동작

---

### 4. 캐싱 테스트

**시나리오:** 프롬프트 파일 수정 후 재로드
1. regulation.md 파일 수정
2. 30초 대기 (파일 시스템 반영)
3. 동일 쿼리 재실행

**예상 결과:** 수정된 프롬프트 적용

---

### 5. 성능 테스트

**시나리오:** 1000번 연속 호출
```python
for i in range(1000):
    response = await rag_service.chat(
        collection_name="regulation_docs",
        query=f"질문 {i}"
    )
```
**예상 결과:**
- 첫 호출: 파일 읽기 발생
- 이후 호출: 캐시에서 반환, 지연 시간 최소화

---

## FAQ

### Q1. 프롬프트를 수정하려면 서버 재시작이 필요한가요?

**A:** 아니요. PromptLoader는 파일 수정 시간(mtime)을 체크하여 변경 시 자동으로 재로드합니다. 단, 캐싱으로 인해 즉시 반영되지 않을 수 있으므로, 즉시 반영이 필요하면 `reload_prompts()` 메서드 호출 또는 서버 재시작.

---

### Q2. 하나의 컬렉션에 여러 프롬프트를 적용할 수 있나요?

**A:** 현재 설계에서는 1:1 매핑만 지원합니다. A/B 테스팅이 필요하면 별도 컬렉션을 만들거나, 향후 확장 기능으로 구현 가능.

---

### Q3. 프롬프트 파일 크기 제한이 있나요?

**A:** 파일 시스템 제한 외 별도 제한은 없습니다. 다만 너무 긴 프롬프트는 LLM 컨텍스트 길이 제한에 걸릴 수 있으므로 적정 길이 유지 권장 (2000-4000 토큰).

---

### Q4. 데이터베이스 기반 프롬프트 관리로 전환할 수 있나요?

**A:** 가능합니다. PromptLoader 인터페이스를 유지하고 구현체만 DB 기반으로 교체하면 됩니다. 추상 클래스 패턴 적용 권장.

---

### Q5. 프롬프트 파일을 Git에 커밋해야 하나요?

**A:** 네. 프롬프트는 코드의 일부로 버전 관리하는 것이 좋습니다. 다만 민감 정보는 포함하지 마세요.

---

## 참고 문서

- `docs/system-prompt-regulation-chatbot.md` - 규정 문서용 프롬프트 전문
- `docs/qdrant-integration-design.md` - Qdrant 통합 설계
- `backend/services/rag_service.py` - RAG 서비스 현재 구현
- `backend/services/llm_service.py` - LLM 서비스 현재 구현

---

## 버전 정보

- **버전:** 1.0
- **작성일:** 2025-01-14
- **설계 도구:** Claude Code with Sequential Thinking MCP
- **검토자:** -
- **승인일:** -
