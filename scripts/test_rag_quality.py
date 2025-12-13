#!/usr/bin/env python3
"""
RAG 답변 품질 테스트 스크립트
두 개의 LLM(GPT-OSS, EXAONE)과 두 개의 추론수준(medium, high)으로 테스트
"""
import asyncio
import httpx
import json
import time
from datetime import datetime
from dataclasses import dataclass
from typing import List, Dict, Any, Optional
import statistics

# 테스트 설정
BACKEND_URL = "http://localhost:8000"
COLLECTION_NAME = "kca-hr"
TEST_COUNT = 10

# 모델 설정 (backend settings.get_llm_config에 맞춤)
MODELS = {
    "gpt-oss": {
        "name": "gpt-oss-20b",
        "base_url": "http://localhost:8080"
    },
    # "exaone": {
    #     "name": "exaone-deep-7.8b",
    #     "base_url": "http://localhost:8085"
    # }
}

REASONING_LEVELS = ["medium", "high"]

# 인사관리 관련 테스트 질문들
TEST_QUESTIONS = [
    "연차휴가 부여 기준은 어떻게 되나요?",
    "육아휴직 신청 자격과 기간은?",
    "시간외근무 수당 계산 방법은?",
    "경조휴가 종류와 일수를 알려주세요",
    "직원 평가 기준은 무엇인가요?",
    "승진 요건은 어떻게 되나요?",
    "퇴직금 산정 기준은?",
    "출장비 지급 기준을 설명해주세요",
    "징계 처분의 종류는 무엇이 있나요?",
    "복리후생 제도에는 어떤 것들이 있나요?"
]


@dataclass
class TestResult:
    """테스트 결과"""
    question: str
    model: str
    reasoning_level: str
    answer: str
    response_time_ms: int
    token_count: Optional[int]
    retrieved_docs_count: int
    top_score: float
    reasoning_content: Optional[str] = None  # GPT-OSS 추론 과정
    error: Optional[str] = None


async def run_single_test(
    client: httpx.AsyncClient,
    question: str,
    model: str,
    reasoning_level: str
) -> TestResult:
    """단일 테스트 실행"""
    start_time = time.time()

    try:
        response = await client.post(
            f"{BACKEND_URL}/api/chat/",
            json={
                "collection_name": COLLECTION_NAME,
                "message": question,
                "model": model,
                "reasoning_level": reasoning_level,
                "temperature": 0.7,
                "max_tokens": 2000,
                "top_p": 0.9,
                "top_k": 5,
                "use_reranking": True
            },
            timeout=120.0
        )

        response_time_ms = int((time.time() - start_time) * 1000)

        if response.status_code != 200:
            return TestResult(
                question=question,
                model=model,
                reasoning_level=reasoning_level,
                answer="",
                response_time_ms=response_time_ms,
                token_count=None,
                retrieved_docs_count=0,
                top_score=0.0,
                error=f"HTTP {response.status_code}: {response.text[:200]}"
            )

        data = response.json()

        retrieved_docs = data.get("retrieved_docs", [])
        top_score = retrieved_docs[0].get("score", 0.0) if retrieved_docs else 0.0

        usage = data.get("usage") or {}
        token_count = usage.get("total_tokens")

        return TestResult(
            question=question,
            model=model,
            reasoning_level=reasoning_level,
            answer=data.get("answer", ""),
            response_time_ms=response_time_ms,
            token_count=token_count,
            retrieved_docs_count=len(retrieved_docs),
            top_score=top_score,
            reasoning_content=data.get("reasoning_content")
        )

    except Exception as e:
        return TestResult(
            question=question,
            model=model,
            reasoning_level=reasoning_level,
            answer="",
            response_time_ms=int((time.time() - start_time) * 1000),
            token_count=None,
            retrieved_docs_count=0,
            top_score=0.0,
            error=str(e)
        )


def analyze_answer(answer: str) -> Dict[str, Any]:
    """답변 품질 분석"""
    analysis = {
        "length": len(answer),
        "has_bullet_points": any(marker in answer for marker in ["- ", "* ", "1.", "2.", "3."]),
        "has_numbers": any(char.isdigit() for char in answer),
        "has_korean": any('\uac00' <= char <= '\ud7a3' for char in answer),
        "paragraph_count": answer.count('\n\n') + 1,
        "sentence_count": answer.count('.') + answer.count('다.') + answer.count('요.'),
        "is_empty": len(answer.strip()) == 0,
        "is_error_response": "찾을 수 없습니다" in answer or "오류" in answer,
        "has_source_citation": "페이지" in answer or "출처" in answer or "문서" in answer,
        "reasoning_visible": "<think>" in answer or "생각" in answer or "분석" in answer,
    }
    return analysis


def print_separator(char="=", length=80):
    print(char * length)


async def main():
    """메인 테스트 실행"""
    print_separator()
    print(f"RAG 답변 품질 테스트")
    print(f"시작 시간: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"컬렉션: {COLLECTION_NAME}")
    print(f"테스트 횟수: 각 조합당 {TEST_COUNT}회")
    print_separator()

    all_results: List[TestResult] = []

    async with httpx.AsyncClient() as client:
        # 백엔드 연결 확인
        try:
            health = await client.get(f"{BACKEND_URL}/health", timeout=10.0)
            if health.status_code != 200:
                print(f"[ERROR] 백엔드 연결 실패: {health.status_code}")
                return
            print("[OK] 백엔드 연결 성공")
        except Exception as e:
            print(f"[ERROR] 백엔드 연결 실패: {e}")
            return

        # 각 모델 + 추론수준 조합으로 테스트
        for model_key, model_config in MODELS.items():
            for reasoning_level in REASONING_LEVELS:
                print_separator("-")
                print(f"\n테스트: {model_key} + {reasoning_level}")
                print(f"모델: {model_config['name']}")
                print_separator("-")

                results_for_combo = []

                for i, question in enumerate(TEST_QUESTIONS[:TEST_COUNT]):
                    print(f"\n[{i+1}/{TEST_COUNT}] Q: {question[:40]}...")

                    result = await run_single_test(
                        client=client,
                        question=question,
                        model=model_config['name'],
                        reasoning_level=reasoning_level
                    )

                    results_for_combo.append(result)
                    all_results.append(result)

                    if result.error:
                        print(f"  [ERROR] {result.error[:100]}")
                    else:
                        print(f"  응답시간: {result.response_time_ms}ms")
                        print(f"  답변길이: {len(result.answer)}자")
                        print(f"  검색문서: {result.retrieved_docs_count}개 (top: {result.top_score:.4f})")
                        # 추론 과정 여부
                        if result.reasoning_content:
                            print(f"  추론과정: {len(result.reasoning_content)}자")
                        # 답변 미리보기 (처음 200자)
                        preview = result.answer[:200].replace('\n', ' ')
                        print(f"  답변미리보기: {preview}...")

                    # 요청 간격
                    await asyncio.sleep(1)

                # 조합별 통계
                print(f"\n--- {model_key} + {reasoning_level} 통계 ---")

                success_results = [r for r in results_for_combo if not r.error]
                error_count = len([r for r in results_for_combo if r.error])

                if success_results:
                    response_times = [r.response_time_ms for r in success_results]
                    answer_lengths = [len(r.answer) for r in success_results]

                    print(f"성공: {len(success_results)}/{TEST_COUNT}, 실패: {error_count}/{TEST_COUNT}")
                    print(f"평균 응답시간: {statistics.mean(response_times):.0f}ms")
                    print(f"응답시간 표준편차: {statistics.stdev(response_times) if len(response_times) > 1 else 0:.0f}ms")
                    print(f"평균 답변길이: {statistics.mean(answer_lengths):.0f}자")
                else:
                    print(f"모든 테스트 실패 ({error_count}건)")

    # 전체 결과 분석
    print_separator()
    print("\n전체 결과 분석")
    print_separator()

    # 모델별/추론수준별 분석
    for model_key in MODELS.keys():
        for reasoning_level in REASONING_LEVELS:
            combo_results = [
                r for r in all_results
                if model_key in r.model.lower() and r.reasoning_level == reasoning_level
            ]

            success_results = [r for r in combo_results if not r.error]

            print(f"\n## {model_key} + {reasoning_level}")

            if not success_results:
                print("  결과 없음 (모두 실패)")
                continue

            # 기본 통계
            response_times = [r.response_time_ms for r in success_results]
            answer_lengths = [len(r.answer) for r in success_results]
            top_scores = [r.top_score for r in success_results]

            print(f"  테스트 수: {len(success_results)}")
            print(f"  평균 응답시간: {statistics.mean(response_times):.0f}ms (최소: {min(response_times)}, 최대: {max(response_times)})")
            print(f"  평균 답변길이: {statistics.mean(answer_lengths):.0f}자")
            print(f"  평균 검색점수: {statistics.mean(top_scores):.4f}")

            # 답변 품질 분석
            quality_metrics = {
                "bullet_points": 0,
                "source_citation": 0,
                "empty_responses": 0,
                "error_responses": 0,
                "reasoning_visible": 0,
                "has_reasoning_content": 0
            }

            for r in success_results:
                analysis = analyze_answer(r.answer)
                if analysis["has_bullet_points"]:
                    quality_metrics["bullet_points"] += 1
                if analysis["has_source_citation"]:
                    quality_metrics["source_citation"] += 1
                if analysis["is_empty"]:
                    quality_metrics["empty_responses"] += 1
                if analysis["is_error_response"]:
                    quality_metrics["error_responses"] += 1
                if analysis["reasoning_visible"]:
                    quality_metrics["reasoning_visible"] += 1
                # reasoning_content 필드 유무 체크
                if r.reasoning_content:
                    quality_metrics["has_reasoning_content"] += 1

            total = len(success_results)
            print(f"  구조화된 답변(글머리): {quality_metrics['bullet_points']}/{total} ({quality_metrics['bullet_points']/total*100:.0f}%)")
            print(f"  출처 인용: {quality_metrics['source_citation']}/{total} ({quality_metrics['source_citation']/total*100:.0f}%)")
            print(f"  빈 응답: {quality_metrics['empty_responses']}/{total}")
            print(f"  오류 응답: {quality_metrics['error_responses']}/{total}")
            print(f"  추론과정(reasoning_content): {quality_metrics['has_reasoning_content']}/{total} ({quality_metrics['has_reasoning_content']/total*100:.0f}%)")

    # 상세 답변 출력
    print_separator()
    print("\n상세 답변 비교 (첫 번째 질문)")
    print_separator()

    first_q_results = [r for r in all_results if r.question == TEST_QUESTIONS[0]]

    for r in first_q_results:
        print(f"\n### {r.model} + {r.reasoning_level}")
        print(f"응답시간: {r.response_time_ms}ms")
        if r.error:
            print(f"오류: {r.error}")
        else:
            print(f"답변 ({len(r.answer)}자):")
            print("-" * 40)
            print(r.answer[:1500])
            if len(r.answer) > 1500:
                print(f"\n... (이하 {len(r.answer) - 1500}자 생략)")
        print("-" * 40)

    # 결과를 JSON 파일로 저장
    output_file = f"/data/docling-app/scripts/test_results_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    results_json = []
    for r in all_results:
        results_json.append({
            "question": r.question,
            "model": r.model,
            "reasoning_level": r.reasoning_level,
            "answer": r.answer,
            "reasoning_content": r.reasoning_content,
            "response_time_ms": r.response_time_ms,
            "token_count": r.token_count,
            "retrieved_docs_count": r.retrieved_docs_count,
            "top_score": r.top_score,
            "error": r.error
        })

    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(results_json, f, ensure_ascii=False, indent=2)

    print(f"\n결과 저장: {output_file}")
    print_separator()
    print(f"테스트 완료: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")


if __name__ == "__main__":
    asyncio.run(main())
