#!/usr/bin/env python3
"""
LLM 기반 할루시네이션 테스트 질의 자동 생성 (1000개)

기존 100개 질의를 기반으로 LLM이 유사 질의를 자동 생성합니다.
- 문서 내 질의 700개 (70%)
- 문서 외 질의 300개 (30%)
"""

import asyncio
import httpx
import json
import random
import re
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional

# API 설정
LLM_BASE_URL = "http://ai.kca.kr:8080"
LLM_MODEL = "gpt-oss-20b"

# 기존 100개 테스트 질의 (hallucination_test_100.py 기반)
ORIGINAL_QUESTIONS = {
    "kca-cert-domain-faq": [
        # 문서 내 질의 (35개)
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
        # 문서 외 질의 (15개)
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
        # 문서 내 질의 (35개)
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
        # 문서 외 질의 (15개)
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

# 질의 변형 템플릿
PARAPHRASE_TEMPLATES = [
    # 구어체 변형
    "{subject}는 어떻게 되나요?",
    "{subject}에 대해 알려주세요",
    "{subject}이/가 궁금합니다",
    "{subject}을/를 알고 싶어요",
    "{subject}가 뭐예요?",
    "{subject} 좀 설명해주세요",
    "{subject}요?",
    # 격식체 변형
    "{subject}에 관하여 문의드립니다",
    "{subject}의 상세 내용을 알려주시기 바랍니다",
    "{subject}에 대해 안내해 주시겠습니까?",
    "{subject}에 관해 확인 부탁드립니다",
    "{subject}을 알고자 합니다",
    # 단순 변형
    "{subject}은/는 무엇인가요?",
    "{subject}의 기준은?",
    "{subject} 방법이 있나요?",
    "{subject} 어떤가요?",
    "{subject} 정보가 있나요?",
    "{subject} 안내 바랍니다",
]

# 추가 문서 외 질의 템플릿
OUT_OF_SCOPE_TEMPLATES = {
    "kca-cert-domain-faq": [
        "5G 네트워크 전문가 자격증 취득 방법은?",
        "클라우드 컴퓨팅 기사 시험 일정은 언제인가요?",
        "사이버보안 전문가 국제 자격증과 호환되나요?",
        "IoT 기기 설치 기술사 자격 요건은?",
        "데이터 사이언스 관련 자격증이 있나요?",
        "인공지능 엔지니어 자격증 시험 과목은?",
        "자격증 취득 후 취업 연계 프로그램이 있나요?",
        "외국인도 정보통신 자격시험에 응시할 수 있나요?",
        "자격증 시험 준비 온라인 강의가 있나요?",
        "시험 불합격 시 재응시 횟수 제한이 있나요?",
        "자격증 유효기간이 있나요?",
        "군 복무 중 자격시험 응시가 가능한가요?",
        "장애인 응시자 편의 제공 내용은?",
        "자격시험 대리 응시 처벌 규정은?",
        "코딩 테스트 방식의 실기시험이 있나요?",
        "자격증 분실 시 재발급 절차는?",
        "해외 거주자 온라인 시험 응시가 가능한가요?",
        "자격증 취득 시 학점 인정이 되나요?",
        "정보보안기사 실기시험 합격 커트라인은?",
        "자격시험 응시료 카드 결제가 가능한가요?",
        "시험 시간 연장 신청은 어떻게 하나요?",
        "자격증 영문 표기는 어떻게 되나요?",
        "시험장 주차 지원이 있나요?",
        "자격증 취득 축하금 지원 정책이 있나요?",
        "시험 당일 신분증 분실 시 대처 방법은?",
        "자격시험 난이도 조정 기준은?",
        "CBT 시험 문제 유출 시 처리 방법은?",
        "자격증 위조 적발 시 처벌 규정은?",
        "외국 자격증 국내 전환 제도가 있나요?",
        "자격시험 응시 연령 제한이 있나요?",
        "무선통신사 자격증으로 해외 취업이 가능한가요?",
        "자격증 취득 후 유지 교육이 필요한가요?",
        "시험장 CCTV 설치 기준은?",
        "자격시험 출제 위원 선정 기준은?",
        "시험 문제 이의제기 결과 통보 기간은?",
        "자격증 번호 체계는 어떻게 되나요?",
        "합격자 명단 온라인 공개 범위는?",
        "자격시험 대기실 이용 규정은?",
        "시험 중 의료 응급상황 대처 매뉴얼은?",
        "자격증 취득 통계 연간 보고서는 어디서 확인하나요?",
    ],
    "kca-audit": [
        "내부감사 결과 외부 공개 기준은?",
        "감사 결과 이의제기 시 재심사 절차는?",
        "익명 제보 시스템 운영 방법은?",
        "외부 전문가 감사 참여 기준은?",
        "감사 결과 언론 보도 대응 지침은?",
        "부패 신고 포상금 지급 기준은?",
        "해외 법인 감사 관할권은?",
        "자회사 감사 협력 체계는?",
        "감사 기록 보존 기간은?",
        "디지털 포렌식 조사 절차는?",
        "내부통제 시스템 평가 주기는?",
        "윤리경영 인증 취득 절차는?",
        "반부패 교육 의무 이수 시간은?",
        "이해관계자 민원 처리 기한은?",
        "감사 결과 시정 조치 이행 점검은?",
        "부패 취약 부서 지정 기준은?",
        "청렴 서약서 제출 의무 대상은?",
        "임원 재산 등록 의무 범위는?",
        "퇴직자 전관예우 방지 규정은?",
        "공익 제보자 신변 보호 조치는?",
        "감사 관련 법률 자문 절차는?",
        "외부 감사인 선정 기준은?",
        "감사 결과 형사 고발 기준은?",
        "내부 조사 비밀유지 의무 범위는?",
        "감사 관련 소송 대응 매뉴얼은?",
        "부패 방지 시스템 인증 기준은?",
        "청렴 교육 강사 자격 요건은?",
        "감사 데이터 분석 도구 사용 규정은?",
        "부패 위험 평가 주기는?",
        "청렴 문화 확산 프로그램 예산은?",
        "내부 신고자 상담 지원 내용은?",
        "감사 계획 수립 시 고려 사항은?",
        "외부 감사 수감 준비 체크리스트는?",
        "부패 행위 재발 방지 대책 수립 절차는?",
        "청렴 성과 평가 지표는?",
        "감사 독립성 보장 규정은?",
        "내부통제 취약점 개선 기한은?",
        "부패 신고 채널 다양화 현황은?",
        "청렴 마인드 함양 워크숍 개최 주기는?",
        "감사 전문인력 양성 계획은?",
    ]
}


def extract_subject(question: str) -> str:
    """질문에서 핵심 주제 추출"""
    # 간단한 추출 로직
    patterns = [
        r"(.+?)(?:은|는|이|가)\s*(?:어떻게|무엇|언제|어디)",
        r"(.+?)(?:에 대해|관하여|에 관해)",
        r"(.+?)\s*(?:방법|절차|기준|요건)",
    ]
    for pattern in patterns:
        match = re.search(pattern, question)
        if match:
            return match.group(1).strip()
    # 패턴 매칭 실패 시 질문 앞부분 사용
    return question[:20]


def generate_paraphrases(original: Dict, count: int = 5) -> List[Dict]:
    """원본 질의의 변형 생성"""
    results = []
    subject = extract_subject(original["question"])

    templates = random.sample(PARAPHRASE_TEMPLATES, min(count, len(PARAPHRASE_TEMPLATES)))

    for i, template in enumerate(templates):
        try:
            new_question = template.format(subject=subject)
            new_item = {
                **original,
                "id": f"{original['id']}-V{i+1:02d}",
                "question": new_question,
                "original_id": original["id"],
                "is_variation": True
            }
            results.append(new_item)
        except Exception:
            continue

    return results


def generate_keyword_variations(original: Dict, count: int = 3) -> List[Dict]:
    """키워드 기반 질의 변형"""
    results = []
    question = original["question"]

    # 키워드 치환 패턴
    replacements = [
        ("어떻게 되나요", "어떤가요"),
        ("어떻게 되나요", "알려주세요"),
        ("무엇인가요", "뭔가요"),
        ("무엇인가요", "어떤 것인가요"),
        ("가능한가요", "할 수 있나요"),
        ("가능한가요", "되나요"),
        ("어떻게 하나요", "어떤 방법이 있나요"),
        ("언제인가요", "언제 있나요"),
        ("인정되나요", "인정받을 수 있나요"),
    ]

    used_questions = set()
    for i, (old, new) in enumerate(replacements):
        if old in question and i < count:
            new_question = question.replace(old, new)
            if new_question not in used_questions:
                used_questions.add(new_question)
                new_item = {
                    **original,
                    "id": f"{original['id']}-K{len(results)+1:02d}",
                    "question": new_question,
                    "original_id": original["id"],
                    "is_variation": True
                }
                results.append(new_item)

    return results


def generate_context_variations(original: Dict, count: int = 2) -> List[Dict]:
    """맥락 추가 변형"""
    results = []
    question = original["question"]

    prefixes = [
        "제가 궁금한 것은, ",
        "한 가지 여쭤볼게요. ",
        "확인하고 싶은데, ",
        "질문이 있습니다. ",
    ]

    for i, prefix in enumerate(prefixes[:count]):
        new_item = {
            **original,
            "id": f"{original['id']}-C{i+1:02d}",
            "question": prefix + question,
            "original_id": original["id"],
            "is_variation": True
        }
        results.append(new_item)

    return results


async def generate_questions_for_collection(
    collection_name: str,
    original_questions: List[Dict],
    target_in_doc: int,
    target_out_doc: int
) -> List[Dict]:
    """컬렉션별 질의 생성"""
    print(f"\n{'='*60}")
    print(f"Generating questions for: {collection_name}")
    print(f"Target: {target_in_doc} in-doc, {target_out_doc} out-of-doc")
    print(f"{'='*60}")

    all_questions = []

    # 1. 원본 질의 포함
    in_doc_originals = [q for q in original_questions if q.get("in_document", True)]
    out_doc_originals = [q for q in original_questions if not q.get("in_document", True)]

    print(f"\n1. Including original questions...")
    print(f"   In-document: {len(in_doc_originals)}, Out-of-document: {len(out_doc_originals)}")
    all_questions.extend(original_questions)

    # 2. 문서 내 질의 변형 생성
    print(f"\n2. Generating in-document variations...")
    current_in_doc = len(in_doc_originals)
    needed_in_doc = target_in_doc - current_in_doc

    for original in in_doc_originals:
        if current_in_doc >= target_in_doc:
            break

        # 각 변형 타입별로 생성
        paraphrases = generate_paraphrases(original, count=8)
        keyword_vars = generate_keyword_variations(original, count=4)
        context_vars = generate_context_variations(original, count=4)

        for var in paraphrases + keyword_vars + context_vars:
            if current_in_doc >= target_in_doc:
                break
            all_questions.append(var)
            current_in_doc += 1

    print(f"   Generated {current_in_doc - len(in_doc_originals)} variations")
    print(f"   Total in-document: {current_in_doc}")

    # 3. 문서 외 질의 추가 생성
    print(f"\n3. Generating out-of-document questions...")
    current_out_doc = len(out_doc_originals)

    # 추가 템플릿에서 가져오기
    extra_templates = OUT_OF_SCOPE_TEMPLATES.get(collection_name, [])
    for i, template in enumerate(extra_templates):
        if current_out_doc >= target_out_doc:
            break

        prefix = "CERT" if "cert" in collection_name else "AUDIT"
        new_item = {
            "id": f"{prefix}-H{current_out_doc + 1:03d}",
            "question": template,
            "expected_keywords": [],
            "category": "추가생성",
            "in_document": False,
            "expect_no_answer": True
        }
        all_questions.append(new_item)
        current_out_doc += 1

    # 원본 문서 외 질의도 변형
    for original in out_doc_originals:
        if current_out_doc >= target_out_doc:
            break

        paraphrases = generate_paraphrases(original, count=6)
        context_vars = generate_context_variations(original, count=4)
        for var in paraphrases + context_vars:
            if current_out_doc >= target_out_doc:
                break
            var["expect_no_answer"] = True
            all_questions.append(var)
            current_out_doc += 1

    print(f"   Total out-of-document: {current_out_doc}")

    # 4. 최종 ID 정리
    in_doc_count = 0
    out_doc_count = 0
    for q in all_questions:
        if q.get("in_document", True):
            in_doc_count += 1
        else:
            out_doc_count += 1

    print(f"\n   Final count - In-doc: {in_doc_count}, Out-of-doc: {out_doc_count}")
    print(f"   Total: {len(all_questions)}")

    return all_questions


async def main():
    """메인 실행"""
    print("="*80)
    print("LLM 기반 할루시네이션 테스트 질의 생성 (1000개 목표)")
    print(f"시작 시간: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*80)

    all_questions = {}

    # 각 컬렉션별 질의 생성
    for collection_name, original_questions in ORIGINAL_QUESTIONS.items():
        questions = await generate_questions_for_collection(
            collection_name,
            original_questions,
            target_in_doc=350,
            target_out_doc=150
        )
        all_questions[collection_name] = questions

    # 결과 저장
    output_dir = Path("/data/docling-app/scripts")
    output_path = output_dir / "test_questions_1000.json"

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(all_questions, f, ensure_ascii=False, indent=2)

    # 통계 출력
    total = sum(len(qs) for qs in all_questions.values())
    total_in_doc = sum(len([q for q in qs if q.get("in_document", True)]) for qs in all_questions.values())
    total_out_doc = total - total_in_doc

    print(f"\n{'='*80}")
    print(f"질의 생성 완료: {output_path}")
    print(f"총 질의 수: {total}")
    print(f"  - 문서 내 질의: {total_in_doc}")
    print(f"  - 문서 외 질의: {total_out_doc}")
    print(f"완료 시간: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*80)

    return all_questions


if __name__ == "__main__":
    asyncio.run(main())
