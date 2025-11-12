# Qwen3 VL Task Queue 도입 설계

## 구현 현황 (2025-11-12 기준)

| 구성 요소 | 구현 상태 | 비고 |
|---------|---------|------|
| Qwen3 VL 동기 처리 | 완료 | `backend/services/qwen3_service.py` 구현됨 |
| Task Queue 시스템 | 미구현 | arq + Redis 도입 필요 |
| DB 모델 | 미구현 | TaskQueue 테이블 필요 |
| Worker 프로세스 | 미구현 | arq Worker 구현 필요 |
| API 엔드포인트 수정 | 미구현 | `/api/documents/convert` 수정 필요 |
| 환경 변수 | 미구현 | Redis URL, Worker 설정 추가 필요 |

**다음 단계**: Phase 1 Task Queue 기본 구조 구현 (섹션 9 참조)

---

## 문제점 분석

### 현재 구조의 한계

**Docling Service (외부 API가 Async 지원)**
```
클라이언트 → FastAPI → Docling 서버 (task_id 즉시 반환)
                    ↓
              Docling 서버 내부에서
              큐 관리 + 병렬 처리 제어
```
- Docling 서버가 부하를 직접 관리
- 100개 요청이 와도 서버가 내부적으로 순차/병렬 처리

**Qwen3 VL Service (외부 API가 동기 응답만 제공)**
```
현재 방식:
클라이언트 → FastAPI → Qwen3 VL API (완료될 때까지 대기)
- 10페이지 PDF라면 클라이언트가 수 분간 대기
- 타임아웃 위험 높음

BackgroundTasks만 사용할 경우:
클라이언트 → FastAPI (task_id 즉시 반환)
                ↓
         BackgroundTask 1 → Qwen3 VL API 요청 1
         BackgroundTask 2 → Qwen3 VL API 요청 2
         ...
         BackgroundTask 10 → Qwen3 VL API 요청 10
```
- **동시에 10개 요청 → Qwen3 VL 서버로 10개 동시 HTTP 요청 (누적 요청)**
- Qwen3 VL 서버가 갑자기 10배의 부하를 받음
- API 서버 과부하, 타임아웃, 다운 가능성

### 해결 방안: Task Queue 도입

Task Queue를 사용하면:
- **외부 서버 부하 제어**: Worker 수 조절로 동시 요청 수 제한
- **확장성**: Worker를 여러 서버에 분산 가능
- **신뢰성**: 재시도, 에러 핸들링, 작업 이력 관리
- **모니터링**: 큐 길이, Worker 상태 실시간 확인

---

## 아키텍처 개요

```
┌─────────────┐
│  Frontend   │
└──────┬──────┘
       │ HTTP Request (파일 업로드)
       ↓
┌─────────────────────────────────┐
│        FastAPI Server           │
│  ┌──────────────────────────┐  │
│  │ POST /api/documents/     │  │
│  │      convert             │  │
│  │  - 파일을 임시 저장      │  │
│  │  - task_id 즉시 반환    │  │
│  │  - arq.enqueue()        │  │
│  └──────────────────────────┘  │
│  ┌──────────────────────────┐  │
│  │ GET /status/{task_id}    │  │
│  │  - DB에서 상태/진행률 조회│  │
│  └──────────────────────────┘  │
└────────┬────────────────────────┘
         │ enqueue task
         ↓
    ┌─────────┐
    │  Redis  │ (Message Broker & Queue)
    └────┬────┘
         │ dequeue task (rate-limited)
         ↓
┌─────────────────────────┐
│   arq Worker Process    │
│  ┌──────────────────┐   │
│  │ qwen3_convert    │   │
│  │  - 상태: processing│  │
│  │  - 파일 읽기      │   │
│  │  - Qwen3 VL 호출  │   │
│  │  - 진행률 업데이트│   │
│  │  - 결과 저장      │   │
│  │  - 상태: completed│   │
│  └──────────────────┘   │
└────────┬────────────────┘
         │ (최대 1~2개만 동시 처리)
         ↓
    Qwen3 VL API Server
    (부하 제어됨)
```

**핵심 원리:**
- FastAPI는 작업을 Redis Queue에 추가만 함 (즉시 응답)
- arq Worker가 큐에서 순차적으로 작업을 가져와 처리
- Worker 수를 제한하여 외부 API 서버 과부하 방지

---

## 1. Task Queue 시스템 선택

### 선택: arq (Async Redis Queue)

**선택 이유:**
- ✅ 순수 Python AsyncIO 기반 (FastAPI와 완벽 호환)
- ✅ Redis 하나만 필요 (가볍고 간단)
- ✅ 설정이 매우 간단
- ✅ FastAPI와 동일한 async/await 패턴
- ✅ 현재 프로젝트 규모에 적합

**대안 비교:**

| 항목 | arq | Celery | RQ |
|------|-----|--------|-----|
| AsyncIO 지원 | ⭐⭐⭐ 네이티브 | ⭐ 제한적 | ⭐ 약함 |
| 설정 난이도 | ⭐⭐⭐ 간단 | ⭐ 복잡 | ⭐⭐ 보통 |
| 기능 풍부도 | ⭐⭐ 기본 | ⭐⭐⭐ 강력 | ⭐⭐ 기본 |
| 프로젝트 적합성 | ⭐⭐⭐ 최적 | ⭐ 오버킬 | ⭐⭐ 적합 |

---

## 2. 데이터베이스 스키마

**구현 상태: 미생성**

### TaskQueue 테이블
**파일**: `backend/models/task_queue.py` (생성 필요)

```python
from sqlalchemy import Column, Integer, String, DateTime, Text, JSON, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from backend.database import Base

class TaskQueue(Base):
    """작업 큐 테이블 (비동기 작업 관리)"""
    __tablename__ = "task_queue"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(String, unique=True, index=True, nullable=False)
    task_type = Column(String, nullable=False)  # "qwen3-vl", "docling-vlm" 등
    status = Column(String, default="pending", index=True)  # pending, processing, completed, failed

    # 입력 정보
    filename = Column(String, nullable=False)
    file_path = Column(String, nullable=False)  # 임시 저장 경로
    options = Column(JSON)  # 파싱 옵션 (dict 형태)

    # 진행률 정보
    current_page = Column(Integer, default=0)
    total_pages = Column(Integer, default=0)
    progress_percentage = Column(Integer, default=0)  # 0-100

    # 결과 정보
    result_document_id = Column(Integer, ForeignKey("documents.id"), nullable=True)
    error_message = Column(Text, nullable=True)

    # 메타 정보
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    retry_count = Column(Integer, default=0)

    # Worker 정보
    worker_id = Column(String, nullable=True)
    arq_job_id = Column(String, nullable=True)  # arq 내부 job ID

    # Relationship
    result_document = relationship("Document", foreign_keys=[result_document_id])
```

**SQL 스키마 (참고용)**:
```sql
CREATE TABLE task_queue (
    id INTEGER PRIMARY KEY,
    task_id VARCHAR UNIQUE NOT NULL,
    task_type VARCHAR NOT NULL,
    status VARCHAR DEFAULT 'pending',

    filename VARCHAR NOT NULL,
    file_path VARCHAR NOT NULL,
    options TEXT,  -- JSON 문자열

    current_page INTEGER DEFAULT 0,
    total_pages INTEGER DEFAULT 0,
    progress_percentage INTEGER DEFAULT 0,

    result_document_id INTEGER,
    error_message TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    retry_count INTEGER DEFAULT 0,

    worker_id VARCHAR,
    arq_job_id VARCHAR,

    FOREIGN KEY (result_document_id) REFERENCES documents(id)
);

CREATE INDEX idx_task_queue_task_id ON task_queue(task_id);
CREATE INDEX idx_task_queue_status ON task_queue(status);
CREATE INDEX idx_task_queue_created_at ON task_queue(created_at);
```

**Alembic 마이그레이션**: 생성 필요

---

## 3. Backend API Endpoints

### 3.1 문서 변환 (수정 필요)

#### POST `/api/documents/convert`
**현재 상태**: 동기 처리 (`backend/api/routes/document.py:29`)

**변경 내용**:
```python
# 기존: 즉시 Qwen3 VL 호출 → 대기 → 응답
# 변경: 파일 저장 → Queue에 추가 → task_id 즉시 응답
```

**Request** (변경 없음):
```
multipart/form-data
- file: (binary)
- strategy: "qwen3-vl"
- ... (기타 옵션)
```

**Response** (변경):
```json
{
  "task_id": "qwen3-1699876543210",
  "status": "pending",
  "message": "작업이 큐에 추가되었습니다. /api/documents/status/{task_id}로 상태를 확인하세요."
}
```

### 3.2 작업 상태 조회 (신규 또는 확장)

#### GET `/api/documents/status/{task_id}`
**현재 상태**: Docling 전용 구현됨 (`backend/api/routes/document.py:173`)

**확장 내용**: TaskQueue 테이블 조회 추가

**Response**:
```json
{
  "task_id": "qwen3-1699876543210",
  "status": "processing",
  "task_type": "qwen3-vl",
  "filename": "document.pdf",
  "progress": {
    "current_page": 3,
    "total_pages": 10,
    "percentage": 30
  },
  "created_at": "2025-11-12T10:30:00Z",
  "started_at": "2025-11-12T10:30:05Z",
  "estimated_completion": "2025-11-12T10:35:00Z",
  "result_document_id": null,
  "error_message": null
}
```

**상태별 응답**:
- `pending`: 큐 대기 중
- `processing`: Worker가 처리 중
- `completed`: 완료 (result_document_id 포함)
- `failed`: 실패 (error_message 포함)

### 3.3 작업 취소 (Phase 2)

#### DELETE `/api/documents/tasks/{task_id}`
작업 취소 및 임시 파일 삭제

---

## 4. Backend 파일 구조

**구현 상태: 대부분 미생성**

```
backend/
├── main.py                         # FastAPI 앱 (기존)
├── worker.py                       # ⭐ 신규: arq Worker 진입점
├── config/
│   └── settings.py                 # Redis URL, Worker 설정 추가
├── models/
│   ├── document.py                 # 기존
│   ├── schemas.py                  # Pydantic 스키마 추가
│   └── task_queue.py               # ⭐ 신규: TaskQueue 모델
├── services/
│   ├── qwen3_service.py            # 기존 유지 (Worker에서 사용)
│   ├── task_queue_crud.py          # ⭐ 신규: TaskQueue CRUD
│   └── task_worker.py              # ⭐ 신규: arq Worker 함수들
└── api/routes/
    └── document.py                 # ⭐ 수정: convert 엔드포인트 변경
```

**파일별 책임:**
- `worker.py`: arq Worker 설정 및 실행 (WorkerSettings 클래스)
- `task_queue.py`: SQLAlchemy ORM 모델
- `task_queue_crud.py`: TaskQueue 테이블 CRUD 작업
- `task_worker.py`: arq에서 실행될 Worker 함수 정의
- `document.py`: API 엔드포인트 (Queue에 작업 추가)

---

## 5. 환경 변수 설정 (.env)

**구현 상태**: `backend/.env.example`에 추가 필요

```env
# ===========================================
# Task Queue 설정 (arq + Redis)
# ===========================================
# Redis URL (arq 메시지 브로커)
REDIS_URL=redis://localhost:6379/0

# Worker 설정
WORKER_MAX_JOBS=2                   # 동시 처리 가능한 최대 작업 수
WORKER_JOB_TIMEOUT=300              # 작업 타임아웃 (초) - 5분
WORKER_RETRY_ATTEMPTS=3             # 실패 시 재시도 횟수
WORKER_RETRY_DELAY=10               # 재시도 간격 (초)

# 임시 파일 설정
TEMP_UPLOAD_DIR=./temp/uploads      # 임시 파일 저장 경로
TEMP_FILE_RETENTION_HOURS=24        # 임시 파일 보관 시간 (시간)

# 기존 Qwen3 VL 설정 (유지)
QWEN3_VL_BASE_URL=http://kca-ai.kro.kr:8084
QWEN3_VL_MODEL=qwen3-vl-8b
QWEN3_VL_TIMEOUT=120
QWEN3_VL_MAX_PAGES=50
QWEN3_VL_MAX_TOKENS=4096
QWEN3_VL_TEMPERATURE=0.1
QWEN3_VL_OCR_PROMPT=이미지에 있는 모든 텍스트를 정확하게 추출해주세요...
```

**Settings 클래스 추가 필요** (`backend/config/settings.py`):
```python
class Settings(BaseSettings):
    # 기존 설정들...

    # Task Queue 설정
    REDIS_URL: str = "redis://localhost:6379/0"
    WORKER_MAX_JOBS: int = 2
    WORKER_JOB_TIMEOUT: int = 300
    WORKER_RETRY_ATTEMPTS: int = 3
    WORKER_RETRY_DELAY: int = 10

    # 임시 파일 설정
    TEMP_UPLOAD_DIR: str = "./temp/uploads"
    TEMP_FILE_RETENTION_HOURS: int = 24
```

---

## 6. arq Worker 구현

### 6.1 Worker 설정 파일

**파일**: `backend/worker.py` (신규 생성)

```python
"""
arq Worker 진입점
실행: arq backend.worker.WorkerSettings
"""
import asyncio
from arq import create_pool
from arq.connections import RedisSettings
from backend.config.settings import settings
from backend.services.task_worker import qwen3_convert_task, cleanup_old_temp_files

# arq Worker 설정
class WorkerSettings:
    """arq Worker 설정 클래스"""

    # Redis 연결 설정
    redis_settings = RedisSettings.from_dsn(settings.REDIS_URL)

    # Worker 함수 등록
    functions = [
        qwen3_convert_task,      # Qwen3 VL 변환 작업
        cleanup_old_temp_files,  # 임시 파일 정리 (Cron)
    ]

    # Worker 설정
    max_jobs = settings.WORKER_MAX_JOBS        # 동시 처리 제한
    job_timeout = settings.WORKER_JOB_TIMEOUT  # 작업 타임아웃

    # 재시도 설정
    max_tries = settings.WORKER_RETRY_ATTEMPTS

    # Cron 작업 (매일 새벽 2시에 오래된 임시 파일 삭제)
    cron_jobs = [
        # cleanup_old_temp_files를 매일 02:00에 실행
        {'coroutine': cleanup_old_temp_files, 'hour': 2, 'minute': 0}
    ]

    # 로깅
    log_results = True

    # Health check (arq 대시보드용)
    health_check_interval = 60
```

### 6.2 Worker 함수 구현

**파일**: `backend/services/task_worker.py` (신규 생성)

```python
"""
arq Worker 함수들
"""
import os
import time
from datetime import datetime, timedelta
from pathlib import Path
from sqlalchemy.orm import Session

from backend.database import SessionLocal
from backend.services.qwen3_service import qwen3_service
from backend.services import task_queue_crud, document_crud
from backend.models.schemas import DocumentSaveRequest, TaskStatus
from backend.config.settings import settings


async def qwen3_convert_task(ctx: dict, task_id: str, file_path: str, filename: str, options: dict):
    """
    Qwen3 VL 변환 작업 (arq Worker 함수)

    Args:
        ctx: arq 컨텍스트
        task_id: 작업 ID
        file_path: 임시 파일 경로
        filename: 원본 파일명
        options: 파싱 옵션 (dict)
    """
    db: Session = SessionLocal()

    try:
        # 1. 작업 상태 업데이트: processing
        task_queue_crud.update_task_status(
            db,
            task_id,
            status="processing",
            started_at=datetime.utcnow(),
            worker_id=ctx.get('job_id')  # arq job ID
        )

        # 2. 파일 읽기
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"임시 파일을 찾을 수 없습니다: {file_path}")

        with open(file_path, 'rb') as f:
            file_content = f.read()

        # 3. Qwen3 VL 서비스 호출 (진행률 콜백 포함)
        result = await qwen3_service.convert_document(
            file_content=file_content,
            filename=filename,
            progress_callback=lambda current, total: update_progress(db, task_id, current, total)
        )

        # 4. 결과 처리
        if result.status == TaskStatus.SUCCESS:
            # 4-1. Document 테이블에 저장
            save_request = DocumentSaveRequest(
                task_id=task_id,
                original_filename=filename,
                md_content=result.document.md_content,
                processing_time=result.processing_time
            )
            saved_doc = document_crud.create_document(db, save_request)

            # 4-2. TaskQueue 완료 상태 업데이트
            task_queue_crud.update_task_status(
                db,
                task_id,
                status="completed",
                completed_at=datetime.utcnow(),
                result_document_id=saved_doc.id,
                progress_percentage=100
            )

            # 4-3. 임시 파일 삭제
            os.remove(file_path)

        else:
            # 실패 처리
            task_queue_crud.update_task_status(
                db,
                task_id,
                status="failed",
                completed_at=datetime.utcnow(),
                error_message=result.error
            )

    except Exception as e:
        # 예외 처리
        task_queue_crud.update_task_status(
            db,
            task_id,
            status="failed",
            completed_at=datetime.utcnow(),
            error_message=f"Worker 오류: {str(e)}"
        )
        # 재시도를 위해 예외를 다시 발생
        raise

    finally:
        db.close()


def update_progress(db: Session, task_id: str, current_page: int, total_pages: int):
    """진행률 업데이트 헬퍼 함수"""
    percentage = int((current_page / total_pages) * 100) if total_pages > 0 else 0
    task_queue_crud.update_task_progress(
        db,
        task_id,
        current_page=current_page,
        total_pages=total_pages,
        progress_percentage=percentage
    )
    db.commit()


async def cleanup_old_temp_files(ctx: dict):
    """
    오래된 임시 파일 정리 (Cron 작업)
    매일 새벽 2시 실행
    """
    temp_dir = Path(settings.TEMP_UPLOAD_DIR)
    if not temp_dir.exists():
        return

    cutoff_time = datetime.utcnow() - timedelta(hours=settings.TEMP_FILE_RETENTION_HOURS)

    deleted_count = 0
    for file_path in temp_dir.glob("*"):
        if file_path.is_file():
            file_mtime = datetime.fromtimestamp(file_path.stat().st_mtime)
            if file_mtime < cutoff_time:
                file_path.unlink()
                deleted_count += 1

    print(f"[Cleanup] 삭제된 임시 파일: {deleted_count}개")
```

---

## 7. 작업 플로우

### Phase 1: 요청 접수 (FastAPI)

**파일**: `backend/api/routes/document.py` (수정)

```
1. POST /api/documents/convert (strategy="qwen3-vl")
   ├─ multipart 파일 수신
   ├─ 파일을 임시 디렉토리에 저장
   │   경로: {TEMP_UPLOAD_DIR}/{task_id}_{filename}
   ├─ TaskQueue 테이블에 레코드 생성 (status="pending")
   │   └─ task_id, filename, file_path, options 저장
   ├─ arq.enqueue("qwen3_convert_task", task_id, file_path, filename, options)
   │   └─ Redis Queue에 작업 추가
   └─ 즉시 응답: { task_id, status="pending", message }
```

### Phase 2: 백그라운드 처리 (arq Worker)

```
Worker가 Redis Queue에서 작업 가져옴 (rate-limited)
   ├─ DB에서 TaskQueue 조회
   ├─ status → "processing" 업데이트
   ├─ started_at, worker_id 기록
   ├─ 파일 읽기
   ├─ qwen3_service.convert_document() 실행
   │   ├─ PDF → 이미지 변환
   │   ├─ 각 페이지 OCR 처리
   │   │   └─ 페이지 처리할 때마다 progress 업데이트 (DB)
   │   └─ 마크다운 통합
   ├─ 성공 시:
   │   ├─ Document 테이블에 결과 저장
   │   ├─ TaskQueue.result_document_id 업데이트
   │   ├─ status → "completed"
   │   ├─ progress_percentage → 100
   │   └─ 임시 파일 삭제
   └─ 실패 시:
       ├─ TaskQueue.error_message 저장
       ├─ status → "failed"
       └─ retry_count < MAX_RETRY이면 arq가 자동 재시도
```

### Phase 3: 상태 조회 (Frontend)

```
Frontend가 주기적으로 폴링 (1~2초 간격)
   ↓
GET /api/documents/status/{task_id}
   ├─ TaskQueue 테이블 조회
   ├─ 응답:
   │   {
   │     task_id,
   │     status: "pending" | "processing" | "completed" | "failed",
   │     progress: {
   │       current_page: 3,
   │       total_pages: 10,
   │       percentage: 30
   │     },
   │     result_document_id: (완료 시),
   │     error_message: (실패 시)
   │   }
   └─ status="completed"이면 Document 조회 가능
```

---

## 8. Pydantic Schemas

**파일**: `backend/models/schemas.py` (추가 필요)

```python
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

# Task Queue 관련
class TaskQueueCreate(BaseModel):
    task_id: str
    task_type: str
    filename: str
    file_path: str
    options: dict

class TaskProgress(BaseModel):
    current_page: int
    total_pages: int
    percentage: int

class TaskStatusResponse(BaseModel):
    task_id: str
    status: str  # pending, processing, completed, failed
    task_type: str
    filename: str
    progress: Optional[TaskProgress] = None
    created_at: str
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    estimated_completion: Optional[str] = None
    result_document_id: Optional[int] = None
    error_message: Optional[str] = None

class TaskEnqueueResponse(BaseModel):
    task_id: str
    status: str
    message: str
```

---

## 9. Python 라이브러리

**구현 상태**: `backend/requirements.txt`에 추가 필요

```txt
# Task Queue (arq + Redis)
arq>=0.26.0            # Async Redis Queue
redis>=5.0.0           # Redis 클라이언트 (arq 의존성)

# 기존 패키지 (유지)
fastapi>=0.115.0
uvicorn[standard]>=0.32.0
httpx>=0.27.2
sqlalchemy>=2.0.36
# ... 기타
```

**설치 명령**:
```bash
pip install arq redis
```

---

## 10. 실행 방법

### 개발 환경

**Terminal 1: Redis 서버 실행**
```bash
# Docker 사용
docker run -p 6379:6379 redis:alpine

# 또는 로컬 Redis 설치 후
redis-server
```

**Terminal 2: FastAPI 서버 실행**
```bash
cd backend
python -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

**Terminal 3: arq Worker 실행**
```bash
# backend/ 디렉토리에서
arq backend.worker.WorkerSettings

# 또는 여러 Worker 실행 (부하 분산)
arq backend.worker.WorkerSettings --burst  # 큐가 비면 종료
```

**Terminal 4: Frontend 실행**
```bash
npm run dev
```

### 프로덕션 환경

**Systemd 서비스 설정** (`/etc/systemd/system/docling-worker.service`):
```ini
[Unit]
Description=Docling arq Worker
After=network.target redis.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/docling-app
Environment="PATH=/var/www/docling-app/backend/venv/bin"
ExecStart=/var/www/docling-app/backend/venv/bin/arq backend.worker.WorkerSettings
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

**실행**:
```bash
sudo systemctl enable docling-worker
sudo systemctl start docling-worker
sudo systemctl status docling-worker
```

**또는 Supervisor 사용**:
```ini
[program:docling-worker]
command=/var/www/docling-app/backend/venv/bin/arq backend.worker.WorkerSettings
directory=/var/www/docling-app
user=www-data
numprocs=2                    # Worker 프로세스 2개
process_name=%(program_name)s_%(process_num)02d
autostart=true
autorestart=true
stdout_logfile=/var/log/docling-worker.log
stderr_logfile=/var/log/docling-worker-error.log
```

---

## 11. 모니터링 및 관리

### Redis Queue 모니터링

**Redis CLI로 큐 상태 확인**:
```bash
redis-cli

# 큐 길이 확인
LLEN arq:queue

# 진행 중인 작업 확인
ZRANGE arq:in-progress 0 -1

# 결과 확인
KEYS arq:result:*
```

### arq 대시보드 (선택적)

arq는 기본 대시보드를 제공하지 않지만, Redis 모니터링 도구 사용 가능:
- **RedisInsight**: GUI 기반 Redis 관리 도구
- **redis-commander**: 웹 기반 Redis 관리

### 로그 모니터링

```bash
# Worker 로그 확인
journalctl -u docling-worker -f

# 또는 Supervisor 로그
tail -f /var/log/docling-worker.log
```

### DB 쿼리로 작업 상태 확인

```sql
-- 대기 중인 작업
SELECT COUNT(*) FROM task_queue WHERE status='pending';

-- 처리 중인 작업
SELECT task_id, filename, current_page, total_pages
FROM task_queue
WHERE status='processing';

-- 최근 완료된 작업
SELECT task_id, filename, completed_at
FROM task_queue
WHERE status='completed'
ORDER BY completed_at DESC
LIMIT 10;

-- 실패한 작업
SELECT task_id, filename, error_message
FROM task_queue
WHERE status='failed';
```

---

## 12. Frontend 수정 사항

**파일**: `app/parse/page.tsx` (수정 필요)

### 변경 사항

**기존 방식**:
```typescript
// 업로드 후 즉시 결과 받음
const result = await response.json();
setResults(prev => [...prev, result]);
```

**Task Queue 방식**:
```typescript
// 1. 업로드 → task_id 받음
const uploadResult = await response.json();
const { task_id } = uploadResult;

// 2. 상태 폴링 시작
const pollInterval = setInterval(async () => {
  const statusRes = await fetch(`/api/documents/status/${task_id}`);
  const status = await statusRes.json();

  // 진행률 업데이트
  updateProgress(task_id, status.progress);

  // 완료/실패 시 폴링 중지
  if (status.status === 'completed') {
    clearInterval(pollInterval);
    setResults(prev => [...prev, status]);
  } else if (status.status === 'failed') {
    clearInterval(pollInterval);
    setErrors(prev => [...prev, status]);
  }
}, 2000); // 2초마다 폴링
```

### UI 개선사항

1. **진행률 표시**:
   - 각 파일별 Progress Bar 추가
   - "페이지 3/10 처리 중..." 텍스트 표시

2. **상태 뱃지**:
   - 대기 중: 회색 뱃지
   - 처리 중: 파란색 뱃지 + 스피너
   - 완료: 녹색 체크 아이콘
   - 실패: 빨간색 X 아이콘

3. **취소 버튼** (Phase 2):
   - 처리 중인 작업 취소 기능

---

## 13. 구현 우선순위

### Phase 1: 핵심 Task Queue 구조 (1-2주)
**목표**: Qwen3 VL을 Task Queue로 전환하여 외부 서버 부하 제어

1. **의존성 설치**
   - arq, redis 패키지 추가
   - requirements.txt 업데이트

2. **환경 변수 설정**
   - `backend/config/settings.py`에 Redis, Worker 설정 추가
   - `backend/.env.example` 업데이트

3. **데이터베이스**
   - TaskQueue 모델 생성 (`backend/models/task_queue.py`)
   - Alembic 마이그레이션 작성 및 실행
   - task_queue_crud.py 구현

4. **Worker 구현**
   - `backend/worker.py` 작성 (WorkerSettings)
   - `backend/services/task_worker.py` 작성 (qwen3_convert_task)

5. **API 수정**
   - `backend/api/routes/document.py` 수정
     - POST `/convert` → Queue에 작업 추가
     - GET `/status/{task_id}` → TaskQueue 조회 추가

6. **테스트**
   - Redis 서버 실행 확인
   - Worker 실행 확인
   - 파일 업로드 → Queue 추가 → Worker 처리 → 결과 확인

### Phase 2: 고급 기능 (1주)
1. **Frontend 개선**
   - 진행률 표시 UI
   - 폴링 로직 구현
   - 상태 뱃지, Progress Bar

2. **작업 관리**
   - 작업 취소 API
   - 작업 목록 조회 API (대시보드용)

3. **에러 핸들링**
   - 재시도 로직 개선
   - 상세 에러 메시지

### Phase 3: 최적화 및 모니터링 (1주)
1. **성능 최적화**
   - Worker 수 동적 조절
   - 우선순위 큐 도입 (급한 작업 우선 처리)

2. **모니터링 대시보드**
   - 큐 길이, Worker 상태 실시간 표시
   - 작업 이력 통계

3. **임시 파일 관리**
   - Cron 작업으로 오래된 파일 자동 삭제
   - 디스크 사용량 모니터링

4. **프로덕션 배포**
   - Systemd/Supervisor 설정
   - 로그 로테이션
   - Health check 엔드포인트

---

## 14. 장점 요약

### 외부 서버 보호
- ✅ Qwen3 VL 서버로의 동시 요청 수 제한 (WORKER_MAX_JOBS=2)
- ✅ 과부하 방지, 안정적인 서비스 운영

### 사용자 경험 개선
- ✅ 즉시 응답 (긴 대기 시간 없음)
- ✅ 실시간 진행률 표시
- ✅ Docling과 동일한 async UX

### 시스템 안정성
- ✅ 재시도 로직 (일시적 오류 대응)
- ✅ 에러 추적 및 로깅
- ✅ Worker 프로세스 격리 (크래시 시 FastAPI는 정상 동작)

### 확장성
- ✅ Worker를 여러 서버에 분산 가능
- ✅ 부하에 따라 Worker 수 조절 가능
- ✅ Redis Cluster로 확장 가능

### 운영 효율성
- ✅ 작업 이력 관리 (재처리, 분석 가능)
- ✅ 모니터링 및 대시보드
- ✅ Cron 작업으로 유지보수 자동화

---

## 15. 참고 자료

**기존 코드**:
- Qwen3 VL 서비스: `backend/services/qwen3_service.py`
- Docling 서비스: `backend/services/docling_service.py` (async 패턴 참고)
- Document 모델: `backend/models/document.py`
- API 라우트: `backend/api/routes/document.py`

**외부 문서**:
- [arq Documentation](https://arq-docs.helpmanual.io/)
- [Redis Documentation](https://redis.io/docs/)
- [FastAPI Background Tasks](https://fastapi.tiangolo.com/tutorial/background-tasks/) (비교용)
- [SQLAlchemy ORM](https://docs.sqlalchemy.org/en/20/)

**내부 서버**:
- Qwen3 VL API: `http://kca-ai.kro.kr:8084`
- Redis (설치 필요): `localhost:6379`

**관련 디자인 문서**:
- Qdrant 통합: `docs/qdrant-integration-design.md` (유사한 비동기 패턴)

---

## 16. 주의사항 및 Best Practices

### 임시 파일 관리
- ⚠️ 작업 완료 후 반드시 임시 파일 삭제
- ⚠️ 실패한 작업의 임시 파일도 정기적으로 정리 (Cron)
- ⚠️ 디스크 용량 모니터링 필수

### Worker 안정성
- ⚠️ Worker 크래시 대비: Systemd/Supervisor로 자동 재시작
- ⚠️ OOM 방지: 메모리 사용량 모니터링
- ⚠️ 타임아웃 설정: 너무 긴 작업은 강제 종료

### Redis 관리
- ⚠️ Redis 메모리 제한 설정 (maxmemory)
- ⚠️ Redis 데이터 백업 (RDB/AOF)
- ⚠️ Redis 연결 실패 시 Graceful Degradation

### 보안
- ⚠️ 임시 파일 권한 설정 (다른 사용자 접근 금지)
- ⚠️ Redis 인증 설정 (프로덕션 환경)
- ⚠️ 파일명 검증 (Path Traversal 방지)

### 성능
- ⚠️ Worker 수는 Qwen3 VL 서버 성능에 맞춰 조절
- ⚠️ Redis 메모리 부족 시 큐 크기 제한
- ⚠️ 큰 파일은 chunk 단위로 처리 고려
