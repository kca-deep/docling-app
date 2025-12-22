#!/usr/bin/env python3
"""
LLM 할루시네이션 종합 검증 테스트 (1000개 질의)

generate_test_questions_1000.py로 생성된 질의를 사용하여 테스트합니다.
- 문서 내 질의 700개: 출처 기반 정확도 검증
- 문서 외 질의 300개: 할루시네이션 발생 여부 검증
"""

import asyncio
import httpx
import json
import time
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any

# 백엔드 API 설정
API_BASE_URL = "http://localhost:8000"


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
    question_info: Dict
) -> Dict[str, Any]:
    """응답 분석 - 할루시네이션 검증"""
    expected_keywords = question_info.get("expected_keywords", [])
    in_document = question_info.get("in_document", True)
    expect_no_answer = question_info.get("expect_no_answer", False)

    analysis = {
        "has_answer": False,
        "keyword_matches": [],
        "keyword_match_rate": 0.0,
        "source_count": 0,
        "avg_source_score": 0.0,
        "max_source_score": 0.0,
        "hallucination_type": None,
        "is_correct_behavior": True,
        "analysis_notes": []
    }

    if response.get("status") != "success":
        analysis["analysis_notes"].append("API 호출 실패")
        return analysis

    answer = response.get("answer", "")
    analysis["has_answer"] = bool(answer and len(answer.strip()) > 10)

    # 키워드 매칭 분석
    for keyword in expected_keywords:
        if keyword in answer:
            analysis["keyword_matches"].append(keyword)

    if expected_keywords:
        analysis["keyword_match_rate"] = len(analysis["keyword_matches"]) / len(expected_keywords)

    # 출처 분석
    retrieved_docs = response.get("retrieved_docs", [])
    analysis["source_count"] = len(retrieved_docs)

    if retrieved_docs:
        scores = [doc.get("score", 0) for doc in retrieved_docs]
        analysis["avg_source_score"] = sum(scores) / len(scores)
        analysis["max_source_score"] = max(scores)

    # 할루시네이션 판단
    no_answer_phrases = [
        "확인할 수 없", "찾을 수 없", "정보가 없", "문서에 없",
        "알 수 없", "명시되어 있지 않", "포함되어 있지 않",
        "제공된 문서", "관련 정보를 찾", "답변드리기 어렵"
    ]
    admits_no_info = any(phrase in answer for phrase in no_answer_phrases)

    if expect_no_answer:
        if admits_no_info or analysis["avg_source_score"] < 0.3:
            analysis["is_correct_behavior"] = True
            analysis["analysis_notes"].append("정보 없음을 올바르게 인식")
        else:
            analysis["hallucination_type"] = "Type A"
            analysis["is_correct_behavior"] = False
            analysis["analysis_notes"].append("문서 없이 답변 생성 (할루시네이션)")
    else:
        if analysis["avg_source_score"] >= 0.3:
            if analysis["keyword_match_rate"] >= 0.5:
                analysis["is_correct_behavior"] = True
                analysis["analysis_notes"].append("출처 기반 정확한 답변")
            elif analysis["keyword_match_rate"] > 0:
                analysis["is_correct_behavior"] = True
                analysis["analysis_notes"].append("부분적으로 정확한 답변")
            else:
                analysis["hallucination_type"] = "Type B (suspected)"
                analysis["is_correct_behavior"] = False
                analysis["analysis_notes"].append("출처와 답변 불일치 의심")
        else:
            if admits_no_info:
                analysis["is_correct_behavior"] = True
                analysis["analysis_notes"].append("검색 실패 인정 (정직한 응답)")
            else:
                analysis["hallucination_type"] = "Type A"
                analysis["is_correct_behavior"] = False
                analysis["analysis_notes"].append("낮은 출처 점수로 답변 생성")

    return analysis


async def run_test(
    collection_name: str,
    questions: List[Dict],
    model_info: Dict,
    batch_size: int = 10,
    save_interval: int = 50
) -> List[Dict]:
    """테스트 실행 (배치 처리 + 중간 저장)"""
    results = []
    total = len(questions)
    output_dir = Path("/data/docling-app/docs/final")

    print(f"\n{'='*60}")
    print(f"Testing: {collection_name} with {model_info['display']}")
    print(f"Total questions: {total}")
    print(f"{'='*60}")

    for idx, q in enumerate(questions, 1):
        q_type = "문서내" if q.get("in_document", True) else "문서외"
        q_id = q.get("id", f"Q-{idx:04d}")
        print(f"\n[{idx}/{total}] [{q_id}] [{q_type}] {q['question'][:50]}...")

        response = await call_chat_api(
            collection_name=collection_name,
            message=q["question"],
            model=model_info["name"]
        )

        analysis = analyze_response(response, q)

        result = {
            "question_id": q_id,
            "question": q["question"],
            "category": q.get("category", ""),
            "expected_keywords": q.get("expected_keywords", []),
            "in_document": q.get("in_document", True),
            "expect_no_answer": q.get("expect_no_answer", False),
            "model": model_info["name"],
            "model_display": model_info["display"],
            "collection": collection_name,
            "status": response.get("status"),
            "answer": response.get("answer", "")[:500] + "..." if len(response.get("answer", "")) > 500 else response.get("answer", ""),
            "full_answer": response.get("answer", ""),
            "elapsed_time": response.get("elapsed_time", 0),
            "source_count": analysis["source_count"],
            "avg_source_score": analysis["avg_source_score"],
            "max_source_score": analysis["max_source_score"],
            "keyword_matches": analysis["keyword_matches"],
            "keyword_match_rate": analysis["keyword_match_rate"],
            "hallucination_type": analysis["hallucination_type"],
            "is_correct_behavior": analysis["is_correct_behavior"],
            "analysis_notes": analysis["analysis_notes"],
            "retrieved_docs": [
                {
                    "score": doc.get("score"),
                    "text": doc.get("text", "")[:150] + "..." if len(doc.get("text", "")) > 150 else doc.get("text", ""),
                }
                for doc in response.get("retrieved_docs", [])[:3]
            ]
        }

        results.append(result)

        status = "O" if analysis["is_correct_behavior"] else "X"
        hall_type = f" [{analysis['hallucination_type']}]" if analysis["hallucination_type"] else ""
        print(f"  [{status}]{hall_type} Time: {result['elapsed_time']:.1f}s, Score: {analysis['avg_source_score']:.3f}")

        # 중간 저장
        if idx % save_interval == 0:
            checkpoint_path = output_dir / f"checkpoint_{collection_name}_{model_info['name']}_{idx}.json"
            with open(checkpoint_path, "w", encoding="utf-8") as f:
                json.dump(results, f, ensure_ascii=False, indent=2)
            print(f"  [Checkpoint saved: {checkpoint_path.name}]")

    return results


def print_summary(results: List[Dict], model_info: Dict):
    """테스트 결과 요약 출력"""
    total = len(results)
    if total == 0:
        print("No results to summarize")
        return

    success = len([r for r in results if r["status"] == "success"])
    correct_behavior = len([r for r in results if r["is_correct_behavior"]])

    in_doc_results = [r for r in results if r["in_document"]]
    out_doc_results = [r for r in results if not r["in_document"]]

    in_doc_correct = len([r for r in in_doc_results if r["is_correct_behavior"]])
    out_doc_correct = len([r for r in out_doc_results if r["is_correct_behavior"]])

    type_a = len([r for r in results if r["hallucination_type"] == "Type A"])
    type_b = len([r for r in results if r["hallucination_type"] and "Type B" in r["hallucination_type"]])

    avg_time = sum(r["elapsed_time"] for r in results) / total

    print(f"\n{'='*60}")
    print(f"{model_info['display']} 테스트 결과 요약")
    print(f"{'='*60}")
    print(f"총 테스트: {total}건")
    print(f"API 성공: {success}건 ({success/total*100:.1f}%)")
    print(f"올바른 동작: {correct_behavior}건 ({correct_behavior/total*100:.1f}%)")
    print(f"평균 응답시간: {avg_time:.2f}초")

    if in_doc_results:
        print(f"\n[문서 내 질의] {len(in_doc_results)}건")
        print(f"  - 정확한 답변: {in_doc_correct}건 ({in_doc_correct/len(in_doc_results)*100:.1f}%)")

    if out_doc_results:
        print(f"\n[문서 외 질의] {len(out_doc_results)}건")
        print(f"  - 올바른 응답: {out_doc_correct}건 ({out_doc_correct/len(out_doc_results)*100:.1f}%)")

    print(f"\n[할루시네이션 발생]")
    print(f"  - Type A (문서없이 생성): {type_a}건 ({type_a/total*100:.1f}%)")
    print(f"  - Type B (출처 왜곡): {type_b}건 ({type_b/total*100:.1f}%)")
    print(f"  - 총 할루시네이션: {type_a + type_b}건 ({(type_a + type_b)/total*100:.1f}%)")


async def main(model_name: str = "gpt-oss-20b"):
    """메인 테스트 실행"""
    model_info = {
        "gpt-oss-20b": {"name": "gpt-oss-20b", "display": "GPT-OSS 20B"},
        "exaone-4.0-32b": {"name": "exaone-4.0-32b", "display": "EXAONE 4.0 32B"}
    }.get(model_name, {"name": model_name, "display": model_name})

    # 질의 파일 로드
    questions_path = Path("/data/docling-app/scripts/test_questions_1000.json")
    if not questions_path.exists():
        print(f"Error: Questions file not found: {questions_path}")
        print("Please run generate_test_questions_1000.py first.")
        return []

    with open(questions_path, "r", encoding="utf-8") as f:
        test_questions = json.load(f)

    print("\n" + "="*80)
    print(f"LLM 할루시네이션 종합 검증 테스트 (1000개 질의)")
    print(f"모델: {model_info['display']}")
    print(f"시작 시간: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*80)

    total_questions = sum(len(qs) for qs in test_questions.values())
    print(f"총 질의 수: {total_questions}")

    all_results = []
    output_dir = Path("/data/docling-app/docs/final")
    output_dir.mkdir(parents=True, exist_ok=True)

    # 각 컬렉션 테스트
    for collection_name, questions in test_questions.items():
        try:
            results = await run_test(
                collection_name,
                questions,
                model_info,
                save_interval=100  # 100개마다 중간 저장
            )
            all_results.extend(results)
        except Exception as e:
            print(f"Error testing {collection_name}: {e}")
            import traceback
            traceback.print_exc()

    # 최종 결과 저장
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    json_path = output_dir / f"hallucination_test_1000_{model_name.replace('.', '_')}_{timestamp}.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(all_results, f, ensure_ascii=False, indent=2)
    print(f"\nJSON 결과 저장: {json_path}")

    # 통계 출력
    print_summary(all_results, model_info)

    # 간략 보고서 생성
    generate_report(all_results, model_info, output_dir, timestamp)

    print("\n" + "="*80)
    print(f"테스트 완료: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*80)

    return all_results


def generate_report(results: List[Dict], model_info: Dict, output_dir: Path, timestamp: str):
    """마크다운 보고서 생성"""
    total = len(results)
    if total == 0:
        return

    success = len([r for r in results if r["status"] == "success"])
    correct = len([r for r in results if r["is_correct_behavior"]])

    in_doc = [r for r in results if r["in_document"]]
    out_doc = [r for r in results if not r["in_document"]]
    in_doc_correct = len([r for r in in_doc if r["is_correct_behavior"]])
    out_doc_correct = len([r for r in out_doc if r["is_correct_behavior"]])

    type_a = len([r for r in results if r["hallucination_type"] == "Type A"])
    type_b = len([r for r in results if r["hallucination_type"] and "Type B" in r["hallucination_type"]])

    avg_time = sum(r["elapsed_time"] for r in results) / total

    # 할루시네이션 케이스 수집
    hall_cases = [r for r in results if r["hallucination_type"]]

    report = f"""# LLM 할루시네이션 검증 테스트 보고서 (1000개 질의)

> 테스트 일시: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
> 테스트 모델: {model_info['display']}
> 총 질의 수: {total}

---

## 1. 테스트 결과 요약

| 항목 | 결과 |
|------|------|
| API 성공률 | {success}/{total} ({success/total*100:.1f}%) |
| **올바른 동작률** | **{correct}/{total} ({correct/total*100:.1f}%)** |
| 문서 내 정확도 | {in_doc_correct}/{len(in_doc)} ({in_doc_correct/len(in_doc)*100:.1f}%) |
| 문서 외 정확도 | {out_doc_correct}/{len(out_doc)} ({out_doc_correct/len(out_doc)*100:.1f}%) |
| 할루시네이션 발생 | {type_a + type_b}건 ({(type_a + type_b)/total*100:.1f}%) |
| 평균 응답시간 | {avg_time:.2f}초 |

## 2. 할루시네이션 유형별 분석

| 유형 | 발생 건수 | 비율 |
|------|----------|------|
| Type A (문서없이 생성) | {type_a}건 | {type_a/total*100:.1f}% |
| Type B (출처 왜곡) | {type_b}건 | {type_b/total*100:.1f}% |
| **합계** | **{type_a + type_b}건** | **{(type_a + type_b)/total*100:.1f}%** |

## 3. 할루시네이션 케이스 상세 (상위 20건)

| ID | 유형 | 질문 (요약) | 출처점수 | 분석 |
|----|------|------------|----------|------|
"""

    for case in hall_cases[:20]:
        q_summary = case["question"][:40] + "..." if len(case["question"]) > 40 else case["question"]
        report += f"| {case['question_id']} | {case['hallucination_type']} | {q_summary} | {case['avg_source_score']:.3f} | {', '.join(case['analysis_notes'])} |\n"

    report += f"""
## 4. 컬렉션별 분석

"""
    collections = set(r["collection"] for r in results)
    for coll in collections:
        coll_results = [r for r in results if r["collection"] == coll]
        coll_in = [r for r in coll_results if r["in_document"]]
        coll_out = [r for r in coll_results if not r["in_document"]]
        coll_in_correct = len([r for r in coll_in if r["is_correct_behavior"]])
        coll_out_correct = len([r for r in coll_out if r["is_correct_behavior"]])
        coll_hall = len([r for r in coll_results if r["hallucination_type"]])

        report += f"""### {coll}

| 항목 | 결과 |
|------|------|
| 총 질의 | {len(coll_results)}건 |
| 문서 내 정확도 | {coll_in_correct}/{len(coll_in)} ({coll_in_correct/len(coll_in)*100:.1f}%) |
| 문서 외 정확도 | {coll_out_correct}/{len(coll_out)} ({coll_out_correct/len(coll_out)*100:.1f}%) |
| 할루시네이션 | {coll_hall}건 |

"""

    report += """---

**끝.**
"""

    report_path = output_dir / f"hallucination_test_1000_report_{model_info['name'].replace('.', '_')}_{timestamp}.md"
    with open(report_path, "w", encoding="utf-8") as f:
        f.write(report)
    print(f"보고서 저장: {report_path}")


if __name__ == "__main__":
    model = sys.argv[1] if len(sys.argv) > 1 else "gpt-oss-20b"
    asyncio.run(main(model))
