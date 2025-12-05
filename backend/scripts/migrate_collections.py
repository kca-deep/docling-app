"""
기존 Qdrant 컬렉션을 SQLite로 마이그레이션하는 스크립트

기존에 Qdrant에만 존재하던 컬렉션 메타데이터를 SQLite에 등록합니다.
- visibility="public"으로 설정 (하위 호환성)
- admin 사용자를 소유자로 지정
- 이미 등록된 컬렉션은 건너뜀 (멱등성 보장)
"""
import logging
from sqlalchemy.orm import Session
from backend.services.qdrant_service import QdrantService
from backend.services import collection_crud
from backend.models.user import User
from backend.config.settings import settings

logger = logging.getLogger(__name__)


async def migrate_existing_collections(db: Session) -> dict:
    """
    기존 Qdrant 컬렉션을 SQLite로 마이그레이션

    Args:
        db: SQLAlchemy 세션

    Returns:
        마이그레이션 결과 {
            "total": int,
            "migrated": int,
            "skipped": int,
            "errors": int,
            "details": list
        }
    """
    result = {
        "total": 0,
        "migrated": 0,
        "skipped": 0,
        "errors": 0,
        "details": []
    }

    try:
        # 1. admin 사용자 조회 (기존 컬렉션의 소유자로 지정)
        admin_user = db.query(User).filter(User.role == "admin").first()
        if not admin_user:
            logger.warning("Admin user not found. Using default owner_id=1")
            admin_user_id = 1
        else:
            admin_user_id = admin_user.id

        # 2. Qdrant에서 모든 컬렉션 조회
        try:
            qdrant_service = QdrantService(
                url=settings.QDRANT_URL,
                api_key=settings.QDRANT_API_KEY
            )
            qdrant_collections = await qdrant_service.get_collections()
        except Exception as e:
            logger.error(f"Failed to get collections from Qdrant: {e}")
            result["errors"] = 1
            result["details"].append(f"Qdrant connection failed: {str(e)}")
            return result

        result["total"] = len(qdrant_collections)

        # 3. 각 컬렉션을 SQLite에 등록
        for col in qdrant_collections:
            try:
                # 이미 존재하는지 확인
                existing = collection_crud.get_by_name(db, col.name)

                if existing:
                    result["skipped"] += 1
                    result["details"].append(f"Skipped (already exists): {col.name}")
                    continue

                # 새로 등록
                collection_crud.create_collection(
                    db=db,
                    collection_name=col.name,
                    owner_id=admin_user_id,
                    visibility="public",  # 기존 컬렉션은 public으로 (하위 호환)
                    description=f"Migrated from Qdrant ({col.vectors_count} vectors)"
                )

                result["migrated"] += 1
                result["details"].append(f"Migrated: {col.name}")
                logger.info(f"Migrated collection: {col.name}")

            except Exception as e:
                result["errors"] += 1
                result["details"].append(f"Error migrating {col.name}: {str(e)}")
                logger.error(f"Failed to migrate collection {col.name}: {e}")

        return result

    except Exception as e:
        logger.error(f"Migration failed: {e}")
        result["errors"] += 1
        result["details"].append(f"Migration error: {str(e)}")
        return result


async def run_migration_if_needed(db: Session) -> bool:
    """
    마이그레이션 필요 여부를 확인하고 실행

    Args:
        db: SQLAlchemy 세션

    Returns:
        마이그레이션 실행 여부
    """
    # SQLite에 등록된 컬렉션 수 확인
    existing_count = len(collection_crud.get_all_collections(db))

    try:
        # Qdrant 컬렉션 수 확인
        qdrant_service = QdrantService(
            url=settings.QDRANT_URL,
            api_key=settings.QDRANT_API_KEY
        )
        qdrant_collections = await qdrant_service.get_collections()
        qdrant_count = len(qdrant_collections)
    except Exception as e:
        logger.warning(f"Cannot check Qdrant collections: {e}")
        return False

    # SQLite에 등록된 컬렉션이 Qdrant보다 적으면 마이그레이션 필요
    if existing_count < qdrant_count:
        logger.info(f"Migration needed: SQLite has {existing_count}, Qdrant has {qdrant_count}")
        result = await migrate_existing_collections(db)
        logger.info(f"Migration result: {result['migrated']} migrated, {result['skipped']} skipped, {result['errors']} errors")
        return result["migrated"] > 0

    logger.debug(f"No migration needed: SQLite has {existing_count}, Qdrant has {qdrant_count}")
    return False
