"""
Alembic 마이그레이션 환경 설정
SQLite 배치 모드 지원
"""
import sys
from pathlib import Path
from logging.config import fileConfig

from sqlalchemy import engine_from_config
from sqlalchemy import pool

from alembic import context

# backend 디렉토리를 sys.path에 추가
backend_dir = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(backend_dir))

# 설정 및 모델 import
from backend.config.settings import settings
from backend.database import Base

# 모든 모델을 import하여 metadata에 등록
from backend.models.document import Document
from backend.models.user import User
from backend.models.chat_session import ChatSession
from backend.models.chat_statistics import ChatStatistics
from backend.models.qdrant_collection import QdrantCollection
from backend.models.qdrant_upload_history import QdrantUploadHistory
from backend.models.dify_config import DifyConfig
from backend.models.dify_upload_history import DifyUploadHistory

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# DATABASE_URL을 환경변수에서 가져와 설정
# SQLite 상대경로인 경우 프로젝트 루트 기준으로 절대경로 변환
database_url = settings.DATABASE_URL
if database_url.startswith("sqlite:///./"):
    # 프로젝트 루트 디렉토리 (backend의 상위)
    project_root = Path(__file__).resolve().parent.parent.parent
    db_filename = database_url.replace("sqlite:///./", "")
    database_url = f"sqlite:///{project_root / db_filename}"

config.set_main_option("sqlalchemy.url", database_url)

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# add your model's MetaData object here
# for 'autogenerate' support
target_metadata = Base.metadata

# other values from the config, defined by the needs of env.py,
# can be acquired:
# my_important_option = config.get_main_option("my_important_option")
# ... etc.


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        render_as_batch=True,  # SQLite 배치 모드 지원
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.

    """
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            render_as_batch=True,  # SQLite 배치 모드 지원
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
