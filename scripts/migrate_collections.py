#!/usr/bin/env python3
"""
Qdrant 컬렉션 통합 마이그레이션 스크립트

Option A: 대분류 통합 (15개 → 9개 컬렉션)

통합 계획:
- kca-hr-all = kca-hr + kca-attendance + kca-discipline + kca-employment
- kca-welfare-all = kca-welfare + kca-compensation
- kca-admin = kca-document + kca-foundation + kca-facilities

유지 컬렉션:
- kca-finance, kca-audit, kca-research
- kca-ict-reguration, kca-cert-domain-faq, gov-ai-security

사용법:
    # 시뮬레이션 모드 (실제 변경 없음)
    python scripts/migrate_collections.py --dry-run

    # 실제 마이그레이션 실행
    python scripts/migrate_collections.py --execute

    # 롤백
    python scripts/migrate_collections.py --rollback
"""

import asyncio
import argparse
import json
import logging
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple

# 프로젝트 루트를 path에 추가
sys.path.insert(0, str(Path(__file__).parent.parent))

from qdrant_client import AsyncQdrantClient, models
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from backend.config.settings import settings

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(f'migration_{datetime.now().strftime("%Y%m%d_%H%M%S")}.log')
    ]
)
logger = logging.getLogger(__name__)


# ============================================================================
# 마이그레이션 설정
# ============================================================================

MIGRATION_PLAN = {
    'kca-hr-all': {
        'sources': ['kca-hr', 'kca-attendance', 'kca-discipline', 'kca-employment'],
        'korean_name': '인사/복무 통합',
        'icon': 'Users',
        'keywords': ['인사', '채용', '승진', '평가', '휴가', '연차', '복무', '출퇴근', '징계', '고용'],
        'description': '인사관리, 복무규정, 징계, 고용형태 관련 규정을 통합한 컬렉션',
    },
    'kca-welfare-all': {
        'sources': ['kca-welfare', 'kca-compensation'],
        'korean_name': '복리후생 통합',
        'icon': 'Gift',
        'keywords': ['복지', '급여', '수당', '여비', '연금', '교육', '복리후생'],
        'description': '복리후생, 보수급여 관련 규정을 통합한 컬렉션',
    },
    'kca-admin': {
        'sources': ['kca-document', 'kca-foundation', 'kca-facilities'],
        'korean_name': '관리업무 통합',
        'icon': 'Building',
        'keywords': ['문서', '정관', '조직', '시설', '장비', '정보공개', '정보보안'],
        'description': '문서관리, 기본법규, 시설장비 관련 규정을 통합한 컬렉션',
    },
}

# 유지할 컬렉션 (변경 없음)
KEEP_COLLECTIONS = [
    'kca-finance',
    'kca-audit',
    'kca-research',
    'kca-ict-reguration',
    'kca-cert-domain-faq',
    'gov-ai-security',
]

# 삭제/비활성화할 컬렉션 (마이그레이션 후)
DEPRECATED_COLLECTIONS = [
    'kca-hr', 'kca-attendance', 'kca-discipline', 'kca-employment',
    'kca-welfare', 'kca-compensation',
    'kca-document', 'kca-foundation', 'kca-facilities',
]


# ============================================================================
# Qdrant 마이그레이션
# ============================================================================

class QdrantMigrator:
    """Qdrant 컬렉션 마이그레이션 클래스"""

    def __init__(self, dry_run: bool = True):
        self.dry_run = dry_run
        self.client: Optional[AsyncQdrantClient] = None
        self.stats = {
            'collections_created': 0,
            'points_copied': 0,
            'errors': [],
        }

    async def connect(self):
        """Qdrant 클라이언트 연결"""
        self.client = AsyncQdrantClient(
            url=settings.QDRANT_URL,
            api_key=settings.QDRANT_API_KEY,
            timeout=120.0
        )
        logger.info(f"Qdrant 연결: {settings.QDRANT_URL}")

    async def close(self):
        """Qdrant 클라이언트 연결 종료"""
        if self.client:
            await self.client.close()

    async def get_collection_info(self, collection_name: str) -> Optional[dict]:
        """컬렉션 정보 조회"""
        try:
            info = await self.client.get_collection(collection_name)
            return {
                'points_count': info.points_count,
                'vector_size': info.config.params.vectors.size,
                'distance': str(info.config.params.vectors.distance),
            }
        except Exception as e:
            logger.warning(f"컬렉션 조회 실패 [{collection_name}]: {e}")
            return None

    async def create_collection(self, collection_name: str) -> bool:
        """새 컬렉션 생성"""
        if self.dry_run:
            logger.info(f"[DRY-RUN] 컬렉션 생성: {collection_name}")
            return True

        try:
            # 이미 존재하는지 확인
            exists = await self.client.collection_exists(collection_name)
            if exists:
                logger.warning(f"컬렉션이 이미 존재함: {collection_name}")
                return False

            # 컬렉션 생성
            await self.client.create_collection(
                collection_name=collection_name,
                vectors_config=models.VectorParams(
                    size=1024,  # BGE-M3 벡터 크기
                    distance=models.Distance.COSINE
                )
            )

            # document_id 인덱스 생성 (facet API 지원)
            await self.client.create_payload_index(
                collection_name=collection_name,
                field_name="document_id",
                field_schema=models.PayloadSchemaType.INTEGER,
            )

            logger.info(f"컬렉션 생성 완료: {collection_name}")
            self.stats['collections_created'] += 1
            return True

        except Exception as e:
            logger.error(f"컬렉션 생성 실패 [{collection_name}]: {e}")
            self.stats['errors'].append(f"create_collection({collection_name}): {e}")
            return False

    async def copy_points(
        self,
        source_collection: str,
        target_collection: str,
        batch_size: int = 100
    ) -> int:
        """원본 컬렉션에서 타겟 컬렉션으로 포인트 복사"""

        if self.dry_run:
            info = await self.get_collection_info(source_collection)
            if info:
                logger.info(f"[DRY-RUN] 포인트 복사: {source_collection} -> {target_collection} ({info['points_count']}포인트)")
                return info['points_count']
            return 0

        copied_count = 0
        offset = None

        try:
            while True:
                # 포인트 조회 (벡터 포함)
                results, next_offset = await self.client.scroll(
                    collection_name=source_collection,
                    limit=batch_size,
                    offset=offset,
                    with_payload=True,
                    with_vectors=True
                )

                if not results:
                    break

                # 메타데이터에 원본 컬렉션 정보 추가
                points = []
                for point in results:
                    payload = dict(point.payload) if point.payload else {}
                    payload['source_collection'] = source_collection

                    points.append(models.PointStruct(
                        id=point.id,
                        vector=point.vector,
                        payload=payload
                    ))

                # 타겟 컬렉션에 upsert
                await self.client.upsert(
                    collection_name=target_collection,
                    points=points,
                    wait=True
                )

                copied_count += len(points)
                logger.debug(f"  복사 진행: {copied_count}포인트 ({source_collection} -> {target_collection})")

                if next_offset is None:
                    break
                offset = next_offset

            logger.info(f"포인트 복사 완료: {source_collection} -> {target_collection} ({copied_count}포인트)")
            self.stats['points_copied'] += copied_count
            return copied_count

        except Exception as e:
            logger.error(f"포인트 복사 실패 [{source_collection} -> {target_collection}]: {e}")
            self.stats['errors'].append(f"copy_points({source_collection}->{target_collection}): {e}")
            return copied_count

    async def set_collection_visibility(self, collection_name: str, visibility: str = 'private'):
        """컬렉션 비활성화 (실제로는 DB 메타데이터만 변경)"""
        if self.dry_run:
            logger.info(f"[DRY-RUN] 컬렉션 비활성화: {collection_name} -> {visibility}")
            return

        # Qdrant 자체에는 visibility 개념이 없으므로 DB에서 처리
        logger.info(f"컬렉션 비활성화 대상: {collection_name}")

    async def delete_collection(self, collection_name: str) -> bool:
        """컬렉션 삭제"""
        if self.dry_run:
            logger.info(f"[DRY-RUN] 컬렉션 삭제: {collection_name}")
            return True

        try:
            await self.client.delete_collection(collection_name)
            logger.info(f"컬렉션 삭제 완료: {collection_name}")
            return True
        except Exception as e:
            logger.error(f"컬렉션 삭제 실패 [{collection_name}]: {e}")
            return False

    async def migrate(self) -> dict:
        """전체 Qdrant 마이그레이션 실행"""
        logger.info("=" * 60)
        logger.info("Qdrant 컬렉션 마이그레이션 시작")
        logger.info("=" * 60)

        await self.connect()

        try:
            for target_name, config in MIGRATION_PLAN.items():
                logger.info(f"\n[{target_name}] 마이그레이션 시작")

                # 1. 타겟 컬렉션 생성
                if not self.dry_run:
                    created = await self.create_collection(target_name)
                    if not created:
                        # 이미 존재하면 스킵하거나 오류 처리
                        existing = await self.get_collection_info(target_name)
                        if existing:
                            logger.warning(f"  기존 컬렉션 사용: {target_name} ({existing['points_count']}포인트)")
                else:
                    logger.info(f"[DRY-RUN] 컬렉션 생성: {target_name}")

                # 2. 소스 컬렉션에서 포인트 복사
                total_copied = 0
                for source_name in config['sources']:
                    copied = await self.copy_points(source_name, target_name)
                    total_copied += copied

                logger.info(f"[{target_name}] 완료: 총 {total_copied}포인트")

            # 3. 원본 컬렉션 비활성화 (선택적)
            if not self.dry_run:
                logger.info("\n원본 컬렉션 비활성화...")
                for coll in DEPRECATED_COLLECTIONS:
                    await self.set_collection_visibility(coll, 'private')

        finally:
            await self.close()

        return self.stats


# ============================================================================
# SQLite 마이그레이션
# ============================================================================

class SQLiteMigrator:
    """SQLite 메타데이터 마이그레이션 클래스"""

    def __init__(self, dry_run: bool = True):
        self.dry_run = dry_run
        self.engine = create_engine(settings.DATABASE_URL)
        self.stats = {
            'collections_created': 0,
            'upload_history_migrated': 0,
            'collections_deprecated': 0,
            'errors': [],
        }

    def create_new_collections(self) -> int:
        """신규 컬렉션 메타데이터 생성"""
        created = 0

        with self.engine.connect() as conn:
            for target_name, config in MIGRATION_PLAN.items():
                # 이미 존재하는지 확인
                result = conn.execute(text(
                    "SELECT id FROM qdrant_collections WHERE collection_name = :name"
                ), {'name': target_name})

                if result.fetchone():
                    logger.warning(f"이미 존재하는 메타데이터: {target_name}")
                    continue

                # description JSON 생성
                description = json.dumps({
                    'koreanName': config['korean_name'],
                    'icon': config['icon'],
                    'keywords': config['keywords'],
                }, ensure_ascii=False)

                if self.dry_run:
                    logger.info(f"[DRY-RUN] 컬렉션 메타데이터 생성: {target_name}")
                else:
                    conn.execute(text("""
                        INSERT INTO qdrant_collections
                        (collection_name, owner_id, visibility, description, allowed_users, created_at, updated_at)
                        VALUES (:name, :owner_id, :visibility, :description, :allowed_users, :created_at, :updated_at)
                    """), {
                        'name': target_name,
                        'owner_id': 1,  # admin
                        'visibility': 'public',
                        'description': description,
                        'allowed_users': '[]',
                        'created_at': datetime.now(),
                        'updated_at': datetime.now(),
                    })
                    conn.commit()
                    logger.info(f"컬렉션 메타데이터 생성: {target_name}")

                created += 1

        self.stats['collections_created'] = created
        return created

    def migrate_upload_history(self) -> int:
        """업로드 이력 마이그레이션"""
        migrated = 0

        # 컬렉션 매핑 생성
        collection_mapping = {}
        for target_name, config in MIGRATION_PLAN.items():
            for source in config['sources']:
                collection_mapping[source] = target_name

        with self.engine.connect() as conn:
            for old_name, new_name in collection_mapping.items():
                if self.dry_run:
                    # 영향받는 레코드 수 확인
                    result = conn.execute(text(
                        "SELECT COUNT(*) FROM qdrant_upload_history WHERE collection_name = :name"
                    ), {'name': old_name})
                    count = result.fetchone()[0]
                    logger.info(f"[DRY-RUN] 업로드 이력 마이그레이션: {old_name} -> {new_name} ({count}건)")
                    migrated += count
                else:
                    result = conn.execute(text("""
                        UPDATE qdrant_upload_history
                        SET collection_name = :new_name
                        WHERE collection_name = :old_name
                    """), {'old_name': old_name, 'new_name': new_name})
                    conn.commit()

                    updated = result.rowcount
                    logger.info(f"업로드 이력 마이그레이션: {old_name} -> {new_name} ({updated}건)")
                    migrated += updated

        self.stats['upload_history_migrated'] = migrated
        return migrated

    def deprecate_old_collections(self) -> int:
        """기존 컬렉션 비활성화"""
        deprecated = 0

        with self.engine.connect() as conn:
            for coll in DEPRECATED_COLLECTIONS:
                if self.dry_run:
                    logger.info(f"[DRY-RUN] 컬렉션 비활성화: {coll}")
                else:
                    result = conn.execute(text("""
                        UPDATE qdrant_collections
                        SET visibility = 'private', updated_at = :updated_at
                        WHERE collection_name = :name
                    """), {'name': coll, 'updated_at': datetime.now()})
                    conn.commit()

                    if result.rowcount > 0:
                        logger.info(f"컬렉션 비활성화: {coll}")
                        deprecated += 1

        self.stats['collections_deprecated'] = deprecated
        return deprecated

    def migrate_chat_sessions(self, update_references: bool = False) -> int:
        """채팅 세션의 컬렉션 참조 업데이트 (선택적)"""
        if not update_references:
            logger.info("채팅 세션 참조 업데이트 스킵 (기존 로그 보존)")
            return 0

        migrated = 0
        collection_mapping = {}
        for target_name, config in MIGRATION_PLAN.items():
            for source in config['sources']:
                collection_mapping[source] = target_name

        with self.engine.connect() as conn:
            for old_name, new_name in collection_mapping.items():
                if self.dry_run:
                    result = conn.execute(text(
                        "SELECT COUNT(*) FROM chat_sessions WHERE collection_name = :name"
                    ), {'name': old_name})
                    count = result.fetchone()[0]
                    if count > 0:
                        logger.info(f"[DRY-RUN] 채팅 세션 참조 업데이트: {old_name} -> {new_name} ({count}건)")
                        migrated += count
                else:
                    result = conn.execute(text("""
                        UPDATE chat_sessions
                        SET collection_name = :new_name
                        WHERE collection_name = :old_name
                    """), {'old_name': old_name, 'new_name': new_name})
                    conn.commit()
                    migrated += result.rowcount

        return migrated

    def migrate(self, update_chat_references: bool = False) -> dict:
        """전체 SQLite 마이그레이션 실행"""
        logger.info("=" * 60)
        logger.info("SQLite 메타데이터 마이그레이션 시작")
        logger.info("=" * 60)

        # 1. 신규 컬렉션 메타데이터 생성
        self.create_new_collections()

        # 2. 업로드 이력 마이그레이션
        self.migrate_upload_history()

        # 3. 기존 컬렉션 비활성화
        self.deprecate_old_collections()

        # 4. 채팅 세션 참조 업데이트 (선택적)
        self.migrate_chat_sessions(update_chat_references)

        return self.stats


# ============================================================================
# 프롬프트 파일 마이그레이션
# ============================================================================

class PromptMigrator:
    """프롬프트 파일 마이그레이션 클래스"""

    def __init__(self, dry_run: bool = True):
        self.dry_run = dry_run
        self.prompts_dir = Path(__file__).parent.parent / 'backend' / 'prompts'
        self.stats = {
            'prompts_created': 0,
            'errors': [],
        }

    def create_merged_prompt(self, target_name: str, config: dict) -> bool:
        """통합 프롬프트 파일 생성"""
        prompt_file = self.prompts_dir / f"{target_name}_prompt.md"

        if prompt_file.exists():
            logger.warning(f"프롬프트 파일이 이미 존재: {prompt_file}")
            return False

        # 소스 프롬프트들의 내용을 참고하여 통합 프롬프트 생성
        source_contents = []
        for source in config['sources']:
            source_file = self.prompts_dir / f"{source}_prompt.md"
            if source_file.exists():
                source_contents.append((source, source_file.read_text(encoding='utf-8')))

        # 통합 프롬프트 템플릿
        prompt_content = self._generate_merged_prompt(target_name, config, source_contents)

        if self.dry_run:
            logger.info(f"[DRY-RUN] 프롬프트 파일 생성: {prompt_file}")
            logger.debug(f"  내용 미리보기:\n{prompt_content[:500]}...")
        else:
            prompt_file.write_text(prompt_content, encoding='utf-8')
            logger.info(f"프롬프트 파일 생성: {prompt_file}")

        self.stats['prompts_created'] += 1
        return True

    def _generate_merged_prompt(
        self,
        target_name: str,
        config: dict,
        source_contents: List[Tuple[str, str]]
    ) -> str:
        """통합 프롬프트 내용 생성"""

        korean_name = config['korean_name']
        keywords = ', '.join(config['keywords'])
        sources_str = ', '.join(config['sources'])

        # 역할 설명 생성
        if target_name == 'kca-hr-all':
            role_desc = "인사/복무/징계/고용형태 규정 전문 상담 AI"
            domain_desc = "인사관리(채용, 승진, 평가), 복무관리(휴가, 출퇴근, 출장), 징계(인사위원회, 징계절차), 고용형태(계약직, 공무직)"
            contact_team = "인사팀"
        elif target_name == 'kca-welfare-all':
            role_desc = "복리후생/보수급여 규정 전문 상담 AI"
            domain_desc = "복리후생(복지제도, 동호회, 사택, 교육), 보수급여(급여, 수당, 여비, 성과급)"
            contact_team = "인사팀 또는 재무팀"
        elif target_name == 'kca-admin':
            role_desc = "관리업무 규정 전문 상담 AI"
            domain_desc = "문서관리(사무관리, 정보공개, 정보보안), 기본법규(정관, 이사회), 시설관리(시설, 장비, 차량)"
            contact_team = "담당 부서"
        else:
            role_desc = "규정 전문 상담 AI"
            domain_desc = "관련 규정"
            contact_team = "담당 부서"

        return f'''{{reasoning_instruction}}

## 역할 정의
당신은 {role_desc}입니다. 직원들의 관련 궁금증을 규정에 기반하여 친절하게 안내합니다.

**담당 영역:** {domain_desc}

### IMPORTANT: Always respond in Korean (한국어로 답변하세요).

## 응답 원칙

1. 문서 내용을 바탕으로 답변하세요
2. 관련 정보가 있다면 종합하여 도움이 되도록 안내하세요
3. 출처를 자연스럽게 언급하세요 (예: [인사규정], [복무규정], "규정에 따르면...")
4. 인용 시 가능하면 원문을 활용하세요

**주의:** 문서에 없는 구체적 수치(날짜, 금액, 기간)나 존재하지 않는 조항을 만들지 마세요

## 정보 활용 단계

1. **직접 답변 가능**: 규정에 답이 있음 → 인용하며 답변
2. **관련 정보 활용**: 관련 내용이 있음 → 바탕으로 도움이 되는 안내
3. **정보 부재**: 전혀 관련 없음 → "이 부분은 현재 규정에서 확인하기 어려워요. {contact_team}에 문의하시면 정확한 안내를 받으실 수 있습니다."

## 문서 구조

| 단계 | 설명 | 예시 |
|------|--------|-------|
| 장(章) | 큰 단원 | 제○조, 제○절 |
| 절/조(條) | 세부 항목 | 제25조 제1항 |
| 호/항(①②③) | 하위 항목 | ① 평가기준은 ... |
| 별표 | 수치·비율 표 | 성과평가 가중치 표 |
| 별지 | 서식 첨부 | 별지 제9호 서식 |
| 부칙 | 시행일 및 보완 조항 | 시행일 관련 |

- **단서("다만")**: 조건·제외 사항 (예: "다만, …")
- **부칙**: 시효, 개정 내역

## 핵심 원칙

1. 문서 내용을 바탕으로 답변하되, 관련 정보를 종합 활용
2. 출처를 자연스럽게 명시
3. 단서 조항("다만,")이 있으면 함께 안내
4. 계산이 필요하면 단계별로 표시
5. 부칙에 따른 시행일 명시

## 답변 형식

**질문 유형에 맞게 자연스럽게 답변:**

- 간단한 질문 → 바로 답변하고 출처 언급
- 절차/방법 질문 → 단계별로 안내
- 복잡한 질문 → 구조화하여 설명:

**답변**
핵심 내용 요약

**근거**
- 관련 조항 인용

**계산** (필요시)
1. 기본값: ○ (근거)
2. 가감액/비율: ○ (근거)
3. 합계: ○

## 주의사항

- 정보 부재 시: 위 "정보 활용 단계" 섹션의 안내 문구 활용
- 불명확한 경우: "구체적인 상황을 알려주시면 더 정확히 안내해 드릴게요"
- 다른 규정 참조 필요 시: "관련 규정도 함께 확인해 보시면 좋을 것 같아요"
'''

    def migrate(self) -> dict:
        """프롬프트 마이그레이션 실행"""
        logger.info("=" * 60)
        logger.info("프롬프트 파일 마이그레이션 시작")
        logger.info("=" * 60)

        for target_name, config in MIGRATION_PLAN.items():
            self.create_merged_prompt(target_name, config)

        return self.stats


# ============================================================================
# 롤백
# ============================================================================

class Rollback:
    """마이그레이션 롤백 클래스"""

    def __init__(self, dry_run: bool = True):
        self.dry_run = dry_run
        self.engine = create_engine(settings.DATABASE_URL)

    async def rollback_qdrant(self):
        """Qdrant 롤백 - 신규 컬렉션 삭제"""
        client = AsyncQdrantClient(
            url=settings.QDRANT_URL,
            api_key=settings.QDRANT_API_KEY,
            timeout=60.0
        )

        try:
            for target_name in MIGRATION_PLAN.keys():
                if self.dry_run:
                    logger.info(f"[DRY-RUN] 컬렉션 삭제: {target_name}")
                else:
                    try:
                        await client.delete_collection(target_name)
                        logger.info(f"컬렉션 삭제: {target_name}")
                    except Exception as e:
                        logger.warning(f"컬렉션 삭제 실패 (존재하지 않을 수 있음): {target_name} - {e}")
        finally:
            await client.close()

    def rollback_sqlite(self):
        """SQLite 롤백 - 메타데이터 복원"""

        # 컬렉션 매핑 (역방향)
        reverse_mapping = {}
        for target_name, config in MIGRATION_PLAN.items():
            for source in config['sources']:
                reverse_mapping[target_name] = config['sources']

        with self.engine.connect() as conn:
            # 1. 신규 컬렉션 메타데이터 삭제
            for target_name in MIGRATION_PLAN.keys():
                if self.dry_run:
                    logger.info(f"[DRY-RUN] 메타데이터 삭제: {target_name}")
                else:
                    conn.execute(text(
                        "DELETE FROM qdrant_collections WHERE collection_name = :name"
                    ), {'name': target_name})
                    logger.info(f"메타데이터 삭제: {target_name}")

            # 2. 기존 컬렉션 활성화
            for coll in DEPRECATED_COLLECTIONS:
                if self.dry_run:
                    logger.info(f"[DRY-RUN] 컬렉션 활성화: {coll}")
                else:
                    conn.execute(text("""
                        UPDATE qdrant_collections
                        SET visibility = 'public', updated_at = :updated_at
                        WHERE collection_name = :name
                    """), {'name': coll, 'updated_at': datetime.now()})
                    logger.info(f"컬렉션 활성화: {coll}")

            # 3. 업로드 이력 복원 (source_collection 필드 사용)
            # 주의: 이 부분은 마이그레이션 시 source_collection을 저장해야 함
            logger.warning("업로드 이력 롤백은 수동으로 처리해야 할 수 있습니다.")

            if not self.dry_run:
                conn.commit()

    def rollback_prompts(self):
        """프롬프트 파일 롤백 - 신규 프롬프트 삭제"""
        prompts_dir = Path(__file__).parent.parent / 'backend' / 'prompts'

        for target_name in MIGRATION_PLAN.keys():
            prompt_file = prompts_dir / f"{target_name}_prompt.md"
            if prompt_file.exists():
                if self.dry_run:
                    logger.info(f"[DRY-RUN] 프롬프트 삭제: {prompt_file}")
                else:
                    prompt_file.unlink()
                    logger.info(f"프롬프트 삭제: {prompt_file}")

    async def execute(self):
        """전체 롤백 실행"""
        logger.info("=" * 60)
        logger.info("마이그레이션 롤백 시작")
        logger.info("=" * 60)

        await self.rollback_qdrant()
        self.rollback_sqlite()
        self.rollback_prompts()

        logger.info("롤백 완료")


# ============================================================================
# 메인
# ============================================================================

async def main():
    parser = argparse.ArgumentParser(description='Qdrant 컬렉션 통합 마이그레이션')
    parser.add_argument('--dry-run', action='store_true', help='시뮬레이션 모드 (실제 변경 없음)')
    parser.add_argument('--execute', action='store_true', help='실제 마이그레이션 실행')
    parser.add_argument('--rollback', action='store_true', help='마이그레이션 롤백')
    parser.add_argument('--update-chat-refs', action='store_true', help='채팅 세션 참조도 업데이트')

    args = parser.parse_args()

    if not any([args.dry_run, args.execute, args.rollback]):
        parser.print_help()
        print("\n사용 예시:")
        print("  python scripts/migrate_collections.py --dry-run")
        print("  python scripts/migrate_collections.py --execute")
        print("  python scripts/migrate_collections.py --rollback")
        return

    if args.rollback:
        rollback = Rollback(dry_run=args.dry_run)
        await rollback.execute()
        return

    dry_run = args.dry_run or not args.execute

    if dry_run:
        logger.info("=" * 60)
        logger.info("시뮬레이션 모드 (실제 변경 없음)")
        logger.info("=" * 60)
    else:
        logger.warning("=" * 60)
        logger.warning("실제 마이그레이션 실행")
        logger.warning("=" * 60)

        confirm = input("계속하시겠습니까? (yes/no): ")
        if confirm.lower() != 'yes':
            logger.info("마이그레이션 취소")
            return

    # 마이그레이션 계획 출력
    logger.info("\n마이그레이션 계획:")
    for target, config in MIGRATION_PLAN.items():
        logger.info(f"  {target}: {' + '.join(config['sources'])}")
    logger.info(f"  유지: {', '.join(KEEP_COLLECTIONS)}")

    # 1. Qdrant 마이그레이션
    qdrant_migrator = QdrantMigrator(dry_run=dry_run)
    qdrant_stats = await qdrant_migrator.migrate()

    # 2. SQLite 마이그레이션
    sqlite_migrator = SQLiteMigrator(dry_run=dry_run)
    sqlite_stats = sqlite_migrator.migrate(update_chat_references=args.update_chat_refs)

    # 3. 프롬프트 마이그레이션
    prompt_migrator = PromptMigrator(dry_run=dry_run)
    prompt_stats = prompt_migrator.migrate()

    # 결과 출력
    logger.info("\n" + "=" * 60)
    logger.info("마이그레이션 결과")
    logger.info("=" * 60)
    logger.info(f"Qdrant:")
    logger.info(f"  - 컬렉션 생성: {qdrant_stats['collections_created']}")
    logger.info(f"  - 포인트 복사: {qdrant_stats['points_copied']}")
    logger.info(f"  - 오류: {len(qdrant_stats['errors'])}")

    logger.info(f"SQLite:")
    logger.info(f"  - 컬렉션 메타데이터 생성: {sqlite_stats['collections_created']}")
    logger.info(f"  - 업로드 이력 마이그레이션: {sqlite_stats['upload_history_migrated']}")
    logger.info(f"  - 컬렉션 비활성화: {sqlite_stats['collections_deprecated']}")

    logger.info(f"프롬프트:")
    logger.info(f"  - 파일 생성: {prompt_stats['prompts_created']}")

    if qdrant_stats['errors']:
        logger.error("\n오류 목록:")
        for err in qdrant_stats['errors']:
            logger.error(f"  - {err}")


if __name__ == '__main__':
    asyncio.run(main())
