"""
LLM API 서비스 (다중 모델 지원)
OpenAI 호환 엔드포인트를 사용하는 LLM 서비스
"""
import httpx
import logging
import sys
from typing import List, Dict, Any, Optional, AsyncGenerator
from backend.services.prompt_loader import PromptLoader
from backend.config.settings import settings

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
        # UTF-8 인코딩 명시 및 타임아웃 설정
        self.client = httpx.AsyncClient(
            timeout=120.0,
            headers={"Accept-Charset": "utf-8"}
        )
        # 프롬프트 로더 (기본값으로 fallback)
        self.prompt_loader = prompt_loader or PromptLoader()

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

            # 강제 출력 - 반드시 보여야 함
            sys.stderr.write("\n" + "="*80 + "\n")
            sys.stderr.write(f"[LLM STREAM] Requested Model Key: {model_key}\n")
            sys.stderr.write(f"[LLM STREAM] Resolved Model: {llm_config['model']}\n")
            sys.stderr.write(f"[LLM STREAM] Endpoint URL: {llm_config['base_url']}\n")
            sys.stderr.write(f"[LLM STREAM] Full URL: {url}\n")
            sys.stderr.write("="*80 + "\n\n")
            sys.stderr.flush()

            logger.info("="*80)
            logger.info(f"[LLM STREAM] Requested Model Key: {model_key}")
            logger.info(f"[LLM STREAM] Resolved Model: {llm_config['model']}")
            logger.info(f"[LLM STREAM] Endpoint URL: {llm_config['base_url']}")
            logger.info(f"[LLM STREAM] Full URL: {url}")
            logger.info("="*80)

            async with self.client.stream("POST", url, json=payload) as response:
                response.raise_for_status()

                # SSE 스트림을 올바르게 처리하기 위해 aiter_text() 사용
                # aiter_lines()는 \n으로 라인을 나누지만, SSE는 \n\n으로 이벤트를 구분
                buffer = ""
                async for chunk in response.aiter_text():
                    buffer += chunk

                    # SSE 이벤트는 빈 줄(\n\n)로 구분됨
                    while "\n" in buffer:
                        line, buffer = buffer.split("\n", 1)

                        if line.strip():  # 빈 줄이 아닌 경우만 전송
                            # SSE 형식으로 전송 (line에 이미 "data: " 포함되어 있음)
                            yield f"{line}\n"

                # 버퍼에 남은 데이터 처리
                if buffer.strip():
                    yield f"{buffer}\n"

            logger.info(f"[LLM STREAM] Streaming completed")

        except Exception as e:
            logger.error(f"[LLM STREAM] Streaming failed: {e}")
            raise Exception(f"LLM 스트리밍 실패: {str(e)}")

    def build_rag_messages(
        self,
        query: str,
        retrieved_docs: List[Dict[str, Any]],
        reasoning_level: str = "medium",
        chat_history: Optional[List[Dict[str, str]]] = None,
        collection_name: Optional[str] = None
    ) -> List[Dict[str, str]]:
        """
        RAG 프롬프트 구성

        Args:
            query: 사용자 질문
            retrieved_docs: 검색된 문서 리스트
                - text: 문서 텍스트
                - score: 유사도 점수
                - payload: 메타데이터
            reasoning_level: 추론 수준 (low/medium/high)
            chat_history: 이전 대화 기록 (선택사항)
            collection_name: Qdrant 컬렉션 이름 (선택사항, 프롬프트 선택에 사용)

        Returns:
            List[Dict[str, str]]: 메시지 리스트
        """
        # PromptLoader에서 동적으로 프롬프트 가져오기
        system_content = self.prompt_loader.get_system_prompt(
            collection_name=collection_name,
            reasoning_level=reasoning_level
        )

        # 검색된 문서를 컨텍스트로 구성
        context_parts = []
        for idx, doc in enumerate(retrieved_docs, 1):
            text = doc.get("payload", {}).get("text", "")
            score = doc.get("score", 0)

            # 메타데이터에서 추가 정보 추출
            payload = doc.get("payload", {})
            headings = payload.get("headings") or []  # None 안전 처리

            # headings에서 파일명과 페이지 정보 추출
            if len(headings) >= 2:
                filename = headings[0]
                page_info = headings[1]  # "페이지 4" 형식
                reference = f"[{filename}, {page_info}]"
            elif len(headings) == 1:
                reference = f"[{headings[0]}]"
            else:
                reference = f"[문서 {idx}]"

            context_parts.append(
                f"{reference} (유사도: {score:.3f})\n{text}"
            )

        context = "\n\n".join(context_parts)

        # 메시지 구성
        messages = [
            {"role": "system", "content": system_content}
        ]

        # 대화 기록 추가 (선택사항)
        if chat_history:
            messages.extend(chat_history)

        # 사용자 질문과 컨텍스트
        user_message = f"""다음 문서들을 참고하여 질문에 답변해주세요.

{context}

질문: {query}"""

        messages.append({"role": "user", "content": user_message})

        return messages

    async def close(self):
        """클라이언트 연결 종료"""
        await self.client.aclose()
