@echo off
REM Kill any existing Node processes
for /f "tokens=5" %%a in ('netstat -ano ^| find ":3001"') do taskkill /PID %%a /F /T 2>nul
for /f "tokens=5" %%a in ('netstat -ano ^| find ":5173"') do taskkill /PID %%a /F /T 2>nul
for /f "tokens=5" %%a in ('netstat -ano ^| find ":5174"') do taskkill /PID %%a /F /T 2>nul
for /f "tokens=5" %%a in ('netstat -ano ^| find ":5175"') do taskkill /PID %%a /F /T 2>nul
REM Wait for ports to be released
timeout /t 3 /nobreak
REM Start the app
npm run dev
