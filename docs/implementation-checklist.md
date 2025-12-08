# 컬렉션 관리 및 프롬프트 자동 생성 구현 체크리스트

**상세 설계 문서**: [auto-prompt-generation-plan.md](./auto-prompt-generation-plan.md)

---

## Phase 1: 컬렉션 관리 UI 우선 구현 (Day 1-4)

### Day 1: DB 모델 및 CRUD

**백엔드 파일 생성**:
- [x] `backend/models/qdrant_collection.py` - SQLAlchemy 모델
  ```python
  # 필드: id, collection_name, owner_id, visibility, description, allowed_users, created_at, updated_at
  # 메서드: can_access(user_id), can_modify(user_id)
  ```
- [x] `backend/services/collection_crud.py` - CRUD 서비스
  ```python
  # 메서드: create, get_by_name, get_accessible_collections, update_visibility, delete, check_ownership
  ```
- [x] `backend/scripts/migrate_collections.py` - 마이그레이션 스크립트
  - 기존 Qdrant 컬렉션 → SQLite (visibility="public")

**백엔드 파일 수정**:
- [x] `backend/main.py` - 모델 import 및 startup에 마이그레이션 추가
- [ ] `backend/models/__init__.py` - QdrantCollection export (직접 import 방식 사용)

### Day 2: 컬렉션 관리 페이지 기본 구조

**프론트엔드 파일 생성**:
- [x] `app/collections/page.tsx` - 메인 페이지
  - 컬렉션 카드 그리드 레이아웃 (컴팩트 버전으로 개선)
  - 각 카드: 이름, visibility 배지, 벡터수, HoverCard로 상세정보

**백엔드 API 수정**:
- [x] `backend/api/routes/qdrant.py`
  - `POST /api/qdrant/collections` 수정: visibility, description 파라미터 추가
  - `GET /api/qdrant/collections` 수정: SQLite 메타데이터 조인

### Day 3: 모달 컴포넌트

**프론트엔드 파일 생성**:
- [x] `app/collections/components/CreateCollectionModal.tsx`
  - 이름, 설명, 공개설정 (public/private/shared)
  - 고급설정: 벡터크기, 거리메트릭
- [x] `app/collections/components/CollectionSettingsModal.tsx`
  - 탭: 일반 / 공개설정 / 위험영역
  - 공개설정 변경, 공유 사용자 선택
- [x] `app/collections/components/DeleteConfirmModal.tsx`

**백엔드 API 추가**:
- [x] `backend/api/routes/qdrant.py`
  - `PATCH /api/qdrant/collections/{name}/settings` - 설정 변경
  - `DELETE /api/qdrant/collections/{name}` 수정 - 소유자 권한 확인

### Day 4: 필터/검색 및 마무리

**프론트엔드 수정**:
- [x] `app/collections/page.tsx`
  - 검색 입력, 공개상태 필터, 정렬 드롭다운
  - "데이터 업로드하러 가기" 링크
  - 프롬프트 생성 버튼 (placeholder - 비활성화 상태)

---

## Phase 2: 기존 페이지 수정 (Day 5-6)

### Day 5: 데이터 업로드 페이지 정리

**프론트엔드 수정**:
- [x] `app/upload/page.tsx` 및 `QdrantSettingsPanel.tsx`
  - 컬렉션 생성/삭제 버튼 제거 (컬렉션 관리 페이지로 이동)
  - "컬렉션 관리" 링크 추가
  - visibility 배지 표시

### Day 6: 메뉴 구조 변경

**프론트엔드 수정**:
- [x] `components/nav-header.tsx`
  ```typescript
  // 변경 전: 문서파싱 | URL파싱 | 벡터업로드 | Excel임베딩 | 채팅 | ...
  // 변경 후: 문서파싱 | 컬렉션관리 | 데이터업로드 | 채팅 | ...
  ```
- [ ] `app/parse/page.tsx` - URL 파싱 탭 통합
- [ ] 리다이렉트 설정 (필요시 middleware.ts)

---

## Phase 3: 접근 제어 (Day 7-8)

### Day 7: 백엔드 접근 제어

**백엔드 수정**:
- [x] `backend/api/routes/qdrant.py`
  - `GET /collections`: 비로그인 시 public만 반환 (get_current_user_optional 사용)
- [x] `backend/api/routes/chat.py`
  - `GET /collections`: 접근 가능한 컬렉션만 (collection_crud.get_accessible_collections 사용)
  - visibility, description, owner_id, is_owner 메타데이터 반환

### Day 8: 프론트엔드 접근 제어 UI

**프론트엔드 수정**:
- [x] `app/chat/components/InputArea.tsx` 및 `ChatContainer.tsx`
  - 컬렉션 드롭다운에 visibility 아이콘 표시 (Globe/Lock/Users)
  - Collection 인터페이스에 visibility, description, owner_id, is_owner 추가
- [x] `app/upload/components/QdrantSettingsPanel.tsx`
  - 접근 가능한 컬렉션만 표시 (백엔드 API가 필터링)
  - visibility 배지 표시

---

## Phase 4: 테스트 및 안정화 (Day 9)

- [x] 코드 구현 완료
- [ ] 워크플로우 테스트: 문서파싱 → 컬렉션생성 → 업로드 → 채팅
- [ ] 접근 제어 테스트: 비로그인 / 로그인 / 소유자
- [ ] 버그 수정 및 UX 개선

**[마일스톤] 컬렉션 관리 기능 릴리스 가능**

---

## Phase 5: 프롬프트 자동 생성 백엔드 (Day 10-13)

### Day 10-11: 서비스 레이어

**백엔드 파일 생성**:
- [ ] `backend/prompts/meta/meta_prompt.md` - 메타 프롬프트
- [ ] `backend/services/document_selector_service.py`
  - SQLite에서 document_id로 문서 조회
  - md_content 샘플링 (첫20% + 중간20% + 끝20%, 4000토큰)
- [ ] `backend/services/prompt_generator_service.py`
  - LLM API 호출 (타임아웃 60초, 재시도 2회)
  - 프롬프트 생성, 추천 질문 생성

### Day 12-13: API 및 유틸리티

**백엔드 파일 생성**:
- [ ] `backend/services/prompt_validator.py` - 검증
- [ ] `backend/services/file_manager_service.py` - 백업/저장/롤백
- [ ] `backend/api/routes/prompts.py` - API 라우터
  ```
  POST /api/prompts/generate - 생성 시작 (task_id 반환)
  GET  /api/prompts/generate/{task_id} - 상태 조회
  POST /api/prompts/save - 저장
  GET  /api/prompts/templates - 템플릿 목록
  GET  /api/prompts/documents/{collection_name} - 문서 목록
  POST /api/prompts/rollback - 롤백
  ```

**백엔드 수정**:
- [ ] `backend/main.py` - prompts 라우터 등록

---

## Phase 6: 프롬프트 자동 생성 프론트엔드 (Day 14-15)

### Day 14: 모달 기본 구조

**프론트엔드 파일 생성**:
- [x] `app/collections/components/PromptGeneratorModal.tsx`
  - Step 1: 문서 선택 드롭다운
  - Step 2: 템플릿 선택 (regulation/budget/default)
  - Step 3: 파일명 입력
  - 진행 상태 표시 (progress bar)

### Day 15: 미리보기 및 편집

**프론트엔드 파일 생성**:
- [x] `app/collections/components/PromptEditor.tsx` - 마크다운 편집
- [x] `app/collections/components/SuggestedQuestionsEditor.tsx` - 질문 편집

**프론트엔드 수정**:
- [x] `app/collections/page.tsx` - 프롬프트 생성 버튼 활성화

---

## Phase 7: 최종 테스트 (Day 16)

- [ ] 프롬프트 생성 전체 테스트
- [ ] 다양한 문서 유형 테스트 (규정, 예산, 기술문서)
- [ ] 문서화

**[마일스톤] 전체 기능 완료**

---

## 파일 목록 요약

### 신규 생성 파일

| 파일 | Phase |
|------|-------|
| `backend/models/qdrant_collection.py` | 1 |
| `backend/services/collection_crud.py` | 1 |
| `backend/scripts/migrate_collections.py` | 1 |
| `app/collections/page.tsx` | 1 |
| `app/collections/components/CreateCollectionModal.tsx` | 1 |
| `app/collections/components/CollectionSettingsModal.tsx` | 1 |
| `app/collections/components/DeleteConfirmModal.tsx` | 1 |
| `backend/prompts/meta/meta_prompt.md` | 5 |
| `backend/services/document_selector_service.py` | 5 |
| `backend/services/prompt_generator_service.py` | 5 |
| `backend/services/prompt_validator.py` | 5 |
| `backend/services/file_manager_service.py` | 5 |
| `backend/api/routes/prompts.py` | 5 |
| `app/collections/components/PromptGeneratorModal.tsx` | 6 |
| `app/collections/components/PromptEditor.tsx` | 6 |
| `app/collections/components/SuggestedQuestionsEditor.tsx` | 6 |

### 수정 파일

| 파일 | Phase |
|------|-------|
| `backend/main.py` | 1, 5 |
| `backend/api/routes/qdrant.py` | 1, 2, 3 |
| `backend/api/routes/chat.py` | 3 |
| `components/nav-header.tsx` | 2 |
| `app/qdrant/page.tsx` | 2, 3 |
| `app/parse/page.tsx` | 2 |
| `app/chat/page.tsx` | 3 |

---

## API 엔드포인트 요약

### 컬렉션 관리 (기존 확장)

| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/api/qdrant/collections` | 생성 (+visibility, description) |
| GET | `/api/qdrant/collections` | 목록 (접근 제어 적용) |
| PATCH | `/api/qdrant/collections/{name}/settings` | 설정 변경 |
| DELETE | `/api/qdrant/collections/{name}` | 삭제 (소유자만) |

### 프롬프트 자동 생성 (신규)

| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/api/prompts/generate` | 생성 시작 |
| GET | `/api/prompts/generate/{task_id}` | 상태 조회 |
| POST | `/api/prompts/save` | 저장 |
| GET | `/api/prompts/templates` | 템플릿 목록 |
| GET | `/api/prompts/documents/{collection}` | 문서 목록 |
| POST | `/api/prompts/rollback` | 롤백 |
