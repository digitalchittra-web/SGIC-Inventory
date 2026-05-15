@echo off
title Inventory Management System
color 0A
cls
echo.
echo ========================================
echo   Inventory Management System
echo ========================================
echo.
echo Checking for running processes...
echo.

REM Kill any processes using the ports
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":3001"') do (
    echo Stopping old process on port 3001...
    taskkill /PID %%a /F /T >nul 2>&1
)

for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":517"') do (
    echo Stopping old process on port 517x...
    taskkill /PID %%a /F /T >nul 2>&1
)

timeout /t 2 /nobreak

echo.
echo Starting servers...
echo.
npm run dev

pause
