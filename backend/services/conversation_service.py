"""
대화 히스토리 서비스
스마트 샘플링과 함께 대화 내역을 JSONL 파일로 저장
"""

import os
import json
import asyncio
import aiofiles
import random
import hashlib
import gzip
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from pathlib import Path
import uuid
import logging

from backend.config.settings import settings

logger = logging.getLogger(__name__)


class Conversation:
    """대화 객체"""

    def __init__(self, conversation_id: str, collection_name: str):
        self.conversation_id = conversation_id
        self.collection_name = collection_name
        self.messages = []
        self.metadata = {}
        self.has_error = False
        self.has_regeneration = False
        self.turn_count = 0
        self.min_score = 1.0
        self.user_hash = None
        self.started_at = datetime.utcnow()
        self.ended_at = None

    def add_message(
        self,
        role: str,
        content: str,
        retrieved_docs: Optional[List[Dict]] = None,
        error_info: Optional[Dict] = None
    ):
        """메시지 추가"""
        message = {
            "role": role,
            "content": content,
            "timestamp": datetime.utcnow().isoformat()
        }

        if retrieved_docs:
            message["retrieved_docs"] = retrieved_docs
            # 최소 스코어 업데이트
            for doc in retrieved_docs:
                if "score" in doc:
                    self.min_score = min(self.min_score, doc["score"])

        if error_info:
            message["error_info"] = error_info
            self.has_error = True

        self.messages.append(message)

        # 턴 카운트 업데이트 (user 메시지 기준)
        if role == "user":
            self.turn_count += 1

    def set_regeneration(self):
        """재생성 플래그 설정"""
        self.has_regeneration = True

    def set_user_hash(self, user_identifier: Optional[str]):
        """사용자 해시 설정 (개인정보 보호)"""
        if user_identifier:
            self.user_hash = hashlib.sha256(user_identifier.encode()).hexdigest()

    def finalize(self):
        """대화 종료 처리"""
        self.ended_at = datetime.utcnow()
        self.metadata = {
            "total_turns": self.turn_count,
            "has_error": self.has_error,
            "has_regeneration": self.has_regeneration,
            "min_retrieval_score": self.min_score if self.min_score < 1.0 else None,
            "duration_seconds": (self.ended_at - self.started_at).total_seconds()
        }

    def to_dict(self) -> Dict[str, Any]:
        """딕셔너리 변환"""
        return {
            "conversation_id": self.conversation_id,
            "collection_name": self.collection_name,
            "user_hash": self.user_hash,
            "messages": self.messages,
            "metadata": self.metadata,
            "started_at": self.started_at.isoformat(),
            "ended_at": self.ended_at.isoformat() if self.ended_at else None
        }


class ConversationService:
    """대화 히스토리 서비스"""

    def __init__(self):
        """서비스 초기화"""
        self.conv_dir = Path("./logs/conversations")
        self.active_conversations: Dict[str, Conversation] = {}

        # 환경변수에서 설정 로드
        self.sample_rate = settings.CONVERSATION_SAMPLE_RATE
        self.retention_days = settings.CONVERSATION_RETENTION_DAYS
        self.compress_after_days = settings.CONVERSATION_COMPRESS_AFTER_DAYS

        # 스마트 샘플링 규칙 (환경변수 기반)
        self.SAMPLING_RULES = {
            "always_save": [
                lambda c: c.has_error,  # 에러가 있는 대화
                lambda c: c.has_regeneration,  # 재생성이 있는 대화
                lambda c: c.turn_count >= 5,  # 긴 대화
                lambda c: c.min_score < 0.5,  # 낮은 검색 스코어
            ],
            "sample_rate": self.sample_rate  # 환경변수에서 로드 (기본값: 1.0 = 100%)
        }

        # 디렉토리 생성
        self._create_directories()

        logger.info(f"ConversationService 초기화: 샘플링 비율={self.sample_rate*100}%, 보존기간={self.retention_days}일, 압축={self.compress_after_days}일 후")

    def _create_directories(self):
        """대화 디렉토리 생성"""
        self.conv_dir.mkdir(parents=True, exist_ok=True)
        logger.info(f"대화 디렉토리 생성: {self.conv_dir}")

    def start_conversation(
        self,
        conversation_id: Optional[str],
        collection_name: str,
        user_identifier: Optional[str] = None
    ) -> str:
        """새 대화 시작"""
        if not conversation_id:
            conversation_id = str(uuid.uuid4())

        # 이미 존재하는 대화인지 확인
        if conversation_id not in self.active_conversations:
            conversation = Conversation(conversation_id, collection_name)
            if user_identifier:
                conversation.set_user_hash(user_identifier)
            self.active_conversations[conversation_id] = conversation
            logger.debug(f"새 대화 시작: {conversation_id}")

        return conversation_id

    def add_message(
        self,
        conversation_id: str,
        role: str,
        content: str,
        retrieved_docs: Optional[List[Dict]] = None,
        error_info: Optional[Dict] = None
    ):
        """대화에 메시지 추가"""
        if conversation_id in self.active_conversations:
            conversation = self.active_conversations[conversation_id]
            conversation.add_message(role, content, retrieved_docs, error_info)
            logger.debug(f"메시지 추가: {conversation_id} - {role}")
        else:
            logger.warning(f"존재하지 않는 대화: {conversation_id}")

    def set_regeneration(self, conversation_id: str):
        """재생성 플래그 설정"""
        if conversation_id in self.active_conversations:
            self.active_conversations[conversation_id].set_regeneration()

    async def end_conversation(self, conversation_id: str) -> bool:
        """대화 종료 및 저장 여부 결정"""
        if conversation_id not in self.active_conversations:
            logger.warning(f"존재하지 않는 대화 종료 시도: {conversation_id}")
            return False

        conversation = self.active_conversations.pop(conversation_id)
        conversation.finalize()

        # 저장 여부 결정
        should_save = await self.should_save(conversation)

        if should_save:
            await self.save_conversation(conversation)
            logger.info(f"대화 저장됨: {conversation_id}")
            return True
        else:
            logger.debug(f"대화 샘플링 제외: {conversation_id}")
            return False

    async def should_save(self, conversation: Conversation) -> bool:
        """저장 여부 결정 (스마트 샘플링)"""
        # 우선순위 규칙 체크
        for rule in self.SAMPLING_RULES["always_save"]:
            if rule(conversation):
                conversation.metadata["save_reason"] = "priority_rule"
                return True

        # 무작위 샘플링
        if random.random() < self.SAMPLING_RULES["sample_rate"]:
            conversation.metadata["save_reason"] = "random_sampling"
            return True

        return False

    async def save_conversation(self, conversation: Conversation):
        """대화를 JSONL 파일로 저장"""
        try:
            date_str = datetime.now().strftime("%Y-%m-%d")
            file_path = self.conv_dir / f"{date_str}.jsonl"

            # 대화 데이터 준비
            conv_data = conversation.to_dict()
            conv_data["is_sampled"] = True
            conv_data["retention_priority"] = self._calculate_priority(conversation)

            # 요약 생성 (선택적 - 나중에 구현)
            conv_data["summary"] = self._generate_summary(conversation)

            # JSONL 파일에 추가
            async with aiofiles.open(file_path, 'a', encoding='utf-8') as f:
                json_line = json.dumps(conv_data, ensure_ascii=False) + '\n'
                await f.write(json_line)

            logger.debug(f"대화 저장 완료: {file_path}")

        except Exception as e:
            logger.error(f"대화 저장 실패: {e}")

    def _calculate_priority(self, conversation: Conversation) -> str:
        """대화 보존 우선순위 계산"""
        if conversation.has_error or conversation.min_score < 0.3:
            return "high"
        elif conversation.has_regeneration or conversation.turn_count >= 5:
            return "high"
        elif conversation.turn_count >= 3 or conversation.min_score < 0.5:
            return "medium"
        else:
            return "low"

    def _generate_summary(self, conversation: Conversation) -> Optional[str]:
        """대화 요약 생성 (간단한 버전)"""
        # TODO: LLM을 사용한 요약 생성 구현 가능
        # 현재는 첫 번째 사용자 메시지만 반환
        for msg in conversation.messages:
            if msg["role"] == "user":
                content = msg["content"]
                # 100자로 제한
                return content[:100] + "..." if len(content) > 100 else content
        return None

    async def read_conversations(
        self,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        collection_name: Optional[str] = None,
        limit: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """저장된 대화 읽기 (압축 파일 포함)"""
        conversations = []

        # 날짜 범위의 파일 찾기 (.jsonl 및 .jsonl.gz 파일 모두)
        for file_path in sorted(self.conv_dir.glob("*.jsonl*")):
            try:
                # 날짜 파싱
                file_date_str = file_path.stem.replace(".jsonl", "")  # .jsonl.gz의 경우 처리
                file_date_str = file_date_str.split(".")[0]  # YYYY-MM-DD만 추출
                file_date = datetime.strptime(file_date_str, "%Y-%m-%d").date()

                # 날짜 필터링
                if start_date and file_date < start_date.date():
                    continue
                if end_date and file_date > end_date.date():
                    continue

                # 파일 읽기 (압축/비압축 구분)
                if file_path.suffix == ".gz":
                    # gzip 압축 파일 읽기
                    with gzip.open(file_path, 'rt', encoding='utf-8') as f:
                        for line in f:
                            if not line.strip():
                                continue

                            try:
                                conv = json.loads(line)

                                # 컬렉션 필터링
                                if collection_name and conv.get("collection_name") != collection_name:
                                    continue

                                conversations.append(conv)

                                # 제한 체크
                                if limit and len(conversations) >= limit:
                                    return conversations

                            except json.JSONDecodeError as e:
                                logger.error(f"JSON 파싱 오류: {e}")
                else:
                    # 일반 JSONL 파일 읽기
                    async with aiofiles.open(file_path, 'r', encoding='utf-8') as f:
                        async for line in f:
                            if not line.strip():
                                continue

                            try:
                                conv = json.loads(line)

                                # 컬렉션 필터링
                                if collection_name and conv.get("collection_name") != collection_name:
                                    continue

                                conversations.append(conv)

                                # 제한 체크
                                if limit and len(conversations) >= limit:
                                    return conversations

                            except json.JSONDecodeError as e:
                                logger.error(f"JSON 파싱 오류: {e}")

            except Exception as e:
                logger.error(f"파일 읽기 오류 {file_path}: {e}")

        return conversations

    def get_active_conversation_count(self) -> int:
        """활성 대화 수 반환"""
        return len(self.active_conversations)

    async def compress_old_files(self):
        """오래된 파일 압축 (gzip)"""
        compress_after_date = datetime.now().date() - timedelta(days=self.compress_after_days)
        compressed_count = 0

        for file_path in self.conv_dir.glob("*.jsonl"):
            try:
                # 이미 압축된 파일은 건너뛰기
                if file_path.suffix == ".gz":
                    continue

                # 파일 날짜 파싱
                file_date_str = file_path.stem
                file_date = datetime.strptime(file_date_str, "%Y-%m-%d").date()

                # 압축 대상 체크
                if file_date <= compress_after_date:
                    # gzip으로 압축
                    gz_path = file_path.with_suffix(".jsonl.gz")

                    with open(file_path, 'rb') as f_in:
                        with gzip.open(gz_path, 'wb', compresslevel=6) as f_out:
                            f_out.writelines(f_in)

                    # 원본 파일 삭제
                    file_path.unlink()
                    compressed_count += 1
                    logger.info(f"대화 파일 압축 완료: {file_path} -> {gz_path}")

            except Exception as e:
                logger.error(f"파일 압축 오류 {file_path}: {e}")

        if compressed_count > 0:
            logger.info(f"총 {compressed_count}개 파일 압축됨")

        return compressed_count

    async def cleanup_old_conversations(self, retention_days: Optional[int] = None):
        """오래된 대화 파일 정리 및 압축"""
        if retention_days is None:
            retention_days = self.retention_days

        # 먼저 압축 처리
        await self.compress_old_files()

        # 오래된 파일 삭제
        cutoff_date = datetime.now().date() - timedelta(days=retention_days)
        deleted_count = 0

        for file_path in self.conv_dir.glob("*.jsonl*"):  # .jsonl 및 .jsonl.gz 파일 모두 확인
            try:
                # 파일 날짜 파싱
                file_date_str = file_path.stem.replace(".jsonl", "")  # .jsonl.gz의 경우 처리
                file_date = datetime.strptime(file_date_str.split(".")[0], "%Y-%m-%d").date()

                # 보존 기간 체크
                if file_date < cutoff_date:
                    # 파일 삭제
                    file_path.unlink()
                    deleted_count += 1
                    logger.info(f"오래된 대화 파일 삭제: {file_path}")

            except Exception as e:
                logger.error(f"파일 정리 오류 {file_path}: {e}")

        logger.info(f"총 {deleted_count}개 파일 삭제됨")
        return deleted_count


# 싱글톤 인스턴스
conversation_service = ConversationService()