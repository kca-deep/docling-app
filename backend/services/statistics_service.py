"""
통계 집계 서비스
JSONL 파일 기반 pandas 분석 및 SQLite 통계 저장
"""

import os
import json
import pandas as pd
import numpy as np
from datetime import datetime, timedelta, date
from typing import Dict, List, Optional, Any, Tuple
from pathlib import Path
from zoneinfo import ZoneInfo
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, desc
import logging
import uuid
from collections import Counter

from backend.models.chat_statistics import ChatStatistics
from backend.models.chat_session import ChatSession
from backend.utils.timezone import now_naive

logger = logging.getLogger(__name__)


class StatisticsService:
    """통계 집계 서비스"""

    def __init__(self):
        """서비스 초기화"""
        self.log_dir = Path("./logs/data")
        self.conversation_dir = Path("./logs/conversations")

    async def aggregate_daily_stats(
        self,
        target_date: date,
        db: Session
    ) -> Dict[str, Any]:
        """일별 통계 집계 - JSONL 파일 기반"""
        try:
            # JSONL 파일 읽기
            file_path = self.log_dir / f"{target_date.isoformat()}.jsonl"

            if not file_path.exists():
                logger.warning(f"로그 파일 없음: {file_path}")
                return {"date": target_date.isoformat(), "status": "no_data"}

            # pandas로 로그 읽기
            df = self._read_jsonl_to_dataframe(file_path)

            if df.empty:
                logger.warning(f"빈 로그 파일: {file_path}")
                return {"date": target_date.isoformat(), "status": "empty"}

            # 컬렉션별 통계 계산
            collections = df['collection_name'].unique() if 'collection_name' in df.columns else []

            all_stats = []
            for collection in collections:
                collection_df = df[df['collection_name'] == collection]
                stats = self._calculate_collection_stats(collection_df, collection, target_date)

                # SQLite에 저장
                await self._save_statistics(db, stats)
                all_stats.append(stats)

            # 전체 통계도 계산
            total_stats = self._calculate_collection_stats(df, "ALL", target_date)
            await self._save_statistics(db, total_stats)
            all_stats.append(total_stats)

            logger.info(f"일별 통계 집계 완료: {target_date}")
            return {
                "date": target_date.isoformat(),
                "status": "success",
                "collections": all_stats
            }

        except Exception as e:
            logger.error(f"통계 집계 오류: {e}")
            return {"date": target_date.isoformat(), "status": "error", "error": str(e)}

    def _read_jsonl_to_dataframe(self, file_path: Path) -> pd.DataFrame:
        """JSONL 파일을 DataFrame으로 읽기"""
        data = []
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                for line in f:
                    if line.strip():
                        try:
                            data.append(json.loads(line))
                        except json.JSONDecodeError as e:
                            logger.error(f"JSON 파싱 오류: {e}")
                            continue

            if data:
                df = pd.DataFrame(data)
                # 타임스탬프 파싱 및 KST 기준 통일
                if 'created_at' in df.columns:
                    df['created_at'] = pd.to_datetime(df['created_at'], format='mixed')

                    # 타임존 처리: KST 기준 naive datetime으로 통일
                    # - naive datetime: 이미 KST로 저장된 것으로 간주 (변환 없음)
                    # - timezone-aware datetime: KST로 변환 후 타임존 정보 제거
                    if df['created_at'].dt.tz is not None:
                        kst = ZoneInfo('Asia/Seoul')
                        df['created_at'] = df['created_at'].dt.tz_convert(kst).dt.tz_localize(None)
                return df
            else:
                return pd.DataFrame()

        except Exception as e:
            logger.error(f"파일 읽기 오류 {file_path}: {e}")
            return pd.DataFrame()

    def _calculate_collection_stats(
        self,
        df: pd.DataFrame,
        collection_name: str,
        target_date: date
    ) -> Dict[str, Any]:
        """컬렉션별 통계 계산"""
        stats = {
            "stat_id": str(uuid.uuid4()),
            "collection_name": collection_name,
            "date": target_date,
            "hour": None,  # 일별 집계

            # 기본 메트릭
            "total_queries": 0,
            "unique_sessions": 0,
            "total_tokens": 0,
            "error_count": 0,
            "regeneration_count": 0,

            # 응답 시간 메트릭
            "avg_response_time_ms": 0.0,
            "p50_response_time_ms": None,
            "p95_response_time_ms": None,
            "p99_response_time_ms": None,
            "max_response_time_ms": None,

            # 검색 메트릭
            "avg_retrieval_time_ms": 0.0,
            "avg_retrieval_score": None,
            "avg_retrieved_count": 0.0,

            # 재순위 메트릭
            "reranking_usage_count": 0,
            "avg_reranking_time_ms": None,

            # Top queries와 기타
            "top_queries": [],
            "model_usage": {},
            "reasoning_distribution": {}
        }

        if df.empty:
            return stats

        # 메시지 타입별 분리 (user/assistant)
        user_messages = df[df['message_type'] == 'user'] if 'message_type' in df.columns else df
        assistant_messages = df[df['message_type'] == 'assistant'] if 'message_type' in df.columns else pd.DataFrame()

        # 기본 메트릭 계산 (user 메시지 기준)
        stats["total_queries"] = len(user_messages)
        stats["unique_sessions"] = df['session_id'].nunique() if 'session_id' in df.columns else 0

        # 토큰 계산 (assistant 메시지의 performance 필드에서 - 응답 토큰)
        if 'performance' in assistant_messages.columns and not assistant_messages.empty:
            token_counts = assistant_messages['performance'].apply(
                lambda x: x.get('token_count', 0) if isinstance(x, dict) else 0
            )
            stats["total_tokens"] = int(token_counts.sum())

        # 에러 카운트 (전체에서)
        if 'error_info' in df.columns:
            stats["error_count"] = int(df['error_info'].notna().sum())

        # 응답 시간 통계 (assistant 메시지 기준 - 실제 응답 시간)
        if 'performance' in assistant_messages.columns and not assistant_messages.empty:
            response_times = assistant_messages['performance'].apply(
                lambda x: x.get('response_time_ms', None) if isinstance(x, dict) else None
            ).dropna()
            # 0이 아닌 값만 필터링
            response_times = response_times[response_times > 0]

            if not response_times.empty:
                stats["avg_response_time_ms"] = float(response_times.mean())
                stats["p50_response_time_ms"] = float(response_times.quantile(0.50))
                stats["p95_response_time_ms"] = float(response_times.quantile(0.95))
                stats["p99_response_time_ms"] = float(response_times.quantile(0.99))
                stats["max_response_time_ms"] = float(response_times.max())

        # 검색 메트릭 (assistant 메시지에서만 추출 - retrieval_info가 기록됨)
        if 'retrieval_info' in assistant_messages.columns and not assistant_messages.empty:
            retrieval_times = assistant_messages['retrieval_info'].apply(
                lambda x: x.get('retrieval_time_ms', None) if isinstance(x, dict) else None
            ).dropna()

            if not retrieval_times.empty:
                stats["avg_retrieval_time_ms"] = float(retrieval_times.mean())

            # 검색 스코어 (assistant 메시지에서만)
            retrieval_scores = []
            retrieved_counts = []

            for info in assistant_messages['retrieval_info'].dropna():
                if isinstance(info, dict):
                    if 'top_scores' in info and info['top_scores']:
                        retrieval_scores.extend(info['top_scores'])
                    if 'retrieved_count' in info:
                        retrieved_counts.append(info['retrieved_count'])

            if retrieval_scores:
                stats["avg_retrieval_score"] = float(np.mean(retrieval_scores))
            if retrieved_counts:
                stats["avg_retrieved_count"] = float(np.mean(retrieved_counts))

            # 재순위 사용 카운트 (assistant 메시지에서만)
            reranking_used = assistant_messages['retrieval_info'].apply(
                lambda x: x.get('reranking_used', False) if isinstance(x, dict) else False
            )
            stats["reranking_usage_count"] = int(reranking_used.sum())

        # Top queries (user 메시지에서 추출)
        if 'message_content' in user_messages.columns:
            query_counts = Counter(user_messages['message_content'].dropna())
            top_10_queries = query_counts.most_common(10)
            stats["top_queries"] = [query for query, count in top_10_queries]

        # 모델 사용 통계 (user 메시지 기준 - 중복 방지)
        if 'llm_model' in user_messages.columns:
            model_counts = user_messages['llm_model'].value_counts().to_dict()
            stats["model_usage"] = {str(k): int(v) for k, v in model_counts.items() if k}

        # Reasoning level 분포 (user 메시지 기준 - 중복 방지)
        if 'reasoning_level' in user_messages.columns:
            reasoning_counts = user_messages['reasoning_level'].value_counts().to_dict()
            stats["reasoning_distribution"] = {str(k): int(v) for k, v in reasoning_counts.items() if k}

        return stats

    async def _save_statistics(self, db: Session, stats: Dict[str, Any]):
        """통계를 SQLite에 저장"""
        try:
            # 기존 통계 확인 (같은 날짜, 컬렉션)
            existing = db.query(ChatStatistics).filter(
                and_(
                    ChatStatistics.collection_name == stats["collection_name"],
                    ChatStatistics.date == stats["date"],
                    ChatStatistics.hour.is_(None)  # 일별 집계
                )
            ).first()

            if existing:
                # 업데이트
                for key, value in stats.items():
                    if key not in ["stat_id", "created_at"]:
                        if key in ["top_queries", "model_usage", "reasoning_distribution"]:
                            # JSON 문자열로 변환
                            setattr(existing, key, json.dumps(value, ensure_ascii=False))
                        else:
                            setattr(existing, key, value)
                existing.updated_at = now_naive()
                logger.debug(f"통계 업데이트: {stats['collection_name']} - {stats['date']}")
            else:
                # 새로 생성
                # JSON 필드 문자열 변환
                stats_model = ChatStatistics(**{
                    **stats,
                    "top_queries": json.dumps(stats["top_queries"], ensure_ascii=False),
                    "model_usage": json.dumps(stats["model_usage"], ensure_ascii=False),
                    "reasoning_distribution": json.dumps(stats["reasoning_distribution"], ensure_ascii=False)
                })
                db.add(stats_model)
                logger.debug(f"통계 생성: {stats['collection_name']} - {stats['date']}")

            db.commit()

        except Exception as e:
            logger.error(f"통계 저장 오류: {e}")
            db.rollback()
            raise

    async def get_summary(
        self,
        collection_name: Optional[str],
        date_from: Optional[date],
        date_to: Optional[date],
        db: Session
    ) -> Dict[str, Any]:
        """통계 요약 조회"""
        try:
            # 날짜 기본값 설정
            if not date_to:
                date_to = date.today()
            if not date_from:
                date_from = date_to - timedelta(days=7)

            # JSONL에서 직접 계산 (unique_sessions 중복 방지를 위해)
            # ChatStatistics의 일별 unique_sessions를 단순 합산하면 중복 가능
            df = await self.query_logs_by_date_range(date_from, date_to, collection_name)

            if df.empty:
                return {
                    "total_queries": 0,
                    "unique_sessions": 0,
                    "total_tokens": 0,
                    "error_count": 0,
                    "avg_response_time_ms": 0,
                    "period": {
                        "from": date_from.isoformat(),
                        "to": date_to.isoformat(),
                        "days": (date_to - date_from).days + 1
                    },
                    "collections": [collection_name] if collection_name else [],
                    "top_queries": []
                }

            # 메시지 타입별 분리
            user_messages = df[df['message_type'] == 'user'] if 'message_type' in df.columns else df
            assistant_messages = df[df['message_type'] == 'assistant'] if 'message_type' in df.columns else pd.DataFrame()

            # 토큰 계산 (assistant 메시지에서)
            total_tokens = 0
            if 'performance' in assistant_messages.columns and not assistant_messages.empty:
                token_counts = assistant_messages['performance'].apply(
                    lambda x: x.get('token_count', 0) if isinstance(x, dict) else 0
                )
                total_tokens = int(token_counts.sum())

            # 에러 카운트
            error_count = 0
            if 'error_info' in df.columns:
                error_count = int(df['error_info'].notna().sum())

            # 응답 시간 (assistant 메시지에서, 0이 아닌 값만)
            avg_response_time = 0
            if 'performance' in assistant_messages.columns and not assistant_messages.empty:
                response_times = assistant_messages['performance'].apply(
                    lambda x: x.get('response_time_ms', None) if isinstance(x, dict) else None
                ).dropna()
                response_times = response_times[response_times > 0]
                if not response_times.empty:
                    avg_response_time = float(response_times.mean())

            # Top queries (user 메시지에서)
            top_queries = []
            if 'message_content' in user_messages.columns:
                query_counts = Counter(user_messages['message_content'].dropna())
                top_queries = [q for q, c in query_counts.most_common(20)]

            # 컬렉션 목록
            collections = []
            if 'collection_name' in df.columns:
                collections = df['collection_name'].dropna().unique().tolist()

            summary = {
                "total_queries": len(user_messages),
                "unique_sessions": df['session_id'].nunique() if 'session_id' in df.columns else 0,
                "total_tokens": total_tokens,
                "error_count": error_count,
                "avg_response_time_ms": avg_response_time,
                "period": {
                    "from": date_from.isoformat(),
                    "to": date_to.isoformat(),
                    "days": (date_to - date_from).days + 1
                },
                "collections": collections,
                "top_queries": top_queries
            }

            return summary

        except Exception as e:
            logger.error(f"통계 요약 조회 오류: {e}")
            return {"status": "error", "error": str(e)}

    async def _get_summary_from_logs(
        self,
        collection_name: Optional[str],
        date_from: Optional[date],
        date_to: Optional[date]
    ) -> Dict[str, Any]:
        """JSONL 로그에서 직접 요약 계산 (ChatStatistics가 비어있을 때 폴백)"""
        try:
            # 날짜 기본값 설정
            if not date_to:
                date_to = date.today()
            if not date_from:
                date_from = date_to - timedelta(days=7)

            df = await self.query_logs_by_date_range(date_from, date_to, collection_name)

            if df.empty:
                return {
                    "total_queries": 0,
                    "unique_sessions": 0,
                    "total_tokens": 0,
                    "error_count": 0,
                    "avg_response_time_ms": 0,
                    "period": {
                        "from": date_from.isoformat(),
                        "to": date_to.isoformat(),
                        "days": (date_to - date_from).days + 1
                    },
                    "collections": [collection_name] if collection_name else [],
                    "top_queries": []
                }

            # 메시지 타입별 분리
            user_messages = df[df['message_type'] == 'user'] if 'message_type' in df.columns else df
            assistant_messages = df[df['message_type'] == 'assistant'] if 'message_type' in df.columns else pd.DataFrame()

            # 토큰 계산 (assistant 메시지에서)
            total_tokens = 0
            if 'performance' in assistant_messages.columns and not assistant_messages.empty:
                token_counts = assistant_messages['performance'].apply(
                    lambda x: x.get('token_count', 0) if isinstance(x, dict) else 0
                )
                total_tokens = int(token_counts.sum())

            # 에러 카운트
            error_count = 0
            if 'error_info' in df.columns:
                error_count = int(df['error_info'].notna().sum())

            # 응답 시간 (assistant 메시지에서, 0이 아닌 값만)
            avg_response_time = 0
            if 'performance' in assistant_messages.columns and not assistant_messages.empty:
                response_times = assistant_messages['performance'].apply(
                    lambda x: x.get('response_time_ms', None) if isinstance(x, dict) else None
                ).dropna()
                response_times = response_times[response_times > 0]
                if not response_times.empty:
                    avg_response_time = float(response_times.mean())

            # Top queries (user 메시지에서)
            top_queries = []
            if 'message_content' in user_messages.columns:
                query_counts = Counter(user_messages['message_content'].dropna())
                top_queries = [q for q, c in query_counts.most_common(20)]

            # 컬렉션 목록
            collections = []
            if 'collection_name' in df.columns:
                collections = df['collection_name'].dropna().unique().tolist()

            return {
                "total_queries": len(user_messages),
                "unique_sessions": df['session_id'].nunique() if 'session_id' in df.columns else 0,
                "total_tokens": total_tokens,
                "error_count": error_count,
                "avg_response_time_ms": avg_response_time,
                "period": {
                    "from": date_from.isoformat(),
                    "to": date_to.isoformat(),
                    "days": (date_to - date_from).days + 1
                },
                "collections": collections,
                "top_queries": top_queries
            }

        except Exception as e:
            logger.error(f"로그 기반 요약 계산 오류: {e}")
            return {"status": "error", "error": str(e)}

    async def get_timeline(
        self,
        collection_name: str,
        period: str,  # "daily" or "hourly"
        days: int,
        db: Session
    ) -> List[Dict[str, Any]]:
        """시계열 데이터 조회 (전체 통계는 collection_name='ALL')"""
        try:
            end_date = date.today()
            start_date = end_date - timedelta(days=days)

            query = db.query(ChatStatistics).filter(
                and_(
                    ChatStatistics.collection_name == collection_name,
                    ChatStatistics.date >= start_date,
                    ChatStatistics.date <= end_date
                )
            )

            if period == "daily":
                query = query.filter(ChatStatistics.hour.is_(None))

            stats = query.order_by(ChatStatistics.date).all()

            # ChatStatistics가 비어있으면 JSONL에서 직접 계산
            if not stats:
                return await self._get_timeline_from_logs(collection_name, start_date, end_date)

            timeline = []
            for stat in stats:
                timeline.append({
                    "date": stat.date.isoformat(),
                    "hour": stat.hour,
                    "queries": stat.total_queries,
                    "sessions": stat.unique_sessions,
                    "avg_response_time": stat.avg_response_time_ms,
                    "errors": stat.error_count
                })

            return timeline

        except Exception as e:
            logger.error(f"타임라인 조회 오류: {e}")
            return []

    async def _get_timeline_from_logs(
        self,
        collection_name: str,
        start_date: date,
        end_date: date
    ) -> List[Dict[str, Any]]:
        """JSONL 로그에서 직접 타임라인 계산 (ALL이면 전체 조회)"""
        try:
            # ALL이면 전체 로그 조회 (collection_name=None)
            filter_collection = None if collection_name == "ALL" else collection_name
            df = await self.query_logs_by_date_range(start_date, end_date, filter_collection)

            if df.empty:
                return []

            # 날짜별 집계
            if 'created_at' not in df.columns:
                return []

            df['date'] = pd.to_datetime(df['created_at']).dt.date

            # 메시지 타입별 분리
            user_messages = df[df['message_type'] == 'user'] if 'message_type' in df.columns else df
            assistant_messages = df[df['message_type'] == 'assistant'] if 'message_type' in df.columns else pd.DataFrame()

            timeline = []
            for target_date in pd.date_range(start_date, end_date):
                target_date = target_date.date()
                day_user = user_messages[user_messages['date'] == target_date]
                day_assistant = assistant_messages[assistant_messages['date'] == target_date] if not assistant_messages.empty else pd.DataFrame()
                day_all = df[df['date'] == target_date]

                # 응답 시간 계산 (assistant 메시지에서, 0이 아닌 값만)
                avg_response_time = 0
                if 'performance' in day_assistant.columns and not day_assistant.empty:
                    response_times = day_assistant['performance'].apply(
                        lambda x: x.get('response_time_ms', None) if isinstance(x, dict) else None
                    ).dropna()
                    response_times = response_times[response_times > 0]
                    if not response_times.empty:
                        avg_response_time = float(response_times.mean())

                # 에러 카운트
                error_count = 0
                if 'error_info' in day_all.columns:
                    error_count = int(day_all['error_info'].notna().sum())

                timeline.append({
                    "date": target_date.isoformat(),
                    "hour": None,
                    "queries": len(day_user),
                    "sessions": day_all['session_id'].nunique() if 'session_id' in day_all.columns else 0,
                    "avg_response_time": avg_response_time,
                    "errors": error_count
                })

            return timeline

        except Exception as e:
            logger.error(f"로그 기반 타임라인 계산 오류: {e}")
            return []

    async def query_logs_by_date_range(
        self,
        start_date: date,
        end_date: date,
        collection_name: Optional[str] = None
    ) -> pd.DataFrame:
        """날짜 범위로 로그 조회 (pandas DataFrame 반환)"""
        dfs = []
        current_date = start_date

        while current_date <= end_date:
            file_path = self.log_dir / f"{current_date.isoformat()}.jsonl"

            if file_path.exists():
                df = self._read_jsonl_to_dataframe(file_path)

                # 컬렉션 필터링
                if not df.empty and collection_name and 'collection_name' in df.columns:
                    df = df[df['collection_name'] == collection_name]

                if not df.empty:
                    dfs.append(df)

            current_date += timedelta(days=1)

        if dfs:
            return pd.concat(dfs, ignore_index=True)
        else:
            return pd.DataFrame()

    async def generate_report(
        self,
        date_from: date,
        date_to: date,
        db: Session
    ) -> Dict[str, Any]:
        """종합 리포트 생성"""
        try:
            # 로그 데이터 로드
            df = await self.query_logs_by_date_range(date_from, date_to)

            if df.empty:
                return {"status": "no_data", "period": {
                    "from": date_from.isoformat(),
                    "to": date_to.isoformat()
                }}

            # 리포트 생성
            report = {
                "period": {
                    "from": date_from.isoformat(),
                    "to": date_to.isoformat(),
                    "days": (date_to - date_from).days + 1
                },
                "overview": {
                    "total_queries": len(df[df['message_type'] == 'user']) if 'message_type' in df.columns else len(df),
                    "unique_sessions": df['session_id'].nunique() if 'session_id' in df.columns else 0,
                    "unique_collections": df['collection_name'].nunique() if 'collection_name' in df.columns else 0
                },
                "performance": {},
                "quality": {},
                "usage_patterns": {}
            }

            # 성능 메트릭
            if 'performance' in df.columns:
                response_times = df['performance'].apply(
                    lambda x: x.get('response_time_ms', None) if isinstance(x, dict) else None
                ).dropna()

                if not response_times.empty:
                    report["performance"] = {
                        "avg_response_time_ms": float(response_times.mean()),
                        "median_response_time_ms": float(response_times.median()),
                        "p95_response_time_ms": float(response_times.quantile(0.95)),
                        "p99_response_time_ms": float(response_times.quantile(0.99))
                    }

            # 품질 메트릭
            if 'retrieval_info' in df.columns:
                scores = []
                for info in df['retrieval_info'].dropna():
                    if isinstance(info, dict) and 'top_scores' in info:
                        scores.extend(info['top_scores'])

                if scores:
                    report["quality"]["avg_retrieval_score"] = float(np.mean(scores))
                    report["quality"]["low_score_ratio"] = float(np.mean([s < 0.5 for s in scores]))

            # 사용 패턴
            if 'created_at' in df.columns:
                df['hour'] = pd.to_datetime(df['created_at']).dt.hour
                hourly_dist = df.groupby('hour').size().to_dict()
                report["usage_patterns"]["hourly_distribution"] = {int(k): int(v) for k, v in hourly_dist.items()}

            # 컬렉션별 통계 (사용자 메시지만 필터링하여 쿼리 수 계산)
            if 'collection_name' in df.columns:
                user_df = df[df['message_type'] == 'user'] if 'message_type' in df.columns else df
                collection_stats = user_df.groupby('collection_name').agg(
                    total_queries=('session_id', 'count'),
                    unique_sessions=('session_id', 'nunique')
                ).to_dict('index')
                report["collections"] = collection_stats

            return report

        except Exception as e:
            logger.error(f"리포트 생성 오류: {e}")
            return {"status": "error", "error": str(e)}


# 싱글톤 인스턴스
statistics_service = StatisticsService()