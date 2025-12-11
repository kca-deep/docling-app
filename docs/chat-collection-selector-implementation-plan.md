# AI 챗봇 컬렉션 선택 UI 개선 구현 계획

> 작성일: 2025-12-11
> 기반 문서: `docs/kca-rag-category-proposal.md`
> 대상: `/chat` 페이지 컬렉션 선택 UI

---

## 1. 현황 분석

### 1.1 현재 UI 구조

**파일 위치**: `app/chat/components/InputArea.tsx:286-324`

```tsx
<Select value={selectedCollection} onValueChange={onCollectionChange}>
  <SelectTrigger>
    <Database /> {selectedCollection || "일상대화"}
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="__casual__">일상대화</SelectItem>
    {collections.map((c) => (
      <SelectItem key={c.name} value={c.name}>
        <VisibilityIcon /> {c.name} <Badge>{c.points_count}</Badge>
      </SelectItem>
    ))}
  </SelectContent>
</Select>
```

### 1.2 현재 문제점

| 문제 | 설명 |
|------|------|
| 평면적 나열 | 컬렉션이 단순 리스트로 표시 |
| 정보 부족 | 컬렉션명만으로 내용 파악 불가 |
| 검색 불가 | 많은 컬렉션에서 원하는 항목 찾기 어려움 |
| 맥락 없음 | 어떤 질문에 어떤 컬렉션이 적합한지 알 수 없음 |

### 1.3 개선 목표

- 한글명 + 키워드로 직관적 이해
- 자주 사용하는 컬렉션 빠른 접근 (추천 섹션)
- 검색 기능으로 빠른 필터링
- 전체 목록 접기/펼치기

### 1.4 현재 API 응답 구조

**엔드포인트**: `GET /api/chat/collections`

**Collection 인터페이스** (`InputArea.tsx:55-65`):
```typescript
interface Collection {
  name: string;
  documents_count: number;
  points_count: number;
  vector_size: number;
  distance: string;
  visibility?: string;      // public, private, shared
  description?: string;     // 메타데이터 JSON 저장 필드
  owner_id?: number;
  is_owner?: boolean;
}
```

---

## 2. 메타데이터 설계 (Qdrant description 활용)

### 2.1 메타데이터 저장 전략

기존 `description` 필드에 JSON 형태로 메타데이터를 저장합니다.

**장점:**
- 추가 DB 테이블 불필요
- 컬렉션과 메타데이터가 함께 관리됨
- Qdrant 페이지에서 편집 가능

**description 필드 JSON 구조:**
```json
{
  "koreanName": "인사관리",
  "icon": "Briefcase",
  "keywords": ["채용", "승진", "평가"],
  "priority": 1,
  "plainDescription": "채용, 승진, 평가 관련 규정"
}
```

### 2.2 메타데이터 타입 정의

**파일**: `app/chat/types/collection-metadata.ts` (신규)

```typescript
/**
 * Qdrant description 필드에 저장되는 메타데이터
 * JSON.parse(collection.description)로 파싱
 */
export interface CollectionMetadata {
  koreanName?: string;       // 한글명 (예: "인사관리")
  icon?: string;             // lucide-react 아이콘명 (예: "Briefcase")
  keywords?: string[];       // 검색 키워드 (예: ["채용", "승진", "평가"])
  priority?: number;         // 추천 우선순위 (1=핵심, 2=주요, 3=일반)
  plainDescription?: string; // 간단 설명 (메타데이터 없을 때 폴백용)
}

/**
 * API에서 받은 Collection에 파싱된 메타데이터 추가
 */
export interface CollectionWithMetadata {
  name: string;
  documents_count: number;
  points_count: number;
  vector_size: number;
  distance: string;
  visibility?: string;
  description?: string;
  owner_id?: number;
  is_owner?: boolean;
  // 파싱된 메타데이터
  metadata: CollectionMetadata;
}

/**
 * description 필드에서 메타데이터 파싱
 * JSON 파싱 실패 시 빈 객체 반환
 */
export function parseCollectionMetadata(description?: string): CollectionMetadata {
  if (!description) return {};

  try {
    const parsed = JSON.parse(description);
    // 유효한 메타데이터 객체인지 확인
    if (typeof parsed === 'object' && parsed !== null) {
      return {
        koreanName: parsed.koreanName,
        icon: parsed.icon,
        keywords: Array.isArray(parsed.keywords) ? parsed.keywords : undefined,
        priority: typeof parsed.priority === 'number' ? parsed.priority : undefined,
        plainDescription: parsed.plainDescription,
      };
    }
  } catch {
    // JSON 파싱 실패 시 description을 plainDescription으로 사용
    return { plainDescription: description };
  }

  return {};
}

/**
 * 메타데이터를 description JSON 문자열로 직렬화
 */
export function serializeCollectionMetadata(metadata: CollectionMetadata): string {
  return JSON.stringify(metadata);
}
```

### 2.3 아이콘 매핑

**파일**: `app/chat/data/icon-map.ts` (신규)

```typescript
import {
  Landmark, Briefcase, Users, Calendar, Wallet, Gift,
  Scale, Shield, CreditCard, Search, FileText, Award,
  FlaskConical, Building, Database, FolderOpen
} from "lucide-react";
import { LucideIcon } from "lucide-react";

/**
 * 아이콘 이름 → 컴포넌트 매핑
 * description.icon 필드에 저장된 문자열을 컴포넌트로 변환
 */
export const ICON_MAP: Record<string, LucideIcon> = {
  Landmark,
  Briefcase,
  Users,
  Calendar,
  Wallet,
  Gift,
  Scale,
  Shield,
  CreditCard,
  Search,
  FileText,
  Award,
  FlaskConical,
  Building,
  Database,
  FolderOpen,
};

/**
 * 아이콘 이름으로 컴포넌트 반환 (없으면 Database 기본값)
 */
export function getIconComponent(iconName?: string): LucideIcon {
  if (!iconName) return Database;
  return ICON_MAP[iconName] || Database;
}

/**
 * 사용 가능한 아이콘 목록 (메타데이터 편집 UI용)
 */
export const AVAILABLE_ICONS = Object.keys(ICON_MAP);
```

---

## 3. 목표 UI 디자인

### 3.1 스마트 추천 + 전체 목록

```
┌─────────────────────────────────────────────────────────┐
│ 지식 베이스 선택                                  [×]   │
├─────────────────────────────────────────────────────────┤
│ 🔍 검색...                                              │
├─────────────────────────────────────────────────────────┤
│ ⭐ 추천 (priority=1인 컬렉션)                           │
│   ├ 💼 인사관리    채용, 승진, 평가            12개 규정 │
│   ├ 🏖️ 복무관리    휴가, 재택, 출장             8개 규정 │
│   └ 💰 보수급여    급여, 수당, 여비             7개 규정 │
├─────────────────────────────────────────────────────────┤
│ 📂 전체 목록 (N개)                            [펼치기]  │
├─────────────────────────────────────────────────────────┤
│ 💬 일상대화                                             │
│     RAG 검색 없이 자유 대화                             │
└─────────────────────────────────────────────────────────┘
```

### 3.2 전체 목록 펼침 시

```
┌─────────────────────────────────────────────────────────┐
│ 📂 전체 목록 (N개)                              [접기]  │
├─────────────────────────────────────────────────────────┤
│ 🏛️ 기본법규    정관, 이사회, 조직               7개 규정 │
│ 💼 인사관리    채용, 승진, 평가                12개 규정 │
│ 👥 고용형태    계약직, 공무직, 전환             6개 규정 │
│ ...                                                     │
└─────────────────────────────────────────────────────────┘
```

### 3.3 검색 필터링 시

`휴가` 입력 시:

```
┌─────────────────────────────────────────────────────────┐
│ 🔍 휴가                                          [×]    │
├─────────────────────────────────────────────────────────┤
│ 검색 결과 (1개)                                         │
│   🏖️ 복무관리    휴가, 재택, 출장               8개 규정 │
│                  ^^^^(하이라이트)                       │
└─────────────────────────────────────────────────────────┘
```

---

## 4. 컴포넌트 구조

### 4.1 파일 구조

```
app/chat/
├── components/
│   ├── InputArea.tsx                    # 기존 (수정 - 새 컴포넌트 사용)
│   ├── CollectionSelector/              # 신규 폴더
│   │   ├── index.tsx                    # 메인 Popover 컴포넌트
│   │   ├── CollectionSearchInput.tsx    # 검색 입력
│   │   ├── RecommendedSection.tsx       # 추천 섹션 (priority=1)
│   │   ├── FullListSection.tsx          # 전체 목록 (접기/펼치기)
│   │   ├── CollectionItem.tsx           # 개별 컬렉션 항목
│   │   └── CasualModeItem.tsx           # 일상대화 항목
│   └── ...
├── types/
│   └── collection-metadata.ts           # 신규 - 타입 및 파싱 유틸
├── data/
│   └── icon-map.ts                      # 신규 - 아이콘 매핑
└── hooks/
    └── useCollectionSearch.ts           # 신규 - 검색/필터링 로직
```

### 4.2 메인 컴포넌트

**파일**: `app/chat/components/CollectionSelector/index.tsx`

```tsx
"use client";

import { useState, useMemo } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Database, ChevronDown } from "lucide-react";
import { CollectionSearchInput } from "./CollectionSearchInput";
import { RecommendedSection } from "./RecommendedSection";
import { FullListSection } from "./FullListSection";
import { CasualModeItem } from "./CasualModeItem";
import { CollectionItem } from "./CollectionItem";
import { useCollectionSearch } from "../../hooks/useCollectionSearch";
import {
  parseCollectionMetadata,
  CollectionWithMetadata
} from "../../types/collection-metadata";
import { getIconComponent } from "../../data/icon-map";
import { cn } from "@/lib/utils";

interface Collection {
  name: string;
  documents_count: number;
  points_count: number;
  vector_size: number;
  distance: string;
  visibility?: string;
  description?: string;
  owner_id?: number;
  is_owner?: boolean;
}

interface CollectionSelectorProps {
  selectedCollection: string;
  onCollectionChange: (collection: string) => void;
  collections: Collection[];
  disabled?: boolean;
}

export function CollectionSelector({
  selectedCollection,
  onCollectionChange,
  collections,
  disabled,
}: CollectionSelectorProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showFullList, setShowFullList] = useState(false);

  // 메타데이터 파싱 및 컬렉션 확장
  const collectionsWithMetadata: CollectionWithMetadata[] = useMemo(() => {
    return collections.map((c) => ({
      ...c,
      metadata: parseCollectionMetadata(c.description),
    }));
  }, [collections]);

  // 추천 컬렉션 (priority === 1)
  const recommendedCollections = useMemo(() => {
    return collectionsWithMetadata
      .filter((c) => c.metadata.priority === 1)
      .sort((a, b) =>
        (a.metadata.koreanName || a.name).localeCompare(
          b.metadata.koreanName || b.name,
          "ko-KR"
        )
      );
  }, [collectionsWithMetadata]);

  // 검색 필터링
  const { filteredCollections, hasSearchResults } = useCollectionSearch(
    collectionsWithMetadata,
    searchQuery
  );

  // 현재 선택된 컬렉션 표시명
  const selectedDisplayName = useMemo(() => {
    if (!selectedCollection) return "일상대화";
    const collection = collectionsWithMetadata.find(
      (c) => c.name === selectedCollection
    );
    return collection?.metadata.koreanName || selectedCollection;
  }, [selectedCollection, collectionsWithMetadata]);

  // 현재 선택된 컬렉션의 아이콘
  const SelectedIcon = useMemo(() => {
    if (!selectedCollection) return Database;
    const collection = collectionsWithMetadata.find(
      (c) => c.name === selectedCollection
    );
    return getIconComponent(collection?.metadata.icon);
  }, [selectedCollection, collectionsWithMetadata]);

  const handleSelect = (collectionName: string) => {
    onCollectionChange(collectionName);
    setOpen(false);
    setSearchQuery("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="h-8 w-auto min-w-[140px] justify-between gap-2 rounded-full"
        >
          <div className="flex items-center gap-1.5">
            <SelectedIcon
              className="h-3.5 w-3.5"
              style={{ color: "var(--chart-2)" }}
            />
            <span className="text-xs font-medium">{selectedDisplayName}</span>
          </div>
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[360px] p-0" align="start">
        {/* 헤더 */}
        <div className="px-3 py-2 border-b">
          <h4 className="font-medium text-sm">지식 베이스 선택</h4>
        </div>

        {/* 검색 입력 */}
        <CollectionSearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="컬렉션 검색..."
        />

        <div className="max-h-[400px] overflow-y-auto">
          {/* 검색 중일 때 */}
          {searchQuery ? (
            <div className="p-2">
              {hasSearchResults ? (
                <>
                  <p className="text-xs text-muted-foreground px-2 py-1">
                    검색 결과 ({filteredCollections.length}개)
                  </p>
                  {filteredCollections.map((c) => (
                    <CollectionItem
                      key={c.name}
                      collection={c}
                      isSelected={selectedCollection === c.name}
                      onSelect={() => handleSelect(c.name)}
                      highlightText={searchQuery}
                    />
                  ))}
                </>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  검색 결과가 없습니다
                </p>
              )}
            </div>
          ) : (
            <>
              {/* 추천 섹션 */}
              {recommendedCollections.length > 0 && (
                <RecommendedSection
                  collections={recommendedCollections}
                  selectedCollection={selectedCollection}
                  onSelect={handleSelect}
                />
              )}

              {/* 전체 목록 */}
              <FullListSection
                collections={collectionsWithMetadata}
                selectedCollection={selectedCollection}
                onSelect={handleSelect}
                expanded={showFullList}
                onExpandChange={setShowFullList}
              />

              {/* 일상대화 */}
              <div className="border-t p-2">
                <CasualModeItem
                  isSelected={!selectedCollection}
                  onSelect={() => handleSelect("")}
                />
              </div>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
```

### 4.3 검색 훅

**파일**: `app/chat/hooks/useCollectionSearch.ts`

```typescript
import { useMemo } from "react";
import { CollectionWithMetadata } from "../types/collection-metadata";

export function useCollectionSearch(
  collections: CollectionWithMetadata[],
  query: string
) {
  const filteredCollections = useMemo(() => {
    if (!query.trim()) return collections;

    const normalizedQuery = query.toLowerCase().trim();

    return collections.filter((c) => {
      const { metadata } = c;

      // 컬렉션 이름 검색
      if (c.name.toLowerCase().includes(normalizedQuery)) {
        return true;
      }

      // 한글명 검색
      if (metadata.koreanName?.toLowerCase().includes(normalizedQuery)) {
        return true;
      }

      // 키워드 검색
      if (metadata.keywords?.some((k) =>
        k.toLowerCase().includes(normalizedQuery)
      )) {
        return true;
      }

      // 설명 검색
      if (metadata.plainDescription?.toLowerCase().includes(normalizedQuery)) {
        return true;
      }

      return false;
    });
  }, [collections, query]);

  return {
    filteredCollections,
    hasSearchResults: filteredCollections.length > 0,
  };
}
```

---

## 5. 구현 단계

### Phase 1: 기반 작업

| 순서 | 작업 | 파일 |
|:----:|------|------|
| 1-1 | 타입 및 파싱 유틸 정의 | `types/collection-metadata.ts` |
| 1-2 | 아이콘 매핑 정의 | `data/icon-map.ts` |
| 1-3 | 검색 훅 구현 | `hooks/useCollectionSearch.ts` |

### Phase 2: 컴포넌트 구현

| 순서 | 작업 | 파일 |
|:----:|------|------|
| 2-1 | CollectionItem 구현 | `CollectionSelector/CollectionItem.tsx` |
| 2-2 | CasualModeItem 구현 | `CollectionSelector/CasualModeItem.tsx` |
| 2-3 | CollectionSearchInput 구현 | `CollectionSelector/CollectionSearchInput.tsx` |
| 2-4 | RecommendedSection 구현 | `CollectionSelector/RecommendedSection.tsx` |
| 2-5 | FullListSection 구현 | `CollectionSelector/FullListSection.tsx` |
| 2-6 | 메인 컴포넌트 통합 | `CollectionSelector/index.tsx` |

### Phase 3: 통합 및 테스트

| 순서 | 작업 | 파일 |
|:----:|------|------|
| 3-1 | InputArea에서 기존 Select 교체 | `InputArea.tsx` |
| 3-2 | 다크/라이트 모드 테스트 | - |
| 3-3 | 키보드 네비게이션 확인 | - |

### Phase 4: 메타데이터 편집 UI (선택)

| 순서 | 작업 | 파일 |
|:----:|------|------|
| 4-1 | Qdrant 페이지에 메타데이터 편집 모달 추가 | `app/qdrant/page.tsx` |
| 4-2 | description 필드 업데이트 API 연동 | 기존 API 활용 |

---

## 6. 기존 컬렉션 메타데이터 설정 가이드

### 6.1 Qdrant 페이지에서 설정

Qdrant 관리 페이지(`/qdrant`)에서 컬렉션 설정 > description 필드에 JSON 입력:

```json
{
  "koreanName": "인사관리",
  "icon": "Briefcase",
  "keywords": ["채용", "승진", "평가", "인사"],
  "priority": 1,
  "plainDescription": "채용, 승진, 평가 관련 규정 문서"
}
```

### 6.2 메타데이터 예시

| 컬렉션명 | koreanName | icon | keywords | priority |
|----------|------------|------|----------|----------|
| (동적) | 한글명 | Lucide 아이콘명 | 검색 키워드 배열 | 1/2/3 |

**아이콘 참고** (lucide-react):
- `Landmark` - 기관/법규
- `Briefcase` - 업무/인사
- `Users` - 인원/조직
- `Calendar` - 일정/복무
- `Wallet` - 급여/보수
- `Gift` - 복지/혜택
- `Scale` - 법률/징계
- `Shield` - 보안/윤리
- `CreditCard` - 재무/회계
- `Search` - 감사/조사
- `FileText` - 문서/정보
- `Award` - 자격/인증
- `FlaskConical` - 연구/R&D
- `Building` - 시설/장비

---

## 7. UI/UX 세부 사항

### 7.1 스타일 가이드

```css
/* 컬렉션 항목 hover 효과 */
.collection-item:hover {
  background: hsl(var(--muted) / 0.5);
}

/* 선택된 항목 */
.collection-item[data-selected="true"] {
  background: hsl(var(--primary) / 0.1);
  border-left: 2px solid hsl(var(--primary));
}

/* 키워드 하이라이트 */
.keyword-highlight {
  background: hsl(var(--chart-4) / 0.3);
  border-radius: 2px;
  padding: 0 2px;
}
```

### 7.2 반응형 고려사항

| 화면 크기 | 동작 |
|----------|------|
| Desktop (>768px) | Popover 360px 너비, 전체 기능 표시 |
| Tablet (768px) | Popover 320px 너비, 동일 기능 |
| Mobile (<640px) | Sheet (하단 슬라이드) 형태로 전환 고려 |

---

## 8. 향후 확장 고려사항

### 8.1 메타데이터 편집 UI

Qdrant 관리 페이지에 메타데이터 편집 모달 추가:
- 아이콘 선택 드롭다운
- 키워드 태그 입력
- 우선순위 설정
- 미리보기

### 8.2 사용 통계 기반 추천

```typescript
// 사용자별 최근 사용 컬렉션 추적 (localStorage)
interface CollectionUsageStats {
  collectionName: string;
  usageCount: number;
  lastUsedAt: string;
}
```

### 8.3 질문 기반 자동 추천

```typescript
// 입력 중인 질문 분석하여 컬렉션 추천
const suggestedCollection = useMemo(() => {
  const input = userInput.toLowerCase();

  for (const c of collectionsWithMetadata) {
    const keywords = c.metadata.keywords || [];
    if (keywords.some(k => input.includes(k.toLowerCase()))) {
      return c.name;
    }
  }

  return null;
}, [userInput, collectionsWithMetadata]);
```

---

## 9. 체크리스트

### 구현 전 확인

- [ ] Popover 컴포넌트 정상 동작 확인 (shadcn/ui)
- [ ] 현재 컬렉션 API 응답 구조 확인
- [ ] 기존 Select 컴포넌트 동작 백업

### 구현 중 확인

- [ ] 타입 정의 완료
- [ ] 아이콘 매핑 완료
- [ ] 메타데이터 파싱 로직 정상 동작
- [ ] 검색 기능 정상 동작
- [ ] 추천 섹션 표시 (priority=1)
- [ ] 전체 목록 접기/펼치기
- [ ] 일상대화 모드 동작

### 구현 후 확인

- [ ] 다크 모드 스타일 확인
- [ ] 키보드 네비게이션 (방향키, Enter, Escape)
- [ ] 메타데이터 없는 컬렉션 폴백 표시
- [ ] 성능 테스트

---

## 10. 참고 자료

- 현재 UI 코드: `app/chat/components/InputArea.tsx`
- Qdrant API: `backend/api/routes/qdrant.py`
- Collection 스키마: `backend/models/schemas.py:QdrantCollectionInfo`
- shadcn/ui Popover: https://ui.shadcn.com/docs/components/popover
- lucide-react Icons: https://lucide.dev/icons
