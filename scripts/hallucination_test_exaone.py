#!/usr/bin/env python3
"""
EXAONE 4.0 32B 할루시네이션 검증 테스트 스크립트
"""

import asyncio
import httpx
import json
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any

# 백엔드 API 설정
API_BASE_URL = "http://localhost:8000"

# 테스트 질의 설계 (GPT-OSS 테스트와 동일)
TEST_QUESTIONS = {
    "kca-cert-domain-faq": [
        {
            "id": "CERT-01",
            "question": "정보통신기사 자격시험에 응시하려면 산업기사 취득 후 몇 년의 경력이 필요한가요?",
            "expected_keywords": ["1년", "산업기사", "경력"],
            "category": "응시자격"
        },
        {
            "id": "CERT-02",
            "question": "전파전자통신기사 시험에 응시하기 위한 실무경력 요건은 무엇인가요?",
            "expected_keywords": ["4년", "경력", "실무"],
            "category": "응시자격"
        },
        {
            "id": "CERT-03",
            "question": "게임PD전공은 정보통신직무 관련학과로 인정되나요?",
            "expected_keywords": ["인정", "관련학과", "게임PD"],
            "category": "관련학과인정"
        },
        {
            "id": "CERT-04",
            "question": "자격취득교육 접수 종목을 잘못 선택한 경우 어떻게 해야 하나요?",
            "expected_keywords": ["취소", "재접수", "홈페이지"],
            "category": "시스템"
        },
        {
            "id": "CERT-05",
            "question": "CBT 시험결과 전송은 어떻게 하나요?",
            "expected_keywords": ["운영자", "시험감독", "전송"],
            "category": "CBT운영"
        }
    ],
    "kca-audit": [
        {
            "id": "AUDIT-01",
            "question": "청렴마일리지 부여기준 중 반부패 청렴 교육 참여시 몇 점을 받나요?",
            "expected_keywords": ["점수", "교육", "마일리지"],
            "category": "청렴마일리지"
        },
        {
            "id": "AUDIT-02",
            "question": "징계의 종류에는 어떤 것들이 있나요?",
            "expected_keywords": ["파면", "해임", "강등", "정직", "감봉", "견책"],
            "category": "징계규정"
        },
        {
            "id": "AUDIT-03",
            "question": "수수 금지된 금품을 신고한 경우 어떻게 처리되나요?",
            "expected_keywords": ["반환", "제출", "보관", "폐기"],
            "category": "금품수수"
        },
        {
            "id": "AUDIT-04",
            "question": "일상감사는 언제 실시하나요?",
            "expected_keywords": ["결재", "전", "최종결재"],
            "category": "일상감사"
        },
        {
            "id": "AUDIT-05",
            "question": "이해충돌방지법상 직무관련자의 정의는 무엇인가요?",
            "expected_keywords": ["직무수행", "이익", "불이익", "계약"],
            "category": "이해충돌방지"
        }
    ]
}

# EXAONE 모델 설정
MODEL_INFO = {"name": "exaone-4.0-32b", "display": "EXAONE 4.0 32B"}


async def call_chat_api(
    collection_name: str,
    message: str,
    model: str,
    temperature: float = 0.7,
    max_tokens: int = 2048,
    top_k: int = 5
) -> Dict[str, Any]:
    """Chat API 호출"""
    async with httpx.AsyncClient(timeout=180.0) as client:
        payload = {
            "collection_name": collection_name,
            "message": message,
            "model": model,
            "reasoning_level": "medium",
            "temperature": temperature,
            "max_tokens": max_tokens,
            "top_k": top_k,
            "use_reranking": True,
            "use_hybrid": True
        }

        start_time = time.time()
        try:
            response = await client.post(
                f"{API_BASE_URL}/api/chat/",
                json=payload
            )
            elapsed_time = time.time() - start_time

            if response.status_code == 200:
                result = response.json()
                result["elapsed_time"] = elapsed_time
                result["status"] = "success"
                return result
            else:
                return {
                    "status": "error",
                    "error": f"HTTP {response.status_code}: {response.text}",
                    "elapsed_time": elapsed_time
                }
        except Exception as e:
            return {
                "status": "error",
                "error": str(e),
                "elapsed_time": time.time() - start_time
            }


def analyze_response(
    response: Dict[str, Any],
    expected_keywords: List[str]
) -> Dict[str, Any]:
    """응답 분석 - 할루시네이션 검증"""
    analysis = {
        "has_answer": False,
        "keyword_matches": [],
        "keyword_match_rate": 0.0,
        "source_count": 0,
        "avg_source_score": 0.0,
        "potential_hallucination": False
    }

    if response.get("status") != "success":
        return analysis

    answer = response.get("answer", "")
    analysis["has_answer"] = bool(answer)

    # 키워드 매칭 분석
    for keyword in expected_keywords:
        if keyword in answer:
            analysis["keyword_matches"].append(keyword)

    analysis["keyword_match_rate"] = len(analysis["keyword_matches"]) / len(expected_keywords) if expected_keywords else 0.0

    # 출처 분석
    retrieved_docs = response.get("retrieved_docs", [])
    analysis["source_count"] = len(retrieved_docs)

    if retrieved_docs:
        scores = [doc.get("score", 0) for doc in retrieved_docs]
        analysis["avg_source_score"] = sum(scores) / len(scores)

    # 할루시네이션 가능성 판단
    if analysis["has_answer"]:
        if analysis["source_count"] == 0:
            analysis["potential_hallucination"] = True
        elif analysis["avg_source_score"] < 0.3 and analysis["keyword_match_rate"] < 0.3:
            analysis["potential_hallucination"] = True

    return analysis


async def run_test(collection_name: str, questions: List[Dict]) -> List[Dict]:
    """단일 컬렉션 테스트 실행"""
    results = []

    print(f"\n{'='*60}")
    print(f"Testing: {collection_name} with {MODEL_INFO['display']}")
    print(f"{'='*60}")

    for q in questions:
        print(f"\n[{q['id']}] {q['question'][:50]}...")

        response = await call_chat_api(
            collection_name=collection_name,
            message=q["question"],
            model=MODEL_INFO["name"]
        )

        analysis = analyze_response(response, q.get("expected_keywords", []))

        result = {
            "question_id": q["id"],
            "question": q["question"],
            "category": q.get("category", ""),
            "expected_keywords": q.get("expected_keywords", []),
            "model": MODEL_INFO["name"],
            "model_display": MODEL_INFO["display"],
            "collection": collection_name,
            "status": response.get("status"),
            "answer": response.get("answer", "")[:500] + "..." if len(response.get("answer", "")) > 500 else response.get("answer", ""),
            "full_answer": response.get("answer", ""),
            "elapsed_time": response.get("elapsed_time", 0),
            "source_count": analysis["source_count"],
            "avg_source_score": analysis["avg_source_score"],
            "keyword_matches": analysis["keyword_matches"],
            "keyword_match_rate": analysis["keyword_match_rate"],
            "potential_hallucination": analysis["potential_hallucination"],
            "retrieved_docs": [
                {
                    "score": doc.get("score"),
                    "text": doc.get("text", "")[:200] + "..." if len(doc.get("text", "")) > 200 else doc.get("text", ""),
                    "metadata": {k: v for k, v in doc.get("metadata", {}).items() if k in ["filename", "source_file", "headings"]}
                }
                for doc in response.get("retrieved_docs", [])[:3]
            ]
        }

        results.append(result)

        status_icon = "X" if analysis["potential_hallucination"] else "O"
        print(f"  [{status_icon}] Time: {result['elapsed_time']:.1f}s, Sources: {result['source_count']}, Keywords: {len(analysis['keyword_matches'])}/{len(q.get('expected_keywords', []))}")

    return results


async def main():
    """메인 테스트 실행"""
    print("\n" + "="*80)
    print("EXAONE 4.0 32B 할루시네이션 검증 테스트")
    print(f"시작 시간: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*80)

    all_results = []

    # 각 컬렉션 테스트
    for collection_name, questions in TEST_QUESTIONS.items():
        try:
            results = await run_test(collection_name, questions)
            all_results.extend(results)
        except Exception as e:
            print(f"Error testing {collection_name}: {e}")

    # 결과 저장
    output_dir = Path("/data/docling-app/docs/final")
    output_dir.mkdir(parents=True, exist_ok=True)

    # JSON 결과 저장
    json_path = output_dir / "hallucination_test_results_exaone.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(all_results, f, ensure_ascii=False, indent=2)
    print(f"\nJSON 결과 저장: {json_path}")

    # Markdown 보고서 생성
    md_path = output_dir / "08_exaone_hallucination_test_report.md"
    generate_markdown_report(all_results, md_path)
    print(f"Markdown 보고서 저장: {md_path}")

    print("\n" + "="*80)
    print(f"테스트 완료: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*80)


def generate_markdown_report(results: List[Dict], output_path: Path):
    """Markdown 형식 보고서 생성"""

    # 통계 계산
    total_tests = len(results)
    successful_tests = len([r for r in results if r["status"] == "success"])
    hallucination_cases = len([r for r in results if r["potential_hallucination"]])

    # 평균 계산
    success_results = [r for r in results if r["status"] == "success"]
    avg_time = sum([r["elapsed_time"] for r in results]) / len(results) if results else 0
    avg_source_score = sum([r["avg_source_score"] for r in success_results]) / len(success_results) if success_results else 0
    avg_keyword_rate = sum([r["keyword_match_rate"] for r in success_results]) / len(success_results) if success_results else 0

    # 컬렉션별 통계
    collection_stats = {}
    for collection in TEST_QUESTIONS.keys():
        col_results = [r for r in results if r["collection"] == collection]
        col_success = [r for r in col_results if r["status"] == "success"]
        collection_stats[collection] = {
            "total": len(col_results),
            "success": len(col_success),
            "hallucination": len([r for r in col_results if r["potential_hallucination"]]),
            "avg_score": sum([r["avg_source_score"] for r in col_success]) / len(col_success) if col_success else 0,
            "avg_keyword": sum([r["keyword_match_rate"] for r in col_success]) / len(col_success) if col_success else 0
        }

    report = f"""# EXAONE 4.0 32B 할루시네이션 검증 테스트 결과 보고서

> 테스트 일시: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
> 테스트 대상: EXAONE 4.0 32B (131K 컨텍스트)

---

## 1. 테스트 개요

### 1.1 목적
- EXAONE 4.0 32B 모델의 할루시네이션(환각) 발생 가능성 검증
- GPT-OSS 20B 테스트 결과와의 비교 분석
- RAG 파이프라인의 출처 기반 답변 신뢰성 평가

### 1.2 테스트 범위
| 항목 | 내용 |
|------|------|
| 테스트 컬렉션 | kca-cert-domain-faq (328 벡터), kca-audit (302 벡터) |
| 테스트 모델 | EXAONE 4.0 32B |
| 테스트 질의 수 | 컬렉션당 5개, 총 10개 |
| RAG 설정 | top_k=5, use_reranking=True, use_hybrid=True |

### 1.3 EXAONE 4.0 32B 모델 특성
| 항목 | 사양 |
|------|------|
| 파라미터 수 | 32B (320억 개) |
| 컨텍스트 길이 | 131,072 토큰 |
| VRAM 사용량 | ~20GB |
| 특징 | 장문 처리에 강점, 한국어 최적화 |

### 1.4 할루시네이션 판단 기준
1. 출처가 없는데 답변이 있는 경우
2. 출처 점수가 낮은데(< 0.3) 확신 있는 답변인 경우
3. 예상 키워드 매칭률이 매우 낮은 경우(< 30%)

---

## 2. 테스트 결과 요약

### 2.1 전체 통계
| 항목 | 결과 |
|------|------|
| 총 테스트 건수 | {total_tests}건 |
| 성공 건수 | {successful_tests}건 ({successful_tests/total_tests*100:.1f}%) |
| 할루시네이션 의심 건수 | {hallucination_cases}건 |
| 할루시네이션 발생률 | {hallucination_cases/total_tests*100:.1f}% |
| 평균 응답시간 | {avg_time:.1f}초 |
| 평균 출처점수 | {avg_source_score:.3f} |
| 평균 키워드 매칭률 | {avg_keyword_rate*100:.1f}% |

### 2.2 컬렉션별 통계
| 컬렉션 | 테스트 수 | 성공 | 할루시네이션 의심 | 평균 출처점수 | 평균 키워드 매칭률 |
|--------|----------|------|-----------------|-------------|------------------|
"""

    for col_name, stats in collection_stats.items():
        rate = stats['hallucination'] / stats['total'] * 100 if stats['total'] > 0 else 0
        report += f"| {col_name} | {stats['total']}건 | {stats['success']}건 | {stats['hallucination']}건 ({rate:.0f}%) | {stats['avg_score']:.3f} | {stats['avg_keyword']*100:.1f}% |\n"

    report += """
### 2.3 품질 등급 분류
| 등급 | 기준 | 건수 | 비율 |
|------|------|------|------|
"""

    excellent = len([r for r in success_results if r["keyword_match_rate"] >= 1.0 and r["avg_source_score"] > 0.9])
    good = len([r for r in success_results if r["keyword_match_rate"] > 0.6 and r["avg_source_score"] > 0.5 and r["keyword_match_rate"] < 1.0])
    caution = len([r for r in success_results if r["keyword_match_rate"] < 0.3 or r["avg_source_score"] < 0.3])

    report += f"| 우수 | 키워드 매칭률 100%, 출처점수 > 0.9 | {excellent}건 | {excellent/total_tests*100:.0f}% |\n"
    report += f"| 양호 | 키워드 매칭률 > 60%, 출처점수 > 0.5 | {good}건 | {good/total_tests*100:.0f}% |\n"
    report += f"| 주의 | 키워드 매칭률 < 30% 또는 출처점수 < 0.3 | {caution}건 | {caution/total_tests*100:.0f}% |\n"

    report += """
---

## 3. 상세 테스트 결과

"""

    # 컬렉션별로 그룹화
    for col_idx, collection_name in enumerate(TEST_QUESTIONS.keys()):
        col_results = [r for r in results if r["collection"] == collection_name]

        col_display = "자격검정 FAQ" if "cert" in collection_name else "감사팀 규정"
        report += f"### 3.{col_idx+1} {collection_name} ({col_display})\n\n"

        for q_idx, q in enumerate(TEST_QUESTIONS[collection_name]):
            q_results = [r for r in col_results if r["question_id"] == q["id"]]

            report += f"#### Q{q_idx+1}: {q['question']}\n"
            report += f"- **질문 ID**: {q['id']}\n"
            report += f"- **카테고리**: {q.get('category', 'N/A')}\n"
            report += f"- **예상 키워드**: {', '.join(q.get('expected_keywords', []))}\n\n"

            for r in q_results:
                status = "PASS" if not r["potential_hallucination"] and r["status"] == "success" else "FAIL"
                if r["status"] != "success":
                    status = "ERROR"

                report += f"**결과: {status}**\n\n"
                report += f"| 항목 | 값 |\n|------|----||\n"
                report += f"| 응답시간 | {r['elapsed_time']:.1f}초 |\n"
                report += f"| 출처 수 | {r['source_count']}개 |\n"
                report += f"| 평균 출처점수 | {r['avg_source_score']:.3f} |\n"
                report += f"| 키워드 매칭 | {len(r['keyword_matches'])}/{len(r['expected_keywords'])} ({r['keyword_match_rate']*100:.0f}%) |\n"
                report += f"| 할루시네이션 의심 | {'예' if r['potential_hallucination'] else '아니오'} |\n\n"

                if r["status"] == "success":
                    report += f"**답변 요약**:\n> {r['answer'][:300]}{'...' if len(r['answer']) > 300 else ''}\n\n"

                    if r['retrieved_docs']:
                        report += f"**출처 (상위 3개)**:\n"
                        for i, doc in enumerate(r['retrieved_docs'][:3]):
                            headings = doc.get('metadata', {}).get('headings', [])
                            if headings:
                                source_name = headings[0] if len(headings) > 0 else 'Unknown'
                            else:
                                source_name = doc.get('metadata', {}).get('source_file', doc.get('metadata', {}).get('filename', 'Unknown'))
                            report += f"- [{i+1}] Score: {doc['score']:.3f} - {source_name}\n"
                        report += "\n"
                else:
                    report += f"**오류**: {r.get('error', 'Unknown error')}\n\n"

                report += "---\n\n"

    report += """
## 4. 분석 및 결론

### 4.1 EXAONE 4.0 32B 성능 평가

| 평가 항목 | 결과 | 등급 |
|-----------|------|------|
"""

    success_rate = successful_tests / total_tests * 100 if total_tests > 0 else 0
    hallucination_prevention = (total_tests - hallucination_cases) / total_tests * 100 if total_tests > 0 else 0

    report += f"| 전체 성공률 | {success_rate:.0f}% ({successful_tests}/{total_tests}) | {'우수' if success_rate >= 90 else '양호' if success_rate >= 70 else '개선필요'} |\n"
    report += f"| 할루시네이션 방지 | {hallucination_prevention:.0f}% ({total_tests - hallucination_cases}/{total_tests}) | {'우수' if hallucination_prevention >= 90 else '양호' if hallucination_prevention >= 70 else '개선필요'} |\n"
    report += f"| 평균 응답 속도 | {avg_time:.1f}초 | {'우수' if avg_time < 3 else '양호' if avg_time < 6 else '개선필요'} |\n"
    report += f"| 출처 기반 답변 | {hallucination_prevention:.0f}% | {'우수' if hallucination_prevention >= 90 else '양호'} |\n"

    report += """
### 4.2 GPT-OSS 20B 대비 비교 (이전 테스트 결과 기준)

| 항목 | GPT-OSS 20B | EXAONE 4.0 32B | 비교 |
|------|-------------|----------------|------|
"""

    # GPT-OSS 기준 데이터 (이전 테스트에서 가져옴)
    report += f"| 할루시네이션 발생률 | 10% (1/10) | {hallucination_cases/total_tests*100:.0f}% ({hallucination_cases}/{total_tests}) | {'동등' if abs(10 - hallucination_cases/total_tests*100) < 5 else 'EXAONE 우세' if hallucination_cases/total_tests*100 < 10 else 'GPT-OSS 우세'} |\n"
    report += f"| 평균 응답시간 | 3.2초 | {avg_time:.1f}초 | {'동등' if abs(3.2 - avg_time) < 1 else 'EXAONE 빠름' if avg_time < 3.2 else 'GPT-OSS 빠름'} |\n"
    report += f"| 평균 키워드 매칭률 | 80.0% | {avg_keyword_rate*100:.1f}% | {'동등' if abs(80 - avg_keyword_rate*100) < 5 else 'EXAONE 우세' if avg_keyword_rate*100 > 80 else 'GPT-OSS 우세'} |\n"

    report += """
### 4.3 권장 사항

**운영 권장사항**:
1. 컬렉션 특성에 따른 모델 선택 가이드 수립
2. 응답 시간이 중요한 경우 GPT-OSS, 품질이 중요한 경우 EXAONE 고려
3. 131K 컨텍스트 활용을 위한 장문 문서 처리 시나리오 개발

**품질 개선 권장사항**:
1. 할루시네이션 발생 케이스에 대한 FAQ 문서 보강
2. score_threshold 조정 검토 (현재 0.4)
3. 정기적인 품질 모니터링 체계 수립

---

## 5. 테스트 데이터 파일

| 파일명 | 용도 |
|--------|------|
| hallucination_test_results_exaone.json | EXAONE 테스트 결과 (상세 데이터) |
| 08_exaone_hallucination_test_report.md | 본 보고서 |
| 07_hallucination_test_report.md | GPT-OSS 테스트 보고서 (비교용) |

---

**끝.**
"""

    with open(output_path, "w", encoding="utf-8") as f:
        f.write(report)


if __name__ == "__main__":
    asyncio.run(main())
