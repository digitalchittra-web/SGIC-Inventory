@echo off
title Inventory Management - Quick Restart
color 0A
cls

echo.
echo ========================================
echo   Inventory Management System
echo   QUICK RESTART
echo ========================================
echo.

REM Kill any existing processes on ports
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":3001"') do (
    echo Stopping old server on port 3001...
    taskkill /PID %%a /F /T >nul 2>&1
)

for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":517"') do (
    echo Stopping old frontend on port 517x...
    taskkill /PID %%a /F /T >nul 2>&1
)

echo Waiting for ports to clear...
timeout /t 3 /nobreak

echo.
echo Starting servers...
echo.

npm run dev

pause
