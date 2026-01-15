"""
CBT 유의사항 질의 응답 오류 테스트

문제점:
1. reasoning_content가 answer로 그대로 출력됨
2. LLM이 "We need to answer user question..." 형태로 응답함

테스트 대상: Production API (localhost:8000)
"""
import httpx
import pytest
import json
from typing import Dict, Any


# 프로덕션 API URL
BASE_URL = "http://localhost:8000"
COLLECTION_NAME = "kca-cert-domain-faq"


class TestCBTResponse:
    """CBT 유의사항 질의 응답 테스트"""

    @pytest.fixture
    def client(self):
        """HTTP 클라이언트 생성"""
        return httpx.Client(base_url=BASE_URL, timeout=120.0)

    def test_cbt_query_response_structure(self, client):
        """
        CBT 유의사항 질의 시 응답 구조 테스트

        기대 결과:
        - answer는 사용자가 이해할 수 있는 한국어 답변이어야 함
        - reasoning_content와 answer가 동일하면 안 됨
        """
        response = client.post(
            "/api/chat/",
            json={
                "collection_name": COLLECTION_NAME,
                "message": "CBT 유의사항",
                "reasoning_level": "medium",
                "top_k": 5
            }
        )

        assert response.status_code == 200, f"API 호출 실패: {response.status_code}"

        data = response.json()

        # 기본 필드 존재 확인
        assert "answer" in data, "응답에 answer 필드가 없음"
        assert "retrieved_docs" in data, "응답에 retrieved_docs 필드가 없음"

        answer = data.get("answer", "")
        reasoning_content = data.get("reasoning_content", "")
        retrieved_docs = data.get("retrieved_docs", [])

        print("\n" + "=" * 60)
        print("테스트 결과")
        print("=" * 60)
        print(f"검색된 문서 수: {len(retrieved_docs)}")
        print(f"reasoning_content 길이: {len(reasoning_content)}")
        print(f"answer 길이: {len(answer)}")
        print("-" * 60)
        print(f"answer 내용:\n{answer[:500]}...")
        print("-" * 60)

        # 검색 결과 확인
        assert len(retrieved_docs) > 0, "검색된 문서가 없음 - 컬렉션 또는 검색 로직 문제"

        # 오류 1: answer가 영어로 시작하면 안 됨 (reasoning이 노출된 것)
        assert not answer.startswith("We need to"), \
            "오류: LLM reasoning이 answer로 노출됨"

        # 오류 2: reasoning_content와 answer가 동일하면 안 됨
        if reasoning_content:
            assert answer != reasoning_content, \
                "오류: reasoning_content와 answer가 동일함"

        # 정상 응답 확인: 한국어 또는 의미있는 응답인지
        has_korean = any('\uac00' <= char <= '\ud7a3' for char in answer)
        assert has_korean, "오류: answer에 한국어가 없음 - LLM 응답 처리 문제"

        print("✅ 테스트 통과: answer가 정상적인 한국어 응답임")

    def test_cbt_query_answer_quality(self, client):
        """
        CBT 유의사항 응답 품질 테스트

        기대 결과:
        - CBT 관련 키워드가 응답에 포함되어야 함
        """
        response = client.post(
            "/api/chat/",
            json={
                "collection_name": COLLECTION_NAME,
                "message": "CBT 유의사항을 알려주세요",
                "reasoning_level": "medium",
                "top_k": 5
            }
        )

        assert response.status_code == 200

        data = response.json()
        answer = data.get("answer", "")

        print("\n" + "=" * 60)
        print("응답 품질 테스트")
        print("=" * 60)
        print(f"answer:\n{answer[:1000]}")
        print("=" * 60)

        # CBT 관련 내용이 포함되어야 함
        cbt_keywords = ["시험", "응시", "CBT", "유의", "주의", "검정"]
        found_keywords = [kw for kw in cbt_keywords if kw in answer]

        assert len(found_keywords) > 0, \
            f"오류: CBT 관련 키워드가 없음. 응답: {answer[:200]}..."

        print(f"✅ 발견된 키워드: {found_keywords}")

    def test_streaming_response(self, client):
        """
        스트리밍 응답 테스트

        SSE 응답에서도 동일한 문제가 있는지 확인
        """
        with client.stream(
            "POST",
            "/api/chat/stream",
            json={
                "collection_name": COLLECTION_NAME,
                "message": "CBT 유의사항",
                "reasoning_level": "medium",
                "top_k": 5
            }
        ) as response:
            assert response.status_code == 200

            full_content = ""
            sources_received = False

            for line in response.iter_lines():
                if not line:
                    continue

                if line.startswith("data: "):
                    data_str = line[6:]
                    if data_str == "[DONE]":
                        break

                    try:
                        chunk = json.loads(data_str)

                        # sources 이벤트 확인
                        if "sources" in chunk:
                            sources_received = True
                            print(f"\n소스 문서 수신: {len(chunk['sources'])}개")

                        # content 추출
                        if "choices" in chunk:
                            delta = chunk["choices"][0].get("delta", {})
                            content = delta.get("content", "")
                            full_content += content

                    except json.JSONDecodeError:
                        continue

            print("\n" + "=" * 60)
            print("스트리밍 응답 테스트")
            print("=" * 60)
            print(f"전체 응답 길이: {len(full_content)}")
            print(f"sources 수신: {sources_received}")
            print(f"응답 내용:\n{full_content[:500]}...")
            print("=" * 60)

            # 스트리밍에서도 동일한 오류 확인
            assert not full_content.startswith("We need to"), \
                "오류: 스트리밍에서도 LLM reasoning이 노출됨"

            has_korean = any('\uac00' <= char <= '\ud7a3' for char in full_content)
            assert has_korean, "오류: 스트리밍 응답에 한국어가 없음"

            print("✅ 스트리밍 테스트 통과")


if __name__ == "__main__":
    # 직접 실행 시 테스트
    client = httpx.Client(base_url=BASE_URL, timeout=120.0)
    test = TestCBTResponse()

    print("\n🔍 테스트 1: 응답 구조 테스트")
    try:
        test.test_cbt_query_response_structure(client)
    except AssertionError as e:
        print(f"❌ 실패: {e}")

    print("\n🔍 테스트 2: 응답 품질 테스트")
    try:
        test.test_cbt_query_answer_quality(client)
    except AssertionError as e:
        print(f"❌ 실패: {e}")

    print("\n🔍 테스트 3: 스트리밍 응답 테스트")
    try:
        test.test_streaming_response(client)
    except AssertionError as e:
        print(f"❌ 실패: {e}")
