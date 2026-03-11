"""
DataSessionService - Code Interpreter 데이터 세션 관리

Excel/CSV 파일을 파싱하여 세션으로 관리하고,
LLM에 전달할 데이터 컨텍스트를 생성합니다.
"""
import logging
import os
import shutil
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional

import pandas as pd

from backend.config.settings import settings

logger = logging.getLogger("uvicorn")


@dataclass
class SheetMetadata:
    """시트 메타데이터"""
    name: str
    rows: int
    columns: int
    column_names: List[str]
    column_types: List[str]
    null_ratios: List[float]
    sample_values: List[List[str]]
    header_row: int = 0  # 실제 헤더 행 번호 (pandas read 시 사용)


@dataclass
class DataSession:
    """데이터 분석 세션"""
    session_id: str
    filename: str
    file_size: int
    session_dir: str
    file_path: str
    sheets: List[SheetMetadata]
    created_at: float = field(default_factory=time.time)


class DataSessionService:
    """데이터 세션 관리 서비스"""

    def __init__(self):
        self._sessions: Dict[str, DataSession] = {}
        self._base_dir = Path(settings.CODE_SANDBOX_BASE_DIR)

    def _detect_header_row(self, df_raw: pd.DataFrame, max_scan_rows: int = 20) -> int:
        """
        "Unnamed" 컬럼이 많은 경우, 실제 헤더 행을 자동 탐지

        Args:
            df_raw: header=None으로 읽은 DataFrame
            max_scan_rows: 탐색할 최대 행 수

        Returns:
            int: 헤더로 추정되는 행 번호 (0-indexed)
        """
        scan_limit = min(max_scan_rows, len(df_raw))
        best_row = 0
        best_score = -1

        for row_idx in range(scan_limit):
            row = df_raw.iloc[row_idx]
            non_null = row.dropna()
            if len(non_null) == 0:
                continue

            # 점수 계산: 비-null 셀 수, 문자열 비율, 고유값 비율
            str_count = sum(1 for v in non_null if isinstance(v, str) and len(str(v).strip()) > 0)
            unique_ratio = len(non_null.unique()) / max(len(non_null), 1)
            non_null_ratio = len(non_null) / max(len(row), 1)

            # "Unnamed" 패턴이 없어야 함
            unnamed_count = sum(1 for v in non_null if isinstance(v, str) and "unnamed" in str(v).lower())

            score = (
                str_count * 2  # 문자열 셀이 많을수록 좋음
                + unique_ratio * len(row)  # 고유값 비율
                + non_null_ratio * len(row)  # 비-null 비율
                - unnamed_count * 5  # "unnamed" 패턴 패널티
            )

            if score > best_score:
                best_score = score
                best_row = row_idx

        return best_row

    def _has_unnamed_columns(self, df: pd.DataFrame, threshold: float = 0.3) -> bool:
        """컬럼명에 'Unnamed' 패턴이 threshold 비율 이상인지 확인"""
        if len(df.columns) == 0:
            return False
        unnamed_count = sum(1 for c in df.columns if "Unnamed" in str(c))
        return (unnamed_count / len(df.columns)) >= threshold

    def _read_with_header_detection(
        self, file_path: Path, sheet_name: str = None, is_csv: bool = False
    ) -> tuple:
        """
        헤더 자동 탐지를 포함한 파일 읽기

        Returns:
            (DataFrame, header_row): 파싱된 DataFrame과 사용된 헤더 행 번호
        """
        # 1차: 기본 읽기
        if is_csv:
            df = pd.read_csv(file_path)
        else:
            df = pd.read_excel(file_path, sheet_name=sheet_name)

        # "Unnamed" 컬럼이 많지 않으면 그대로 반환
        if not self._has_unnamed_columns(df):
            return df, 0

        logger.info(f"[DATA SESSION] Detected 'Unnamed' columns, scanning for header row...")

        # 2차: header=None으로 다시 읽어 실제 헤더 탐지
        if is_csv:
            df_raw = pd.read_csv(file_path, header=None)
        else:
            df_raw = pd.read_excel(file_path, sheet_name=sheet_name, header=None)

        header_row = self._detect_header_row(df_raw)
        logger.info(f"[DATA SESSION] Detected header at row {header_row}")

        # 3차: 탐지된 헤더로 다시 읽기
        if is_csv:
            df = pd.read_csv(file_path, header=header_row)
        else:
            df = pd.read_excel(file_path, sheet_name=sheet_name, header=header_row)

        # 여전히 "Unnamed" 컬럼이 있으면 해당 컬럼 제거
        unnamed_cols = [c for c in df.columns if "Unnamed" in str(c)]
        if unnamed_cols:
            df = df.drop(columns=unnamed_cols)
            logger.info(f"[DATA SESSION] Dropped {len(unnamed_cols)} unnamed columns")

        # 완전히 빈 행 제거
        df = df.dropna(how="all").reset_index(drop=True)

        return df, header_row

    async def upload_excel(self, content: bytes, filename: str) -> DataSession:
        """
        Excel/CSV 파일을 파싱하여 세션 생성

        Args:
            content: 파일 바이너리 내용
            filename: 원본 파일명

        Returns:
            DataSession: 생성된 세션 정보
        """
        session_id = str(uuid.uuid4())
        session_dir = self._base_dir / session_id
        session_dir.mkdir(parents=True, exist_ok=True)

        # 파일 저장
        file_path = session_dir / filename
        file_path.write_bytes(content)
        logger.info(f"[DATA SESSION] File saved: {file_path} ({len(content)} bytes)")

        # 파일 파싱
        file_ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
        sheets_metadata: List[SheetMetadata] = []

        try:
            if file_ext == "csv":
                df, header_row = self._read_with_header_detection(file_path, is_csv=True)
                sheets_metadata.append(self._extract_sheet_metadata("Sheet1", df, header_row))
            else:
                # Excel 파일: 모든 시트 파싱
                excel_file = pd.ExcelFile(file_path)
                for sheet_name in excel_file.sheet_names:
                    df, header_row = self._read_with_header_detection(
                        file_path, sheet_name=sheet_name, is_csv=False
                    )
                    if df.empty:
                        continue
                    # 최대 행수 제한
                    if len(df) > settings.DATA_UPLOAD_MAX_ROWS:
                        df = df.head(settings.DATA_UPLOAD_MAX_ROWS)
                        logger.warning(
                            f"[DATA SESSION] Sheet '{sheet_name}' truncated to "
                            f"{settings.DATA_UPLOAD_MAX_ROWS} rows"
                        )
                    sheets_metadata.append(self._extract_sheet_metadata(sheet_name, df, header_row))

            if not sheets_metadata:
                raise ValueError("파일에 유효한 데이터 시트가 없습니다.")

        except Exception as e:
            # 실패 시 정리
            shutil.rmtree(session_dir, ignore_errors=True)
            raise ValueError(f"파일 파싱 실패: {e}")

        session = DataSession(
            session_id=session_id,
            filename=filename,
            file_size=len(content),
            session_dir=str(session_dir),
            file_path=str(file_path),
            sheets=sheets_metadata,
        )
        self._sessions[session_id] = session

        logger.info(
            f"[DATA SESSION] Session created: {session_id}, "
            f"file={filename}, sheets={len(sheets_metadata)}"
        )
        return session

    def _extract_sheet_metadata(self, sheet_name: str, df: pd.DataFrame, header_row: int = 0) -> SheetMetadata:
        """DataFrame에서 시트 메타데이터 추출"""
        column_names = [str(c) for c in df.columns]
        column_types = [str(df[c].dtype) for c in df.columns]

        # null 비율
        null_ratios = [
            round(float(df[c].isna().mean()), 3)
            for c in df.columns
        ]

        # 샘플 값 (각 컬럼별 최대 3개, non-null)
        sample_values: List[List[str]] = []
        for col in df.columns:
            non_null = df[col].dropna()
            samples = [str(v) for v in non_null.head(3).tolist()]
            sample_values.append(samples)

        return SheetMetadata(
            name=sheet_name,
            rows=len(df),
            columns=len(df.columns),
            column_names=column_names,
            column_types=column_types,
            null_ratios=null_ratios,
            sample_values=sample_values,
            header_row=header_row,
        )

    def get_data_context(self, session_id: str) -> str:
        """
        LLM 프롬프트용 데이터 컨텍스트 문자열 생성

        Args:
            session_id: 세션 ID

        Returns:
            str: 데이터 요약 텍스트 (파일경로, 시트정보, 컬럼/타입/null비율/샘플값, head)
        """
        session = self._sessions.get(session_id)
        if not session:
            raise ValueError(f"세션을 찾을 수 없습니다: {session_id}")

        # 파일 로드 명령 생성 (header_row가 0이 아닌 경우 포함)
        file_ext = session.filename.rsplit(".", 1)[-1].lower() if "." in session.filename else ""
        first_sheet = session.sheets[0] if session.sheets else None
        h_row = first_sheet.header_row if first_sheet else 0

        if file_ext == "csv":
            if h_row > 0:
                load_cmd = f'pd.read_csv("{session.file_path}", header={h_row})'
            else:
                load_cmd = f'pd.read_csv("{session.file_path}")'
        else:
            if h_row > 0:
                load_cmd = f'pd.read_excel("{session.file_path}", header={h_row})'
            else:
                load_cmd = f'pd.read_excel("{session.file_path}")'

        parts = [
            f"## 데이터 파일 정보",
            f"- 파일 경로: {session.file_path}",
            f"- 파일명: {session.filename}",
            f"- 시트 수: {len(session.sheets)}",
            f"- 파일 로드 명령: `df = {load_cmd}`",
            "",
        ]

        for sheet in session.sheets:
            parts.append(f"### 시트: {sheet.name} ({sheet.rows}행 x {sheet.columns}열)")
            parts.append("")
            parts.append("| 컬럼명 | 타입 | Null 비율 | 샘플 값 |")
            parts.append("|--------|------|-----------|---------|")

            for i, col_name in enumerate(sheet.column_names):
                col_type = sheet.column_types[i]
                null_pct = f"{sheet.null_ratios[i] * 100:.1f}%"
                samples = ", ".join(sheet.sample_values[i][:3]) if sheet.sample_values[i] else "-"
                # 샘플 값이 너무 길면 잘라냄
                if len(samples) > 60:
                    samples = samples[:57] + "..."
                parts.append(f"| {col_name} | {col_type} | {null_pct} | {samples} |")

            parts.append("")

            # head(3) - pandas로 파일 다시 읽기 (탐지된 header_row 사용)
            try:
                file_ext = session.filename.rsplit(".", 1)[-1].lower()
                h_row = sheet.header_row
                if file_ext == "csv":
                    df = pd.read_csv(session.file_path, header=h_row, nrows=3)
                else:
                    df = pd.read_excel(session.file_path, sheet_name=sheet.name, header=h_row, nrows=3)

                # "Unnamed" 컬럼 제거
                unnamed_cols = [c for c in df.columns if "Unnamed" in str(c)]
                if unnamed_cols:
                    df = df.drop(columns=unnamed_cols)

                parts.append("#### 데이터 미리보기 (상위 3행)")
                parts.append(df.to_markdown(index=False))
                parts.append("")

                # describe()
                if file_ext == "csv":
                    df_full = pd.read_csv(session.file_path, header=h_row)
                else:
                    df_full = pd.read_excel(session.file_path, sheet_name=sheet.name, header=h_row)
                if unnamed_cols:
                    unnamed_full = [c for c in df_full.columns if "Unnamed" in str(c)]
                    if unnamed_full:
                        df_full = df_full.drop(columns=unnamed_full)
                desc = df_full.describe(include="all")
                parts.append("#### 통계 요약 (describe)")
                parts.append(desc.to_markdown())
                parts.append("")
            except Exception as e:
                logger.warning(f"[DATA SESSION] Failed to generate preview for {sheet.name}: {e}")

        return "\n".join(parts)

    def get_session(self, session_id: str) -> Optional[DataSession]:
        """세션 조회"""
        return self._sessions.get(session_id)

    def get_session_dir(self, session_id: str) -> Optional[str]:
        """세션 디렉토리 경로 조회"""
        session = self._sessions.get(session_id)
        return session.session_dir if session else None

    def delete_session(self, session_id: str) -> bool:
        """세션 삭제 및 파일 정리"""
        session = self._sessions.pop(session_id, None)
        if not session:
            return False

        try:
            shutil.rmtree(session.session_dir, ignore_errors=True)
            logger.info(f"[DATA SESSION] Session deleted: {session_id}")
        except Exception as e:
            logger.error(f"[DATA SESSION] Failed to cleanup session dir: {e}")

        return True

    async def cleanup_expired(self) -> int:
        """만료된 세션 정리"""
        now = time.time()
        ttl = settings.CODE_SANDBOX_SESSION_TTL
        expired = [
            sid for sid, session in self._sessions.items()
            if now - session.created_at > ttl
        ]

        for sid in expired:
            self.delete_session(sid)

        if expired:
            logger.info(f"[DATA SESSION] Cleaned up {len(expired)} expired sessions")

        return len(expired)


# 싱글톤 인스턴스
data_session_service = DataSessionService()
