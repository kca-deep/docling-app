"""
Function Calling Export 설정 로더
export_config.yaml 파일에서 내보내기 의도 감지 설정을 로드합니다.
"""

import logging
from pathlib import Path
from typing import List

import yaml

logger = logging.getLogger("uvicorn")


class ExportConfig:
    """
    내보내기 의도 감지 설정 관리 클래스
    YAML 설정 파일에서 힌트 키워드와 임계값을 로드합니다.
    """

    def __init__(self):
        self._config: dict = {}
        self._all_hints: List[str] = []
        self._load_config()

    def _load_config(self) -> None:
        """설정 파일 로드"""
        config_path = Path(__file__).parent / "export_config.yaml"

        try:
            if config_path.exists():
                with open(config_path, "r", encoding="utf-8") as f:
                    self._config = yaml.safe_load(f) or {}
                self._build_hints_cache()
                logger.info(f"[ExportConfig] Loaded config from {config_path}")
                logger.info(f"[ExportConfig] Total hints: {len(self._all_hints)}, min_match: {self.get_min_match_count()}")
            else:
                logger.warning(f"[ExportConfig] Config file not found: {config_path}, using defaults")
                self._use_defaults()
        except Exception as e:
            logger.error(f"[ExportConfig] Failed to load config: {e}, using defaults")
            self._use_defaults()

    def _use_defaults(self) -> None:
        """기본값 설정"""
        self._config = {
            "format_hints": [
                "엑셀", "excel", "xlsx", "워드", "word", "docx",
                "pdf", "마크다운", "markdown", "md", "txt", "텍스트"
            ],
            "action_hints": [
                "저장", "다운로드", "내보내", "export", "변환", "만들어"
            ],
            "file_hints": ["파일", "file"],
            "min_match_count": 2
        }
        self._build_hints_cache()

    def _build_hints_cache(self) -> None:
        """모든 힌트를 하나의 리스트로 캐시"""
        self._all_hints = []

        # 각 카테고리의 힌트 수집
        for key in ["format_hints", "action_hints", "file_hints"]:
            hints = self._config.get(key, [])
            if isinstance(hints, list):
                self._all_hints.extend(hints)

        # 중복 제거 (순서 유지)
        seen = set()
        unique_hints = []
        for hint in self._all_hints:
            hint_lower = hint.lower()
            if hint_lower not in seen:
                seen.add(hint_lower)
                unique_hints.append(hint)
        self._all_hints = unique_hints

    def get_format_hints(self) -> List[str]:
        """형식 관련 힌트 반환"""
        return self._config.get("format_hints", [])

    def get_action_hints(self) -> List[str]:
        """동작 관련 힌트 반환"""
        return self._config.get("action_hints", [])

    def get_file_hints(self) -> List[str]:
        """파일 관련 힌트 반환"""
        return self._config.get("file_hints", [])

    def get_all_hints(self) -> List[str]:
        """모든 힌트를 하나의 리스트로 반환 (캐시된 값)"""
        return self._all_hints

    def get_min_match_count(self) -> int:
        """최소 매칭 힌트 개수 반환"""
        return self._config.get("min_match_count", 2)

    def reload(self) -> None:
        """설정 파일 다시 로드 (Hot reload용)"""
        logger.info("[ExportConfig] Reloading configuration...")
        self._load_config()


# 싱글톤 인스턴스
export_config = ExportConfig()
