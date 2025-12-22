"""
하이브리드 로깅 서비스
SQLite에는 메타데이터만, 실제 로그는 JSONL 파일로 저장
세션 업데이트도 큐 기반으로 처리
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


# 순환 참조 방지를 위해 지연 import
def _get_session_local():
    """DB 세션 팩토리 지연 로드"""
    from backend.database import SessionLocal
    return SessionLocal


def _get_chat_session_model():
    """ChatSession 모델 지연 로드"""
    from backend.models.chat_session import ChatSession
    return ChatSession


class HybridLoggingService:
    """하이브리드 로깅 서비스 (SQLite + JSONL)"""

    # 큐 설정
    DEFAULT_QUEUE_SIZE = 1000  # 기본 큐 크기 (100 -> 1000)
    SESSION_QUEUE_SIZE = 500   # 세션 업데이트 큐 크기
    BACKPRESSURE_THRESHOLD = 0.8  # 백프레셔 임계값 (80%)
    MAX_RETRIES = 3  # 최대 재시도 횟수
    SESSION_BATCH_SIZE = 50  # 세션 업데이트 배치 크기

    def __init__(self):
        """서비스 초기화"""
        self.queue = asyncio.Queue(maxsize=self.DEFAULT_QUEUE_SIZE)
        self.session_queue = asyncio.Queue(maxsize=self.SESSION_QUEUE_SIZE)  # 세션 업데이트 큐
        self.batch_size = settings.LOGGING_BATCH_SIZE
        self.flush_interval = 5  # seconds
        self.log_dir = Path("./logs/data")
        self.conversation_dir = Path("./logs/conversations")
        self.overflow_dir = Path("./logs/overflow")  # 오버플로우 디렉토리

        # 디렉토리 생성
        self._create_directories()

        # 백그라운드 태스크 상태
        self._processor_task = None
        self._session_processor_task = None  # 세션 업데이트 처리 태스크
        self._running = False

        # 통계
        self._dropped_count = 0
        self._overflow_count = 0
        self._session_update_count = 0
        self._session_update_errors = 0

    def _create_directories(self):
        """로그 디렉토리 생성"""
        self.log_dir.mkdir(parents=True, exist_ok=True)
        self.conversation_dir.mkdir(parents=True, exist_ok=True)
        self.overflow_dir.mkdir(parents=True, exist_ok=True)
        logger.info(f"로그 디렉토리 생성: {self.log_dir}, {self.conversation_dir}, {self.overflow_dir}")

    async def start(self):
        """백그라운드 처리 시작"""
        if not self._running:
            self._running = True
            self._processor_task = asyncio.create_task(self._process_loop())
            self._session_processor_task = asyncio.create_task(self._process_session_loop())
            logger.info("HybridLoggingService 시작됨 (로그 + 세션 업데이트 큐)")

    async def stop(self):
        """백그라운드 처리 중지"""
        self._running = False

        # 로그 처리 태스크 중지
        if self._processor_task:
            self._processor_task.cancel()
            try:
                await self._processor_task
            except asyncio.CancelledError:
                pass

        # 세션 업데이트 처리 태스크 중지
        if self._session_processor_task:
            self._session_processor_task.cancel()
            try:
                await self._session_processor_task
            except asyncio.CancelledError:
                pass

        logger.info(f"HybridLoggingService 중지됨 (세션 업데이트: {self._session_update_count}건, 오류: {self._session_update_errors}건)")

    def _get_queue_usage(self) -> float:
        """큐 사용률 계산"""
        return self.queue.qsize() / self.DEFAULT_QUEUE_SIZE

    async def log_async(self, log_data: Dict[str, Any]):
        """비동기 로그 추가 (백프레셔 지원)"""
        try:
            # 로그 ID 생성
            if "log_id" not in log_data:
                log_data["log_id"] = str(uuid.uuid4())

            # 타임스탬프 추가
            if "created_at" not in log_data:
                log_data["created_at"] = now_iso()

            # 백프레셔 체크
            queue_usage = self._get_queue_usage()
            if queue_usage >= self.BACKPRESSURE_THRESHOLD:
                logger.warning(f"로그 큐 사용률 높음: {queue_usage:.1%} - 백프레셔 적용")

            # 큐에 추가 시도 (논블로킹)
            try:
                self.queue.put_nowait(log_data)
            except asyncio.QueueFull:
                # 큐가 가득 찬 경우 오버플로우 파일에 저장
                self._overflow_count += 1
                logger.warning(f"로그 큐 오버플로우 (total: {self._overflow_count})")
                await self._save_to_overflow([log_data])

        except Exception as e:
            self._dropped_count += 1
            logger.error(f"로그 추가 실패 (dropped: {self._dropped_count}): {e}")

    async def _save_to_overflow(self, logs: List[Dict[str, Any]]):
        """오버플로우 로그를 별도 파일에 저장"""
        try:
            today = format_date(now())
            file_path = self.overflow_dir / f"overflow_{today}.jsonl"

            async with aiofiles.open(file_path, 'a', encoding='utf-8') as f:
                for log in logs:
                    await f.write(json.dumps(log, ensure_ascii=False) + "\n")

            logger.debug(f"오버플로우 로그 저장: {len(logs)}건")
        except Exception as e:
            logger.error(f"오버플로우 저장 실패: {e}")

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

    # ========== 세션 업데이트 큐 관련 메서드 ==========

    async def queue_session_update(
        self,
        session_id: str,
        collection_name: str,
        model: str,
        reasoning_level: str,
        performance_metrics: Dict[str, Any],
        retrieval_info: Optional[Dict] = None,
        error_info: Optional[Dict] = None
    ):
        """세션 업데이트를 큐에 추가 (논블로킹)"""
        try:
            update_data = {
                "session_id": session_id,
                "collection_name": collection_name,
                "model": model,
                "reasoning_level": reasoning_level,
                "performance_metrics": performance_metrics,
                "retrieval_info": retrieval_info or {},
                "error_info": error_info,
                "queued_at": now_iso()
            }

            # 큐에 추가 시도 (논블로킹)
            try:
                self.session_queue.put_nowait(update_data)
            except asyncio.QueueFull:
                logger.warning(f"세션 업데이트 큐 가득 참 - session_id: {session_id}")
                # 오버플로우 파일에 저장
                await self._save_to_overflow([{"type": "session_update", **update_data}])

        except Exception as e:
            logger.error(f"세션 업데이트 큐 추가 실패: {e}")

    async def _process_session_loop(self):
        """세션 업데이트 백그라운드 처리 루프"""
        while self._running:
            try:
                await self._process_session_batch()
                await asyncio.sleep(0.5)  # 0.5초 대기
            except asyncio.CancelledError:
                logger.debug("세션 처리 루프 취소됨")
                break
            except Exception as e:
                logger.error(f"세션 배치 처리 중 오류: {e}")

    async def _process_session_batch(self):
        """세션 업데이트 배치 처리 - DB에 저장"""
        batch = []

        # 배치 수집
        while len(batch) < self.SESSION_BATCH_SIZE:
            try:
                item = await asyncio.wait_for(
                    self.session_queue.get(),
                    timeout=2.0  # 2초 타임아웃
                )
                batch.append(item)
            except asyncio.TimeoutError:
                break
            except asyncio.CancelledError:
                if batch:
                    await self._save_session_updates(batch)
                raise
            except Exception as e:
                logger.error(f"세션 큐에서 아이템 가져오기 실패: {e}")
                break

        # 배치가 있으면 저장
        if batch:
            await self._save_session_updates(batch)

    async def _save_session_updates(self, batch: List[Dict[str, Any]]):
        """세션 업데이트 배치를 DB에 저장"""
        SessionLocal = _get_session_local()
        ChatSession = _get_chat_session_model()

        db = SessionLocal()
        try:
            for update_data in batch:
                try:
                    session_id = update_data["session_id"]
                    performance_metrics = update_data.get("performance_metrics", {})
                    retrieval_info = update_data.get("retrieval_info", {})
                    error_info = update_data.get("error_info")

                    # 기존 세션 조회
                    session = db.query(ChatSession).filter(
                        ChatSession.session_id == session_id
                    ).first()

                    if not session:
                        # 새 세션 생성
                        session = ChatSession(
                            session_id=session_id,
                            collection_name=update_data["collection_name"],
                            llm_model=update_data["model"],
                            reasoning_level=update_data["reasoning_level"]
                        )
                        db.add(session)

                    # 카운트 필드 초기화 (None인 경우)
                    if session.message_count is None:
                        session.message_count = 0
                    if session.user_message_count is None:
                        session.user_message_count = 0
                    if session.assistant_message_count is None:
                        session.assistant_message_count = 0

                    # 메시지 카운트 업데이트
                    session.message_count += 2  # 사용자 + 어시스턴트
                    session.user_message_count += 1
                    session.assistant_message_count += 1

                    # 응답 시간 업데이트
                    if performance_metrics.get("response_time_ms"):
                        if session.total_response_time_ms is None:
                            session.total_response_time_ms = 0
                        session.total_response_time_ms += performance_metrics["response_time_ms"]
                        session.avg_response_time_ms = session.total_response_time_ms // session.assistant_message_count

                    # 에러 플래그 업데이트
                    if error_info:
                        session.has_error = 1

                    # 최소 검색 스코어 업데이트
                    if retrieval_info.get("top_scores"):
                        min_score = min(retrieval_info["top_scores"])
                        if session.min_retrieval_score is None or float(session.min_retrieval_score) > min_score:
                            session.min_retrieval_score = str(min_score)

                    self._session_update_count += 1

                except Exception as e:
                    logger.error(f"개별 세션 업데이트 실패 (session_id: {update_data.get('session_id')}): {e}")
                    self._session_update_errors += 1

            # 배치 커밋
            db.commit()
            logger.debug(f"세션 업데이트 배치 저장 완료: {len(batch)}건")

        except Exception as e:
            logger.error(f"세션 업데이트 배치 커밋 실패: {e}")
            db.rollback()
            self._session_update_errors += len(batch)
        finally:
            db.close()

    async def flush_sessions(self):
        """세션 큐의 모든 아이템 즉시 처리"""
        remaining = []

        while not self.session_queue.empty():
            try:
                item = self.session_queue.get_nowait()
                remaining.append(item)
            except asyncio.QueueEmpty:
                break

        if remaining:
            await self._save_session_updates(remaining)
            logger.info(f"세션 플러시 완료: {len(remaining)}개 아이템 저장")

    def get_stats(self) -> Dict[str, Any]:
        """서비스 통계 반환"""
        return {
            "log_queue_size": self.queue.qsize(),
            "log_queue_capacity": self.DEFAULT_QUEUE_SIZE,
            "session_queue_size": self.session_queue.qsize(),
            "session_queue_capacity": self.SESSION_QUEUE_SIZE,
            "dropped_count": self._dropped_count,
            "overflow_count": self._overflow_count,
            "session_update_count": self._session_update_count,
            "session_update_errors": self._session_update_errors,
            "running": self._running
        }


# 싱글톤 인스턴스
hybrid_logging_service = HybridLoggingService()