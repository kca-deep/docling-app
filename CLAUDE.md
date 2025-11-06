# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a document parsing application that integrates with Docling Serve API. The architecture consists of:
- **Backend**: FastAPI application that acts as a proxy to Docling Serve API
- **Frontend**: Next.js application with a file upload interface

The backend handles asynchronous document conversion through a three-step process:
1. Submit document to Docling Serve async API
2. Poll for task completion status
3. Retrieve and return parsed results

## Running the Application

**Full Stack (Recommended)**:
```powershell
.\run-app.ps1
```
This script starts both backend (port 8000) and frontend (port 3000) simultaneously.

**Backend Only**:
```bash
# Activate virtual environment
.\venv\Scripts\activate  # Windows
source venv/bin/activate  # Linux/Mac

# Run FastAPI server
python -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

**Frontend Only**:
```bash
npm run dev
```

**Build**:
```bash
npm run build  # Frontend production build
npm start      # Serve production build
```

## Backend Architecture

The backend follows a layered architecture pattern:

```
backend/
├── main.py                    # FastAPI app entry point, CORS configuration
├── config/settings.py         # Centralized configuration using pydantic-settings
├── models/schemas.py          # Pydantic models for request/response validation
├── services/docling_service.py # Business logic for Docling API integration
└── api/routes/document.py     # HTTP endpoints
```

**Key Design Patterns**:
- **Service Layer**: `DoclingService` encapsulates all Docling Serve API interactions
- **Async/Await**: All external API calls use httpx AsyncClient
- **Configuration Management**: Environment variables loaded via pydantic-settings
- **Three-Phase Workflow**: Task submission -> Status polling -> Result retrieval

**Critical Integration Details**:
- Docling Serve API base URL: `http://kca-ai.kro.kr:8007`
- Async API endpoint: `/v1/convert/file/async` (POST with multipart file)
- Status polling: `/v1/status/poll/{task_id}` (GET with wait parameter)
- Result retrieval: `/v1/result/{task_id}` (GET)
- Default poll interval: 2 seconds (configurable via POLL_INTERVAL)

## Frontend Architecture

The frontend is a Next.js 16 App Router application with:
- **Single Page UI**: `app/page.tsx` contains the entire upload/result interface
- **Client-Side State**: React hooks manage file upload, loading states, and results
- **Tailwind CSS**: Utility-first styling with dark mode support
- **Lucide Icons**: Icon library for UI elements

**Data Flow**:
1. User uploads file via form
2. Frontend POSTs to `http://localhost:8000/api/documents/convert`
3. Backend handles async Docling API workflow
4. Frontend displays markdown preview and metadata

## Configuration

**Backend Environment Variables** (`backend/.env`):
- `DOCLING_BASE_URL`: Docling Serve API base URL
- `ALLOWED_ORIGINS`: CORS origins (must include frontend URL)
- `POLL_INTERVAL`: Status polling interval in seconds
- `MAX_UPLOAD_SIZE`: File size limit in bytes

Copy `backend/.env.example` to `backend/.env` before first run.

**Important Notes**:
- Backend expects to be imported as a module (`backend.main:app`), not run directly
- Frontend assumes backend is at `http://localhost:8000` (hardcoded in page.tsx)
- The virtual environment should be in project root as `venv/`, not `backend/venv/`

## API Endpoints

**Backend REST API**:
- `POST /api/documents/convert` - Upload and convert document (multipart/form-data)
  - Request: `file` (binary), `target_type` (string, default: "inbody")
  - Response: ConvertResult with task_id, status, document data
- `GET /api/documents/status/{task_id}` - Check task status
- `GET /health` - Health check endpoint

## Testing

A standalone test script exists at `test_docling_serve_api.py` that:
- Tests direct Docling Serve API integration
- Saves results to `docu/` folder as markdown and JSON
- Processes multiple PDFs from `docu/sample*.pdf`

Run independently:
```bash
python test_docling_serve_api.py
```

## Dependencies

**Python** (backend/requirements.txt):
- fastapi - Web framework
- uvicorn - ASGI server
- httpx - Async HTTP client for external API calls
- pydantic/pydantic-settings - Data validation and settings
- python-multipart - File upload handling

**Node.js** (package.json):
- next 16.0.1 - React framework
- react 19.2.0 - UI library
- lucide-react - Icons
- tailwindcss 4 - Styling

## Code Conventions

- Backend code contains Korean comments (legacy from initial development)
- Frontend uses English for UI text
- All external-facing API responses use English keys
- Type hints required for all Python functions
- Pydantic models for all API request/response schemas
