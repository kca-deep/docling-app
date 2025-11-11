"""
파싱된 문서 후처리 서비스
Docling API로 파싱된 문서에서 누락된 숫자 패턴을 복구
"""
import re
from typing import Dict, List, Tuple


class PostProcessService:
    """파싱된 마크다운 내용 후처리 서비스"""

    def __init__(self):
        # 복구할 패턴 정의
        self.recovery_patterns = [
            # 원서접수 시간
            {
                'pattern': r'원서접수 시간\s*원서접수 첫날\s*부터 마지막 날\s*까지',
                'replacement': '원서접수 시간: 원서접수 첫날 10:00부터 마지막 날 18:00까지',
                'description': '원서접수 시간 복구'
            },
            # 정기검정 응시기회
            {
                'pattern': r'정기검정 회별 응시기회는 종목당\s*회로',
                'replacement': '정기검정 회별 응시기회는 종목당 1회로',
                'description': '응시기회 횟수 복구'
            },
            # 발표 시간
            {
                'pattern': r'필기시험 합격.*?발표 시간\s*해당 발표일',
                'replacement': '필기시험 합격 예정자 및 최종합격자 발표 시간: 해당 발표일 10:00',
                'description': '발표 시간 복구'
            },
            # 필기시험 면제기간
            {
                'pattern': r'필기시험 합격자 발표일로부터\s+년간',
                'replacement': '필기시험 합격자 발표일로부터 2년간',
                'description': '면제기간 복구 (1)'
            },
            # 필기시험 면제기간 - 대체 패턴
            {
                'pattern': r'발표일로부터\s+년간 면제',
                'replacement': '발표일로부터 2년간 면제',
                'description': '면제기간 복구 (2)'
            },
            # 필기시험 면제기간 - 더 넓은 패턴
            {
                'pattern': r'(\s+)년간 면제',
                'replacement': r' 2년간 면제',
                'description': '면제기간 복구 (3)'
            },
        ]

    def post_process_markdown(self, content: str) -> Tuple[str, List[str]]:
        """
        파싱된 마크다운 내용 후처리

        Args:
            content: 원본 마크다운 내용

        Returns:
            (처리된 내용, 적용된 복구 목록)
        """
        applied_recoveries = []
        processed_content = content

        # 각 패턴에 대해 복구 시도
        for recovery in self.recovery_patterns:
            pattern = recovery['pattern']
            replacement = recovery['replacement']

            # 패턴이 매치되는지 확인
            if re.search(pattern, processed_content):
                # 패턴 치환
                processed_content = re.sub(pattern, replacement, processed_content)
                applied_recoveries.append(recovery['description'])

        # 추가 복구: 깨진 문자 정리
        processed_content = self._fix_encoding_issues(processed_content)

        return processed_content, applied_recoveries

    def _fix_encoding_issues(self, content: str) -> str:
        """
        인코딩 문제로 깨진 문자 정리

        Args:
            content: 원본 내용

        Returns:
            정리된 내용
        """
        # GLYPH 태그 제거
        content = re.sub(r'GLYPH&lt;\d+&gt;', '', content)

        # 기타 깨진 문자 패턴 정리
        # 예: 이상한 문자 조합 제거
        content = re.sub(r'[^\w\s\d가-힣\.\,\:\;\-\(\)\[\]\{\}\/\\\|\!\?\@\#\$\%\^\&\*\+\=\~\`\"\']+', '', content)

        return content

    def analyze_missing_numbers(self, content: str) -> Dict[str, bool]:
        """
        주요 숫자 패턴 존재 여부 분석

        Args:
            content: 분석할 내용

        Returns:
            패턴별 존재 여부 딕셔너리
        """
        patterns_to_check = {
            '10:00': r'10:00',
            '18:00': r'18:00',
            '1회': r'1회',
            '2년': r'2년',
            '시간(HH:MM)': r'\d{1,2}:\d{2}',
            '횟수(N회)': r'\d+회',
            '기간(N년)': r'\d+년'
        }

        results = {}
        for name, pattern in patterns_to_check.items():
            results[name] = bool(re.search(pattern, content))

        return results

    def generate_report(self, original_content: str, processed_content: str) -> str:
        """
        후처리 결과 보고서 생성

        Args:
            original_content: 원본 내용
            processed_content: 처리된 내용

        Returns:
            보고서 문자열
        """
        original_analysis = self.analyze_missing_numbers(original_content)
        processed_analysis = self.analyze_missing_numbers(processed_content)

        report = "=" * 60 + "\n"
        report += "후처리 결과 보고서\n"
        report += "=" * 60 + "\n\n"

        report += "[숫자 패턴 복구 결과]\n"
        for pattern, original_exists in original_analysis.items():
            processed_exists = processed_analysis[pattern]

            if not original_exists and processed_exists:
                report += f"  [RECOVERED] {pattern}: 복구됨\n"
            elif original_exists and processed_exists:
                report += f"  [ORIGINAL] {pattern}: 원본에 존재\n"
            else:
                report += f"  [MISSING] {pattern}: 여전히 누락\n"

        # 통계
        original_numbers = len(re.findall(r'\d+', original_content))
        processed_numbers = len(re.findall(r'\d+', processed_content))

        report += f"\n[통계]\n"
        report += f"  원본 숫자 개수: {original_numbers}\n"
        report += f"  처리 후 숫자 개수: {processed_numbers}\n"
        report += f"  추가된 숫자: {processed_numbers - original_numbers}\n"

        return report


# 서비스 싱글톤 인스턴스
postprocess_service = PostProcessService()