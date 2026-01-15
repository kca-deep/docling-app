#!/usr/bin/env python3
"""
GPT-OSS 20B Function Calling 지원 테스트
프로덕션 LLM 서버에서 tool_calls 응답이 정상적으로 반환되는지 확인
"""

import asyncio
import json
import sys
from pathlib import Path

# 프로젝트 루트를 path에 추가
sys.path.insert(0, str(Path(__file__).parent.parent))

import httpx

# 프로덕션 설정 (backend/.env에서 확인)
LLM_BASE_URL = "http://localhost:8080"
LLM_MODEL = "gpt-oss-20b"


def print_section(title: str):
    """섹션 구분선 출력"""
    print("\n" + "=" * 60)
    print(f"  {title}")
    print("=" * 60)


async def test_basic_chat():
    """기본 채팅 테스트 (Function Calling 없이)"""
    print_section("TEST 1: 기본 채팅 (Function Calling 없이)")

    url = f"{LLM_BASE_URL}/v1/chat/completions"
    payload = {
        "model": LLM_MODEL,
        "messages": [
            {"role": "user", "content": "안녕하세요. 간단히 인사해주세요."}
        ],
        "max_tokens": 100,
        "temperature": 0.7
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            response = await client.post(url, json=payload)
            print(f"Status: {response.status_code}")

            if response.status_code == 200:
                data = response.json()
                content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
                print(f"Response: {content[:200]}...")
                print("Result: PASS - 기본 채팅 정상 동작")
                return True
            else:
                print(f"Error: {response.text}")
                return False
        except Exception as e:
            print(f"Exception: {e}")
            return False


async def test_function_calling_simple():
    """간단한 Function Calling 테스트"""
    print_section("TEST 2: Function Calling (단순 도구)")

    url = f"{LLM_BASE_URL}/v1/chat/completions"
    payload = {
        "model": LLM_MODEL,
        "messages": [
            {"role": "user", "content": "서울의 현재 날씨를 알려줘"}
        ],
        "tools": [
            {
                "type": "function",
                "function": {
                    "name": "get_weather",
                    "description": "특정 도시의 현재 날씨를 조회합니다",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "city": {
                                "type": "string",
                                "description": "날씨를 조회할 도시명 (예: 서울, 부산)"
                            }
                        },
                        "required": ["city"]
                    }
                }
            }
        ],
        "max_tokens": 500,
        "temperature": 0.7
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            response = await client.post(url, json=payload)
            print(f"Status: {response.status_code}")

            if response.status_code == 200:
                data = response.json()
                print(f"Full Response:\n{json.dumps(data, indent=2, ensure_ascii=False)}")

                choice = data.get("choices", [{}])[0]
                message = choice.get("message", {})
                finish_reason = choice.get("finish_reason", "")

                tool_calls = message.get("tool_calls")
                content = message.get("content")

                print(f"\n--- Analysis ---")
                print(f"finish_reason: {finish_reason}")
                print(f"tool_calls: {tool_calls}")
                print(f"content: {content[:200] if content else 'None'}...")

                if tool_calls:
                    print("\nResult: PASS - tool_calls 정상 반환!")
                    return True
                elif finish_reason == "tool":
                    print("\nResult: PARTIAL - finish_reason=tool 이지만 tool_calls 없음")
                    return False
                else:
                    print("\nResult: FAIL - 텍스트만 반환됨 (Function Calling 미동작)")
                    return False
            else:
                print(f"Error Response: {response.text}")
                # tools 파라미터 지원 여부 확인
                if "tools" in response.text.lower() or "not supported" in response.text.lower():
                    print("\nResult: FAIL - 서버가 tools 파라미터를 지원하지 않음")
                return False
        except Exception as e:
            print(f"Exception: {e}")
            return False


async def test_function_calling_excel():
    """엑셀 내보내기 Function Calling 테스트 (실제 사용 시나리오)"""
    print_section("TEST 3: Function Calling (엑셀 내보내기)")

    url = f"{LLM_BASE_URL}/v1/chat/completions"
    payload = {
        "model": LLM_MODEL,
        "messages": [
            {"role": "system", "content": "당신은 데이터 분석 도우미입니다. 사용자가 파일 내보내기를 요청하면 적절한 도구를 호출하세요."},
            {"role": "user", "content": "분석 결과를 엑셀 파일로 다운로드 해줘"}
        ],
        "tools": [
            {
                "type": "function",
                "function": {
                    "name": "export_to_excel",
                    "description": "데이터를 엑셀 파일로 내보내기합니다",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "data": {
                                "type": "string",
                                "description": "내보낼 데이터 또는 내용"
                            },
                            "filename": {
                                "type": "string",
                                "description": "저장할 파일명 (확장자 제외)"
                            }
                        },
                        "required": ["data"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "export_to_docx",
                    "description": "데이터를 Word 문서로 내보내기합니다",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "content": {
                                "type": "string",
                                "description": "문서에 포함할 내용"
                            },
                            "title": {
                                "type": "string",
                                "description": "문서 제목"
                            }
                        },
                        "required": ["content"]
                    }
                }
            }
        ],
        "max_tokens": 500,
        "temperature": 0.7
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            response = await client.post(url, json=payload)
            print(f"Status: {response.status_code}")

            if response.status_code == 200:
                data = response.json()
                print(f"Full Response:\n{json.dumps(data, indent=2, ensure_ascii=False)}")

                choice = data.get("choices", [{}])[0]
                message = choice.get("message", {})
                finish_reason = choice.get("finish_reason", "")

                tool_calls = message.get("tool_calls")
                content = message.get("content")

                print(f"\n--- Analysis ---")
                print(f"finish_reason: {finish_reason}")

                if tool_calls:
                    print(f"tool_calls: {json.dumps(tool_calls, indent=2, ensure_ascii=False)}")
                    # 올바른 도구가 호출되었는지 확인
                    for tc in tool_calls:
                        func_name = tc.get("name") or tc.get("function", {}).get("name")
                        if func_name == "export_to_excel":
                            print("\nResult: PASS - export_to_excel 도구 호출 성공!")
                            return True
                    print("\nResult: PARTIAL - 다른 도구가 호출됨")
                    return False
                else:
                    print(f"content: {content[:300] if content else 'None'}...")

                    # 텍스트에서 도구 사용 의도 감지
                    if content and ("export_to_excel" in content or "도구" in content or "함수" in content):
                        print("\nResult: FAIL - 모델이 도구 사용을 언급하지만 실제 호출은 없음")
                    else:
                        print("\nResult: FAIL - 일반 텍스트 응답만 반환됨")
                    return False
            else:
                print(f"Error Response: {response.text}")
                return False
        except Exception as e:
            print(f"Exception: {e}")
            return False


async def test_streaming_with_tools():
    """스트리밍 모드에서 Function Calling 테스트"""
    print_section("TEST 4: Function Calling (스트리밍)")

    url = f"{LLM_BASE_URL}/v1/chat/completions"
    payload = {
        "model": LLM_MODEL,
        "messages": [
            {"role": "user", "content": "현재 시간을 알려줘"}
        ],
        "tools": [
            {
                "type": "function",
                "function": {
                    "name": "get_current_time",
                    "description": "현재 시간을 조회합니다",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "timezone": {
                                "type": "string",
                                "description": "타임존 (예: Asia/Seoul)"
                            }
                        }
                    }
                }
            }
        ],
        "stream": True,
        "max_tokens": 500,
        "temperature": 0.7
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            async with client.stream("POST", url, json=payload) as response:
                print(f"Status: {response.status_code}")

                if response.status_code != 200:
                    content = await response.aread()
                    print(f"Error: {content.decode()}")
                    return False

                full_content = ""
                tool_calls_found = False

                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        data_str = line[6:]
                        if data_str == "[DONE]":
                            break

                        try:
                            data = json.loads(data_str)
                            delta = data.get("choices", [{}])[0].get("delta", {})

                            if "tool_calls" in delta:
                                tool_calls_found = True
                                print(f"Tool Call Delta: {delta['tool_calls']}")

                            if "content" in delta and delta["content"]:
                                full_content += delta["content"]
                        except json.JSONDecodeError:
                            pass

                print(f"\nStreaming completed")
                print(f"tool_calls found: {tool_calls_found}")
                print(f"content: {full_content[:200]}..." if full_content else "content: None")

                if tool_calls_found:
                    print("\nResult: PASS - 스트리밍 모드에서 tool_calls 감지됨")
                    return True
                else:
                    print("\nResult: FAIL - 스트리밍 모드에서 tool_calls 없음")
                    return False

        except Exception as e:
            print(f"Exception: {e}")
            return False


async def test_server_info():
    """서버 정보 확인"""
    print_section("TEST 0: 서버 정보 확인")

    # /v1/models 엔드포인트 확인
    url = f"{LLM_BASE_URL}/v1/models"

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.get(url)
            print(f"Models Endpoint Status: {response.status_code}")
            if response.status_code == 200:
                data = response.json()
                print(f"Available Models: {json.dumps(data, indent=2, ensure_ascii=False)}")
        except Exception as e:
            print(f"Models Endpoint Error: {e}")

        # /health 또는 루트 엔드포인트 확인
        try:
            response = await client.get(LLM_BASE_URL)
            print(f"\nRoot Endpoint Status: {response.status_code}")
        except Exception as e:
            print(f"Root Endpoint Error: {e}")


async def main():
    """메인 테스트 실행"""
    print("\n" + "#" * 60)
    print("#  GPT-OSS 20B Function Calling Test Suite")
    print(f"#  Server: {LLM_BASE_URL}")
    print(f"#  Model: {LLM_MODEL}")
    print("#" * 60)

    results = {}

    # 테스트 실행
    await test_server_info()

    results["basic_chat"] = await test_basic_chat()
    results["function_calling_simple"] = await test_function_calling_simple()
    results["function_calling_excel"] = await test_function_calling_excel()
    results["streaming_with_tools"] = await test_streaming_with_tools()

    # 결과 요약
    print_section("TEST SUMMARY")

    all_passed = True
    for test_name, passed in results.items():
        status = "PASS" if passed else "FAIL"
        icon = "✅" if passed else "❌"
        print(f"  {icon} {test_name}: {status}")
        if not passed:
            all_passed = False

    print("\n" + "-" * 60)
    if all_passed:
        print("  Overall Result: ALL TESTS PASSED")
        print("  -> Function Calling 구현 가능!")
    elif results.get("function_calling_simple") or results.get("function_calling_excel"):
        print("  Overall Result: PARTIAL SUCCESS")
        print("  -> Function Calling 일부 동작, 추가 설정 필요")
    else:
        print("  Overall Result: FUNCTION CALLING NOT WORKING")
        print("  -> Option A (UI 버튼) 방식 권장")
    print("-" * 60 + "\n")

    return all_passed


if __name__ == "__main__":
    asyncio.run(main())
