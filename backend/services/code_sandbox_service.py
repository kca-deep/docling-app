"""
CodeSandboxService - Python 코드 샌드박스 실행

AST 기반 안전성 검사 + subprocess 기반 격리 실행을 통해
사용자 데이터 분석 코드를 안전하게 실행합니다.
"""
import ast
import asyncio
import base64
import glob
import logging
import os
import textwrap
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Optional

from backend.config.settings import settings

logger = logging.getLogger("uvicorn")

# 허용된 import 모듈
ALLOWED_IMPORTS = {
    "pandas", "numpy", "matplotlib", "matplotlib.pyplot",
    "matplotlib.dates", "matplotlib.ticker", "matplotlib.colors",
    "seaborn", "math", "statistics", "collections", "itertools",
    "functools", "operator", "re", "json", "csv", "datetime",
    "decimal", "fractions", "textwrap", "io", "copy",
    "string", "os.path", "tabulate",
}

# 차단된 import 모듈
BLOCKED_IMPORTS = {
    "os", "sys", "subprocess", "shutil", "pathlib",
    "socket", "http", "urllib", "requests", "httpx",
    "ctypes", "importlib", "pickle", "shelve",
    "multiprocessing", "threading", "signal",
    "webbrowser", "tempfile", "glob",
}

# 차단된 함수/속성
BLOCKED_CALLS = {
    "exec", "eval", "compile", "globals", "locals",
    "__import__", "getattr", "setattr", "delattr",
    "open",  # 쓰기 모드만 차단 (읽기는 허용)
}


@dataclass
class CodeExecutionResult:
    """코드 실행 결과"""
    success: bool
    stdout: str = ""
    stderr: str = ""
    images: List[str] = field(default_factory=list)  # base64 인코딩된 이미지
    error: Optional[str] = None
    execution_time_ms: int = 0


class CodeSandboxService:
    """Python 코드 샌드박스 실행 서비스"""

    def __init__(self):
        self._semaphore = asyncio.Semaphore(settings.CODE_SANDBOX_MAX_CONCURRENT)

    async def execute(self, code: str, session_id: str) -> CodeExecutionResult:
        """
        Python 코드를 샌드박스에서 실행

        Args:
            code: 실행할 Python 코드
            session_id: 데이터 세션 ID (작업 디렉토리 결정)

        Returns:
            CodeExecutionResult: 실행 결과
        """
        start_time = time.time()

        # 코드 안전성 검사 (자동 구문 수정 포함)
        validation_error, validated_code = self._validate_code(code)
        if validation_error:
            logger.warning(f"[CODE SANDBOX] Validation failed: {validation_error}")
            return CodeExecutionResult(
                success=False,
                error=f"보안 검증 실패: {validation_error}",
                execution_time_ms=int((time.time() - start_time) * 1000),
            )
        code = validated_code

        session_dir = Path(settings.CODE_SANDBOX_BASE_DIR) / session_id
        if not session_dir.exists():
            return CodeExecutionResult(
                success=False,
                error="세션 디렉토리를 찾을 수 없습니다.",
                execution_time_ms=int((time.time() - start_time) * 1000),
            )

        async with self._semaphore:
            try:
                # 래퍼 스크립트 생성
                script_path = self._create_wrapper_script(code, session_dir)

                # subprocess 실행
                stdout, stderr = await self._run_subprocess(script_path, session_dir)

                # 결과 수집
                result = self._collect_results(session_dir, stdout, stderr)
                result.execution_time_ms = int((time.time() - start_time) * 1000)

                return result

            except asyncio.TimeoutError:
                return CodeExecutionResult(
                    success=False,
                    error=f"코드 실행 시간 초과 ({settings.CODE_SANDBOX_TIMEOUT}초)",
                    execution_time_ms=int((time.time() - start_time) * 1000),
                )
            except Exception as e:
                logger.error(f"[CODE SANDBOX] Execution error: {e}")
                return CodeExecutionResult(
                    success=False,
                    error=f"실행 오류: {str(e)}",
                    execution_time_ms=int((time.time() - start_time) * 1000),
                )

    @staticmethod
    def _try_fix_syntax(code: str) -> Optional[str]:
        """
        일반적인 구문 오류 자동 수정 시도

        LLM이 자주 만드는 괄호 미닫힘, 불완전한 마지막 줄 등을 수정.
        수정된 코드가 ast.parse를 통과하면 반환, 아니면 None.
        """
        # 1. 불완전한 마지막 줄 제거 시도
        lines = code.rstrip().split("\n")
        if lines:
            last_line = lines[-1].strip()
            # 마지막 줄이 연산자/콤마/열린 괄호로 끝나면 불완전한 줄로 판단
            if last_line and last_line[-1] in (",", "+", "-", "*", "/", "(", "[", "{", "\\", ":"):
                trimmed = "\n".join(lines[:-1])
                if trimmed.strip():
                    try:
                        ast.parse(trimmed)
                        logger.info("[CODE SANDBOX] Auto-fix: removed incomplete last line")
                        return trimmed
                    except SyntaxError:
                        pass

        # 2. 괄호/브래킷 자동 닫기
        bracket_map = {"(": ")", "[": "]", "{": "}"}
        close_map = {v: k for k, v in bracket_map.items()}
        stack: list[str] = []

        in_string = False
        string_char = ""
        i = 0
        while i < len(code):
            ch = code[i]

            # 문자열 내부 처리
            if in_string:
                if ch == "\\" and i + 1 < len(code):
                    i += 2
                    continue
                if ch == string_char:
                    # 삼중 따옴표 체크
                    if code[i:i+3] == string_char * 3:
                        in_string = False
                        string_char = ""
                        i += 3
                        continue
                    elif len(string_char) == 1:
                        in_string = False
                        string_char = ""
                i += 1
                continue

            # 문자열 시작 감지
            if ch in ('"', "'"):
                if code[i:i+3] in ('"""', "'''"):
                    in_string = True
                    string_char = code[i:i+3]
                    i += 3
                    continue
                else:
                    in_string = True
                    string_char = ch
                    i += 1
                    continue

            # 주석 무시
            if ch == "#":
                # 줄 끝까지 건너뜀
                while i < len(code) and code[i] != "\n":
                    i += 1
                continue

            if ch in bracket_map:
                stack.append(ch)
            elif ch in close_map:
                if stack and stack[-1] == close_map[ch]:
                    stack.pop()

            i += 1

        if stack:
            # 역순으로 닫힘 괄호 추가
            closing = "".join(bracket_map[b] for b in reversed(stack))
            fixed = code.rstrip() + closing + "\n"
            try:
                ast.parse(fixed)
                logger.info(f"[CODE SANDBOX] Auto-fix: closed {len(stack)} unclosed bracket(s)")
                return fixed
            except SyntaxError:
                pass

        # 3. 마지막 줄 제거 + 괄호 닫기 조합
        if lines and len(lines) > 1:
            trimmed = "\n".join(lines[:-1])
            # trimmed에 대해 다시 괄호 닫기 시도
            stack2: list[str] = []
            in_string2 = False
            string_char2 = ""
            j = 0
            while j < len(trimmed):
                ch2 = trimmed[j]
                if in_string2:
                    if ch2 == "\\" and j + 1 < len(trimmed):
                        j += 2
                        continue
                    if ch2 == string_char2:
                        if trimmed[j:j+3] == string_char2 * 3:
                            in_string2 = False
                            string_char2 = ""
                            j += 3
                            continue
                        elif len(string_char2) == 1:
                            in_string2 = False
                            string_char2 = ""
                    j += 1
                    continue
                if ch2 in ('"', "'"):
                    if trimmed[j:j+3] in ('"""', "'''"):
                        in_string2 = True
                        string_char2 = trimmed[j:j+3]
                        j += 3
                        continue
                    else:
                        in_string2 = True
                        string_char2 = ch2
                        j += 1
                        continue
                if ch2 == "#":
                    while j < len(trimmed) and trimmed[j] != "\n":
                        j += 1
                    continue
                if ch2 in bracket_map:
                    stack2.append(ch2)
                elif ch2 in close_map:
                    if stack2 and stack2[-1] == close_map[ch2]:
                        stack2.pop()
                j += 1

            if stack2:
                closing2 = "".join(bracket_map[b] for b in reversed(stack2))
                fixed2 = trimmed.rstrip() + closing2 + "\n"
                try:
                    ast.parse(fixed2)
                    logger.info(f"[CODE SANDBOX] Auto-fix: removed last line + closed {len(stack2)} bracket(s)")
                    return fixed2
                except SyntaxError:
                    pass

        return None

    def _validate_code(self, code: str) -> tuple[Optional[str], str]:
        """
        AST 기반 코드 안전성 검사 (자동 구문 수정 포함)

        Returns:
            (None, code): 안전함 (code는 원본 또는 자동 수정된 코드)
            (str, code): 위반 사유 (code는 원본)
        """
        try:
            tree = ast.parse(code)
        except SyntaxError as e:
            # 디버그 로깅: 에러 발생 코드의 해당 줄 컨텍스트
            if e.lineno:
                code_lines = code.split("\n")
                start = max(0, e.lineno - 3)
                end = min(len(code_lines), e.lineno + 2)
                context_lines = code_lines[start:end]
                context = "\n".join(f"  {'>' if i + start + 1 == e.lineno else ' '} {i + start + 1}: {line}" for i, line in enumerate(context_lines))
                logger.warning(f"[CODE SANDBOX] SyntaxError at line {e.lineno}: {e.msg}\n{context}")

            # 자동 수정 시도
            fixed = self._try_fix_syntax(code)
            if fixed is not None:
                # 수정된 코드로 보안 검사 계속 진행
                code = fixed
                try:
                    tree = ast.parse(code)
                except SyntaxError as e2:
                    return f"구문 오류: {e2}", code
            else:
                return f"구문 오류: {e}", code

        for node in ast.walk(tree):
            # import 검사
            if isinstance(node, ast.Import):
                for alias in node.names:
                    # 전체 모듈명이 허용 목록에 있으면 통과 (예: os.path)
                    if alias.name in ALLOWED_IMPORTS:
                        continue
                    module_root = alias.name.split(".")[0]
                    if module_root in BLOCKED_IMPORTS:
                        return f"차단된 모듈: {alias.name}", code
                    if module_root not in ALLOWED_IMPORTS:
                        return f"허용되지 않은 모듈: {alias.name}", code

            elif isinstance(node, ast.ImportFrom):
                if node.module:
                    # 전체 모듈명이 허용 목록에 있으면 통과 (예: from os.path import join)
                    if node.module in ALLOWED_IMPORTS:
                        continue
                    module_root = node.module.split(".")[0]
                    if module_root in BLOCKED_IMPORTS:
                        return f"차단된 모듈: {node.module}", code
                    if module_root not in ALLOWED_IMPORTS:
                        return f"허용되지 않은 모듈: {node.module}", code

            # 차단된 함수 호출 검사
            elif isinstance(node, ast.Call):
                if isinstance(node.func, ast.Name):
                    if node.func.id in BLOCKED_CALLS:
                        # open()은 읽기 모드만 허용
                        if node.func.id == "open":
                            # 쓰기 모드 키워드 검사
                            for kw in node.keywords:
                                if kw.arg == "mode" and isinstance(kw.value, ast.Constant):
                                    if any(c in str(kw.value.value) for c in ["w", "a", "x"]):
                                        return "파일 쓰기가 차단되었습니다.", code
                            # 위치 인수로 mode 전달된 경우
                            if len(node.args) >= 2 and isinstance(node.args[1], ast.Constant):
                                if any(c in str(node.args[1].value) for c in ["w", "a", "x"]):
                                    return "파일 쓰기가 차단되었습니다.", code
                        else:
                            return f"차단된 함수: {node.func.id}", code

                elif isinstance(node.func, ast.Attribute):
                    if node.func.attr in {"system", "popen", "exec", "eval", "rmdir", "unlink"}:
                        return f"차단된 메서드: {node.func.attr}", code

        return None, code

    def _create_wrapper_script(self, code: str, session_dir: Path) -> Path:
        """
        리소스 제한 + matplotlib 설정이 포함된 래퍼 스크립트 생성
        """
        script_id = uuid.uuid4().hex[:8]
        script_path = session_dir / f"_exec_{script_id}.py"

        # 출력 이미지 디렉토리
        output_dir = session_dir / "_output"
        output_dir.mkdir(exist_ok=True)

        wrapper = textwrap.dedent(f"""\
            import resource
            import sys
            import warnings
            warnings.filterwarnings('ignore')

            # 메모리 제한 설정
            try:
                mem_limit = {settings.CODE_SANDBOX_MAX_MEMORY_MB} * 1024 * 1024
                resource.setrlimit(resource.RLIMIT_AS, (mem_limit, mem_limit))
            except Exception:
                pass

            # matplotlib 설정 (비대화형 백엔드 + 한글 폰트)
            import matplotlib
            matplotlib.use('Agg')
            import matplotlib.pyplot as plt
            import matplotlib.font_manager as _fm

            # 한글 폰트 설정: 프로젝트 내장 폰트 파일 우선 등록
            _font_path = "{str(Path(__file__).parent.parent / 'fonts' / 'NanumGothic-Regular.ttf').replace(chr(92), '/')}"
            _font_registered = False
            try:
                import os.path as _osp
                if _osp.exists(_font_path):
                    _fm.fontManager.addfont(_font_path)
                    matplotlib.rcParams['font.family'] = 'NanumGothic'
                    # sans-serif fallback 리스트 선두에도 추가 (seaborn 등이 font.family를 리셋해도 한글 유지)
                    _ss = matplotlib.rcParams.get('font.sans-serif', [])
                    if 'NanumGothic' not in _ss:
                        matplotlib.rcParams['font.sans-serif'] = ['NanumGothic'] + list(_ss)
                    _font_registered = True
            except Exception:
                pass

            if not _font_registered:
                # 시스템 폰트 fallback
                _sys_fonts = [f.name for f in _fm.fontManager.ttflist]
                for _font_name in ['NanumGothic', 'Malgun Gothic', 'AppleGothic', 'Noto Sans KR', 'Noto Sans CJK KR']:
                    if _font_name in _sys_fonts:
                        matplotlib.rcParams['font.family'] = _font_name
                        _ss = matplotlib.rcParams.get('font.sans-serif', [])
                        if _font_name not in _ss:
                            matplotlib.rcParams['font.sans-serif'] = [_font_name] + list(_ss)
                        _font_registered = True
                        break
            if not _font_registered:
                matplotlib.rcParams['font.family'] = 'sans-serif'
            matplotlib.rcParams['axes.unicode_minus'] = False

            # 차트 기본 크기 및 레이아웃 설정
            # - 기본 figsize를 충분히 크게 설정하여 subplot에서 축소 방지
            # - constrained_layout으로 라벨/제목 겹침 자동 해소
            matplotlib.rcParams['figure.figsize'] = [12, 8]
            matplotlib.rcParams['figure.constrained_layout.use'] = True

            # seaborn monkey-patch: set_theme/set_style 호출 후 한글 폰트 자동 복원
            def _patch_seaborn_font():
                try:
                    import seaborn as _sns
                    _original_set_theme = _sns.set_theme
                    _original_set_style = _sns.set_style

                    def _restore_korean_font():
                        if _font_registered:
                            _ss = matplotlib.rcParams.get('font.sans-serif', [])
                            if 'NanumGothic' not in _ss:
                                matplotlib.rcParams['font.sans-serif'] = ['NanumGothic'] + list(_ss)
                            elif _ss[0] != 'NanumGothic':
                                _ss.remove('NanumGothic')
                                matplotlib.rcParams['font.sans-serif'] = ['NanumGothic'] + _ss
                            matplotlib.rcParams['axes.unicode_minus'] = False
                        # set_theme()이 리셋한 레이아웃 설정도 복원
                        matplotlib.rcParams['figure.figsize'] = [12, 8]
                        matplotlib.rcParams['figure.constrained_layout.use'] = True

                    def _patched_set_theme(*a, **kw):
                        _original_set_theme(*a, **kw)
                        _restore_korean_font()

                    def _patched_set_style(*a, **kw):
                        _original_set_style(*a, **kw)
                        _restore_korean_font()

                    _sns.set_theme = _patched_set_theme
                    _sns.set_style = _patched_set_style
                except ImportError:
                    pass
            _patch_seaborn_font()

            # 차트 자동 저장 패치
            _original_show = plt.show
            _chart_counter = [0]

            def _patched_show(*args, **kwargs):
                _chart_counter[0] += 1
                save_path = "{str(output_dir).replace(chr(92), '/')}/" + f"chart_{{_chart_counter[0]}}.png"
                plt.savefig(save_path, dpi=150, bbox_inches='tight', facecolor='white')
                plt.close('all')

            plt.show = _patched_show

            # pandas 표시 설정 (DataFrame 출력 시 행/열 잘림 방지)
            import pandas as pd
            pd.set_option('display.max_rows', 200)
            pd.set_option('display.max_columns', 50)
            pd.set_option('display.width', None)
            pd.set_option('display.max_colwidth', 50)

            # stdout 출력 제한
            _output_chars = [0]
            _max_output = {settings.CODE_SANDBOX_MAX_OUTPUT_CHARS}
            _original_write = sys.stdout.write

            def _limited_write(text):
                _output_chars[0] += len(text)
                if _output_chars[0] > _max_output:
                    _original_write("\\n[출력이 최대 길이를 초과하여 잘렸습니다]\\n")
                    sys.exit(0)
                return _original_write(text)

            sys.stdout.write = _limited_write

            # 사용자 코드 실행
        """)

        # 사용자 코드를 들여쓰기 없이 추가
        full_script = wrapper + code + "\n"

        # 마지막에 열려있는 figure 자동 저장
        full_script += textwrap.dedent("""\

            # 미저장 차트 자동 저장
            import matplotlib.pyplot as _plt_final
            if _plt_final.get_fignums():
                for _fig_num in _plt_final.get_fignums():
                    _chart_counter[0] += 1
                    _fig = _plt_final.figure(_fig_num)
                    _save_path = f"{output_dir}/" + f"chart_{_chart_counter[0]}.png"
                    _fig.savefig(_save_path, dpi=150, bbox_inches='tight', facecolor='white')
                _plt_final.close('all')
        """.replace("{output_dir}", str(output_dir).replace("\\", "/")))

        script_path.write_text(full_script, encoding="utf-8")
        return script_path

    async def _run_subprocess(self, script_path: Path, session_dir: Path) -> tuple:
        """
        subprocess로 Python 스크립트 실행

        Returns:
            (stdout, stderr) 튜플
        """
        # 최소 환경변수
        env = {
            "PATH": os.environ.get("PATH", "/usr/bin:/usr/local/bin"),
            "HOME": str(session_dir),
            "LANG": "ko_KR.UTF-8",
            "LC_ALL": "ko_KR.UTF-8",
            "PYTHONIOENCODING": "utf-8",
            "MPLCONFIGDIR": str(session_dir / ".matplotlib"),
        }

        # 가상환경 활성화 경로 추가
        venv_path = Path(__file__).parent.parent / "venv"
        if venv_path.exists():
            env["VIRTUAL_ENV"] = str(venv_path)
            env["PATH"] = f"{venv_path / 'bin'}:{env['PATH']}"
            python_exec = str(venv_path / "bin" / "python")
        else:
            python_exec = "python3"

        process = await asyncio.create_subprocess_exec(
            python_exec, str(script_path),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=str(session_dir),
            env=env,
        )

        try:
            stdout_bytes, stderr_bytes = await asyncio.wait_for(
                process.communicate(),
                timeout=settings.CODE_SANDBOX_TIMEOUT,
            )
        except asyncio.TimeoutError:
            process.kill()
            await process.wait()
            raise

        stdout = stdout_bytes.decode("utf-8", errors="replace")
        stderr = stderr_bytes.decode("utf-8", errors="replace")

        return stdout, stderr

    def _collect_results(self, session_dir: Path, stdout: str, stderr: str) -> CodeExecutionResult:
        """
        실행 결과 수집 (stdout/stderr + 이미지 base64)
        """
        output_dir = session_dir / "_output"
        images: List[str] = []

        # 생성된 이미지 수집
        if output_dir.exists():
            image_files = sorted(output_dir.glob("chart_*.png"))
            for img_path in image_files:
                try:
                    img_bytes = img_path.read_bytes()
                    img_b64 = base64.b64encode(img_bytes).decode("utf-8")
                    images.append(img_b64)
                except Exception as e:
                    logger.warning(f"[CODE SANDBOX] Failed to read image {img_path}: {e}")

        # stderr에서 에러 여부 판단
        has_error = False
        error_msg = None
        if stderr:
            # 심각한 에러만 실패로 처리 (경고는 무시)
            error_lines = [
                line for line in stderr.strip().split("\n")
                if not line.startswith("Warning") and "UserWarning" not in line
                and "FutureWarning" not in line and "DeprecationWarning" not in line
            ]
            if error_lines:
                # Traceback이 있으면 에러
                if any("Traceback" in line or "Error" in line for line in error_lines):
                    has_error = True
                    error_msg = "\n".join(error_lines[-10:])  # 마지막 10줄

        if has_error:
            logger.warning(f"[CODE SANDBOX] Execution failed: {error_msg}")
            return CodeExecutionResult(
                success=False,
                stdout=stdout,
                stderr=stderr,
                images=images,
                error=error_msg,
            )

        return CodeExecutionResult(
            success=True,
            stdout=stdout,
            stderr=stderr,
            images=images,
        )


# 싱글톤 인스턴스
code_sandbox_service = CodeSandboxService()
