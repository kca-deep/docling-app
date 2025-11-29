# AI 챗봇 로그 수집 및 대화 히스토리 구현 가이드

## 1. 개요 및 목표

### 1.1 프로젝트 배경
- **현재 상황**: RAG 기반 챗봇이 운영 중이나 사용 패턴 파악 불가
- **문제점**: 로그 수집 체계 부재, 대화 히스토리 미저장, 서비스 개선 근거 부족
- **해결책**: 컬렉션별 로그 수집 및 Claude/ChatGPT 스타일 대화 저장 시스템 구축

### 1.2 목표
- 컬렉션별 상세 사용 통계 수집 및 분석
- 사용자별 대화 히스토리 서버 측 저장 (비공개)
- 최소 인프라 부담으로 데이터 기반 서비스 개선

### 1.3 기대효과
- 사용 패턴 기반 서비스 최적화
- FAQ 자동 생성 및 프롬프트 개선
- 검색 품질 지속적 모니터링 및 향상
- 데이터 기반 의사결정 지원

## 2. 시스템 아키텍처

### 2.1 전체 구조
```
[API Layer]
├── /api/chat/
├── /api/chat/stream
└── /api/chat/regenerate
        ↓
[Logging Service]
├── Async Queue (asyncio.Queue)
└── Batch Processor
        ↓
[Hybrid Storage Layer]
├── SQLite (Metadata & Statistics)
│   ├── chat_sessions
│   └── chat_statistics
└── JSON Files (Logs & Conversations)
    ├── ./logs/data/{date}.jsonl
    └── ./logs/conversations/{date}.jsonl
        ↓
[Analytics Layer]
├── Statistics Service
├── Conversation Analyzer
└── Report Generator
        ↓
[Frontend Dashboard]
├── /analytics (통계)
└── /admin/conversations (관리자 전용)
```

### 2.2 기존 시스템 활용
- **FastAPI BackgroundTasks**: 비동기 로깅
- **SQLAlchemy**: 데이터베이스 모델
- **기존 서비스 패턴**: Service-Repository 레이어
- **Next.js**: 대시보드 UI

### 2.3 하이브리드 저장 전략
**SQLite 한계 대응**
- SQLite는 메타데이터와 통계만 저장 (가벼운 데이터)
- 실제 로그와 대화는 JSONL 파일로 저장 (병렬 쓰기 가능)
- 일별 파일 분할로 관리 용이성 확보
- pandas로 분석시 빠른 로딩 가능
- **[업데이트]** 7일 이상 경과한 파일은 자동 gzip 압축
- **[업데이트]** 압축된 파일도 투명하게 읽기 지원

## 3. 데이터 모델링

### 3.1 로그 데이터 스키마
```json
{
  "log_id": "uuid",
  "session_id": "uuid",
  "collection_name": "string",
  "message_type": "user|assistant",
  "message_content": "string",
  "reasoning_level": "low|medium|high",
  "llm_model": "string",
  "llm_params": {
    "temperature": 0.7,
    "max_tokens": 2000,
    "top_p": 0.9
  },
  "retrieval_info": {
    "query": "string",
    "retrieved_count": 5,
    "reranking_used": true,
    "top_scores": [0.89, 0.85, 0.82]
  },
  "performance": {
    "response_time_ms": 1234,
    "token_count": 512,
    "retrieval_time_ms": 234
  },
  "created_at": "datetime"
}
```

### 3.2 대화 히스토리 스키마 (JSONL 파일 저장)
```json
{
  "conversation_id": "uuid",
  "collection_name": "string",
  "user_hash": "sha256_hash",
  "messages": [
    {
      "role": "user|assistant",
      "content": "string",
      "retrieved_docs": "array",
      "timestamp": "datetime"
    }
  ],
  "metadata": {
    "total_turns": 5,
    "is_sampled": true,
    "retention_priority": "high|medium|low",
    "summary": "string"
  }
}
```

### 3.3 통계 집계 스키마
```json
{
  "stat_id": "uuid",
  "collection_name": "string",
  "date": "date",
  "hour": "int",
  "metrics": {
    "total_queries": 100,
    "unique_sessions": 25,
    "avg_response_time": 1.5,
    "total_tokens": 50000,
    "error_count": 2,
    "regeneration_count": 5
  },
  "top_queries": ["질문1", "질문2"],
  "performance_percentiles": {
    "p50": 1.2,
    "p95": 2.5,
    "p99": 4.0
  }
}
```

## 4. 구현 단계별 가이드

### 4.1 Phase 1: 하이브리드 로깅 인프라 (3일)

#### 작업 내용
1. SQLAlchemy 모델 생성 (메타데이터용)
2. JSONL 파일 로깅 서비스 구현
3. API 엔드포인트 수정

#### 핵심 코드
```python
# backend/models/chat_session.py
class ChatSession(Base):
    __tablename__ = "chat_sessions"

    session_id = Column(String, primary_key=True)
    collection_name = Column(String, index=True)
    started_at = Column(DateTime, default=datetime.utcnow)
    message_count = Column(Integer, default=0)

# backend/services/hybrid_logging_service.py
class HybridLoggingService:
    def __init__(self):
        self.queue = asyncio.Queue(maxsize=100)
        self.batch_size = 20
        self.log_dir = "./logs/data"

    async def log_async(self, log_data: dict):
        """비동기 로그 추가"""
        await self.queue.put(log_data)

    async def process_batch(self):
        """배치 처리 - JSONL 파일에 저장"""
        batch = []
        while len(batch) < self.batch_size:
            try:
                item = await asyncio.wait_for(
                    self.queue.get(),
                    timeout=5.0
                )
                batch.append(item)
            except asyncio.TimeoutError:
                break

        if batch:
            await self._save_to_jsonl(batch)

    async def _save_to_jsonl(self, batch):
        """일별 JSONL 파일에 추가"""
        date_str = datetime.now().strftime("%Y-%m-%d")
        file_path = f"{self.log_dir}/{date_str}.jsonl"

        async with aiofiles.open(file_path, 'a') as f:
            for item in batch:
                await f.write(json.dumps(item) + '\n')
```

### 4.2 Phase 2: 대화 히스토리 시스템 (3일)

#### 작업 내용
1. 대화 저장 서비스 구현
2. 스마트 샘플링 로직
3. conversation_id 관리

#### 스마트 샘플링 규칙 **[업데이트됨]**
```python
# backend/services/conversation_service.py
class ConversationService:
    def __init__(self):
        # 환경변수에서 설정 로드
        self.sample_rate = settings.CONVERSATION_SAMPLE_RATE  # 기본값: 1.0 (100% 저장)
        self.retention_days = settings.CONVERSATION_RETENTION_DAYS
        self.compress_after_days = settings.CONVERSATION_COMPRESS_AFTER_DAYS

        self.SAMPLING_RULES = {
            "always_save": [
                lambda c: c.has_error,
                lambda c: c.has_regeneration,
                lambda c: c.turn_count >= 5,
                lambda c: c.min_score < 0.5
            ],
            "sample_rate": self.sample_rate  # 환경변수로 제어 (1.0 = 100% 저장)
        }

        self.conv_dir = "./logs/conversations"

    async def should_save(self, conversation):
        """저장 여부 결정"""
        # 우선순위 규칙 체크
        for rule in self.SAMPLING_RULES["always_save"]:
            if rule(conversation):
                return True

        # 무작위 샘플링
        return random.random() < self.SAMPLING_RULES["sample_rate"]

    async def save_conversation(self, conversation_data):
        """대화를 JSONL 파일로 저장"""
        date_str = datetime.now().strftime("%Y-%m-%d")
        file_path = f"{self.conv_dir}/{date_str}.jsonl"

        async with aiofiles.open(file_path, 'a') as f:
            await f.write(json.dumps(conversation_data) + '\n')
```

### 4.3 Phase 3: 통계 집계 시스템 (2일)

#### 작업 내용
1. 집계 테이블 및 서비스
2. 일일 배치 작업 설정
3. pandas 기반 분석

#### 집계 로직
```python
# backend/services/statistics_service.py
import pandas as pd

class StatisticsService:
    async def aggregate_daily_stats(self, date: datetime.date):
        """일별 통계 집계 - JSONL 파일 기반"""
        # JSONL 파일 읽기
        file_path = f"./logs/data/{date.isoformat()}.jsonl"
        df = pd.read_json(file_path, lines=True)

        # 통계 계산
        stats = {
            "date": date,
            "total_queries": len(df),
            "unique_sessions": df['session_id'].nunique(),
            "avg_response_time": df['response_time_ms'].mean(),
            "p95_response_time": df['response_time_ms'].quantile(0.95),
            "collections": df.groupby('collection_name').size().to_dict()
        }

        # SQLite에 통계만 저장
        await self._save_statistics(stats)

    async def query_logs_by_date_range(self, start_date, end_date):
        """날짜 범위로 로그 조회"""
        dfs = []
        current_date = start_date

        while current_date <= end_date:
            file_path = f"./logs/data/{current_date.isoformat()}.jsonl"
            if os.path.exists(file_path):
                df = pd.read_json(file_path, lines=True)
                dfs.append(df)
            current_date += timedelta(days=1)

        return pd.concat(dfs) if dfs else pd.DataFrame()
```

### 4.4 Phase 4: API 엔드포인트 확장 (2일)

#### 새 엔드포인트 추가
```python
# backend/api/routes/analytics.py
@router.get("/api/analytics/summary")
async def get_analytics_summary(
    collection_name: Optional[str] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    db: Session = Depends(get_db)
):
    """컬렉션별 통계 요약"""
    stats = await statistics_service.get_summary(
        collection_name, date_from, date_to, db
    )
    return stats

@router.get("/api/analytics/timeline")
async def get_timeline_data(
    collection_name: str,
    period: str = "daily",  # daily, hourly
    days: int = 7
):
    """시계열 데이터 조회"""
    data = await statistics_service.get_timeline(
        collection_name, period, days
    )
    return data

# 기존 chat 엔드포인트 수정
@router.post("/api/chat/")
async def chat(
    request: ChatRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    # conversation_id 처리
    if not request.conversation_id:
        request.conversation_id = str(uuid.uuid4())

    # 기존 RAG 처리
    response = await rag_service.generate_response(...)

    # 백그라운드 로깅
    background_tasks.add_task(
        log_chat_interaction,
        request, response
    )

    # conversation_id 포함하여 응답
    response.conversation_id = request.conversation_id
    return response
```

## 5. 저장 최적화 전략

### 5.1 하이브리드 저장 정책
```yaml
storage_strategy:
  metadata:  # 세션 정보, 통계
    location: SQLite
    purpose: 빠른 조회, 인덱싱
    size: 최소 (ID, 타임스탬프 등)

  logs:  # 실제 로그 데이터
    location: JSONL Files
    organization: 일별 파일 분할
    benefits: 병렬 쓰기, 백업 용이

  conversations:  # 대화 내역
    location: JSONL Files
    sampling: 20% 샘플링 + 중요 대화
    retention: 30일 후 자동 삭제
```

### 5.2 스토리지 예상 사용량 **[업데이트됨]**

#### 100% 저장 시 (CONVERSATION_SAMPLE_RATE=1.0)
- **일일**: 대화당 10KB × 100개 = 1MB
- **월간**: 30MB
- **연간**: 360MB
- **3년 운영**: ~1.1GB (1TB 여유 공간의 0.1%)

#### 압축 적용 시 (7일 후 gzip 압축, 압축률 70%)
- **일일**: 1MB (최근 7일은 비압축)
- **월간**: 7MB (비압축) + 6.9MB (압축) = 13.9MB
- **연간**: 7MB (비압축) + 100MB (압축) = 107MB
- **3년 운영**: ~330MB (압축 효과로 70% 절감)

#### 20% 샘플링 시 (CONVERSATION_SAMPLE_RATE=0.2)
- **일일**: 0.2MB
- **월간**: 6MB
- **연간**: 72MB
- **3년 운영**: ~220MB

## 6. 성능 최적화

### 6.1 비동기 처리
```python
# 메모리 버퍼링
buffer_config = {
    "max_size": 100,
    "flush_interval": 5,  # seconds
    "batch_size": 20
}

# 인덱스 최적화
index_strategy = {
    "chat_logs": ["collection_name", "created_at"],
    "conversations": ["conversation_id", "collection_name"],
    "statistics": ["collection_name", "date"]
}
```

### 6.2 SQLite 최적화 (메타데이터 전용)
```sql
-- WAL 모드 활성화 (동시성 개선)
PRAGMA journal_mode = WAL;

-- 쓰기 성능 향상
PRAGMA synchronous = NORMAL;

-- 캐시 크기 증가
PRAGMA cache_size = -128000;  -- 128MB

-- 메모리 매핑
PRAGMA mmap_size = 10737418240;  -- 10GB

-- 임시 테이블 메모리 사용
PRAGMA temp_store = MEMORY;
```

### 6.3 JSONL 파일 처리 최적화
```python
# pandas 활용 빠른 분석
def analyze_logs(date_range):
    # 병렬 파일 읽기
    with ThreadPoolExecutor() as executor:
        dfs = executor.map(pd.read_json, file_paths, lines=True)

    # 메모리 효율적 처리
    return pd.concat(dfs, ignore_index=True)
```

## 7. 모니터링 및 운영

### 7.1 핵심 지표
- **사용 지표**: 컬렉션별 쿼리 수, 고유 세션 수, 인기 검색어
- **성능 지표**: 응답 시간 (p50, p95, p99), 에러율, 토큰 사용량
- **품질 지표**: 재생성 비율, 검색 스코어 분포, 세션 길이

### 7.2 대시보드 구성
```typescript
// app/analytics/page.tsx
const AnalyticsDashboard = () => {
  return (
    <div className="grid grid-cols-3 gap-4">
      <MetricCard title="일일 쿼리" value={dailyQueries} />
      <MetricCard title="평균 응답시간" value={avgResponseTime} />
      <MetricCard title="활성 사용자" value={activeUsers} />

      <TimelineChart data={timelineData} />
      <TopQueriesTable data={topQueries} />
      <CollectionUsageChart data={collectionUsage} />
    </div>
  );
};
```

## 8. 구현 체크리스트

### Phase 1: 하이브리드 로깅 인프라 (Week 1) ✓
- [x] SQLAlchemy 모델 생성 (chat_sessions, chat_statistics)
- [x] HybridLoggingService 클래스 구현
- [x] JSONL 파일 저장 구조 생성 (./logs/data/)
- [x] 비동기 큐 및 배치 처리 구현
- [x] chat.py 라우터 수정 (BackgroundTasks 추가)
- [x] SQLite 최적화 설정 적용

### Phase 2: 대화 히스토리 (Week 1) ✓
- [x] JSONL 파일 저장 구조 설계
- [x] ConversationService 구현 (샘플링)
- [x] conversation_id 생성 및 관리
- [x] 스마트 샘플링 규칙 구현
- [x] 개인정보 해싱 처리

### Phase 3: 통계 집계 (Week 2) ✓
- [x] chat_statistics 모델 생성 (SQLite)
- [x] StatisticsService 구현 (pandas 기반)
- [x] 일일 집계 배치 작업 설정
- [x] JSONL 파일 분석 로직 구현
- [x] 30일 이상 파일 자동 정리

### Phase 4: API 개발 (Week 2) ✓
- [x] /api/analytics/* 엔드포인트 구현
- [x] 통계 조회 API
- [x] 관리자용 대화 조회 API (인증 포함)
- [x] 기존 chat API에 conversation_id 추가
- [ ] API 문서 업데이트

### Phase 5: 대시보드 (Week 3) ✓
- [x] /analytics 페이지 생성
- [x] 차트 컴포넌트 개발 (recharts)
- [x] 실시간 통계 표시
- [x] 필터링 및 날짜 선택 기능
- [ ] 관리자 페이지 (숨김)

### Phase 6: 데이터 활용 (Week 4) ✓
- [ ] FAQ 자동 생성 스크립트
- [ ] 검색 품질 분석 도구
- [ ] 대화 요약 생성
- [ ] 프롬프트 개선 제안
- [ ] 리포트 생성 기능

### Phase 7: 테스트 및 최적화 (Week 4) ✓
- [ ] 단위 테스트 작성
- [ ] 성능 테스트 (부하 테스트)
- [ ] SQLite 최적화 적용
- [ ] 캐싱 전략 구현
- [ ] 모니터링 설정

### Phase 8: 배포 및 운영 전환 (Week 5) ✓
- [ ] 환경 변수 설정
- [ ] 배포 스크립트 작성
- [ ] 초기 데이터 마이그레이션
- [ ] 모니터링 대시보드 설정
- [ ] 운영 문서 작성

## 9. 리스크 및 대응 방안

### 9.1 기술적 리스크
- **SQLite 성능 한계**: 메타데이터 증가시 성능 저하
  - 대응: 하이브리드 저장으로 SQLite 부담 최소화 (메타데이터만 저장)
  - 추가 대응: 필요시 PostgreSQL로 점진적 마이그레이션

- **파일 시스템 한계**: 대량 JSONL 파일 관리
  - 대응: 일별 파일 분할, 월별 디렉토리 구조
  - 추가 대응: 30일 이상 파일 자동 아카이빙

- **메모리 버퍼 오버플로우**: 큐 사이즈 초과
  - 대응: Circuit breaker 패턴, 임시 파일 스풀링

### 9.2 운영 리스크
- **개인정보 보호**: GDPR/개인정보보호법 준수
  - 대응: 자동 삭제 정책, 해싱, 사용자 동의

- **스토리지 증가**: 예상보다 빠른 용량 증가
  - 대응: 샘플링 비율 조정, 요약 전환 가속화

- **데이터 품질**: 불완전한 로그 데이터
  - 대응: 데이터 검증, 무결성 체크

## 10. 타임라인

```
Week 1: 기본 로깅 + 대화 히스토리 구현
  Day 1-2: 데이터베이스 모델 및 서비스 구현
  Day 3-4: API 수정 및 비동기 처리
  Day 5: 테스트 및 디버깅

Week 2: 통계 집계 + API 개발
  Day 1-2: 집계 로직 및 배치 작업
  Day 3-4: Analytics API 구현
  Day 5: 통합 테스트

Week 3: 대시보드 개발
  Day 1-2: 프론트엔드 페이지 구조
  Day 3-4: 차트 컴포넌트 구현
  Day 5: UI/UX 개선

Week 4: 데이터 활용 + 최적화
  Day 1-2: 분석 스크립트 개발
  Day 3-4: 성능 최적화
  Day 5: 문서화

Week 5: 배포 및 안정화
  Day 1: Staging 환경 테스트
  Day 2-3: Production 배포 (단계적)
  Day 4-5: 모니터링 및 미세 조정
```

## 11. 참고사항

### 11.1 기존 시스템 호환성
- 기존 `/api/chat` 엔드포인트 완전 호환
- 점진적 마이그레이션 지원
- 로깅 실패시 서비스 영향 없음

### 11.2 확장 가능성
- PostgreSQL 마이그레이션 경로 확보
- 실시간 분석 (Apache Kafka) 준비
- ML 기반 품질 평가 시스템 연동 가능

### 11.3 운영 고려사항
- 백업: 일일 SQLite 파일 백업 + 아카이브 별도 보관
- 복구: Point-in-time recovery 지원
- 모니터링: Grafana 대시보드 템플릿 제공
- 알림: 이상 패턴 자동 감지 및 알림

### 11.4 예상 리소스 사용량
```yaml
storage:
  daily: ~1MB (샘플링 적용, 압축 없음)
  monthly: ~30MB (샘플링 적용시 6MB)
  yearly: ~360MB (샘플링 적용시 72MB)
  3_years: ~1.1GB (1TB 여유 공간의 0.1%)

memory:
  buffer: ~1MB
  cache: ~5MB
  pandas_processing: ~50MB (분석시)
  total: ~10MB (평상시)

cpu:
  logging: <0.5% average
  aggregation: 2% peak (daily batch)
  file_io: <1% average

benefits:
  - SQLite 부담 최소화 (메타데이터만)
  - 병렬 쓰기 가능 (파일 기반)
  - 백업/복구 간단 (파일 복사)
  - 분석 성능 향상 (pandas 최적화)
```

## 12. 핵심 변경사항 요약

### 하이브리드 저장 전략 채택
- **SQLite**: 메타데이터와 통계만 저장 (부담 최소화)
- **JSONL 파일**: 실제 로그와 대화 내역 저장 (병렬 처리 가능)
- **압축 제거**: 1TB 여유 공간 활용, CPU 부담 제거
- **pandas 활용**: 빠른 분석과 집계

### 주요 이점
1. SQLite 병목 현상 회피
2. 백업 및 복구 간단 (파일 복사)
3. 병렬 쓰기로 성능 향상
4. 유연한 데이터 관리 (일별 파일)

---

**문서 버전**: 1.2.0
**작성일**: 2024-11-29
**수정일**: 2024-11-29
**변경내용**:
- v1.1.0: SQLite 대안 및 하이브리드 저장 전략 반영
- v1.2.0: 100% 저장 정책 및 자동 압축 기능 추가
  - 환경변수 기반 샘플링 비율 제어 (CONVERSATION_SAMPLE_RATE)
  - 7일 이상 파일 자동 gzip 압축 (CONVERSATION_COMPRESS_AFTER_DAYS)
  - 압축 파일 투명한 읽기 지원
**담당**: AI 챗봇 개발팀
**참조 문서**: integrated-rag-implementation.md