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

            # 시작 시 어제 통계 집계 (누락된 경우 대비)
            self.scheduler.add_job(
                self._aggregate_yesterday_stats,
                trigger=IntervalTrigger(seconds=30),
                id="startup_stats_aggregation",
                name="Startup Statistics Aggregation",
                max_instances=1,
                replace_existing=True
            )

            self.scheduler.start()
            self._started = True
            logger.info("Scheduler started with jobs: daily_stats, hourly_stats")

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

    async def _aggregate_yesterday_stats(self):
        """시작 시 어제 통계 집계 (1회성)"""
        try:
            yesterday = date.today() - timedelta(days=1)
            logger.info(f"Startup: Aggregating yesterday's stats ({yesterday})")

            db = SessionLocal()
            try:
                result = await statistics_service.aggregate_daily_stats(yesterday, db)
                logger.info(f"Startup stats aggregation result: {result.get('status')}")
            finally:
                db.close()

            # 작업 완료 후 이 job 제거
            if self.scheduler:
                self.scheduler.remove_job("startup_stats_aggregation")
                logger.info("Startup stats job completed and removed")

        except Exception as e:
            logger.error(f"Startup stats aggregation failed: {e}")


# 싱글톤 인스턴스
scheduler_service = SchedulerService()
