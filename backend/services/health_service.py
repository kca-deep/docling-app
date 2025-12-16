"""
Health Check 서비스
모든 의존성 서비스의 상태를 확인합니다.
"""
import asyncio
import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional

import httpx
from sqlalchemy import text

from backend.database import SessionLocal
from backend.config.settings import settings

logger = logging.getLogger(__name__)


class HealthService:
    """시스템 헬스 체크 서비스"""

    def __init__(self):
        self.timeout = 5.0  # 각 서비스 체크 타임아웃

    async def check_database(self) -> Dict[str, Any]:
        """SQLite/PostgreSQL 연결 확인"""
        try:
            start = datetime.now()
            db = SessionLocal()
            try:
                db.execute(text("SELECT 1"))
                latency = (datetime.now() - start).total_seconds() * 1000
                return {"status": "healthy", "latency_ms": round(latency, 2)}
            finally:
                db.close()
        except Exception as e:
            logger.error(f"Database health check failed: {e}")
            return {"status": "unhealthy", "error": str(e)}

    async def check_qdrant(self) -> Dict[str, Any]:
        """Qdrant 벡터 DB 연결 확인"""
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                start = datetime.now()
                response = await client.get(f"{settings.QDRANT_URL}/collections")
                latency = (datetime.now() - start).total_seconds() * 1000

                if response.status_code == 200:
                    data = response.json()
                    collection_count = len(data.get("result", {}).get("collections", []))
                    return {
                        "status": "healthy",
                        "latency_ms": round(latency, 2),
                        "collections": collection_count
                    }
                return {
                    "status": "unhealthy",
                    "status_code": response.status_code
                }
        except httpx.TimeoutException:
            return {"status": "unhealthy", "error": "timeout"}
        except Exception as e:
            logger.error(f"Qdrant health check failed: {e}")
            return {"status": "unhealthy", "error": str(e)}

    async def check_embedding(self) -> Dict[str, Any]:
        """BGE-M3 임베딩 서비스 확인"""
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                start = datetime.now()
                # OpenAI 호환 API 형식으로 모델 목록 확인
                response = await client.get(f"{settings.EMBEDDING_URL}/v1/models")
                latency = (datetime.now() - start).total_seconds() * 1000

                if response.status_code == 200:
                    return {
                        "status": "healthy",
                        "latency_ms": round(latency, 2),
                        "model": settings.EMBEDDING_MODEL
                    }
                # 모델 목록이 없어도 200이 아닌 경우 degraded
                return {
                    "status": "degraded",
                    "status_code": response.status_code
                }
        except httpx.TimeoutException:
            return {"status": "unhealthy", "error": "timeout"}
        except Exception as e:
            logger.warning(f"Embedding health check failed: {e}")
            return {"status": "degraded", "error": str(e)}

    async def check_llm(self) -> Dict[str, Any]:
        """LLM 서비스 확인 (기본 LLM)"""
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                start = datetime.now()
                response = await client.get(f"{settings.LLM_BASE_URL}/v1/models")
                latency = (datetime.now() - start).total_seconds() * 1000

                if response.status_code == 200:
                    return {
                        "status": "healthy",
                        "latency_ms": round(latency, 2),
                        "model": settings.LLM_MODEL
                    }
                return {
                    "status": "degraded",
                    "status_code": response.status_code
                }
        except httpx.TimeoutException:
            return {"status": "unhealthy", "error": "timeout"}
        except Exception as e:
            logger.warning(f"LLM health check failed: {e}")
            return {"status": "degraded", "error": str(e)}

    async def _check_single_llm(self, url: str, model_info: Dict[str, Any]) -> Dict[str, Any]:
        """단일 LLM 서비스 상태 확인"""
        result = {
            "key": model_info["key"],
            "label": model_info["label"],
            "description": model_info["description"]
        }

        if not url:
            result["status"] = "unconfigured"
            result["error"] = "URL not configured"
            return result

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                start = datetime.now()
                response = await client.get(f"{url}/v1/models")
                latency = (datetime.now() - start).total_seconds() * 1000

                if response.status_code == 200:
                    result["status"] = "healthy"
                    result["latency_ms"] = round(latency, 2)
                else:
                    result["status"] = "degraded"
                    result["status_code"] = response.status_code
        except httpx.TimeoutException:
            result["status"] = "unhealthy"
            result["error"] = "timeout"
        except httpx.ConnectError:
            result["status"] = "unhealthy"
            result["error"] = "connection refused"
        except Exception as e:
            logger.warning(f"LLM health check failed for {model_info['key']}: {e}")
            result["status"] = "unhealthy"
            result["error"] = str(e)

        return result

    async def check_llm_models(self) -> Dict[str, Any]:
        """모든 LLM 모델 상태 확인"""
        available_models = settings.get_available_llm_models()

        # 모든 모델 병렬 체크
        tasks = [
            self._check_single_llm(model["url"], model)
            for model in available_models
        ]

        results = await asyncio.gather(*tasks, return_exceptions=True)

        models = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                models.append({
                    "key": available_models[i]["key"],
                    "label": available_models[i]["label"],
                    "description": available_models[i]["description"],
                    "status": "error",
                    "error": str(result)
                })
            else:
                models.append(result)

        return {"models": models}

    async def check_docling(self) -> Dict[str, Any]:
        """Docling Serve 확인"""
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                start = datetime.now()
                # Docling Serve 상태 확인
                response = await client.get(f"{settings.DOCLING_BASE_URL}/health")
                latency = (datetime.now() - start).total_seconds() * 1000

                if response.status_code == 200:
                    return {
                        "status": "healthy",
                        "latency_ms": round(latency, 2)
                    }
                return {
                    "status": "degraded",
                    "status_code": response.status_code
                }
        except httpx.TimeoutException:
            return {"status": "unhealthy", "error": "timeout"}
        except Exception as e:
            logger.warning(f"Docling health check failed: {e}")
            return {"status": "degraded", "error": str(e)}

    async def check_reranker(self) -> Dict[str, Any]:
        """BGE Reranker 서비스 확인"""
        if not settings.USE_RERANKING:
            return {"status": "disabled"}

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                start = datetime.now()
                response = await client.get(f"{settings.RERANKER_URL}/v1/models")
                latency = (datetime.now() - start).total_seconds() * 1000

                if response.status_code == 200:
                    return {
                        "status": "healthy",
                        "latency_ms": round(latency, 2),
                        "model": settings.RERANKER_MODEL
                    }
                return {
                    "status": "degraded",
                    "status_code": response.status_code
                }
        except httpx.TimeoutException:
            return {"status": "unhealthy", "error": "timeout"}
        except Exception as e:
            logger.warning(f"Reranker health check failed: {e}")
            return {"status": "degraded", "error": str(e)}

    async def check_qwen3_vl(self) -> Dict[str, Any]:
        """Qwen3-VL OCR 서비스 확인"""
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                start = datetime.now()
                response = await client.get(f"{settings.QWEN3_VL_BASE_URL}/v1/models")
                latency = (datetime.now() - start).total_seconds() * 1000

                if response.status_code == 200:
                    return {
                        "status": "healthy",
                        "latency_ms": round(latency, 2),
                        "model": settings.QWEN3_VL_MODEL
                    }
                return {
                    "status": "degraded",
                    "status_code": response.status_code
                }
        except httpx.TimeoutException:
            return {"status": "unhealthy", "error": "timeout"}
        except Exception as e:
            logger.warning(f"Qwen3-VL health check failed: {e}")
            return {"status": "degraded", "error": str(e)}

    async def get_full_health(self) -> Dict[str, Any]:
        """전체 시스템 상태 확인"""
        # 모든 체크를 병렬로 실행
        checks = await asyncio.gather(
            self.check_database(),
            self.check_qdrant(),
            self.check_embedding(),
            self.check_llm(),
            self.check_docling(),
            self.check_reranker(),
            self.check_qwen3_vl(),
            return_exceptions=True
        )

        services = {
            "database": checks[0] if not isinstance(checks[0], Exception) else {"status": "error", "error": str(checks[0])},
            "qdrant": checks[1] if not isinstance(checks[1], Exception) else {"status": "error", "error": str(checks[1])},
            "embedding": checks[2] if not isinstance(checks[2], Exception) else {"status": "error", "error": str(checks[2])},
            "llm": checks[3] if not isinstance(checks[3], Exception) else {"status": "error", "error": str(checks[3])},
            "docling": checks[4] if not isinstance(checks[4], Exception) else {"status": "error", "error": str(checks[4])},
            "reranker": checks[5] if not isinstance(checks[5], Exception) else {"status": "error", "error": str(checks[5])},
            "qwen3_vl": checks[6] if not isinstance(checks[6], Exception) else {"status": "error", "error": str(checks[6])},
        }

        # 전체 상태 결정
        # 필수 서비스: database, qdrant
        # 선택 서비스: embedding, llm, docling, reranker, qwen3_vl
        critical_services = ["database", "qdrant"]
        optional_services = ["embedding", "llm", "docling", "reranker", "qwen3_vl"]

        critical_unhealthy = sum(
            1 for svc in critical_services
            if isinstance(services[svc], dict) and services[svc].get("status") == "unhealthy"
        )

        optional_unhealthy = sum(
            1 for svc in optional_services
            if isinstance(services[svc], dict) and services[svc].get("status") == "unhealthy"
        )

        degraded_count = sum(
            1 for s in services.values()
            if isinstance(s, dict) and s.get("status") == "degraded"
        )

        if critical_unhealthy > 0:
            overall = "unhealthy"
        elif optional_unhealthy > 0 or degraded_count > 0:
            overall = "degraded"
        else:
            overall = "healthy"

        return {
            "status": overall,
            "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "version": settings.API_VERSION,
            "services": services
        }

    async def get_simple_health(self) -> Dict[str, Any]:
        """간단한 상태 확인 (Liveness probe용)"""
        return {
            "status": "ok",
            "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        }


# 싱글톤 인스턴스
health_service = HealthService()
