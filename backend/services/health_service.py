"""
Health Check 서비스
"""
import asyncio
import logging
from datetime import datetime, timezone
from typing import Dict, Any

import httpx

from backend.config.settings import settings

logger = logging.getLogger(__name__)


class HealthService:
    """시스템 헬스 체크 서비스"""

    def __init__(self):
        self.timeout = 5.0  # 각 서비스 체크 타임아웃

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

    async def get_simple_health(self) -> Dict[str, Any]:
        """간단한 상태 확인 (Liveness probe용)"""
        return {
            "status": "ok",
            "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        }


# 싱글톤 인스턴스
health_service = HealthService()
