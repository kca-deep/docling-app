"""
Database configuration and session management
"""
import logging

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import declarative_base
from sqlalchemy.orm import sessionmaker
from backend.config.settings import settings

logger = logging.getLogger(__name__)

# SQLite 엔진 생성
# check_same_thread=False: FastAPI의 비동기 요청 처리를 위해 필요
engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False},
    echo=False  # True로 설정하면 SQL 쿼리 로그 출력
)

# 세션 팩토리
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base 클래스 (모든 모델이 상속)
Base = declarative_base()


def get_db():
    """
    FastAPI Dependency로 사용할 DB 세션 제공

    Usage:
        @app.get("/items")
        def read_items(db: Session = Depends(get_db)):
            ...
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _ensure_columns():
    """create_all은 기존 테이블에 컬럼을 추가하지 않으므로,
    신규 추가된 컬럼을 멱등적으로 ALTER TABLE로 보강한다 (SQLite).

    구조: {테이블: [(컬럼명, 컬럼 DDL), ...]}
    """
    pending = {
        "showcase_items": [
            ("image_urls", "image_urls JSON"),
        ],
    }
    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())
    with engine.begin() as conn:
        for table, columns in pending.items():
            if table not in existing_tables:
                continue  # create_all이 새 컬럼 포함해 생성함
            present = {c["name"] for c in inspector.get_columns(table)}
            for name, ddl in columns:
                if name not in present:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {ddl}"))
                    logger.info(f"[init_db] Added missing column {table}.{name}")


def init_db():
    """
    데이터베이스 초기화 (테이블 생성)
    앱 시작 시 호출
    """
    Base.metadata.create_all(bind=engine)
    _ensure_columns()
