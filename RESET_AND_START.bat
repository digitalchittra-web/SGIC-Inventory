@echo off
title Inventory Management - Reset & Start
color 0A
cls

echo.
echo ========================================
echo   Inventory Management System
echo   RESETTING DATABASE...
echo ========================================
echo.

REM Kill any existing processes
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":3001"') do taskkill /PID %%a /F /T >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":517"') do taskkill /PID %%a /F /T >nul 2>&1

REM Wait for processes to close
timeout /t 3 /nobreak

REM Delete old database files
echo Deleting old database...
del /Q inventory.db >nul 2>&1
del /Q inventory.db-shm >nul 2>&1
del /Q inventory.db-wal >nul 2>&1

echo.
echo Starting servers with fresh database...
echo.

REM Start the app
npm run dev

pause
