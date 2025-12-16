"""
Database configuration and session management
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base
from sqlalchemy.orm import sessionmaker
from backend.config.settings import settings

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


def init_db():
    """
    데이터베이스 초기화 (테이블 생성)
    앱 시작 시 호출
    """
    Base.metadata.create_all(bind=engine)
