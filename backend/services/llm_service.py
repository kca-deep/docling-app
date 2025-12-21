"""
LLM API 서비스 (다중 모델 지원)
OpenAI 호환 엔드포인트를 사용하는 LLM 서비스
"""
import json
import logging
import re
from typing import List, Dict, Any, Optional, AsyncGenerator
from backend.services.prompt_loader import PromptLoader
from backend.config.settings import settings
from backend.services.http_client import http_manager

# 로거 설정
logger = logging.getLogger("uvicorn")


class LLMService:
    """LLM API와의 통신을 담당하는 서비스"""

    def __init__(
        self,
        base_url: str,
        model: str = "gpt-oss-20b",
        prompt_loader: Optional[PromptLoader] = None
    ):
        """
        LLMService 초기화

        Args:
            base_url: LLM API 기본 URL (기본값으로만 사용됨)
            model: 모델 이름 (기본값으로만 사용됨)
            prompt_loader: 프롬프트 로더 (기본값: PromptLoader())
        """
        self.base_url = base_url
        self.model = model
        # 싱글톤 HTTP 클라이언트 매니저 사용
        self.client = http_manager.get_client("llm")
        # 프롬프트 로더 (기본값으로 fallback)
        self.prompt_loader = prompt_loader or PromptLoader()

        # EXAONE Deep 모델의 태그 정리용 패턴 (컴파일하여 재사용)
        self._exaone_cleanup_patterns = [
            re.compile(r'</?thought[^>]*>', re.IGNORECASE),
            re.compile(r'</?think[^>]*>', re.IGNORECASE),
            re.compile(r'</?ref[^>]*>', re.IGNORECASE),
            re.compile(r'</?span[^>]*>', re.IGNORECASE),
            re.compile(r'\[?\|?endofturn\|?\]?', re.IGNORECASE),
            re.compile(r'<신설\s*\d*\?*>', re.IGNORECASE),
        ]

    def _clean_model_response(self, content: str, model_key: str) -> str:
        """
        모델별 응답 후처리 (EXAONE Deep의 thought 블록 제거)

        EXAONE Deep 응답 구조:
        <thought>
        [추론 내용 - 영어로 된 긴 텍스트]
        </thought>
        [실제 답변 - 한국어]

        Args:
            content: LLM 응답 텍스트
            model_key: 모델 키 (예: "exaone-deep-7.8b")

        Returns:
            str: 정제된 응답 텍스트 (thought 블록 제거됨)
        """
        if not content:
            return content

        # EXAONE Deep 모델이 아니면 그대로 반환
        if "exaone" not in model_key.lower():
            return content.strip()

        # 1. </thought> 기준으로 분리하여 이후 내용만 추출
        #    EXAONE Deep은 <thought>..추론..</thought> 후에 실제 답변 출력
        if '</thought>' in content:
            parts = content.split('</thought>', 1)
            if len(parts) > 1:
                content = parts[1]

        # 2. 남은 태그들 정리
        for pattern in self._exaone_cleanup_patterns:
            content = pattern.sub('', content)

        return content.strip()

    def _extract_content_from_sse(self, line: str) -> Optional[str]:
        """
        SSE 라인에서 content 추출

        Args:
            line: SSE 라인 (예: "data: {...}")

        Returns:
            Optional[str]: 추출된 content 또는 None
        """
        if not line.startswith("data:"):
            return None

        try:
            json_str = line[5:].strip()
            if not json_str or json_str == "[DONE]":
                return None

            data = json.loads(json_str)
            choices = data.get("choices", [])
            if not choices:
                return None

            delta = choices[0].get("delta", {})
            return delta.get("content", "")

        except (json.JSONDecodeError, KeyError, IndexError):
            return None

    def _create_sse_chunk(self, content: str) -> str:
        """
        content로 SSE 형식의 chunk 생성

        Args:
            content: 전송할 텍스트

        Returns:
            str: SSE 형식 라인
        """
        data = {
            "choices": [{
                "delta": {"content": content},
                "index": 0
            }]
        }
        return f"data: {json.dumps(data, ensure_ascii=False)}\n"

    def _clean_exaone_content(self, content: str) -> str:
        """
        EXAONE 응답에서 태그 정리

        Args:
            content: 정리할 텍스트

        Returns:
            str: 태그가 제거된 텍스트
        """
        for pattern in self._exaone_cleanup_patterns:
            content = pattern.sub('', content)
        return content

    async def chat_completion(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 2000,
        top_p: float = 0.9,
        frequency_penalty: float = 0.0,
        presence_penalty: float = 0.0,
        stream: bool = False
    ) -> Dict[str, Any]:
        """
        채팅 완료 요청 (비스트리밍)

        Args:
            messages: 메시지 리스트 [{"role": "user", "content": "..."}]
            model: 사용할 모델 (None이면 기본 모델 사용)
            temperature: 온도 (0~2)
            max_tokens: 최대 토큰 수
            top_p: Top P (0~1)
            frequency_penalty: 빈도 패널티 (-2~2)
            presence_penalty: 존재 패널티 (-2~2)
            stream: 스트리밍 여부 (이 메서드에서는 False로 고정)

        Returns:
            Dict[str, Any]: API 응답
                - choices[0].message.content: AI 응답 텍스트
                - usage: 토큰 사용량

        Raises:
            Exception: API 호출 실패 시
        """
        try:
            # 모델 키를 기반으로 설정 가져오기
            model_key = model or self.model
            llm_config = settings.get_llm_config(model_key)

            url = f"{llm_config['base_url']}/v1/chat/completions"
            payload = {
                "model": llm_config['model'],
                "messages": messages,
                "temperature": temperature,
                "max_tokens": max_tokens,
                "top_p": top_p,
                "frequency_penalty": frequency_penalty,
                "presence_penalty": presence_penalty,
                "stream": False
            }

            logger.info("="*80)
            logger.info(f"[LLM API CALL] Requested Model Key: {model_key}")
            logger.info(f"[LLM API CALL] Resolved Model: {llm_config['model']}")
            logger.info(f"[LLM API CALL] Endpoint URL: {llm_config['base_url']}")
            logger.info(f"[LLM API CALL] Full URL: {url}")
            logger.info("="*80)

            response = await self.client.post(url, json=payload)
            response.raise_for_status()

            result = response.json()

            # 모델별 응답 처리
            if result.get("choices") and len(result["choices"]) > 0:
                message = result["choices"][0].get("message", {})
                content = message.get("content", "")
                reasoning_content = message.get("reasoning_content", "")

                # GPT-OSS의 reasoning_content 처리
                if reasoning_content:
                    logger.info(f"[LLM API CALL] reasoning_content detected ({len(reasoning_content)} chars)")
                    result["choices"][0]["message"]["reasoning_content"] = reasoning_content

                    if not content.strip():
                        logger.warning("[LLM API CALL] content is empty, using reasoning_content as fallback")
                        content = reasoning_content

                # EXAONE <thought> 태그 처리: 추론 내용 분리하여 reasoning_content로 저장
                is_exaone = "exaone" in model_key.lower()

                # 가상 <thought> 태그 추가
                # chat_template이 generation_prompt로 <thought>\n을 추가하지만
                # llama.cpp API 응답에는 포함되지 않으므로 가상으로 복원
                if is_exaone and '</thought>' in content and '<thought>' not in content:
                    content = '<thought>\n' + content
                    logger.info("[LLM API CALL] EXAONE: Added virtual <thought> tag (chat_template prefix)")

                if is_exaone and '<thought>' in content and '</thought>' in content:
                    thought_start = content.find('<thought>')
                    thought_end = content.find('</thought>')
                    if thought_start < thought_end:
                        thought_content = content[thought_start + 9:thought_end]
                        answer_content = content[thought_end + 10:].strip()
                        result["choices"][0]["message"]["reasoning_content"] = thought_content
                        result["choices"][0]["message"]["content"] = answer_content
                        logger.info(f"[LLM API CALL] EXAONE thought extracted ({len(thought_content)} chars)")
                else:
                    # EXAONE이 아니거나 thought 태그가 없으면 그대로 유지
                    result["choices"][0]["message"]["content"] = content.strip()

            logger.info(f"[LLM API CALL] Completion successful. Tokens used: {result.get('usage', {}).get('total_tokens', 'N/A')}")
            return result

        except Exception as e:
            logger.error(f"[LLM API CALL] Completion failed: {e}")
            raise Exception(f"LLM API 호출 실패: {str(e)}")

    async def chat_completion_stream(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 2000,
        top_p: float = 0.9,
        frequency_penalty: float = 0.0,
        presence_penalty: float = 0.0
    ) -> AsyncGenerator[str, None]:
        """
        채팅 완료 요청 (스트리밍)

        Args:
            messages: 메시지 리스트
            model: 사용할 모델 (None이면 기본 모델 사용)
            temperature: 온도
            max_tokens: 최대 토큰 수
            top_p: Top P
            frequency_penalty: 빈도 패널티
            presence_penalty: 존재 패널티

        Yields:
            str: SSE 이벤트 라인 (data: {...})

        Raises:
            Exception: API 호출 실패 시
        """
        try:
            # 모델 키를 기반으로 설정 가져오기
            model_key = model or self.model
            llm_config = settings.get_llm_config(model_key)

            url = f"{llm_config['base_url']}/v1/chat/completions"
            payload = {
                "model": llm_config['model'],
                "messages": messages,
                "temperature": temperature,
                "max_tokens": max_tokens,
                "top_p": top_p,
                "frequency_penalty": frequency_penalty,
                "presence_penalty": presence_penalty,
                "stream": True
            }

            logger.info("="*80)
            logger.info(f"[LLM STREAM] Requested Model Key: {model_key}")
            logger.info(f"[LLM STREAM] Resolved Model: {llm_config['model']}")
            logger.info(f"[LLM STREAM] Endpoint URL: {llm_config['base_url']}")
            logger.info(f"[LLM STREAM] Full URL: {url}")
            logger.info("="*80)

            async with self.client.stream("POST", url, json=payload) as response:
                response.raise_for_status()

                # 모든 모델: 원본 응답 그대로 전송
                # EXAONE <thought> 태그 처리는 chat.py에서 수행
                buffer = ""
                async for chunk in response.aiter_text():
                    buffer += chunk

                    while "\n" in buffer:
                        line, buffer = buffer.split("\n", 1)

                        if line.strip():
                            yield f"{line}\n"

                if buffer.strip():
                    yield f"{buffer}\n"

            logger.info(f"[LLM STREAM] Streaming completed")

        except Exception as e:
            logger.error(f"[LLM STREAM] Streaming failed: {e}")
            raise Exception(f"LLM 스트리밍 실패: {str(e)}")

    def _truncate_text(self, text: str, max_chars: int) -> str:
        """
        텍스트를 최대 문자 수로 truncate

        Args:
            text: 원본 텍스트
            max_chars: 최대 문자 수

        Returns:
            str: truncate된 텍스트
        """
        if len(text) <= max_chars:
            return text
        return text[:max_chars] + "...(truncated)"

    def _truncate_chat_history(
        self,
        chat_history: List[Dict[str, str]],
        max_messages: int = 6,
        max_chars_per_message: int = 500
    ) -> List[Dict[str, str]]:
        """
        chat_history를 최대 메시지 수와 문자 수로 제한

        Args:
            chat_history: 이전 대화 기록
            max_messages: 최대 메시지 수 (기본값: 6)
            max_chars_per_message: 메시지당 최대 문자 수 (기본값: 500)

        Returns:
            List[Dict[str, str]]: truncate된 대화 기록
        """
        if not chat_history:
            return []

        # 최근 메시지만 유지
        recent_history = chat_history[-max_messages:]

        # 각 메시지 내용 truncate
        truncated = []
        for msg in recent_history:
            truncated.append({
                "role": msg["role"],
                "content": self._truncate_text(msg["content"], max_chars_per_message)
            })

        return truncated

    def build_rag_messages(
        self,
        query: str,
        retrieved_docs: List[Dict[str, Any]],
        reasoning_level: str = "medium",
        chat_history: Optional[List[Dict[str, str]]] = None,
        collection_name: Optional[str] = None,
        model_key: Optional[str] = None
    ) -> List[Dict[str, str]]:
        """
        RAG 프롬프트 구성 (일상대화 모드 및 EXAONE Deep 지원)

        EXAONE Deep 모델의 경우:
        - 시스템 프롬프트를 사용하지 않음 (공식 권장)
        - 지시사항을 사용자 메시지에 포함

        Args:
            query: 사용자 질문
            retrieved_docs: 검색된 문서 리스트 (일상대화 모드에서는 빈 리스트)
                - text: 문서 텍스트
                - score: 유사도 점수
                - payload: 메타데이터
            reasoning_level: 추론 수준 (low/medium/high)
            chat_history: 이전 대화 기록 (선택사항)
            collection_name: Qdrant 컬렉션 이름 (None이면 일상대화 모드)
            model_key: 모델 키 (EXAONE Deep 여부 판단용)

        Returns:
            List[Dict[str, str]]: 메시지 리스트
        """
        # chat_history truncate (토큰 한도 초과 방지)
        truncated_history = self._truncate_chat_history(chat_history) if chat_history else None

        # PromptLoader에서 동적으로 프롬프트 가져오기 (모델별 reasoning instruction 적용)
        system_content = self.prompt_loader.get_system_prompt(
            collection_name=collection_name,
            reasoning_level=reasoning_level,
            model_key=model_key
        )

        # EXAONE Deep 모델 여부 확인
        is_exaone = model_key and "exaone" in model_key.lower()

        # 일상대화 모드 체크: 검색된 문서가 없으면 일상대화 모드
        is_casual_mode = not retrieved_docs

        # 문서 컨텍스트 구성 (컨텍스트 한도 설정)
        MAX_CONTEXT_CHARS = settings.LLM_MAX_CONTEXT_CHARS
        MAX_DOC_CHARS = settings.LLM_MAX_DOC_CHARS

        context = ""
        if not is_casual_mode:
            context_parts = []
            total_chars = 0

            for idx, doc in enumerate(retrieved_docs, 1):
                text = doc.get("payload", {}).get("text", "")
                score = doc.get("score", 0)

                # 개별 문서 텍스트 truncate
                text = self._truncate_text(text, MAX_DOC_CHARS)

                payload = doc.get("payload", {})
                headings = payload.get("headings") or []

                if len(headings) >= 2:
                    filename = headings[0]
                    page_info = headings[1]
                    reference = f"[{filename}, {page_info}]"
                elif len(headings) == 1:
                    reference = f"[{headings[0]}]"
                else:
                    reference = f"[문서 {idx}]"

                doc_part = f"{reference} (유사도: {score:.3f})\n{text}"

                # 총 컨텍스트 한도 체크
                if total_chars + len(doc_part) > MAX_CONTEXT_CHARS:
                    logger.warning(f"[LLM] Context limit reached at doc {idx}, truncating remaining docs")
                    break

                context_parts.append(doc_part)
                total_chars += len(doc_part) + 2  # +2 for "\n\n"

            context = "\n\n".join(context_parts)

        if is_exaone:
            # EXAONE Deep: 시스템 프롬프트 사용 금지 (공식 권장)
            # 지시사항을 사용자 메시지에 포함
            messages = []

            # 대화 기록 추가 (truncated)
            if truncated_history:
                messages.extend(truncated_history)

            if is_casual_mode:
                # 일상대화 모드
                user_content = f"""[지시사항]
{system_content}

[질문]
{query}

위 지시사항에 따라 질문에 답변해주세요. 반드시 한국어로 답변하세요."""
            else:
                # RAG 모드
                user_content = f"""[지시사항]
{system_content}

[참고 문서]
{context}

[질문]
{query}

위 문서를 기반으로 질문에 답변해주세요. 반드시 한국어로 답변하세요. 문서에 없는 내용은 추측하지 마세요."""

            messages.append({"role": "user", "content": user_content})
        else:
            # 기존 모델 (GPT-OSS 등): 시스템 프롬프트 사용
            messages = [
                {"role": "system", "content": system_content}
            ]

            # 대화 기록 추가 (truncated)
            if truncated_history:
                messages.extend(truncated_history)

            if is_casual_mode:
                messages.append({"role": "user", "content": query})
            else:
                user_message = f"""다음 문서들을 참고하여 질문에 답변해주세요.

{context}

질문: {query}"""
                messages.append({"role": "user", "content": user_message})

        return messages

    async def close(self):
        """
        클라이언트 연결 종료

        Note: HTTP 클라이언트 매니저가 관리하므로 개별 종료 불필요
        앱 종료 시 http_manager.close_all()에서 일괄 처리됨
        """
        pass  # HTTP 클라이언트 매니저에서 관리
