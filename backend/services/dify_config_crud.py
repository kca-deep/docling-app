"""
Dify 설정 CRUD 함수
"""
from sqlalchemy.orm import Session
from typing import List, Optional
from backend.models.dify_config import DifyConfig
from datetime import datetime, timezone


def create_config(
    db: Session,
    config_name: str,
    api_key: str,
    base_url: str,
    default_dataset_id: Optional[str] = None,
    default_dataset_name: Optional[str] = None,
    description: Optional[str] = None
) -> DifyConfig:
    """
    새로운 Dify 설정 생성

    Args:
        db: DB 세션
        config_name: 설정 이름
        api_key: Dify API 키
        base_url: Dify API Base URL
        default_dataset_id: 기본 데이터셋 ID
        default_dataset_name: 기본 데이터셋 이름
        description: 설명

    Returns:
        DifyConfig: 생성된 설정
    """
    db_config = DifyConfig(
        config_name=config_name,
        api_key_encrypted=api_key,  # TODO: 실제로는 암호화 필요
        base_url=base_url,
        default_dataset_id=default_dataset_id,
        default_dataset_name=default_dataset_name,
        description=description,
        is_active=True
    )
    db.add(db_config)
    db.commit()
    db.refresh(db_config)
    return db_config


def get_config_by_id(db: Session, config_id: int) -> Optional[DifyConfig]:
    """
    ID로 설정 조회

    Args:
        db: DB 세션
        config_id: 설정 ID

    Returns:
        Optional[DifyConfig]: 설정 또는 None
    """
    return db.query(DifyConfig).filter(DifyConfig.id == config_id).first()


def get_config_by_name(db: Session, config_name: str) -> Optional[DifyConfig]:
    """
    이름으로 설정 조회

    Args:
        db: DB 세션
        config_name: 설정 이름

    Returns:
        Optional[DifyConfig]: 설정 또는 None
    """
    return db.query(DifyConfig).filter(DifyConfig.config_name == config_name).first()


def get_all_configs(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    active_only: bool = False
) -> List[DifyConfig]:
    """
    모든 설정 조회

    Args:
        db: DB 세션
        skip: 건너뛸 개수
        limit: 최대 개수
        active_only: 활성 설정만 조회할지 여부

    Returns:
        List[DifyConfig]: 설정 목록
    """
    query = db.query(DifyConfig)
    if active_only:
        query = query.filter(DifyConfig.is_active == True)
    return query.order_by(DifyConfig.last_used_at.desc(), DifyConfig.created_at.desc()).offset(skip).limit(limit).all()


def get_active_config(db: Session) -> Optional[DifyConfig]:
    """
    가장 최근에 사용한 활성 설정 조회

    Args:
        db: DB 세션

    Returns:
        Optional[DifyConfig]: 설정 또는 None
    """
    return db.query(DifyConfig).filter(
        DifyConfig.is_active == True
    ).order_by(
        DifyConfig.last_used_at.desc(),
        DifyConfig.created_at.desc()
    ).first()


def update_config(
    db: Session,
    config_id: int,
    api_key: Optional[str] = None,
    base_url: Optional[str] = None,
    default_dataset_id: Optional[str] = None,
    default_dataset_name: Optional[str] = None,
    description: Optional[str] = None,
    is_active: Optional[bool] = None
) -> Optional[DifyConfig]:
    """
    설정 업데이트

    Args:
        db: DB 세션
        config_id: 설정 ID
        api_key: Dify API 키
        base_url: Dify API Base URL
        default_dataset_id: 기본 데이터셋 ID
        default_dataset_name: 기본 데이터셋 이름
        description: 설명
        is_active: 활성 여부

    Returns:
        Optional[DifyConfig]: 업데이트된 설정 또는 None
    """
    db_config = get_config_by_id(db, config_id)
    if not db_config:
        return None

    if api_key is not None:
        db_config.api_key_encrypted = api_key  # TODO: 실제로는 암호화 필요
    if base_url is not None:
        db_config.base_url = base_url
    if default_dataset_id is not None:
        db_config.default_dataset_id = default_dataset_id
    if default_dataset_name is not None:
        db_config.default_dataset_name = default_dataset_name
    if description is not None:
        db_config.description = description
    if is_active is not None:
        db_config.is_active = is_active

    db_config.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(db_config)
    return db_config


def update_last_used(db: Session, config_id: int) -> Optional[DifyConfig]:
    """
    설정의 마지막 사용 시간 업데이트

    Args:
        db: DB 세션
        config_id: 설정 ID

    Returns:
        Optional[DifyConfig]: 업데이트된 설정 또는 None
    """
    db_config = get_config_by_id(db, config_id)
    if not db_config:
        return None

    db_config.last_used_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(db_config)
    return db_config


def delete_config(db: Session, config_id: int) -> bool:
    """
    설정 삭제

    Args:
        db: DB 세션
        config_id: 설정 ID

    Returns:
        bool: 삭제 성공 여부
    """
    db_config = get_config_by_id(db, config_id)
    if not db_config:
        return False

    db.delete(db_config)
    db.commit()
    return True
