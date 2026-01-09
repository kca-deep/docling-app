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


class SelfCheckAttachment(Base):
    """셀프진단 첨부파일 모델"""
    __tablename__ = "selfcheck_attachments"

    id = Column(Integer, primary_key=True, index=True)
    submission_id = Column(String(36), ForeignKey("selfcheck_submissions.submission_id", ondelete="CASCADE"),
                          nullable=False, index=True)

    # 파일 정보
    original_filename = Column(String(255), nullable=False)  # 원본 파일명
    stored_filename = Column(String(255), nullable=False)    # 저장된 파일명 (UUID)
    file_path = Column(String(500), nullable=False)          # 저장 경로
    file_size = Column(Integer, nullable=False)              # 파일 크기 (bytes)
    mime_type = Column(String(100), nullable=True)           # MIME 타입

    # 텍스트 추출 결과
    extracted_text = Column(Text, nullable=True)             # 추출된 텍스트
    extraction_status = Column(String(20), default="pending")  # pending, completed, failed
    extraction_error = Column(Text, nullable=True)           # 추출 실패 시 에러

    # 메타데이터
    created_at = Column(DateTime, default=now_naive)

    def __repr__(self):
        return f"<SelfCheckAttachment(id={self.id}, filename='{self.original_filename}', status='{self.extraction_status}')>"


class SelfCheckFeedback(Base):
    """셀프진단 피드백 모델"""
    __tablename__ = "selfcheck_feedbacks"

    id = Column(Integer, primary_key=True, index=True)
    submission_id = Column(String(36), ForeignKey("selfcheck_submissions.submission_id", ondelete="CASCADE"),
                          unique=True, nullable=False, index=True)

    # 피드백 내용
    security_review_required = Column(Boolean, nullable=True)  # 1. 보안성검토절차 필요 여부
    administrative_security = Column(Text, nullable=True)       # 2. 관리적 보안내용
    technical_security = Column(Text, nullable=True)            # 3. 기술적 보안내용
    overall_opinion = Column(Text, nullable=True)               # 4. 종합의견

    # AI 초안 (비교용 저장)
    ai_draft_administrative = Column(Text, nullable=True)
    ai_draft_technical = Column(Text, nullable=True)
    ai_draft_overall = Column(Text, nullable=True)

    # 상태 관리: draft(초기), in_progress(작성중), completed(완료)
    status = Column(String(20), default="draft", index=True)

    # 작성자 정보
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    updated_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    completed_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # 타임스탬프
    created_at = Column(DateTime, default=now_naive)
    updated_at = Column(DateTime, default=now_naive, onupdate=now_naive)
    completed_at = Column(DateTime, nullable=True)

    def __repr__(self):
        return f"<SelfCheckFeedback(id={self.id}, submission_id='{self.submission_id}', status='{self.status}')>"
