# Docling Parse App Launch Script (Production Mode)
# Runs both Backend (FastAPI) and Frontend (Next.js) in production mode

# UTF-8 encoding setup for proper Korean character display
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
chcp 65001 | Out-Null

Write-Host "Starting Docling Parse App (Production Mode)..." -ForegroundColor Green
Write-Host ""

# Save current directory
$rootDir = Get-Location

# Check and create virtual environment in backend folder
if (-Not (Test-Path "backend\venv")) {
    Write-Host "Creating Python virtual environment in backend folder..." -ForegroundColor Yellow
    python -m venv backend\venv
}

# Check .env file
if (-Not (Test-Path "backend\.env")) {
    Write-Host "Creating .env file from .env.example..." -ForegroundColor Yellow
    Copy-Item "backend\.env.example" "backend\.env"
}

# Install Python dependencies
Write-Host "Installing Python dependencies..." -ForegroundColor Yellow
& "backend\venv\Scripts\python.exe" -m pip install -r backend\requirements.txt -q

# Check Node.js dependencies
if (-Not (Test-Path "node_modules")) {
    Write-Host "Installing Node.js dependencies..." -ForegroundColor Yellow
    npm install
}

# Build frontend for production
Write-Host ""
Write-Host "Building frontend for production..." -ForegroundColor Yellow
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "Frontend build failed. Exiting..." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Starting servers in production mode..." -ForegroundColor Green
Write-Host "Backend: http://localhost:8000 (logs shown in current terminal)" -ForegroundColor Cyan
Write-Host "Frontend: http://localhost:3000 (running in separate window)" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Ctrl+C to stop both servers" -ForegroundColor Yellow
Write-Host ""

# Start frontend in separate window (production mode)
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$rootDir'; npm start"

# Start backend in current window (production mode - no reload)
Start-Sleep -Seconds 2
Write-Host "=== Backend Server Starting (Production) ===" -ForegroundColor Green
Write-Host ""

& ".\backend\venv\Scripts\activate.ps1"
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000
