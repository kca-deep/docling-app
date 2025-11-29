# 통합 RAG 기반 AI 챗봇 구현 가이드

## 1. 개요 및 목표

### 1.1 프로젝트 배경
- **현재 상황**: FAQ 102개와 기금 규정 1,247개 조항이 분리되어 관리
- **문제점**: FAQ의 근거 규정 연결 수동 관리, 통합 검색 불가
- **해결책**: `policy_anchor` 필드를 활용한 자동 연결 및 통합 검색 시스템

### 1.2 목표
- FAQ와 규정을 연결한 통합 지식베이스 구축
- 사용자 질문에 FAQ 답변과 근거 규정을 동시 제공
- 기존 인프라 활용하여 최소 변경으로 구현

### 1.3 기대효과
- 답변 신뢰도 향상 (근거 규정 자동 제시)
- 검색 정확도 개선 (관계 기반 확장 검색)
- 운영 효율성 증대 (자동 연결 관리)

## 2. 시스템 아키텍처

### 2.1 전체 구조
```
[데이터 소스]
├── fund_regu.xlsx (14개 시트, 1,247개 조항)
└── faq_topic.xlsx (102개 FAQ)
        ↓
[전처리 파이프라인]
├── Excel Parser
├── Relationship Mapper (policy_anchor 파싱)
└── Document Enricher
        ↓
[벡터 DB (Qdrant)]
└── Collection: fund_knowledge_base
    ├── FAQ Documents
    └── Regulation Documents
        ↓
[검색 파이프라인]
├── Query Processor
├── Hybrid Search (Vector + Keyword)
├── Relationship Expander
└── Reranker (BGE Reranker v2-m3)
        ↓
[응답 생성]
└── LLM (GPT-OSS 20B / EXAONE 32B)
```

### 2.2 기존 시스템 활용
- **Docling Serve**: 문서 파싱 (필요시 PDF 변환용)
- **BGE-M3**: 임베딩 생성 (1024차원)
- **Qdrant**: 벡터 저장 및 검색
- **BGE Reranker**: 검색 결과 재정렬
- **기존 LLM 인프라**: 응답 생성

## 3. 데이터 모델링

### 3.1 통합 문서 스키마
```json
{
  "id": "string",  // FAQ-xxx 또는 REG-xxx
  "doc_type": "faq|regulation",
  "content": "string",  // 검색/임베딩용 통합 텍스트
  "metadata": {
    // FAQ 전용 필드
    "faq_id": "string",
    "question": "string",
    "answer": "string",
    "policy_anchor": "string",

    // 규정 전용 필드
    "law_title": "string",
    "article_number": "string",
    "article_title": "string",
    "chapter": "string",

    // 공통 필드
    "tags": ["string"],
    "last_updated": "datetime",
    "is_active": "boolean"
  },
  "relationships": {
    "references": ["doc_id"],  // 이 문서가 참조하는 문서들
    "referenced_by": ["doc_id"]  // 이 문서를 참조하는 문서들
  }
}
```

### 3.2 관계 매핑 규칙
```python
# Policy Anchor 파싱 패턴
patterns = {
    "regulation": r'「([^」]+)」\s*(제\d+조|별표\s*\d+|\[별지[^]]+\])',
    "article": r'제(\d+)조',
    "attachment": r'(별표|별지)\s*(\d+)'
}

# 매핑 예시
"「기금사업 협약체결 및 사업비 관리 등에 관한 지침」 제10조"
→ law_title: "기금사업 협약체결 및 사업비 관리 등에 관한 지침"
→ article: "제10조"
```

## 4. 구현 단계별 가이드

### 4.1 Phase 1: 데이터 준비 (2-3일)

#### 작업 내용
1. Excel 파일 파싱 및 JSON 변환
2. Policy anchor 분석 및 매핑 테이블 생성
3. 데이터 검증 및 정제

#### 핵심 스크립트
```python
# prepare_data.py
def parse_policy_anchor(anchor_text):
    """policy_anchor에서 규정 정보 추출"""
    result = []
    for match in re.finditer(patterns["regulation"], anchor_text):
        law_title = match.group(1)
        reference = match.group(2)
        result.append({
            "law_title": law_title,
            "reference": reference
        })
    return result

def create_relationship_map(faq_df, regulation_df):
    """FAQ와 규정 간 관계 맵 생성"""
    relationships = {}
    for _, faq in faq_df.iterrows():
        refs = parse_policy_anchor(faq['policy_anchor'])
        for ref in refs:
            # 규정 찾기 및 연결
            matching_regs = find_regulations(
                regulation_df,
                ref['law_title'],
                ref['reference']
            )
            relationships[faq['faq_id']] = matching_regs
    return relationships
```

### 4.2 Phase 2: 벡터 DB 구축 (2일)

#### 작업 내용
1. Qdrant 컬렉션 생성
2. 문서 임베딩 생성 (BGE-M3)
3. 벡터 및 메타데이터 업로드

#### 설정 파라미터
```yaml
collection_config:
  name: "fund_knowledge_base"
  vector_size: 1024
  distance: "Cosine"

chunking_strategy:
  faq:
    method: "full_document"  # Q&A 쌍 전체
    max_length: 2000
  regulation:
    method: "by_article"  # 조 단위
    max_length: 1500
    overlap: 200
```

### 4.3 Phase 3: 검색 파이프라인 (3일)

#### 검색 프로세스
```python
# search_pipeline.py
async def integrated_search(query: str, top_k: int = 5):
    # 1. Query preprocessing
    processed_query = preprocess_query(query)

    # 2. Parallel search
    faq_results = await search_faqs(processed_query, top_k=10)
    reg_results = await search_regulations(processed_query, top_k=10)

    # 3. Relationship expansion
    expanded_results = []
    for faq in faq_results:
        # FAQ의 policy_anchor로 연결된 규정 추가
        linked_regs = get_linked_regulations(faq['id'])
        expanded_results.extend(linked_regs)

    # 4. Reranking
    all_results = faq_results + reg_results + expanded_results
    reranked = await rerank_results(query, all_results, top_k)

    return reranked
```

### 4.4 Phase 4: API 엔드포인트 (2일)

#### 새 엔드포인트 추가
```python
# backend/api/routes/integrated_chat.py
@router.post("/api/chat/integrated")
async def integrated_chat(request: IntegratedChatRequest):
    # 통합 검색
    search_results = await integrated_search(
        request.message,
        top_k=request.top_k
    )

    # 컨텍스트 구성
    context = build_integrated_context(search_results)

    # LLM 응답 생성
    response = await generate_answer(
        query=request.message,
        context=context,
        model=request.llm_model
    )

    return IntegratedChatResponse(
        answer=response.answer,
        sources=response.sources,
        confidence=response.confidence
    )
```

## 5. 프롬프트 엔지니어링

### 5.1 System Prompt
```python
SYSTEM_PROMPT = """
당신은 ICT 기금사업 전문 상담 AI입니다.

역할:
- FAQ와 관련 규정을 통합하여 정확한 답변 제공
- 복잡한 규정을 이해하기 쉽게 설명

답변 구조:
1. 핵심 답변 (FAQ 기반)
2. 근거 규정 (관련 조항 인용)
3. 추가 정보 (필요시)
4. 출처 명시

원칙:
- 확실한 정보만 제공
- 규정 개정사항 확인 권고
- 모호한 경우 담당자 문의 안내
"""
```

### 5.2 Context Template
```python
CONTEXT_TEMPLATE = """
[검색된 FAQ]
{faq_content}

[근거 규정]
{regulation_content}

[관련 정보]
{additional_info}

위 정보를 바탕으로 사용자 질문에 답변하세요.
FAQ를 우선 참조하되, 근거 규정으로 보완하여 신뢰도 높은 답변을 제공하세요.
"""
```

## 6. 성능 최적화

### 6.1 캐싱 전략
```yaml
cache_layers:
  L1_memory:
    type: "in-memory"
    items: "top_20_faqs"
    ttl: 3600

  L2_redis:
    type: "redis"
    items: "embeddings"
    ttl: 86400

  L3_results:
    type: "redis"
    items: "search_results"
    ttl: 1800
```

### 6.2 배치 처리
- **일일 배치**: FAQ-규정 관계 검증
- **주간 배치**: 유사도 매트릭스 재계산
- **월간 배치**: 전체 임베딩 재생성

## 7. 모니터링 및 운영

### 7.1 핵심 지표
- **검색 품질**: Precision@5, Recall@10, MRR
- **응답 품질**: User satisfaction, Answer relevance
- **시스템 성능**: Latency (p50, p95, p99), Throughput

### 7.2 로깅 구조
```json
{
  "timestamp": "2024-01-01T10:00:00Z",
  "query": "사업비 교부 절차",
  "search_results": {
    "faq_count": 3,
    "regulation_count": 2,
    "expansion_count": 1
  },
  "response_time": 1.23,
  "user_feedback": "satisfied"
}
```

## 8. 구현 체크리스트

### Phase 1: 데이터 준비 ✓
- [ ] Excel 파일 파싱 스크립트 작성
- [ ] Policy anchor 파싱 함수 구현
- [ ] FAQ-규정 매핑 테이블 생성
- [ ] 데이터 검증 (missing links, duplicates)
- [ ] JSON 형식으로 데이터 export

### Phase 2: 인프라 구축 ✓
- [ ] Qdrant 컬렉션 생성 스크립트
- [ ] BGE-M3 임베딩 생성 파이프라인
- [ ] 벡터 업로드 및 인덱싱
- [ ] 메타데이터 필터링 테스트
- [ ] 백업 및 복구 절차 문서화

### Phase 3: API 개발 ✓
- [ ] `/api/chat/integrated` 엔드포인트 구현
- [ ] 통합 검색 함수 작성
- [ ] 관계 확장 로직 구현
- [ ] Reranking 통합
- [ ] Error handling 및 fallback

### Phase 4: 프롬프트 최적화 ✓
- [ ] System prompt 작성 및 테스트
- [ ] Context template 구조화
- [ ] Few-shot examples 준비
- [ ] 답변 형식 표준화
- [ ] 출처 표시 로직 구현

### Phase 5: 테스트 ✓
- [ ] 단위 테스트 (각 모듈)
- [ ] 통합 테스트 (E2E)
- [ ] 성능 테스트 (부하 테스트)
- [ ] A/B 테스트 설정
- [ ] 품질 평가 (샘플 100개)

### Phase 6: 배포 준비 ✓
- [ ] 환경 변수 설정
- [ ] Docker 이미지 빌드
- [ ] 모니터링 대시보드 구성
- [ ] 알림 규칙 설정
- [ ] 롤백 계획 수립

### Phase 7: 운영 전환 ✓
- [ ] Soft launch (10% 트래픽)
- [ ] 모니터링 및 조정
- [ ] Full rollout (100% 트래픽)
- [ ] 사용자 피드백 수집
- [ ] 개선사항 백로그 관리

## 9. 리스크 및 대응 방안

### 9.1 기술적 리스크
- **임베딩 품질**: BGE-M3가 법률 용어에 최적화되지 않을 수 있음
  - 대응: Fine-tuning 또는 도메인 특화 모델 검토

- **관계 매핑 오류**: Policy anchor 파싱 실패 가능성
  - 대응: 수동 검증 프로세스 및 예외 처리

### 9.2 운영 리스크
- **데이터 업데이트**: 규정 개정시 동기화 문제
  - 대응: 버전 관리 및 변경 추적 시스템

- **성능 저하**: 관계 확장으로 인한 지연
  - 대응: 캐싱 강화 및 비동기 처리

## 10. 타임라인

```
Week 1: 데이터 준비 및 인프라 구축
Week 2: API 개발 및 테스트
Week 3: 최적화 및 배포 준비
Week 4: Soft launch 및 모니터링
Week 5: Full rollout 및 안정화
```

## 11. 참고사항

- 기존 `/api/chat` 엔드포인트 유지 (하위 호환성)
- 점진적 마이그레이션 전략 적용
- 사용자 교육 자료 준비 필요
- 정기적인 품질 평가 체계 구축

---

**문서 버전**: 1.0.0
**작성일**: 2024-11-28
**담당**: AI 챗봇 개발팀