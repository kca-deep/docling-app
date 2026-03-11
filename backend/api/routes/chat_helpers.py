"""
Chat 헬퍼 모듈
- 내보내기 의도 감지 (FORMAT_KEYWORDS, detect_export_format, might_be_export_request)
- 공통 헬퍼 함수들 (convert_chat_history, build_llm_params 등)
- 스트리밍 청크 처리 유틸리티 (process_llm_stream_chunk)
- Tool Call 처리 스트림 (process_tool_calls_stream)
- 백그라운드 로깅 태스크 (log_chat_interaction_task)
"""
import json
import logging
import re
import uuid
import time
from typing import Optional, Dict, Any, AsyncGenerator, List

from fastapi import BackgroundTasks, Request

from backend.config.export_config import export_config
from backend.middleware.request_tracking import get_tracking_ids
from backend.utils.client_info import extract_client_info
from backend.models.schemas import ChatRequest
from backend.services.hybrid_logging_service import hybrid_logging_service
from backend.services.conversation_service import conversation_service
from backend.utils.exaone_utils import clean_thought_tags_simple
from backend.utils.source_converter import extract_sources_info

logger = logging.getLogger("uvicorn")


# ============================================================================
# Function Calling 내보내기 의도 감지 (하이브리드 방식)
# - 느슨한 힌트 기반 사전 필터 + LLM 최종 판단
# - 설정은 backend/config/export_config.yaml에서 로드
# ============================================================================

# 형식별 키워드 매핑 (detect_export_format용)
# LLM이 최종 판단하므로 여기서는 대표 키워드만 유지
FORMAT_KEYWORDS = {
    "excel": ["엑셀", "excel", "xlsx", "xls", "스프레드시트"],
    "docx": ["워드", "word", "docx", "doc"],
    "pdf": ["pdf", "피디에프"],
    "md": ["마크다운", "markdown", "md", ".md"],
    "txt": ["텍스트", "txt", "텍스트파일", "text"],
}


def detect_export_format(message: str) -> str | None:
    """
    사용자 메시지에서 요청된 내보내기 형식을 감지합니다.
    LLM이 도구를 선택하기 전에 특정 형식 도구만 활성화하기 위한 힌트로 사용.

    Args:
        message: 사용자 메시지

    Returns:
        str | None: 감지된 형식 (excel, docx, pdf, md, txt) 또는 None
    """
    message_lower = message.lower()

    for format_type, keywords in FORMAT_KEYWORDS.items():
        for keyword in keywords:
            if keyword.lower() in message_lower:
                return format_type
    return None


def might_be_export_request(message: str) -> bool:
    """
    내보내기 요청 가능성이 있는지 간단히 확인합니다.
    느슨한 필터로 가능성이 있으면 True를 반환하고, LLM이 최종 판단합니다.
    힌트 키워드 2개 이상 매칭 시 가능성 있음으로 판단합니다.

    Args:
        message: 사용자 메시지

    Returns:
        bool: 내보내기 요청 가능성이 있으면 True
    """
    message_lower = message.lower()

    # 설정 파일에서 힌트와 임계값 로드
    hints = export_config.get_all_hints()
    min_matches = export_config.get_min_match_count()

    # 힌트 매칭 카운트
    matches = sum(1 for hint in hints if hint.lower() in message_lower)

    is_possible = matches >= min_matches

    if is_possible:
        logger.debug(f"[EXPORT DETECT] Possible export request detected: {matches} hints matched (threshold: {min_matches})")

    return is_possible


# ============================================================================
# 공통 헬퍼 함수들
# ============================================================================

def convert_chat_history(chat_history: Optional[list]) -> Optional[list]:
    """채팅 기록을 내부 포맷으로 변환"""
    if not chat_history:
        return None
    return [{"role": msg.role, "content": msg.content} for msg in chat_history]


def build_llm_params(request) -> Dict[str, Any]:
    """LLM 파라미터 딕셔너리 생성"""
    return {
        "temperature": request.temperature,
        "max_tokens": request.max_tokens,
        "top_p": request.top_p
    }


def convert_docs_to_internal(docs: list) -> list:
    """RetrievedDocument 리스트를 내부 포맷으로 변환"""
    result = []
    for doc in docs:
        payload = {"text": doc.text}
        if doc.metadata:
            payload.update(doc.metadata)
        result.append({
            "id": doc.id,
            "score": doc.score,
            "payload": payload
        })
    return result


def prepare_chat_context(
    chat_request: ChatRequest,
    request: Request
) -> Dict[str, Any]:
    """
    채팅 요청의 공통 컨텍스트 초기화
    chat()와 chat_stream() 엔드포인트에서 공통 사용
    """
    # 추적 정보 추출
    tracking_ids = get_tracking_ids(request)
    client_info = extract_client_info(request)

    # 컬렉션 결정: temp_collection_name > collection_name > None (일상대화)
    effective_collection = chat_request.temp_collection_name or chat_request.collection_name
    is_casual_mode = not effective_collection
    is_temp_mode = bool(chat_request.temp_collection_name)

    # conversation_id 처리
    if not chat_request.conversation_id:
        chat_request.conversation_id = str(uuid.uuid4())

    # session_id 처리
    session_id = chat_request.session_id or str(uuid.uuid4())

    # 대화 시작
    conversation_id = conversation_service.start_conversation(
        conversation_id=chat_request.conversation_id,
        collection_name=effective_collection or "casual"
    )

    return {
        "tracking_ids": tracking_ids,
        "client_info": client_info,
        "effective_collection": effective_collection,
        "is_casual_mode": is_casual_mode,
        "is_temp_mode": is_temp_mode,
        "session_id": session_id,
        "conversation_id": conversation_id,
        "collection_display": effective_collection or "(일상대화)",
        "chat_history": convert_chat_history(chat_request.chat_history)
    }


def log_chat_request(context: Dict[str, Any], chat_request: ChatRequest, endpoint: str):
    """채팅 요청 로깅"""
    logger.info("=" * 80)
    logger.info(f"[CHAT API] {endpoint} endpoint called")
    logger.info(f"[CHAT API] Request ID: {context['tracking_ids'].get('request_id')}")
    logger.info(f"[CHAT API] Requested model: {chat_request.model}")
    logger.info(f"[CHAT API] Collection: {context['collection_display']}")
    mode = 'Casual' if context['is_casual_mode'] else ('TempDoc' if context['is_temp_mode'] else 'RAG')
    logger.info(f"[CHAT API] Mode: {mode}")
    logger.info(f"[CHAT API] Message: {chat_request.message[:50]}...")
    logger.info("=" * 80)


def schedule_error_logging(
    background_tasks: BackgroundTasks,
    context: Dict[str, Any],
    request,
    error: Exception,
    start_time: float
):
    """에러 발생 시 로깅 태스크 스케줄링"""
    error_info = {
        "error_type": type(error).__name__,
        "error_message": str(error)
    }

    # request 타입에 따라 message 추출
    message = getattr(request, 'message', None) or f"[REGENERATE] {getattr(request, 'query', '')}"
    collection = context.get('effective_collection') or getattr(request, 'collection_name', None) or "casual"

    background_tasks.add_task(
        log_chat_interaction_task,
        session_id=context.get('session_id', str(uuid.uuid4())),
        conversation_id=context.get('conversation_id', str(uuid.uuid4())),
        collection_name=collection,
        message=message,
        response_data={},
        reasoning_level=request.reasoning_level,
        model=request.model,
        llm_params=build_llm_params(request),
        performance_metrics={
            "response_time_ms": int((time.time() - start_time) * 1000)
        },
        error_info=error_info,
        request_id=context.get('tracking_ids', {}).get("request_id"),
        trace_id=context.get('tracking_ids', {}).get("trace_id"),
        client_info=context.get('client_info')
    )


# ============================================================================
# 스트리밍 청크 처리 유틸리티
# ============================================================================

def process_llm_stream_chunk(
    chunk: str,
    is_exaone: bool,
    collected_response: dict,
    log_prefix: str = "[STREAM]",
    debug_logging: bool = False
) -> list:
    """
    LLM 스트리밍 청크 처리 - 공통 유틸리티

    Args:
        chunk: SSE 청크 문자열
        is_exaone: EXAONE 모델 여부
        collected_response: 응답 수집 딕셔너리 (mutated)
        log_prefix: 로그 접두사
        debug_logging: 디버그 로깅 활성화

    Returns:
        list: yield할 SSE 청크 목록
    """
    chunks_to_yield = []

    if not chunk.startswith('data: '):
        # [DONE] 처리
        if 'data: [DONE]' in chunk:
            rc_len = len(collected_response.get("reasoning_content", ""))
            ans_len = len(collected_response.get("answer", ""))
            logger.info(f"{log_prefix} [DONE] detected, reasoning: {rc_len} chars, answer: {ans_len} chars")
            chunks_to_yield.append(chunk)
        elif not is_exaone:
            chunks_to_yield.append(chunk)
        return chunks_to_yield

    try:
        data_str = chunk[6:]  # 'data: ' 제거
        if not data_str.strip() or data_str == '[DONE]':
            if 'data: [DONE]' in chunk:
                chunks_to_yield.append(chunk)
            return chunks_to_yield

        data = json.loads(data_str)

        # OpenAI 호환 API: choices[0].delta에서 추출
        if 'choices' in data and data['choices']:
            choice = data['choices'][0]
            delta = choice.get('delta', {})
            content = delta.get('content', '')
            reasoning_content = delta.get('reasoning_content', '')

            # 최종 message에서 reasoning_content 확인 (일부 서버에서 지원)
            message = choice.get('message', {})
            if message.get('reasoning_content'):
                reasoning_content = message.get('reasoning_content', '')
                logger.info(f"{log_prefix} Got reasoning_content from message: {len(reasoning_content)} chars")

            # 디버그 로깅 (처음 3개 청크만)
            if debug_logging and len(collected_response.get("answer", "")) < 50:
                logger.info(f"{log_prefix} Full chunk: {data}")
                logger.info(f"{log_prefix} choice keys: {list(choice.keys())}, delta keys: {list(delta.keys())}")

            # EXAONE 모델 처리
            if is_exaone:
                if reasoning_content:
                    # 첫 번째 reasoning_content 수신 시 "reasoning" 단계 이벤트 전송
                    if not collected_response.get("_reasoning_stage_sent"):
                        chunks_to_yield.append(f'data: {json.dumps({"type": "stage", "stage": "reasoning"})}\n\n')
                        collected_response["_reasoning_stage_sent"] = True
                    collected_response["reasoning_content"] = collected_response.get("reasoning_content", "") + reasoning_content
                    chunks_to_yield.append(f'data: {json.dumps({"type": "reasoning_chunk", "content": reasoning_content})}\n\n')

                if content:
                    clean_content = clean_thought_tags_simple(content)
                    if clean_content:
                        collected_response["answer"] = collected_response.get("answer", "") + clean_content
                        chunks_to_yield.append(f'data: {json.dumps({"choices": [{"delta": {"content": clean_content}, "index": 0}]})}\n\n')
            else:
                # GPT-OSS 및 기타 모델
                if content:
                    collected_response["answer"] = collected_response.get("answer", "") + content
                if reasoning_content:
                    # 첫 번째 reasoning_content 수신 시 "reasoning" 단계 이벤트 전송
                    if not collected_response.get("_reasoning_stage_sent"):
                        chunks_to_yield.append(f'data: {json.dumps({"type": "stage", "stage": "reasoning"})}\n\n')
                        collected_response["_reasoning_stage_sent"] = True
                    logger.info(f"{log_prefix} Got reasoning_content chunk: {len(reasoning_content)} chars")
                    collected_response["reasoning_content"] = collected_response.get("reasoning_content", "") + reasoning_content
                    chunks_to_yield.append(f'data: {json.dumps({"type": "reasoning_chunk", "content": reasoning_content})}\n\n')

        # sources/retrieved_docs/usage/error 처리 (chat_stream 호환)
        if 'sources' in data:
            collected_response["retrieved_docs"] = data['sources']
            if is_exaone:
                chunks_to_yield.append(f'data: {json.dumps({"sources": data["sources"]})}\n\n')
        # sources_update: 리랭킹 후 최종 점수로 업데이트 (로깅에 반영)
        if 'sources_update' in data:
            collected_response["retrieved_docs"] = data['sources_update']
        if 'retrieved_docs' in data:
            collected_response["retrieved_docs"] = data['retrieved_docs']
        if 'usage' in data:
            collected_response["usage"] = data['usage']
        if 'error' in data and data['error']:
            error_message = data['error']
            collected_response["answer"] = error_message
            logger.warning(f"{log_prefix} Error response received: {error_message[:100]}")

        # Function Calling: tool_calls 감지 및 누적
        if 'choices' in data and data['choices']:
            choice = data['choices'][0]
            finish_reason = choice.get('finish_reason')
            delta = choice.get('delta', {})
            message = choice.get('message', {})

            # tool_calls 수집 (delta 또는 message에서)
            tool_calls_chunk = delta.get('tool_calls') or message.get('tool_calls')
            if tool_calls_chunk:
                # tool_calls를 인덱스별로 누적 (스트리밍에서 조각으로 전달됨)
                if "tool_calls_accumulator" not in collected_response:
                    collected_response["tool_calls_accumulator"] = {}

                for tc in tool_calls_chunk:
                    idx = tc.get('index', 0)
                    if idx not in collected_response["tool_calls_accumulator"]:
                        # 새 tool_call 시작
                        collected_response["tool_calls_accumulator"][idx] = {
                            "id": tc.get('id', ''),
                            "type": tc.get('type', 'function'),
                            "function": {
                                "name": tc.get('function', {}).get('name', ''),
                                "arguments": tc.get('function', {}).get('arguments', '')
                            }
                        }
                    else:
                        # 기존 tool_call에 데이터 추가
                        existing = collected_response["tool_calls_accumulator"][idx]
                        if tc.get('id'):
                            existing['id'] = tc['id']
                        if tc.get('type'):
                            existing['type'] = tc['type']
                        if tc.get('function', {}).get('name'):
                            existing['function']['name'] = tc['function']['name']
                        if tc.get('function', {}).get('arguments'):
                            existing['function']['arguments'] += tc['function']['arguments']

            # finish_reason이 tool_calls인 경우 누적된 데이터를 최종 tool_calls로 변환
            if finish_reason == "tool_calls":
                collected_response["finish_reason"] = "tool_calls"
                if "tool_calls_accumulator" in collected_response:
                    # 인덱스 순서대로 정렬하여 리스트로 변환
                    collected_response["tool_calls"] = [
                        collected_response["tool_calls_accumulator"][idx]
                        for idx in sorted(collected_response["tool_calls_accumulator"].keys())
                    ]
                    logger.info(f"{log_prefix} finish_reason=tool_calls, accumulated {len(collected_response['tool_calls'])} tool calls")

    except json.JSONDecodeError:
        pass

    # [DONE] 처리 (chunk 내부에 포함된 경우)
    if 'data: [DONE]' in chunk:
        rc_len = len(collected_response.get("reasoning_content", ""))
        ans_len = len(collected_response.get("answer", ""))
        logger.info(f"{log_prefix} [DONE] detected, reasoning: {rc_len} chars, answer: {ans_len} chars")
        chunks_to_yield.append(chunk)
    elif not is_exaone and not chunks_to_yield:
        # EXAONE이 아니고 아직 yield할 것이 없으면 원본 전달
        chunks_to_yield.append(chunk)

    return chunks_to_yield


# ============================================================================
# Tool Call 처리 스트림
# ============================================================================

# 도구 실행 후 LLM 후속 응답 생성을 위한 시스템 프롬프트
TOOL_FOLLOWUP_SYSTEM_PROMPT = """도구 실행 결과를 바탕으로 사용자에게 간단히 안내해주세요.
규칙:
- 파일 다운로드는 시스템에서 자동으로 처리됩니다
- URL이나 링크를 절대 생성하지 마세요
- {{url}}, [링크], http:// 등의 형태를 사용하지 마세요
- 단순히 "파일이 생성되어 다운로드가 시작되었습니다" 정도로 안내하세요
- 1-2문장으로 간결하게 응답하세요"""


async def process_tool_calls_stream(
    tool_calls: list,
    user_message: str,
    model: str,
    is_exaone: bool,
    chat_history: Optional[list],
    tool_executor_instance,
    llm_service_instance,
) -> AsyncGenerator[str, None]:
    """
    Tool Call 처리 및 후속 LLM 응답 스트리밍

    LLM이 생성한 tool_calls를 실행하고, 결과를 SSE 이벤트로 전송한 후,
    도구 실행 결과를 기반으로 LLM 후속 응답을 스트리밍합니다.

    Args:
        tool_calls: LLM이 생성한 tool_call 목록
        user_message: 사용자 원본 메시지
        model: LLM 모델 이름
        is_exaone: EXAONE 모델 여부
        chat_history: 대화 기록 (content 보완용)
        tool_executor_instance: 도구 실행 서비스 인스턴스
        llm_service_instance: LLM 서비스 인스턴스

    Yields:
        str: SSE 형식 청크 (tool_calls, action, tool_result, LLM follow-up)
    """
    logger.info(f"[TOOL PROCESSING] Processing {len(tool_calls)} tool calls")

    # tool_calls 이벤트 전송
    yield f'data: {json.dumps({"type": "tool_calls", "tool_calls": tool_calls}, ensure_ascii=False)}\n\n'

    # chat_history에서 마지막 assistant 응답 추출 (content 보완용)
    last_assistant_content = None
    if chat_history:
        for msg in reversed(chat_history):
            if msg.get('role') == 'assistant' and msg.get('content'):
                last_assistant_content = msg['content']
                break

    # 도구 실행 결과 수집
    tool_results_for_llm = []
    all_tool_results = []

    # 각 tool_call 실행
    for tc in tool_calls:
        try:
            arguments = json.loads(tc.get("function", {}).get("arguments", "{}"))

            # content/data가 비어있거나 너무 짧으면 chat_history에서 보완
            content_key = "content" if "content" in arguments else "data"
            current_content = arguments.get(content_key, "")

            if len(current_content) < 100 and last_assistant_content:
                logger.info(f"[TOOL PROCESSING] Tool content too short ({len(current_content)} chars), using chat_history ({len(last_assistant_content)} chars)")
                arguments[content_key] = last_assistant_content

            tool_result = await tool_executor_instance.execute_tool(
                tool_call_id=tc.get("id", str(uuid.uuid4())),
                tool_name=tc.get("function", {}).get("name", ""),
                arguments=arguments
            )
            all_tool_results.append(tool_result)

            if tool_result.success and tool_result.action_type == "download":
                # 다운로드 액션 이벤트 전송
                action_event = {
                    "type": "action",
                    "action": "download",
                    "file_id": tool_result.file_id,
                    "filename": tool_result.filename,
                    "message": tool_result.message
                }
                yield f'data: {json.dumps(action_event, ensure_ascii=False)}\n\n'
                logger.info(f"[TOOL PROCESSING] Tool result: download action for {tool_result.filename}")

                tool_results_for_llm.append({
                    "role": "tool",
                    "tool_call_id": tc.get("id", ""),
                    "content": json.dumps({
                        "status": "success",
                        "filename": tool_result.filename,
                        "message": tool_result.message
                    }, ensure_ascii=False)
                })
            else:
                # 메시지 액션 이벤트 전송
                message_event = {
                    "type": "tool_result",
                    "tool_call_id": tool_result.tool_call_id,
                    "success": tool_result.success,
                    "message": tool_result.message or tool_result.error
                }
                yield f'data: {json.dumps(message_event, ensure_ascii=False)}\n\n'

                tool_results_for_llm.append({
                    "role": "tool",
                    "tool_call_id": tc.get("id", ""),
                    "content": json.dumps({
                        "status": "error" if not tool_result.success else "success",
                        "message": tool_result.message or tool_result.error
                    }, ensure_ascii=False)
                })

        except Exception as tool_error:
            logger.error(f"[TOOL PROCESSING] Tool execution failed: {tool_error}")
            error_event = {
                "type": "tool_result",
                "tool_call_id": tc.get("id", ""),
                "success": False,
                "message": f"도구 실행 실패: {str(tool_error)}"
            }
            yield f'data: {json.dumps(error_event, ensure_ascii=False)}\n\n'

            tool_results_for_llm.append({
                "role": "tool",
                "tool_call_id": tc.get("id", ""),
                "content": json.dumps({
                    "status": "error",
                    "message": str(tool_error)
                }, ensure_ascii=False)
            })

    # 도구 실행 결과를 LLM에 전달하여 자연스러운 후속 응답 생성
    if tool_results_for_llm and any(r.success for r in all_tool_results):
        try:
            assistant_tool_call_msg = {
                "role": "assistant",
                "content": None,
                "tool_calls": tool_calls
            }

            followup_messages = [
                {"role": "system", "content": TOOL_FOLLOWUP_SYSTEM_PROMPT},
                {"role": "user", "content": user_message},
                assistant_tool_call_msg,
                *tool_results_for_llm
            ]

            logger.info("[TOOL PROCESSING] Generating follow-up response after tool execution")
            async for followup_chunk in llm_service_instance.chat_completion_stream(
                messages=followup_messages,
                model=model,
                temperature=0.7,
                max_tokens=200
            ):
                followup_chunks = process_llm_stream_chunk(
                    chunk=followup_chunk,
                    is_exaone=is_exaone,
                    collected_response={},
                    log_prefix="[FOLLOWUP]",
                    debug_logging=False
                )
                for fc in followup_chunks:
                    yield fc

        except Exception as followup_error:
            logger.warning(f"[TOOL PROCESSING] Follow-up response failed: {followup_error}")


# ============================================================================
# Code Interpreter: 코드 블록 추출 유틸리티
# ============================================================================

# ```python 코드 블록 패턴 (대소문자 무관, 줄바꿈 유연)
_CODE_BLOCK_PATTERN = re.compile(r'```[Pp]y(?:thon)?\s*\r?\n(.*?)```', re.DOTALL)
# 언어 태그 없는 코드 블록 fallback (import/pd./plt. 등 Python 코드 포함 시)
_CODE_BLOCK_FALLBACK_PATTERN = re.compile(r'```\s*\r?\n(.*?)```', re.DOTALL)
_PYTHON_INDICATORS = re.compile(r'(?:^import |^from |^df\b|^pd\.|^plt\.|^print\()', re.MULTILINE)


def extract_python_code_blocks(text: str) -> List[str]:
    """
    LLM 응답 텍스트에서 ```python 코드 블록 추출

    1차: ```python / ```py / ```Python 패턴 매칭
    2차: 언어 태그 없는 ``` 블록 중 Python 코드 패턴이 있는 것만 추출

    Args:
        text: LLM 응답 텍스트

    Returns:
        List[str]: 추출된 Python 코드 블록 목록
    """
    # 1차: 명시적 python 태그 블록
    blocks = _CODE_BLOCK_PATTERN.findall(text)
    result = [b.strip() for b in blocks if b.strip()]
    if result:
        return result

    # 2차: 태그 없는 코드 블록에서 Python 코드 탐색
    fallback_blocks = _CODE_BLOCK_FALLBACK_PATTERN.findall(text)
    for b in fallback_blocks:
        stripped = b.strip()
        if stripped and _PYTHON_INDICATORS.search(stripped):
            result.append(stripped)

    return result


# ============================================================================
# Code Interpreter: 코드 실행 스트림
# ============================================================================

async def process_code_execution_stream(
    code: str,
    description: Optional[str],
    session_id: str,
    query: str,
    model: str,
    data_context: str,
    llm_service_instance,
    is_exaone: bool = False,
) -> AsyncGenerator[str, None]:
    """
    Code Interpreter 코드 실행 및 해석 스트리밍

    코드를 샌드박스에서 실행하고, 결과를 SSE 이벤트로 전송한 후,
    LLM에 해석을 요청하여 스트리밍합니다.
    자동 재시도 로직 포함.

    Args:
        code: 실행할 Python 코드
        description: 코드 설명
        session_id: 데이터 세션 ID
        query: 사용자 원본 질문
        model: LLM 모델 이름
        data_context: 데이터 컨텍스트 문자열
        llm_service_instance: LLM 서비스 인스턴스
        is_exaone: EXAONE 모델 여부

    Yields:
        str: SSE 형식 청크
    """
    from backend.services.code_sandbox_service import code_sandbox_service
    from backend.services.data_session_service import data_session_service
    from backend.config.settings import settings as app_settings

    max_retries = app_settings.CODE_SANDBOX_MAX_RETRIES

    current_code = code

    for attempt in range(1, max_retries + 1):
        # 코드 실행 시작 이벤트
        yield f'data: {json.dumps({"type": "code_execution", "status": "running", "code": current_code, "description": description, "attempt": attempt}, ensure_ascii=False)}\n\n'

        # 샌드박스에서 코드 실행
        result = await code_sandbox_service.execute(current_code, session_id)

        if result.success:
            # 성공: 코드 출력 이벤트
            yield f'data: {json.dumps({"type": "code_output", "stdout": result.stdout, "images": result.images, "execution_time_ms": result.execution_time_ms}, ensure_ascii=False)}\n\n'
            yield f'data: {json.dumps({"type": "code_execution", "status": "success", "attempt": attempt, "execution_time_ms": result.execution_time_ms}, ensure_ascii=False)}\n\n'

            # 해석 단계
            yield f'data: {json.dumps({"type": "stage", "stage": "interpret"})}\n\n'

            # LLM에 결과 해석 요청
            interpretation_messages = _build_interpretation_messages(
                query=query,
                code=current_code,
                stdout=result.stdout,
                has_images=len(result.images) > 0,
                image_count=len(result.images),
            )

            interpret_collected = {}
            async for chunk in llm_service_instance.chat_completion_stream(
                messages=interpretation_messages,
                model=model,
                temperature=0.7,
                max_tokens=2000,
            ):
                interpretation_chunks = process_llm_stream_chunk(
                    chunk=chunk,
                    is_exaone=is_exaone,
                    collected_response=interpret_collected,
                    log_prefix="[CODE INTERPRET]",
                    debug_logging=False,
                )
                for ic in interpretation_chunks:
                    yield ic

            break  # 성공 시 루프 종료

        else:
            # 실패: 에러 이벤트
            yield f'data: {json.dumps({"type": "code_execution", "status": "error", "error": result.error, "stderr": result.stderr, "attempt": attempt}, ensure_ascii=False)}\n\n'

            if attempt < max_retries:
                # 재시도: LLM에 수정 요청
                logger.info(f"[CODE INTERPRETER] Attempt {attempt} failed, requesting code fix. Error: {(result.error or result.stderr or 'unknown')[:200]}")

                retry_messages = _build_retry_messages(
                    query=query,
                    original_code=current_code,
                    error=result.error or result.stderr,
                    data_context=data_context,
                )

                # LLM에 수정된 코드 요청 (프롬프트 기반)
                try:
                    corrected_response = await llm_service_instance.chat_completion(
                        messages=retry_messages,
                        model=model,
                        temperature=0.2,
                        max_tokens=4000,
                    )

                    # 응답 텍스트에서 코드 블록 추출
                    resp_content = corrected_response.get("choices", [{}])[0].get("message", {}).get("content", "")
                    code_blocks = extract_python_code_blocks(resp_content)
                    if code_blocks:
                        current_code = code_blocks[-1]
                        logger.info(f"[CODE INTERPRETER] Got corrected code for attempt {attempt + 1}")
                    else:
                        logger.warning("[CODE INTERPRETER] Could not extract corrected code from response")
                        break
                except Exception as e:
                    logger.error(f"[CODE INTERPRETER] Failed to get corrected code: {e}")
                    break
            else:
                # 최종 실패
                yield f'data: {json.dumps({"type": "code_execution", "status": "failed", "attempt": attempt}, ensure_ascii=False)}\n\n'

                # LLM에 사과 메시지 생성 요청
                failure_messages = _build_failure_messages(
                    query=query,
                    error=result.error or result.stderr,
                )

                failure_collected = {}
                async for chunk in llm_service_instance.chat_completion_stream(
                    messages=failure_messages,
                    model=model,
                    temperature=0.7,
                    max_tokens=500,
                ):
                    failure_chunks = process_llm_stream_chunk(
                        chunk=chunk,
                        is_exaone=is_exaone,
                        collected_response=failure_collected,
                        log_prefix="[CODE FAILURE]",
                        debug_logging=False,
                    )
                    for fc in failure_chunks:
                        yield fc

                # EXAONE 모델이 reasoning_content만 생성하고 answer가 없는 경우 fallback
                if is_exaone and not failure_collected.get("answer") and failure_collected.get("reasoning_content"):
                    fallback = failure_collected["reasoning_content"]
                    logger.info(f"[CODE FAILURE] EXAONE fallback: using reasoning_content ({len(fallback)} chars) as answer")
                    yield f'data: {json.dumps({"choices": [{"delta": {"content": fallback}, "index": 0}]})}\n\n'


def _build_interpretation_messages(
    query: str,
    code: str,
    stdout: str,
    has_images: bool,
    image_count: int,
) -> list:
    """코드 실행 결과 해석용 LLM 메시지 생성"""
    image_note = f"\n\n참고: {image_count}개의 차트가 생성되어 사용자에게 표시됩니다." if has_images else ""

    # stdout이 긴 경우 잘림 표시
    max_stdout = 8000
    stdout_text = stdout[:max_stdout]
    if len(stdout) > max_stdout:
        stdout_text += f"\n... (총 {len(stdout)}자 중 {max_stdout}자까지 표시)"

    return [
        {
            "role": "system",
            "content": (
                "당신은 데이터 분석 결과를 해석하는 전문가입니다.\n"
                "코드 실행 결과를 바탕으로 한국어로 설명하세요.\n"
                "규칙:\n"
                "- 실행 결과의 표/집계 데이터는 모든 행을 빠짐없이 markdown 표로 포함하세요\n"
                "- 절대 상위 N개만 요약하거나 일부 행을 생략하지 마세요\n"
                "- 수치 데이터는 정확하게 인용하세요\n"
                "- 전체 데이터를 표로 보여준 뒤, 핵심 인사이트를 설명하세요\n"
                "- 차트가 생성된 경우 차트 내용을 설명하세요\n"
                "- 추가 분석이 유용할 경우 제안하세요\n"
                "- 코드를 다시 보여주지 마세요"
            ),
        },
        {
            "role": "user",
            "content": (
                f"사용자 질문: {query}\n\n"
                f"실행한 코드:\n```python\n{code}\n```\n\n"
                f"실행 결과:\n{stdout_text}"
                f"{image_note}\n\n"
                f"위 결과를 바탕으로 사용자에게 설명해주세요. "
                f"실행 결과의 모든 행을 빠짐없이 표로 포함해야 합니다."
            ),
        },
    ]


def _build_retry_messages(
    query: str,
    original_code: str,
    error: str,
    data_context: str,
) -> list:
    """코드 수정 요청용 LLM 메시지 생성"""
    # 에러 라인 컨텍스트 추출
    error_context = ""
    if "line " in error:
        import re as _re
        line_match = _re.search(r"line (\d+)", error)
        if line_match:
            err_line = int(line_match.group(1))
            code_lines = original_code.split("\n")
            start = max(0, err_line - 3)
            end = min(len(code_lines), err_line + 2)
            context_lines = []
            for i in range(start, end):
                marker = ">>>" if i + 1 == err_line else "   "
                context_lines.append(f"{marker} {i + 1}: {code_lines[i]}")
            error_context = (
                f"\n\n에러 위치 (line {err_line} 근처):\n"
                + "\n".join(context_lines)
            )

    return [
        {
            "role": "system",
            "content": (
                "이전 Python 코드 실행이 실패했습니다. 에러를 분석하고 수정된 코드를 "
                "```python 코드 블록으로 작성하세요.\n\n"
                "주의사항:\n"
                "- 절대 import os, import sys, import subprocess를 사용하지 마세요 (보안 차단됨)\n"
                "- 파일 경로는 문자열 그대로 사용하세요 (os.path 불필요)\n"
                "- 허용 모듈: pandas, numpy, matplotlib, seaborn, math, statistics, collections, "
                "re, json, csv, datetime, tabulate\n"
                "- **반드시 모든 괄호 (), [], {}가 올바르게 열리고 닫히는지 확인**하세요\n"
                "- 여러 줄에 걸친 함수 호출이나 리스트/딕셔너리는 닫는 괄호를 빠뜨리지 마세요\n"
                "- f-string 안에서는 = 대입을 사용할 수 없습니다\n"
                "- **코드 블록을 반드시 ``` 로 닫아주세요**\n\n"
                f"데이터 정보:\n{data_context[:3000]}"
            ),
        },
        {
            "role": "user",
            "content": (
                f"질문: {query}\n\n"
                f"이전 코드:\n```python\n{original_code}\n```\n\n"
                f"에러:\n{error[:2000]}{error_context}\n\n"
                f"위 에러를 수정하여 완전한 코드를 ```python 코드 블록으로 작성해주세요. "
                f"코드의 모든 괄호가 올바르게 닫히는지 반드시 확인하세요."
            ),
        },
    ]


def _build_failure_messages(query: str, error: str) -> list:
    """최종 실패 시 사과 메시지용 LLM 메시지 생성"""
    return [
        {
            "role": "system",
            "content": (
                "데이터 분석 코드 실행이 실패했습니다. "
                "사용자에게 정중하게 상황을 설명하고, "
                "가능한 해결 방법을 제안하세요. 한국어로 응답하세요."
            ),
        },
        {
            "role": "user",
            "content": (
                f"질문: {query}\n\n"
                f"에러: {error[:1000]}\n\n"
                f"위 에러로 인해 분석이 실패했습니다. 사용자에게 안내해주세요."
            ),
        },
    ]


def _extract_code_from_response(response: dict) -> Optional[str]:
    """LLM 응답에서 execute_python_code tool_call의 코드 추출"""
    try:
        choices = response.get("choices", [])
        if not choices:
            return None

        message = choices[0].get("message", {})
        tool_calls = message.get("tool_calls", [])

        for tc in tool_calls:
            func = tc.get("function", {})
            if func.get("name") == "execute_python_code":
                args = json.loads(func.get("arguments", "{}"))
                return args.get("code")
    except (json.JSONDecodeError, KeyError, IndexError):
        pass

    return None


# ============================================================================
# 백그라운드 로깅 태스크
# ============================================================================

async def log_chat_interaction_task(
    session_id: str,
    conversation_id: str,
    collection_name: str,
    message: str,
    response_data: Dict[str, Any],
    reasoning_level: str,
    model: str,
    llm_params: Dict[str, Any],
    performance_metrics: Dict[str, Any],
    error_info: Optional[Dict] = None,
    request_id: Optional[str] = None,
    trace_id: Optional[str] = None,
    client_info: Optional[Dict] = None,
    use_reranking: bool = False
):
    """채팅 상호작용 로깅 백그라운드 태스크 (큐 기반)"""
    try:
        # 사용자 메시지 로깅 (JSONL 큐)
        await hybrid_logging_service.log_chat_interaction(
            session_id=session_id,
            collection_name=collection_name,
            message_type="user",
            message_content=message,
            reasoning_level=reasoning_level,
            llm_model=model,
            llm_params=llm_params,
            retrieval_info=None,
            performance=performance_metrics,
            error_info=error_info,
            request_id=request_id,
            trace_id=trace_id,
            client_info=client_info
        )

        # 어시스턴트 응답 로깅
        retrieval_info = {}
        if "retrieved_docs" in response_data and response_data["retrieved_docs"]:
            docs = response_data["retrieved_docs"]
            # sources 정보 추출 (공통 유틸리티 사용)
            sources = extract_sources_info(docs)

            retrieval_info = {
                "retrieved_count": len(docs),
                "top_scores": [doc.get("score", 0) for doc in docs[:5]],
                "sources": sources,
                "reranking_used": use_reranking
            }

        await hybrid_logging_service.log_chat_interaction(
            session_id=session_id,
            collection_name=collection_name,
            message_type="assistant",
            message_content=response_data.get("answer", ""),
            reasoning_level=reasoning_level,
            llm_model=model,
            llm_params=llm_params,
            retrieval_info=retrieval_info,
            performance=performance_metrics,
            error_info=error_info,
            request_id=request_id,
            trace_id=trace_id,
            client_info=client_info
        )

        # 대화 서비스에 메시지 추가
        conversation_service.add_message(
            conversation_id=conversation_id,
            role="user",
            content=message
        )

        conversation_service.add_message(
            conversation_id=conversation_id,
            role="assistant",
            content=response_data.get("answer", ""),
            retrieved_docs=response_data.get("retrieved_docs"),
            error_info=error_info
        )

        # 대화 종료 및 저장 (100% 저장 정책)
        await conversation_service.end_conversation(conversation_id)

        # 세션 정보 업데이트 (큐 기반 - 비동기 배치 처리)
        await hybrid_logging_service.queue_session_update(
            session_id=session_id,
            collection_name=collection_name,
            model=model,
            reasoning_level=reasoning_level,
            performance_metrics=performance_metrics,
            retrieval_info=retrieval_info,
            error_info=error_info
        )

    except Exception as e:
        logger.error(f"로깅 태스크 실패: {e}")
