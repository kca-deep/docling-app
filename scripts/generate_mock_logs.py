"""
ICT기금사업 컬렉션용 가상 로그 데이터 생성 스크립트

Usage:
    cd backend
    python ../scripts/generate_mock_logs.py
"""

import json
import uuid
import random
import hashlib
import os
import sys
from datetime import datetime, timedelta
from pathlib import Path

# 프로젝트 루트 설정
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "backend"))

# 설정
COLLECTION_NAME = "5. ICT기금사업 (100문100답)"
DAYS_TO_GENERATE = 30  # 30일치 데이터 생성
LOGS_DIR = PROJECT_ROOT / "logs"
DATA_DIR = LOGS_DIR / "data"
CONVERSATIONS_DIR = LOGS_DIR / "conversations"

# 디렉토리 생성
DATA_DIR.mkdir(parents=True, exist_ok=True)
CONVERSATIONS_DIR.mkdir(parents=True, exist_ok=True)

# ICT기금사업 관련 샘플 질문들
SAMPLE_QUERIES = [
    "ICT기금사업 신청 자격 요건은 무엇인가요?",
    "기금사업 지원금 한도는 얼마인가요?",
    "사업계획서 작성 방법을 알려주세요",
    "ICT 중소기업 지원 프로그램 종류는?",
    "기금사업 선정 평가 기준이 궁금합니다",
    "사업비 정산 절차는 어떻게 되나요?",
    "기술개발 과제 신청 기간은 언제인가요?",
    "컨소시엄 구성 요건은 무엇인가요?",
    "인건비 계상 기준을 알려주세요",
    "연구개발비 사용 규정이 있나요?",
    "성과물 귀속 규정은 어떻게 되나요?",
    "중간점검 제출 서류는 무엇인가요?",
    "최종보고서 작성 가이드라인은?",
    "사업 변경 승인 절차를 알려주세요",
    "기금 융자 이자율은 얼마인가요?",
    "ICT R&D 바우처 신청 방법은?",
    "스타트업 지원 프로그램 안내해주세요",
    "기금사업 참여 제한 조건이 있나요?",
    "공동연구개발 협약 체결 방법은?",
    "지식재산권 출원 지원금 규모는?",
    "해외진출 지원 사업 내용은?",
    "기업부설연구소 설립 요건은?",
    "기술이전 수익 배분 규정은?",
    "사업화 연계 지원 프로그램은?",
    "ICT 인력양성 사업 참여 방법은?",
    "클라우드 도입 지원 사업 안내해주세요",
    "AI 기술개발 지원 규모는 얼마인가요?",
    "보안 인증 취득 지원 프로그램은?",
    "데이터 활용 사업 지원 내용은?",
    "디지털 전환 컨설팅 지원 대상은?",
]

# 샘플 답변 패턴
SAMPLE_RESPONSES = [
    "해당 사업의 신청 자격은 다음과 같습니다. 첫째, 중소기업기본법 제2조에 따른 중소기업이어야 합니다. 둘째, 신청일 기준 설립 후 1년 이상 경과한 기업이어야 합니다.",
    "지원금 한도는 과제 유형에 따라 다릅니다. 일반 과제는 최대 5억원, 대형 과제는 최대 20억원까지 지원됩니다. 총 사업비의 최대 75%까지 정부지원금으로 편성 가능합니다.",
    "사업계획서는 사업목표, 추진전략, 기술개발 내용, 기대효과, 사업비 산출내역 등을 포함해야 합니다. 첨부 서식은 공고문에서 다운로드 가능합니다.",
    "주요 지원 프로그램으로는 ICT R&D 바우처, 기술개발 지원, 사업화 연계 지원, 해외진출 지원 등이 있습니다. 기업 규모와 사업 목적에 따라 적합한 프로그램을 선택하실 수 있습니다.",
    "선정 평가는 기술성(40점), 사업성(30점), 수행역량(20점), 정책부합성(10점) 기준으로 진행됩니다. 총점 70점 이상이면 선정 대상이 됩니다.",
]

# LLM 모델 목록
LLM_MODELS = ["gpt-oss-20b", "exaone-32b", "hyperclovax-14b"]
REASONING_LEVELS = ["low", "medium", "high"]

def generate_user_hash():
    """가상 사용자 해시 생성"""
    return hashlib.sha256(str(uuid.uuid4()).encode()).hexdigest()

def generate_session_id():
    """세션 ID 생성"""
    return str(uuid.uuid4())

def generate_log_entry(session_id, collection_name, message_type, content,
                       timestamp, llm_model, reasoning_level, retrieval_info=None,
                       response_time_ms=None, token_count=None):
    """로그 엔트리 생성"""
    entry = {
        "log_id": str(uuid.uuid4()),
        "request_id": str(uuid.uuid4()),
        "trace_id": str(uuid.uuid4()),
        "session_id": session_id,
        "collection_name": collection_name,
        "message_type": message_type,
        "message_content": content,
        "reasoning_level": reasoning_level,
        "llm_model": llm_model,
        "llm_params": {
            "temperature": random.uniform(0.5, 0.9),
            "max_tokens": random.choice([1024, 2048, 4096]),
            "top_p": random.uniform(0.8, 0.95)
        },
        "performance": {
            "response_time_ms": response_time_ms or random.randint(500, 3000),
            "token_count": token_count or random.randint(100, 800),
            "retrieval_time_ms": random.randint(50, 300)
        },
        "client_info": {
            "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "ip_address": f"192.168.1.{random.randint(1, 254)}"
        },
        "created_at": timestamp.isoformat()
    }

    if retrieval_info and message_type == "assistant":
        entry["retrieval_info"] = retrieval_info

    # 가끔 에러 발생 (약 2%)
    if random.random() < 0.02:
        entry["error_info"] = {
            "error_type": random.choice(["TimeoutError", "ConnectionError", "RateLimitError"]),
            "message": "서비스 일시적 오류가 발생했습니다.",
            "traceback": "..."
        }

    return entry

def generate_retrieval_info():
    """검색 정보 생성"""
    retrieved_count = random.randint(3, 8)
    scores = sorted([random.uniform(0.5, 0.95) for _ in range(retrieved_count)], reverse=True)

    doc_names = [
        "ICT기금사업_운영지침.pdf",
        "기금사업_신청안내서.pdf",
        "사업비_정산매뉴얼.pdf",
        "기술개발_가이드라인.pdf",
        "중소기업_지원정책.pdf",
        "R&D_바우처_안내.pdf",
        "사업계획서_작성요령.pdf",
        "평가기준_세부내용.pdf",
    ]

    sources = []
    for i, score in enumerate(scores):
        sources.append({
            "document_name": random.choice(doc_names),
            "page_number": random.randint(1, 50),
            "score": round(score, 4)
        })

    return {
        "retrieved_count": retrieved_count,
        "top_scores": [round(s, 4) for s in scores[:5]],
        "sources": sources,
        "retrieval_time_ms": random.randint(50, 200),
        "reranking_used": random.choice([True, False])
    }

def generate_conversation(session_id, user_hash, collection_name, start_time, turn_count):
    """대화 기록 생성"""
    messages = []
    current_time = start_time

    for i in range(turn_count):
        # 사용자 메시지
        user_query = random.choice(SAMPLE_QUERIES)
        messages.append({
            "role": "user",
            "content": user_query,
            "timestamp": current_time.isoformat()
        })

        current_time += timedelta(seconds=random.randint(1, 5))

        # 어시스턴트 응답
        assistant_response = random.choice(SAMPLE_RESPONSES)
        retrieval_info = generate_retrieval_info()

        messages.append({
            "role": "assistant",
            "content": assistant_response,
            "timestamp": current_time.isoformat(),
            "retrieved_docs": [
                {
                    "id": str(uuid.uuid4()),
                    "score": src["score"],
                    "text": f"문서 내용 일부... (페이지 {src['page_number']})",
                    "metadata": {"source": src["document_name"], "page": src["page_number"]}
                }
                for src in retrieval_info["sources"][:3]
            ]
        })

        current_time += timedelta(seconds=random.randint(5, 30))

    end_time = current_time

    return {
        "conversation_id": str(uuid.uuid4()),
        "session_id": session_id,
        "collection_name": collection_name,
        "user_hash": user_hash,
        "messages": messages,
        "metadata": {
            "total_turns": turn_count,
            "has_error": random.random() < 0.02,
            "has_regeneration": random.random() < 0.05,
            "min_retrieval_score": round(random.uniform(0.4, 0.7), 4),
            "duration_seconds": (end_time - start_time).total_seconds(),
            "save_reason": random.choice(["priority_rule", "random_sampling"])
        },
        "started_at": start_time.isoformat(),
        "ended_at": end_time.isoformat(),
        "is_sampled": True,
        "retention_priority": random.choice(["high", "medium", "low"])
    }

def generate_daily_data(target_date: datetime):
    """특정 날짜의 데이터 생성"""
    logs = []
    conversations = []

    # 요일에 따른 사용량 조정 (주말은 적게)
    day_of_week = target_date.weekday()
    if day_of_week >= 5:  # 주말
        session_count = random.randint(5, 15)
    else:  # 평일
        session_count = random.randint(20, 50)

    # 업무시간(9-18시) 가중치
    hour_weights = [0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.2, 0.3, 0.5,  # 0-8시
                    1.0, 1.2, 1.0, 0.8, 1.0, 1.2, 1.0, 0.8, 0.6,  # 9-17시
                    0.4, 0.3, 0.2, 0.2, 0.1, 0.1]                  # 18-23시

    for _ in range(session_count):
        session_id = generate_session_id()
        user_hash = generate_user_hash()
        llm_model = random.choice(LLM_MODELS)
        reasoning_level = random.choice(REASONING_LEVELS)

        # 시간 선택 (가중치 적용)
        hour = random.choices(range(24), weights=hour_weights)[0]
        minute = random.randint(0, 59)
        second = random.randint(0, 59)
        session_start = target_date.replace(hour=hour, minute=minute, second=second)

        # 대화 턴 수 (1-6턴)
        turn_count = random.choices([1, 2, 3, 4, 5, 6],
                                    weights=[30, 30, 20, 10, 7, 3])[0]

        current_time = session_start

        for turn in range(turn_count):
            # 사용자 질문 로그
            user_query = random.choice(SAMPLE_QUERIES)
            user_log = generate_log_entry(
                session_id=session_id,
                collection_name=COLLECTION_NAME,
                message_type="user",
                content=user_query,
                timestamp=current_time,
                llm_model=llm_model,
                reasoning_level=reasoning_level
            )
            logs.append(user_log)

            current_time += timedelta(seconds=random.randint(1, 3))

            # 어시스턴트 응답 로그
            retrieval_info = generate_retrieval_info()
            response_time = random.randint(800, 4000)
            token_count = random.randint(200, 1000)

            assistant_log = generate_log_entry(
                session_id=session_id,
                collection_name=COLLECTION_NAME,
                message_type="assistant",
                content=random.choice(SAMPLE_RESPONSES),
                timestamp=current_time,
                llm_model=llm_model,
                reasoning_level=reasoning_level,
                retrieval_info=retrieval_info,
                response_time_ms=response_time,
                token_count=token_count
            )
            logs.append(assistant_log)

            current_time += timedelta(seconds=random.randint(10, 60))

        # 대화 기록 생성 (30% 확률로 저장)
        if random.random() < 0.3:
            conversation = generate_conversation(
                session_id=session_id,
                user_hash=user_hash,
                collection_name=COLLECTION_NAME,
                start_time=session_start,
                turn_count=turn_count
            )
            conversations.append(conversation)

    return logs, conversations

def main():
    """메인 실행 함수"""
    print(f"ICT기금사업 컬렉션 가상 로그 데이터 생성 시작...")
    print(f"생성 기간: {DAYS_TO_GENERATE}일")
    print(f"로그 디렉토리: {LOGS_DIR}")
    print()

    total_logs = 0
    total_conversations = 0

    end_date = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    start_date = end_date - timedelta(days=DAYS_TO_GENERATE)

    current_date = start_date
    while current_date < end_date:
        date_str = current_date.strftime("%Y-%m-%d")

        # 일별 데이터 생성
        logs, conversations = generate_daily_data(current_date)

        # 로그 파일에 추가 (기존 데이터와 병합)
        log_file = DATA_DIR / f"{date_str}.jsonl"
        existing_logs = []
        if log_file.exists():
            with open(log_file, 'r', encoding='utf-8') as f:
                existing_logs = [json.loads(line) for line in f if line.strip()]

        all_logs = existing_logs + logs
        with open(log_file, 'w', encoding='utf-8') as f:
            for log in all_logs:
                f.write(json.dumps(log, ensure_ascii=False) + '\n')

        # 대화 기록 파일에 추가
        conv_file = CONVERSATIONS_DIR / f"{date_str}.jsonl"
        existing_convs = []
        if conv_file.exists():
            with open(conv_file, 'r', encoding='utf-8') as f:
                existing_convs = [json.loads(line) for line in f if line.strip()]

        all_convs = existing_convs + conversations
        with open(conv_file, 'w', encoding='utf-8') as f:
            for conv in all_convs:
                f.write(json.dumps(conv, ensure_ascii=False) + '\n')

        total_logs += len(logs)
        total_conversations += len(conversations)

        print(f"  {date_str}: 로그 {len(logs)}건, 대화 {len(conversations)}건 생성")

        current_date += timedelta(days=1)

    print()
    print(f"생성 완료!")
    print(f"  총 로그: {total_logs}건")
    print(f"  총 대화: {total_conversations}건")
    print()
    print("통계 집계를 위해 다음 명령을 실행하세요:")
    print("  curl -X POST http://localhost:8000/api/analytics/aggregate")

if __name__ == "__main__":
    main()
