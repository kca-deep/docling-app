# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a comprehensive RAG (Retrieval-Augmented Generation) pipeline application that processes documents through AI-powered parsing and integrates with multiple platforms. The system supports:
- **Document Parsing**: PDF, DOCX, PPTX conversion to markdown using Docling Serve API (with Qwen3-VL OCR fallback)
- **Vector Database**: Qdrant for semantic search with BGE-M3 embeddings
- **RAG Chat System**: Multi-LLM support with streaming responses and source citation
- **Reranking**: BGE Reranker v2-m3 for improved search accuracy
- **Dify Integration**: Upload parsed documents to Dify AI knowledge bases
- **Multi-source Input**: File upload and URL-based document parsing

**Architecture:**
- **Backend**: FastAPI application with SQLite database for persistence
- **Frontend**: Next.js 16 App Router with multiple specialized pages
- **External Services**:
  - Docling Serve (parsing) - Port 8007
  - Qwen3-VL 8B (OCR fallback) - Port 8084
  - BGE-M3 (embeddings) - Port 8083
  - BGE Reranker v2-m3 (reranking) - Port 8006
  - Multiple LLMs (GPT-OSS 20B, EXAONE 32B, HyperCLOVA X) - Ports 8080-8082
  - Qdrant Vector DB - Port 6333
  - Dify AI Platform - Ports 80, 443, 3002, 5001

The complete document-to-answer workflow:
1. Parse documents via Docling Serve async API (3-phase: submit → poll → retrieve)
   - Fallback to Qwen3-VL OCR if parsing fails or quality is low
2. Post-process markdown (table recovery, section detection, page number tracking)
3. Store parsed markdown and metadata in SQLite
4. Chunk documents using Docling Serve chunking API
5. Generate BGE-M3 embeddings (1024-dimensional vectors)
6. Upload vectors to Qdrant with metadata
7. Optionally upload to Dify knowledge bases
8. Query via RAG chat system:
   - Retrieve relevant chunks from Qdrant (initial top_k × 5)
   - Rerank with BGE Reranker v2-m3 (if enabled)
   - Generate response with LLM (streaming support)
   - Cite sources with page numbers

## Running the Application

**Full Stack (Recommended)**:
```powershell
.\run-app.ps1
```
This PowerShell script:
- Creates Python virtual environment in `backend/venv/` if missing
- Copies `backend/.env.example` to `backend/.env` if needed
- Installs Python and Node.js dependencies
- Starts frontend in separate window (port 3000)
- Starts backend in current terminal (port 8000)

**Backend Only**:
```bash
# Windows
.\backend\venv\Scripts\activate
python -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000

# Linux/Mac
source backend/venv/bin/activate
python -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```
**IMPORTANT**: Virtual environment is at `backend/venv/`, not project root.

**Frontend Only**:
```bash
npm run dev    # Development server (port 3000)
npm run build  # Production build
npm start      # Serve production build
```

## Backend Architecture

The backend follows a layered architecture with service-repository pattern:

```
backend/
├── main.py                              # FastAPI app, CORS, startup events
├── database.py                          # SQLAlchemy engine, session, Base model
├── config/
│   └── settings.py                      # Pydantic settings from .env
├── models/
│   ├── schemas.py                       # Pydantic request/response models
│   ├── document.py                      # Document SQLAlchemy model
│   ├── dify_config.py                   # Dify configuration model
│   ├── dify_upload_history.py           # Dify upload history model
│   └── qdrant_upload_history.py         # Qdrant upload history model
├── services/
│   ├── docling_service.py               # Docling Serve API client
│   ├── qwen3_service.py                 # Qwen3-VL OCR service (fallback)
│   ├── postprocess_service.py           # Markdown post-processing
│   ├── chunking_service.py              # Document chunking
│   ├── embedding_service.py             # BGE-M3 embedding generation
│   ├── reranker_service.py              # BGE Reranker v2-m3 client
│   ├── qdrant_service.py                # Qdrant vector DB operations
│   ├── llm_service.py                   # LLM API client (multi-model)
│   ├── rag_service.py                   # RAG pipeline orchestration
│   ├── prompt_loader.py                 # System prompt management
│   ├── document_crud.py                 # Document database operations
│   ├── dify_service.py                  # Dify API client
│   ├── dify_config_crud.py              # Dify config CRUD
│   ├── dify_history_crud.py             # Dify upload history CRUD
│   ├── qdrant_history_crud.py           # Qdrant upload history CRUD
│   └── progress_tracker.py              # Upload progress tracking
└── api/routes/
    ├── document.py                      # /api/documents/* endpoints
    ├── dify.py                          # /api/dify/* endpoints
    ├── qdrant.py                        # /api/qdrant/* endpoints
    └── chat.py                          # /api/chat/* endpoints (RAG)
```

**Key Design Patterns**:
- **Service Layer**: Business logic isolated from HTTP layer (e.g., `DoclingService`, `DifyService`)
- **CRUD Repositories**: Database operations separated into `*_crud.py` modules
- **Async/Await**: All external API calls use `httpx.AsyncClient`
- **Dependency Injection**: Database sessions via `Depends(get_db)`
- **Startup Hooks**: Database initialization via `@app.on_event("startup")`

**Database Persistence**:
- SQLite database at `./docling.db` (root directory)
- Models imported in `main.py` to register with SQLAlchemy
- All parsed documents stored with full markdown content
- Dify configurations support multiple named profiles

**Docling Serve Integration**:
- Base URL: `http://kca-ai.kro.kr:8007`
- Three-phase async workflow:
  1. POST `/v1/convert/file/async` - Submit file
  2. GET `/v1/status/poll/{task_id}?wait=2` - Poll status
  3. GET `/v1/result/{task_id}` - Retrieve result
- Default poll interval: 2 seconds (configurable via `POLL_INTERVAL`)

**Dify Integration**:
- Dataset listing, document upload, and configuration management
- Upload history tracked in database with success/failure status
- Supports multiple Dify API configurations with named profiles

**Qdrant Vector DB**:
- Collection management (create, list, delete)
- Document vectorization with BGE-M3 embeddings (1024-dimensional)
- Batch upload with progress tracking
- Metadata storage (document_id, page_number, source, chunk_index)
- Semantic search with score threshold filtering

**RAG Pipeline**:
- Multi-service orchestration: Embedding → Qdrant → Reranking → LLM
- System prompt management per collection (stored in `backend/prompts/{collection_name}.txt`)
- Three reasoning levels: low (concise), medium (balanced), high (detailed with reasoning)
- Streaming and non-streaming response modes
- Chat history support for multi-turn conversations
- Regenerate capability (reuse search results, regenerate answer with different parameters)

**Qwen3-VL OCR Fallback**:
- Activated when Docling parsing fails or produces low-quality output
- Processes PDF pages as images using Vision-Language model
- Preserves Korean characters, tables, and special formatting
- Configured via system prompt in settings

## Frontend Architecture

The frontend is a Next.js 16 App Router application with multi-page structure:

```
app/
├── page.tsx                     # Landing page with hero, process flow, chat preview
├── parse/page.tsx               # Document upload and parsing UI
├── url-parse/page.tsx           # URL-based document parsing
├── dify/page.tsx                # Dify integration management
├── qdrant/page.tsx              # Qdrant vector DB management (upload, collections)
├── chat/page.tsx                # RAG chat interface
│   └── components/
│       ├── ChatContainer.tsx    # Main chat layout
│       ├── MessageList.tsx      # Message history display
│       ├── MessageBubble.tsx    # Individual message component
│       ├── InputArea.tsx        # User input with settings
│       ├── SourcePanel.tsx      # Retrieved documents display
│       └── SettingsPanel.tsx    # LLM parameters configuration
├── system-architecture/page.tsx # System overview and architecture
└── layout.tsx                   # Root layout with theme provider

components/
├── ui/                          # shadcn/ui components (radix-ui primitives)
├── nav-header.tsx               # Navigation bar with theme toggle
├── page-container.tsx           # Consistent page layout wrapper
├── theme-provider.tsx           # next-themes dark mode support
├── chat-preview.tsx             # Chat demo for landing page
└── floating-chat-button.tsx     # Quick access to chat page
```

**Tech Stack**:
- **React 19.2.0** with Next.js 16.0.1 App Router
- **Styling**: Tailwind CSS 4 with class-variance-authority
- **UI Components**: shadcn/ui (Radix UI primitives)
- **Icons**: lucide-react
- **Form Management**: react-hook-form + zod validation
- **Theming**: next-themes for dark/light mode

**Key Pages**:
1. **`/`** - Hero landing page with 5-step process visualization and chat preview
2. **`/parse`** - Multi-file upload with batch processing and markdown preview
3. **`/url-parse`** - URL input for remote document parsing
4. **`/qdrant`** - Vector DB collection management, document upload with progress tracking
5. **`/dify`** - Configuration management, dataset selection, document upload to Dify
6. **`/chat`** - RAG chat interface with streaming responses, source citations, and settings panel
7. **`/system-architecture`** - System infrastructure visualization

**Data Flow**:
- All API calls go to `http://localhost:8000` (hardcoded)
- Client-side state with React hooks (no global state management)
- Toast notifications via `sonner` library

## External AI Infrastructure

This application relies on multiple external AI services running on a shared GPU server (RTX 5090 32GB VRAM). See `docs/system.md` for detailed infrastructure information.

**Available LLM Models** (Port 8080-8082, mutually exclusive due to VRAM):
- **GPT-OSS 20B** (Port 8080): ~16GB VRAM, general-purpose inference
- **EXAONE 32B** (Port 8081): ~20GB VRAM, 131K context window for long documents
- **HyperCLOVA X 14B** (Port 8082): ~29GB VRAM, Korean-optimized, 3 inference modes

**Always-On Services**:
- **Qwen3-VL 8B** (Port 8084): ~2GB VRAM, multimodal vision-language model for OCR
- **BGE-M3 Embedding** (Port 8083): <1GB VRAM, 1024-dimensional embeddings

**Optional Services**:
- **BGE Reranker v2-m3** (Port 8006): 1-2GB VRAM, improves search accuracy (can run with small models)
- **Docling Serve** (Port 8007): Document parsing API (PDF/DOCX/PPTX → Markdown)

**External Platforms**:
- **Qdrant Vector DB** (Port 6333): Vector storage and semantic search
- **Dify Platform** (Ports 80, 443, 3002, 5001): Full-stack AI platform with web UI

**VRAM Management Strategy**:
- Large models (GPT-OSS/EXAONE/HyperCLOVA) are mutually exclusive
- Small models (Qwen3-VL, BGE-M3) can run alongside any large model
- Reranker can be enabled/disabled based on available VRAM
- Current default: Qwen3-VL + BGE-M3 (leaves ~27GB for a large LLM)

## Configuration

**Backend Environment Variables** (`backend/.env`):

Core Settings:
- `DATABASE_URL`: SQLite database path (default: `sqlite:///./docling.db`)
- `ALLOWED_ORIGINS`: JSON array of CORS origins (default: `["http://localhost:3000", "http://localhost:3001"]`)
- `MAX_UPLOAD_SIZE_MB`: Max file upload size in MB (default: 50)
- `ALLOWED_EXTENSIONS`: JSON array of file extensions (default: `[".pdf", ".docx", ".doc", ".pptx", ".ppt"]`)
- `POLL_INTERVAL`: Docling status polling interval in seconds (default: 2)

Document Processing:
- `DOCLING_BASE_URL`: Docling Serve API base URL (`http://kca-ai.kro.kr:8007`)
- `DOCLING_CHUNKING_URL`: Chunking API URL (same as Docling by default)
- `DEFAULT_CHUNK_SIZE`: Chunk size for splitting (default: 500)
- `DEFAULT_CHUNK_OVERLAP`: Overlap between chunks (default: 50)

Qwen3-VL OCR (Fallback):
- `QWEN3_VL_BASE_URL`: Qwen3-VL API URL (`http://localhost:8084`)
- `QWEN3_VL_MODEL`: Model name (`qwen3-vl-8b`)
- `QWEN3_VL_TIMEOUT`: Request timeout in seconds (default: 120)
- `QWEN3_VL_MAX_PAGES`: Max pages to process (default: 50)
- `QWEN3_VL_OCR_PROMPT`: System prompt for OCR extraction (long Korean/English prompt)

Vector Database:
- `QDRANT_URL`: Qdrant server URL (`http://kca-ai.kro.kr:6333`)
- `QDRANT_API_KEY`: Optional API key
- `DEFAULT_COLLECTION_NAME`: Default collection name (default: `documents`)

Embeddings:
- `EMBEDDING_URL`: BGE-M3 embedding server URL (`http://kca-ai.kro.kr:8083`)
- `EMBEDDING_MODEL`: Model name (`bge-m3-korean`)
- `EMBEDDING_DIMENSION`: Vector dimension (1024 for BGE-M3)

Reranking:
- `RERANKER_URL`: BGE Reranker API URL (`http://kca-ai.kro.kr:8006`)
- `RERANKER_MODEL`: Model name (`BAAI/bge-reranker-v2-m3`)
- `USE_RERANKING`: Enable/disable reranking (default: True)
- `RERANK_TOP_K_MULTIPLIER`: Initial retrieval multiplier (default: 5)
- `RERANK_SCORE_THRESHOLD`: Minimum relevance score (default: 0.5)

LLM:
- `LLM_BASE_URL`: LLM API base URL (`http://kca-ai.kro.kr:8080`)
- `LLM_MODEL`: Model name (`gpt-oss-20b`)
- `LLM_DEFAULT_TEMPERATURE`: Default temperature (default: 0.7)
- `LLM_DEFAULT_MAX_TOKENS`: Default max tokens (default: 2000)
- `LLM_DEFAULT_TOP_P`: Default top_p (default: 0.9)

RAG:
- `RAG_DEFAULT_TOP_K`: Number of documents to retrieve (default: 5)
- `RAG_DEFAULT_SCORE_THRESHOLD`: Minimum similarity score (optional)
- `RAG_DEFAULT_REASONING_LEVEL`: low/medium/high (default: medium)
- `PROMPTS_DIR`: Custom prompts directory (default: `backend/prompts/`)

Copy `backend/.env.example` to `backend/.env` before first run.

**Important Notes**:
- Backend must be imported as module: `python -m uvicorn backend.main:app`
- Virtual environment location: `backend/venv/` (NOT project root)
- Frontend hardcodes backend URL to `http://localhost:8000`
- SQLite database created at project root as `docling.db`

## API Endpoints

**Document Parsing** (`/api/documents/`):
- `POST /convert` - Upload and convert document (multipart/form-data)
  - Request: `file` (binary), `target_type` (string, default: "inbody")
  - Response: ConvertResult with task_id, status, markdown content, metadata
- `GET /status/{task_id}` - Check conversion task status
- `GET /` - List all parsed documents (supports pagination: `skip`, `limit`)
- `GET /{document_id}` - Get specific document by ID
- `DELETE /{document_id}` - Delete document from database

**Dify Integration** (`/api/dify/`):
- `POST /config` - Save new Dify configuration (api_key, base_url, config_name)
- `GET /config` - List all saved Dify configurations
- `GET /config/{config_id}` - Get specific configuration
- `PUT /config/{config_id}` - Update configuration
- `DELETE /config/{config_id}` - Delete configuration
- `POST /datasets` - List datasets for given Dify configuration
- `POST /upload` - Upload documents to Dify dataset
  - Request: `config_id`, `dataset_id`, `document_ids[]`
  - Response: Upload results with success/failure per document
- `GET /upload-history` - Query upload history (supports filters: `document_id`, `dataset_id`)

**Qdrant Integration** (`/api/qdrant/`):
- `GET /collections` - List all Qdrant collections with metadata
- `POST /collections` - Create new collection
  - Request: `collection_name`, optional `vector_size`, `distance`
- `DELETE /collections/{collection_name}` - Delete collection
- `POST /upload` - Upload documents to Qdrant
  - Request: `collection_name`, `document_ids[]`, `chunk_size`, `chunk_overlap`
  - Response: Upload results with progress tracking
  - Process: Fetch documents → Chunk → Embed → Upload to Qdrant
- `GET /upload-history` - Query upload history (supports filters)
- `POST /search` - Semantic search in collection
  - Request: `collection_name`, `query`, `top_k`, `score_threshold`
  - Response: Scored documents with metadata

**RAG Chat** (`/api/chat/`):
- `POST /` - Non-streaming chat (JSON response)
  - Request: `collection_name`, `message`, `reasoning_level`, LLM parameters, `chat_history`
  - Response: `answer`, `retrieved_docs[]`, `usage`
- `POST /stream` - Streaming chat (SSE response)
  - Same request format as non-streaming
  - Response: Server-Sent Events with chunks
- `POST /regenerate` - Regenerate answer with same search results
  - Request: `query`, `retrieved_docs[]`, LLM parameters
  - Response: New answer with original sources
- `GET /collections` - List available Qdrant collections for chat

**System**:
- `GET /` - API info (service name, version, status)
- `GET /health` - Health check

## Testing and Development Scripts

**`test_docling_serve_api.py`**:
- Direct integration test for Docling Serve API
- Processes sample PDFs and saves results as markdown/JSON
- Useful for testing Docling API without running full stack

**`test_dify_api.py`**:
- Direct integration test for Dify API
- Tests dataset listing and API structure
- Contains API key (should be moved to environment variable)

Run independently:
```bash
python test_docling_serve_api.py
python test_dify_api.py
```

## Dependencies

**Python** (`backend/requirements.txt`):
- `fastapi` 0.115.0 - Web framework
- `uvicorn[standard]` 0.32.0 - ASGI server
- `httpx` 0.27.2 - Async HTTP client for external APIs
- `pydantic` 2.9.2 - Data validation
- `pydantic-settings` 2.6.0 - Environment variable management
- `python-multipart` 0.0.12 - File upload handling
- `python-dotenv` 1.0.1 - .env file loading
- `sqlalchemy` 2.0.36 - ORM and database toolkit
- `alembic` 1.14.0 - Database migrations
- `qdrant-client` ≥1.7.0 - Qdrant vector DB client
- `PyMuPDF` ≥1.25.3 - PDF processing for Qwen3-VL
- `Pillow` ≥11.0.0 - Image processing

**Node.js** (`package.json`):
- `next` 16.0.1 - React framework with App Router
- `react` 19.2.0 / `react-dom` 19.2.0 - UI library
- `@radix-ui/*` - Headless UI primitives (accordion, dialog, select, etc.)
- `lucide-react` - Icon library
- `tailwindcss` 4 - Utility-first CSS
- `react-hook-form` + `@hookform/resolvers` - Form state management
- `zod` 4.1.12 - Schema validation
- `next-themes` - Dark mode support
- `sonner` - Toast notifications
- `exceljs` - Excel file handling (for export)
- `react-markdown` - Markdown rendering in chat
- `react-resizable-panels` - Split panel layout

## Code Conventions and Patterns

**Language Usage**:
- Backend code contains Korean comments (docstrings and inline comments)
- Frontend UI text is in Korean (user-facing)
- API request/response field names use English (snake_case)
- All external API integrations use English

**Python Backend**:
- Type hints required for all function signatures
- Pydantic models for all API request/response schemas
- Async/await pattern for all I/O operations
- Service classes instantiated at module level (singleton pattern)
- Database models inherit from `Base` in `database.py`
- CRUD functions accept `db: Session` as first parameter

**TypeScript Frontend**:
- Client components use `"use client"` directive
- Fetch API for backend communication (no axios)
- Form validation with `react-hook-form` + `zod` schemas
- UI components from `@/components/ui/` (shadcn pattern)
- State management via React hooks (no Redux/Zustand)

**File Naming**:
- Backend: `snake_case.py`
- Frontend: `kebab-case.tsx` for components, `page.tsx` for routes
- Database models: Singular noun (e.g., `document.py`, not `documents.py`)
- Services: `{resource}_service.py` or `{resource}_crud.py`

## Development Guidelines for Claude Code

**Critical Rules**:
- **[CRITICAL] ABSOLUTELY NO HARDCODING**:
  - **NEVER** hardcode ANY fixed values in code. This includes:
    - URLs, API endpoints, ports
    - API keys, secrets, credentials
    - Configuration values, timeouts, limits
    - **Specific data values (e.g., "10:00", "2년", "1회")**
    - **Domain-specific text that should be dynamic**
  - **WHY THIS MATTERS**: Hardcoded values make code inflexible, unmaintainable, and can cause unexpected behavior with different data
  - **ALWAYS** use:
    - Environment variables for configuration
    - Configuration files for settings
    - Dynamic pattern matching instead of fixed replacements
    - Context-aware processing instead of fixed values
  - **Example of WRONG approach**:
    ```python
    # NEVER DO THIS
    content = content.replace("년간", "2년간")  # Hardcoded replacement
    ```
  - **Example of CORRECT approach**:
    ```python
    # DO THIS INSTEAD
    # Detect missing patterns and handle dynamically
    if detect_missing_number_pattern(content):
        content = apply_context_aware_recovery(content)
    ```
- **NO EMOJIS**: Do not use emojis in code, comments, commit messages, or documentation unless explicitly requested by the user.

**MCP Tool Usage**:
When working on this codebase, leverage the following MCP (Model Context Protocol) servers:

1. **shadcn MCP** - For UI improvements and component additions:
   - Use `mcp__shadcn__search_items_in_registries` to find components
   - Use `mcp__shadcn__get_item_examples_from_registries` for usage examples
   - Use `mcp__shadcn__get_add_command_for_items` to get installation commands
   - Always check available shadcn/ui components before creating custom UI components

2. **context7 MCP** - For feature implementation with up-to-date library documentation:
   - Use `mcp__context7__resolve-library-id` to find the correct library ID
   - Use `mcp__context7__get-library-docs` to fetch current documentation
   - Consult library docs before implementing features with external libraries
   - Particularly useful for FastAPI, React, Next.js, SQLAlchemy patterns

3. **sequential-thinking MCP** - For complex problem-solving and debugging:
   - Use `mcp__sequential-thinking__sequentialthinking` when encountering errors
   - Apply when refactoring complex code or implementing multi-step features
   - Break down problems into thought steps with hypothesis generation and verification
   - Iterate until reaching a satisfactory solution

**When to Use Each MCP**:
- Building new UI features? → Check shadcn MCP first for existing components
- Implementing API endpoints or database logic? → Query context7 MCP for best practices
- Debugging errors or refactoring complex code? → Use sequential-thinking MCP for systematic analysis
- All three can be used together for comprehensive feature development

## Architectural Decisions

**Why SQLite over PostgreSQL?**
- Simplicity for single-server deployment
- No separate database server required
- Sufficient for document metadata and configuration storage
- File-based backup and migration

**Why No Global State Management?**
- Each page is relatively independent
- React hooks sufficient for local state
- Avoids complexity of Redux/Zustand setup

**Why Service Layer Pattern?**
- Isolates business logic from HTTP handlers
- Easier to test and mock external APIs
- Reusable across multiple routes

**Why Multiple Dify Configurations?**
- Supports different environments (dev/staging/prod)
- Multiple projects with different API keys
- Team collaboration with separate workspaces

## RAG Pipeline Architecture

The RAG (Retrieval-Augmented Generation) system follows a multi-stage pipeline:

**Stage 1: Document Ingestion**
1. Parse document with Docling Serve (or fallback to Qwen3-VL OCR)
2. Post-process markdown (table recovery, section detection)
3. Store in SQLite with metadata

**Stage 2: Vectorization**
1. Chunk document using Docling chunking API (hierarchical, semantic-aware)
2. Generate BGE-M3 embeddings (1024-dimensional vectors)
3. Upload to Qdrant with metadata (document_id, page_number, chunk_index)

**Stage 3: Query Processing (Chat)**
1. User sends query to `/api/chat/stream` or `/api/chat/`
2. Select collection and reasoning level (low/medium/high)
3. Load collection-specific system prompt from `backend/prompts/{collection_name}.txt`

**Stage 4: Retrieval**
1. Generate query embedding with BGE-M3
2. Search Qdrant for similar chunks (top_k × RERANK_TOP_K_MULTIPLIER if reranking enabled)
3. Filter by score_threshold

**Stage 5: Reranking (Optional)**
1. Send query + retrieved chunks to BGE Reranker v2-m3
2. Rerank by relevance score
3. Filter by RERANK_SCORE_THRESHOLD
4. Keep top_k results

**Stage 6: Generation**
1. Build prompt with system instructions + reasoning level + retrieved chunks + chat history
2. Send to LLM (streaming or non-streaming)
3. Stream response back to client as SSE
4. Include retrieved documents with sources in response

**Special Features**:
- **Regenerate**: Reuse search results, only regenerate answer with different parameters
- **Chat History**: Multi-turn conversations with context preservation
- **Source Citation**: Every retrieved chunk includes document name, page number, score
- **Streaming**: Real-time token-by-token response display
