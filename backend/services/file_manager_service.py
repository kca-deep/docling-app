"""
파일 관리 서비스
프롬프트 파일 저장, 백업, 롤백 기능
"""
import logging
import json
import shutil
from pathlib import Path
from typing import Dict, Any, List, Optional
from backend.utils.timezone import format_datetime

logger = logging.getLogger(__name__)

# 디렉토리 경로
PROMPTS_DIR = Path(__file__).parent.parent / "prompts"
BACKUPS_DIR = PROMPTS_DIR / "backups"
CONFIG_DIR = Path(__file__).parent.parent / "config"


class FileManagerService:
    """파일 관리 서비스"""

    def __init__(self):
        """서비스 초기화"""
        # 필요한 디렉토리 생성
        PROMPTS_DIR.mkdir(parents=True, exist_ok=True)
        BACKUPS_DIR.mkdir(parents=True, exist_ok=True)
        CONFIG_DIR.mkdir(parents=True, exist_ok=True)

    def create_backup(self, backup_name: Optional[str] = None) -> str:
        """
        현재 프롬프트 관련 파일들 백업

        Args:
            backup_name: 백업 폴더명 (None이면 타임스탬프 사용)

        Returns:
            백업 경로
        """
        if not backup_name:
            backup_name = format_datetime(fmt="%Y-%m-%d_%H-%M-%S")

        backup_path = BACKUPS_DIR / backup_name
        backup_path.mkdir(parents=True, exist_ok=True)

        # 백업할 파일들
        files_to_backup = [
            PROMPTS_DIR / "mapping.json",
            CONFIG_DIR / "suggested_prompts.json"
        ]

        # 기존 프롬프트 파일들 (.md)
        for md_file in PROMPTS_DIR.glob("*.md"):
            files_to_backup.append(md_file)

        # 파일 복사
        backed_up = []
        for file_path in files_to_backup:
            if file_path.exists():
                dest = backup_path / file_path.name
                shutil.copy2(file_path, dest)
                backed_up.append(file_path.name)
                logger.info(f"백업 완료: {file_path.name} -> {dest}")

        return str(backup_path)

    def restore_backup(self, backup_name: str) -> Dict[str, Any]:
        """
        백업에서 복원

        Args:
            backup_name: 백업 폴더명

        Returns:
            복원 결과
        """
        backup_path = BACKUPS_DIR / backup_name
        if not backup_path.exists():
            raise FileNotFoundError(f"백업을 찾을 수 없습니다: {backup_name}")

        restored = []
        errors = []

        # mapping.json 복원
        mapping_backup = backup_path / "mapping.json"
        if mapping_backup.exists():
            try:
                shutil.copy2(mapping_backup, PROMPTS_DIR / "mapping.json")
                restored.append("mapping.json")
            except Exception as e:
                errors.append(f"mapping.json 복원 실패: {e}")

        # suggested_prompts.json 복원
        suggested_backup = backup_path / "suggested_prompts.json"
        if suggested_backup.exists():
            try:
                shutil.copy2(suggested_backup, CONFIG_DIR / "suggested_prompts.json")
                restored.append("suggested_prompts.json")
            except Exception as e:
                errors.append(f"suggested_prompts.json 복원 실패: {e}")

        # 프롬프트 파일 복원
        for md_file in backup_path.glob("*.md"):
            try:
                shutil.copy2(md_file, PROMPTS_DIR / md_file.name)
                restored.append(md_file.name)
            except Exception as e:
                errors.append(f"{md_file.name} 복원 실패: {e}")

        return {
            "success": len(errors) == 0,
            "restored": restored,
            "errors": errors
        }

    def list_backups(self) -> List[Dict[str, Any]]:
        """
        백업 목록 조회

        Returns:
            백업 정보 리스트
        """
        backups = []
        for backup_dir in sorted(BACKUPS_DIR.iterdir(), reverse=True):
            if backup_dir.is_dir():
                files = list(backup_dir.glob("*"))
                backups.append({
                    "name": backup_dir.name,
                    "path": str(backup_dir),
                    "files_count": len(files),
                    "created_at": datetime.fromtimestamp(backup_dir.stat().st_mtime).isoformat()
                })
        return backups

    def save_prompt_file(
        self,
        filename: str,
        content: str,
        create_backup: bool = True
    ) -> Dict[str, Any]:
        """
        프롬프트 파일 저장

        Args:
            filename: 파일명 (.md 확장자 자동 추가)
            content: 프롬프트 내용
            create_backup: 백업 생성 여부

        Returns:
            저장 결과
        """
        # 파일명 정리
        if not filename.endswith(".md"):
            filename = f"{filename}.md"

        # 위험한 문자 제거
        filename = self._sanitize_filename(filename)
        file_path = PROMPTS_DIR / filename

        # 백업 생성 (기존 파일이 있는 경우)
        backup_path = None
        if create_backup and file_path.exists():
            backup_path = self.create_backup()

        # 파일 저장
        try:
            file_path.write_text(content, encoding="utf-8")
            logger.info(f"프롬프트 파일 저장: {file_path}")

            return {
                "success": True,
                "file_path": str(file_path),
                "filename": filename,
                "backup_path": backup_path
            }
        except Exception as e:
            logger.error(f"프롬프트 파일 저장 실패: {e}")
            raise

    def update_mapping(
        self,
        collection_name: str,
        prompt_filename: str,
        description: Optional[str] = None,
        recommended_params: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        mapping.json 업데이트

        Args:
            collection_name: 컬렉션 이름
            prompt_filename: 프롬프트 파일명
            description: 설명
            recommended_params: 권장 파라미터

        Returns:
            업데이트 결과
        """
        mapping_path = PROMPTS_DIR / "mapping.json"

        # 기존 매핑 로드
        mapping = self._load_mapping()

        # 컬렉션 설정 업데이트
        if "collection_prompts" not in mapping:
            mapping["collection_prompts"] = {}

        # .md 확장자 제거 (저장 시)
        if prompt_filename.endswith(".md"):
            prompt_filename_clean = prompt_filename
        else:
            prompt_filename_clean = f"{prompt_filename}.md"

        collection_config = {
            "prompt_file": prompt_filename_clean,
            "description": description or f"{collection_name} 컬렉션 프롬프트",
            "recommended_params": recommended_params or {
                "top_k": 10,
                "temperature": 0.3,
                "reasoning_level": "medium"
            }
        }

        mapping["collection_prompts"][collection_name] = collection_config

        # 저장
        try:
            mapping_path.write_text(
                json.dumps(mapping, ensure_ascii=False, indent=2),
                encoding="utf-8"
            )
            logger.info(f"mapping.json 업데이트: {collection_name}")

            return {
                "success": True,
                "collection_name": collection_name,
                "config": collection_config
            }
        except Exception as e:
            logger.error(f"mapping.json 업데이트 실패: {e}")
            raise

    def update_suggested_prompts(
        self,
        collection_name: str,
        questions: List[str]
    ) -> Dict[str, Any]:
        """
        suggested_prompts.json 업데이트

        Args:
            collection_name: 컬렉션 이름
            questions: 추천 질문 리스트

        Returns:
            업데이트 결과
        """
        prompts_path = CONFIG_DIR / "suggested_prompts.json"

        # 기존 데이터 로드
        suggested = {}
        if prompts_path.exists():
            try:
                suggested = json.loads(prompts_path.read_text(encoding="utf-8"))
            except json.JSONDecodeError:
                suggested = {}

        # 컬렉션 질문 업데이트
        suggested[collection_name] = questions

        # 저장
        try:
            prompts_path.write_text(
                json.dumps(suggested, ensure_ascii=False, indent=2),
                encoding="utf-8"
            )
            logger.info(f"suggested_prompts.json 업데이트: {collection_name}")

            return {
                "success": True,
                "collection_name": collection_name,
                "questions_count": len(questions)
            }
        except Exception as e:
            logger.error(f"suggested_prompts.json 업데이트 실패: {e}")
            raise

    def save_all(
        self,
        collection_name: str,
        prompt_filename: str,
        prompt_content: str,
        questions: List[str],
        description: Optional[str] = None,
        recommended_params: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        프롬프트, 매핑, 추천 질문 모두 저장 (트랜잭션)

        Args:
            collection_name: 컬렉션 이름
            prompt_filename: 프롬프트 파일명
            prompt_content: 프롬프트 내용
            questions: 추천 질문
            description: 설명
            recommended_params: 권장 파라미터

        Returns:
            저장 결과
        """
        # 1. 백업 생성
        backup_path = self.create_backup()

        try:
            # 2. 프롬프트 파일 저장
            prompt_result = self.save_prompt_file(
                filename=prompt_filename,
                content=prompt_content,
                create_backup=False  # 이미 백업함
            )

            # 3. mapping.json 업데이트
            mapping_result = self.update_mapping(
                collection_name=collection_name,
                prompt_filename=prompt_filename,
                description=description,
                recommended_params=recommended_params
            )

            # 4. suggested_prompts.json 업데이트
            questions_result = self.update_suggested_prompts(
                collection_name=collection_name,
                questions=questions
            )

            return {
                "success": True,
                "backup_path": backup_path,
                "prompt_file": prompt_result["filename"],
                "files_updated": [
                    prompt_result["filename"],
                    "mapping.json",
                    "suggested_prompts.json"
                ]
            }

        except Exception as e:
            # 롤백
            logger.error(f"저장 실패, 롤백 시도: {e}")
            try:
                backup_name = Path(backup_path).name
                self.restore_backup(backup_name)
                logger.info("롤백 완료")
            except Exception as rollback_error:
                logger.error(f"롤백 실패: {rollback_error}")

            raise

    def get_templates(self) -> List[Dict[str, Any]]:
        """
        사용 가능한 템플릿 목록 조회

        Returns:
            템플릿 정보 리스트
        """
        templates = []
        mapping = self._load_mapping()

        # 기본 템플릿 (하드코딩)
        default_templates = {
            "regulation": {
                "name": "규정/지침 문서",
                "description": "인사규정, 복무지침, 내규 등 규정 문서에 최적화",
                "file": "regulation.md"
            },
            "budget": {
                "name": "예산/재무 문서",
                "description": "예산안, 결산서, 재무제표 등 재무 문서에 최적화",
                "file": "budget.md"
            },
            "fund": {
                "name": "기금관리 문서",
                "description": "기금사업, 협약, 정산 관련 문서에 최적화",
                "file": "fund.md"
            },
            "default": {
                "name": "일반 문서",
                "description": "범용 RAG 프롬프트 (기본값)",
                "file": "default.md"
            }
        }

        for template_id, info in default_templates.items():
            template_path = PROMPTS_DIR / info["file"]
            templates.append({
                "id": template_id,
                "name": info["name"],
                "description": info["description"],
                "file": info["file"],
                "exists": template_path.exists()
            })

        return templates

    def _load_mapping(self) -> Dict[str, Any]:
        """mapping.json 로드"""
        mapping_path = PROMPTS_DIR / "mapping.json"
        if mapping_path.exists():
            try:
                return json.loads(mapping_path.read_text(encoding="utf-8"))
            except json.JSONDecodeError:
                pass
        return {
            "version": "1.0",
            "collection_prompts": {},
            "default_prompt": "default.md",
            "fallback_behavior": "use_default"
        }

    def _sanitize_filename(self, filename: str) -> str:
        """파일명 정리 (위험한 문자 제거)"""
        # 경로 구분자 및 위험 문자 제거
        dangerous_chars = ['/', '\\', '..', '<', '>', ':', '"', '|', '?', '*']
        for char in dangerous_chars:
            filename = filename.replace(char, '_')
        return filename


# 싱글톤 인스턴스
file_manager_service = FileManagerService()
