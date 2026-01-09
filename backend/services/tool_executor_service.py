"""
도구 실행 서비스
LLM이 호출한 도구(함수)를 실제로 실행하고 결과를 반환합니다.
"""

import json
import logging
import uuid
from typing import Dict, Any, Optional, Callable, Awaitable
from dataclasses import dataclass, field
from datetime import datetime, timedelta

logger = logging.getLogger("uvicorn")


@dataclass
class ToolResult:
    """도구 실행 결과"""
    tool_call_id: str
    tool_name: str
    success: bool
    action_type: str  # "download", "clipboard", "message"
    file_id: Optional[str] = None
    filename: Optional[str] = None
    content_type: Optional[str] = None
    message: Optional[str] = None
    error: Optional[str] = None


@dataclass
class ExportedFile:
    """내보낸 파일 정보"""
    file_id: str
    filename: str
    content: bytes
    content_type: str
    created_at: datetime
    expires_at: datetime


class FileStorageError(Exception):
    """파일 저장소 관련 에러"""
    pass


class FileSizeExceededError(FileStorageError):
    """파일 크기 초과 에러"""
    pass


class StorageCapacityExceededError(FileStorageError):
    """저장소 용량 초과 에러"""
    pass


class FileStorage:
    """
    임시 파일 저장소
    생성된 파일을 메모리에 저장하고 TTL 후 자동 삭제

    Features:
    - TTL 기반 자동 만료 (기본 5분)
    - 파일 크기 제한 (기본 10MB)
    - 총 저장 용량 제한 (기본 100MB)
    - 최대 파일 개수 제한 (기본 50개)
    """

    def __init__(
        self,
        ttl_minutes: int = 5,
        max_file_size_mb: float = 10,
        max_total_size_mb: float = 100,
        max_files: int = 50
    ):
        self._storage: Dict[str, ExportedFile] = {}
        self._ttl = timedelta(minutes=ttl_minutes)
        self._max_file_size = int(max_file_size_mb * 1024 * 1024)  # bytes
        self._max_total_size = int(max_total_size_mb * 1024 * 1024)  # bytes
        self._max_files = max_files

    def store(self, filename: str, content: bytes, content_type: str) -> str:
        """
        파일 저장 및 ID 반환

        Args:
            filename: 파일명
            content: 파일 내용 (bytes)
            content_type: MIME 타입

        Returns:
            str: 파일 ID

        Raises:
            FileSizeExceededError: 파일 크기가 제한을 초과한 경우
            StorageCapacityExceededError: 저장소 용량이 부족한 경우
        """
        # 만료된 파일 먼저 정리
        self._cleanup_expired()

        # 파일 크기 검증
        file_size = len(content)
        if file_size > self._max_file_size:
            max_mb = self._max_file_size / (1024 * 1024)
            actual_mb = file_size / (1024 * 1024)
            raise FileSizeExceededError(
                f"파일 크기({actual_mb:.1f}MB)가 최대 허용 크기({max_mb:.1f}MB)를 초과합니다."
            )

        # 총 저장 용량 검증
        current_total = sum(f.content.__len__() for f in self._storage.values())
        if current_total + file_size > self._max_total_size:
            # 오래된 파일부터 삭제하여 공간 확보 시도
            self._evict_oldest_files(file_size)
            current_total = sum(f.content.__len__() for f in self._storage.values())
            if current_total + file_size > self._max_total_size:
                raise StorageCapacityExceededError(
                    "저장소 용량이 부족합니다. 잠시 후 다시 시도해주세요."
                )

        # 최대 파일 개수 검증
        if len(self._storage) >= self._max_files:
            self._evict_oldest_files(0)  # 가장 오래된 파일 1개 삭제
            if len(self._storage) >= self._max_files:
                raise StorageCapacityExceededError(
                    "저장 가능한 파일 개수를 초과했습니다. 잠시 후 다시 시도해주세요."
                )

        file_id = str(uuid.uuid4())
        now = datetime.now()

        self._storage[file_id] = ExportedFile(
            file_id=file_id,
            filename=filename,
            content=content,
            content_type=content_type,
            created_at=now,
            expires_at=now + self._ttl
        )

        logger.info(f"[FileStorage] Stored file: {filename} (id={file_id}, size={file_size} bytes, total_files={len(self._storage)})")
        return file_id

    def _evict_oldest_files(self, required_space: int):
        """오래된 파일부터 삭제하여 공간 확보"""
        if not self._storage:
            return

        # 생성 시간순으로 정렬
        sorted_files = sorted(
            self._storage.items(),
            key=lambda x: x[1].created_at
        )

        freed_space = 0
        files_to_delete = []

        for file_id, file_data in sorted_files:
            if required_space > 0 and freed_space >= required_space:
                break
            if len(self._storage) - len(files_to_delete) <= 1:
                break  # 최소 1개는 유지

            files_to_delete.append(file_id)
            freed_space += len(file_data.content)

        for file_id in files_to_delete:
            del self._storage[file_id]
            logger.info(f"[FileStorage] Evicted old file: {file_id}")

    def get(self, file_id: str) -> Optional[ExportedFile]:
        """파일 조회"""
        self._cleanup_expired()

        file_data = self._storage.get(file_id)
        if file_data and datetime.now() < file_data.expires_at:
            return file_data

        return None

    def delete(self, file_id: str) -> bool:
        """파일 삭제"""
        if file_id in self._storage:
            del self._storage[file_id]
            return True
        return False

    def _cleanup_expired(self):
        """만료된 파일 정리"""
        now = datetime.now()
        expired_ids = [
            fid for fid, fdata in self._storage.items()
            if now >= fdata.expires_at
        ]
        for fid in expired_ids:
            del self._storage[fid]
            logger.debug(f"[FileStorage] Expired file removed: {fid}")


# 전역 파일 저장소
file_storage = FileStorage(ttl_minutes=5)


class ToolExecutorService:
    """
    도구 실행 서비스
    LLM의 tool_calls를 받아 해당 도구를 실행합니다.
    """

    def __init__(self):
        self._handlers: Dict[str, Callable[..., Awaitable[ToolResult]]] = {}
        self._register_default_handlers()

    def _register_default_handlers(self):
        """기본 도구 핸들러 등록"""
        # 핸들러는 1.5, 1.6에서 구현 후 여기서 등록
        pass

    def register_handler(
        self,
        tool_name: str,
        handler: Callable[..., Awaitable[ToolResult]]
    ):
        """도구 핸들러 등록"""
        self._handlers[tool_name] = handler
        logger.info(f"[ToolExecutor] Registered handler: {tool_name}")

    async def execute_tool(
        self,
        tool_call_id: str,
        tool_name: str,
        arguments: Dict[str, Any]
    ) -> ToolResult:
        """
        도구 실행

        Args:
            tool_call_id: 도구 호출 ID
            tool_name: 도구 이름
            arguments: 도구 인자

        Returns:
            ToolResult: 실행 결과
        """
        handler = self._handlers.get(tool_name)

        if not handler:
            logger.warning(f"[ToolExecutor] No handler for tool: {tool_name}")
            return ToolResult(
                tool_call_id=tool_call_id,
                tool_name=tool_name,
                success=False,
                action_type="message",
                error=f"도구 '{tool_name}'을(를) 찾을 수 없습니다."
            )

        try:
            logger.info(f"[ToolExecutor] Executing tool: {tool_name} with args: {arguments}")
            result = await handler(tool_call_id, arguments)
            logger.info(f"[ToolExecutor] Tool execution completed: {tool_name}, success={result.success}")
            return result

        except Exception as e:
            logger.error(f"[ToolExecutor] Tool execution failed: {tool_name}, error={e}")
            return ToolResult(
                tool_call_id=tool_call_id,
                tool_name=tool_name,
                success=False,
                action_type="message",
                error=f"도구 실행 중 오류가 발생했습니다: {str(e)}"
            )

    async def execute_tool_calls(
        self,
        tool_calls: list
    ) -> list[ToolResult]:
        """
        여러 도구 호출 실행

        Args:
            tool_calls: LLM 응답의 tool_calls 목록

        Returns:
            list[ToolResult]: 실행 결과 목록
        """
        results = []

        for tc in tool_calls:
            # tool_call 구조 파싱
            tool_call_id = tc.get("id", str(uuid.uuid4()))
            function_info = tc.get("function", {})
            tool_name = function_info.get("name") or tc.get("name", "")
            arguments_str = function_info.get("arguments", "{}")

            # arguments 파싱
            try:
                if isinstance(arguments_str, str):
                    arguments = json.loads(arguments_str)
                else:
                    arguments = arguments_str
            except json.JSONDecodeError:
                arguments = {"raw": arguments_str}

            result = await self.execute_tool(tool_call_id, tool_name, arguments)
            results.append(result)

        return results

    def get_registered_tools(self) -> list[str]:
        """등록된 도구 목록 반환"""
        return list(self._handlers.keys())


# 싱글톤 인스턴스
tool_executor = ToolExecutorService()
