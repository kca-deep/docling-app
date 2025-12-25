"""
셀프진단 서비스 (하위 호환성 유지용)

이 파일은 기존 import 경로와의 호환성을 위해 유지됩니다.
실제 구현은 backend/services/selfcheck/ 패키지로 이동되었습니다.

사용법:
    from backend.services.selfcheck_service import selfcheck_service
    또는
    from backend.services.selfcheck import selfcheck_service
"""

# 새 패키지에서 모든 것을 re-export
from backend.services.selfcheck import (
    SelfCheckService,
    selfcheck_service,
    LLMAnalyzer,
    SimilarityService,
    SelfCheckRepository,
    SelfCheckJsonParser,
    CHECKLIST_ITEMS,
    LLM_PRIORITY_ORDER,
)

__all__ = [
    "SelfCheckService",
    "selfcheck_service",
    "LLMAnalyzer",
    "SimilarityService",
    "SelfCheckRepository",
    "SelfCheckJsonParser",
    "CHECKLIST_ITEMS",
    "LLM_PRIORITY_ORDER",
]
