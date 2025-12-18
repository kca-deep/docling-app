"""
GPU 메모리 모니터링 유틸리티
nvidia-smi를 통해 GPU 상태 정보를 조회합니다.
"""
import subprocess
import logging
from typing import Optional, Dict, List

logger = logging.getLogger(__name__)


def get_gpu_memory_info() -> Optional[Dict]:
    """
    nvidia-smi로 GPU 메모리 정보 조회

    Returns:
        dict: {
            'used_mb': int,      # 사용 중인 메모리 (MB)
            'total_mb': int,     # 전체 메모리 (MB)
            'free_mb': int,      # 사용 가능한 메모리 (MB)
            'utilization': float # 사용률 (%)
        }
        또는 None (nvidia-smi 실패 시)
    """
    try:
        result = subprocess.run(
            ['nvidia-smi', '--query-gpu=memory.used,memory.total',
             '--format=csv,nounits,noheader'],
            capture_output=True, text=True, timeout=5
        )
        if result.returncode == 0:
            used, total = map(int, result.stdout.strip().split(','))
            return {
                'used_mb': used,
                'total_mb': total,
                'free_mb': total - used,
                'utilization': round(used / total * 100, 1)
            }
    except FileNotFoundError:
        logger.debug("nvidia-smi not found - GPU monitoring unavailable")
    except subprocess.TimeoutExpired:
        logger.warning("nvidia-smi timeout - GPU may be busy")
    except Exception as e:
        logger.warning(f"GPU 정보 조회 실패: {e}")
    return None


def get_gpu_processes() -> Optional[List[Dict]]:
    """
    GPU를 사용 중인 프로세스 목록 조회

    Returns:
        list: [
            {
                'pid': int,
                'name': str,
                'memory_mb': int
            },
            ...
        ]
        또는 None (nvidia-smi 실패 시)
    """
    try:
        result = subprocess.run(
            ['nvidia-smi', '--query-compute-apps=pid,process_name,used_memory',
             '--format=csv,nounits,noheader'],
            capture_output=True, text=True, timeout=5
        )
        if result.returncode == 0 and result.stdout.strip():
            processes = []
            for line in result.stdout.strip().split('\n'):
                if line.strip():
                    parts = line.split(',')
                    if len(parts) >= 3:
                        try:
                            processes.append({
                                'pid': int(parts[0].strip()),
                                'name': parts[1].strip(),
                                'memory_mb': int(parts[2].strip())
                            })
                        except ValueError:
                            continue
            return processes
    except FileNotFoundError:
        logger.debug("nvidia-smi not found - GPU process monitoring unavailable")
    except subprocess.TimeoutExpired:
        logger.warning("nvidia-smi timeout - GPU may be busy")
    except Exception as e:
        logger.warning(f"GPU 프로세스 조회 실패: {e}")
    return None


def get_gpu_utilization() -> Optional[Dict]:
    """
    GPU 연산 사용률 및 온도 조회

    Returns:
        dict: {
            'gpu_utilization': int,  # GPU 연산 사용률 (%)
            'memory_utilization': int,  # 메모리 컨트롤러 사용률 (%)
            'temperature': int,  # GPU 온도 (C)
            'power_draw': float  # 전력 사용량 (W)
        }
        또는 None (nvidia-smi 실패 시)
    """
    try:
        result = subprocess.run(
            ['nvidia-smi',
             '--query-gpu=utilization.gpu,utilization.memory,temperature.gpu,power.draw',
             '--format=csv,nounits,noheader'],
            capture_output=True, text=True, timeout=5
        )
        if result.returncode == 0:
            parts = result.stdout.strip().split(',')
            if len(parts) >= 4:
                return {
                    'gpu_utilization': int(parts[0].strip()),
                    'memory_utilization': int(parts[1].strip()),
                    'temperature': int(parts[2].strip()),
                    'power_draw': float(parts[3].strip())
                }
    except FileNotFoundError:
        logger.debug("nvidia-smi not found - GPU monitoring unavailable")
    except subprocess.TimeoutExpired:
        logger.warning("nvidia-smi timeout - GPU may be busy")
    except Exception as e:
        logger.warning(f"GPU 사용률 조회 실패: {e}")
    return None


def get_full_gpu_status() -> Optional[Dict]:
    """
    전체 GPU 상태 정보 조회 (메모리 + 사용률 + 프로세스)

    Returns:
        dict: {
            'memory': {...},
            'utilization': {...},
            'processes': [...]
        }
        또는 None (nvidia-smi 실패 시)
    """
    memory = get_gpu_memory_info()
    if memory is None:
        return None

    return {
        'memory': memory,
        'utilization': get_gpu_utilization(),
        'processes': get_gpu_processes()
    }


def is_gpu_available() -> bool:
    """
    GPU 사용 가능 여부 확인

    Returns:
        bool: nvidia-smi 실행 가능 여부
    """
    try:
        result = subprocess.run(
            ['nvidia-smi', '--query-gpu=name', '--format=csv,noheader'],
            capture_output=True, text=True, timeout=5
        )
        return result.returncode == 0
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False
    except Exception:
        return False


def check_vram_threshold(threshold_percent: float = 90.0) -> Dict:
    """
    VRAM 사용량이 임계값을 초과했는지 확인

    Args:
        threshold_percent: 임계값 (%, 기본 90%)

    Returns:
        dict: {
            'exceeded': bool,
            'current_percent': float,
            'threshold_percent': float,
            'free_mb': int
        }
    """
    memory = get_gpu_memory_info()
    if memory is None:
        return {
            'exceeded': False,
            'current_percent': 0.0,
            'threshold_percent': threshold_percent,
            'free_mb': 0,
            'available': False
        }

    return {
        'exceeded': memory['utilization'] >= threshold_percent,
        'current_percent': memory['utilization'],
        'threshold_percent': threshold_percent,
        'free_mb': memory['free_mb'],
        'available': True
    }
