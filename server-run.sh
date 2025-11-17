#!/bin/bash
# Docling Parse App Launch Script (Production Mode)
# Runs both Backend (FastAPI) and Frontend (Next.js) in production mode

# Color codes for output
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting Docling Parse App (Production Mode)...${NC}"
echo ""

# Save current directory
ROOT_DIR=$(pwd)

# Check and create virtual environment in backend folder
if [ ! -d "backend/venv" ]; then
    echo -e "${YELLOW}Creating Python virtual environment in backend folder...${NC}"
    python3 -m venv backend/venv
fi

# Check .env file
if [ ! -f "backend/.env" ]; then
    echo -e "${YELLOW}Creating .env file from .env.example...${NC}"
    cp backend/.env.example backend/.env
fi

# Install Python dependencies
echo -e "${YELLOW}Installing Python dependencies...${NC}"
backend/venv/bin/python -m pip install -r backend/requirements.txt -q

# Check Node.js dependencies
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing Node.js dependencies...${NC}"
    npm install
fi

# Build frontend for production
echo ""
echo -e "${YELLOW}Building frontend for production...${NC}"
npm run build

if [ $? -ne 0 ]; then
    echo -e "${RED}Frontend build failed. Exiting...${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}Starting servers in production mode...${NC}"
echo -e "${CYAN}Backend: http://localhost:8000${NC}"
echo -e "${CYAN}Frontend: http://localhost:3000${NC}"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop both servers${NC}"
echo ""

# Cleanup function to kill both processes on exit
cleanup() {
    echo ""
    echo -e "${YELLOW}Shutting down servers...${NC}"
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null
    fi
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null
    fi
    exit 0
}

# Set up trap to catch Ctrl+C and other termination signals
trap cleanup SIGINT SIGTERM

# Start frontend in background
echo -e "${GREEN}=== Frontend Server Starting (Production) ===${NC}"
npm start &
FRONTEND_PID=$!
echo "Frontend PID: $FRONTEND_PID"
echo ""

# Wait a bit for frontend to start
sleep 2

# Start backend in foreground (so we can see logs)
echo -e "${GREEN}=== Backend Server Starting (Production) ===${NC}"
echo ""

# Activate virtual environment and start backend
source backend/venv/bin/activate
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

# Wait for backend process
wait $BACKEND_PID
