"""
kordoc CLI subprocess 어댑터

쇼케이스 문서 업로드 자동 추출 기능 전용 파서.
HWP/HWPX/PDF/DOCX 등 모든 포맷을 kordoc Node CLI 하나로 통일 파싱한다
(메인 문서 파이프라인의 Docling과는 역할 분리).

호출 형식:
    kordoc <입력파일> --format markdown --silent -o <출력파일>

보안/성능:
- 임시파일 격리 (우리가 만든 tmp만 인자로 전달, 사용자 파일명은 확장자만 사용)
- 절대경로 실행 파일 + 타임아웃 강제
- 동시 실행 수 제한 (세마포어)
- 모든 임시파일은 finally에서 정리
"""
import asyncio
import logging
import os
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Optional

from backend.config.settings import settings

logger = logging.getLogger("uvicorn")


class KordocParseError(Exception):
    """kordoc 파싱 실패 (실행 실패/타임아웃/빈 출력). 서비스가 폴백 분기에 사용."""


# 동시 파싱 실행 수 제한 (외부 바이너리 과다 동시 실행 방지)
_semaphore = asyncio.Semaphore(max(1, settings.KORDOC_MAX_CONCURRENT))

# 실행 파일 경로 1회 해석 캐시
_resolved_bin: Optional[str] = None


def _resolve_bin() -> str:
    """KORDOC_BIN(절대경로/이름)을 실제 실행 가능한 절대경로로 해석.

    - 절대경로가 그대로 존재하면 사용
    - 아니면 PATH에서 탐색 (Windows에서는 kordoc.cmd 래퍼가 탐색됨)
    """
    global _resolved_bin
    if _resolved_bin:
        return _resolved_bin

    configured = settings.KORDOC_BIN
    # 명시적 경로가 그대로 실행 가능하면 사용
    if os.path.isabs(configured) and Path(configured).exists():
        _resolved_bin = configured
        return _resolved_bin

    found = shutil.which(configured)
    if not found:
        raise KordocParseError(
            f"kordoc 실행 파일을 찾을 수 없습니다 (KORDOC_BIN={configured}). "
            "`npm install -g kordoc` 설치 여부를 확인하세요."
        )
    _resolved_bin = found
    return _resolved_bin


def _run_kordoc_sync(bin_path: str, in_path: str, out_path: str) -> None:
    """동기 subprocess로 kordoc 실행 (스레드에서 호출).

    asyncio.create_subprocess_exec는 Windows의 SelectorEventLoop(uvicorn 기본)에서
    NotImplementedError를 던지므로, 이벤트 루프에 비의존적인 동기 subprocess를
    asyncio.to_thread로 감싸 호출한다. (Selector/Proactor·Linux 모두 동작)

    Raises:
        KordocParseError: 실행 실패/타임아웃 등 모든 오류
    """
    args = [bin_path, in_path, "--format", "markdown", "--silent", "-o", out_path]
    try:
        completed = subprocess.run(
            args,
            capture_output=True,
            timeout=settings.KORDOC_TIMEOUT,
        )
    except subprocess.TimeoutExpired as e:
        raise KordocParseError(
            f"kordoc 파싱이 시간 초과되었습니다 ({settings.KORDOC_TIMEOUT}s)."
        ) from e
    except (OSError, ValueError) as e:
        raise KordocParseError(f"kordoc 실행에 실패했습니다: {e}") from e

    if completed.returncode != 0:
        err = (completed.stderr or b"").decode("utf-8", errors="replace").strip()
        raise KordocParseError(
            f"kordoc 변환 실패 (exit={completed.returncode}): {err[:500]}"
        )


async def parse_to_markdown(data: bytes, ext: str) -> str:
    """업로드된 파일 바이트를 kordoc으로 마크다운 변환.

    Args:
        data: 업로드 파일 바이트
        ext: 원본 확장자 (예: ".pdf", ".hwpx"). kordoc 포맷 판별에 필요.

    Returns:
        변환된 마크다운 문자열

    Raises:
        KordocParseError: 실행 실패/타임아웃/빈 출력
    """
    bin_path = _resolve_bin()

    # 입력/출력 임시파일 (입력은 원본 확장자 유지 → kordoc 포맷 판별)
    suffix = ext if ext.startswith(".") else f".{ext}"
    in_fd, in_path = tempfile.mkstemp(suffix=suffix, prefix="showcase_in_")
    out_fd, out_path = tempfile.mkstemp(suffix=".md", prefix="showcase_out_")
    os.close(out_fd)  # kordoc이 직접 덮어쓰므로 핸들만 닫아둠

    try:
        with os.fdopen(in_fd, "wb") as f:
            f.write(data)

        # 동기 subprocess를 스레드에서 실행 (이벤트 루프 비의존). 세마포어로 동시 실행 제한.
        async with _semaphore:
            logger.info(f"[kordoc] 파싱 시작: ext={ext}, size={len(data)} bytes")
            await asyncio.to_thread(_run_kordoc_sync, bin_path, in_path, out_path)

        markdown = Path(out_path).read_text(encoding="utf-8", errors="replace")
        if not markdown.strip():
            raise KordocParseError("kordoc 변환 결과가 비어 있습니다.")

        logger.info(f"[kordoc] 파싱 성공: {len(markdown)} chars")
        return markdown

    finally:
        for p in (in_path, out_path):
            try:
                os.unlink(p)
            except OSError:
                pass
