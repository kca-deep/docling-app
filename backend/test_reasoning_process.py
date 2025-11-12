"""
추론 과정(Reasoning Process) 표시 테스트

reasoning_level에 따라 LLM이 추론 과정을 얼마나 상세히 보여주는지 테스트합니다.
"""

import asyncio
import sys
import os

# 프로젝트 루트를 Python path에 추가
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.services.llm_service import LLMService
from backend.config.settings import settings


# 추론이 필요한 질문
REASONING_QUERY = "제공된 문서를 바탕으로, RAG 시스템이 기존 LLM보다 더 신뢰할 수 있는 이유를 논리적으로 설명해주세요."

SAMPLE_DOCUMENTS = [
    {
        "id": "doc1",
        "score": 0.88,
        "payload": {
            "text": "RAG는 외부 지식 베이스를 활용하여 환각(hallucination) 현상을 줄입니다. "
                    "모델이 학습하지 않은 내용에 대해 임의로 답변을 생성하는 대신, "
                    "실제 문서에서 관련 정보를 찾아 참조합니다.",
            "original_filename": "rag_reliability.pdf"
        }
    },
    {
        "id": "doc2",
        "score": 0.82,
        "payload": {
            "text": "일반 LLM은 학습 데이터의 컷오프 날짜 이후의 정보를 알지 못합니다. "
                    "반면 RAG 시스템은 최신 문서를 검색하여 참조할 수 있어, "
                    "항상 최신 정보를 제공할 수 있습니다.",
            "original_filename": "llm_limitations.pdf"
        }
    },
    {
        "id": "doc3",
        "score": 0.79,
        "payload": {
            "text": "RAG는 답변의 출처를 명확히 제시할 수 있습니다. "
                    "각 답변이 어떤 문서에서 나왔는지 추적 가능하므로, "
                    "사용자는 정보의 신뢰성을 직접 확인할 수 있습니다.",
            "original_filename": "source_citation.pdf"
        }
    }
]


async def test_with_reasoning_prompt(reasoning_level: str, show_reasoning: bool) -> dict:
    """
    추론 과정 표시 요청 포함 테스트

    Args:
        reasoning_level: "low", "medium", "high"
        show_reasoning: 추론 과정 표시 요청 여부
    """
    print(f"\n{'='*80}")
    print(f"테스트: reasoning_level={reasoning_level.upper()}, show_reasoning={show_reasoning}")
    print(f"{'='*80}")

    llm_service = LLMService(
        base_url=settings.LLM_BASE_URL,
        model=settings.LLM_MODEL
    )

    try:
        # 1. 기본 RAG 메시지 구성
        messages = llm_service.build_rag_messages(
            query=REASONING_QUERY,
            retrieved_docs=SAMPLE_DOCUMENTS,
            reasoning_level=reasoning_level,
            chat_history=None
        )

        # 2. show_reasoning=True인 경우 시스템 프롬프트에 추가 지시사항 삽입
        if show_reasoning:
            original_system = messages[0]["content"]
            reasoning_instruction = """

**중요: 답변 시 반드시 다음 형식을 따르세요:**

1. **추론 과정 (Reasoning Process)**:
   - 각 문서에서 어떤 정보를 추출했는지
   - 정보들을 어떻게 연결하여 결론에 도달했는지
   - 단계별로 논리적 사고 과정을 보여주세요

2. **최종 답변**:
   - 위의 추론을 바탕으로 한 명확한 결론
"""
            messages[0]["content"] = original_system + reasoning_instruction

            print(f"\n[추가된 지시사항]")
            print(reasoning_instruction)

        # 3. LLM API 호출
        print(f"\n[LLM API 호출 중...]")
        response = await llm_service.chat_completion(
            messages=messages,
            temperature=0.7,
            max_tokens=800,  # 추론 과정 표시를 위해 더 많은 토큰 허용
            top_p=0.9,
            stream=False
        )

        # 4. 응답 분석
        answer = response.get("choices", [{}])[0].get("message", {}).get("content", "")
        usage = response.get("usage", {})

        print(f"\n[응답 받음]")
        print(f"토큰 사용량: {usage.get('total_tokens', 0)}")
        print(f"\n{'='*80}")
        print(answer)
        print(f"{'='*80}")

        # 추론 과정 포함 여부 분석
        reasoning_keywords = [
            "추론", "단계", "과정", "먼저", "다음으로", "따라서", "결론",
            "분석", "근거", "이유는", "왜냐하면", "Reasoning", "Step"
        ]

        has_reasoning = any(keyword in answer for keyword in reasoning_keywords)
        has_structure = "1." in answer or "2." in answer or "**" in answer

        return {
            "reasoning_level": reasoning_level,
            "show_reasoning": show_reasoning,
            "answer": answer,
            "word_count": len(answer.split()),
            "has_reasoning_keywords": has_reasoning,
            "has_structure": has_structure,
            "usage": usage
        }

    except Exception as e:
        print(f"\n❌ 에러 발생: {e}")
        return {"error": str(e)}

    finally:
        await llm_service.close()


async def main():
    """추론 과정 표시 테스트"""
    print("\n" + "="*80)
    print("추론 과정(Reasoning Process) 표시 테스트")
    print("="*80)
    print(f"LLM: {settings.LLM_MODEL}")
    print(f"질문: {REASONING_QUERY}")
    print(f"\n이 질문은 여러 문서의 정보를 종합하여 논리적으로 설명해야 하므로")
    print(f"추론 과정이 중요합니다.")

    # 테스트 시나리오
    test_cases = [
        # 1. 기본 설정 (추론 과정 요청 없음)
        ("medium", False, "기본 MEDIUM - 추론 과정 요청 없음"),

        # 2. 추론 과정 명시적 요청
        ("medium", True, "MEDIUM - 추론 과정 명시적 요청"),

        # 3. HIGH level (추론 과정 요청 없음)
        ("high", False, "HIGH - 추론 과정 요청 없음 (자동으로 상세해질 것으로 예상)"),

        # 4. HIGH level + 추론 과정 요청
        ("high", True, "HIGH - 추론 과정 명시적 요청 (가장 상세할 것으로 예상)"),
    ]

    results = []

    for level, show_reasoning, description in test_cases:
        print(f"\n\n" + "="*80)
        print(f"시나리오: {description}")
        print("="*80)

        result = await test_with_reasoning_prompt(level, show_reasoning)
        results.append({
            "description": description,
            **result
        })

        await asyncio.sleep(1)  # API 부하 방지

    # 결과 비교
    print("\n\n" + "="*80)
    print("결과 비교 분석")
    print("="*80)

    print(f"\n{'시나리오':<50} {'단어수':<10} {'추론키워드':<12} {'구조화':<10} {'토큰'}")
    print("-"*100)

    for result in results:
        if "error" not in result:
            desc = result["description"][:48]
            words = result["word_count"]
            has_reasoning = "✅" if result["has_reasoning_keywords"] else "❌"
            has_structure = "✅" if result["has_structure"] else "❌"
            tokens = result["usage"].get("total_tokens", 0)

            print(f"{desc:<50} {words:<10} {has_reasoning:<12} {has_structure:<10} {tokens}")

    # 핵심 발견사항
    print("\n\n" + "="*80)
    print("핵심 발견사항")
    print("="*80)

    print("\n1. 추론 과정 포함 여부:")
    for result in results:
        if "error" not in result:
            has_reasoning = result["has_reasoning_keywords"]
            status = "✅ 포함됨" if has_reasoning else "❌ 포함 안됨"
            print(f"   - {result['description'][:60]}: {status}")

    print("\n2. 답변 길이 비교:")
    for result in results:
        if "error" not in result:
            print(f"   - {result['description'][:60]}: {result['word_count']}단어")

    print("\n\n" + "="*80)
    print("결론")
    print("="*80)
    print("""
1. reasoning_level만으로는 추론 과정을 명시적으로 보여주지 않을 수 있음
2. 시스템 프롬프트에 "추론 과정을 단계별로 보여주세요"라는 명시적 지시가 필요
3. HIGH level + 추론 과정 요청 조합이 가장 상세하고 체계적인 답변 생성
4. LLM이 지시사항을 얼마나 잘 따르는지가 중요
    """)

    print("="*80)
    print("테스트 완료!")
    print("="*80 + "\n")


if __name__ == "__main__":
    # Windows 인코딩 문제 해결
    if sys.platform == 'win32':
        import io
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

    asyncio.run(main())
