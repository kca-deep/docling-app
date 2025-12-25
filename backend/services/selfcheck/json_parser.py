"""
셀프진단 JSON 파싱 유틸리티
LLM 응답에서 JSON 추출 및 복구
"""
import json
import logging
import re
from typing import Any, Dict, List, Optional

from backend.config.settings import settings

logger = logging.getLogger(__name__)


class SelfCheckJsonParser:
    """셀프진단 LLM 응답 JSON 파싱 및 복구"""

    def fix_json_string(self, json_str: str) -> str:
        """
        LLM이 생성한 불완전한 JSON 수정

        Args:
            json_str: 원본 JSON 문자열

        Returns:
            str: 수정된 JSON 문자열
        """
        # 0. LLM이 중간에 삽입한 주석/독백 제거
        json_str = re.sub(r'"\s*,?\s*"\?\?[^"]*"', '"', json_str)
        json_str = re.sub(r'"\s*,?\s*"Wait[^"]*"', '"', json_str)
        json_str = re.sub(r'"\s*,?\s*"Hold on[^"]*"', '"', json_str)
        json_str = re.sub(r'"\s*,?\s*"Let me[^"]*"', '"', json_str)

        # 0-1. 중복된 JSON 시작 제거
        if json_str.count('{"items"') > 1:
            first_items = json_str.find('{"items"')
            second_items = json_str.find('{"items"', first_items + 1)
            if second_items > 0:
                json_str = json_str[:second_items]

        # 1. 유니코드 따옴표/특수문자 정규화
        quote_replacements = {
            '「': '"', '」': '"', '『': '"', '』': '"',
            '"': '"', '"': '"', ''': "'", ''': "'",
            '„': '"', '‟': '"', '«': '"', '»': '"',
            '‹': "'", '›': "'",
            '：': ':', '，': ',', '；': ';',
            '０': '0', '１': '1', '２': '2', '３': '3', '４': '4',
            '５': '5', '６': '6', '７': '7', '８': '8', '９': '9',
            '．': '.', '｛': '{', '｝': '}', '［': '[', '］': ']',
            '\u3000': ' ', '　': ' ',
        }
        for old, new in quote_replacements.items():
            json_str = json_str.replace(old, new)

        # 2. 제어 문자 제거 (탭, 줄바꿈 제외)
        json_str = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f]', '', json_str)

        # 3. 후행 쉼표 제거
        json_str = re.sub(r',\s*([}\]])', r'\1', json_str)

        # 4. 빈 answer 값 수정
        json_str = re.sub(r'"answer"\s*:\s*""', '"answer":"need_check"', json_str)

        # 5. 잘린 JSON 복구 시도
        if '"items"' in json_str:
            complete_items = list(re.finditer(r'"risk_level"\s*:\s*"[^"]+"\s*}', json_str))
            if complete_items:
                last_complete_end = complete_items[-1].end()
                remaining = json_str[last_complete_end:]
                if ']' not in remaining or '}' not in remaining:
                    json_str = json_str[:last_complete_end]
                    json_str += '],"requires_review":false,"review_reason":"","summary":"부분 분석 완료"}'

        return json_str

    def extract_items_from_corrupted(self, text: str) -> Dict[str, Any]:
        """
        손상된 JSON에서 유효한 항목만 추출하여 재구성
        """
        item_pattern = r'\{\s*"item_number"\s*:\s*(\d+)\s*,\s*"answer"\s*:\s*"([^"]*)"\s*,\s*"confidence"\s*:\s*([0-9.]+)\s*,\s*"evidence"\s*:\s*"([^"]*)"\s*,\s*"risk_level"\s*:\s*"([^"]+)"\s*\}'

        matches = re.findall(item_pattern, text)
        if not matches:
            logger.warning("[SelfCheck] No valid items found in corrupted JSON")
            raise ValueError("유효한 항목을 찾을 수 없습니다.")

        items = []
        seen_numbers = set()
        for match in matches:
            item_num = int(match[0])
            if item_num in seen_numbers:
                continue
            seen_numbers.add(item_num)

            answer = match[1] if match[1] in ("yes", "no", "need_check") else "need_check"
            items.append({
                "item_number": item_num,
                "answer": answer,
                "confidence": float(match[2]) if match[2] else settings.SELFCHECK_DEFAULT_CONFIDENCE,
                "evidence": match[3] or "분석 내용 없음",
                "risk_level": match[4] if match[4] in ("high", "medium", "low") else "medium"
            })

        items.sort(key=lambda x: x["item_number"])

        requires_review = any(
            item["item_number"] <= 5 and item["answer"] == "yes"
            for item in items
        )

        logger.info(f"[SelfCheck] Extracted {len(items)} valid items from corrupted JSON")

        return {
            "items": items,
            "requires_review": requires_review,
            "review_reason": "필수 항목 중 '예' 응답이 있어 검토 필요" if requires_review else "",
            "summary": f"{len(items)}개 항목 분석 완료"
        }

    def parse_llm_response(self, response_text: str) -> Dict[str, Any]:
        """
        LLM 응답 파싱

        Args:
            response_text: LLM 응답 텍스트

        Returns:
            dict: 파싱된 결과
        """
        # JSON 블록 추출
        json_match = re.search(r'```json\s*([\s\S]*?)\s*```', response_text)
        if json_match:
            json_str = json_match.group(1)
        else:
            json_match = re.search(r'\{[\s\S]*\}', response_text)
            if json_match:
                json_str = json_match.group(0)
            else:
                json_str = response_text

        # 1차 시도: 원본 파싱
        try:
            result = json.loads(json_str)
            if "items" in result and len(result["items"]) > 0:
                return result
        except json.JSONDecodeError:
            pass

        # 2차 시도: JSON 수정 후 파싱
        try:
            fixed_json = self.fix_json_string(json_str)
            result = json.loads(fixed_json)
            if "items" in result and len(result["items"]) > 0:
                logger.info("[SelfCheck] Parsed fixed JSON successfully")
                return result
        except json.JSONDecodeError as e:
            logger.warning(f"[SelfCheck] JSON fix failed: {e}")

        # 3차 시도: 손상된 JSON에서 항목 직접 추출
        try:
            logger.info("[SelfCheck] Attempting to extract items from corrupted JSON")
            return self.extract_items_from_corrupted(response_text)
        except ValueError as e:
            logger.error(f"[SelfCheck] All parsing methods failed: {e}")
            logger.error(f"[SelfCheck] Original response: {response_text[:1500]}")
            raise ValueError(f"LLM 응답 파싱 실패: {e}")

    def sanitize_llm_response(self, content: str) -> str:
        """
        LLM 응답에서 JSON 객체만 추출
        """
        if not content:
            return ""

        # 1. 제어 문자 제거
        content = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f]', '', content)

        # 2. ellipsis 패턴 제거
        content = re.sub(r'\.{2,}', '', content)
        content = re.sub(r'…', '', content)

        # 3. JSON 객체 추출
        json_start = content.find('{')
        if json_start == -1:
            return content.strip()

        # 중괄호 카운팅
        brace_count = 0
        json_end = -1
        in_string = False
        escape_next = False

        for i in range(json_start, len(content)):
            char = content[i]

            if escape_next:
                escape_next = False
                continue

            if char == '\\':
                escape_next = True
                continue

            if char == '"' and not escape_next:
                in_string = not in_string
                continue

            if not in_string:
                if char == '{':
                    brace_count += 1
                elif char == '}':
                    brace_count -= 1
                    if brace_count == 0:
                        json_end = i
                        break

        if json_end > json_start:
            return content[json_start:json_end + 1].strip()

        return content[json_start:].strip()

    def repair_truncated_json(self, truncated: str) -> str:
        """
        잘린 JSON 문자열 복구 시도
        """
        if not truncated.startswith("{"):
            return truncated

        if truncated.rstrip().endswith("}"):
            return truncated

        complete_field_pattern = r'"[^"]+"\s*:\s*(?:"[^"]*"|[0-9.]+)'
        matches = list(re.finditer(complete_field_pattern, truncated))

        if matches:
            last_match = matches[-1]
            repaired = truncated[:last_match.end()]
            repaired = repaired.rstrip().rstrip(",")
            repaired += "}"
            logger.info(f"[SelfCheck] Repaired truncated JSON: {repaired[:100]}...")
            return repaired

        return truncated

    def normalize_answer(self, answer: str) -> str:
        """답변 정규화"""
        if not answer:
            return "need_check"
        answer = answer.lower().strip()
        if answer in ("yes", "y", "예"):
            return "yes"
        if answer in ("no", "n", "아니오", "아니요"):
            return "no"
        if answer in ("unknown", "?", "모름"):
            return "need_check"
        return "need_check"

    def safe_float(self, val: Any, default: float = 0.8) -> float:
        """안전한 float 변환"""
        if val is None:
            return default
        try:
            return float(val)
        except (ValueError, TypeError):
            return default

    def parse_individual_response(
        self,
        content: str,
        item_number: int,
        user_answer: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        개별 항목 응답 파싱 (확장된 필드 지원)
        """
        try:
            # 1. JSON 블록 추출 시도
            json_str = None

            json_match = re.search(r'\{[^{}]*\}', content, re.DOTALL)
            if json_match:
                json_str = json_match.group(0)
            else:
                json_match = re.search(r'\{[\s\S]*\}', content)
                if json_match:
                    json_str = json_match.group(0)

            if not json_str:
                truncated_match = re.search(r'\{[\s\S]*', content)
                if truncated_match:
                    json_str = self.repair_truncated_json(truncated_match.group(0))

            if not json_str:
                logger.warning(f"[SelfCheck] Item {item_number}: No JSON found in response")
                return None

            parsed = json.loads(json_str)

            # 필드 추출
            n = parsed.get("n") or parsed.get("item_number") or item_number
            answer = self.normalize_answer(parsed.get("a") or parsed.get("answer") or "")
            confidence = self.safe_float(parsed.get("c") or parsed.get("confidence"), 0.8)

            judgment = parsed.get("j", "") or parsed.get("judgment", "")
            quote = parsed.get("q", "") or parsed.get("quote", "")
            reasoning = parsed.get("r", "") or parsed.get("reasoning", "") or parsed.get("ing", "")
            user_comparison = parsed.get("uc", "") or parsed.get("user_comparison", "")

            legacy_evidence = parsed.get("e") or parsed.get("evidence") or ""

            # evidence 생성
            if judgment and reasoning:
                evidence = f"{judgment}. {reasoning}"
            elif legacy_evidence:
                evidence = legacy_evidence
            elif judgment:
                evidence = judgment
            elif reasoning:
                evidence = reasoning
            else:
                evidence = "분석 완료"

            # risk_level 결정
            risk_level = parsed.get("r") or parsed.get("risk_level") or "medium"
            if answer == "yes":
                risk_level = "high" if item_number <= 5 else "medium"
            elif answer == "no":
                risk_level = "low"

            # 사용자 답변과 비교
            if user_answer and user_answer not in ("unknown", None):
                if user_answer != answer and not user_comparison:
                    user_comparison = f"사용자는 '{self._format_user_answer(user_answer)}'를 선택했으나, AI는 '{self._format_user_answer(answer)}'로 판단했습니다."

            result = {
                "item_number": int(n),
                "answer": answer,
                "confidence": confidence,
                "evidence": evidence,
                "risk_level": risk_level,
                "judgment": judgment,
                "quote": quote,
                "reasoning": reasoning,
                "user_comparison": user_comparison if user_comparison else None
            }

            logger.info(f"[SelfCheck] Item {item_number} parsed: answer={answer}")
            return result

        except json.JSONDecodeError as e:
            logger.warning(f"[SelfCheck] Item {item_number} JSON parse failed: {e}")

            # 잘린 JSON 복구 재시도
            truncated_match = re.search(r'\{[\s\S]*', content)
            if truncated_match:
                try:
                    repaired = self.repair_truncated_json(truncated_match.group(0))
                    parsed = json.loads(repaired)
                    n = parsed.get("n") or parsed.get("item_number") or item_number
                    answer = self.normalize_answer(parsed.get("a") or parsed.get("answer") or "")
                    confidence = self.safe_float(parsed.get("c") or parsed.get("confidence"), 0.8)
                    judgment = parsed.get("j", "") or parsed.get("judgment", "")
                    quote = parsed.get("q", "") or parsed.get("quote", "")
                    reasoning = parsed.get("r", "") or parsed.get("reasoning", "") or parsed.get("ing", "")
                    user_comparison = parsed.get("uc", "") or parsed.get("user_comparison", "")
                    legacy_evidence = parsed.get("e") or parsed.get("evidence") or ""

                    if judgment and reasoning:
                        evidence = f"{judgment}. {reasoning}"
                    elif legacy_evidence:
                        evidence = legacy_evidence
                    elif judgment:
                        evidence = judgment
                    elif reasoning:
                        evidence = reasoning
                    else:
                        evidence = "분석 완료 (일부 정보 누락)"

                    risk_level = "high" if answer == "yes" and item_number <= 5 else ("low" if answer == "no" else "medium")

                    logger.info(f"[SelfCheck] Item {item_number} recovered from truncated JSON")
                    return {
                        "item_number": int(n),
                        "answer": answer,
                        "confidence": confidence,
                        "evidence": evidence,
                        "risk_level": risk_level,
                        "judgment": judgment,
                        "quote": quote,
                        "reasoning": reasoning,
                        "user_comparison": user_comparison if user_comparison else None
                    }
                except json.JSONDecodeError:
                    pass

            return self.extract_individual_fields(content, item_number, user_answer)
        except Exception as e:
            logger.error(f"[SelfCheck] Item {item_number} parse error: {e}")
            return None

    def extract_individual_fields(
        self,
        content: str,
        item_number: int,
        user_answer: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """JSON 파싱 실패 시 정규식으로 필드 추출"""
        try:
            n_match = re.search(r'"n"\s*:\s*(\d+)', content)
            a_match = re.search(r'"a"\s*:\s*"([^"]*)"', content)
            c_match = re.search(r'"c"\s*:\s*([0-9.]+)', content)
            judgment_match = re.search(r'"j"\s*:\s*"([^"]*)"', content) or re.search(r'"judgment"\s*:\s*"([^"]*)"', content)
            quote_match = re.search(r'"q"\s*:\s*"([^"]*)"', content) or re.search(r'"quote"\s*:\s*"([^"]*)"', content)
            reasoning_match = re.search(r'"r"\s*:\s*"([^"]*)"', content) or re.search(r'"reasoning"\s*:\s*"([^"]*)"', content) or re.search(r'"ing"\s*:\s*"([^"]*)"', content)
            user_comp_match = re.search(r'"uc"\s*:\s*"([^"]*)"', content) or re.search(r'"user_comparison"\s*:\s*"([^"]*)"', content)

            if not a_match:
                logger.warning(f"[SelfCheck] Item {item_number}: Could not extract answer field")
                return None

            answer = self.normalize_answer(a_match.group(1))
            judgment = judgment_match.group(1) if judgment_match else ""
            quote = quote_match.group(1) if quote_match else ""
            reasoning = reasoning_match.group(1) if reasoning_match else ""
            user_comparison = user_comp_match.group(1) if user_comp_match else ""

            if judgment and reasoning:
                evidence = f"{judgment}. {reasoning}"
            elif judgment:
                evidence = judgment
            elif reasoning:
                evidence = reasoning
            else:
                evidence = "분석 완료"

            risk_level = "high" if answer == "yes" and item_number <= 5 else ("low" if answer == "no" else "medium")

            if user_answer and user_answer not in ("unknown", None) and user_answer != answer and not user_comparison:
                user_comparison = f"사용자는 '{self._format_user_answer(user_answer)}'를 선택했으나, AI는 '{self._format_user_answer(answer)}'로 판단했습니다."

            result = {
                "item_number": item_number,
                "answer": answer,
                "confidence": self.safe_float(c_match.group(1) if c_match else "0.8"),
                "evidence": evidence,
                "risk_level": risk_level,
                "judgment": judgment,
                "quote": quote,
                "reasoning": reasoning,
                "user_comparison": user_comparison if user_comparison else None
            }

            logger.info(f"[SelfCheck] Item {item_number} extracted via regex: answer={answer}")
            return result

        except Exception as e:
            logger.error(f"[SelfCheck] Item {item_number} regex extraction failed: {e}")
            return None

    def _format_user_answer(self, answer: Optional[str]) -> str:
        """사용자 답변을 한국어로 변환"""
        if answer == "yes":
            return "예"
        elif answer == "no":
            return "아니오"
        elif answer == "unknown" or answer is None:
            return "모름"
        return "모름"


# 싱글톤 인스턴스
json_parser = SelfCheckJsonParser()
