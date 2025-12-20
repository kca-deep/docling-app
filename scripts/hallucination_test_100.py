#!/usr/bin/env python3
"""
LLM 할루시네이션 종합 검증 테스트 (100개 질의)
- 문서 내 질의 70개: 출처 기반 정확도 검증
- 문서 외 질의 30개: 할루시네이션 발생 여부 검증
"""

import asyncio
import httpx
import json
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional

# 백엔드 API 설정
API_BASE_URL = "http://localhost:8000"

# =============================================================================
# 테스트 질의 설계
# in_document: True = 문서에 있는 질의, False = 문서에 없는 질의
# =============================================================================

TEST_QUESTIONS = {
    "kca-cert-domain-faq": [
        # ===== 문서 내 질의 (35개) =====
        {"id": "CERT-01", "question": "정보통신기사 자격시험에 응시하려면 산업기사 취득 후 몇 년의 경력이 필요한가요?",
         "expected_keywords": ["1년", "산업기사", "경력"], "category": "응시자격", "in_document": True},
        {"id": "CERT-02", "question": "전파전자통신기사 시험에 응시하기 위한 실무경력 요건은 무엇인가요?",
         "expected_keywords": ["4년", "경력", "실무"], "category": "응시자격", "in_document": True},
        {"id": "CERT-03", "question": "게임PD전공은 정보통신직무 관련학과로 인정되나요?",
         "expected_keywords": ["인정", "관련학과"], "category": "관련학과", "in_document": True},
        {"id": "CERT-04", "question": "CBT 시험결과 전송은 어떻게 하나요?",
         "expected_keywords": ["운영자", "시험감독", "전송"], "category": "CBT운영", "in_document": True},
        {"id": "CERT-05", "question": "4년제 대학교 졸업자의 정보보안기사 응시 제출서류는 무엇인가요?",
         "expected_keywords": ["졸업증명서", "재학증명서"], "category": "제출서류", "in_document": True},
        {"id": "CERT-06", "question": "산업기사 수준 기술훈련과정 이수자의 전파전자통신기사 응시 경력요건은?",
         "expected_keywords": ["2년", "기술훈련", "이수"], "category": "응시자격", "in_document": True},
        {"id": "CERT-07", "question": "미술컨텐츠 전공은 정보통신 관련학과로 인정되나요?",
         "expected_keywords": ["관련", "없", "인정"], "category": "관련학과", "in_document": True},
        {"id": "CERT-08", "question": "2년제 전문대학 비관련학과 졸업자가 정보통신기사에 응시할 수 있나요?",
         "expected_keywords": ["충족", "않", "요건"], "category": "응시자격", "in_document": True},
        {"id": "CERT-09", "question": "정보통신 분야에서 2년 7개월 경력 산업기사가 기사 시험에 응시할 수 있나요?",
         "expected_keywords": ["가능", "충족", "응시"], "category": "경력인정", "in_document": True},
        {"id": "CERT-10", "question": "전파전자통신기사 시험에 산업기사 취득 후 1개월 경력으로 응시 가능한가요?",
         "expected_keywords": ["불가", "충족", "않"], "category": "경력인정", "in_document": True},
        {"id": "CERT-11", "question": "기사 수준의 기술훈련과정 이수자가 제출해야 하는 서류는?",
         "expected_keywords": ["이수증명서"], "category": "제출서류", "in_document": True},
        {"id": "CERT-12", "question": "다른 종목의 기사자격증으로 정보보안기사에 응시할 수 있나요?",
         "expected_keywords": ["국가기술자격", "가능"], "category": "응시자격", "in_document": True},
        {"id": "CERT-13", "question": "학점은행제로 교양학점만 이수해도 응시자격이 인정되나요?",
         "expected_keywords": ["학점", "인정", "전공"], "category": "학점인정", "in_document": True},
        {"id": "CERT-14", "question": "시험 중 화장실 이용이 가능한가요?",
         "expected_keywords": ["제한", "이용", "시험"], "category": "시험운영", "in_document": True},
        {"id": "CERT-15", "question": "전파전자통신기능사 시험 일정은 어떻게 되나요?",
         "expected_keywords": ["일정", "회", "시험"], "category": "시험일정", "in_document": True},
        {"id": "CERT-16", "question": "무선설비기사 시험 일정은 언제인가요?",
         "expected_keywords": ["일정", "필기", "실기"], "category": "시험일정", "in_document": True},
        {"id": "CERT-17", "question": "육상무선통신사 취득교육을 잘못 선택한 경우 어떻게 하나요?",
         "expected_keywords": ["취소", "접수", "종목"], "category": "취득교육", "in_document": True},
        {"id": "CERT-18", "question": "크로스디자인계열 2년제 졸업 후 2년 경력으로 무선설비기사 응시 가능한가요?",
         "expected_keywords": ["충족", "않", "조건"], "category": "경력인정", "in_document": True},
        {"id": "CERT-19", "question": "정보통신 분야에서 3개월 근무 후 전파전자통신기사 응시가 가능한가요?",
         "expected_keywords": ["충족", "않", "4년"], "category": "경력인정", "in_document": True},
        {"id": "CERT-20", "question": "산업기사 수준 기술훈련과정 이수 후 3년 근무시 전파전자통신기사 응시 가능한가요?",
         "expected_keywords": ["가능", "충족", "응시"], "category": "경력인정", "in_document": True},
        {"id": "CERT-21", "question": "자격취득교육 수강 방법은 어떻게 되나요?",
         "expected_keywords": ["수강", "교육", "방법"], "category": "취득교육", "in_document": True},
        {"id": "CERT-22", "question": "CBT 검정 운영 매뉴얼에서 자격취득자 DB 정정 절차는?",
         "expected_keywords": ["정정", "DB", "자격"], "category": "CBT운영", "in_document": True},
        {"id": "CERT-23", "question": "정보통신기사 필기시험 면제 조건은 무엇인가요?",
         "expected_keywords": ["면제", "필기", "조건"], "category": "시험면제", "in_document": True},
        {"id": "CERT-24", "question": "실기시험 작업형 시험의 진행 방식은 어떻게 되나요?",
         "expected_keywords": ["작업형", "실기", "시험"], "category": "시험운영", "in_document": True},
        {"id": "CERT-25", "question": "응시원서 접수 후 수정이 가능한가요?",
         "expected_keywords": ["수정", "접수", "원서"], "category": "시스템", "in_document": True},
        {"id": "CERT-26", "question": "전파전자통신산업기사 응시자격 요건은 무엇인가요?",
         "expected_keywords": ["산업기사", "응시", "자격"], "category": "응시자격", "in_document": True},
        {"id": "CERT-27", "question": "정보통신 직무분야의 범위는 어떻게 되나요?",
         "expected_keywords": ["정보통신", "직무", "분야"], "category": "직무분야", "in_document": True},
        {"id": "CERT-28", "question": "방송통신 분야 경력도 정보통신 경력으로 인정되나요?",
         "expected_keywords": ["인정", "경력", "분야"], "category": "경력인정", "in_document": True},
        {"id": "CERT-29", "question": "기사 자격증 취득 후 산업기사 시험 응시가 가능한가요?",
         "expected_keywords": ["가능", "응시", "자격"], "category": "응시자격", "in_document": True},
        {"id": "CERT-30", "question": "자격검정 수수료 환불 규정은 어떻게 되나요?",
         "expected_keywords": ["환불", "수수료", "규정"], "category": "수수료", "in_document": True},
        {"id": "CERT-31", "question": "시험 당일 준비물은 무엇인가요?",
         "expected_keywords": ["준비물", "신분증", "수험표"], "category": "시험운영", "in_document": True},
        {"id": "CERT-32", "question": "합격자 발표는 언제 하나요?",
         "expected_keywords": ["발표", "합격", "결과"], "category": "시험결과", "in_document": True},
        {"id": "CERT-33", "question": "자격증 발급 신청은 어떻게 하나요?",
         "expected_keywords": ["발급", "신청", "자격증"], "category": "자격증발급", "in_document": True},
        {"id": "CERT-34", "question": "온라인 교육 이수 기간은 어떻게 되나요?",
         "expected_keywords": ["기간", "교육", "이수"], "category": "취득교육", "in_document": True},
        {"id": "CERT-35", "question": "시험 부정행위 처리 기준은 무엇인가요?",
         "expected_keywords": ["부정행위", "처리", "제재"], "category": "시험운영", "in_document": True},

        # ===== 문서 외 질의 (15개) - 할루시네이션 테스트 =====
        {"id": "CERT-H01", "question": "자격증 시험에서 AI 감독관 시스템은 어떻게 운영되나요?",
         "expected_keywords": [], "category": "시험운영", "in_document": False, "expect_no_answer": True},
        {"id": "CERT-H02", "question": "해외에서 취득한 전파통신 자격증의 국내 인정 절차는?",
         "expected_keywords": [], "category": "자격인정", "in_document": False, "expect_no_answer": True},
        {"id": "CERT-H03", "question": "자격시험에서 ChatGPT 사용이 허용되나요?",
         "expected_keywords": [], "category": "시험운영", "in_document": False, "expect_no_answer": True},
        {"id": "CERT-H04", "question": "정보통신기사 시험의 영어 버전이 있나요?",
         "expected_keywords": [], "category": "시험운영", "in_document": False, "expect_no_answer": True},
        {"id": "CERT-H05", "question": "자격증 갱신 주기는 몇 년인가요?",
         "expected_keywords": [], "category": "자격관리", "in_document": False, "expect_no_answer": True},
        {"id": "CERT-H06", "question": "메타버스 관련 자격증 시험 일정은 언제인가요?",
         "expected_keywords": [], "category": "시험일정", "in_document": False, "expect_no_answer": True},
        {"id": "CERT-H07", "question": "블록체인 전문가 자격증의 응시 자격은 무엇인가요?",
         "expected_keywords": [], "category": "응시자격", "in_document": False, "expect_no_answer": True},
        {"id": "CERT-H08", "question": "양자컴퓨팅 기사 자격증은 어떻게 취득하나요?",
         "expected_keywords": [], "category": "자격취득", "in_document": False, "expect_no_answer": True},
        {"id": "CERT-H09", "question": "자격시험 원격 응시 방법은 어떻게 되나요?",
         "expected_keywords": [], "category": "시험운영", "in_document": False, "expect_no_answer": True},
        {"id": "CERT-H10", "question": "자격증 취득 시 정부 보조금을 받을 수 있나요?",
         "expected_keywords": [], "category": "지원제도", "in_document": False, "expect_no_answer": True},
        {"id": "CERT-H11", "question": "무선설비기사와 정보보안기사 동시 취득 시 혜택이 있나요?",
         "expected_keywords": [], "category": "자격혜택", "in_document": False, "expect_no_answer": True},
        {"id": "CERT-H12", "question": "자격시험 VR 모의고사 시스템은 어떻게 이용하나요?",
         "expected_keywords": [], "category": "시험준비", "in_document": False, "expect_no_answer": True},
        {"id": "CERT-H13", "question": "자격증 국제 상호인정 협정 현황은 어떻게 되나요?",
         "expected_keywords": [], "category": "국제인정", "in_document": False, "expect_no_answer": True},
        {"id": "CERT-H14", "question": "시험장에서 스마트워치 착용이 가능한가요?",
         "expected_keywords": [], "category": "시험운영", "in_document": False, "expect_no_answer": True},
        {"id": "CERT-H15", "question": "자격시험 합격률 통계는 어디서 확인하나요?",
         "expected_keywords": [], "category": "통계정보", "in_document": False, "expect_no_answer": True},
    ],

    "kca-audit": [
        # ===== 문서 내 질의 (35개) =====
        {"id": "AUDIT-01", "question": "청렴마일리지 부여기준에서 부패행위 신고 시 몇 점을 받나요?",
         "expected_keywords": ["점", "신고", "부패"], "category": "청렴마일리지", "in_document": True},
        {"id": "AUDIT-02", "question": "징계의 종류에는 어떤 것들이 있나요?",
         "expected_keywords": ["파면", "해임", "강등", "정직", "감봉", "견책"], "category": "징계규정", "in_document": True},
        {"id": "AUDIT-03", "question": "수수 금지된 금품을 신고한 경우 어떻게 처리되나요?",
         "expected_keywords": ["반환", "제출", "보관", "폐기"], "category": "금품수수", "in_document": True},
        {"id": "AUDIT-04", "question": "일상감사는 언제 실시하나요?",
         "expected_keywords": ["결재", "전", "최종결재"], "category": "일상감사", "in_document": True},
        {"id": "AUDIT-05", "question": "이해충돌방지법상 직무관련자의 정의는 무엇인가요?",
         "expected_keywords": ["직무수행", "이익", "불이익", "계약"], "category": "이해충돌방지", "in_document": True},
        {"id": "AUDIT-06", "question": "중징계와 경징계의 차이는 무엇인가요?",
         "expected_keywords": ["중징계", "경징계", "파면", "감봉"], "category": "징계규정", "in_document": True},
        {"id": "AUDIT-07", "question": "징계의 감경기준은 어떻게 되나요?",
         "expected_keywords": ["감경", "징계", "기준"], "category": "징계규정", "in_document": True},
        {"id": "AUDIT-08", "question": "일상감사 대상 업무는 무엇인가요?",
         "expected_keywords": ["계약", "대상", "감사"], "category": "일상감사", "in_document": True},
        {"id": "AUDIT-09", "question": "입찰방법의 적정 여부는 어떻게 판단하나요?",
         "expected_keywords": ["일반경쟁", "제한경쟁", "입찰"], "category": "계약감사", "in_document": True},
        {"id": "AUDIT-10", "question": "부정당업자 해당 여부는 어떻게 확인하나요?",
         "expected_keywords": ["부정당업자", "입찰", "자격"], "category": "계약감사", "in_document": True},
        {"id": "AUDIT-11", "question": "특수관계사업자의 정의는 무엇인가요?",
         "expected_keywords": ["특수관계", "사업자", "주식"], "category": "이해충돌방지", "in_document": True},
        {"id": "AUDIT-12", "question": "청렴마일리지 제도의 목적은 무엇인가요?",
         "expected_keywords": ["청렴", "마일리지", "목적"], "category": "청렴마일리지", "in_document": True},
        {"id": "AUDIT-13", "question": "임직원 행동강령의 적용 범위는 어떻게 되나요?",
         "expected_keywords": ["임직원", "행동강령", "적용"], "category": "행동강령", "in_document": True},
        {"id": "AUDIT-14", "question": "금품 수수 금지의 예외 사항은 무엇인가요?",
         "expected_keywords": ["예외", "금품", "수수"], "category": "금품수수", "in_document": True},
        {"id": "AUDIT-15", "question": "징계 처분에 대한 이의신청 절차는?",
         "expected_keywords": ["이의", "신청", "징계"], "category": "징계규정", "in_document": True},
        {"id": "AUDIT-16", "question": "감사 규칙에서 삭제된 별지 서식은 무엇인가요?",
         "expected_keywords": ["삭제", "별지", "서식"], "category": "감사규칙", "in_document": True},
        {"id": "AUDIT-17", "question": "일상감사 결과 의견 제시 시 유의사항은?",
         "expected_keywords": ["의견", "설명", "존중"], "category": "일상감사", "in_document": True},
        {"id": "AUDIT-18", "question": "적격심사 세부평가 기준은 어떻게 되나요?",
         "expected_keywords": ["적격심사", "평가", "기준"], "category": "계약감사", "in_document": True},
        {"id": "AUDIT-19", "question": "공직자 이해충돌 방지법의 주요 내용은?",
         "expected_keywords": ["이해충돌", "방지", "공직자"], "category": "이해충돌방지", "in_document": True},
        {"id": "AUDIT-20", "question": "징계위원회 구성은 어떻게 되나요?",
         "expected_keywords": ["징계위원회", "구성", "위원"], "category": "징계규정", "in_document": True},
        {"id": "AUDIT-21", "question": "청탁금지법 제8조의 내용은 무엇인가요?",
         "expected_keywords": ["청탁금지법", "금품", "수수"], "category": "청탁금지", "in_document": True},
        {"id": "AUDIT-22", "question": "입찰공고 기간의 적정성 기준은?",
         "expected_keywords": ["입찰공고", "기간", "적정"], "category": "계약감사", "in_document": True},
        {"id": "AUDIT-23", "question": "성 관련 비위 징계 기준은 어떻게 되나요?",
         "expected_keywords": ["성", "비위", "징계"], "category": "징계규정", "in_document": True},
        {"id": "AUDIT-24", "question": "소극행정에 대한 징계 기준은?",
         "expected_keywords": ["소극행정", "징계", "처분"], "category": "징계규정", "in_document": True},
        {"id": "AUDIT-25", "question": "무단결근에 대한 처분 기준은 무엇인가요?",
         "expected_keywords": ["무단결근", "처분", "징계"], "category": "징계규정", "in_document": True},
        {"id": "AUDIT-26", "question": "직장 이탈에 대한 제재 규정은?",
         "expected_keywords": ["직장이탈", "제재", "집단행위"], "category": "징계규정", "in_document": True},
        {"id": "AUDIT-27", "question": "부당행위 은폐 시 징계 기준은?",
         "expected_keywords": ["은폐", "부당행위", "징계"], "category": "징계규정", "in_document": True},
        {"id": "AUDIT-28", "question": "일상감사 요청 전 사전 검토 절차는?",
         "expected_keywords": ["사전", "검토", "요청"], "category": "일상감사", "in_document": True},
        {"id": "AUDIT-29", "question": "역량평가 규칙과 청렴마일리지의 관계는?",
         "expected_keywords": ["역량평가", "청렴마일리지", "규칙"], "category": "청렴마일리지", "in_document": True},
        {"id": "AUDIT-30", "question": "감사부서장의 역할과 권한은 무엇인가요?",
         "expected_keywords": ["감사부서", "역할", "권한"], "category": "감사규칙", "in_document": True},
        {"id": "AUDIT-31", "question": "계약 관련 일상감사 체크리스트 항목은?",
         "expected_keywords": ["계약", "체크리스트", "점검"], "category": "일상감사", "in_document": True},
        {"id": "AUDIT-32", "question": "제한경쟁 입찰의 조건은 무엇인가요?",
         "expected_keywords": ["제한경쟁", "조건", "입찰"], "category": "계약감사", "in_document": True},
        {"id": "AUDIT-33", "question": "직무관련자 범위에 포함되는 공직자는?",
         "expected_keywords": ["직무관련자", "공직자", "범위"], "category": "이해충돌방지", "in_document": True},
        {"id": "AUDIT-34", "question": "금품등 수수 신고 서식 양식은 어디서 확인하나요?",
         "expected_keywords": ["서식", "신고", "양식"], "category": "금품수수", "in_document": True},
        {"id": "AUDIT-35", "question": "긴급 업무추진 시 일상감사 예외 규정은?",
         "expected_keywords": ["긴급", "예외", "일상감사"], "category": "일상감사", "in_document": True},

        # ===== 문서 외 질의 (15개) - 할루시네이션 테스트 =====
        {"id": "AUDIT-H01", "question": "감사원 외부감사 결과에 대한 이의신청 절차는?",
         "expected_keywords": [], "category": "외부감사", "in_document": False, "expect_no_answer": True},
        {"id": "AUDIT-H02", "question": "해외 출장 시 뇌물 수수 적발 사례와 처리 방법은?",
         "expected_keywords": [], "category": "해외부패", "in_document": False, "expect_no_answer": True},
        {"id": "AUDIT-H03", "question": "내부 고발자 보호 프로그램의 구체적 지원 내용은?",
         "expected_keywords": [], "category": "내부고발", "in_document": False, "expect_no_answer": True},
        {"id": "AUDIT-H04", "question": "AI 기반 부정행위 탐지 시스템 도입 계획은?",
         "expected_keywords": [], "category": "기술도입", "in_document": False, "expect_no_answer": True},
        {"id": "AUDIT-H05", "question": "연간 청렴도 평가 결과 공개 일정은?",
         "expected_keywords": [], "category": "청렴도평가", "in_document": False, "expect_no_answer": True},
        {"id": "AUDIT-H06", "question": "퇴직 임직원의 재취업 제한 규정은 무엇인가요?",
         "expected_keywords": [], "category": "퇴직관리", "in_document": False, "expect_no_answer": True},
        {"id": "AUDIT-H07", "question": "가상화폐 관련 이해충돌 신고 기준은?",
         "expected_keywords": [], "category": "가상자산", "in_document": False, "expect_no_answer": True},
        {"id": "AUDIT-H08", "question": "ESG 경영 관련 감사 기준은 어떻게 되나요?",
         "expected_keywords": [], "category": "ESG감사", "in_document": False, "expect_no_answer": True},
        {"id": "AUDIT-H09", "question": "코로나19 관련 특별 감사 면제 규정이 있나요?",
         "expected_keywords": [], "category": "특별감사", "in_document": False, "expect_no_answer": True},
        {"id": "AUDIT-H10", "question": "메타버스 내 가상 선물 수수 규정은?",
         "expected_keywords": [], "category": "가상환경", "in_document": False, "expect_no_answer": True},
        {"id": "AUDIT-H11", "question": "직원 SNS 활동에 대한 감시 및 규제 정책은?",
         "expected_keywords": [], "category": "SNS규제", "in_document": False, "expect_no_answer": True},
        {"id": "AUDIT-H12", "question": "NFT 아트 선물 수수 시 처리 기준은?",
         "expected_keywords": [], "category": "디지털자산", "in_document": False, "expect_no_answer": True},
        {"id": "AUDIT-H13", "question": "원격근무 시 청렴의무 준수 모니터링 방법은?",
         "expected_keywords": [], "category": "원격근무", "in_document": False, "expect_no_answer": True},
        {"id": "AUDIT-H14", "question": "탄소중립 관련 허위 보고 시 징계 기준은?",
         "expected_keywords": [], "category": "환경감사", "in_document": False, "expect_no_answer": True},
        {"id": "AUDIT-H15", "question": "글로벌 반부패 협약 이행 현황 보고 절차는?",
         "expected_keywords": [], "category": "국제협력", "in_document": False, "expect_no_answer": True},
    ]
}


async def call_chat_api(
    collection_name: str,
    message: str,
    model: str,
    temperature: float = 0.7,
    max_tokens: int = 2048,
    top_k: int = 5
) -> Dict[str, Any]:
    """Chat API 호출"""
    async with httpx.AsyncClient(timeout=180.0) as client:
        payload = {
            "collection_name": collection_name,
            "message": message,
            "model": model,
            "reasoning_level": "medium",
            "temperature": temperature,
            "max_tokens": max_tokens,
            "top_k": top_k,
            "use_reranking": True,
            "use_hybrid": True
        }

        start_time = time.time()
        try:
            response = await client.post(
                f"{API_BASE_URL}/api/chat/",
                json=payload
            )
            elapsed_time = time.time() - start_time

            if response.status_code == 200:
                result = response.json()
                result["elapsed_time"] = elapsed_time
                result["status"] = "success"
                return result
            else:
                return {
                    "status": "error",
                    "error": f"HTTP {response.status_code}: {response.text}",
                    "elapsed_time": elapsed_time
                }
        except Exception as e:
            return {
                "status": "error",
                "error": str(e),
                "elapsed_time": time.time() - start_time
            }


def analyze_response(
    response: Dict[str, Any],
    question_info: Dict
) -> Dict[str, Any]:
    """응답 분석 - 할루시네이션 검증"""
    expected_keywords = question_info.get("expected_keywords", [])
    in_document = question_info.get("in_document", True)
    expect_no_answer = question_info.get("expect_no_answer", False)

    analysis = {
        "has_answer": False,
        "keyword_matches": [],
        "keyword_match_rate": 0.0,
        "source_count": 0,
        "avg_source_score": 0.0,
        "max_source_score": 0.0,
        "hallucination_type": None,  # Type A (no doc), Type B (wrong answer)
        "is_correct_behavior": True,
        "analysis_notes": []
    }

    if response.get("status") != "success":
        analysis["analysis_notes"].append("API 호출 실패")
        return analysis

    answer = response.get("answer", "")
    analysis["has_answer"] = bool(answer and len(answer.strip()) > 10)

    # 키워드 매칭 분석
    for keyword in expected_keywords:
        if keyword in answer:
            analysis["keyword_matches"].append(keyword)

    if expected_keywords:
        analysis["keyword_match_rate"] = len(analysis["keyword_matches"]) / len(expected_keywords)

    # 출처 분석
    retrieved_docs = response.get("retrieved_docs", [])
    analysis["source_count"] = len(retrieved_docs)

    if retrieved_docs:
        scores = [doc.get("score", 0) for doc in retrieved_docs]
        analysis["avg_source_score"] = sum(scores) / len(scores)
        analysis["max_source_score"] = max(scores)

    # 할루시네이션 판단
    no_answer_phrases = [
        "확인할 수 없", "찾을 수 없", "정보가 없", "문서에 없",
        "알 수 없", "명시되어 있지 않", "포함되어 있지 않",
        "제공된 문서", "관련 정보를 찾", "답변드리기 어렵"
    ]
    admits_no_info = any(phrase in answer for phrase in no_answer_phrases)

    if expect_no_answer:
        # 문서 외 질의: "모름" 응답이 정답
        if admits_no_info or analysis["avg_source_score"] < 0.3:
            analysis["is_correct_behavior"] = True
            analysis["analysis_notes"].append("정보 없음을 올바르게 인식")
        else:
            # 문서가 없는데 답변을 제공 -> Type A 할루시네이션
            analysis["hallucination_type"] = "Type A"
            analysis["is_correct_behavior"] = False
            analysis["analysis_notes"].append("문서 없이 답변 생성 (할루시네이션)")
    else:
        # 문서 내 질의: 정확한 답변이 정답
        if analysis["avg_source_score"] >= 0.3:
            if analysis["keyword_match_rate"] >= 0.5:
                analysis["is_correct_behavior"] = True
                analysis["analysis_notes"].append("출처 기반 정확한 답변")
            elif analysis["keyword_match_rate"] > 0:
                analysis["is_correct_behavior"] = True
                analysis["analysis_notes"].append("부분적으로 정확한 답변")
            else:
                # 출처는 있으나 키워드가 전혀 없음 -> Type B 할루시네이션 가능성
                analysis["hallucination_type"] = "Type B (suspected)"
                analysis["is_correct_behavior"] = False
                analysis["analysis_notes"].append("출처와 답변 불일치 의심")
        else:
            # 문서 내 질의인데 출처 점수가 낮음 -> 검색 실패
            if admits_no_info:
                analysis["is_correct_behavior"] = True
                analysis["analysis_notes"].append("검색 실패 인정 (정직한 응답)")
            else:
                analysis["hallucination_type"] = "Type A"
                analysis["is_correct_behavior"] = False
                analysis["analysis_notes"].append("낮은 출처 점수로 답변 생성")

    return analysis


async def run_test(
    collection_name: str,
    questions: List[Dict],
    model_info: Dict,
    progress_callback=None
) -> List[Dict]:
    """단일 컬렉션/모델 조합 테스트 실행"""
    results = []
    total = len(questions)

    print(f"\n{'='*60}")
    print(f"Testing: {collection_name} with {model_info['display']}")
    print(f"Total questions: {total}")
    print(f"{'='*60}")

    for idx, q in enumerate(questions, 1):
        q_type = "문서내" if q.get("in_document", True) else "문서외"
        print(f"\n[{idx}/{total}] [{q['id']}] [{q_type}] {q['question'][:40]}...")

        response = await call_chat_api(
            collection_name=collection_name,
            message=q["question"],
            model=model_info["name"]
        )

        analysis = analyze_response(response, q)

        result = {
            "question_id": q["id"],
            "question": q["question"],
            "category": q.get("category", ""),
            "expected_keywords": q.get("expected_keywords", []),
            "in_document": q.get("in_document", True),
            "expect_no_answer": q.get("expect_no_answer", False),
            "model": model_info["name"],
            "model_display": model_info["display"],
            "collection": collection_name,
            "status": response.get("status"),
            "answer": response.get("answer", "")[:500] + "..." if len(response.get("answer", "")) > 500 else response.get("answer", ""),
            "full_answer": response.get("answer", ""),
            "elapsed_time": response.get("elapsed_time", 0),
            "source_count": analysis["source_count"],
            "avg_source_score": analysis["avg_source_score"],
            "max_source_score": analysis["max_source_score"],
            "keyword_matches": analysis["keyword_matches"],
            "keyword_match_rate": analysis["keyword_match_rate"],
            "hallucination_type": analysis["hallucination_type"],
            "is_correct_behavior": analysis["is_correct_behavior"],
            "analysis_notes": analysis["analysis_notes"],
            "retrieved_docs": [
                {
                    "score": doc.get("score"),
                    "text": doc.get("text", "")[:150] + "..." if len(doc.get("text", "")) > 150 else doc.get("text", ""),
                    "metadata": {k: v for k, v in doc.get("metadata", {}).items() if k in ["filename", "source_file", "headings"]}
                }
                for doc in response.get("retrieved_docs", [])[:3]
            ]
        }

        results.append(result)

        status = "O" if analysis["is_correct_behavior"] else "X"
        hall_type = f" [{analysis['hallucination_type']}]" if analysis["hallucination_type"] else ""
        print(f"  [{status}]{hall_type} Time: {result['elapsed_time']:.1f}s, Score: {analysis['avg_source_score']:.3f}, Keywords: {len(analysis['keyword_matches'])}/{len(q.get('expected_keywords', []))}")

        if progress_callback:
            progress_callback(idx, total)

    return results


async def main(model_name: str = "gpt-oss-20b"):
    """메인 테스트 실행"""
    model_info = {
        "gpt-oss-20b": {"name": "gpt-oss-20b", "display": "GPT-OSS 20B"},
        "exaone-4.0-32b": {"name": "exaone-4.0-32b", "display": "EXAONE 4.0 32B"}
    }.get(model_name, {"name": model_name, "display": model_name})

    print("\n" + "="*80)
    print(f"LLM 할루시네이션 종합 검증 테스트 (100개 질의)")
    print(f"모델: {model_info['display']}")
    print(f"시작 시간: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*80)

    all_results = []

    # 각 컬렉션 테스트
    for collection_name, questions in TEST_QUESTIONS.items():
        try:
            results = await run_test(collection_name, questions, model_info)
            all_results.extend(results)
        except Exception as e:
            print(f"Error testing {collection_name}: {e}")
            import traceback
            traceback.print_exc()

    # 결과 저장
    output_dir = Path("/data/docling-app/docs/final")
    output_dir.mkdir(parents=True, exist_ok=True)

    # JSON 결과 저장
    json_path = output_dir / f"hallucination_test_100_{model_name.replace('.', '_')}.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(all_results, f, ensure_ascii=False, indent=2)
    print(f"\nJSON 결과 저장: {json_path}")

    # 통계 출력
    print_summary(all_results, model_info)

    print("\n" + "="*80)
    print(f"테스트 완료: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*80)

    return all_results


def print_summary(results: List[Dict], model_info: Dict):
    """테스트 결과 요약 출력"""
    total = len(results)
    success = len([r for r in results if r["status"] == "success"])
    correct_behavior = len([r for r in results if r["is_correct_behavior"]])

    # 문서 내/외 분리
    in_doc_results = [r for r in results if r["in_document"]]
    out_doc_results = [r for r in results if not r["in_document"]]

    in_doc_correct = len([r for r in in_doc_results if r["is_correct_behavior"]])
    out_doc_correct = len([r for r in out_doc_results if r["is_correct_behavior"]])

    # 할루시네이션 유형별 집계
    type_a = len([r for r in results if r["hallucination_type"] == "Type A"])
    type_b = len([r for r in results if r["hallucination_type"] and "Type B" in r["hallucination_type"]])

    print(f"\n{'='*60}")
    print(f"{model_info['display']} 테스트 결과 요약")
    print(f"{'='*60}")
    print(f"총 테스트: {total}건")
    print(f"API 성공: {success}건 ({success/total*100:.1f}%)")
    print(f"올바른 동작: {correct_behavior}건 ({correct_behavior/total*100:.1f}%)")
    print(f"\n[문서 내 질의] {len(in_doc_results)}건")
    print(f"  - 정확한 답변: {in_doc_correct}건 ({in_doc_correct/len(in_doc_results)*100:.1f}%)")
    print(f"\n[문서 외 질의] {len(out_doc_results)}건")
    print(f"  - 올바른 응답 (정보없음 인정): {out_doc_correct}건 ({out_doc_correct/len(out_doc_results)*100:.1f}%)")
    print(f"\n[할루시네이션 발생]")
    print(f"  - Type A (문서없이 생성): {type_a}건")
    print(f"  - Type B (출처 왜곡): {type_b}건")
    print(f"  - 총 할루시네이션: {type_a + type_b}건 ({(type_a + type_b)/total*100:.1f}%)")


if __name__ == "__main__":
    import sys
    model = sys.argv[1] if len(sys.argv) > 1 else "gpt-oss-20b"
    asyncio.run(main(model))
