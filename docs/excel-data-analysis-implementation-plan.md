# Excel 데이터 기반 통계 분석 Function Calling 구현 계획

> **문서 버전**: 2.0
> **작성일**: 2026-02-02
> **검증 방법**: Sequential Thinking MCP
> **상태**: 검증 완료, 구현 대기

---

## 0. 핵심 원칙

### [CRITICAL] 하드코딩 금지 원칙

이 구현에서 다음 항목은 **절대 하드코딩하지 않습니다**:

| 금지 항목 | 이유 | 대안 |
|----------|------|------|
| 특정 컬럼명 (예: "지역", "연도") | 다른 엑셀에는 해당 컬럼 없음 | 스키마에서 동적 추출 |
| 도메인 특화 키워드 (예: "지역별", "무선국") | 다른 도메인에 적용 불가 | 일반적 분석 표현만 사용 |
| 고정된 분석 유형 | 데이터 특성에 맞지 않을 수 있음 | 스키마 기반 자동 제안 |
| 예시 코드의 실제 컬럼명 | LLM이 그대로 복사할 위험 | 플레이스홀더 사용 |

**설계 원칙**:
- 모든 분석 로직은 **스키마 기반 동적 생성**
- LLM이 **스키마를 보고 스스로 판단**하도록 설계
- 어떤 엑셀 데이터에도 적용 가능한 **범용 구조**

---

## 1. 개요

### 1.1 배경

현재 AI 챗봇은 RAG(Retrieval-Augmented Generation) 기반으로 문서 검색 및 질의응답에 최적화되어 있습니다. 그러나 엑셀 데이터의 통계 분석(집계, 시각화)은 RAG 아키텍처의 한계로 불가능합니다.

**RAG의 한계**:
- 유사도 검색 기반으로 `top_k`개 청크만 반환
- 전체 데이터 집계(GROUP BY, SUM, AVG) 불가능
- 대용량 데이터를 LLM 컨텍스트에 직접 전달 불가 (토큰 제한)

### 1.2 목표

**다양한 유형의 엑셀 파일**을 업로드 후 사용자의 자연어 통계 요청을 Python 코드로 변환하여 실행하고, 결과를 테이블/차트로 반환하는 Code Interpreter 스타일 기능 구현

### 1.3 지원 데이터 유형

| 데이터 유형 | 예시 | 자동 감지 분석 |
|------------|------|---------------|
| 판매 데이터 | 상품, 수량, 금액, 날짜 | 상품별 매출, 월별 추이 |
| 인사 데이터 | 부서, 직급, 연봉, 입사일 | 부서별 인원, 직급별 평균 연봉 |
| 설문 데이터 | 응답자, 항목1~10, 만족도 | 항목별 평균, 만족도 분포 |
| 로그 데이터 | 시간, IP, 상태코드, 응답시간 | 시간대별 요청, 상태코드 분포 |
| 통신 데이터 | 지역, 국종코드, 주파수 | 지역별 집계, 국종별 분포 |
| **기타 모든 표 형식 데이터** | - | 스키마 기반 자동 분석 |

### 1.4 예상 사용 시나리오

```
사용자: [엑셀 파일 업로드: 판매현황.xlsx]

AI: 파일을 분석했습니다.

**데이터 요약:**
- 총 1,500개 행
- 컬럼: 상품명, 카테고리, 수량, 단가, 판매일

**이 데이터로 가능한 분석:**
- '카테고리'별 '수량' 집계
- '상품명'별 '단가' 평균
- '판매일' 기준 시계열 분석

어떤 분석을 원하시나요?

사용자: "카테고리별 판매 수량을 막대그래프로 보여줘"

AI: [분석 결과 테이블 + 막대그래프]
```

---

## 2. 시스템 아키텍처

### 2.1 전체 흐름

```
┌─────────────────────────────────────────────────────────────────┐
│                     1. 엑셀 파일 업로드                          │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                   document_processor                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │ DataFrame   │    │ 스키마 자동 │    │ 분석 가능성 │         │
│  │ 생성       │ →  │ 분석       │ →  │ 자동 제안   │         │
│  └─────────────┘    └─────────────┘    └─────────────┘         │
│                            │                                    │
│                            ▼                                    │
│                    ┌─────────────┐    ┌─────────────┐          │
│                    │ DataFrame   │    │ 벡터화      │          │
│                    │ 캐시 저장   │ +  │ (RAG용)     │          │
│                    └─────────────┘    └─────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     2. 사용자 통계 요청                          │
│                   (도메인 무관한 자연어)                         │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                   analysis_intent_detector                       │
│         도메인 독립적 키워드로 분석 의도 감지                     │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                         LLM (GPT-OSS)                           │
│  1. 동적 생성된 스키마 정보 확인                                 │
│  2. 자동 제안된 분석 가능성 참고                                 │
│  3. 적절한 컬럼 선택하여 Python 코드 생성                        │
│  4. Function Calling: execute_data_analysis                     │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      code_executor                               │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │ 코드 검증   │ → │ 샌드박스    │ → │ 결과 추출   │         │
│  │ (보안)     │    │ 실행       │    │ (표/차트)   │         │
│  └─────────────┘    └─────────────┘    └─────────────┘         │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                        3. 결과 반환                              │
│  - 마크다운 테이블                                               │
│  - Base64 인코딩 차트 이미지                                     │
│  - 자연어 설명                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 컴포넌트 구성

| 컴포넌트 | 파일 경로 | 역할 |
|---------|----------|------|
| **스키마 분석기** | `backend/services/schema_analyzer.py` | 컬럼 유형 자동 추론, 분석 가능성 제안 |
| DataFrame 캐시 | `backend/services/dataframe_cache.py` | 엑셀 데이터 + 스키마 캐싱 |
| 코드 검증기 | `backend/services/code_validator.py` | Python 코드 보안 검증 |
| 코드 실행기 | `backend/services/code_executor.py` | 샌드박스 환경에서 코드 실행 |
| 분석 의도 감지 | `backend/services/analysis_intent_detector.py` | **도메인 독립적** 분석 요청 감지 |
| 도구 정의 | `backend/services/tool_definitions.py` | Function Calling 도구 스키마 |
| 분석 프롬프트 | `backend/prompts/data_analysis.md` | **동적 생성** LLM 지시사항 |

---

## 3. 상세 설계

### 3.1 스키마 분석기 (신규)

**목적**: 엑셀 데이터의 컬럼 유형을 자동으로 추론하고 가능한 분석 방법 제안

**컬럼 유형 자동 분류**:

| 추론 유형 | 조건 | 역할 |
|----------|------|------|
| `identifier` | 고유값 비율 > 95% | ID 컬럼 (분석 제외) |
| `categorical` | 고유값 비율 < 5%, 문자열 | 그룹화 후보 |
| `categorical_numeric` | 숫자지만 고유값 < 20개 | 코드값 (그룹화 후보) |
| `numeric` | int/float 타입 | 집계 대상 |
| `temporal` | datetime 또는 날짜 패턴 | 시계열 축 |
| `text` | 평균 문자열 길이 > 100 | 텍스트 내용 (분석 제외) |

**설계**:

```python
# backend/services/schema_analyzer.py

class SchemaAnalyzer:
    """DataFrame 스키마 자동 분석"""

    def analyze(self, df: pd.DataFrame) -> dict:
        """
        DataFrame 분석하여 스키마 및 분석 제안 생성

        Returns:
            {
                "columns": [...],
                "row_count": int,
                "suggested_analyses": [...]
            }
        """
        columns = []
        for col in df.columns:
            col_info = self._analyze_column(df[col], len(df))
            columns.append(col_info)

        suggestions = self._generate_suggestions(columns)

        return {
            "columns": columns,
            "row_count": len(df),
            "suggested_analyses": suggestions
        }

    def _analyze_column(self, series: pd.Series, total_rows: int) -> dict:
        """단일 컬럼 분석"""
        dtype = series.dtype
        unique_count = series.nunique()
        unique_ratio = unique_count / total_rows if total_rows > 0 else 0
        null_ratio = series.isna().sum() / total_rows if total_rows > 0 else 0

        # 유형 추론
        inferred_type, role = self._infer_type(
            series, dtype, unique_count, unique_ratio
        )

        result = {
            "name": series.name,
            "dtype": str(dtype),
            "inferred_type": inferred_type,
            "role": role,
            "unique_count": unique_count,
            "null_ratio": round(null_ratio, 3),
            "sample_values": series.dropna().head(3).tolist()
        }

        # 수치형은 통계 추가
        if inferred_type == "numeric":
            result["stats"] = {
                "min": series.min(),
                "max": series.max(),
                "mean": round(series.mean(), 2)
            }

        return result

    def _infer_type(self, series, dtype, unique_count, unique_ratio):
        """컬럼 유형 및 역할 추론"""

        # 1. 식별자 감지
        if unique_ratio > 0.95:
            return "identifier", "id_column"

        # 2. 시간형 감지
        if self._is_datetime_like(series, dtype):
            return "temporal", "time_axis_candidate"

        # 3. 수치형
        if pd.api.types.is_numeric_dtype(dtype):
            if unique_count <= 20 and unique_ratio < 0.01:
                return "categorical_numeric", "group_by_candidate"
            return "numeric", "aggregation_target"

        # 4. 문자열 분석
        if dtype == 'object':
            avg_len = series.dropna().astype(str).str.len().mean()

            if avg_len > 100:
                return "text", "content"

            if unique_ratio < 0.05:
                return "categorical", "group_by_candidate"

            return "string", "label"

        return "unknown", "unknown"

    def _is_datetime_like(self, series, dtype) -> bool:
        """시간형 데이터 감지"""
        # datetime64 타입
        if pd.api.types.is_datetime64_any_dtype(dtype):
            return True

        # 컬럼명에 시간 관련 단어
        name_lower = str(series.name).lower()
        time_keywords = ['date', 'time', '일자', '날짜', '년', '월', '일']
        if any(kw in name_lower for kw in time_keywords):
            return True

        # 문자열 패턴 검사 (샘플)
        if dtype == 'object':
            sample = series.dropna().head(5).astype(str)
            date_pattern = r'\d{4}[-/]\d{2}[-/]\d{2}'
            if sample.str.match(date_pattern).any():
                return True

        return False

    def _generate_suggestions(self, columns: list) -> list:
        """분석 가능성 자동 제안"""
        suggestions = []

        categoricals = [c for c in columns if c['role'] == 'group_by_candidate']
        numerics = [c for c in columns if c['role'] == 'aggregation_target']
        temporals = [c for c in columns if c['role'] == 'time_axis_candidate']

        # 그룹별 집계 제안
        for cat in categoricals[:3]:  # 최대 3개
            for num in numerics[:2]:  # 최대 2개
                suggestions.append(
                    f"'{cat['name']}'별 '{num['name']}' 집계 (합계/평균/개수)"
                )

        # 시계열 분석 제안
        for time in temporals[:1]:
            for num in numerics[:2]:
                suggestions.append(
                    f"'{time['name']}' 기준 '{num['name']}' 추이 분석"
                )

        # 분포 분석 제안
        for num in numerics[:2]:
            suggestions.append(
                f"'{num['name']}'의 분포/히스토그램 분석"
            )

        # 교차 분석 제안
        if len(categoricals) >= 2:
            suggestions.append(
                f"'{categoricals[0]['name']}'과 '{categoricals[1]['name']}'의 교차 분석"
            )

        return suggestions[:10]  # 최대 10개


schema_analyzer = SchemaAnalyzer()
```

### 3.2 DataFrame 캐시 서비스 (개선)

**변경 사항**: 스키마 분석 결과 포함 저장

```python
# backend/services/dataframe_cache.py

from backend.services.schema_analyzer import schema_analyzer

class DataFrameCache:
    """업로드된 엑셀 데이터를 DataFrame + 스키마로 캐싱"""

    DEFAULT_TTL = 3600
    MAX_ROWS = 100000

    def __init__(self):
        self._cache: Dict[str, CacheEntry] = {}

    def store(
        self,
        collection_name: str,
        file_content: bytes,
        filename: str
    ) -> dict:
        """
        엑셀 파일을 DataFrame으로 변환, 스키마 분석 후 캐시

        Returns:
            분석된 스키마 정보
        """
        # DataFrame 생성
        ext = filename.lower().split('.')[-1]
        if ext == 'xls':
            df = pd.read_excel(io.BytesIO(file_content), engine='xlrd')
        else:
            df = pd.read_excel(io.BytesIO(file_content), engine='openpyxl')

        # 행 수 제한 검사
        if len(df) > self.MAX_ROWS:
            raise ValueError(f"데이터가 너무 큽니다. 최대 {self.MAX_ROWS}행까지 지원합니다.")

        # 스키마 자동 분석
        schema = schema_analyzer.analyze(df)
        schema['filename'] = filename

        # 캐시 저장
        self._cache[collection_name] = {
            'dataframe': df,
            'schema': schema,
            'created_at': time.time()
        }

        return schema

    def get(self, collection_name: str) -> Optional[pd.DataFrame]:
        """캐시에서 DataFrame 조회"""
        entry = self._get_entry(collection_name)
        return entry['dataframe'] if entry else None

    def get_schema(self, collection_name: str) -> Optional[dict]:
        """캐시에서 스키마 조회"""
        entry = self._get_entry(collection_name)
        return entry['schema'] if entry else None

    def exists(self, collection_name: str) -> bool:
        """캐시 존재 여부"""
        return self._get_entry(collection_name) is not None

    def _get_entry(self, collection_name: str) -> Optional[dict]:
        """TTL 체크 포함 캐시 조회"""
        entry = self._cache.get(collection_name)
        if not entry:
            return None

        if time.time() - entry['created_at'] > self.DEFAULT_TTL:
            del self._cache[collection_name]
            return None

        return entry

    def delete(self, collection_name: str) -> bool:
        """캐시 삭제"""
        if collection_name in self._cache:
            del self._cache[collection_name]
            return True
        return False


dataframe_cache = DataFrameCache()
```

### 3.3 분석 의도 감지 (개선)

**변경 사항**: 도메인 특화 키워드 제거, 일반적 표현만 사용

```python
# backend/services/analysis_intent_detector.py

# [CRITICAL] 도메인 독립적 키워드만 사용
# "지역별", "연도별", "무선국" 같은 도메인 특화 키워드 금지!

GENERIC_ANALYSIS_KEYWORDS = {
    # 분석 행위 (도메인 무관)
    "통계", "집계", "분석", "요약", "계산", "산출", "정리",

    # 시각화 (도메인 무관)
    "그래프", "차트", "시각화", "그려", "보여", "표시",
    "막대", "파이", "선", "히스토그램", "분포", "플롯",

    # 집계 함수 (도메인 무관)
    "몇 개", "얼마", "개수", "수", "합계", "총",
    "평균", "최대", "최소", "비율", "%", "퍼센트",
    "카운트", "count", "sum", "avg", "mean",

    # 그룹화 표현 (도메인 무관)
    "별로", "별", "기준", "따라", "구분", "나눠",
    "그룹", "분류", "카테고리", "유형", "종류",

    # 순위/비교 (도메인 무관)
    "순위", "랭킹", "상위", "하위", "top", "많은", "적은",
    "가장", "제일", "비교",

    # 추이/변화 (도메인 무관)
    "추이", "변화", "증가", "감소", "트렌드", "추세",
    "시간", "기간", "월별", "연별", "일별",
}


def might_be_analysis_request(message: str, has_dataframe: bool) -> bool:
    """
    분석 요청 가능성 판단 (도메인 독립적)

    Args:
        message: 사용자 메시지
        has_dataframe: DataFrame 캐시 존재 여부

    Returns:
        분석 도구 활성화 여부
    """
    if not has_dataframe:
        return False

    message_lower = message.lower()
    matches = sum(1 for kw in GENERIC_ANALYSIS_KEYWORDS if kw in message_lower)

    return matches >= 2
```

### 3.4 시스템 프롬프트 (개선)

**변경 사항**: 하드코딩된 컬럼명 제거, 동적 스키마 주입

**파일**: `backend/prompts/data_analysis.md`

```markdown
## 데이터 분석 모드

업로드된 엑셀 파일에 대해 통계 분석을 수행할 수 있습니다.

---

### 현재 데이터 정보

**파일**: {filename}
**행 수**: {row_count}

### 컬럼 상세 정보

{column_table}

### 이 데이터로 가능한 분석

{suggested_analyses}

---

### 코드 작성 규칙

1. **컬럼명은 위 '컬럼 상세 정보' 테이블의 정확한 이름을 사용하세요**
2. 결과 테이블은 `result_table` 변수에 DataFrame으로 저장
3. 차트는 `plt.figure()`로 생성 (한글 폰트 자동 설정됨)
4. `print()` 대신 변수에 결과 저장

### 코드 패턴 (컬럼명은 실제 데이터에 맞게 변경)

**그룹별 집계**:
```python
# [그룹화할 컬럼]과 [집계할 컬럼]을 위 테이블에서 선택하여 사용
group_col = '[그룹화할 컬럼명]'  # role이 group_by_candidate인 컬럼
agg_col = '[집계할 컬럼명]'      # role이 aggregation_target인 컬럼

result_table = df.groupby(group_col)[agg_col].count().reset_index()
result_table.columns = [group_col, '개수']
result_table = result_table.sort_values('개수', ascending=False)
```

**막대그래프**:
```python
plt.figure(figsize=(12, 6))
plt.bar(result_table['[X축 컬럼]'], result_table['[Y축 컬럼]'])
plt.title('[적절한 제목]')
plt.xlabel('[X축 레이블]')
plt.ylabel('[Y축 레이블]')
plt.xticks(rotation=45, ha='right')
plt.tight_layout()
```

**파이차트**:
```python
plt.figure(figsize=(10, 10))
plt.pie(
    result_table['[값 컬럼]'],
    labels=result_table['[레이블 컬럼]'],
    autopct='%1.1f%%'
)
plt.title('[적절한 제목]')
```

**시계열 분석**:
```python
# [시간 컬럼]은 role이 time_axis_candidate인 컬럼
time_col = '[시간 컬럼명]'
value_col = '[값 컬럼명]'

result_table = df.groupby(time_col)[value_col].sum().reset_index()
result_table = result_table.sort_values(time_col)

plt.figure(figsize=(14, 6))
plt.plot(result_table[time_col], result_table[value_col], marker='o')
plt.title('[적절한 제목]')
plt.xticks(rotation=45, ha='right')
plt.tight_layout()
```

### 주의사항

- **컬럼명을 추측하지 마세요** - 반드시 위 스키마에 있는 정확한 이름 사용
- **존재하지 않는 컬럼 참조 금지** - 에러 발생
- 복잡한 분석보다 단순하고 명확한 코드 선호
```

**프롬프트 동적 생성 함수**:

```python
# backend/services/prompt_builder.py

def build_analysis_prompt(schema: dict) -> str:
    """스키마 기반 분석 프롬프트 동적 생성"""

    # 컬럼 테이블 생성
    column_rows = []
    for col in schema['columns']:
        samples = ', '.join(str(v) for v in col['sample_values'][:3])
        column_rows.append(
            f"| {col['name']} | {col['dtype']} | {col['inferred_type']} | "
            f"{col['role']} | {col['unique_count']} | {samples} |"
        )

    column_table = """| 컬럼명 | 데이터타입 | 추론유형 | 역할 | 고유값수 | 샘플값 |
|--------|-----------|---------|------|---------|--------|
""" + '\n'.join(column_rows)

    # 분석 제안 목록
    suggestions = '\n'.join(
        f"- {s}" for s in schema.get('suggested_analyses', [])
    )

    # 템플릿 로드 및 치환
    template = load_prompt_template('data_analysis.md')

    return template.format(
        filename=schema.get('filename', 'unknown'),
        row_count=schema.get('row_count', 0),
        column_table=column_table,
        suggested_analyses=suggestions or '(자동 제안 없음)'
    )
```

### 3.5 코드 검증기

**(기존과 동일 - 변경 없음)**

### 3.6 코드 실행기

**(기존과 동일 - 변경 없음)**

### 3.7 Function Calling 도구 정의

**(기존과 동일 - 변경 없음)**

---

## 4. 에러 처리

### 4.1 에러 시나리오 및 처리

| 시나리오 | 원인 | 처리 방법 |
|---------|------|----------|
| 코드 검증 실패 | 위험한 코드 감지 | 사용자에게 안내, 재시도 없음 |
| 구문 오류 | LLM 코드 생성 오류 | 에러 메시지로 재생성 요청 (1회) |
| **컬럼 없음 오류** | LLM이 잘못된 컬럼명 사용 | 스키마 재확인 후 재생성 (1회) |
| 타임아웃 | 복잡한 연산 | 간단한 방법 제안 |
| 데이터 없음 | 캐시 만료 | 파일 재업로드 안내 |

### 4.2 컬럼 오류 복구 로직

```python
async def handle_column_error(error: str, schema: dict) -> str:
    """
    컬럼 오류 발생 시 LLM에 전달할 수정 요청 메시지 생성
    """
    available_columns = [col['name'] for col in schema['columns']]

    return f"""코드 실행 중 오류가 발생했습니다.

오류: {error}

**사용 가능한 컬럼 목록**:
{', '.join(available_columns)}

위 컬럼명만 사용하여 코드를 수정해주세요.
"""
```

### 4.3 사용자 피드백 (개선)

**실패 시 (동적 컬럼 목록 표시)**:
```
죄송합니다. 요청하신 분석을 수행하지 못했습니다.

오류: KeyError - '지역' 컬럼을 찾을 수 없습니다

**현재 데이터의 컬럼 목록:**
- 지역명 (categorical, 그룹화 가능)
- 국종코드 (categorical_numeric, 그룹화 가능)
- 주파수 (numeric, 집계 가능)
- ...

"지역명별 통계"로 다시 질문해 보시겠어요?
```

---

## 5. 보안 고려사항

**(기존과 동일)**

---

## 6. 프론트엔드 변경

### 6.1 업로드 완료 시 스키마 요약 표시 (신규)

**파일**: `app/chat/components/InputArea.tsx`

```typescript
// 엑셀 업로드 완료 시 스키마 요약 표시
{uploadStatus?.stage === 'ready' && uploadedSchema && (
  <div className="text-xs text-muted-foreground mt-2">
    <p>
      <strong>{uploadedSchema.filename}</strong> 분석 완료
      ({uploadedSchema.row_count}행, {uploadedSchema.columns.length}개 컬럼)
    </p>
    <p className="mt-1">가능한 분석:</p>
    <ul className="list-disc list-inside">
      {uploadedSchema.suggested_analyses.slice(0, 3).map((s, i) => (
        <li key={i}>{s}</li>
      ))}
    </ul>
  </div>
)}
```

### 6.2 차트 이미지 렌더링

**(기존과 동일)**

### 6.3 분석 중 상태 표시

**(기존과 동일)**

---

## 7. 구현 계획

### 7.1 단계별 작업 (개선)

| 단계 | 작업 | 파일 | 예상 시간 |
|-----|------|------|----------|
| **1** | **스키마 분석기** | `backend/services/schema_analyzer.py` | **3시간** |
| 2 | DataFrame 캐시 서비스 (스키마 연동) | `backend/services/dataframe_cache.py` | 2시간 |
| 3 | 코드 검증기 | `backend/services/code_validator.py` | 2시간 |
| 4 | 코드 실행기 | `backend/services/code_executor.py` | 3시간 |
| **5** | **분석 의도 감지 (도메인 독립적)** | `backend/services/analysis_intent_detector.py` | **1시간** |
| 6 | 도구 정의 추가 | `backend/services/tool_definitions.py` | 1시간 |
| **7** | **프롬프트 동적 생성기** | `backend/services/prompt_builder.py` | **2시간** |
| 8 | document_processor 수정 | 엑셀 업로드 시 스키마 분석 | 1시간 |
| 9 | temp_collection_manager 수정 | 캐시 동기화 | 1시간 |
| 10 | chat.py 통합 | 도구 핸들러, 동적 프롬프트 | 2시간 |
| 11 | 프론트엔드 수정 | 스키마 표시, 이미지 렌더링 | 2시간 |
| **12** | **다양한 데이터 유형 테스트** | 5종 이상 엑셀 테스트 | **4시간** |

**총 예상 시간**: 24시간

### 7.2 의존성 순서 (개선)

```
schema_analyzer (1)
       ↓
dataframe_cache (2) ← schema_analyzer 사용
       ↓
code_validator (3)
       ↓
code_executor (4)
       ↓
analysis_intent_detector (5)
       ↓
tool_definitions (6)
       ↓
prompt_builder (7) ← schema 기반 동적 생성
       ↓
document_processor 수정 (8)
       ↓
temp_collection_manager 수정 (9)
       ↓
chat.py 통합 (10)
       ↓
프론트엔드 (11)
       ↓
다양한 데이터 테스트 (12)
```

### 7.3 테스트 체크포인트 (개선)

| 단계 | 테스트 항목 |
|-----|-----------|
| 1 완료 후 | **스키마 추론 정확도 테스트** (5종 이상 데이터) |
| 4 완료 후 | 코드 검증/실행 단위 테스트 |
| 8 완료 후 | 통합 테스트: 엑셀 업로드 → 스키마 분석 → 캐시 |
| 10 완료 후 | E2E 테스트: 전체 분석 플로우 |
| **12** | **다양한 데이터 유형 E2E 테스트** |

---

## 8. 테스트 요구사항 (신규 섹션)

### 8.1 스키마 추론 테스트 데이터

| 테스트 ID | 데이터 유형 | 검증 항목 |
|----------|------------|----------|
| T1 | 판매 데이터 (상품, 수량, 금액, 날짜) | 시간형 컬럼 감지, 수치형 집계 |
| T2 | 인사 데이터 (부서, 직급, 연봉) | 범주형 컬럼 감지, 그룹화 제안 |
| T3 | 설문 데이터 (응답자, 항목1~10) | 다수 수치형 컬럼 처리 |
| T4 | 로그 데이터 (시간, IP, 상태코드) | 코드값(categorical_numeric) 감지 |
| T5 | 통신 데이터 (지역, 국종코드, 주파수) | 한글 컬럼명, 혼합 데이터 |

### 8.2 스키마 추론 정확도 기준

| 항목 | 목표 정확도 |
|-----|-----------|
| 범주형 컬럼 감지 | 90% 이상 |
| 수치형 컬럼 감지 | 95% 이상 |
| 시간형 컬럼 감지 | 85% 이상 |
| 분석 제안 적절성 | 80% 이상 |

### 8.3 LLM 코드 생성 테스트

| 테스트 ID | 요청 | 검증 항목 |
|----------|------|----------|
| C1 | "카테고리별 판매 수량 집계" | 올바른 컬럼 선택 |
| C2 | "월별 매출 추이 그래프" | 시간형 컬럼 사용 |
| C3 | "상위 10개 상품" | Top-N 분석 |
| C4 | "부서와 직급의 교차 분석" | 2개 범주형 컬럼 |
| C5 | "응답 항목별 평균 점수" | 다중 컬럼 집계 |

---

## 9. 위험 평가 및 대안

### 9.1 위험 요소 (개선)

| 위험 | 심각도 | 가능성 | 완화 방안 |
|-----|-------|-------|----------|
| LLM 코드 생성 품질 | 중 | 높음 | **상세 스키마 제공**, 재시도 로직 |
| **스키마 추론 오류** | 중 | 중간 | **휴리스틱 개선**, 사용자 확인 |
| 보안 취약점 | 높음 | 낮음 | 다층 검증 |
| 메모리 과다 사용 | 중 | 중간 | 크기 제한, 타임아웃 |
| 한글 차트 깨짐 | 낮음 | 중간 | 폰트 자동 설정 |

### 9.2 플랜 B (대안)

LLM 코드 생성 성공률이 70% 미만일 경우:

**스키마 기반 동적 템플릿 방식**:
- LLM은 분석 유형과 컬럼만 선택
- 코드는 템플릿에서 동적 생성

```python
# 템플릿도 하드코딩 없이 동적 생성
def generate_group_by_code(group_col: str, agg_col: str, agg_func: str) -> str:
    return f"""
result_table = df.groupby('{group_col}')['{agg_col}'].{agg_func}().reset_index()
result_table.columns = ['{group_col}', '{agg_func}']
result_table = result_table.sort_values('{agg_func}', ascending=False)
"""
```

### 9.3 모니터링 지표

- 스키마 추론 정확도
- 코드 생성 성공률
- 코드 실행 성공률
- 재시도 비율
- 데이터 유형별 성공률

---

## 10. 변경 이력

| 버전 | 날짜 | 변경 내용 |
|-----|------|----------|
| 1.0 | 2026-02-02 | 초안 작성, Sequential Thinking 검증 완료 |
| **2.0** | **2026-02-02** | **다양한 엑셀 데이터 지원 요구사항 반영** |
| | | - 스키마 분석기 컴포넌트 추가 |
| | | - 도메인 독립적 키워드로 의도 감지 개선 |
| | | - 시스템 프롬프트 동적 생성 방식 변경 |
| | | - 하드코딩 금지 원칙 섹션 추가 |
| | | - 다양한 데이터 유형 테스트 요구사항 추가 |
