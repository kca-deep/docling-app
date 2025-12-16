"""
프롬프트 생성 서비스
LLM을 사용하여 시스템 프롬프트와 추천 질문 생성
"""
import logging
import json
import re
from pathlib import Path
from typing import Dict, Any, List, Optional

from backend.services.llm_service import LLMService
from backend.config.settings import settings

logger = logging.getLogger(__name__)

# 프롬프트 디렉토리 경로
PROMPTS_DIR = Path(__file__).parent.parent / "prompts"
META_PROMPTS_DIR = PROMPTS_DIR / "meta"


class PromptGeneratorService:
    """프롬프트 생성 서비스"""

    def __init__(self):
        """서비스 초기화"""
        self.llm_service = LLMService(
            base_url=settings.LLM_BASE_URL,
            model=settings.LLM_MODEL
        )

    def _load_meta_prompt(self, filename: str) -> str:
        """메타 프롬프트 파일 로드"""
        meta_path = META_PROMPTS_DIR / filename
        if not meta_path.exists():
            raise FileNotFoundError(f"메타 프롬프트 파일을 찾을 수 없습니다: {filename}")
        return meta_path.read_text(encoding="utf-8")

    def _load_template(self, template_type: str) -> str:
        """템플릿 프롬프트 로드 (참고용)"""
        template_map = {
            "regulation": "regulation.md",
            "budget": "budget.md",
            "fund": "fund.md",
            "casual": "casual.md",
            "technical": "technical.md",
            "default": "default.md"
        }
        filename = template_map.get(template_type, "default.md")
        template_path = PROMPTS_DIR / filename

        if template_path.exists():
            return template_path.read_text(encoding="utf-8")
        return ""

    async def generate_system_prompt(
        self,
        collection_name: str,
        document_sample: str,
        template_type: str = "default",
        model: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        시스템 프롬프트 생성

        Args:
            collection_name: 컬렉션 이름
            document_sample: 문서 샘플 텍스트
            template_type: 템플릿 유형 (regulation, budget, default)
            model: LLM 모델 (None이면 기본 모델)

        Returns:
            생성 결과: {
                "content": 생성된 프롬프트,
                "template_used": 사용된 템플릿,
                "tokens_used": 사용된 토큰 수
            }
        """
        try:
            # 메타 프롬프트 로드
            meta_prompt = self._load_meta_prompt("meta_prompt.md")

            # 참고용 템플릿 로드 (예시로 제공)
            template_example = self._load_template(template_type)

            # 설정값 사용
            sample_limit = settings.PROMPT_GEN_SAMPLE_LIMIT

            # 변수 치환 (문서 샘플은 설정값으로 제한)
            meta_prompt = meta_prompt.replace("{collection_name}", collection_name)
            meta_prompt = meta_prompt.replace("{template_type}", template_type)
            meta_prompt = meta_prompt.replace("{document_sample}", document_sample[:sample_limit])

            # LLM 메시지 구성 (간결하게 - 토큰 절약)
            messages = [
                {
                    "role": "system",
                    "content": meta_prompt
                },
                {
                    "role": "user",
                    "content": f"""컬렉션: {collection_name} | 템플릿: {template_type}

위 문서 샘플을 분석하여 시스템 프롬프트를 생성하세요.
반드시 {{reasoning_instruction}} 플레이스홀더를 포함하세요."""
                }
            ]

            # LLM 호출 (설정값 사용)
            result = await self.llm_service.chat_completion(
                messages=messages,
                model=model,
                temperature=0.7,
                max_tokens=settings.PROMPT_GEN_MAX_TOKENS
            )

            content = result.get("choices", [{}])[0].get("message", {}).get("content", "")
            tokens_used = result.get("usage", {}).get("total_tokens", 0)

            # 결과 정제
            content = self._clean_generated_content(content)

            # {reasoning_instruction} 확인 및 추가
            if "{reasoning_instruction}" not in content:
                # 첫 번째 단락 뒤에 삽입
                lines = content.split("\n")
                if len(lines) > 1:
                    lines.insert(2, "\n{reasoning_instruction}\n")
                    content = "\n".join(lines)
                else:
                    content = content + "\n\n{reasoning_instruction}\n"

            return {
                "content": content,
                "template_used": template_type,
                "tokens_used": tokens_used
            }

        except Exception as e:
            logger.error(f"프롬프트 생성 실패: {e}")
            raise

    async def generate_suggested_questions(
        self,
        collection_name: str,
        document_sample: str,
        template_type: str = "default",
        num_questions: int = 6,
        model: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        추천 질문 생성

        Args:
            collection_name: 컬렉션 이름
            document_sample: 문서 샘플 텍스트
            template_type: 템플릿 유형
            num_questions: 생성할 질문 수
            model: LLM 모델

        Returns:
            생성 결과: {
                "questions": 질문 리스트,
                "tokens_used": 사용된 토큰 수
            }
        """
        try:
            # 메타 프롬프트 로드
            meta_prompt = self._load_meta_prompt("questions_prompt.md")

            # 설정값 사용
            sample_limit = settings.PROMPT_GEN_SAMPLE_LIMIT

            # 변수 치환 (문서 샘플은 설정값으로 제한)
            meta_prompt = meta_prompt.replace("{collection_name}", collection_name)
            meta_prompt = meta_prompt.replace("{template_type}", template_type)
            meta_prompt = meta_prompt.replace("{document_sample}", document_sample[:sample_limit])

            # LLM 메시지 구성 (간결하게 - 토큰 절약)
            messages = [
                {
                    "role": "system",
                    "content": meta_prompt
                },
                {
                    "role": "user",
                    "content": f"""컬렉션: {collection_name} | 문서 유형: {template_type}

위 문서 샘플을 분석하여 {num_questions}개의 추천 질문을 JSON 배열로 출력하세요."""
                }
            ]

            # LLM 호출 (설정값 사용)
            logger.debug(f"[추천질문] LLM 호출 시작 - max_tokens: {settings.PROMPT_GEN_QUESTIONS_MAX_TOKENS}")

            result = await self.llm_service.chat_completion(
                messages=messages,
                model=model,
                temperature=0.8,
                max_tokens=settings.PROMPT_GEN_QUESTIONS_MAX_TOKENS
            )

            logger.debug(f"[추천질문] LLM 원본 응답: {json.dumps(result, ensure_ascii=False)[:1500]}")

            # content 또는 reasoning_content에서 응답 추출
            message = result.get("choices", [{}])[0].get("message", {})
            content = message.get("content", "")

            # content가 비어있으면 reasoning_content 확인 (일부 LLM은 reasoning 모드 사용)
            if not content:
                reasoning_content = message.get("reasoning_content", "")
                if reasoning_content:
                    logger.debug("[추천질문] reasoning_content 발견, content 대신 사용")
                    content = reasoning_content

            tokens_used = result.get("usage", {}).get("total_tokens", 0)
            finish_reason = result.get("choices", [{}])[0].get("finish_reason", "unknown")
            logger.debug(f"[추천질문] tokens_used: {tokens_used}, content_length: {len(content)}, finish_reason: {finish_reason}")
            logger.debug(f"[추천질문] LLM 응답 내용:\n{content[:1000] if content else '(빈 응답)'}")

            # JSON 파싱 (template_type 전달하여 실패 시 기본 질문 사용)
            questions = self._parse_questions_json(content, num_questions, template_type)
            logger.info(f"[추천질문] 파싱 결과 - {len(questions)}개 질문: {questions}")

            return {
                "questions": questions,
                "tokens_used": tokens_used
            }

        except Exception as e:
            logger.error(f"추천 질문 생성 실패: {e}")
            raise

    async def generate_all(
        self,
        collection_name: str,
        document_sample: str,
        template_type: str = "default",
        num_questions: int = 6,
        model: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        시스템 프롬프트와 추천 질문 모두 생성

        Args:
            collection_name: 컬렉션 이름
            document_sample: 문서 샘플 텍스트
            template_type: 템플릿 유형
            num_questions: 생성할 질문 수
            model: LLM 모델

        Returns:
            생성 결과: {
                "prompt_content": 생성된 프롬프트,
                "suggested_questions": 추천 질문 리스트,
                "template_used": 사용된 템플릿,
                "total_tokens_used": 총 토큰 수
            }
        """
        # 프롬프트 생성
        prompt_result = await self.generate_system_prompt(
            collection_name=collection_name,
            document_sample=document_sample,
            template_type=template_type,
            model=model
        )

        # 추천 질문 생성
        questions_result = await self.generate_suggested_questions(
            collection_name=collection_name,
            document_sample=document_sample,
            template_type=template_type,
            num_questions=num_questions,
            model=model
        )

        return {
            "prompt_content": prompt_result["content"],
            "suggested_questions": questions_result["questions"],
            "template_used": prompt_result["template_used"],
            "total_tokens_used": prompt_result["tokens_used"] + questions_result["tokens_used"]
        }

    def _clean_generated_content(self, content: str) -> str:
        """생성된 콘텐츠 정제"""
        # 앞뒤 공백 제거
        content = content.strip()

        # 1. 전체를 감싸는 코드 블록 제거 (```markdown ... ```)
        if content.startswith("```"):
            lines = content.split("\n")
            if len(lines) > 2:
                # 첫 줄과 마지막 줄이 ``` 이면 제거
                if lines[-1].strip() == "```":
                    content = "\n".join(lines[1:-1])
                elif lines[0].startswith("```"):
                    content = "\n".join(lines[1:])

        # 2. 내부 코드블록을 마크다운 볼드 헤더로 변환
        # LLM이 답변 형식을 ```markdown ... ``` 으로 감쌌을 경우 처리
        def convert_codeblock_to_markdown(match):
            inner = match.group(1).strip()
            # [섹션명] 패턴을 **[섹션명]** 볼드로 변환
            inner = re.sub(r'^\[([^\]]+)\]', r'**[\1]**', inner, flags=re.MULTILINE)
            return inner

        content = re.sub(
            r'```(?:markdown)?\s*\n([\s\S]*?)\n```',
            convert_codeblock_to_markdown,
            content
        )

        # 3. 남은 단독 ``` 라인 제거
        content = re.sub(r'^```\s*$', '', content, flags=re.MULTILINE)

        return content.strip()

    def _normalize_question(self, question: str) -> str:
        """
        질문 문자열 정규화
        - 이스케이프 시퀀스 제거
        - 불필요한 문자 정리
        - 형식 검증
        """
        if not question:
            return ""

        # 이스케이프된 따옴표 제거 (\" \')
        question = question.replace('\\"', '')
        question = question.replace("\\'", '')
        question = question.replace('\\n', ' ')
        question = question.replace('\\t', ' ')

        # 끝에 붙은 따옴표 패턴 제거 (?" ?' 등)
        question = re.sub(r'\?["\']$', '?', question)
        question = re.sub(r'["\']$', '', question)

        # 앞뒤 따옴표/공백 제거
        question = question.strip('" \'\t\n')

        # 연속 공백 정리
        question = re.sub(r'\s+', ' ', question)

        # 끝에 불필요한 문자 제거 (쉼표, 세미콜론 등)
        question = question.rstrip(',;')

        return question.strip()

    def _get_default_questions(self, template_type: str, count: int = 4) -> List[str]:
        """
        파싱 실패 시 반환할 기본 질문 목록
        """
        defaults = {
            "regulation": [
                "이 규정의 적용 대상은 누구인가요?",
                "신청 절차는 어떻게 되나요?",
                "예외 조항이 있나요?",
                "위반 시 처분과 일반 징계의 차이점은?",
            ],
            "budget": [
                "총 예산 규모는 얼마인가요?",
                "예산 집행 절차는 어떻게 되나요?",
                "예비비 사용 조건은 무엇인가요?",
                "경상비와 사업비의 차이점은?",
            ],
            "casual": [
                "오늘 날씨가 어때요?",
                "추천해줄 만한 것이 있나요?",
                "이것에 대해 어떻게 생각하세요?",
                "도움이 필요한데 조언해주실 수 있나요?",
            ],
            "technical": [
                "이 API의 사용 방법은 어떻게 되나요?",
                "설치 및 설정 절차를 알려주세요.",
                "이 오류의 해결 방법은 무엇인가요?",
                "시스템 요구사항은 무엇인가요?",
            ],
            "default": [
                "이 문서의 주요 내용은 무엇인가요?",
                "핵심 절차가 무엇인가요?",
                "적용 범위는 어떻게 되나요?",
                "관련 용어의 정의는 무엇인가요?",
            ],
        }
        questions = defaults.get(template_type, defaults["default"])
        return questions[:count]

    def _parse_questions_json(
        self,
        content: str,
        expected_count: int,
        template_type: str = "default"
    ) -> List[str]:
        """LLM 응답에서 질문 JSON 배열 파싱"""
        logger.info(f"[JSON파싱] 입력 내용:\n{content}")

        questions = []

        # 1차: 코드 블록 내 JSON 배열 추출 (```json ... ``` 또는 ``` ... ```)
        code_block_match = re.search(r'```(?:json)?\s*(\[[\s\S]*?\])\s*```', content)
        if code_block_match:
            try:
                json_str = code_block_match.group(1)
                logger.info(f"[JSON파싱] 코드 블록 내 JSON 발견: {json_str[:200]}...")
                questions = self._extract_questions_from_json(json_str)
                if questions:
                    logger.info(f"[JSON파싱] 코드 블록 파싱 성공: {len(questions)}개")
                    return questions[:expected_count]
            except Exception as e:
                logger.warning(f"[JSON파싱] 코드 블록 파싱 실패: {e}")

        # 2차: 일반 JSON 배열 추출 (유연한 패턴)
        # 대괄호로 시작하고 끝나는 부분 찾기 (줄바꿈 포함, non-greedy)
        json_match = re.search(r'\[[\s\S]*?\]', content)
        if json_match:
            try:
                json_str = json_match.group()
                logger.info(f"[JSON파싱] JSON 배열 발견: {json_str[:200]}...")
                questions = self._extract_questions_from_json(json_str)
                if questions:
                    logger.info(f"[JSON파싱] JSON 파싱 성공: {len(questions)}개")
                    return questions[:expected_count]
            except Exception as e:
                logger.warning(f"[JSON파싱] JSON 파싱 실패: {e}")

        # 3차: 줄 단위로 파싱 (fallback)
        logger.info("[JSON파싱] fallback - 줄 단위 파싱 시도")
        lines = content.strip().split("\n")

        for line in lines:
            line = line.strip()
            # 번호 매기기 제거 (1. 2. 등)
            line = re.sub(r'^[\d]+[\.\)]\s*', '', line)
            # 정규화 적용
            normalized = self._normalize_question(line)
            # 빈 줄이나 JSON 관련 문자 제외
            if normalized and normalized not in ['[', ']', ',', '```', '```json'] and len(normalized) > 5:
                questions.append(normalized)

        if questions:
            logger.info(f"[JSON파싱] fallback 결과: {len(questions)}개 - {questions}")
            return questions[:expected_count]

        # 4차: 모든 파싱 실패 시 기본 질문 반환
        logger.warning(f"[JSON파싱] 모든 파싱 실패, 기본 질문 사용 (template: {template_type})")
        return self._get_default_questions(template_type, expected_count)

    def _extract_questions_from_json(self, json_str: str) -> List[str]:
        """JSON 문자열에서 질문 목록 추출"""
        parsed = json.loads(json_str)
        questions = []
        if isinstance(parsed, list):
            for q in parsed:
                if isinstance(q, str):
                    normalized = self._normalize_question(q)
                    if normalized and len(normalized) > 3:
                        questions.append(normalized)
        return questions


# 싱글톤 인스턴스
prompt_generator_service = PromptGeneratorService()
