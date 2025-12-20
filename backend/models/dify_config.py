"""
Dify Configuration SQLAlchemy Model (Optional)
사용자별 Dify 설정을 저장하기 위한 테이블
"""
from sqlalchemy import Column, Integer, String, DateTime, Boolean
from backend.database import Base
from backend.utils.timezone import now_naive


class DifyConfig(Base):
    """Dify 설정 테이블 (선택적)"""
    __tablename__ = "dify_config"

    # 기본 정보
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)

    # 설정 이름 (사용자가 여러 설정을 저장할 수 있도록)
    config_name = Column(String(100), nullable=False, unique=True, index=True)

    # Dify API 설정
    # 주의: API Key는 암호화하여 저장하는 것이 권장됩니다
    # 현재는 평문으로 저장하지만, 실제 운영에서는 암호화 필요
    api_key_encrypted = Column(String(500), nullable=False)
    base_url = Column(String(255), default="https://api.dify.ai/v1", nullable=False)

    # 자주 사용하는 데이터셋 (선택적)
    default_dataset_id = Column(String(100), nullable=True)
    default_dataset_name = Column(String(255), nullable=True)

    # 활성 여부
    is_active = Column(Boolean, default=True, nullable=False)

    # 메타데이터
    description = Column(String(500), nullable=True)

    # 타임스탬프
    created_at = Column(DateTime, default=now_naive, nullable=False, index=True)
    updated_at = Column(DateTime, default=now_naive, onupdate=now_naive, nullable=False)
    last_used_at = Column(DateTime, nullable=True)

    def __repr__(self):
        return f"<DifyConfig(id={self.id}, name={self.config_name}, active={self.is_active})>"
