#!/bin/bash
# OpSight - Run Script for Linux/Mac
# This script starts both backend and frontend services

echo "Starting OpSight Dashboard..."
echo ""

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Start backend in background
echo "Starting Flask backend on port 5000..."
cd "$SCRIPT_DIR/backend"
python3 app.py &
BACKEND_PID=$!

# Wait for backend to initialize
echo "Waiting for backend to start..."
sleep 5

# Start frontend
echo "Starting React frontend on port 3009..."
echo ""
echo "======================================"
echo "  OpSight Dashboard is starting..."
echo "  Frontend: http://localhost:3009"
echo "  Backend:  http://localhost:5000"
echo "======================================"
echo ""

cd "$SCRIPT_DIR"
npm start

# Cleanup function
cleanup() {
    echo ""
    echo "Shutting down services..."
    kill $BACKEND_PID 2>/dev/null
    exit
}

# Set trap to cleanup on exit
trap cleanup EXIT INT TERM

