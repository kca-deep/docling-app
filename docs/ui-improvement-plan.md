# KCA-RAG UI 개선 계획

## 개요

이 문서는 KCA-RAG 파이프라인 애플리케이션의 UI 개선 계획을 담고 있습니다.
홈 화면과 네비게이션에 적용된 차트 색상 시스템(`--chart-1` ~ `--chart-5`)을 각 페이지에 일관되게 적용하는 것이 목표입니다.

---

## 색상 시스템

### CSS 변수 정의 (globals.css)

| 변수 | 라이트 모드 | 다크 모드 | 용도 |
|------|-------------|-----------|------|
| `--chart-1` | `oklch(0.55 0.15 250)` | `oklch(0.72 0.25 250)` | 파란색 - 문서/시작/입력 |
| `--chart-2` | `oklch(0.60 0.15 160)` | `oklch(0.75 0.22 160)` | 초록색 - 데이터/성장/성공 |
| `--chart-3` | `oklch(0.65 0.15 45)` | `oklch(0.78 0.20 45)` | 주황색 - 활성/강조/실시간 |
| `--chart-4` | `oklch(0.55 0.15 330)` | `oklch(0.70 0.22 330)` | 핑크색 - AI/분석/통계 |
| `--chart-5` | `oklch(0.50 0.15 280)` | `oklch(0.68 0.22 280)` | 보라색 - 통합/연동/외부 |

### 사용 방법

```tsx
// Tailwind 클래스로 사용
className="text-[color:var(--chart-1)]"
className="bg-[color:var(--chart-1)]/15"
className="border-[color:var(--chart-1)]/30"

// 인라인 스타일로 사용
style={{ color: "var(--chart-1)" }}
style={{ backgroundColor: "color-mix(in oklch, var(--chart-1) 15%, transparent)" }}
```

---

## 완료된 개선사항

### 1. 홈 화면 (`app/page.tsx`)

- [x] 프로세스 5단계 카드에 개별 차트 색상 적용
- [x] 히어로 섹션 타이틀 그라데이션 (`--chart-1` → `--chart-2` → `--chart-3`)
- [x] CTA 버튼 색상 개선
- [x] 통계 카드 아이콘 색상 및 글래스모피즘 배경
- [x] 챗봇 특징 섹션 아이콘 색상
- [x] features 카드 색상

### 2. 배경 컴포넌트

- [x] `AnimatedGradientBg` - CSS 변수 기반 그라데이션
- [x] `FloatingIcons` - 차트 색상 적용, opacity 향상

### 3. 네비게이션 (`components/nav-header.tsx`)

- [x] 로고 아이콘/텍스트 그라데이션
- [x] 각 메뉴 아이콘에 개별 색상 적용
- [x] 활성 상태 언더라인 인디케이터
- [x] 호버 상태 배경 색상

### 4. 통계 페이지 (`app/analytics/page.tsx`)

- [x] 페이지 타이틀 그라데이션 (`--chart-4` → `--chart-3`)
- [x] 메트릭 뱃지 아이콘 색상 (CSS 변수로 통일)
- [x] 타임라인 차트 버튼 색상
- [x] 히트맵 색상 (`color-mix()` 기반 동적 opacity)
- [x] 바 차트 색상
- [x] 히트맵 범례 색상
- [x] 실시간 활성 세션 뱃지 색상

### 5. AI 챗봇 페이지 (`app/chat/`)

- [x] ChatContainer 헤더 로고 그라데이션
- [x] InputArea 전송 버튼 그라데이션
- [x] 컬렉션 선택 아이콘 색상 (`--chart-2`)
- [x] 모델 선택 아이콘 색상 (`--chart-1`, `--chart-3`)
- [x] 심층사고 토글 버튼 색상 (`--chart-5`)
- [x] SuggestedPrompts 웰컴 섹션 그라데이션
- [x] 추천 질문 헤더/카드 색상 (`--chart-3`)
- [x] MessageBubble 아바타/버블 색상
- [x] 참조문서 아이콘/버튼 색상

### 6. 문서변환 페이지 (`app/parse/page.tsx`)

- [x] 페이지 타이틀 그라데이션 (`--chart-1` → `--chart-2`)
- [x] 드래그/드롭 영역 색상
- [x] 파일 상태 아이콘 색상 (pending, processing, success)
- [x] 성공/실패 카운트 아이콘 색상
- [x] 파싱 옵션 아이콘 색상 (`--chart-5`)
- [x] 전략 선택 아이콘 색상 (Docling: `--chart-3`, Qwen3-VL: `--chart-5`)
- [x] 다이얼로그 성공 아이콘 색상

### 7. 임베딩 페이지 (`app/upload/page.tsx`)

- [x] 페이지 타이틀 그라데이션 (`--chart-2` → `--chart-1`)
- [x] 업로드 설정 아이콘 색상 (`--chart-2`)
- [x] Vector DB 탭 아이콘 색상 (`--chart-2`, 활성 시)
- [x] Dify 탭 아이콘 색상 (`--chart-5`, 활성 시)

### 8. Excel 임베딩 페이지 (`app/excel-embedding/page.tsx`)

- [x] 페이지 타이틀 그라데이션 (`--chart-2` → `--chart-3`)
- [x] Excel 파일 카드 아이콘 색상 (`--chart-2`)
- [x] 드래그/드롭 영역 색상
- [x] Collection 카드 아이콘 색상 (`--chart-2`)
- [x] Column Mapping 카드 아이콘 색상 (`--chart-5`)
- [x] 결과 성공 아이콘 색상 (`--chart-2`)

### 9. 시스템 구성도 페이지 (`app/system-architecture/page.tsx`)

- [x] 페이지 타이틀 그라데이션 (`--chart-5` → `--chart-1`)
- [x] 아키텍처 카드 헤더 아이콘 색상 (`--chart-5`)

---

## 페이지별 개선 계획

### 1. 구성도 페이지 (`/system-architecture`)

**파일**: `app/system-architecture/page.tsx`

#### 현재 상태
- 하드코딩된 색상 사용 (`border-red-600`, `border-purple-500`, `border-green-500`)
- 아이콘 색상이 고정값

#### 개선 방안

| 요소 | 현재 | 제안 |
|------|------|------|
| RTX 5090 컨테이너 | `border-red-600/60` | `border-[color:var(--chart-4)]/60` |
| Entry Points 섹션 | `border-purple-500/50` | `border-[color:var(--chart-5)]/50` |
| Application 섹션 | `border-blue-500/50` | `border-[color:var(--chart-1)]/50` |
| Running 상태 뱃지 | `bg-green-500` | `bg-[color:var(--chart-2)]` |
| Inactive 상태 | `text-muted-foreground` | 유지 |

```tsx
// 섹션별 색상 매핑
const sectionColors = {
  rtx5090: "var(--chart-4)",      // 핑크 - GPU
  entryPoints: "var(--chart-5)",  // 보라 - 외부 연결
  application: "var(--chart-1)",  // 파랑 - 애플리케이션
  database: "var(--chart-2)",     // 초록 - 데이터
  llm: "var(--chart-3)",          // 주황 - AI/LLM
}
```

#### 페이지 헤더 개선
```tsx
// Before
<h1 className="text-3xl font-bold tracking-tight">시스템 구성도</h1>

// After
<h1 className="text-3xl font-bold tracking-tight">
  <span className="bg-gradient-to-r from-[color:var(--chart-5)] to-[color:var(--chart-1)] bg-clip-text text-transparent">
    시스템 구성도
  </span>
</h1>
```

---

### 2. 문서변환 페이지 (`/parse`)

**파일**: `app/parse/page.tsx`

#### 현재 상태
- 기본 shadcn 스타일 사용
- 상태 아이콘 색상 없음

#### 개선 방안

| 요소 | 현재 | 제안 |
|------|------|------|
| 페이지 타이틀 | 기본 foreground | 그라데이션 적용 |
| 업로드 영역 드래그 상태 | `border-primary` | `border-[color:var(--chart-1)]` |
| 처리 중 상태 | `Loader2` 기본색 | `text-[color:var(--chart-3)]` |
| 성공 상태 | `CheckCircle2` 기본색 | `text-[color:var(--chart-2)]` |
| 실패 상태 | `XCircle` 기본색 | `text-destructive` (유지) |
| 옵션 카드 아이콘 | 기본 foreground | 각각 차트 색상 |

```tsx
// 파싱 옵션 아이콘 색상
const optionIcons = {
  ocr: { icon: Eye, color: "var(--chart-1)" },
  table: { icon: Table, color: "var(--chart-2)" },
  image: { icon: Image, color: "var(--chart-3)" },
  formula: { icon: Sparkles, color: "var(--chart-5)" },
}
```

#### 진행률 표시 개선
```tsx
// Progress 컴포넌트에 차트 색상 적용
<Progress
  value={progress}
  className="h-2"
  style={{
    "--progress-background": "var(--chart-1)",
  } as React.CSSProperties}
/>
```

---

### 3. 임베딩 페이지 (`/upload`)

**파일**: `app/upload/page.tsx`

#### 현재 상태
- 탭 UI 기본 스타일
- 아이콘 색상 없음

#### 개선 방안

| 요소 | 현재 | 제안 |
|------|------|------|
| 페이지 타이틀 | 기본 | 그라데이션 |
| Qdrant 탭 아이콘 | 기본 | `text-[color:var(--chart-2)]` |
| Dify 탭 아이콘 | 기본 | `text-[color:var(--chart-5)]` |
| 업로드 버튼 | `bg-primary` | `bg-[color:var(--chart-2)]` |
| 설정 아이콘 | 기본 | `text-[color:var(--chart-3)]` |

```tsx
// 탭 색상 매핑
const tabColors = {
  qdrant: "var(--chart-2)",  // 초록 - 벡터 DB
  dify: "var(--chart-5)",    // 보라 - 외부 연동
}

// 활성 탭 스타일
<TabsTrigger
  value="qdrant"
  className="data-[state=active]:bg-[color:var(--chart-2)]/15"
>
  <Database style={{ color: "var(--chart-2)" }} />
  Qdrant
</TabsTrigger>
```

---

### 4. Excel 임베딩 페이지 (`/excel-embedding`)

**파일**: `app/excel-embedding/page.tsx`

#### 현재 상태
- 기본 shadcn 스타일
- 아이콘 색상 없음

#### 개선 방안

| 요소 | 현재 | 제안 |
|------|------|------|
| 페이지 타이틀 | 기본 | 그라데이션 (`--chart-2` 기반) |
| Excel 파일 아이콘 | 기본 | `text-[color:var(--chart-2)]` |
| 컬럼 매핑 아이콘들 | 기본 | 역할별 색상 |
| 미리보기 테이블 헤더 | 기본 | 배경색 적용 |
| 진행률 바 | 기본 | `--chart-2` 색상 |

```tsx
// 컬럼 매핑 아이콘 색상
const columnIcons = {
  id: { icon: Hash, color: "var(--chart-1)" },
  text: { icon: FileText, color: "var(--chart-2)" },
  tag: { icon: Tag, color: "var(--chart-5)" },
  metadata: { icon: Info, color: "var(--chart-3)" },
}
```

---

### 5. AI 챗봇 페이지 (`/chat`)

**파일**: `app/chat/components/ChatContainer.tsx`

#### 현재 상태
- 기본 스타일
- 컬렉션 선택 UI 단순

#### 개선 방안

| 요소 | 현재 | 제안 |
|------|------|------|
| 챗봇 헤더 | 기본 | 그라데이션 로고 |
| 전송 버튼 | `bg-primary` | `bg-gradient-to-r from-[color:var(--chart-1)] to-[color:var(--chart-2)]` |
| 사용자 메시지 버블 | 기본 배경 | `bg-[color:var(--chart-1)]/10` |
| AI 응답 아이콘 | 기본 | `text-[color:var(--chart-3)]` |
| 소스 패널 아이콘 | 기본 | `text-[color:var(--chart-2)]` |
| 설정 패널 아이콘 | 기본 | `text-[color:var(--chart-5)]` |

```tsx
// 메시지 버블 스타일
const messageStyles = {
  user: "bg-[color:var(--chart-1)]/10 border-[color:var(--chart-1)]/20",
  assistant: "bg-muted/50",
}

// 모델 선택 색상
const modelColors = {
  "gpt-oss-20b": "var(--chart-1)",
  "exaone-32b": "var(--chart-2)",
  "hyperclova-x": "var(--chart-3)",
}
```

#### 추천 질문 버튼 개선
```tsx
<Button
  variant="outline"
  className="border-[color:var(--chart-3)]/30 hover:bg-[color:var(--chart-3)]/10"
>
  <Sparkles style={{ color: "var(--chart-3)" }} />
  {prompt}
</Button>
```

---

### 6. 통계 페이지 (`/analytics`)

**파일**: `app/analytics/page.tsx`

#### 현재 상태
- 이미 차트 색상 일부 적용됨
- 하드코딩된 Tailwind 색상 혼재 (`text-blue-500`, `text-purple-500` 등)

#### 개선 방안

| 요소 | 현재 | 제안 |
|------|------|------|
| 메트릭 뱃지 아이콘 | `text-blue-500` 등 | CSS 변수로 통일 |
| 차트 컬러 | `var(--chart-*)` | 유지 |
| 히트맵 색상 | `bg-emerald-*` 하드코딩 | CSS 변수 기반 |
| 카드 헤더 아이콘 | 기본 | 역할별 색상 |

```tsx
// 메트릭 뱃지 색상 통일
const metricColors = {
  queries: "var(--chart-1)",      // 파랑
  sessions: "var(--chart-5)",     // 보라
  turns: "var(--chart-2)",        // 초록
  responseTime: "var(--chart-3)", // 주황
  tokens: "var(--chart-3)",       // 주황
  active: "var(--chart-2)",       // 초록
}

// 히트맵 색상 (CSS 변수화)
const heatmapIntensity = (value: number, max: number) => {
  const intensity = max > 0 ? value / max : 0
  // chart-2 (초록) 기반 opacity 조절
  return `color-mix(in oklch, var(--chart-2) ${intensity * 100}%, transparent)`
}
```

---

## 공통 컴포넌트 개선

### 페이지 헤더 패턴

모든 페이지에 일관된 헤더 스타일 적용:

```tsx
// 페이지별 메인 색상 정의
const pageColors = {
  "system-architecture": ["var(--chart-5)", "var(--chart-1)"],
  "parse": ["var(--chart-1)", "var(--chart-2)"],
  "upload": ["var(--chart-2)", "var(--chart-5)"],
  "excel-embedding": ["var(--chart-2)", "var(--chart-3)"],
  "chat": ["var(--chart-3)", "var(--chart-1)"],
  "analytics": ["var(--chart-4)", "var(--chart-3)"],
}

// 공통 헤더 컴포넌트
function PageHeader({ title, description, colors }: Props) {
  return (
    <div className="space-y-2">
      <h1
        className="text-3xl font-bold tracking-tight bg-clip-text text-transparent"
        style={{
          backgroundImage: `linear-gradient(90deg, ${colors[0]}, ${colors[1]})`
        }}
      >
        {title}
      </h1>
      <p className="text-muted-foreground">{description}</p>
    </div>
  )
}
```

### 상태 표시 패턴

```tsx
// 공통 상태 색상
const statusColors = {
  success: "var(--chart-2)",    // 초록
  processing: "var(--chart-3)", // 주황
  error: "var(--destructive)",  // 빨강 (기존 유지)
  pending: "var(--muted-foreground)", // 회색
  active: "var(--chart-1)",     // 파랑
}
```

---

## 구현 우선순위

| 순위 | 페이지 | 난이도 | 영향도 |
|------|--------|--------|--------|
| 1 | 통계 (`/analytics`) | 낮음 | 높음 |
| 2 | AI 챗봇 (`/chat`) | 중간 | 높음 |
| 3 | 문서변환 (`/parse`) | 낮음 | 중간 |
| 4 | 임베딩 (`/upload`) | 낮음 | 중간 |
| 5 | Excel (`/excel-embedding`) | 낮음 | 낮음 |
| 6 | 구성도 (`/system-architecture`) | 중간 | 낮음 |

---

## 체크리스트

### 각 페이지 공통
- [x] 페이지 타이틀 그라데이션 적용
- [x] 주요 아이콘에 차트 색상 적용
- [x] 상태 표시 색상 통일
- [x] 버튼/인터랙티브 요소 색상 개선
- [x] 하드코딩된 Tailwind 색상 → CSS 변수로 전환

### 다크모드 확인
- [x] 모든 색상이 다크모드에서 적절히 표시되는지 확인
- [x] contrast ratio 확인 (접근성)
- [x] hover/active 상태 확인

---

## 참고사항

1. **하드코딩 금지**: `text-blue-500` 같은 고정 색상 대신 `var(--chart-*)` 사용
2. **일관성 유지**: 동일한 역할의 요소는 동일한 색상 사용
3. **다크모드 자동 대응**: CSS 변수 사용 시 자동으로 다크모드 색상 적용
4. **성능 고려**: `color-mix()` 함수는 모던 브라우저에서 지원됨
