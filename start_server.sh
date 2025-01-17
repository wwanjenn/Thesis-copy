#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo -e "${RED}Error: Virtual environment not found${NC}"
    echo "Please run ./install.sh first"
    exit 1
fi

# Activate virtual environment
source venv/bin/activate

# Build the frontend (only needed when deploying new changes)
if [ "$1" == "build" ]; then
    echo "Building frontend..."
    cd frontend
    npm run build
    cd ..
fi

# Start the FastAPI backend
echo -e "${GREEN}Starting COCOMAT server...${NC}"
cd backend
python3.11 -m uvicorn app.main:app --host 0.0.0.0 --port 8000