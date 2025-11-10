# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a comprehensive RAG (Retrieval-Augmented Generation) pipeline application that processes documents through AI-powered parsing and integrates with multiple platforms. The system supports:
- **Document Parsing**: PDF, DOCX, PPTX conversion to markdown using Docling Serve API
- **Dify Integration**: Upload parsed documents to Dify AI knowledge bases
- **Qdrant Vector DB**: (Planned) Vector embeddings for semantic search
- **Multi-source Input**: File upload and URL-based document parsing

**Architecture:**
- **Backend**: FastAPI application with SQLite database for persistence
- **Frontend**: Next.js 16 App Router with multiple specialized pages
- **External Services**: Docling Serve (parsing), Dify (AI platform), Qdrant (planned vector DB)

The document processing workflow:
1. Parse documents via Docling Serve async API (3-phase: submit → poll → retrieve)
2. Store parsed markdown and metadata in SQLite
3. Optionally upload to Dify knowledge bases with configuration management
4. (Planned) Generate embeddings and store in Qdrant for semantic search

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
├── main.py                         # FastAPI app, CORS, startup events
├── database.py                     # SQLAlchemy engine, session, Base model
├── config/
│   └── settings.py                 # Pydantic settings from .env
├── models/
│   ├── schemas.py                  # Pydantic request/response models
│   ├── document.py                 # Document SQLAlchemy model
│   ├── dify_config.py              # Dify configuration model
│   └── dify_upload_history.py      # Dify upload history model
├── services/
│   ├── docling_service.py          # Docling Serve API client
│   ├── document_crud.py            # Document database operations
│   ├── dify_service.py             # Dify API client
│   ├── dify_config_crud.py         # Dify config CRUD
│   └── dify_history_crud.py        # Dify upload history CRUD
└── api/routes/
    ├── document.py                 # /api/documents/* endpoints
    └── dify.py                     # /api/dify/* endpoints
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

## Frontend Architecture

The frontend is a Next.js 16 App Router application with multi-page structure:

```
app/
├── page.tsx              # Landing page with hero section and feature cards
├── parse/page.tsx        # Document upload and parsing UI
├── url-parse/page.tsx    # URL-based document parsing
├── dify/page.tsx         # Dify integration management
├── qdrant/page.tsx       # Qdrant vector DB UI (in development)
└── layout.tsx            # Root layout with theme provider

components/
├── ui/                   # shadcn/ui components (radix-ui primitives)
├── nav-header.tsx        # Navigation bar with theme toggle
├── page-container.tsx    # Consistent page layout wrapper
└── theme-provider.tsx    # next-themes dark mode support
```

**Tech Stack**:
- **React 19.2.0** with Next.js 16.0.1 App Router
- **Styling**: Tailwind CSS 4 with class-variance-authority
- **UI Components**: shadcn/ui (Radix UI primitives)
- **Icons**: lucide-react
- **Form Management**: react-hook-form + zod validation
- **Theming**: next-themes for dark/light mode

**Key Pages**:
1. **`/`** - Hero landing page with 5-step process visualization
2. **`/parse`** - Multi-file upload with batch processing and markdown preview
3. **`/url-parse`** - URL input for remote document parsing
4. **`/dify`** - Configuration management, dataset selection, document upload to Dify
5. **`/qdrant`** - (Planned) Vector DB collection management and semantic search

**Data Flow**:
- All API calls go to `http://localhost:8000` (hardcoded)
- Client-side state with React hooks (no global state management)
- Toast notifications via `sonner` library

## Configuration

**Backend Environment Variables** (`backend/.env`):
- `DATABASE_URL`: SQLite database path (default: `sqlite:///./docling.db`)
- `DOCLING_BASE_URL`: Docling Serve API base URL (`http://kca-ai.kro.kr:8007`)
- `ALLOWED_ORIGINS`: JSON array of CORS origins (default: `["http://localhost:3000", "http://localhost:3001"]`)
- `POLL_INTERVAL`: Docling status polling interval in seconds (default: 2)
- `MAX_UPLOAD_SIZE_MB`: Max file upload size in MB (default: 50)
- `ALLOWED_EXTENSIONS`: JSON array of file extensions (default: `[".pdf", ".docx", ".doc", ".pptx", ".ppt"]`)

**Planned Qdrant Environment Variables** (see `docs/qdrant-integration-design.md`):
- `QDRANT_URL`: Qdrant server URL (`http://kca-ai.kro.kr:6333`)
- `EMBEDDING_URL`: BGE-M3 embedding server URL (`http://kca-ai.kro.kr:8080`)
- `EMBEDDING_DIMENSION`: Vector dimension (1024 for BGE-M3)

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

**System**:
- `GET /` - API info (service name, version, status)
- `GET /health` - Health check

**Qdrant Integration** (Planned - see `docs/qdrant-integration-design.md`):
- Collection management, document vectorization, semantic search

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
- `xlsx` - Excel file handling

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
- **NO HARDCODING**: Never hardcode values like URLs, API keys, ports, or configuration values in code. Always use environment variables or configuration files.
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
