"""
셀프진단 유사과제 검색 서비스
Qdrant 및 DB 기반 유사과제 검색/검증
"""
import json
import logging
import re
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from backend.config.settings import settings
from backend.models.selfcheck import SelfCheckSubmission
from backend.models.schemas import SimilarProject
from backend.services.embedding_service import EmbeddingService
from backend.services.qdrant_service import QdrantService

logger = logging.getLogger(__name__)


class SimilarityService:
    """유사과제 검색 서비스"""

    def __init__(
        self,
        embedding_service: EmbeddingService,
        qdrant_service: QdrantService,
        http_client: Any = None
    ):
        self.embedding_service = embedding_service
        self.qdrant_service = qdrant_service
        self.client = http_client
        self._qdrant_collection_checked = False
        self._similarity_prompt: Optional[str] = None

    def set_similarity_prompt(self, prompt: str):
        """유사과제 판단 프롬프트 설정"""
        self._similarity_prompt = prompt

    async def ensure_selfcheck_collection(self) -> bool:
        """
        Selfcheck 프로젝트 컬렉션 존재 확인 및 생성 (Lazy Initialization)
        """
        if self._qdrant_collection_checked:
            return True

        if not settings.SELFCHECK_QDRANT_ENABLED:
            return False

        try:
            collection_name = settings.SELFCHECK_QDRANT_COLLECTION
            exists = await self.qdrant_service.collection_exists(collection_name)

            if not exists:
                await self.qdrant_service.create_collection(
                    collection_name=collection_name,
                    vector_size=settings.EMBEDDING_DIMENSION,
                    distance="Cosine"
                )
                logger.info(f"[SelfCheck] Created Qdrant collection: {collection_name}")

            self._qdrant_collection_checked = True
            return True

        except Exception as e:
            logger.error(f"[SelfCheck] Failed to ensure Qdrant collection: {e}")
            return False

    async def save_project_to_qdrant(
        self,
        submission_id: str,
        project_name: str,
        project_description: str,
        department: str,
        manager_name: str,
        created_at: str,
        embedding: Optional[List[float]] = None
    ) -> bool:
        """
        분석 완료된 프로젝트를 Qdrant에 저장
        """
        if not settings.SELFCHECK_QDRANT_ENABLED:
            return False

        try:
            if not await self.ensure_selfcheck_collection():
                return False

            text = f"{project_name}\n{project_description or ''}"
            if not text.strip():
                logger.warning(f"[SelfCheck] Empty project text for {submission_id}")
                return False

            if embedding is None:
                embeddings = await self.embedding_service.get_embeddings(text)
                if not embeddings:
                    logger.error(f"[SelfCheck] Failed to generate embedding for {submission_id}")
                    return False
                embedding = embeddings[0]

            metadata = {
                "submission_id": submission_id,
                "project_name": project_name,
                "department": department or "",
                "manager_name": manager_name or "",
                "created_at": created_at or ""
            }

            await self.qdrant_service.upsert_vectors(
                collection_name=settings.SELFCHECK_QDRANT_COLLECTION,
                vectors=[embedding],
                texts=[text],
                metadata_list=[metadata]
            )

            logger.info(f"[SelfCheck] Saved project to Qdrant: {submission_id}")
            return True

        except Exception as e:
            logger.error(f"[SelfCheck] Failed to save project to Qdrant: {e}")
            return False

    def _cosine_similarity(self, vec1: List[float], vec2: List[float]) -> float:
        """코사인 유사도 계산"""
        import math
        dot_product = sum(a * b for a, b in zip(vec1, vec2))
        norm1 = math.sqrt(sum(a * a for a in vec1))
        norm2 = math.sqrt(sum(b * b for b in vec2))
        if norm1 == 0 or norm2 == 0:
            return 0.0
        return dot_product / (norm1 * norm2)

    async def find_similar_projects(
        self,
        db: Session,
        current_project_text: str,
        exclude_submission_id: Optional[str] = None
    ) -> List[Tuple[SelfCheckSubmission, float]]:
        """
        유사 과제 검색 (Qdrant 또는 DB 기반)
        """
        if not settings.SELFCHECK_SIMILARITY_ENABLED:
            return []

        if settings.SELFCHECK_QDRANT_ENABLED:
            qdrant_results = await self._find_similar_projects_qdrant(
                db, current_project_text, exclude_submission_id
            )
            if qdrant_results:
                return qdrant_results
            logger.info("[SelfCheck] Qdrant search returned no results, falling back to DB")

        return await self._find_similar_projects_db(
            db, current_project_text, exclude_submission_id
        )

    async def _find_similar_projects_qdrant(
        self,
        db: Session,
        current_project_text: str,
        exclude_submission_id: Optional[str] = None
    ) -> List[Tuple[SelfCheckSubmission, float]]:
        """Qdrant 기반 유사 과제 검색"""
        try:
            if not await self.ensure_selfcheck_collection():
                logger.warning("[SelfCheck] Qdrant collection not available")
                return []

            current_embeddings = await self.embedding_service.get_embeddings(current_project_text)
            if not current_embeddings:
                logger.warning("[SelfCheck] Failed to generate embedding for current project")
                return []
            current_embedding = current_embeddings[0]

            threshold = settings.SELFCHECK_SIMILARITY_THRESHOLD / 100.0
            search_results = await self.qdrant_service.search(
                collection_name=settings.SELFCHECK_QDRANT_COLLECTION,
                query_vector=current_embedding,
                limit=settings.SELFCHECK_SIMILARITY_MAX_RESULTS * 3,
                score_threshold=threshold
            )

            if not search_results:
                logger.info("[SelfCheck] No similar projects found in Qdrant")
                return []

            id_score_map = {}
            for result in search_results:
                payload = result.get("payload", {})
                sid = payload.get("submission_id")
                if sid and sid != exclude_submission_id:
                    id_score_map[sid] = result.get("score", 0.0)

            if not id_score_map:
                logger.info("[SelfCheck] No valid candidates after filtering")
                return []

            projects = db.query(SelfCheckSubmission).filter(
                SelfCheckSubmission.submission_id.in_(id_score_map.keys())
            ).all()

            candidates = [
                (proj, id_score_map[proj.submission_id])
                for proj in projects
                if proj.submission_id in id_score_map
            ]

            candidates.sort(key=lambda x: x[1], reverse=True)
            candidates = candidates[:settings.SELFCHECK_SIMILARITY_MAX_RESULTS * 2]

            logger.info(f"[SelfCheck] Found {len(candidates)} similar projects via Qdrant")
            return candidates

        except Exception as e:
            logger.error(f"[SelfCheck] Qdrant similarity search failed: {e}")
            return []

    async def _find_similar_projects_db(
        self,
        db: Session,
        current_project_text: str,
        exclude_submission_id: Optional[str] = None
    ) -> List[Tuple[SelfCheckSubmission, float]]:
        """DB 기반 유사 과제 검색 (폴백)"""
        try:
            cutoff_date = datetime.now(timezone.utc) - timedelta(days=settings.SELFCHECK_SIMILARITY_DAYS)

            query = db.query(SelfCheckSubmission).filter(
                SelfCheckSubmission.status == "completed",
                SelfCheckSubmission.created_at >= cutoff_date
            )
            if exclude_submission_id:
                query = query.filter(SelfCheckSubmission.submission_id != exclude_submission_id)

            existing_projects = query.order_by(SelfCheckSubmission.created_at.desc()).limit(100).all()

            if not existing_projects:
                logger.info("[SelfCheck] No existing projects found for similarity check (DB)")
                return []

            current_embeddings = await self.embedding_service.get_embeddings(current_project_text)
            if not current_embeddings:
                logger.warning("[SelfCheck] Failed to generate embedding for current project")
                return []
            current_embedding = current_embeddings[0]

            valid_projects = []
            project_texts = []
            for proj in existing_projects:
                name = (proj.project_name or "").strip()
                desc = (proj.project_description or "").strip()
                text = f"{name}\n{desc}".strip()
                if text:
                    valid_projects.append(proj)
                    project_texts.append(text)

            if not project_texts:
                logger.info("[SelfCheck] No valid project texts for similarity check")
                return []

            existing_embeddings = await self.embedding_service.get_embeddings(project_texts)
            if len(existing_embeddings) != len(valid_projects):
                logger.warning(f"[SelfCheck] Embedding count mismatch")
                return []

            candidates = []
            threshold = settings.SELFCHECK_SIMILARITY_THRESHOLD / 100.0
            for proj, emb in zip(valid_projects, existing_embeddings):
                similarity = self._cosine_similarity(current_embedding, emb)
                if similarity >= threshold:
                    candidates.append((proj, similarity))

            candidates.sort(key=lambda x: x[1], reverse=True)
            candidates = candidates[:settings.SELFCHECK_SIMILARITY_MAX_RESULTS * 2]

            logger.info(f"[SelfCheck] Found {len(candidates)} similar project candidates (DB fallback)")
            return candidates

        except Exception as e:
            logger.error(f"[SelfCheck] DB similarity search failed: {e}")
            return []

    async def verify_similarity_with_llm(
        self,
        url: str,
        model: str,
        current_project_name: str,
        current_project_desc: str,
        candidates: List[Tuple[SelfCheckSubmission, float]]
    ) -> List[SimilarProject]:
        """LLM을 사용하여 유사과제 최종 검증"""
        if not candidates:
            return []

        candidate_info = []
        for i, (proj, score) in enumerate(candidates, 1):
            candidate_info.append(
                f"[후보 {i}]\n"
                f"- 과제명: {proj.project_name}\n"
                f"- 부서: {proj.department}\n"
                f"- 담당자: {proj.manager_name}\n"
                f"- 내용: {(proj.project_description or '')[:300]}\n"
                f"- 유사도: {int(score * 100)}%"
            )

        candidates_text = "\n\n".join(candidate_info)

        system_prompt = self._similarity_prompt or """당신은 과제 유사성 판단 전문가입니다.
현재 과제와 후보 과제들을 비교하여 실제로 유사한지 판단해주세요.

출력 형식 (JSON만 출력):
{"similar": [{"idx": 1, "reason": "유사 사유"}, {"idx": 2, "reason": "유사 사유"}]}

- idx: 후보 번호 (1부터 시작)
- reason: 유사하다고 판단한 구체적 이유 (20-50자)
- 유사하지 않으면 빈 배열: {"similar": []}"""

        user_prompt = f"""[현재 과제]
과제명: {current_project_name}
내용: {current_project_desc[:500]}

[후보 과제들]
{candidates_text}

위 후보들 중 현재 과제와 목적/기능/대상이 실질적으로 유사한 과제를 선별해주세요."""

        try:
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ]
            payload = {
                "model": model,
                "messages": messages,
                "temperature": settings.SELFCHECK_TEMPERATURE,
                "max_tokens": settings.SELFCHECK_SIMILARITY_MAX_TOKENS,
                "top_p": 0.9
            }

            response = await self.client.post(url, json=payload, timeout=float(settings.SELFCHECK_TIMEOUT))
            response.raise_for_status()
            result = response.json()

            message = result["choices"][0]["message"]
            content = (message.get("content") or message.get("reasoning_content") or "").strip()

            logger.info(f"[SelfCheck] Similarity LLM response: {content[:500]}")

            # JSON 파싱 전 오류 수정
            content = re.sub(r'("idx"\s*:\s*\d+)"([,\}\]])', r'\1\2', content)
            content = re.sub(r'("idx"\s*:\s*\d+)"(\s*[,\}\]])', r'\1\2', content)

            json_match = re.search(r'\{[^{}]*"similar"[^{}]*\[.*?\][^{}]*\}', content, re.DOTALL)
            if not json_match:
                logger.warning("[SelfCheck] No valid JSON in similarity response")
                return self._fallback_similar_projects(candidates)

            try:
                parsed = json.loads(json_match.group(0))
            except json.JSONDecodeError as je:
                logger.warning(f"[SelfCheck] Similarity JSON parse error: {je}")
                return self._fallback_similar_projects(candidates)

            similar_items = parsed.get("similar", [])

            verified = []
            for item in similar_items:
                idx = item.get("idx", 0) - 1
                reason = item.get("reason", "유사과제로 판단됨")
                if 0 <= idx < len(candidates):
                    proj, score = candidates[idx]
                    verified.append(SimilarProject(
                        submission_id=proj.submission_id,
                        project_name=proj.project_name,
                        department=proj.department,
                        manager_name=proj.manager_name,
                        similarity_score=int(score * 100),
                        similarity_reason=reason,
                        created_at=proj.created_at.isoformat() if proj.created_at else ""
                    ))

            verified = verified[:settings.SELFCHECK_SIMILARITY_MAX_RESULTS]
            logger.info(f"[SelfCheck] Verified {len(verified)} similar projects")
            return verified

        except Exception as e:
            logger.error(f"[SelfCheck] Similarity LLM verification failed: {e}")
            return self._fallback_similar_projects(candidates)

    def _fallback_similar_projects(
        self,
        candidates: List[Tuple[SelfCheckSubmission, float]]
    ) -> List[SimilarProject]:
        """LLM 검증 실패 시 임베딩 유사도만으로 유사과제 반환"""
        result = []
        high_threshold = settings.SELFCHECK_SIMILARITY_HIGH_THRESHOLD / 100.0
        for proj, score in candidates[:settings.SELFCHECK_SIMILARITY_MAX_RESULTS]:
            if score >= high_threshold:
                result.append(SimilarProject(
                    submission_id=proj.submission_id,
                    project_name=proj.project_name,
                    department=proj.department,
                    manager_name=proj.manager_name,
                    similarity_score=int(score * 100),
                    similarity_reason="높은 텍스트 유사도 기반 판단",
                    created_at=proj.created_at.isoformat() if proj.created_at else ""
                ))
        return result

    async def delete_from_qdrant(self, submission_id: str) -> bool:
        """Qdrant에서 submission 삭제"""
        if not settings.SELFCHECK_QDRANT_ENABLED:
            logger.info("[SelfCheck] Qdrant disabled, skipping Qdrant deletion")
            return True

        try:
            collection_name = settings.SELFCHECK_QDRANT_COLLECTION
            from qdrant_client.models import Filter, FieldCondition, MatchValue

            client = self.qdrant_service.client

            search_filter = Filter(
                must=[
                    FieldCondition(
                        key="submission_id",
                        match=MatchValue(value=submission_id)
                    )
                ]
            )

            scroll_result = client.scroll(
                collection_name=collection_name,
                scroll_filter=search_filter,
                limit=10,
                with_payload=False
            )

            points = scroll_result[0]
            if not points:
                logger.info(f"[SelfCheck] No Qdrant point found for {submission_id}")
                return True

            point_ids = [str(point.id) for point in points]
            client.delete(
                collection_name=collection_name,
                points_selector=point_ids
            )

            logger.info(f"[SelfCheck] Deleted {len(point_ids)} points from Qdrant for {submission_id}")
            return True

        except Exception as e:
            logger.error(f"[SelfCheck] Failed to delete from Qdrant: {e}")
            return False

    async def get_qdrant_collection_stats(self) -> Dict[str, Any]:
        """Qdrant selfcheck 컬렉션 통계 조회"""
        if not settings.SELFCHECK_QDRANT_ENABLED:
            return {"exists": False, "status": "disabled"}

        try:
            collection_name = settings.SELFCHECK_QDRANT_COLLECTION
            exists = await self.qdrant_service.collection_exists(collection_name)

            if not exists:
                return {"exists": False, "status": "not_created"}

            info = await self.qdrant_service._get_collection_info(collection_name)

            return {
                "exists": True,
                "collection_name": collection_name,
                "points_count": info.points_count,
                "documents_count": info.documents_count,
                "vector_size": info.vector_size,
                "distance": info.distance,
                "status": "ready"
            }

        except Exception as e:
            logger.error(f"[SelfCheck] Failed to get Qdrant stats: {e}")
            return {"exists": False, "status": f"error: {str(e)}"}

    async def migrate_projects_to_qdrant(
        self,
        db: Session,
        batch_size: int = 20
    ) -> Dict[str, Any]:
        """기존 DB 프로젝트를 Qdrant로 마이그레이션"""
        if not settings.SELFCHECK_QDRANT_ENABLED:
            return {"error": "SELFCHECK_QDRANT_ENABLED is disabled"}

        if not await self.ensure_selfcheck_collection():
            return {"error": "Failed to create Qdrant collection"}

        projects = db.query(SelfCheckSubmission).filter(
            SelfCheckSubmission.status == "completed"
        ).order_by(SelfCheckSubmission.created_at.desc()).all()

        total = len(projects)
        migrated = 0
        failed = 0
        skipped = 0

        logger.info(f"[SelfCheck] Starting migration of {total} projects to Qdrant")

        for i, proj in enumerate(projects):
            try:
                text = f"{proj.project_name or ''}\n{proj.project_description or ''}".strip()
                if not text:
                    skipped += 1
                    continue

                embeddings = await self.embedding_service.get_embeddings(text)
                if not embeddings:
                    failed += 1
                    logger.warning(f"[SelfCheck] Failed to embed project {proj.submission_id}")
                    continue

                metadata = {
                    "submission_id": proj.submission_id,
                    "project_name": proj.project_name or "",
                    "department": proj.department or "",
                    "manager_name": proj.manager_name or "",
                    "created_at": proj.created_at.isoformat() if proj.created_at else ""
                }

                await self.qdrant_service.upsert_vectors(
                    collection_name=settings.SELFCHECK_QDRANT_COLLECTION,
                    vectors=[embeddings[0]],
                    texts=[text],
                    metadata_list=[metadata]
                )

                migrated += 1

                if (i + 1) % 10 == 0:
                    logger.info(f"[SelfCheck] Migration progress: {i + 1}/{total}")

            except Exception as e:
                failed += 1
                logger.error(f"[SelfCheck] Failed to migrate project {proj.submission_id}: {e}")

        result = {
            "total": total,
            "migrated": migrated,
            "failed": failed,
            "skipped": skipped
        }

        logger.info(f"[SelfCheck] Migration completed: {result}")
        return result
