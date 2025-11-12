"""
Reasoning Level 테스트

동일한 질문과 문서에 대해 reasoning_level (low/medium/high)에 따라
LLM 응답이 어떻게 달라지는지 테스트합니다.
"""

import asyncio
import sys
import os

# 프로젝트 루트를 Python path에 추가
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.services.llm_service import LLMService
from backend.config.settings import settings


# 테스트용 샘플 데이터
SAMPLE_QUERY = "RAG 시스템의 주요 장점은 무엇인가요?"

SAMPLE_DOCUMENTS = [
    {
        "id": "doc1",
        "score": 0.85,
        "payload": {
            "text": "RAG(Retrieval-Augmented Generation)는 대규모 언어 모델의 한계를 극복하기 위한 기술입니다. "
                    "외부 지식 베이스를 활용하여 최신 정보를 제공하고, 환각(hallucination) 현상을 줄일 수 있습니다. "
                    "또한 도메인 특화 문서를 참조하여 전문적인 답변이 가능합니다.",
            "original_filename": "rag_overview.pdf",
            "chunk_index": 0
        }
    },
    {
        "id": "doc2",
        "score": 0.78,
        "payload": {
            "text": "벡터 검색을 통해 의미적으로 유사한 문서를 빠르게 찾을 수 있습니다. "
                    "임베딩 모델은 텍스트를 고차원 벡터 공간에 매핑하여, 키워드 매칭이 아닌 의미 기반 검색이 가능합니다. "
                    "이를 통해 동의어나 유사 표현도 정확하게 검색할 수 있습니다.",
            "original_filename": "vector_search.pdf",
            "chunk_index": 1
        }
    },
    {
        "id": "doc3",
        "score": 0.72,
        "payload": {
            "text": "RAG 시스템은 비용 효율적입니다. 모든 지식을 모델에 학습시키는 대신, "
                    "필요한 정보만 검색하여 사용하므로 모델 크기를 줄일 수 있습니다. "
                    "또한 지식 업데이트가 용이하여 재학습 없이도 최신 정보를 반영할 수 있습니다.",
            "original_filename": "rag_benefits.pdf",
            "chunk_index": 2
        }
    }
]


async def test_reasoning_level(reasoning_level: str) -> dict:
    """
    특정 reasoning_level로 LLM 응답 테스트

    Args:
        reasoning_level: "low", "medium", "high"

    Returns:
        dict: 응답 결과
    """
    print(f"\n{'='*80}")
    print(f"테스트: reasoning_level = {reasoning_level.upper()}")
    print(f"{'='*80}")

    # LLM 서비스 초기화
    llm_service = LLMService(
        base_url=settings.LLM_BASE_URL,
        model=settings.LLM_MODEL
    )

    try:
        # 1. RAG 메시지 구성
        print(f"\n[1단계] RAG 메시지 구성 중...")
        messages = llm_service.build_rag_messages(
            query=SAMPLE_QUERY,
            retrieved_docs=SAMPLE_DOCUMENTS,
            reasoning_level=reasoning_level,
            chat_history=None
        )

        # 시스템 프롬프트 출력 (지시사항 부분만)
        system_content = messages[0]["content"]
        reasoning_instruction = system_content.split("4. ")[1].split("\n")[0] if "4. " in system_content else "N/A"
        print(f"   → 시스템 지시사항: {reasoning_instruction}")

        # 2. LLM API 호출
        print(f"\n[2단계] LLM API 호출 중...")
        response = await llm_service.chat_completion(
            messages=messages,
            temperature=0.7,
            max_tokens=500,  # 테스트용으로 제한
            top_p=0.9,
            stream=False
        )

        # 3. 응답 추출
        answer = response.get("choices", [{}])[0].get("message", {}).get("content", "")
        usage = response.get("usage", {})

        print(f"\n[3단계] 응답 받음")
        print(f"   → 토큰 사용량: {usage}")
        print(f"\n[응답 내용]")
        print(f"{'-'*80}")
        print(answer)
        print(f"{'-'*80}")

        # 응답 분석
        word_count = len(answer.split())
        line_count = len(answer.split('\n'))

        return {
            "reasoning_level": reasoning_level,
            "answer": answer,
            "word_count": word_count,
            "line_count": line_count,
            "usage": usage,
            "reasoning_instruction": reasoning_instruction
        }

    except Exception as e:
        print(f"\n❌ 에러 발생: {e}")
        return {
            "reasoning_level": reasoning_level,
            "error": str(e)
        }
    finally:
        await llm_service.close()


async def main():
    """모든 reasoning_level 테스트 실행"""
    print("\n" + "="*80)
    print("Reasoning Level 비교 테스트")
    print("="*80)
    print(f"LLM: {settings.LLM_MODEL}")
    print(f"API: {settings.LLM_BASE_URL}")
    print(f"질문: {SAMPLE_QUERY}")
    print(f"문서 개수: {len(SAMPLE_DOCUMENTS)}")

    # 3가지 reasoning_level 테스트
    reasoning_levels = ["low", "medium", "high"]
    results = []

    for level in reasoning_levels:
        result = await test_reasoning_level(level)
        results.append(result)
        await asyncio.sleep(1)  # API 부하 방지

    # 결과 비교 분석
    print("\n" + "="*80)
    print("결과 비교 분석")
    print("="*80)

    print(f"\n{'Level':<10} {'단어 수':<10} {'줄 수':<10} {'토큰 사용':<15} {'지시사항'}")
    print("-"*80)

    for result in results:
        if "error" not in result:
            level = result["reasoning_level"]
            word_count = result["word_count"]
            line_count = result["line_count"]
            tokens = result["usage"].get("total_tokens", 0)
            instruction = result["reasoning_instruction"][:40] + "..." if len(result["reasoning_instruction"]) > 40 else result["reasoning_instruction"]

            print(f"{level:<10} {word_count:<10} {line_count:<10} {tokens:<15} {instruction}")

    # 상세 비교
    print(f"\n{'='*80}")
    print("상세 비교")
    print(f"{'='*80}")

    for result in results:
        if "error" not in result:
            print(f"\n[{result['reasoning_level'].upper()}]")
            print(f"단어 수: {result['word_count']}")
            print(f"줄 수: {result['line_count']}")
            print(f"답변 길이: {len(result['answer'])} 문자")
            print(f"토큰: {result['usage'].get('total_tokens', 0)}")

    # 예상 결과
    print(f"\n{'='*80}")
    print("예상되는 차이점")
    print(f"{'='*80}")
    print("LOW:    간단하고 핵심만 담은 짧은 답변")
    print("MEDIUM: 적절한 설명과 예시를 포함한 중간 길이 답변")
    print("HIGH:   깊이 있는 분석, 추론, 상세한 설명을 포함한 긴 답변")

    print(f"\n{'='*80}")
    print("테스트 완료!")
    print(f"{'='*80}\n")


if __name__ == "__main__":
    # Windows 인코딩 문제 해결
    if sys.platform == 'win32':
        import io
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

    asyncio.run(main())
