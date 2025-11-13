"""
문서 변환 진행률 추적 서비스 (메모리 기반)
"""
import time
import threading
from typing import Dict, Optional
from datetime import datetime, timedelta


class ProgressInfo:
    """진행률 정보"""
    def __init__(
        self,
        task_id: str,
        total_pages: int,
        filename: str
    ):
        self.task_id = task_id
        self.total_pages = total_pages
        self.current_page = 0
        self.filename = filename
        self.status = "processing"
        self.created_at = datetime.now()
        self.updated_at = datetime.now()
        self.error_message: Optional[str] = None
        self.start_time = time.time()
        self.md_content: Optional[str] = None
        self.processing_time: Optional[float] = None

    def update_progress(self, current_page: int) -> None:
        """진행률 업데이트"""
        self.current_page = current_page
        self.updated_at = datetime.now()

    def mark_completed(self, md_content: Optional[str] = None, processing_time: Optional[float] = None) -> None:
        """완료 상태로 변경"""
        self.status = "completed"
        self.current_page = self.total_pages
        self.updated_at = datetime.now()
        self.md_content = md_content
        self.processing_time = processing_time

    def mark_failed(self, error_message: str) -> None:
        """실패 상태로 변경"""
        self.status = "failed"
        self.error_message = error_message
        self.updated_at = datetime.now()

    @property
    def progress_percentage(self) -> float:
        """진행률 퍼센트 계산"""
        if self.total_pages == 0:
            return 0.0
        return round((self.current_page / self.total_pages) * 100, 1)

    @property
    def elapsed_time(self) -> float:
        """경과 시간 (초)"""
        return time.time() - self.start_time

    @property
    def estimated_remaining_time(self) -> Optional[float]:
        """예상 남은 시간 (초)"""
        if self.current_page == 0:
            return None

        avg_time_per_page = self.elapsed_time / self.current_page
        remaining_pages = self.total_pages - self.current_page
        return round(avg_time_per_page * remaining_pages, 1)

    def to_dict(self) -> dict:
        """딕셔너리로 변환"""
        return {
            "task_id": self.task_id,
            "filename": self.filename,
            "status": self.status,
            "current_page": self.current_page,
            "total_pages": self.total_pages,
            "progress_percentage": self.progress_percentage,
            "elapsed_time": round(self.elapsed_time, 1),
            "estimated_remaining_time": self.estimated_remaining_time,
            "error_message": self.error_message,
            "updated_at": self.updated_at.isoformat(),
            "md_content": self.md_content,
            "processing_time": self.processing_time
        }


class ProgressTracker:
    """Thread-safe 진행률 추적 관리자"""

    def __init__(self, cleanup_interval_minutes: int = 30):
        self._progress_store: Dict[str, ProgressInfo] = {}
        self._lock = threading.Lock()
        self._cleanup_interval = timedelta(minutes=cleanup_interval_minutes)

    def create_progress(
        self,
        task_id: str,
        total_pages: int,
        filename: str
    ) -> ProgressInfo:
        """새로운 진행률 추적 시작"""
        with self._lock:
            progress = ProgressInfo(task_id, total_pages, filename)
            self._progress_store[task_id] = progress
            return progress

    def update_progress(self, task_id: str, current_page: int) -> None:
        """진행률 업데이트"""
        with self._lock:
            if task_id in self._progress_store:
                self._progress_store[task_id].update_progress(current_page)

    def mark_completed(self, task_id: str, md_content: Optional[str] = None, processing_time: Optional[float] = None) -> None:
        """작업 완료 처리"""
        with self._lock:
            if task_id in self._progress_store:
                self._progress_store[task_id].mark_completed(md_content, processing_time)

    def mark_failed(self, task_id: str, error_message: str) -> None:
        """작업 실패 처리"""
        with self._lock:
            if task_id in self._progress_store:
                self._progress_store[task_id].mark_failed(error_message)

    def get_progress(self, task_id: str) -> Optional[dict]:
        """진행률 조회"""
        with self._lock:
            if task_id in self._progress_store:
                return self._progress_store[task_id].to_dict()
            return None

    def remove_progress(self, task_id: str) -> bool:
        """진행률 정보 삭제"""
        with self._lock:
            if task_id in self._progress_store:
                del self._progress_store[task_id]
                return True
            return False

    def cleanup_old_progress(self) -> int:
        """오래된 진행률 정보 정리 (30분 이상 지난 완료/실패 작업)"""
        now = datetime.now()
        removed_count = 0

        with self._lock:
            tasks_to_remove = []
            for task_id, progress in self._progress_store.items():
                # 완료/실패 상태이고 cleanup_interval 이상 지난 작업 삭제
                if progress.status in ["completed", "failed"]:
                    time_diff = now - progress.updated_at
                    if time_diff > self._cleanup_interval:
                        tasks_to_remove.append(task_id)

            for task_id in tasks_to_remove:
                del self._progress_store[task_id]
                removed_count += 1

        return removed_count

    def get_all_progress(self) -> list:
        """모든 진행률 정보 조회 (디버깅용)"""
        with self._lock:
            return [p.to_dict() for p in self._progress_store.values()]


# 싱글톤 인스턴스
progress_tracker = ProgressTracker()
