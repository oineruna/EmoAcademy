@echo off
setlocal
title EmoAcademy local server

cd /d "%~dp0"

echo.
echo ========================================
echo   EmoAcademy local server
echo ========================================
echo.

if not exist "package.json" (
  echo [ERROR] package.json was not found.
  echo Run this file inside the EmoAcademy folder.
  echo.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npm was not found. Please install Node.js.
  echo https://nodejs.org/
  echo.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo [INFO] Installing dependencies. This is needed only once.
  call npm install
  if errorlevel 1 (
    echo.
    echo [ERROR] npm install failed.
    pause
    exit /b 1
  )
)

echo [INFO] Browser will open in a few seconds.
start "" powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command "Start-Sleep -Seconds 5; Start-Process 'http://localhost:3004/dashboard'"

echo [INFO] Starting server...
echo [INFO] URL: http://localhost:3004/dashboard
echo [INFO] To stop the server, press Ctrl + C in this window.
echo.

call npm run dev:local

echo.
echo [INFO] Server stopped.
pause
