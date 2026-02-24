"""
컬렉션 통합 마이그레이션 스크립트

5개 컬렉션을 kca-reguration으로 통합:
- kca-admin (기관공통)
- kca-welfare-all (복리후생)
- kca-research (연구사업)
- kca-hr-all (인사/복무)
- kca-finance (재무회계)

사용법:
    python -m scripts.merge_collections [--dry-run] [--skip-deactivate]

옵션:
    --dry-run           실제 실행 없이 통합 계획만 출력
    --skip-deactivate   기존 컬렉션 비활성화 건너뛰기
"""
import argparse
import asyncio
import json
import logging
import sys
import time
from pathlib import Path

# 프로젝트 루트를 sys.path에 추가
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from qdrant_client import AsyncQdrantClient, models
from backend.config.settings import settings
from backend.database import SessionLocal

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

# ========================================
# 설정
# ========================================
TARGET_COLLECTION = "kca-reguration"
SOURCE_COLLECTIONS = [
    "kca-admin",
    "kca-welfare-all",
    "kca-research",
    "kca-hr-all",
    "kca-finance",
]
VECTOR_SIZE = 1024
DISTANCE = models.Distance.COSINE
BATCH_SIZE = 100  # upsert 배치 크기

# 통합 컬렉션 DB 메타데이터
TARGET_METADATA = json.dumps({
    "koreanName": "KCA 규정통합",
    "icon": "Landmark",
    "keywords": [
        "인사", "복무", "급여", "복지", "연구비",
        "예산", "회계", "정관", "시설", "징계",
    ],
    "priority": 1,
    "category": "general",
}, ensure_ascii=False)


async def get_client() -> AsyncQdrantClient:
    """Qdrant 클라이언트 생성"""
    return AsyncQdrantClient(
        url=settings.QDRANT_URL,
        api_key=settings.QDRANT_API_KEY,
        timeout=60.0,
    )


async def analyze_sources(client: AsyncQdrantClient) -> dict:
    """소스 컬렉션 분석"""
    analysis = {}
    total_points = 0

    for name in SOURCE_COLLECTIONS:
        try:
            exists = await client.collection_exists(name)
            if not exists:
                logger.warning(f"  [{name}] 존재하지 않음 - 건너뜀")
                analysis[name] = {"exists": False, "points": 0}
                continue

            info = await client.get_collection(name)
            points = info.points_count or 0
            total_points += points
            analysis[name] = {"exists": True, "points": points}
            logger.info(f"  [{name}] {points} chunks")
        except Exception as e:
            logger.error(f"  [{name}] 분석 실패: {e}")
            analysis[name] = {"exists": False, "points": 0, "error": str(e)}

    analysis["_total"] = total_points
    return analysis


async def create_target_collection(client: AsyncQdrantClient) -> bool:
    """타겟 컬렉션 생성"""
    exists = await client.collection_exists(TARGET_COLLECTION)
    if exists:
        logger.warning(f"  '{TARGET_COLLECTION}' 이미 존재합니다.")
        info = await client.get_collection(TARGET_COLLECTION)
        if info.points_count and info.points_count > 0:
            logger.error(
                f"  '{TARGET_COLLECTION}'에 이미 {info.points_count}개 포인트가 있습니다. "
                f"기존 데이터 보호를 위해 중단합니다."
            )
            return False
        logger.info(f"  '{TARGET_COLLECTION}' 비어있음 - 재사용")
        return True

    # 컬렉션 생성
    await client.create_collection(
        collection_name=TARGET_COLLECTION,
        vectors_config=models.VectorParams(
            size=VECTOR_SIZE,
            distance=DISTANCE,
        ),
    )
    logger.info(f"  '{TARGET_COLLECTION}' 컬렉션 생성 완료")

    # 인덱스 생성: document_id (facet API 지원)
    try:
        await client.create_payload_index(
            collection_name=TARGET_COLLECTION,
            field_name="document_id",
            field_schema=models.PayloadSchemaType.INTEGER,
            field_index_params=models.IntegerIndexParams(
                type=models.IntegerIndexType.INTEGER,
                lookup=True,
                range=False,
            ),
        )
        logger.info("  document_id 인덱스 생성")
    except Exception as e:
        logger.warning(f"  document_id 인덱스 생성 실패 (비치명적): {e}")

    # 인덱스 생성: source_collection (필터링용)
    try:
        await client.create_payload_index(
            collection_name=TARGET_COLLECTION,
            field_name="source_collection",
            field_schema=models.PayloadSchemaType.KEYWORD,
        )
        logger.info("  source_collection 인덱스 생성")
    except Exception as e:
        logger.warning(f"  source_collection 인덱스 생성 실패 (비치명적): {e}")

    return True


async def migrate_collection(
    client: AsyncQdrantClient,
    source_name: str,
) -> int:
    """단일 컬렉션의 모든 포인트를 타겟으로 복사"""
    migrated = 0
    offset = None

    while True:
        # scroll로 포인트 읽기 (벡터 포함)
        results, next_offset = await client.scroll(
            collection_name=source_name,
            limit=BATCH_SIZE,
            offset=offset,
            with_payload=True,
            with_vectors=True,
        )

        if not results:
            break

        # 포인트 변환: source_collection 메타데이터 추가
        points = []
        for point in results:
            payload = dict(point.payload) if point.payload else {}
            payload["source_collection"] = source_name

            points.append(
                models.PointStruct(
                    id=point.id,
                    vector=point.vector,
                    payload=payload,
                )
            )

        # upsert
        await client.upsert(
            collection_name=TARGET_COLLECTION,
            points=points,
            wait=True,
        )

        migrated += len(points)

        if next_offset is None:
            break
        offset = next_offset

    return migrated


def create_db_metadata():
    """SQLite에 통합 컬렉션 메타데이터 생성"""
    from backend.models.qdrant_collection import QdrantCollection
    from backend.utils.timezone import now_naive

    db = SessionLocal()
    try:
        # 기존 메타데이터 확인
        existing = db.query(QdrantCollection).filter(
            QdrantCollection.collection_name == TARGET_COLLECTION
        ).first()

        if existing:
            logger.info(f"  DB 메타데이터 이미 존재 - description 업데이트")
            existing.description = TARGET_METADATA
            existing.visibility = "public"
        else:
            # admin 사용자 ID 조회 (owner_id 필요)
            from backend.models.user import User
            admin = db.query(User).filter(User.username == "admin").first()
            owner_id = admin.id if admin else 1

            new_collection = QdrantCollection(
                collection_name=TARGET_COLLECTION,
                owner_id=owner_id,
                visibility="public",
                description=TARGET_METADATA,
                allowed_users=[],
            )
            db.add(new_collection)
            logger.info(f"  DB 메타데이터 생성 (owner_id={owner_id})")

        db.commit()
        return True
    except Exception as e:
        db.rollback()
        logger.error(f"  DB 메타데이터 생성 실패: {e}")
        return False
    finally:
        db.close()


def deactivate_source_collections():
    """기존 소스 컬렉션을 private으로 변경 (프론트엔드에서 숨김)"""
    from backend.models.qdrant_collection import QdrantCollection

    db = SessionLocal()
    try:
        for name in SOURCE_COLLECTIONS:
            collection = db.query(QdrantCollection).filter(
                QdrantCollection.collection_name == name
            ).first()
            if collection:
                collection.visibility = "private"
                logger.info(f"  [{name}] visibility -> private")
            else:
                logger.warning(f"  [{name}] DB 메타데이터 없음")

        db.commit()
        return True
    except Exception as e:
        db.rollback()
        logger.error(f"  비활성화 실패: {e}")
        return False
    finally:
        db.close()


async def verify_migration(client: AsyncQdrantClient, expected_total: int) -> bool:
    """마이그레이션 검증"""
    info = await client.get_collection(TARGET_COLLECTION)
    actual = info.points_count or 0

    if actual == expected_total:
        logger.info(f"  검증 성공: {actual}/{expected_total} 포인트")
        return True
    else:
        logger.error(f"  검증 실패: 예상 {expected_total}, 실제 {actual}")
        return False


async def main():
    parser = argparse.ArgumentParser(description="컬렉션 통합 마이그레이션")
    parser.add_argument("--dry-run", action="store_true", help="실제 실행 없이 분석만")
    parser.add_argument("--skip-deactivate", action="store_true", help="기존 컬렉션 비활성화 건너뛰기")
    args = parser.parse_args()

    logger.info("=" * 60)
    logger.info("컬렉션 통합 마이그레이션")
    logger.info(f"  소스: {', '.join(SOURCE_COLLECTIONS)}")
    logger.info(f"  타겟: {TARGET_COLLECTION}")
    logger.info("=" * 60)

    # 1. Qdrant 연결
    logger.info("\n[1/6] Qdrant 연결...")
    client = await get_client()

    # 2. 소스 분석
    logger.info("\n[2/6] 소스 컬렉션 분석...")
    analysis = await analyze_sources(client)
    total_expected = analysis["_total"]
    logger.info(f"  총 마이그레이션 대상: {total_expected} chunks")

    if total_expected == 0:
        logger.error("  마이그레이션할 데이터가 없습니다.")
        await client.close()
        return

    if args.dry_run:
        logger.info("\n[DRY-RUN] 분석 완료. 실제 마이그레이션은 수행하지 않습니다.")
        await client.close()
        return

    # 3. 타겟 컬렉션 생성
    logger.info(f"\n[3/6] 타겟 컬렉션 '{TARGET_COLLECTION}' 생성...")
    success = await create_target_collection(client)
    if not success:
        await client.close()
        return

    # 4. 데이터 마이그레이션
    logger.info("\n[4/6] 데이터 마이그레이션...")
    start_time = time.time()
    total_migrated = 0

    for source_name in SOURCE_COLLECTIONS:
        if not analysis.get(source_name, {}).get("exists", False):
            continue

        expected = analysis[source_name]["points"]
        logger.info(f"  [{source_name}] {expected} chunks 마이그레이션 중...")
        migrated = await migrate_collection(client, source_name)
        total_migrated += migrated
        logger.info(f"  [{source_name}] {migrated}/{expected} 완료")

    elapsed = time.time() - start_time
    logger.info(f"  마이그레이션 완료: {total_migrated} chunks ({elapsed:.1f}초)")

    # 5. 검증
    logger.info("\n[5/6] 마이그레이션 검증...")
    verified = await verify_migration(client, total_expected)
    await client.close()

    if not verified:
        logger.error("  검증 실패 - DB 메타데이터 생성을 건너뜁니다.")
        return

    # 6. DB 메타데이터 및 비활성화
    logger.info("\n[6/6] DB 메타데이터 업데이트...")
    create_db_metadata()

    if not args.skip_deactivate:
        logger.info("\n  기존 컬렉션 비활성화 (visibility -> private)...")
        deactivate_source_collections()
    else:
        logger.info("\n  기존 컬렉션 비활성화 건너뜀 (--skip-deactivate)")

    # 완료
    logger.info("\n" + "=" * 60)
    logger.info("마이그레이션 완료!")
    logger.info(f"  통합 컬렉션: {TARGET_COLLECTION}")
    logger.info(f"  총 chunks: {total_migrated}")
    logger.info(f"  소요 시간: {elapsed:.1f}초")
    logger.info("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
