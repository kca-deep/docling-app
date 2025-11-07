# Docling Parse App Launch Script
# Runs both Backend (FastAPI) and Frontend (Next.js) simultaneously

Write-Host "Starting Docling Parse App..." -ForegroundColor Green
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

Write-Host ""
Write-Host "Starting servers..." -ForegroundColor Green
Write-Host "Backend: http://localhost:8000 (로그는 현재 터미널에 표시됩니다)" -ForegroundColor Cyan
Write-Host "Frontend: http://localhost:3000 (별도 창에서 실행됩니다)" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Ctrl+C to stop both servers" -ForegroundColor Yellow
Write-Host ""

# Start frontend in separate window
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$rootDir'; npm run dev"

# Start backend in current window (so we can see logs)
Start-Sleep -Seconds 2
Write-Host "=== Backend Server Starting ===" -ForegroundColor Green
Write-Host ""

& ".\backend\venv\Scripts\activate.ps1"
python -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
