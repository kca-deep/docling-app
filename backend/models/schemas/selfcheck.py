"""
셀프진단 스키마
PI 셀프체크 기능 관련
"""
from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from enum import Enum


class SelfCheckItemInput(BaseModel):
    """셀프진단 체크리스트 항목 입력"""
    number: int  # 항목 번호 (1~10)
    user_answer: Optional[str] = None  # yes, no, unknown
    user_details: Optional[str] = None

    @property
    def item_number(self) -> int:
        """item_number 별칭"""
        return self.number


class SelfCheckAnalyzeRequest(BaseModel):
    """셀프진단 분석 요청"""
    project_name: str
    department: str
    manager_name: str
    contact: Optional[str] = None
    email: Optional[str] = None
    project_description: str  # 과제 내용 (LLM 분석 대상)
    checklist_items: List[SelfCheckItemInput]  # 사용자 사전 입력


class SelfCheckItemResult(BaseModel):
    """체크리스트 항목별 분석 결과"""
    item_number: int
    item_category: str  # required, optional
    question: str
    short_label: str
    user_answer: Optional[str] = None  # yes, no, unknown (사용자 선택)
    user_details: Optional[str] = None  # 사용자 입력 세부내용
    llm_answer: str  # yes, no, need_check (AI 분석)
    llm_confidence: float  # 0.0 ~ 1.0
    llm_evidence: str  # 판단 근거 (기존 호환용, judgment + reasoning 조합)
    llm_risk_level: str  # high, medium, low
    match_status: str  # match, mismatch, reference, keep (일치 상태)
    final_answer: Optional[str] = None  # 최종 확정값
    # 확장 필드 (방안 C: 교차검증 통합)
    llm_judgment: Optional[str] = None  # 판단 결과 요약 (20자 이내)
    llm_quote: Optional[str] = None  # 과제내용에서 인용한 근거 문장
    llm_reasoning: Optional[str] = None  # AI의 상세 판단 로직 설명
    llm_user_comparison: Optional[str] = None  # 사용자 답변과 AI 판단 비교 설명 (불일치 시)


class LLMModelStatus(BaseModel):
    """개별 LLM 모델 상태"""
    key: str
    label: str
    description: str
    status: str  # healthy, unhealthy, degraded, unconfigured
    latency_ms: Optional[float] = None
    error: Optional[str] = None


class LLMStatusResponse(BaseModel):
    """LLM 상태 응답"""
    selected_model: str  # 선택된 모델 키
    selected_model_label: str  # 표시 이름
    latency_ms: Optional[float] = None
    all_models: List[LLMModelStatus]  # 전체 모델 상태


class SimilarProject(BaseModel):
    """유사 과제 정보"""
    submission_id: str
    project_name: str
    department: str
    manager_name: str
    similarity_score: int  # 0~100 (%)
    similarity_reason: str  # LLM 생성 유사성 설명
    created_at: str


class SelfCheckAnalyzeResponse(BaseModel):
    """셀프진단 분석 응답"""
    submission_id: str
    requires_review: bool  # 상위기관 검토 대상 여부
    review_reason: Optional[str] = None
    items: List[SelfCheckItemResult]
    summary: str  # 요약 메시지
    next_steps: List[str]  # 다음 단계 안내
    used_model: str  # 사용된 LLM 모델
    analysis_time_ms: int  # 분석 소요 시간
    is_saved: bool = False  # DB 저장 여부
    similar_projects: List[SimilarProject] = []  # 유사 과제 목록


class SelfCheckSubmitRequest(BaseModel):
    """셀프진단 제출 요청 (최종 확정)"""
    submission_id: str
    items: List[SelfCheckItemResult]  # 사용자 확인 후 최종 결과


class SelfCheckHistoryItem(BaseModel):
    """셀프진단 이력 항목"""
    id: int
    submission_id: str
    project_name: str
    department: str
    manager_name: str
    requires_review: bool
    status: str
    used_model: Optional[str] = None
    created_at: str

    model_config = ConfigDict(from_attributes=True)


class SelfCheckHistoryResponse(BaseModel):
    """셀프진단 이력 목록 응답"""
    total: int
    items: List[SelfCheckHistoryItem]


class SelfCheckDetailResponse(BaseModel):
    """셀프진단 상세 조회 응답"""
    id: int
    submission_id: str
    project_name: str
    department: str
    manager_name: str
    contact: Optional[str] = None
    email: Optional[str] = None
    project_description: Optional[str] = None
    requires_review: bool
    review_reason: Optional[str] = None
    summary: Optional[str] = None  # AI 종합의견
    used_model: Optional[str] = None
    analysis_time_ms: Optional[int] = None
    status: str
    created_at: str
    items: List[SelfCheckItemResult]
    similar_projects: List[SimilarProject] = []  # 중복성 검토 결과

    model_config = ConfigDict(from_attributes=True)


class ExportPdfMode(str, Enum):
    """PDF 내보내기 모드"""
    INDIVIDUAL = "individual"  # 개별 PDF (ZIP)
    MERGED = "merged"  # 병합 PDF (단일)


class SelfCheckExportRequest(BaseModel):
    """셀프진단 내보내기 요청 (Excel/PDF 공통)"""
    submission_ids: List[str]  # submission_id 목록


class SelfCheckExportPdfRequest(BaseModel):
    """셀프진단 PDF 내보내기 요청"""
    submission_ids: List[str]  # submission_id 목록
    mode: ExportPdfMode = ExportPdfMode.INDIVIDUAL  # 내보내기 모드
