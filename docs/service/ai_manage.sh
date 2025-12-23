#!/bin/bash
# ============================================================================
#  AI 서비스 통합 관리 스크립트
#  LLM 모델 전환, 서비스 관리, 로그 뷰어, 시스템 모니터링
# ============================================================================

# set -e 제거: 서비스 중지 실패 시에도 스크립트 계속 실행

# ============================================================================
# sudo 권한 미리 확보 (비밀번호 입력 문제 방지)
# ============================================================================
ensure_sudo() {
    # sudo 권한이 없으면 미리 확보
    if ! sudo -n true 2>/dev/null; then
        echo -e "${YELLOW}sudo 권한이 필요합니다. 비밀번호를 입력하세요.${NC}"
        sudo -v
        if [ $? -ne 0 ]; then
            echo -e "${RED}sudo 권한을 얻지 못했습니다. 종료합니다.${NC}"
            exit 1
        fi
    fi

    # sudo 권한 유지를 위한 백그라운드 프로세스 (5분마다 갱신)
    (while true; do sudo -v; sleep 300; done) &
    SUDO_KEEPALIVE_PID=$!
}

# 종료 시 백그라운드 프로세스 정리
cleanup() {
    [ -n "$SUDO_KEEPALIVE_PID" ] && kill $SUDO_KEEPALIVE_PID 2>/dev/null
    tput cnorm 2>/dev/null  # 커서 복원
}
trap cleanup EXIT INT TERM

# 색상 정의
RED=$'\033[0;31m'
GREEN=$'\033[0;32m'
YELLOW=$'\033[1;33m'
BLUE=$'\033[0;34m'
CYAN=$'\033[0;36m'
MAGENTA=$'\033[0;35m'
WHITE=$'\033[1;37m'
BOLD=$'\033[1m'
DIM=$'\033[2m'
NC=$'\033[0m'

# 커서 제어
CURSOR_HOME=$'\033[H'
CLEAR_SCREEN=$'\033[2J'
CLEAR_LINE=$'\033[K'

# ============================================================================
# 서비스 정의
# ============================================================================
#
# Docling Serve 권장 환경변수 (systemd 서비스 파일에 추가)
# ------------------------------------------------------
# VRAM 최적화 및 안정성 향상을 위한 권장 설정:
#   UVICORN_WORKERS=1                          # 싱글 워커 (GPU 경합 방지)
#   DOCLING_SERVE_ENG_LOC_SHARE_MODELS=true    # 스레드 간 모델 공유
#   DOCLING_SERVE_OPTIONS_CACHE_SIZE=1         # 변환기 캐시 최소화
#   DOCLING_SERVE_LOAD_MODELS_AT_BOOT=true     # 시작 시 모델 로드
#   DOCLING_SERVE_MAX_SYNC_WAIT=300            # 최대 동기 대기 시간
#
# systemd 서비스 파일 예시 (/etc/systemd/system/docling-serve.service):
#   [Service]
#   Environment="UVICORN_WORKERS=1"
#   Environment="DOCLING_SERVE_ENG_LOC_SHARE_MODELS=true"
#   Environment="DOCLING_SERVE_OPTIONS_CACHE_SIZE=1"
# ============================================================================

declare -A SERVICES=(
    ["gpt"]="llama-server-gpt-oss"
    ["gemma3"]="llama-server-gemma3"
    ["exaone-4.0-32b"]="exaone-4.0"
    ["qwen3vl"]="llama-server-qwen3vl"
    ["docling"]="docling-serve"
    ["docling-fe"]="docling-app-frontend"
    ["docling-be"]="docling-app-backend"
    ["embedding"]="bge-embedding-server"
    ["reranker"]="bge-reranker"
    ["qdrant"]="qdrant"
)

declare -A SERVICE_INFO=(
    ["gpt"]="gpt-oss-20b|8080|~12GB"
    ["gemma3"]="gemma3-27b-it|8082|~15GB"
    ["exaone-4.0-32b"]="exaone-4.0-32b|8081|~25GB"
    ["qwen3vl"]="Qwen3-VL 8B Vision|8084|~9GB"
    ["docling"]="Docling API|8007|~13GB"
    ["docling-fe"]="Docling Frontend|3000|-"
    ["docling-be"]="Docling Backend|8000|-"
    ["embedding"]="BGE-M3 Embedding|8083|<1GB"
    ["reranker"]="BGE Reranker v2-m3|8006|<1GB"
    ["qdrant"]="Qdrant Vector DB|6333|-"
)

# 서비스 그룹
LLM_SERVICES=("gpt" "gemma3" "exaone-4.0-32b")

# VRAM 요구량 정의 (MB) - RAG 모드 기준
declare -A VRAM_REQUIRED=(
    ["gpt"]=12000
    ["gemma3"]=15000
    ["exaone-4.0-32b"]=25000
    ["qwen3vl"]=9000
    ["docling"]=13000
    ["embedding"]=500
    ["reranker"]=500
)

# ============================================================================
# 유틸리티 함수
# ============================================================================

# 모든 LLM 변형 서비스 목록 (공통 사용)
ALL_LLM_SERVICES=(
    "llama-server-gpt-oss"
    "llama-server-gpt-oss-min"
    "llama-server-gpt-oss-llm"
    "llama-server-gemma3"
    "exaone-4.0"
    "exaone-4.0-rag"
    "llama-server-qwen3vl"
    "llama-server-qwen3vl-rag"
    "llama-server-qwen3vl-llm"
)

check_api_health() {
    local port=$1
    curl -s --max-time 2 "http://localhost:$port/health" &>/dev/null && echo "ok" || echo "fail"
}

# 모든 LLM 변형 서비스 중지 (공통 함수)
stop_all_llm_variants() {
    for svc in "${ALL_LLM_SERVICES[@]}"; do
        sudo systemctl stop "${svc}.service" 2>/dev/null
    done
}

# GPU 프로세스에서 서비스명 추출 (공통 함수)
get_service_name_from_process() {
    local pid=$1
    local pname=$2
    local cmd=$(ps -p "$pid" -o args --no-headers 2>/dev/null)
    local svc_name="unknown"

    case "$pname" in
        *llama-server*)
            echo "$cmd" | grep -q "8080" && svc_name="gpt-oss-20b"
            echo "$cmd" | grep -q "8081" && svc_name="exaone-4.0-32b"
            echo "$cmd" | grep -q "8082" && svc_name="gemma3-27b"
            echo "$cmd" | grep -q "8084" && svc_name="qwen3-vl"
            ;;
        *python*)
            echo "$cmd" | grep -q "vllm" && svc_name="hyperclovax"
            echo "$cmd" | grep -q "embedding" && svc_name="bge-m3"
            echo "$cmd" | grep -q "rerank" && svc_name="reranker"
            echo "$cmd" | grep -q "docling" && svc_name="docling"
            ;;
    esac
    echo "$svc_name"
}

# VRAM 정보 가져오기 (전역 변수로 캐시)
get_vram_info() {
    if ! command -v nvidia-smi &>/dev/null; then
        VRAM_USED=0
        VRAM_TOTAL=32000
        VRAM_FREE=32000
        return
    fi
    local info=$(nvidia-smi --query-gpu=memory.used,memory.total --format=csv,noheader,nounits 2>/dev/null)
    IFS=', ' read -r VRAM_USED VRAM_TOTAL <<< "$info"
    VRAM_FREE=$((VRAM_TOTAL - VRAM_USED))
}

# 특정 서비스가 시작 가능한지 확인
can_start_service() {
    local key=$1
    local required=${VRAM_REQUIRED[$key]:-0}
    [ $required -eq 0 ] && return 0
    [ $VRAM_FREE -ge $required ] && return 0 || return 1
}

# VRAM 해제 대기 (target_free_mb, max_wait_sec)
wait_vram_release() {
    local target_free=${1:-5000}
    local max_wait=${2:-30}

    echo -ne "  ${DIM}Waiting for VRAM release"
    for i in $(seq 1 $max_wait); do
        get_vram_info
        if [ $VRAM_FREE -ge $target_free ]; then
            echo -e " (${VRAM_FREE}MB free)${NC}"
            return 0
        fi
        echo -ne "."
        sleep 1
    done
    echo -e " ${YELLOW}timeout${NC}"
    return 1
}

# 현재 실행 중인 LLM 가져오기
get_active_llm() {
    for llm in "${LLM_SERVICES[@]}"; do
        local status=$(get_service_status "$llm")
        [ "$status" = "active" ] && echo "$llm" && return
    done
    echo ""
}

get_service_status() {
    local key=$1
    local svc="${SERVICES[$key]}"

    # GPT-OSS, EXAONE, Qwen3-VL은 여러 변형 서비스가 있으므로 모두 체크
    case "$key" in
        gpt)
            for variant in "llama-server-gpt-oss" "llama-server-gpt-oss-min" "llama-server-gpt-oss-llm"; do
                local status=$(systemctl is-active "$variant.service" 2>/dev/null)
                [ "$status" = "active" ] && echo "active" && return
            done
            echo "inactive"
            ;;
        gemma3)
            local status=$(systemctl is-active "llama-server-gemma3.service" 2>/dev/null)
            [ "$status" = "active" ] && echo "active" && return
            echo "inactive"
            ;;
        exaone-4.0-32b)
            # systemd 서비스 또는 포트 8081 프로세스 체크
            if systemctl is-active --quiet exaone-4.0 2>/dev/null; then
                echo "active"
            elif lsof -i:8081 -sTCP:LISTEN &>/dev/null; then
                echo "active"
            else
                echo "inactive"
            fi
            ;;
        qwen3vl)
            for variant in "llama-server-qwen3vl" "llama-server-qwen3vl-rag" "llama-server-qwen3vl-llm"; do
                local status=$(systemctl is-active "$variant.service" 2>/dev/null)
                [ "$status" = "active" ] && echo "active" && return
            done
            echo "inactive"
            ;;
        *)
            systemctl is-active "$svc.service" 2>/dev/null || echo "inactive"
            ;;
    esac
}

get_status_icon() {
    local status=$1
    local api=$2

    if [ "$status" = "active" ]; then
        [ "$api" = "ok" ] && echo "${GREEN}●${NC}" || echo "${YELLOW}◐${NC}"
    elif [ "$status" = "activating" ]; then
        echo "${YELLOW}◐${NC}"
    else
        echo "${DIM}○${NC}"
    fi
}

# ============================================================================
# 상태 표시 함수
# ============================================================================

print_header() {
    local title="$1"
    local width=62
    echo ""
    echo -e "${CYAN}┌$(printf '─%.0s' $(seq 1 $width))┐${NC}"
    printf "${CYAN}│${NC} ${BOLD}%-60s ${CYAN}│${NC}\n" "$title"
    echo -e "${CYAN}└$(printf '─%.0s' $(seq 1 $width))┘${NC}"
}

print_section() {
    echo -e "\n${WHITE}$1${NC}"
}

print_service_line() {
    local key=$1
    local info="${SERVICE_INFO[$key]}"
    IFS='|' read -r name port vram <<< "$info"

    local status=$(get_service_status "$key")
    local api="N/A"
    [[ "$port" =~ ^[0-9]+$ ]] && api=$(check_api_health "$port")

    local icon=$(get_status_icon "$status" "$api")
    local status_txt=""

    if [ "$status" = "active" ] && [ "$api" = "ok" ]; then
        status_txt="${GREEN}Running${NC}"
    elif [ "$status" = "active" ]; then
        status_txt="${YELLOW}Starting${NC}"
    else
        status_txt="${DIM}Stopped${NC}"
    fi

    printf "  %b %-24s ${DIM}:${port}${NC}  %-10b  ${DIM}%s${NC}\n" "$icon" "$name" "$status_txt" "$vram"
}

check_status() {
    print_header "AI Service Status"

    print_section "LLM Models (mutually exclusive)"
    for svc in "${LLM_SERVICES[@]}"; do
        print_service_line "$svc"
    done

    print_section "Vision & Document Services"
    print_service_line "qwen3vl"
    print_service_line "docling"

    # Docling App
    local fe_status=$(get_service_status "docling-fe")
    local be_status=$(get_service_status "docling-be")
    local fe_api=$(check_api_health "3000")
    local be_api=$(check_api_health "8000")

    local app_icon app_txt
    if [ "$fe_status" = "active" ] && [ "$be_status" = "active" ]; then
        if [ "$fe_api" = "ok" ] && [ "$be_api" = "ok" ]; then
            app_icon="${GREEN}●${NC}"
            app_txt="${GREEN}Running${NC}"
        else
            app_icon="${YELLOW}◐${NC}"
            app_txt="${YELLOW}Starting${NC}"
        fi
    elif [ "$fe_status" = "active" ] || [ "$be_status" = "active" ]; then
        app_icon="${YELLOW}◐${NC}"
        app_txt="${YELLOW}Partial${NC}"
    else
        app_icon="${DIM}○${NC}"
        app_txt="${DIM}Stopped${NC}"
    fi
    printf "  %b %-24s ${DIM}:3000,8000${NC}  %-10b  ${DIM}-${NC}\n" "$app_icon" "Docling App" "$app_txt"

    print_section "Embedding & Reranking"
    print_service_line "embedding"
    print_service_line "reranker"

    print_section "Docker Services"
    if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "qdrant"; then
        local q_api=$(check_api_health "6333")
        local q_icon=$(get_status_icon "active" "$q_api")
        local q_txt
        [ "$q_api" = "ok" ] && q_txt="${GREEN}Running${NC}" || q_txt="${YELLOW}Starting${NC}"
        printf "  %b %-24s ${DIM}:6333${NC}      %-10b  ${DIM}-${NC}\n" "$q_icon" "Qdrant Vector DB" "$q_txt"
    else
        printf "  ${DIM}○${NC} %-24s ${DIM}:6333${NC}      ${DIM}Stopped${NC}    ${DIM}-${NC}\n" "Qdrant Vector DB"
    fi
    echo ""
}

check_vram() {
    if ! command -v nvidia-smi &>/dev/null; then return; fi

    local info=$(nvidia-smi --query-gpu=memory.used,memory.total --format=csv,noheader,nounits 2>/dev/null)
    IFS=', ' read -r used total <<< "$info"

    local percent=$((used * 100 / total))
    local used_gb=$(echo "scale=1; $used/1024" | bc)
    local total_gb=$(echo "scale=1; $total/1024" | bc)

    local color
    [ $percent -ge 90 ] && color=$RED || { [ $percent -ge 70 ] && color=$YELLOW || color=$GREEN; }

    echo -e "${WHITE}GPU Memory${NC}"
    printf "  ${color}%s${NC} / %s GB (%d%%)\n\n" "$used_gb" "$total_gb" "$percent"
}

# ============================================================================
# 서비스 관리 함수
# ============================================================================

start_service() {
    local key=$1
    local svc="${SERVICES[$key]}"
    local info="${SERVICE_INFO[$key]}"
    IFS='|' read -r name port vram <<< "$info"

    local status=$(get_service_status "$key")
    if [ "$status" = "active" ]; then
        echo -e "${YELLOW}!${NC} $name is already running"
        return 0
    fi

    echo -ne "${BLUE}Starting${NC} $name... "

    # GPT-OSS, Gemma3, Qwen3-VL은 기본 변형 서비스로 시작
    local actual_svc="$svc"
    case "$key" in
        gpt)
            actual_svc="llama-server-gpt-oss-min"  # RAG 모드: ctx=8K p=1
            ;;
        gemma3)
            actual_svc="llama-server-gemma3"  # ctx=16K p=2
            ;;
        exaone-4.0-32b)
            actual_svc="exaone-4.0"  # 단일 서비스: ctx=48K p=6 n=8K
            ;;
        qwen3vl)
            actual_svc="llama-server-qwen3vl-rag"  # RAG 모드: ctx=16K p=4
            ;;
    esac

    sudo systemctl start "$actual_svc.service"

    local wait=5
    case "$key" in
        gpt|gemma3) wait=10 ;;
        exaone-4.0-32b) wait=15 ;;
        qwen3vl|docling) wait=10 ;;
    esac

    sleep "$wait"

    if systemctl is-active --quiet "$actual_svc.service"; then
        echo -e "${GREEN}OK${NC}"
        [[ "$port" =~ ^[0-9]+$ ]] && echo -e "  ${DIM}http://localhost:$port${NC}"
    else
        echo -e "${RED}FAILED${NC}"
        return 1
    fi
}

stop_service() {
    local key=$1
    local svc="${SERVICES[$key]}"
    local info="${SERVICE_INFO[$key]}"
    IFS='|' read -r name port vram <<< "$info"

    local status=$(get_service_status "$key")
    if [ "$status" = "inactive" ] || [ "$status" = "failed" ]; then
        echo -e "${DIM}$name is already stopped${NC}"
        return 0
    fi

    # deactivating 상태인 경우 (이미 중지 시도 중)
    if [ "$status" = "deactivating" ]; then
        echo -e "${YELLOW}!${NC} $name is stuck in deactivating state, force killing..."
        sudo systemctl kill -s SIGKILL "$svc.service" 2>/dev/null
        sleep 1
        sudo systemctl reset-failed "$svc.service" 2>/dev/null
        echo -e "  ${GREEN}OK${NC}"
        return 0
    fi

    echo -ne "${BLUE}Stopping${NC} $name... "

    # GPT-OSS, Gemma3, Qwen3-VL 서비스 중지
    case "$key" in
        gpt)
            sudo systemctl stop llama-server-gpt-oss.service 2>/dev/null
            sudo systemctl stop llama-server-gpt-oss-min.service 2>/dev/null
            sudo systemctl stop llama-server-gpt-oss-llm.service 2>/dev/null
            ;;
        gemma3)
            sudo systemctl stop llama-server-gemma3.service 2>/dev/null
            ;;
        exaone-4.0-32b)
            sudo systemctl stop exaone-4.0.service 2>/dev/null
            # 수동 실행 프로세스도 종료
            local pid=$(lsof -t -i:8081 2>/dev/null)
            if [ -n "$pid" ]; then
                kill $pid 2>/dev/null
                sleep 1
                kill -9 $pid 2>/dev/null
            fi
            ;;
        qwen3vl)
            sudo systemctl stop llama-server-qwen3vl.service 2>/dev/null
            sudo systemctl stop llama-server-qwen3vl-rag.service 2>/dev/null
            sudo systemctl stop llama-server-qwen3vl-llm.service 2>/dev/null
            ;;
        *)
            sudo systemctl stop "$svc.service"
            ;;
    esac
    echo -e "${GREEN}OK${NC}"
}

restart_service() {
    local key=$1
    stop_service "$key"
    sleep 2
    start_service "$key"
}

start_docling_app() {
    echo -e "\n${BOLD}Starting Docling App${NC}\n"

    # 포트 점유 프로세스 확인 및 종료
    for port in 8000 3000; do
        local pid=$(lsof -t -i:$port 2>/dev/null)
        if [ -n "$pid" ]; then
            echo -e "${YELLOW}!${NC} Port $port is in use by PID $pid, killing..."
            kill $pid 2>/dev/null
            sleep 1
            # 프로세스가 종료되지 않으면 강제 종료
            if lsof -t -i:$port &>/dev/null; then
                kill -9 $pid 2>/dev/null
                sleep 1
            fi
            echo -e "  ${GREEN}OK${NC}"
        fi
    done

    # 서비스 failed 상태 리셋
    sudo systemctl reset-failed docling-app-backend.service 2>/dev/null
    sudo systemctl reset-failed docling-app-frontend.service 2>/dev/null

    start_service "docling-be"
    start_service "docling-fe"
    echo -e "\n${GREEN}Docling App started${NC}"
    echo -e "  ${DIM}Frontend: http://localhost:3000${NC}"
    echo -e "  ${DIM}Backend:  http://localhost:8000${NC}"
}

stop_docling_app() {
    echo -e "\n${BOLD}Stopping Docling App${NC}\n"

    # 1. systemd 서비스 중지 시도 (타임아웃 5초)
    echo -ne "${BLUE}Stopping${NC} Frontend... "
    timeout 5 sudo systemctl stop docling-app-frontend.service 2>/dev/null || sudo systemctl kill -s SIGKILL docling-app-frontend.service 2>/dev/null
    echo -e "${GREEN}OK${NC}"

    echo -ne "${BLUE}Stopping${NC} Backend... "
    timeout 5 sudo systemctl stop docling-app-backend.service 2>/dev/null || sudo systemctl kill -s SIGKILL docling-app-backend.service 2>/dev/null
    echo -e "${GREEN}OK${NC}"

    # 2. 잠시 대기 (systemd가 프로세스 정리할 시간)
    sleep 2

    # 3. 포트 점유 프로세스 강제 종료 (uvicorn 워커 포함)
    for port in 8000 3000; do
        # 모든 PID 가져오기 (여러 워커 프로세스 대응)
        local pids=$(lsof -t -i:$port 2>/dev/null | tr '\n' ' ')
        if [ -n "$pids" ]; then
            echo -e "${YELLOW}!${NC} Port $port still in use by PID(s): $pids"
            echo -e "  Sending SIGTERM..."
            for pid in $pids; do
                kill $pid 2>/dev/null
            done
            sleep 2

            # 아직 남아있으면 SIGKILL
            local remaining=$(lsof -t -i:$port 2>/dev/null | tr '\n' ' ')
            if [ -n "$remaining" ]; then
                echo -e "  Sending SIGKILL to remaining: $remaining"
                for pid in $remaining; do
                    kill -9 $pid 2>/dev/null
                done
                sleep 1
            fi
            echo -e "  ${GREEN}OK${NC}"
        fi
    done

    # 4. uvicorn 관련 프로세스 추가 정리
    local uvicorn_pids=$(pgrep -f "uvicorn.*backend.main:app" 2>/dev/null | tr '\n' ' ')
    if [ -n "$uvicorn_pids" ]; then
        echo -e "${YELLOW}!${NC} Found orphan uvicorn processes: $uvicorn_pids"
        for pid in $uvicorn_pids; do
            kill -9 $pid 2>/dev/null
        done
        echo -e "  ${GREEN}Cleaned up${NC}"
    fi

    echo -e "\n${GREEN}Docling App stopped${NC}"
}

stop_all_llm() {
    echo -e "\n${BOLD}Stopping all LLM models${NC}\n"
    for llm in "${LLM_SERVICES[@]}"; do
        stop_service "$llm"
    done
    sleep 2
}

stop_all() {
    echo -e "\n${BOLD}Stopping all AI services${NC}\n"

    for key in "${!SERVICES[@]}"; do
        # docling-fe, docling-be는 제외 (service toggle에서만 제어)
        [[ "$key" == "docling-fe" || "$key" == "docling-be" ]] && continue
        stop_service "$key"
    done

    echo -e "\n${GREEN}All AI services stopped${NC}"
    echo -e "${DIM}Note: docling-fe, docling-be는 별도 관리 (d 키로 토글)${NC}"
}

# ============================================================================
# 로그 뷰어
# ============================================================================

view_logs() {
    local key=$1
    shift
    local opt="${1:--n}"
    local lines="${2:-50}"

    local svc=""
    # 변형 서비스가 있는 경우 실제 실행 중인 서비스 찾기
    case "$key" in
        gpt)
            for variant in "llama-server-gpt-oss" "llama-server-gpt-oss-min" "llama-server-gpt-oss-llm"; do
                systemctl is-active --quiet "$variant.service" 2>/dev/null && { svc="$variant"; break; }
            done
            [ -z "$svc" ] && svc="llama-server-gpt-oss"
            ;;
        gemma3)
            svc="llama-server-gemma3"
            ;;
        exaone-4.0-32b)
            for variant in "exaone-4.0" "exaone-4.0-rag"; do
                systemctl is-active --quiet "$variant.service" 2>/dev/null && { svc="$variant"; break; }
            done
            [ -z "$svc" ] && svc="exaone-4.0"
            ;;
        qwen3vl)
            for variant in "llama-server-qwen3vl" "llama-server-qwen3vl-rag" "llama-server-qwen3vl-llm"; do
                systemctl is-active --quiet "$variant.service" 2>/dev/null && { svc="$variant"; break; }
            done
            [ -z "$svc" ] && svc="llama-server-qwen3vl"
            ;;
        *)
            svc="${SERVICES[$key]}"
            ;;
    esac

    [ -z "$svc" ] && { echo -e "${RED}Unknown service: $key${NC}"; return 1; }

    case "$opt" in
        -f|--follow) sudo journalctl -u "$svc.service" -f ;;
        -n|--lines)  sudo journalctl -u "$svc.service" -n "$lines" --no-pager ;;
        --today)     sudo journalctl -u "$svc.service" --since today --no-pager ;;
        -e|--errors) sudo journalctl -u "$svc.service" -p err --no-pager ;;
        *)           sudo journalctl -u "$svc.service" -n 50 --no-pager ;;
    esac
}

view_qdrant_logs() {
    local opt="${1:--n}"
    local lines="${2:-50}"

    case "$opt" in
        -f|--follow) sudo journalctl -u qdrant.service -f ;;
        -n|--lines)  sudo journalctl -u qdrant.service -n "$lines" --no-pager ;;
        -e|--errors) sudo journalctl -u qdrant.service -p err --no-pager ;;
        --today)     sudo journalctl -u qdrant.service --since today --no-pager ;;
        *)           sudo journalctl -u qdrant.service -n 50 --no-pager ;;
    esac
}

show_logs_menu() {
    clear
    print_header "Log Viewer (Live)"

    echo -e "\n${WHITE}Services${NC}"
    local i=1
    local keys=()
    for key in gpt exaone-4.0-32b qwen3vl embedding reranker docling docling-fe docling-be; do
        keys+=("$key")
        local info="${SERVICE_INFO[$key]}"
        IFS='|' read -r name port vram <<< "$info"
        local status=$(get_service_status "$key")
        local icon=$(get_status_icon "$status" "ok")
        printf "  ${BLUE}[%d]${NC} %b %-24s\n" "$i" "$icon" "$name"
        ((i++))
    done

    echo -e "\n${WHITE}Docker${NC}"
    if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "qdrant"; then
        printf "  ${BLUE}[9]${NC} ${GREEN}●${NC} Qdrant Vector DB\n"
    else
        printf "  ${BLUE}[9]${NC} ${DIM}○${NC} Qdrant Vector DB\n"
    fi

    echo -e "\n  ${YELLOW}[0]${NC} Back"
    echo -e "  ${DIM}Press Ctrl+C to exit live logs${NC}"
    echo ""
    read -p "Select: " choice

    case $choice in
        0) return ;;
        9) view_qdrant_logs -f ;;
        [1-8])
            local idx=$((choice - 1))
            [ $idx -lt ${#keys[@]} ] && view_logs "${keys[$idx]}" -f
            ;;
    esac
}

# ============================================================================
# 시스템 모니터링
# ============================================================================

progress_bar() {
    local pct=$1
    local width=30
    local filled=$((pct * width / 100))
    local empty=$((width - filled))
    printf "["
    [ $filled -gt 0 ] && printf "%${filled}s" | tr ' ' '='
    [ $empty -gt 0 ] && printf "%${empty}s" | tr ' ' '-'
    printf "] %3d%%" "$pct"
}

get_color_by_value() {
    local v=$1
    [ $v -ge 90 ] && echo -n "$RED" || { [ $v -ge 70 ] && echo -n "$YELLOW" || echo -n "$GREEN"; }
}

draw_monitor() {
    echo -ne "${CURSOR_HOME}"

    echo -e "${WHITE}╔══════════════════════════════════════════════════════════════════════════════╗${NC}"
    printf "${WHITE}║${NC}                    System Monitor - %s                    ${WHITE}║${NC}\n" "$(date '+%Y-%m-%d %H:%M:%S')"
    echo -e "${WHITE}╚══════════════════════════════════════════════════════════════════════════════╝${NC}"
    echo ""

    # CPU
    local cpu=$(top -bn1 | grep "Cpu(s)" | awk '{print int($2)}')
    local cpu_color=$(get_color_by_value "$cpu")
    echo -e "${CYAN}CPU${NC}${CLEAR_LINE}"
    printf "  Usage     ${cpu_color}"
    progress_bar "$cpu"
    echo -e "${NC}${CLEAR_LINE}"
    echo "${CLEAR_LINE}"

    # GPU
    if command -v nvidia-smi &>/dev/null; then
        local gpu_info=$(nvidia-smi --query-gpu=utilization.gpu,memory.used,memory.total,temperature.gpu,power.draw --format=csv,noheader,nounits 2>/dev/null)
        IFS=', ' read -r gpu_util mem_used mem_total gpu_temp gpu_power <<< "$gpu_info"

        local gpu_color=$(get_color_by_value "$gpu_util")
        local mem_pct=$((mem_used * 100 / mem_total))
        local mem_color=$(get_color_by_value "$mem_pct")
        local mem_used_gb=$(echo "scale=1; $mem_used/1024" | bc)
        local mem_total_gb=$(echo "scale=1; $mem_total/1024" | bc)

        echo -e "${CYAN}GPU (RTX 5090)${NC}${CLEAR_LINE}"
        printf "  Usage     ${gpu_color}"
        progress_bar "$gpu_util"
        echo -e "${NC}${CLEAR_LINE}"
        printf "  VRAM      ${mem_color}"
        progress_bar "$mem_pct"
        printf "${NC}  %5.1f / %5.1f GB${CLEAR_LINE}\n" "$mem_used_gb" "$mem_total_gb"
        printf "  Temp/Power: ${gpu_temp}°C / ${gpu_power}W${CLEAR_LINE}\n"

        # GPU Processes
        local procs=$(nvidia-smi --query-compute-apps=pid,process_name,used_memory --format=csv,noheader,nounits 2>/dev/null)
        if [ -n "$procs" ]; then
            echo -e "  ${WHITE}Processes:${NC}${CLEAR_LINE}"
            while IFS=',' read -r pid pname vram; do
                pid=$(echo "$pid" | tr -d ' ')
                vram=$(echo "$vram" | tr -d ' ' | grep -oE '^[0-9]+' || echo "0")
                [[ "$pid" =~ ^[0-9]+$ ]] || continue
                [[ "$vram" =~ ^[0-9]+$ ]] || vram=0
                local svc_name=$(get_service_name_from_process "$pid" "$pname")
                local vram_gb=$(echo "scale=1; $vram/1024" | bc 2>/dev/null || echo "0")
                printf "    %-12s %5.1f GB${CLEAR_LINE}\n" "$svc_name" "$vram_gb"
            done <<< "$procs"
        fi
        echo "${CLEAR_LINE}"
    fi

    # Memory
    local mem_info=$(free -m | awk 'NR==2{printf "%d %d %d", $3*100/$2, $3, $2}')
    read -r mem_pct mem_used mem_total <<< "$mem_info"
    local mem_color=$(get_color_by_value "$mem_pct")
    local mem_used_g=$(echo "scale=1; $mem_used/1024" | bc)
    local mem_total_g=$(echo "scale=1; $mem_total/1024" | bc)
    echo -e "${CYAN}Memory${NC}${CLEAR_LINE}"
    printf "  RAM       ${mem_color}"
    progress_bar "$mem_pct"
    printf "${NC}  %5.1f / %5.1f GB${CLEAR_LINE}\n" "$mem_used_g" "$mem_total_g"
    echo "${CLEAR_LINE}"

    # Disk
    echo -e "${CYAN}Disk${NC}${CLEAR_LINE}"
    for mnt in "/" "/models" "/data"; do
        local disk_info=$(df -h "$mnt" 2>/dev/null | awk 'NR==2{print $5" "$3" "$2}' | tr -d '%')
        [ -z "$disk_info" ] && continue
        read -r pct used total <<< "$disk_info"
        local disk_color=$(get_color_by_value "$pct")
        printf "  %-9s ${disk_color}" "$mnt"
        progress_bar "$pct"
        printf "${NC}  %-6s / %-6s${CLEAR_LINE}\n" "$used" "$total"
    done
    echo "${CLEAR_LINE}"

    # Services
    echo -e "${CYAN}Services${NC}${CLEAR_LINE}"

    # LLM row
    local gpt_s=$(get_service_status "gpt")
    local gpt_i=$(get_status_icon "$gpt_s" "ok")
    printf "  ${WHITE}LLM:${NC}    %b gpt-oss-20b${CLEAR_LINE}\n" "$gpt_i"

    # Aux row
    local qwe_s=$(get_service_status "qwen3vl")
    local doc_s=$(get_service_status "docling")
    local emb_s=$(get_service_status "embedding")
    local rer_s=$(get_service_status "reranker")
    local qwe_i=$(get_status_icon "$qwe_s" "ok")
    local doc_i=$(get_status_icon "$doc_s" "ok")
    local emb_i=$(get_status_icon "$emb_s" "ok")
    local rer_i=$(get_status_icon "$rer_s" "ok")
    printf "  ${WHITE}Aux:${NC}    %b Qwen3-VL     %b Docling      %b Embedding    %b Reranker${CLEAR_LINE}\n" "$qwe_i" "$doc_i" "$emb_i" "$rer_i"

    # Docker row
    local qdr_i="${DIM}○${NC}"
    docker ps --format '{{.Names}}' 2>/dev/null | grep -q "qdrant" && qdr_i="${GREEN}●${NC}"
    printf "  ${WHITE}Docker:${NC} %b Qdrant${CLEAR_LINE}\n" "$qdr_i"
    echo "${CLEAR_LINE}"

    echo -e "${WHITE}────────────────────────────────────────────────────────────────────────────${NC}${CLEAR_LINE}"
    echo -e "Interval: ${MONITOR_INTERVAL}s | Press Ctrl+C to exit${CLEAR_LINE}"
}

start_monitor() {
    MONITOR_INTERVAL=${1:-1}
    echo -ne "${CLEAR_SCREEN}${CURSOR_HOME}"
    tput civis
    trap 'tput cnorm; echo ""; exit 0' INT TERM

    while true; do
        draw_monitor
        sleep "$MONITOR_INTERVAL"
    done
}

# ============================================================================
# 메뉴
# ============================================================================

# 대시보드 화면 그리기 (커서 이동으로 깜빡임 방지)
draw_dashboard_screen() {
    echo -ne "${CURSOR_HOME}"

    local width=64
    echo -e "${CYAN}┌$(printf '─%.0s' $(seq 1 $width))┐${NC}${CLEAR_LINE}"
    printf "${CYAN}│${NC} ${BOLD}%-62s ${CYAN}│${NC}${CLEAR_LINE}\n" "AI Service Manager - $(date '+%H:%M:%S')"
    echo -e "${CYAN}└$(printf '─%.0s' $(seq 1 $width))┘${NC}${CLEAR_LINE}"
    echo "${CLEAR_LINE}"

    # VRAM 정보 캐시
    get_vram_info

    # Dashboard
    show_dashboard_inline

    # 리소스 경고
    show_resource_warnings_inline

    # Services Status
    echo -e "${CYAN}Services${NC}${CLEAR_LINE}"

    # LLM
    local gpt_s=$(get_service_status "gpt")
    local gemma3_s=$(get_service_status "gemma3")
    local exaone4_s=$(get_service_status "exaone-4.0-32b")
    local gpt_i=$(get_status_icon "$gpt_s" "$(check_api_health 8080)")
    local gemma3_i=$(get_status_icon "$gemma3_s" "$(check_api_health 8082)")
    local exaone4_i=$(get_status_icon "$exaone4_s" "$(check_api_health 8081)")
    printf "  ${WHITE}LLM:${NC}    %b gpt-20b  %b gemma3-27b  %b exaone-32b${CLEAR_LINE}\n" "$gpt_i" "$gemma3_i" "$exaone4_i"

    # Aux
    local qwe_s=$(get_service_status "qwen3vl")
    local doc_s=$(get_service_status "docling")
    local emb_s=$(get_service_status "embedding")
    local rer_s=$(get_service_status "reranker")
    local qwe_i=$(get_status_icon "$qwe_s" "$(check_api_health 8084)")
    local doc_i=$(get_status_icon "$doc_s" "$(check_api_health 8007)")
    local emb_i=$(get_status_icon "$emb_s" "$(check_api_health 8083)")
    local rer_i=$(get_status_icon "$rer_s" "$(check_api_health 8006)")
    printf "  ${WHITE}Aux:${NC}    %b Qwen3-VL      %b Docling       %b Embedding     %b Reranker${CLEAR_LINE}\n" "$qwe_i" "$doc_i" "$emb_i" "$rer_i"

    # Docling App & Docker
    local fe_s=$(get_service_status "docling-fe")
    local be_s=$(get_service_status "docling-be")
    local app_i="${DIM}○${NC}"
    [ "$fe_s" = "active" ] && [ "$be_s" = "active" ] && app_i="${GREEN}●${NC}"
    [ "$fe_s" = "active" ] || [ "$be_s" = "active" ] && [ "$app_i" = "${DIM}○${NC}" ] && app_i="${YELLOW}◐${NC}"

    local qdr_i="${DIM}○${NC}"
    docker ps --format '{{.Names}}' 2>/dev/null | grep -q "qdrant" && qdr_i="${GREEN}●${NC}"
    printf "  ${WHITE}App:${NC}    %b Docling App   ${WHITE}Docker:${NC} %b Qdrant${CLEAR_LINE}\n" "$app_i" "$qdr_i"

    # Mode Configuration 표시
    show_mode_config_inline

    # 동적 메뉴 그리기
    draw_dynamic_menu_inline "$gpt_s" "$qwe_s" "$doc_s" "$emb_s" "$rer_s"
}

# 대시보드 (인라인 버전 - 줄 끝 클리어)
show_dashboard_inline() {
    # CPU
    local cpu=$(top -bn1 | grep "Cpu(s)" | awk '{print int($2)}')
    local cpu_color=$(get_color_by_value "$cpu")

    # GPU
    local gpu_util=0 mem_used=0 mem_total=1 gpu_temp=0 gpu_power=0
    if command -v nvidia-smi &>/dev/null; then
        local gpu_info=$(nvidia-smi --query-gpu=utilization.gpu,memory.used,memory.total,temperature.gpu,power.draw --format=csv,noheader,nounits 2>/dev/null)
        IFS=', ' read -r gpu_util mem_used mem_total gpu_temp gpu_power <<< "$gpu_info"
    fi
    local gpu_color=$(get_color_by_value "$gpu_util")
    local mem_pct=$((mem_used * 100 / mem_total))
    local mem_color=$(get_color_by_value "$mem_pct")
    local mem_used_gb=$(echo "scale=1; $mem_used/1024" | bc)
    local mem_total_gb=$(echo "scale=1; $mem_total/1024" | bc)

    # RAM
    local ram_info=$(free -m | awk 'NR==2{printf "%d %d %d", $3*100/$2, $3, $2}')
    read -r ram_pct ram_used ram_total <<< "$ram_info"
    local ram_color=$(get_color_by_value "$ram_pct")
    local ram_used_g=$(echo "scale=1; $ram_used/1024" | bc)
    local ram_total_g=$(echo "scale=1; $ram_total/1024" | bc)

    # Disk
    local disk_root=$(df / | awk 'NR==2{print $5}' | tr -d '%')
    local disk_models=$(df /models 2>/dev/null | awk 'NR==2{print $5}' | tr -d '%' || echo "0")

    echo -e "${CYAN}System${NC}${CLEAR_LINE}"
    printf "  CPU: ${cpu_color}%3d%%${NC}   RAM: ${ram_color}%3d%%${NC} (%5.1f/%5.1fG)   Disk: / %d%%  /models %d%%${CLEAR_LINE}\n" \
        "$cpu" "$ram_pct" "$ram_used_g" "$ram_total_g" "$disk_root" "$disk_models"
    # GPU 게이지 생성 (15칸)
    local gpu_bar_width=15
    local gpu_filled=$((gpu_util * gpu_bar_width / 100))
    local gpu_empty=$((gpu_bar_width - gpu_filled))
    local gpu_bar="["
    [ $gpu_filled -gt 0 ] && gpu_bar+=$(printf "%${gpu_filled}s" | tr ' ' '=')
    [ $gpu_empty -gt 0 ] && gpu_bar+=$(printf "%${gpu_empty}s" | tr ' ' '-')
    gpu_bar+="]"
    printf "  GPU: ${gpu_color}${gpu_bar}%3d%%${NC}   VRAM: ${mem_color}%2d%%${NC} (%5.1f/%5.1fG)   Temp: %d°C${CLEAR_LINE}\n" \
        "$gpu_util" "$mem_pct" "$mem_used_gb" "$mem_total_gb" "$gpu_temp"

    # GPU Processes - 서비스별 VRAM 사용량 (% 포함)
    if command -v nvidia-smi &>/dev/null; then
        local procs=$(nvidia-smi --query-compute-apps=pid,process_name,used_memory --format=csv,noheader,nounits 2>/dev/null)
        if [ -n "$procs" ]; then
            echo -e "${CLEAR_LINE}"
            echo -e "  ${WHITE}VRAM by Service${NC}${CLEAR_LINE}"

            declare -a svc_names=() svc_vrams=() svc_pcts=()
            while IFS=',' read -r pid pname vram; do
                pid=$(echo "$pid" | tr -d ' ')
                vram=$(echo "$vram" | tr -d ' ' | grep -oE '^[0-9]+' || echo "0")
                [[ "$pid" =~ ^[0-9]+$ ]] || continue
                [[ "$vram" =~ ^[0-9]+$ ]] || vram=0
                local svc_name=$(get_service_name_from_process "$pid" "$pname")
                local vram_gb=$(echo "scale=1; $vram/1024" | bc 2>/dev/null || echo "0")
                local vram_pct=$((vram * 100 / mem_total))
                svc_names+=("$svc_name")
                svc_vrams+=("$vram_gb")
                svc_pcts+=("$vram_pct")
            done <<< "$procs"

            # 서비스별로 출력 (2열로 표시)
            local count=${#svc_names[@]} i=0
            while [ $i -lt $count ]; do
                local col1="" col2=""
                if [ $i -lt $count ]; then
                    local pct1=${svc_pcts[$i]}
                    local color1=$(get_color_by_value "$pct1")
                    col1=$(printf "  ${color1}%3d%%${NC} %-12s %5.1fG" "${svc_pcts[$i]}" "${svc_names[$i]}" "${svc_vrams[$i]}")
                fi
                if [ $((i+1)) -lt $count ]; then
                    local pct2=${svc_pcts[$((i+1))]}
                    local color2=$(get_color_by_value "$pct2")
                    col2=$(printf "  ${color2}%3d%%${NC} %-12s %5.1fG" "${svc_pcts[$((i+1))]}" "${svc_names[$((i+1))]}" "${svc_vrams[$((i+1))]}")
                fi
                echo -e "${col1}${col2}${CLEAR_LINE}"
                i=$((i+2))
            done
        else
            echo -e "${CLEAR_LINE}"
            echo -e "  ${DIM}No GPU processes${NC}${CLEAR_LINE}"
        fi
    fi
    echo "${CLEAR_LINE}"
}

# 리소스 경고 (인라인)
show_resource_warnings_inline() {
    local vram_pct=$((VRAM_USED * 100 / VRAM_TOTAL))
    local ram_pct=$(free | awk 'NR==2{printf "%d", $3*100/$2}')
    local has_warning=false

    if [ $vram_pct -ge 95 ]; then
        echo -e "  ${RED}⚠ VRAM 95%+ - 새 서비스 시작 불가${NC}${CLEAR_LINE}"
        has_warning=true
    elif [ $vram_pct -ge 85 ]; then
        echo -e "  ${YELLOW}⚠ VRAM 85%+ - 대형 모델 시작 불가${NC}${CLEAR_LINE}"
        has_warning=true
    fi

    if [ $ram_pct -ge 90 ]; then
        echo -e "  ${RED}⚠ RAM ${ram_pct}% - 시스템 메모리 부족${NC}${CLEAR_LINE}"
        has_warning=true
    fi

    $has_warning && echo "${CLEAR_LINE}"
}

# 동적 메뉴 (인라인)
draw_dynamic_menu_inline() {
    local gpt_s=$1 qwe_s=$2 doc_s=$3 emb_s=$4 rer_s=$5

    local active_llm=$(get_active_llm)
    local vram_free_gb=$(echo "scale=1; $VRAM_FREE/1024" | bc)

    echo -e "${CLEAR_LINE}"
    echo -e "${WHITE}─────────────────────────────────────────────────────────────────${NC}${CLEAR_LINE}"

    # 현재 상태에 따른 컨텍스트 정보 - 모든 활성 LLM 표시
    local active_llms=""
    local active_count=0
    for llm in "${LLM_SERVICES[@]}"; do
        local status=$(get_service_status "$llm")
        if [ "$status" = "active" ]; then
            local info="${SERVICE_INFO[$llm]}"
            IFS='|' read -r name port vram <<< "$info"
            [ $active_count -gt 0 ] && active_llms+=", "
            active_llms+="${name}(:${port})"
            ((active_count++))
        fi
    done

    if [ $active_count -gt 0 ]; then
        echo -e "${GREEN}▶${NC} ${WHITE}Active LLM:${NC} ${active_llms}${CLEAR_LINE}"
    else
        echo -e "${DIM}▷${NC} ${WHITE}No LLM running${NC} - ${DIM}Free: ${vram_free_gb}GB | 1)gpt-20b 8)gemma3-27b 9)exaone-32b${NC}${CLEAR_LINE}"
    fi

    # LLM Toggle
    echo -e "${CLEAR_LINE}"
    echo -e "${WHITE}LLM Toggle${NC}${CLEAR_LINE}"
    local llm_opts=""
    local gemma3_s=$(get_service_status "gemma3")
    local exaone4_s=$(get_service_status "exaone-4.0-32b")

    if [ "$gpt_s" = "active" ]; then
        llm_opts+="  ${GREEN}1) gpt-20b ●${NC}"
    elif can_start_service "gpt" || [ -n "$active_llm" ]; then
        llm_opts+="  1) gpt-20b"
    else
        llm_opts+="  ${DIM}1) gpt-20b (VRAM)${NC}"
    fi

    if [ "$gemma3_s" = "active" ]; then
        llm_opts+="   ${GREEN}8) gemma3-27b ●${NC}"
    elif can_start_service "gemma3" || [ -n "$active_llm" ]; then
        llm_opts+="   8) gemma3-27b"
    else
        llm_opts+="   ${DIM}8) gemma3-27b (VRAM)${NC}"
    fi

    if [ "$exaone4_s" = "active" ]; then
        llm_opts+="   ${GREEN}9) exaone-32b ●${NC}"
    elif can_start_service "exaone-4.0-32b" || [ -n "$active_llm" ]; then
        llm_opts+="   9) exaone-32b"
    else
        llm_opts+="   ${DIM}9) exaone-32b (VRAM)${NC}"
    fi
    echo -e "$llm_opts${CLEAR_LINE}"

    # Service Toggle
    echo -e "${CLEAR_LINE}"
    echo -e "${WHITE}Service Toggle${NC}${CLEAR_LINE}"
    local svc_opts1="" svc_opts2=""

    if [ "$qwe_s" = "active" ]; then
        svc_opts1+="  ${GREEN}2) Qwen3-VL ●${NC}"
    elif can_start_service "qwen3vl"; then
        svc_opts1+="  2) Qwen3-VL"
    else
        svc_opts1+="  ${DIM}2) Qwen3-VL (VRAM)${NC}"
    fi

    if [ "$doc_s" = "active" ]; then
        svc_opts1+="        ${GREEN}3) Docling ●${NC}"
    elif can_start_service "docling"; then
        svc_opts1+="        3) Docling API"
    else
        svc_opts1+="        ${DIM}3) Docling (VRAM)${NC}"
    fi

    local fe_s=$(get_service_status "docling-fe")
    local be_s=$(get_service_status "docling-be")
    if [ "$fe_s" = "active" ] && [ "$be_s" = "active" ]; then
        svc_opts1+="       ${GREEN}4) Docling App ●${NC}"
    else
        svc_opts1+="       4) Docling App"
    fi
    echo -e "$svc_opts1${CLEAR_LINE}"

    if [ "$emb_s" = "active" ]; then
        svc_opts2+="  ${GREEN}5) Embedding ●${NC}"
    else
        svc_opts2+="  5) BGE Embedding"
    fi

    if [ "$rer_s" = "active" ]; then
        svc_opts2+="      ${GREEN}6) Reranker ●${NC}"
    else
        svc_opts2+="      6) BGE Reranker"
    fi

    if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "qdrant"; then
        svc_opts2+="       ${GREEN}7) Qdrant ●${NC}"
    else
        svc_opts2+="       7) Qdrant"
    fi
    echo -e "$svc_opts2${CLEAR_LINE}"

    # Mode Switching
    echo -e "${CLEAR_LINE}"
    echo -e "${WHITE}Mode Switching${NC}${CLEAR_LINE}"
    echo -e "  ${CYAN}r) RAG mode${NC}  ${MAGENTA}t) GPT mode${NC}  ${GREEN}e) EXAONE mode${NC}  ${YELLOW}g) Gemma3 mode${NC}${CLEAR_LINE}"

    # Operations
    echo -e "${CLEAR_LINE}"
    echo -e "${WHITE}Operations${NC}${CLEAR_LINE}"
    local ops=""
    if [ -n "$active_llm" ]; then
        ops+="  a) Stop LLM"
    else
        ops+="  ${DIM}a) Stop LLM${NC}"
    fi

    local any_running=false
    for key in "${!SERVICES[@]}"; do
        [ "$(get_service_status "$key")" = "active" ] && any_running=true && break
    done
    if $any_running; then
        ops+="        b) Stop all"
    else
        ops+="        ${DIM}b) Stop all${NC}"
    fi
    ops+="        l) Logs            h) Help"
    echo -e "$ops${CLEAR_LINE}"

    # 권장 작업
    echo "${CLEAR_LINE}"
    if [ -z "$active_llm" ] && [ "$emb_s" != "active" ]; then
        echo -e "  ${CYAN}💡${NC} ${DIM}Tip: 1~3으로 LLM을 시작하거나, 7로 Embedding 서비스를 시작하세요${NC}${CLEAR_LINE}"
    elif [ -n "$active_llm" ] && [ "$emb_s" != "active" ] && can_start_service "embedding"; then
        echo -e "  ${CYAN}💡${NC} ${DIM}RAG 사용 시 7번으로 Embedding 서비스를 시작하세요${NC}${CLEAR_LINE}"
    elif [ "$emb_s" = "active" ] && [ "$rer_s" != "active" ] && can_start_service "reranker"; then
        echo -e "  ${CYAN}💡${NC} ${DIM}검색 품질 향상을 위해 8번으로 Reranker를 시작하세요${NC}${CLEAR_LINE}"
    else
        echo "${CLEAR_LINE}"
    fi

    echo -e "${CLEAR_LINE}"
    echo -e "  ${YELLOW}0) Exit${NC}   ${DIM}m) Monitor   (Auto-refresh: 1s)${NC}${CLEAR_LINE}"
    echo "${CLEAR_LINE}"
}

# 메인 메뉴 (1초 자동 새로고침)
show_menu() {
    echo -ne "${CLEAR_SCREEN}${CURSOR_HOME}"
    tput civis  # 커서 숨김

    # Ctrl+C 핸들러
    trap 'tput cnorm; echo ""; exit 0' INT TERM

    # 입력 핸들러
    local choice=""

    while true; do
        draw_dashboard_screen

        # 1초 대기하면서 입력 체크
        if read -t 1 -n 1 choice 2>/dev/null; then
            handle_menu_choice "$choice"

            # 종료가 아니면 계속
            if [ "$choice" != "0" ]; then
                echo -ne "${CLEAR_SCREEN}${CURSOR_HOME}"
                tput civis
            fi
        fi
    done
}

# 메뉴 선택 처리
handle_menu_choice() {
    local choice=$1

    # sudo가 필요한 작업 전에 커서 복원 (비밀번호 입력 시 필요)
    case $choice in
        1) tput cnorm; toggle_llm "gpt"; sleep 2; tput civis ;;
        2) tput cnorm; toggle_service "qwen3vl"; sleep 2; tput civis ;;
        3) tput cnorm; toggle_service "docling"; sleep 2; tput civis ;;
        4) tput cnorm; toggle_docling_app; sleep 2; tput civis ;;
        5) tput cnorm; toggle_service "embedding"; sleep 2; tput civis ;;
        6) tput cnorm; toggle_service "reranker"; sleep 2; tput civis ;;
        7) tput cnorm; toggle_qdrant; sleep 2; tput civis ;;
        8) tput cnorm; toggle_llm "gemma3"; sleep 2; tput civis ;;
        9) tput cnorm; toggle_llm "exaone-4.0-32b"; sleep 2; tput civis ;;
        a|A) tput cnorm; stop_all_llm; sleep 2; tput civis ;;
        b|B) tput cnorm; stop_all; sleep 2; tput civis ;;
        l|L) tput cnorm; show_logs_menu ;;
        m|M) tput cnorm; start_monitor 1 ;;
        r) tput cnorm; mode_rag; sleep 3; tput civis ;;
        t|T) tput cnorm; mode_gpt; sleep 3; tput civis ;;
        e|E) tput cnorm; mode_exaone; sleep 3; tput civis ;;
        g|G) tput cnorm; mode_gemma3; sleep 3; tput civis ;;
        R) ;;
        0) tput cnorm; echo ""; exit 0 ;;
        *) ;;
    esac
}

toggle_service() {
    local key=$1
    local status=$(get_service_status "$key")
    [ "$status" = "active" ] && stop_service "$key" || start_service "$key"
}

# LLM 개별 토글: 다른 LLM 중지 없이 독립적으로 시작/중지
toggle_llm() {
    local key=$1
    local status=$(get_service_status "$key")

    if [ "$status" = "active" ]; then
        # 실행 중이면 중지
        stop_service "$key"
    else
        # 중지 상태이면 시작 (다른 LLM 중지하지 않음)
        start_service "$key"
    fi
}

toggle_qdrant() {
    if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "qdrant"; then
        stop_qdrant
    else
        start_qdrant
    fi
}

start_qdrant() {
    echo -ne "${BLUE}Starting${NC} Qdrant (systemd)... "
    sudo systemctl start qdrant.service
    sleep 3
    if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "qdrant"; then
        echo -e "${GREEN}OK${NC}"
        echo -e "  ${DIM}http://localhost:6333${NC}"
        # ulimit 확인
        local ulimit_val=$(docker exec qdrant cat /proc/1/limits 2>/dev/null | grep "Max open files" | awk '{print $4}')
        echo -e "  ${DIM}ulimit nofile: ${ulimit_val}${NC}"
    else
        echo -e "${RED}FAILED${NC}"
    fi
}

stop_qdrant() {
    echo -ne "${BLUE}Stopping${NC} Qdrant... "
    sudo systemctl stop qdrant.service
    sleep 2
    echo -e "${GREEN}OK${NC}"
}

toggle_docling_app() {
    local fe=$(get_service_status "docling-fe")
    local be=$(get_service_status "docling-be")
    [ "$fe" = "active" ] || [ "$be" = "active" ] && stop_docling_app || start_docling_app
}

validate_service() {
    local key=$1
    [ -z "${SERVICES[$key]}" ] && { echo -e "${RED}Unknown service: $key${NC}"; return 1; }
    return 0
}

# ============================================================================
# 모드 전환 함수
# ============================================================================

# 현재 활성 모드 감지
detect_current_mode() {
    # EXAONE 4.0 standalone 모드 체크
    local exaone4=$(systemctl is-active exaone-4.0.service 2>/dev/null)
    if [ "$exaone4" = "active" ]; then
        echo "exaone4"
        return
    fi

    # Gemma3 standalone 모드 체크
    local gemma3=$(systemctl is-active llama-server-gemma3.service 2>/dev/null)
    if [ "$gemma3" = "active" ]; then
        echo "gemma3"
        return
    fi

    # GPT-OSS 변형 체크
    local gpt_llm=$(systemctl is-active llama-server-gpt-oss-llm.service 2>/dev/null)

    # GPT-OSS RAG 체크
    local gpt_rag=$(systemctl is-active llama-server-gpt-oss-min.service 2>/dev/null)

    # Qwen3-VL RAG 체크
    local qwen_rag=$(systemctl is-active llama-server-qwen3vl-rag.service 2>/dev/null)

    # RAG 모드: GPT-OSS rag + Qwen3-VL rag
    if [ "$gpt_rag" = "active" ] && [ "$qwen_rag" = "active" ]; then
        echo "rag"
        return
    fi

    # GPT 모드: GPT-OSS llm만 구동
    if [ "$gpt_llm" = "active" ]; then
        echo "gpt"
        return
    fi

    # 부분적 RAG 모드 (둘 중 하나만 실행 중)
    if [ "$gpt_rag" = "active" ] || [ "$qwen_rag" = "active" ]; then
        echo "rag-partial"
        return
    fi

    echo "none"
}

# 모드 테이블 본문 출력 (공통 함수)
_print_mode_table_rows() {
    local mode=$1
    local suffix=$2  # CLEAR_LINE 또는 빈 문자열
    case "$mode" in
        rag|rag-partial)
            echo -e "│ gpt-oss-20b  │ ${GREEN}16/2/8K${NC}   │ 128/16/8K │ ${DIM}-${NC}         │ ${DIM}-${NC}         │${suffix}"
            echo -e "│ gemma3-27b   │ ${DIM}-${NC}         │ ${DIM}-${NC}         │ ${DIM}-${NC}         │ 16/2/8K   │${suffix}"
            echo -e "│ exaone-32b   │ ${DIM}-${NC}         │ ${DIM}-${NC}         │ 16/2/8K   │ ${DIM}-${NC}         │${suffix}"
            echo -e "│ qwen3-vl     │ ${GREEN}16/2/8K${NC}   │ ${DIM}-${NC}         │ ${DIM}-${NC}         │ ${DIM}-${NC}         │${suffix}"
            ;;
        gpt|gpt-partial)
            echo -e "│ gpt-oss-20b  │ 16/2/8K   │ ${GREEN}128/16/8K${NC} │ ${DIM}-${NC}         │ ${DIM}-${NC}         │${suffix}"
            echo -e "│ gemma3-27b   │ ${DIM}-${NC}         │ ${DIM}-${NC}         │ ${DIM}-${NC}         │ 16/2/8K   │${suffix}"
            echo -e "│ exaone-32b   │ ${DIM}-${NC}         │ ${DIM}-${NC}         │ 16/2/8K   │ ${DIM}-${NC}         │${suffix}"
            echo -e "│ qwen3-vl     │ 16/2/8K   │ ${DIM}-${NC}         │ ${DIM}-${NC}         │ ${DIM}-${NC}         │${suffix}"
            ;;
        exaone4|exaone4-partial)
            echo -e "│ gpt-oss-20b  │ 16/2/8K   │ 128/16/8K │ ${DIM}-${NC}         │ ${DIM}-${NC}         │${suffix}"
            echo -e "│ gemma3-27b   │ ${DIM}-${NC}         │ ${DIM}-${NC}         │ ${DIM}-${NC}         │ 16/2/8K   │${suffix}"
            echo -e "│ exaone-32b   │ ${DIM}-${NC}         │ ${DIM}-${NC}         │ ${GREEN}16/2/8K${NC}   │ ${DIM}-${NC}         │${suffix}"
            echo -e "│ qwen3-vl     │ 16/2/8K   │ ${DIM}-${NC}         │ ${DIM}-${NC}         │ ${DIM}-${NC}         │${suffix}"
            ;;
        gemma3|gemma3-partial)
            echo -e "│ gpt-oss-20b  │ 16/2/8K   │ 128/16/8K │ ${DIM}-${NC}         │ ${DIM}-${NC}         │${suffix}"
            echo -e "│ gemma3-27b   │ ${DIM}-${NC}         │ ${DIM}-${NC}         │ ${DIM}-${NC}         │ ${GREEN}16/2/8K${NC}   │${suffix}"
            echo -e "│ exaone-32b   │ ${DIM}-${NC}         │ ${DIM}-${NC}         │ 16/2/8K   │ ${DIM}-${NC}         │${suffix}"
            echo -e "│ qwen3-vl     │ 16/2/8K   │ ${DIM}-${NC}         │ ${DIM}-${NC}         │ ${DIM}-${NC}         │${suffix}"
            ;;
        *)
            echo -e "│ gpt-oss-20b  │ 16/2/8K   │ 128/16/8K │ ${DIM}-${NC}         │ ${DIM}-${NC}         │${suffix}"
            echo -e "│ gemma3-27b   │ ${DIM}-${NC}         │ ${DIM}-${NC}         │ ${DIM}-${NC}         │ 16/2/8K   │${suffix}"
            echo -e "│ exaone-32b   │ ${DIM}-${NC}         │ ${DIM}-${NC}         │ 16/2/8K   │ ${DIM}-${NC}         │${suffix}"
            echo -e "│ qwen3-vl     │ 16/2/8K   │ ${DIM}-${NC}         │ ${DIM}-${NC}         │ ${DIM}-${NC}         │${suffix}"
            ;;
    esac
}

# 대시보드용 Mode Configuration (인라인)
show_mode_config_inline() {
    local current_mode=$(detect_current_mode)
    local CL="${CLEAR_LINE}"

    echo -e "${CL}"
    echo -e "${CYAN}Mode Configuration${NC} ${DIM}(c/p/n = context/parallel/n-predict)${NC}${CL}"
    echo -e "┌──────────────┬───────────┬───────────┬───────────┬───────────┐${CL}"
    echo -e "│ ${WHITE}Service${NC}      │ ${CYAN}r)RAG${NC}     │ ${MAGENTA}t)GPT${NC}     │ ${GREEN}e)EXAONE${NC}  │ ${YELLOW}g)GEMMA3${NC}  │${CL}"
    echo -e "├──────────────┼───────────┼───────────┼───────────┼───────────┤${CL}"
    _print_mode_table_rows "$current_mode" "$CL"
    echo -e "└──────────────┴───────────┴───────────┴───────────┴───────────┘${CL}"

    case "$current_mode" in
        rag) echo -e "  ${GREEN}>>>${NC} Current: ${CYAN}RAG Mode${NC} ${DIM}(document processing & retrieval)${NC}${CL}" ;;
        rag-partial) echo -e "  ${YELLOW}>>>${NC} Current: ${CYAN}RAG Mode${NC} ${YELLOW}(partial)${NC}${CL}" ;;
        gpt) echo -e "  ${GREEN}>>>${NC} Current: ${MAGENTA}GPT Mode${NC} ${DIM}(text generation & chat)${NC}${CL}" ;;
        gpt-partial) echo -e "  ${YELLOW}>>>${NC} Current: ${MAGENTA}GPT Mode${NC} ${YELLOW}(partial)${NC}${CL}" ;;
        exaone4) echo -e "  ${GREEN}>>>${NC} Current: ${GREEN}EXAONE 4.0 Mode${NC} ${DIM}(high-quality reasoning)${NC}${CL}" ;;
        gemma3) echo -e "  ${GREEN}>>>${NC} Current: ${YELLOW}Gemma3 Mode${NC} ${DIM}(multimodal reasoning)${NC}${CL}" ;;
        *) echo -e "  ${DIM}>>> No mode active${NC}${CL}" ;;
    esac
}

# 모드 전환 완료 시 표시
show_mode_config() {
    local current_mode=${1:-""}

    echo ""
    echo -e "${WHITE}Mode Configuration${NC} ${DIM}(c/p/n = context/parallel/n-predict)${NC}"
    echo -e "┌──────────────┬───────────┬───────────┬───────────┬───────────┐"
    echo -e "│ ${WHITE}Service${NC}      │ ${CYAN}r)RAG${NC}     │ ${MAGENTA}t)GPT${NC}     │ ${GREEN}e)EXAONE${NC}  │ ${YELLOW}g)GEMMA3${NC}  │"
    echo -e "├──────────────┼───────────┼───────────┼───────────┼───────────┤"
    _print_mode_table_rows "$current_mode" ""
    echo -e "└──────────────┴───────────┴───────────┴───────────┴───────────┘"

    case "$current_mode" in
        rag|rag-partial) echo -e "\n  ${GREEN}>>>${NC} Current: ${CYAN}RAG Mode${NC} - Document processing & retrieval" ;;
        gpt|gpt-partial) echo -e "\n  ${GREEN}>>>${NC} Current: ${MAGENTA}GPT Mode${NC} - Text generation & chat" ;;
        exaone4|exaone4-partial) echo -e "\n  ${GREEN}>>>${NC} Current: ${GREEN}EXAONE 4.0 Mode${NC} - High-quality reasoning" ;;
        gemma3|gemma3-partial) echo -e "\n  ${GREEN}>>>${NC} Current: ${YELLOW}Gemma3 Mode${NC} - Multimodal reasoning" ;;
    esac
}

# mode-rag: RAG 전용 모드 (EXAONE 32B rag + Qwen3-VL rag)
mode_rag() {
    echo -e "\n${BOLD}Switching to RAG mode...${NC}\n"

    # 1. 모든 LLM 변형 서비스 중지 (VRAM 확보)
    echo -e "${BLUE}Stopping${NC} all LLM variants for VRAM release..."
    stop_all_llm_variants
    echo -e "  ${GREEN}OK${NC}"

    # 2. VRAM 해제 대기
    wait_vram_release 20000 30
    if [ $? -ne 0 ]; then
        echo -e "${YELLOW}Warning: VRAM may be insufficient, attempting anyway...${NC}"
    fi

    # 3. GPT-OSS → RAG 모드로 전환 (ctx=16K, p=2, n=8K)
    echo -ne "${BLUE}Starting${NC} GPT-OSS 20B (RAG mode, ctx=16K p=2)... "
    sudo systemctl start llama-server-gpt-oss-min
    sleep 15
    if systemctl is-active --quiet llama-server-gpt-oss-min; then
        echo -e "${GREEN}OK${NC}"
    else
        echo -e "${RED}FAILED${NC}"
        return 1
    fi

    # 4. Qwen3-VL → RAG 모드로 전환 (ctx=16K, p=2, n=8K)
    echo -ne "${BLUE}Starting${NC} Qwen3-VL (RAG mode, ctx=16K p=2)... "
    sudo systemctl start llama-server-qwen3vl-rag
    sleep 5
    if systemctl is-active --quiet llama-server-qwen3vl-rag; then
        echo -e "${GREEN}OK${NC}"
    else
        echo -e "${RED}FAILED${NC}"
        return 1
    fi

    # 6. Docling Serve 시작 (문서 청킹에 필요)
    echo -ne "${BLUE}Starting${NC} Docling Serve... "
    sudo systemctl start docling-serve
    sleep 5
    if systemctl is-active --quiet docling-serve; then
        echo -e "${GREEN}OK${NC}"
    else
        echo -e "${YELLOW}WARN${NC} (optional)"
    fi

    # 7. RAG 지원 서비스 시작
    echo -ne "${BLUE}Starting${NC} BGE Embedding... "
    sudo systemctl start bge-embedding-server
    echo -e "${GREEN}OK${NC}"

    echo -ne "${BLUE}Starting${NC} BGE Reranker... "
    sudo systemctl start bge-reranker
    echo -e "${GREEN}OK${NC}"

    echo -ne "${BLUE}Starting${NC} Qdrant... "
    sudo systemctl start qdrant.service &>/dev/null
    sleep 2
    echo -e "${GREEN}OK${NC}"

    echo -e "\n${GREEN}RAG mode activated${NC}"
    show_mode_config "rag"
}

# mode-gpt: GPT 전용 모드 (GPT-OSS max + Qwen3-VL min)
mode_gpt() {
    echo -e "\n${BOLD}Switching to GPT mode...${NC}\n"

    # 1. 모든 LLM 변형 서비스 중지 (VRAM 확보)
    echo -e "${BLUE}Stopping${NC} all LLM variants for VRAM release..."
    stop_all_llm_variants
    echo -e "  ${GREEN}OK${NC}"

    # 2. VRAM 해제 대기 (GPT-OSS GPT 모드는 ~15GB 필요)
    wait_vram_release 15000 30
    if [ $? -ne 0 ]; then
        echo -e "${YELLOW}Warning: VRAM may be insufficient, attempting anyway...${NC}"
    fi

    # 3. GPT-OSS GPT 모드 시작 (ctx=128K, p=16, n=8K, KV cache q8_0)
    echo -ne "${BLUE}Starting${NC} GPT-OSS (GPT mode, ctx=128K p=16)... "
    sudo systemctl start llama-server-gpt-oss-llm
    sleep 10
    if systemctl is-active --quiet llama-server-gpt-oss-llm; then
        echo -e "${GREEN}OK${NC}"
    else
        echo -e "${RED}FAILED${NC}"
        echo -e "  ${DIM}Check logs: journalctl -u llama-server-gpt-oss-llm -n 50${NC}"
        return 1
    fi

    # 4. RAG 서비스 시작
    echo -ne "${BLUE}Starting${NC} BGE Embedding... "
    sudo systemctl start bge-embedding-server
    echo -e "${GREEN}OK${NC}"

    echo -ne "${BLUE}Starting${NC} BGE Reranker... "
    sudo systemctl start bge-reranker
    echo -e "${GREEN}OK${NC}"

    echo -ne "${BLUE}Starting${NC} Qdrant... "
    sudo systemctl start qdrant.service &>/dev/null
    sleep 2
    echo -e "${GREEN}OK${NC}"

    echo -e "\n${GREEN}GPT mode activated${NC}"
    show_mode_config "gpt"
}

# mode-exaone: EXAONE 4.0 전용 모드 (EXAONE 4.0 32B만 구동)
mode_exaone() {
    echo -e "\n${BOLD}Switching to EXAONE 4.0 mode...${NC}\n"

    # 1. 모든 기존 LLM 서비스 중지 (VRAM 확보)
    echo -e "${BLUE}Stopping${NC} all existing LLM services..."
    stop_all_llm_variants
    echo -e "  ${GREEN}OK${NC}"

    # 2. VRAM 해제 대기 (EXAONE 4.0 24K/3은 ~20GB 필요)
    wait_vram_release 20000 30
    if [ $? -ne 0 ]; then
        echo -e "${YELLOW}Warning: VRAM may be insufficient, attempting anyway...${NC}"
    fi

    # 3. EXAONE 4.0 32B 시작 (ctx=16K, p=2, n=8K)
    echo -ne "${BLUE}Starting${NC} EXAONE 32B (ctx=16K p=2)... "
    sudo systemctl start exaone-4.0.service
    sleep 15
    if systemctl is-active --quiet exaone-4.0.service; then
        echo -e "${GREEN}OK${NC}"
    else
        echo -e "${RED}FAILED${NC}"
        echo -e "  ${DIM}Check logs: journalctl -u exaone-4.0 -n 50${NC}"
        return 1
    fi

    # 4. 지원 서비스 시작
    echo -ne "${BLUE}Starting${NC} BGE Embedding... "
    sudo systemctl start bge-embedding-server
    echo -e "${GREEN}OK${NC}"

    echo -ne "${BLUE}Starting${NC} BGE Reranker... "
    sudo systemctl start bge-reranker
    echo -e "${GREEN}OK${NC}"

    echo -ne "${BLUE}Starting${NC} Qdrant... "
    sudo systemctl start qdrant.service &>/dev/null
    sleep 2
    echo -e "${GREEN}OK${NC}"

    echo -e "\n${GREEN}EXAONE 4.0 mode activated${NC}"
    show_mode_config "exaone4"
}

# mode-gemma3: Gemma3 전용 모드 (Gemma3 27B만 구동)
mode_gemma3() {
    echo -e "\n${BOLD}Switching to Gemma3 mode...${NC}\n"

    # 1. 모든 기존 LLM 서비스 중지 (VRAM 확보)
    echo -e "${BLUE}Stopping${NC} all existing LLM services..."
    stop_all_llm_variants
    echo -e "  ${GREEN}OK${NC}"

    # 2. VRAM 해제 대기 (Gemma3 27B Q4_0은 ~15GB 필요)
    wait_vram_release 15000 30
    if [ $? -ne 0 ]; then
        echo -e "${YELLOW}Warning: VRAM may be insufficient, attempting anyway...${NC}"
    fi

    # 3. Gemma3 27B 시작 (ctx=16K, p=2, n=8K)
    echo -ne "${BLUE}Starting${NC} Gemma3 27B (ctx=16K p=2)... "
    sudo systemctl start llama-server-gemma3.service
    sleep 15
    if systemctl is-active --quiet llama-server-gemma3.service; then
        echo -e "${GREEN}OK${NC}"
    else
        echo -e "${RED}FAILED${NC}"
        echo -e "  ${DIM}Check logs: journalctl -u llama-server-gemma3 -n 50${NC}"
        return 1
    fi

    # 4. 지원 서비스 시작
    echo -ne "${BLUE}Starting${NC} BGE Embedding... "
    sudo systemctl start bge-embedding-server
    echo -e "${GREEN}OK${NC}"

    echo -ne "${BLUE}Starting${NC} BGE Reranker... "
    sudo systemctl start bge-reranker
    echo -e "${GREEN}OK${NC}"

    echo -ne "${BLUE}Starting${NC} Qdrant... "
    sudo systemctl start qdrant.service &>/dev/null
    sleep 2
    echo -e "${GREEN}OK${NC}"

    echo -e "\n${GREEN}Gemma3 mode activated${NC}"
    show_mode_config "gemma3"
}

# ============================================================================
# 메인
# ============================================================================

# sudo 권한 미리 확보 (커서 숨김 상태에서 비밀번호 입력 문제 방지)
ensure_sudo

if [ $# -eq 0 ]; then
    show_menu
else
    CMD="$1"
    SVC="${2:-}"

    case "$CMD" in
        status) check_status; check_vram ;;
        monitor) start_monitor "${SVC:-1}" ;;
        logs)
            if [ -z "$SVC" ]; then
                show_logs_menu
            elif [ "$SVC" = "qdrant" ]; then
                shift 2; view_qdrant_logs "$@"
            else
                shift; view_logs "$@"
            fi
            ;;
        toggle) validate_service "$SVC" && toggle_service "$SVC" ;;
        start) validate_service "$SVC" && start_service "$SVC" ;;
        stop) validate_service "$SVC" && stop_service "$SVC" ;;
        restart) validate_service "$SVC" && restart_service "$SVC" ;;
        stop-llm) stop_all_llm ;;
        stop-all) stop_all ;;
        docling-app-start) start_docling_app ;;
        docling-app-stop) stop_docling_app ;;
        mode-rag) mode_rag ;;
        mode-gpt) mode_gpt ;;
        mode-exaone) mode_exaone ;;
        mode-gemma3) mode_gemma3 ;;
        exaone4|exaone-4.0-32b) toggle_llm "exaone-4.0-32b" ;;
        gpt|gemma3|qwen3vl|embedding|reranker|docling) toggle_service "$CMD" ;;
        qdrant) toggle_qdrant ;;
        qdrant-start) start_qdrant ;;
        qdrant-stop) stop_qdrant ;;
        *) echo -e "${RED}Unknown command: $CMD${NC}"; echo "Usage: $0 {status|start|stop|logs|mode-rag|mode-gpt|mode-exaone|qdrant|qdrant-start|qdrant-stop}"; exit 1 ;;
    esac
fi
