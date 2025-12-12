"""
하이브리드 로깅 서비스
SQLite에는 메타데이터만, 실제 로그는 JSONL 파일로 저장
"""

import os
import json
import asyncio
import aiofiles
from datetime import datetime
from typing import Dict, List, Optional, Any
from pathlib import Path
import uuid
import logging

from backend.utils.timezone import now, now_iso, format_date, format_datetime
from backend.config.settings import settings

logger = logging.getLogger(__name__)


class HybridLoggingService:
    """하이브리드 로깅 서비스 (SQLite + JSONL)"""

    def __init__(self):
        """서비스 초기화"""
        self.queue = asyncio.Queue(maxsize=100)
        self.batch_size = settings.LOGGING_BATCH_SIZE
        self.flush_interval = 5  # seconds
        self.log_dir = Path("./logs/data")
        self.conversation_dir = Path("./logs/conversations")

        # 디렉토리 생성
        self._create_directories()

        # 백그라운드 태스크 상태
        self._processor_task = None
        self._running = False

    def _create_directories(self):
        """로그 디렉토리 생성"""
        self.log_dir.mkdir(parents=True, exist_ok=True)
        self.conversation_dir.mkdir(parents=True, exist_ok=True)
        logger.info(f"로그 디렉토리 생성: {self.log_dir}, {self.conversation_dir}")

    async def start(self):
        """백그라운드 처리 시작"""
        if not self._running:
            self._running = True
            self._processor_task = asyncio.create_task(self._process_loop())
            logger.info("HybridLoggingService 시작됨")

    async def stop(self):
        """백그라운드 처리 중지"""
        self._running = False
        if self._processor_task:
            # 태스크 취소
            self._processor_task.cancel()
            try:
                await self._processor_task
            except asyncio.CancelledError:
                # 정상적인 취소 - 무시
                pass
        logger.info("HybridLoggingService 중지됨")

    async def log_async(self, log_data: Dict[str, Any]):
        """비동기 로그 추가"""
        try:
            # 로그 ID 생성
            if "log_id" not in log_data:
                log_data["log_id"] = str(uuid.uuid4())

            # 타임스탬프 추가
            if "created_at" not in log_data:
                log_data["created_at"] = now_iso()

            # 큐에 추가
            await self.queue.put(log_data)

        except asyncio.QueueFull:
            logger.warning("로그 큐가 가득참, 로그 유실 가능성")
            # 긴급 파일 저장 (블로킹)
            await self._emergency_save([log_data])

    async def _process_loop(self):
        """백그라운드 처리 루프"""
        while self._running:
            try:
                await self._process_batch()
                await asyncio.sleep(0.1)  # 짧은 대기
            except asyncio.CancelledError:
                # 정상적인 취소 - 루프 종료
                logger.debug("처리 루프 취소됨")
                break
            except Exception as e:
                logger.error(f"배치 처리 중 오류: {e}")

    async def _process_batch(self):
        """배치 처리 - JSONL 파일에 저장"""
        batch = []

        # 배치 수집
        while len(batch) < self.batch_size:
            try:
                item = await asyncio.wait_for(
                    self.queue.get(),
                    timeout=self.flush_interval
                )
                batch.append(item)
            except asyncio.TimeoutError:
                # 타임아웃 발생 시 현재 배치 처리
                break
            except asyncio.CancelledError:
                # 취소 시 현재까지 수집된 배치 저장 후 예외 재발생
                if batch:
                    await self._save_to_jsonl(batch)
                raise
            except Exception as e:
                logger.error(f"큐에서 아이템 가져오기 실패: {e}")
                break

        # 배치가 있으면 저장
        if batch:
            await self._save_to_jsonl(batch)

    async def _save_to_jsonl(self, batch: List[Dict[str, Any]]):
        """일별 JSONL 파일에 추가"""
        try:
            date_str = format_date()
            file_path = self.log_dir / f"{date_str}.jsonl"

            # 비동기 파일 쓰기
            async with aiofiles.open(file_path, 'a', encoding='utf-8') as f:
                for item in batch:
                    json_line = json.dumps(item, ensure_ascii=False) + '\n'
                    await f.write(json_line)

            logger.debug(f"{len(batch)}개 로그를 {file_path}에 저장")

        except Exception as e:
            logger.error(f"JSONL 저장 실패: {e}")
            # 실패 시 긴급 저장 시도
            await self._emergency_save(batch)

    async def _emergency_save(self, batch: List[Dict[str, Any]]):
        """긴급 저장 (큐 오버플로우 또는 저장 실패 시)"""
        try:
            timestamp = format_datetime(fmt="%Y%m%d_%H%M%S")
            emergency_file = self.log_dir / f"emergency_{timestamp}.jsonl"

            async with aiofiles.open(emergency_file, 'w', encoding='utf-8') as f:
                for item in batch:
                    json_line = json.dumps(item, ensure_ascii=False) + '\n'
                    await f.write(json_line)

            logger.warning(f"긴급 저장 완료: {emergency_file}")

        except Exception as e:
            logger.critical(f"긴급 저장 실패, 데이터 손실: {e}")

    async def log_chat_interaction(
        self,
        session_id: str,
        collection_name: str,
        message_type: str,  # "user" or "assistant"
        message_content: str,
        reasoning_level: Optional[str] = None,
        llm_model: Optional[str] = None,
        llm_params: Optional[Dict] = None,
        retrieval_info: Optional[Dict] = None,
        performance: Optional[Dict] = None,
        error_info: Optional[Dict] = None,
        request_id: Optional[str] = None,
        trace_id: Optional[str] = None,
        client_info: Optional[Dict] = None
    ):
        """채팅 상호작용 로그 기록"""
        log_data = {
            "log_id": str(uuid.uuid4()),
            "request_id": request_id,
            "trace_id": trace_id,
            "session_id": session_id,
            "collection_name": collection_name,
            "message_type": message_type,
            "message_content": message_content,
            "reasoning_level": reasoning_level,
            "llm_model": llm_model,
            "llm_params": llm_params or {},
            "retrieval_info": retrieval_info or {},
            "performance": performance or {},
            "error_info": error_info,
            "client_info": client_info or {},
            "created_at": now_iso()
        }

        await self.log_async(log_data)

    async def flush(self):
        """큐의 모든 아이템 즉시 처리"""
        remaining = []

        # 큐에서 모든 아이템 수집
        while not self.queue.empty():
            try:
                item = self.queue.get_nowait()
                remaining.append(item)
            except asyncio.QueueEmpty:
                break

        # 저장
        if remaining:
            await self._save_to_jsonl(remaining)
            logger.info(f"플러시 완료: {len(remaining)}개 아이템 저장")

    def get_log_files(self, start_date: Optional[datetime] = None, end_date: Optional[datetime] = None) -> List[Path]:
        """날짜 범위의 로그 파일 목록 반환"""
        files = []
        for file_path in sorted(self.log_dir.glob("*.jsonl")):
            # emergency 파일 제외
            if file_path.name.startswith("emergency_"):
                continue

            # 날짜 파싱
            try:
                file_date_str = file_path.stem  # YYYY-MM-DD
                file_date = datetime.strptime(file_date_str, "%Y-%m-%d").date()

                # 날짜 필터링
                if start_date and file_date < start_date.date():
                    continue
                if end_date and file_date > end_date.date():
                    continue

                files.append(file_path)

            except ValueError:
                logger.warning(f"파일 이름 파싱 실패: {file_path}")
                continue

        return files

    async def read_logs(
        self,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        collection_name: Optional[str] = None,
        session_id: Optional[str] = None,
        limit: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """로그 읽기"""
        logs = []
        files = self.get_log_files(start_date, end_date)

        for file_path in files:
            try:
                async with aiofiles.open(file_path, 'r', encoding='utf-8') as f:
                    async for line in f:
                        if not line.strip():
                            continue

                        try:
                            log = json.loads(line)

                            # 필터링
                            if collection_name and log.get("collection_name") != collection_name:
                                continue
                            if session_id and log.get("session_id") != session_id:
                                continue

                            logs.append(log)

                            # 제한 체크
                            if limit and len(logs) >= limit:
                                return logs

                        except json.JSONDecodeError as e:
                            logger.error(f"JSON 파싱 오류: {e}, 라인: {line}")

            except Exception as e:
                logger.error(f"파일 읽기 오류 {file_path}: {e}")

        return logs


# 싱글톤 인스턴스
hybrid_logging_service = HybridLoggingService()