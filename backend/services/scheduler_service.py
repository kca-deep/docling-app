"""
스케줄러 서비스
APScheduler를 사용한 주기적 태스크 실행
"""
import logging
from datetime import date, timedelta
from typing import Optional
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

from backend.database import SessionLocal
from backend.services.statistics_service import statistics_service
from backend.services.conversation_service import conversation_service
from backend.services.hybrid_logging_service import hybrid_logging_service
from backend.config.settings import settings

logger = logging.getLogger(__name__)


class SchedulerService:
    """스케줄러 서비스"""

    def __init__(self):
        """서비스 초기화"""
        self.scheduler: Optional[AsyncIOScheduler] = None
        self._started = False

    async def start(self):
        """스케줄러 시작"""
        if self._started:
            logger.warning("Scheduler already started")
            return

        try:
            self.scheduler = AsyncIOScheduler()

            # 일별 통계 집계 (매일 새벽 1시)
            self.scheduler.add_job(
                self._aggregate_daily_stats,
                trigger=CronTrigger(hour=1, minute=0),
                id="daily_stats_aggregation",
                name="Daily Statistics Aggregation",
                replace_existing=True
            )

            # 시간별 통계 집계 (매 시간 정각)
            self.scheduler.add_job(
                self._aggregate_hourly_stats,
                trigger=CronTrigger(minute=0),
                id="hourly_stats_aggregation",
                name="Hourly Statistics Aggregation",
                replace_existing=True
            )

            # 시작 시 누락 통계 보충 (30초 후 시작, 5분마다 반복 - 모든 누락 처리될 때까지)
            from datetime import datetime
            self.scheduler.add_job(
                self._backfill_missing_stats,
                trigger=IntervalTrigger(minutes=5),
                id="stats_backfill",
                name="Missing Statistics Backfill",
                max_instances=1,
                replace_existing=True,
                next_run_time=datetime.now() + timedelta(seconds=30)  # 30초 후 첫 실행
            )

            # 로그 파일 정리 (매일 새벽 2시) - 압축 및 30일 초과 삭제
            self.scheduler.add_job(
                self._cleanup_old_logs,
                trigger=CronTrigger(hour=2, minute=0),
                id="log_cleanup",
                name="Log Files Cleanup (compress + delete)",
                replace_existing=True
            )

            # 대화 히스토리 정리 (매일 새벽 2시 30분) - 압축 및 30일 초과 삭제
            self.scheduler.add_job(
                self._cleanup_old_conversations,
                trigger=CronTrigger(hour=2, minute=30),
                id="conversation_cleanup",
                name="Conversation Files Cleanup",
                replace_existing=True
            )

            self.scheduler.start()
            self._started = True
            logger.info("Scheduler started with jobs: daily_stats, hourly_stats, stats_backfill, log_cleanup, conversation_cleanup")

        except Exception as e:
            logger.error(f"Failed to start scheduler: {e}")
            raise

    async def stop(self):
        """스케줄러 중지"""
        if self.scheduler and self._started:
            self.scheduler.shutdown(wait=False)
            self._started = False
            logger.info("Scheduler stopped")

    async def _aggregate_daily_stats(self):
        """일별 통계 집계 (어제 데이터)"""
        try:
            yesterday = date.today() - timedelta(days=1)
            logger.info(f"Running daily stats aggregation for {yesterday}")

            db = SessionLocal()
            try:
                result = await statistics_service.aggregate_daily_stats(yesterday, db)
                logger.info(f"Daily stats aggregation result: {result.get('status')}")
            finally:
                db.close()

        except Exception as e:
            logger.error(f"Daily stats aggregation failed: {e}")

    async def _aggregate_hourly_stats(self):
        """시간별 통계 집계 (현재 시간대)"""
        try:
            today = date.today()
            logger.info(f"Running hourly stats aggregation for {today}")

            db = SessionLocal()
            try:
                # 오늘 데이터 집계 (실시간 업데이트)
                result = await statistics_service.aggregate_daily_stats(today, db)
                logger.debug(f"Hourly stats aggregation result: {result.get('status')}")
            finally:
                db.close()

        except Exception as e:
            logger.error(f"Hourly stats aggregation failed: {e}")

    async def _backfill_missing_stats(self):
        """누락된 통계 보충 (모든 누락 처리될 때까지 반복)"""
        try:
            logger.info("Starting missing statistics backfill...")

            db = SessionLocal()
            try:
                result = await statistics_service.backfill_missing_stats(db, max_dates=7)

                if result["status"] == "no_missing":
                    # 더 이상 누락된 날짜가 없으면 job 제거
                    if self.scheduler:
                        self.scheduler.remove_job("stats_backfill")
                        logger.info("All missing stats backfilled, job removed")
                elif result["status"] == "success":
                    logger.info(
                        f"Stats backfill progress: {result['processed']} processed, "
                        f"{result['remaining']} remaining"
                    )
                else:
                    logger.warning(f"Stats backfill result: {result}")

            finally:
                db.close()

        except Exception as e:
            logger.error(f"Stats backfill failed: {e}")

    async def _cleanup_old_logs(self):
        """로그 파일 정리 (압축 + 삭제)"""
        try:
            logger.info("Running log files cleanup...")

            # hybrid_logging_service의 정리 메서드 호출
            result = await hybrid_logging_service.cleanup_old_logs(
                retention_days=settings.CONVERSATION_RETENTION_DAYS
            )

            logger.info(f"Log cleanup completed: data={result.get('data', 0)}, overflow={result.get('overflow', 0)} files deleted")

        except Exception as e:
            logger.error(f"Log cleanup failed: {e}")

    async def _cleanup_old_conversations(self):
        """대화 히스토리 파일 정리 (압축 + 삭제)"""
        try:
            logger.info("Running conversation files cleanup...")

            # conversation_service의 정리 메서드 호출
            deleted_count = await conversation_service.cleanup_old_conversations(
                retention_days=settings.CONVERSATION_RETENTION_DAYS
            )

            logger.info(f"Conversation cleanup completed: {deleted_count} files deleted")

        except Exception as e:
            logger.error(f"Conversation cleanup failed: {e}")


# 싱글톤 인스턴스
scheduler_service = SchedulerService()
