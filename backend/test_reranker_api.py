"""
BGE Reranker v2-m3 API 통합 테스트

이 스크립트는 http://kca-ai.kro.kr:8006의 BGE Reranker API를 테스트합니다.
- 기본 rerank 요청
- top_n 파라미터 테스트
- relevance_score 순서 검증
- 에러 핸들링 테스트
"""

import asyncio
import httpx
from typing import List, Dict, Any, Optional
import json
from datetime import datetime
import sys
import io

# Windows 인코딩 문제 해결
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')


# Reranker API 설정
RERANKER_URL = "http://kca-ai.kro.kr:8006"
RERANKER_MODEL = "BAAI/bge-reranker-v2-m3"
RERANKER_TIMEOUT = 30.0


def get_sample_documents() -> List[str]:
    """테스트용 샘플 문서 준비"""
    return [
        "RAG(Retrieval-Augmented Generation)는 대규모 언어 모델의 성능을 향상시키기 위해 외부 지식 베이스를 활용하는 기술입니다.",
        "벡터 검색은 텍스트를 임베딩 벡터로 변환하여 의미적 유사도를 기반으로 검색하는 방법입니다.",
        "Python은 데이터 과학과 머신러닝 분야에서 가장 인기 있는 프로그래밍 언어입니다.",
        "Qdrant는 벡터 유사도 검색을 위한 고성능 벡터 데이터베이스입니다.",
        "BGE-M3는 다국어를 지원하는 임베딩 모델로, 검색 성능이 뛰어납니다.",
        "Cross-encoder 방식의 reranker는 bi-encoder 기반 벡터 검색보다 더 정확한 관련도 점수를 제공합니다.",
        "FastAPI는 Python으로 고성능 API를 구축하기 위한 현대적인 웹 프레임워크입니다.",
        "임베딩 모델은 텍스트를 고차원 벡터 공간으로 변환하여 의미적 유사도를 계산할 수 있게 합니다.",
        "의미적 검색(Semantic Search)은 키워드 매칭이 아닌 의미 기반으로 문서를 검색하는 기술입니다.",
        "Reranking은 초기 검색 결과를 재정렬하여 가장 관련성 높은 문서를 상위에 배치하는 과정입니다.",
    ]


async def rerank_documents(
    query: str,
    documents: List[str],
    top_n: Optional[int] = None,
    return_documents: bool = True,
    timeout: float = RERANKER_TIMEOUT
) -> Dict[str, Any]:
    """
    Reranker API를 호출하여 문서를 재순위

    Args:
        query: 사용자 질문
        documents: 재순위할 문서 리스트
        top_n: 반환할 상위 문서 수 (None이면 모두 반환)
        return_documents: 문서 텍스트 포함 여부
        timeout: 요청 타임아웃 (초)

    Returns:
        Reranker API 응답 딕셔너리

    Raises:
        httpx.TimeoutException: 타임아웃 발생
        httpx.HTTPStatusError: HTTP 에러 응답
        httpx.RequestError: 네트워크 에러
    """
    url = f"{RERANKER_URL}/v1/rerank"

    payload = {
        "model": RERANKER_MODEL,
        "query": query,
        "documents": documents,
        "return_documents": return_documents
    }

    if top_n is not None:
        payload["top_n"] = top_n

    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(url, json=payload)
        response.raise_for_status()
        return response.json()


async def test_rerank_basic():
    """기본 rerank 요청 테스트"""
    print("\n" + "="*80)
    print("테스트 1: 기본 Rerank 요청")
    print("="*80)

    query = "RAG 시스템에서 벡터 검색의 장점은 무엇인가?"
    documents = get_sample_documents()

    print(f"\n질문: {query}")
    print(f"문서 개수: {len(documents)}")

    try:
        result = await rerank_documents(query, documents)

        print(f"\n응답 받음:")
        print(f"- Model: {result.get('model')}")
        print(f"- Result Count: {len(result.get('results', []))}")

        print("\n상위 5개 결과:")
        for i, res in enumerate(result['results'][:5], 1):
            print(f"\n{i}. Index: {res['index']} | Score: {res['relevance_score']:.4f}")
            print(f"   문서: {documents[res['index']][:80]}...")

        return True
    except Exception as e:
        print(f"\n❌ 에러 발생: {type(e).__name__}: {e}")
        return False


async def test_rerank_with_top_n():
    """top_n 파라미터 테스트"""
    print("\n" + "="*80)
    print("테스트 2: top_n 파라미터 테스트")
    print("="*80)

    query = "벡터 데이터베이스와 임베딩에 대해 설명해주세요"
    documents = get_sample_documents()
    top_n = 3

    print(f"\n질문: {query}")
    print(f"문서 개수: {len(documents)}")
    print(f"top_n: {top_n}")

    try:
        result = await rerank_documents(query, documents, top_n=top_n)

        result_count = len(result.get('results', []))
        print(f"\n반환된 결과 개수: {result_count}")

        if result_count == top_n:
            print(f"✅ top_n 파라미터 정상 동작 (요청: {top_n}, 응답: {result_count})")
        else:
            print(f"⚠️ top_n 불일치 (요청: {top_n}, 응답: {result_count})")

        print("\n결과:")
        for i, res in enumerate(result['results'], 1):
            print(f"{i}. Score: {res['relevance_score']:.4f} | {documents[res['index']][:60]}...")

        return result_count == top_n
    except Exception as e:
        print(f"\n❌ 에러 발생: {type(e).__name__}: {e}")
        return False


async def test_rerank_score_ordering():
    """relevance_score 정렬 순서 검증"""
    print("\n" + "="*80)
    print("테스트 3: Relevance Score 정렬 순서 검증")
    print("="*80)

    query = "Reranker와 Cross-encoder의 작동 원리"
    documents = get_sample_documents()

    print(f"\n질문: {query}")

    try:
        result = await rerank_documents(query, documents)

        scores = [res['relevance_score'] for res in result['results']]
        is_descending = all(scores[i] >= scores[i+1] for i in range(len(scores)-1))

        print(f"\nScore 개수: {len(scores)}")
        print(f"최고 Score: {max(scores):.4f}")
        print(f"최저 Score: {min(scores):.4f}")
        print(f"내림차순 정렬 여부: {is_descending}")

        if is_descending:
            print("✅ Relevance score가 올바르게 내림차순 정렬됨")
        else:
            print("⚠️ Relevance score 정렬 순서 문제 발견")
            print(f"Scores: {scores[:5]}...")

        return is_descending
    except Exception as e:
        print(f"\n❌ 에러 발생: {type(e).__name__}: {e}")
        return False


async def test_rerank_with_metadata():
    """메타데이터 포함 문서 테스트"""
    print("\n" + "="*80)
    print("테스트 4: 메타데이터 포함 문서 테스트")
    print("="*80)

    query = "임베딩 모델의 활용 사례"

    # 객체 형태의 문서 (메타데이터 포함)
    documents = [
        {
            "text": "RAG(Retrieval-Augmented Generation)는 대규모 언어 모델의 성능을 향상시킵니다.",
            "metadata": {"source": "doc1.pdf", "page": 1}
        },
        {
            "text": "임베딩 모델은 텍스트를 고차원 벡터 공간으로 변환합니다.",
            "metadata": {"source": "doc2.pdf", "page": 3}
        },
        {
            "text": "Python은 데이터 과학 분야에서 널리 사용됩니다.",
            "metadata": {"source": "doc3.pdf", "page": 5}
        }
    ]

    print(f"\n질문: {query}")
    print(f"문서 형태: 객체 (text + metadata)")

    try:
        result = await rerank_documents(query, documents, top_n=2)

        print(f"\n✅ 메타데이터 포함 문서 처리 성공")
        print(f"반환된 결과 개수: {len(result.get('results', []))}")

        for i, res in enumerate(result['results'], 1):
            doc = documents[res['index']]
            print(f"\n{i}. Score: {res['relevance_score']:.4f}")
            print(f"   문서: {doc['text'][:60]}...")
            print(f"   메타: {doc['metadata']}")

        return True
    except Exception as e:
        print(f"\n❌ 에러 발생: {type(e).__name__}: {e}")
        print(f"   메타데이터 포함 문서는 API에서 지원하지 않을 수 있습니다.")
        return False


async def test_rerank_timeout():
    """타임아웃 처리 테스트"""
    print("\n" + "="*80)
    print("테스트 5: 타임아웃 처리 테스트")
    print("="*80)

    query = "테스트 질문"
    documents = get_sample_documents()

    # 매우 짧은 타임아웃 설정 (0.001초)
    print(f"\n타임아웃: 0.001초 (의도적으로 매우 짧게 설정)")

    try:
        result = await rerank_documents(query, documents, timeout=0.001)
        print(f"\n⚠️ 타임아웃이 발생하지 않음 (예상 밖)")
        return False
    except httpx.TimeoutException as e:
        print(f"\n✅ 타임아웃 정상 처리: {type(e).__name__}")
        return True
    except Exception as e:
        print(f"\n⚠️ 다른 에러 발생: {type(e).__name__}: {e}")
        return False


async def test_rerank_error_handling():
    """에러 핸들링 테스트"""
    print("\n" + "="*80)
    print("테스트 6: 에러 핸들링 테스트")
    print("="*80)

    # 잘못된 요청 (빈 documents)
    query = "테스트 질문"
    documents = []

    print(f"\n의도적으로 잘못된 요청 전송 (빈 documents)")

    try:
        result = await rerank_documents(query, documents)
        print(f"\n⚠️ 에러가 발생하지 않음 (예상 밖)")
        return False
    except httpx.HTTPStatusError as e:
        print(f"\n✅ HTTP 에러 정상 감지: {e.response.status_code}")
        print(f"   응답: {e.response.text[:200]}")
        return True
    except Exception as e:
        print(f"\n✅ 에러 감지: {type(e).__name__}: {e}")
        return True


async def test_rerank_return_documents_false():
    """return_documents=False 테스트"""
    print("\n" + "="*80)
    print("테스트 7: return_documents=False 테스트")
    print("="*80)

    query = "벡터 검색과 임베딩"
    documents = get_sample_documents()[:5]

    print(f"\n질문: {query}")
    print(f"return_documents: False")

    try:
        result = await rerank_documents(query, documents, return_documents=False, top_n=3)

        print(f"\n응답 받음:")
        print(f"- Result Count: {len(result.get('results', []))}")

        has_document_field = any('document' in res for res in result['results'])

        if not has_document_field:
            print("✅ return_documents=False 정상 동작 (document 필드 없음)")
        else:
            print("⚠️ return_documents=False인데 document 필드 포함됨")

        print("\n결과 (document 필드 제외):")
        for i, res in enumerate(result['results'], 1):
            print(f"{i}. Index: {res['index']}, Score: {res['relevance_score']:.4f}")

        return not has_document_field
    except Exception as e:
        print(f"\n❌ 에러 발생: {type(e).__name__}: {e}")
        return False


async def main():
    """모든 테스트 실행"""
    print("\n" + "="*80)
    print("BGE Reranker v2-m3 API 통합 테스트 시작")
    print(f"시간: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"API URL: {RERANKER_URL}")
    print(f"Model: {RERANKER_MODEL}")
    print("="*80)

    tests = [
        ("기본 Rerank 요청", test_rerank_basic),
        ("top_n 파라미터", test_rerank_with_top_n),
        ("Score 정렬 순서", test_rerank_score_ordering),
        ("메타데이터 포함 문서", test_rerank_with_metadata),
        ("타임아웃 처리", test_rerank_timeout),
        ("에러 핸들링", test_rerank_error_handling),
        ("return_documents=False", test_rerank_return_documents_false),
    ]

    results = []
    for test_name, test_func in tests:
        try:
            result = await test_func()
            results.append((test_name, result))
        except Exception as e:
            print(f"\n❌ 테스트 실행 중 예외 발생: {e}")
            results.append((test_name, False))

        # 테스트 간 짧은 대기
        await asyncio.sleep(0.5)

    # 결과 요약
    print("\n" + "="*80)
    print("테스트 결과 요약")
    print("="*80)

    passed = sum(1 for _, result in results if result)
    total = len(results)

    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} | {test_name}")

    print(f"\n총 {total}개 테스트 중 {passed}개 통과 ({passed/total*100:.1f}%)")
    print("="*80)


if __name__ == "__main__":
    asyncio.run(main())
