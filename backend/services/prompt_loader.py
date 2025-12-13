"""
프롬프트 로더 서비스
컬렉션별 시스템 프롬프트를 파일에서 로드하고 캐싱하는 서비스
"""
import json
import os
from pathlib import Path
from typing import Dict, Optional, Tuple


class PromptLoader:
    """프롬프트 파일 로딩 및 캐싱을 담당하는 서비스"""

    def __init__(self, prompts_dir: Optional[str] = None):
        """
        PromptLoader 초기화

        Args:
            prompts_dir: 프롬프트 디렉토리 경로 (기본값: backend/prompts/)
        """
        if prompts_dir is None:
            # 기본 경로: backend/prompts/
            base_dir = Path(__file__).parent.parent / "prompts"
        else:
            base_dir = Path(prompts_dir)

        self.prompts_dir = base_dir
        self.cache: Dict[str, Tuple[str, float]] = {}  # {filename: (content, mtime)}
        self.mapping: Optional[Dict] = None
        self.mapping_mtime: Optional[float] = None

        # 프롬프트 디렉토리 존재 확인
        if not self.prompts_dir.exists():
            print(f"[WARNING] Prompts directory does not exist: {self.prompts_dir}")
            print(f"[WARNING] Creating prompts directory...")
            self.prompts_dir.mkdir(parents=True, exist_ok=True)

        # 기본 reasoning_instructions (호환성 유지)
        self.default_reasoning_instructions = {
            "low": "답변은 간단하고 명확하게 작성하세요.",
            "medium": "답변은 적절한 수준의 설명과 함께 작성하세요.",
            "high": "답변은 깊이 있는 분석과 추론을 포함하여 상세하게 작성하세요."
        }

        # GPT-OSS 전용 - 공식 Reasoning 지시어 사용
        # https://huggingface.co/openai/gpt-oss-20b 권장 형식
        self.gpt_oss_reasoning_instructions = {
            "low": "Reasoning: low",
            "medium": "Reasoning: medium",
            "high": "Reasoning: high"
        }

        # EXAONE Deep 전용 - 지시사항 상세함으로 조절
        # https://huggingface.co/LGAI-EXAONE/EXAONE-Deep-7.8B-GGUF 권장
        # EXAONE은 별도 reasoning level 개념이 없으며, 지시사항으로 조절
        self.exaone_reasoning_instructions = {
            "low": "간결하게 답변하세요.",
            "medium": "",  # 기본 동작, 추가 지시 없음
            "high": "Please reason step by step. 단계별로 깊이 분석하여 상세하게 답변하세요."
        }

        # 하위 호환성을 위해 기본 instructions도 유지
        self.reasoning_instructions = self.default_reasoning_instructions

    def get_system_prompt(
        self,
        collection_name: Optional[str],
        reasoning_level: str = "medium",
        model_key: Optional[str] = None
    ) -> str:
        """
        컬렉션에 맞는 시스템 프롬프트 반환

        Fallback 순서:
        1. collection_name이 None → default.md
        2. mapping에 없음 → default.md
        3. 파일 읽기 실패 → default.md
        4. 성공 → 해당 프롬프트

        Args:
            collection_name: Qdrant 컬렉션 이름
            reasoning_level: 추론 수준 (low/medium/high)
            model_key: LLM 모델 키 (gpt-oss-20b, exaone-deep-7.8b 등)

        Returns:
            str: 시스템 프롬프트 (reasoning_instruction 플레이스홀더 대체됨)
        """
        # 1. 프롬프트 파일명 결정
        prompt_file = self._get_prompt_file(collection_name)

        # 2. 프롬프트 파일 읽기
        prompt_content = self._read_prompt_file(prompt_file)

        # 3. 모델별 reasoning_instruction 선택
        reasoning_instruction = self._get_reasoning_instruction(
            reasoning_level=reasoning_level,
            model_key=model_key
        )

        # 4. {reasoning_instruction} 플레이스홀더 대체
        prompt_content = prompt_content.replace(
            "{reasoning_instruction}",
            reasoning_instruction
        )

        return prompt_content

    def _get_reasoning_instruction(
        self,
        reasoning_level: str,
        model_key: Optional[str] = None
    ) -> str:
        """
        모델별 reasoning instruction 반환

        Args:
            reasoning_level: 추론 수준 (low/medium/high)
            model_key: LLM 모델 키

        Returns:
            str: 해당 모델과 추론 수준에 맞는 instruction
        """
        # GPT-OSS 모델: 공식 "Reasoning: level" 형식 사용
        if model_key and "gpt-oss" in model_key.lower():
            instructions = self.gpt_oss_reasoning_instructions
            print(f"[PromptLoader] Using GPT-OSS reasoning instruction: {reasoning_level}")
        # EXAONE 모델: 한국어 지시사항으로 조절
        elif model_key and "exaone" in model_key.lower():
            instructions = self.exaone_reasoning_instructions
            print(f"[PromptLoader] Using EXAONE reasoning instruction: {reasoning_level}")
        # 기타 모델: 기본 instructions 사용
        else:
            instructions = self.default_reasoning_instructions
            print(f"[PromptLoader] Using default reasoning instruction: {reasoning_level}")

        return instructions.get(reasoning_level, instructions.get("medium", ""))

    def _get_prompt_file(self, collection_name: Optional[str]) -> str:
        """
        컬렉션 이름으로 프롬프트 파일명 결정

        Args:
            collection_name: 컬렉션 이름

        Returns:
            str: 프롬프트 파일명 (예: "regulation.md", "default.md", "casual.md")
        """
        # collection_name이 None이면 casual.md (일상대화 모드)
        if not collection_name:
            print(f"[INFO] No collection specified, using casual.md for casual conversation")
            return "casual.md"

        # mapping.json 로드
        mapping = self._load_mapping()

        # mapping에서 collection_name 찾기
        collection_prompts = mapping.get("collection_prompts", {})
        if collection_name in collection_prompts:
            prompt_file = collection_prompts[collection_name].get("prompt_file")
            if prompt_file:
                print(f"[INFO] Using prompt file '{prompt_file}' for collection '{collection_name}'")
                return prompt_file

        # 매핑에 없으면 default.md
        default_prompt = mapping.get("default_prompt", "default.md")
        print(f"[INFO] Collection '{collection_name}' not in mapping, using default: '{default_prompt}'")
        return default_prompt

    def _load_mapping(self) -> Dict:
        """
        mapping.json 파일 로드 (캐싱 적용)

        Returns:
            Dict: 매핑 설정
        """
        mapping_file = self.prompts_dir / "mapping.json"

        # 파일이 없으면 빈 설정 반환
        if not mapping_file.exists():
            print(f"[WARNING] Mapping file not found: {mapping_file}")
            return {
                "collection_prompts": {},
                "default_prompt": "default.md",
                "fallback_behavior": "use_default"
            }

        try:
            # 파일 수정 시간 확인
            current_mtime = mapping_file.stat().st_mtime

            # 캐시된 매핑이 있고 수정되지 않았으면 캐시 반환
            if self.mapping is not None and self.mapping_mtime == current_mtime:
                return self.mapping

            # 파일 읽기
            with open(mapping_file, "r", encoding="utf-8") as f:
                mapping = json.load(f)

            # 캐시 업데이트
            self.mapping = mapping
            self.mapping_mtime = current_mtime

            print(f"[INFO] Loaded mapping.json (collections: {len(mapping.get('collection_prompts', {}))})")
            return mapping

        except Exception as e:
            print(f"[ERROR] Failed to load mapping.json: {e}")
            # 에러 시 기본 설정 반환
            return {
                "collection_prompts": {},
                "default_prompt": "default.md",
                "fallback_behavior": "use_default"
            }

    def _read_prompt_file(self, filename: str) -> str:
        """
        프롬프트 파일 읽기 (캐싱 적용)
        파일 수정 시간(mtime) 체크하여 변경 시에만 재로드

        Args:
            filename: 프롬프트 파일명 (예: "regulation.md")

        Returns:
            str: 프롬프트 내용

        Raises:
            Exception: 파일 읽기 실패 시 (fallback 처리됨)
        """
        file_path = self.prompts_dir / filename

        # 파일이 없으면 default.md로 fallback
        if not file_path.exists():
            print(f"[WARNING] Prompt file not found: {file_path}")
            if filename != "default.md":
                print(f"[WARNING] Falling back to default.md")
                return self._read_prompt_file("default.md")
            else:
                # default.md도 없으면 하드코딩된 기본 프롬프트 반환
                print(f"[ERROR] default.md not found, using hardcoded fallback")
                return self._get_hardcoded_default_prompt()

        try:
            # 파일 수정 시간 확인
            current_mtime = file_path.stat().st_mtime

            # 캐시에 있고 수정되지 않았으면 캐시 반환
            if filename in self.cache:
                cached_content, cached_mtime = self.cache[filename]
                if cached_mtime == current_mtime:
                    return cached_content

            # 파일 읽기
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()

            # 캐시 업데이트
            self.cache[filename] = (content, current_mtime)

            print(f"[INFO] Loaded prompt file: {filename} ({len(content)} chars)")
            return content

        except Exception as e:
            print(f"[ERROR] Failed to read prompt file {filename}: {e}")
            # 에러 시 default.md로 fallback
            if filename != "default.md":
                print(f"[WARNING] Falling back to default.md")
                return self._read_prompt_file("default.md")
            else:
                # default.md 읽기도 실패하면 하드코딩된 기본 프롬프트 반환
                return self._get_hardcoded_default_prompt()

    def _get_hardcoded_default_prompt(self) -> str:
        """
        하드코딩된 기본 프롬프트 반환 (최후의 fallback)

        Returns:
            str: 기본 프롬프트
        """
        return """당신은 문서 기반 질의응답을 수행하는 AI 어시스턴트입니다.

다음 규칙을 따라주세요:
1. 제공된 문서의 내용만을 기반으로 답변하세요.
2. 문서에 없는 내용은 추측하지 말고, "문서에서 관련 정보를 찾을 수 없습니다"라고 답하세요.
3. 답변 시 관련 문서 번호를 인용하세요 (예: [문서 1], [문서 2]).
4. {reasoning_instruction}
"""

    def reload_prompts(self):
        """
        모든 프롬프트 캐시 초기화 및 재로드
        프롬프트 파일을 수정한 후 즉시 반영하고 싶을 때 사용
        """
        self.cache.clear()
        self.mapping = None
        self.mapping_mtime = None
        print(f"[INFO] All prompt caches cleared")
