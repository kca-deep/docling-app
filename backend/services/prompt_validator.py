"""
프롬프트 검증 서비스
생성된 프롬프트의 품질과 필수 요소 검증
"""
import logging
import re
from typing import Dict, Any, List, Tuple

logger = logging.getLogger(__name__)


class PromptValidator:
    """프롬프트 검증 서비스"""

    # 검증 설정
    MIN_PROMPT_LENGTH = 200  # 최소 프롬프트 길이 (문자)
    MAX_PROMPT_LENGTH = 5000  # 최대 프롬프트 길이
    MIN_QUESTIONS = 3  # 최소 질문 수
    MAX_QUESTIONS = 10  # 최대 질문 수
    MIN_QUESTION_LENGTH = 10  # 최소 질문 길이

    # 필수 요소
    REQUIRED_PLACEHOLDER = "{reasoning_instruction}"

    def validate_prompt(self, content: str) -> Dict[str, Any]:
        """
        시스템 프롬프트 검증

        Args:
            content: 프롬프트 내용

        Returns:
            검증 결과: {
                "valid": 유효 여부,
                "errors": 오류 목록,
                "warnings": 경고 목록,
                "score": 품질 점수 (0-100)
            }
        """
        errors: List[str] = []
        warnings: List[str] = []
        score = 100

        # 1. 빈 콘텐츠 검사
        if not content or not content.strip():
            return {
                "valid": False,
                "errors": ["프롬프트 내용이 비어 있습니다."],
                "warnings": [],
                "score": 0
            }

        # 2. 길이 검증
        content_length = len(content)
        if content_length < self.MIN_PROMPT_LENGTH:
            errors.append(f"프롬프트가 너무 짧습니다. (현재: {content_length}자, 최소: {self.MIN_PROMPT_LENGTH}자)")
            score -= 30
        elif content_length > self.MAX_PROMPT_LENGTH:
            warnings.append(f"프롬프트가 다소 깁니다. (현재: {content_length}자, 권장 최대: {self.MAX_PROMPT_LENGTH}자)")
            score -= 10

        # 3. 필수 플레이스홀더 검증
        if self.REQUIRED_PLACEHOLDER not in content:
            errors.append(f"필수 플레이스홀더 '{self.REQUIRED_PLACEHOLDER}'가 누락되었습니다.")
            score -= 40

        # 4. 마크다운 구조 검증
        structure_issues = self._check_markdown_structure(content)
        for issue, is_error in structure_issues:
            if is_error:
                errors.append(issue)
                score -= 15
            else:
                warnings.append(issue)
                score -= 5

        # 5. 품질 검사
        quality_issues = self._check_quality(content)
        for issue, penalty in quality_issues:
            warnings.append(issue)
            score -= penalty

        # 점수 정규화
        score = max(0, min(100, score))

        return {
            "valid": len(errors) == 0,
            "errors": errors,
            "warnings": warnings,
            "score": score
        }

    def validate_questions(self, questions: List[str]) -> Dict[str, Any]:
        """
        추천 질문 검증

        Args:
            questions: 질문 목록

        Returns:
            검증 결과
        """
        errors: List[str] = []
        warnings: List[str] = []
        score = 100

        # 1. 질문 개수 검증
        num_questions = len(questions)
        if num_questions < self.MIN_QUESTIONS:
            errors.append(f"질문이 너무 적습니다. (현재: {num_questions}개, 최소: {self.MIN_QUESTIONS}개)")
            score -= 30
        elif num_questions > self.MAX_QUESTIONS:
            warnings.append(f"질문이 다소 많습니다. (현재: {num_questions}개, 권장 최대: {self.MAX_QUESTIONS}개)")
            score -= 5

        # 2. 개별 질문 검증
        valid_questions = []
        for i, q in enumerate(questions):
            q = q.strip()
            if not q:
                warnings.append(f"질문 {i+1}이(가) 비어 있습니다.")
                score -= 5
                continue

            if len(q) < self.MIN_QUESTION_LENGTH:
                warnings.append(f"질문 {i+1}이(가) 너무 짧습니다: '{q[:30]}...'")
                score -= 5
            elif not q.endswith("?") and not q.endswith("요") and not q.endswith("까"):
                warnings.append(f"질문 {i+1}이(가) 질문 형식이 아닐 수 있습니다.")
                score -= 3

            valid_questions.append(q)

        # 3. 중복 검사
        unique_questions = set(questions)
        if len(unique_questions) < len(questions):
            duplicates = len(questions) - len(unique_questions)
            warnings.append(f"{duplicates}개의 중복 질문이 있습니다.")
            score -= duplicates * 5

        score = max(0, min(100, score))

        return {
            "valid": len(errors) == 0,
            "errors": errors,
            "warnings": warnings,
            "score": score,
            "valid_questions": valid_questions
        }

    def _check_markdown_structure(self, content: str) -> List[Tuple[str, bool]]:
        """마크다운 구조 검사"""
        issues = []

        # 제목 존재 여부
        has_heading = bool(re.search(r'^#+\s+.+', content, re.MULTILINE))
        if not has_heading:
            issues.append(("마크다운 제목(#)이 없습니다. 구조화를 권장합니다.", False))

        # 목록 존재 여부
        has_list = bool(re.search(r'^[-*\d]+[.\)]\s+.+', content, re.MULTILINE))
        if not has_list:
            issues.append(("목록(-/* 또는 번호)이 없습니다. 지침을 목록으로 정리하면 좋습니다.", False))

        # 역할 정의 확인
        first_lines = content[:500].lower()
        role_keywords = ["당신은", "you are", "역할", "role", "ai", "어시스턴트", "assistant"]
        has_role = any(kw in first_lines for kw in role_keywords)
        if not has_role:
            issues.append(("첫 부분에 AI 역할 정의가 없는 것 같습니다.", False))

        return issues

    def _check_quality(self, content: str) -> List[Tuple[str, int]]:
        """품질 검사"""
        issues = []

        # 너무 일반적인 내용 검사
        generic_phrases = [
            "I am an AI",
            "I cannot",
            "as an AI language model",
            "I don't have personal"
        ]
        for phrase in generic_phrases:
            if phrase.lower() in content.lower():
                issues.append((f"일반적인 AI 면책 문구가 포함되어 있습니다: '{phrase}'", 10))

        # 영어 혼용 비율 검사 (한국어 프롬프트 기준)
        english_ratio = len(re.findall(r'[a-zA-Z]+', content)) / max(len(content.split()), 1)
        if english_ratio > 0.5:
            issues.append(("영어 비중이 높습니다. 한국어 사용을 권장합니다.", 5))

        return issues

    def validate_all(
        self,
        prompt_content: str,
        questions: List[str]
    ) -> Dict[str, Any]:
        """
        프롬프트와 질문 모두 검증

        Args:
            prompt_content: 프롬프트 내용
            questions: 질문 목록

        Returns:
            종합 검증 결과
        """
        prompt_result = self.validate_prompt(prompt_content)
        questions_result = self.validate_questions(questions)

        # 종합 점수 계산 (프롬프트 70%, 질문 30%)
        total_score = int(prompt_result["score"] * 0.7 + questions_result["score"] * 0.3)

        return {
            "valid": prompt_result["valid"] and questions_result["valid"],
            "prompt_validation": prompt_result,
            "questions_validation": questions_result,
            "total_score": total_score,
            "all_errors": prompt_result["errors"] + questions_result["errors"],
            "all_warnings": prompt_result["warnings"] + questions_result["warnings"]
        }


# 싱글톤 인스턴스
prompt_validator = PromptValidator()
