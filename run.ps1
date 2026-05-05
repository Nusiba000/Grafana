# OpSight - Run Script for Windows PowerShell
# This script starts both backend and frontend services

Write-Host "Starting OpSight Dashboard..." -ForegroundColor Green
Write-Host ""

# Start backend in a new window
Write-Host "Starting Flask backend on port 5000..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\backend'; python app.py"

# Wait for backend to initialize
Write-Host "Waiting for backend to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Start frontend
Write-Host "Starting React frontend on port 3009..." -ForegroundColor Yellow
Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  OpSight Dashboard is starting..." -ForegroundColor Cyan
Write-Host "  Frontend: http://localhost:3009" -ForegroundColor Cyan
Write-Host "  Backend:  http://localhost:5000" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

npm start

