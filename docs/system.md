서버 시스템 구성도 작성 정보 요약

  1. 하드웨어 계층

  ┌─────────────────────────────────────────────────────┐
  │  Hardware Infrastructure                            │
  ├─────────────────────────────────────────────────────┤
  │  GPU: NVIDIA GeForce RTX 5090                       │
  │  - VRAM: 32GB (30.75GB usable)                      │
  │  - 제약: 대형 모델 한 번에 하나만                      │
  │                                                     │
  │  Storage:                                           │
  │  - /models: 1.8TB (별도 파티션, 9% 사용)              │
  │  - Root partition: 시스템 및 애플리케이션              │
  └─────────────────────────────────────────────────────┘

  2. 서비스 계층 구조

  A. LLM 모델 서비스 (GPU 기반)

  | 서비스              | 포트   | VRAM  | 서버          | 동시실행 | 상태      | 특징           |
  |------------------|------|-------|-------------|------|---------|--------------|
  | 대형 모델 (상호 배타적)   |      |       |             |      |         |              |
  | GPT-OSS 20B Q6_K | 8080 | ~16GB | llama.cpp   | ✗    | -       | 추론 기능        |
  | EXAONE 32B       | 8081 | ~20GB | llama.cpp   | ✗    | -       | 131K 컨텍스트    |
  | HyperCLOVA X 14B | 8082 | ~29GB | vLLM 0.10.2 | ✗    | -       | 3가지 추론 모드    |
  | 소형 모델 (동시 실행 가능) |      |       |             |      |         |              |
  | Qwen3-VL 8B      | 8084 | ~2GB  | llama.cpp   | ✓    | Running | 멀티모달(Vision) |

  B. 임베딩 & 리랭킹 서비스

  | 서비스                | 포트   | VRAM   | 서버      | 상태       | 용도     |
  |--------------------|------|--------|---------|----------|--------|
  | BGE-M3 Embedding   | 8083 | <1GB   | FastAPI | Running  | 벡터 임베딩 |
  | BGE Reranker v2-m3 | 8006 | ~1-2GB | FastAPI | Inactive | 검색 재정렬 |

  C. 문서 처리 서비스

  | 서비스         | 포트   | 기술     | 상태  | 기능               |
  |-------------|------|--------|-----|------------------|
  | Docling API | 8007 | Python | -   | PDF/DOCX/PPTX 변환 |

  D. Docker 컨테이너 서비스

  Open WebUI (포트 3000)
  - 단순 채팅 인터페이스
  - LLM 백엔드 연결 (8080/8081/8082/8084)

  Dify AI Platform
  | 컴포넌트          | 포트      | 역할       | 외부 접근 |
  |---------------|---------|----------|-------|
  | Nginx         | 80, 443 | 리버스 프록시  | ✓     |
  | Web UI        | 3002    | 프론트엔드    | ✓     |
  | API           | 5001    | 백엔드 API  | ✓     |
  | Plugin Daemon | 5003    | 플러그인 런타임 | -     |
  | PostgreSQL    | 5432    | 데이터베이스   | 내부    |
  | Redis         | 6379    | 캐시       | 내부    |
  | Weaviate      | 8080    | 벡터 DB    | 내부    |
  | SSRF Proxy    | 3128    | 보안 프록시   | 내부    |
  | Worker/Beat   | -       | 백그라운드 작업 | 내부    |
  | Sandbox       | -       | 코드 실행 환경 | 내부    |

  3. 네트워크 구성

  외부 접근 포인트

  Domain: kca-ai.kro.kr
  ├─ :80, :443     → Nginx (Dify)
  ├─ :3002         → Dify Web UI
  └─ :5001         → Dify API

  IP: 112.173.179.199
  ├─ :8080         → GPT-OSS 20B
  ├─ :8081         → EXAONE 32B
  ├─ :8082         → HyperCLOVA X
  └─ :8084         → Qwen3-VL

  내부 네트워크

  Docker Network: ai-network
  - Open WebUI ↔ LLM backends
  - Dify services ↔ Internal communication

  4. 데이터 플로우 다이어그램

  [사용자]
      ↓
  ┌───────────────────────────────────────────┐
  │  Entry Points                             │
  ├───────────────────────────────────────────┤
  │  • kca-ai.kro.kr (Dify)                  │
  │  • localhost:3000 (Open WebUI)           │
  │  • 112.173.179.199:808X (Direct LLM)     │
  └───────────────────────────────────────────┘
      ↓
  ┌───────────────────────────────────────────┐
  │  Application Layer (Docker)               │
  ├───────────────────────────────────────────┤
  │  Nginx → Web UI → API → Workers          │
  │           ↓                               │
  │  PostgreSQL ← Redis → Weaviate            │
  └───────────────────────────────────────────┘
      ↓
  ┌───────────────────────────────────────────┐
  │  AI Services Layer                        │
  ├───────────────────────────────────────────┤
  │  [LLM Models]                             │
  │  • GPT-OSS 20B (8080)                    │
  │  • EXAONE 32B (8081)                     │
  │  • HyperCLOVA X (8082)                   │
  │  • Qwen3-VL 8B (8084) ✓                  │
  │                                           │
  │  [Support Services]                       │
  │  • BGE Embedding (8083) ✓                │
  │  • BGE Reranker (8006)                   │
  │  • Docling API (8007)                    │
  └───────────────────────────────────────────┘
      ↓
  ┌───────────────────────────────────────────┐
  │  GPU Layer                                │
  ├───────────────────────────────────────────┤
  │  RTX 5090 (32GB VRAM)                    │
  │  - 대형 모델: 1개만                        │
  │  - 소형 모델: 여러 개 동시 가능             │
  └───────────────────────────────────────────┘

  5. 디렉토리 구조

  /home/kca/
  ├── llama.cpp/                    # llama.cpp 바이너리
  ├── openwebui/                    # Open WebUI Docker
  │   ├── docker-compose.yml
  │   └── data/                     # 사용자 데이터
  ├── venv → /models/venv           # Python 환경 (심볼릭 링크)
  └── bge_embedding_server.py       # BGE 임베딩 서버

  /models/ (1.8TB 별도 파티션)
  ├── gpt-oss/                      # GPT-OSS 모델 (12GB)
  ├── exaone/                       # EXAONE 모델 (18GB)
  ├── qwen3-vl-gguf/               # Qwen3-VL 모델 (5.4GB)
  ├── huggingface/                  # HyperCLOVA X (28GB)
  ├── reranker/                     # BGE Reranker 모델
  │   ├── models/
  │   └── api/reranker_server.py
  ├── hcx-vllm-plugin/             # vLLM 플러그인
  └── venv/                        # Python 가상환경

  /opt/ai-platform/dify-official/docker/
  ├── docker-compose.yml           # Dify 구성
  ├── .env                         # 환경 설정
  └── volumes/                     # 영구 데이터
      ├── db/                      # PostgreSQL
      ├── app/                     # 업로드/로그
      └── redis/                   # Redis

  /etc/systemd/system/
  ├── llama-server-gpt-oss.service
  ├── llama-server-exaone.service
  ├── llama-server-qwen3vl.service
  ├── vllm-hyperclova.service
  ├── bge-embedding-server.service
  ├── bge-reranker.service
  └── docling-serve.service

  6. 서비스 관계도 (Mermaid)

  graph TB
      User[사용자] --> WebUI[Open WebUI :3000]
      User --> Dify[Dify Platform :3002]
      User --> DirectAPI[Direct LLM API :808X]

      WebUI --> LLM[LLM Services]
      Dify --> DifyAPI[Dify API :5001]
      DifyAPI --> LLM
      DifyAPI --> DB[(PostgreSQL)]
      DifyAPI --> Redis[(Redis)]
      DifyAPI --> Vector[(Weaviate)]

      DirectAPI --> LLM

      LLM --> GPU[RTX 5090 32GB VRAM]

      subgraph LLM Services
          GPT[GPT-OSS 20B :8080<br/>~16GB]
          EXAONE[EXAONE 32B :8081<br/>~20GB]
          HCX[HyperCLOVA X :8082<br/>~29GB]
          QWEN[Qwen3-VL 8B :8084<br/>~2GB ✓]
      end

      subgraph Support Services
          EMB[BGE Embedding :8083 ✓]
          RERANK[BGE Reranker :8006]
          DOC[Docling API :8007]
      end

      LLM --> GPU
      EMB --> GPU
      RERANK --> GPU

  7. 포트 맵 (전체)

  | 포트            | 서비스           | 프로토콜  | 외부  | 상태  | 용도      |
  |---------------|---------------|-------|-----|-----|---------|
  | LLM 모델        |               |       |     |     |         |
  | 8080          | GPT-OSS 20B   | HTTP  | ✓   | -   | 추론 LLM  |
  | 8081          | EXAONE 32B    | HTTP  | ✓   | -   | 장문맥 LLM |
  | 8082          | HyperCLOVA X  | HTTP  | ✓   | -   | 한국어 LLM |
  | 8084          | Qwen3-VL 8B   | HTTP  | ✓   | ✓   | 멀티모달    |
  | 지원 서비스        |               |       |     |     |         |
  | 8006          | BGE Reranker  | HTTP  | -   | -   | 재정렬     |
  | 8007          | Docling API   | HTTP  | -   | -   | 문서 변환   |
  | 8083          | BGE Embedding | HTTP  | -   | ✓   | 임베딩     |
  | Dify Platform |               |       |     |     |         |
  | 80            | Nginx HTTP    | HTTP  | ✓   | ✓   | 웹 서버    |
  | 443           | Nginx HTTPS   | HTTPS | ✓   | ✓   | 웹 서버    |
  | 3002          | Web UI        | HTTP  | ✓   | ✓   | 프론트엔드   |
  | 5001          | API           | HTTP  | ✓   | ✓   | 백엔드     |
  | 5003          | Plugin Daemon | HTTP  | -   | ✓   | 플러그인    |
  | 5432          | PostgreSQL    | TCP   | -   | ✓   | DB      |
  | 6379          | Redis         | TCP   | -   | ✓   | 캐시      |
  | 3128          | SSRF Proxy    | HTTP  | -   | ✓   | 프록시     |
  | 기타            |               |       |     |     |         |
  | 3000          | Open WebUI    | HTTP  | -   | ✓   | 채팅 UI   |

  8. GPU VRAM 할당 전략

  총 VRAM: 32GB (30.75GB 사용 가능)

  시나리오 A: 대형 모델 단독
  ├─ GPT-OSS 20B: 16GB
  └─ 남은 VRAM: 14GB → 소형 서비스 가능

  시나리오 B: 중형 모델 단독
  ├─ EXAONE 32B: 20GB
  └─ 남은 VRAM: 10GB → 소형 서비스 가능

  시나리오 C: 최대 모델
  ├─ HyperCLOVA X: 29GB
  └─ 남은 VRAM: 1GB → 다른 서비스 불가

  시나리오 D: 소형 모델만 (현재 상태)
  ├─ Qwen3-VL 8B: 2GB
  ├─ BGE Embedding: <1GB
  ├─ BGE Reranker: 1-2GB (필요시)
  └─ 남은 VRAM: 27GB → 대형 모델 추가 가능