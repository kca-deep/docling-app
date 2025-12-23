"""
셀프진단 모델
AI 과제 보안성 검토 셀프진단 데이터 저장
"""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, JSON, Float
from backend.database import Base
from backend.utils.timezone import now_naive


class SelfCheckSubmission(Base):
    """셀프진단 제출 모델"""
    __tablename__ = "selfcheck_submissions"

    id = Column(Integer, primary_key=True, index=True)
    submission_id = Column(String(36), unique=True, nullable=False, index=True)  # UUID

    # 과제 기본정보
    project_name = Column(String(200), nullable=False)
    department = Column(String(100), nullable=False)
    manager_name = Column(String(50), nullable=False)
    contact = Column(String(50), nullable=True)
    email = Column(String(100), nullable=True)
    project_description = Column(Text, nullable=True)

    # 분석 결과
    analysis_result = Column(JSON, nullable=True)  # LLM 분석 결과 전체
    requires_review = Column(Boolean, default=False)  # 상위기관 검토 대상 여부
    review_reason = Column(Text, nullable=True)  # 검토 필요 사유
    summary = Column(Text, nullable=True)  # AI 종합의견
    used_model = Column(String(50), nullable=True)  # 사용된 LLM 모델
    analysis_time_ms = Column(Integer, nullable=True)  # 분석 소요 시간

    # 메타데이터
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    status = Column(String(20), default="completed", index=True)  # draft, completed, submitted
    created_at = Column(DateTime, default=now_naive)
    updated_at = Column(DateTime, default=now_naive, onupdate=now_naive)

    def __repr__(self):
        return f"<SelfCheckSubmission(id={self.id}, submission_id='{self.submission_id}', project='{self.project_name}')>"


class SelfCheckItem(Base):
    """셀프진단 체크리스트 항목 모델"""
    __tablename__ = "selfcheck_items"

    id = Column(Integer, primary_key=True, index=True)
    submission_id = Column(String(36), ForeignKey("selfcheck_submissions.submission_id", ondelete="CASCADE"), nullable=False, index=True)

    item_number = Column(Integer, nullable=False)  # 1~10
    item_category = Column(String(10), nullable=False)  # 'required' or 'optional'
    question = Column(Text, nullable=False)

    # 사용자 입력
    user_answer = Column(String(20), nullable=True)  # 'yes', 'no', 'unknown'
    user_details = Column(Text, nullable=True)  # 세부 내용

    # LLM 분석 결과
    llm_answer = Column(String(20), nullable=True)  # 'yes', 'no', 'need_check'
    llm_confidence = Column(Float, nullable=True)  # 0.0 ~ 1.0
    llm_evidence = Column(Text, nullable=True)  # 판단 근거
    llm_risk_level = Column(String(10), nullable=True)  # 'high', 'medium', 'low'

    # 최종 확정
    final_answer = Column(String(20), nullable=True)  # 사용자 확인 후 최종 값

    def __repr__(self):
        return f"<SelfCheckItem(id={self.id}, item_number={self.item_number}, user='{self.user_answer}', llm='{self.llm_answer}')>"
