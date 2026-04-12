@echo off
REM OpSight - Run Script for Windows CMD
REM This script starts both backend and frontend services

echo Starting OpSight Dashboard...
echo.

REM Start backend in a new window
echo Starting Flask backend on port 5000...
start "OpSight Backend" cmd /k "cd backend && python app.py"

REM Wait for backend to initialize
echo Waiting for backend to start...
timeout /t 5 /nobreak >nul

REM Start frontend
echo Starting React frontend on port 3009...
echo.
echo ======================================
echo   OpSight Dashboard is starting...
echo   Frontend: http://localhost:3009
echo   Backend:  http://localhost:5000
echo ======================================
echo.

npm start

