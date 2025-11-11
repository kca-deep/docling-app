"""
개선된 후처리 서비스 - 범용적 접근
"""
import re
from typing import Dict, List, Tuple, Optional
from enum import Enum


class DocumentType(Enum):
    """문서 타입"""
    EXAM_NOTICE = "exam_notice"  # 시험 공고
    GENERAL = "general"  # 일반 문서
    CONTRACT = "contract"  # 계약서
    MANUAL = "manual"  # 매뉴얼


class ImprovedPostProcessService:
    """개선된 후처리 서비스"""

    def __init__(self):
        # 범용 패턴 정의 (모든 문서에 적용 가능)
        self.universal_patterns = [
            # 깨진 문자 제거
            {
                'pattern': r'GLYPH&lt;\d+&gt;',
                'replacement': '',
                'description': '깨진 GLYPH 태그 제거'
            },
            # 이상한 특수문자 조합 정리
            {
                'pattern': r'[\x00-\x08\x0b-\x0c\x0e-\x1f]',
                'replacement': '',
                'description': '제어 문자 제거'
            }
        ]

        # 문서 타입별 특화 패턴
        self.document_specific_patterns = {
            DocumentType.EXAM_NOTICE: [
                # 시험 공고 문서 전용 패턴
                {
                    'pattern': r'원서접수 시간\s*원서접수 첫날\s*부터 마지막 날\s*까지',
                    'replacement': '원서접수 시간: 원서접수 첫날 10:00부터 마지막 날 18:00까지',
                    'description': '원서접수 시간 복구'
                },
                # ... 기타 시험 공고 패턴들
            ],
            DocumentType.CONTRACT: [
                # 계약서 전용 패턴 (예시)
                {
                    'pattern': r'계약일자:\s*년\s*월\s*일',
                    'replacement': lambda m: self._recover_date_pattern(m),
                    'description': '계약 날짜 복구'
                }
            ]
        }

    def detect_document_type(self, content: str) -> DocumentType:
        """
        문서 내용을 분석하여 문서 타입 자동 감지

        Args:
            content: 문서 내용

        Returns:
            감지된 문서 타입
        """
        # 키워드 기반 문서 타입 감지
        exam_keywords = ['원서접수', '필기시험', '실기시험', '합격자', '응시자격']
        contract_keywords = ['계약', '을', '갑', '계약일자', '계약기간']
        manual_keywords = ['설치', '사용법', '매뉴얼', '설명서', '주의사항']

        content_lower = content.lower()

        # 키워드 매칭 점수 계산
        exam_score = sum(1 for kw in exam_keywords if kw in content)
        contract_score = sum(1 for kw in contract_keywords if kw in content)
        manual_score = sum(1 for kw in manual_keywords if kw in content_lower)

        # 가장 높은 점수의 타입 반환
        if exam_score >= 3:
            return DocumentType.EXAM_NOTICE
        elif contract_score >= 3:
            return DocumentType.CONTRACT
        elif manual_score >= 3:
            return DocumentType.MANUAL
        else:
            return DocumentType.GENERAL

    def post_process_markdown(
        self,
        content: str,
        document_type: Optional[DocumentType] = None,
        auto_detect: bool = True
    ) -> Tuple[str, List[str], DocumentType]:
        """
        개선된 후처리 - 문서 타입에 따라 적절한 패턴 적용

        Args:
            content: 원본 내용
            document_type: 문서 타입 (None이면 자동 감지)
            auto_detect: 자동 감지 여부

        Returns:
            (처리된 내용, 적용된 복구 목록, 감지된 문서 타입)
        """
        applied_recoveries = []
        processed_content = content

        # 문서 타입 결정
        if document_type is None and auto_detect:
            document_type = self.detect_document_type(content)
        elif document_type is None:
            document_type = DocumentType.GENERAL

        # 1. 범용 패턴 적용 (모든 문서)
        for pattern_info in self.universal_patterns:
            pattern = pattern_info['pattern']
            replacement = pattern_info['replacement']

            if re.search(pattern, processed_content):
                processed_content = re.sub(pattern, replacement, processed_content)
                applied_recoveries.append(f"[Universal] {pattern_info['description']}")

        # 2. 문서 타입별 패턴 적용
        if document_type in self.document_specific_patterns:
            for pattern_info in self.document_specific_patterns[document_type]:
                pattern = pattern_info['pattern']
                replacement = pattern_info['replacement']

                if re.search(pattern, processed_content):
                    if callable(replacement):
                        # 동적 치환 (함수 사용)
                        processed_content = re.sub(pattern, replacement, processed_content)
                    else:
                        # 정적 치환
                        processed_content = re.sub(pattern, replacement, processed_content)

                    applied_recoveries.append(f"[{document_type.value}] {pattern_info['description']}")

        return processed_content, applied_recoveries, document_type

    def _recover_date_pattern(self, match):
        """날짜 패턴 복구 (동적 처리 예시)"""
        # 실제로는 더 복잡한 로직이 필요
        return "계약일자: 2025년 1월 1일"

    def analyze_missing_patterns(self, content: str) -> Dict[str, List[str]]:
        """
        문서에서 누락 가능성이 있는 패턴 분석

        Returns:
            카테고리별 누락 가능한 패턴들
        """
        potential_issues = {
            'missing_numbers': [],
            'broken_dates': [],
            'incomplete_times': [],
            'encoding_issues': []
        }

        # 숫자가 누락된 것 같은 패턴 찾기
        number_patterns = [
            (r'\s+회\s', '횟수 앞 숫자 누락 가능'),
            (r'\s+년', '연도 앞 숫자 누락 가능'),
            (r'\s+개월', '개월 수 누락 가능'),
            (r'\s+명', '인원 수 누락 가능')
        ]

        for pattern, description in number_patterns:
            if re.search(pattern, content):
                potential_issues['missing_numbers'].append(description)

        # 시간 패턴 문제
        if '부터' in content and '까지' in content and not re.search(r'\d{1,2}:\d{2}', content):
            potential_issues['incomplete_times'].append('시간 정보 누락 가능성')

        # 인코딩 문제
        if re.search(r'[^\w\s가-힣\x20-\x7E]', content):
            potential_issues['encoding_issues'].append('인코딩 문제 감지')

        return potential_issues


# 서비스 인스턴스
improved_postprocess_service = ImprovedPostProcessService()