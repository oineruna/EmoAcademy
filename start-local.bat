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

echo [INFO] Checking whether EmoAcademy is already running...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$urls=@('http://127.0.0.1:3004/dashboard','http://localhost:3004/dashboard'); foreach($url in $urls){try{$response=Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 2; if($response.StatusCode -ge 200 -and $response.StatusCode -lt 500){Start-Process $url; exit 10}}catch{}}; exit 0"
if errorlevel 10 (
  echo [INFO] EmoAcademy is already running. Browser opened.
  echo [INFO] URL: http://127.0.0.1:3004/dashboard or http://localhost:3004/dashboard
  echo.
  pause
  exit /b 0
)

echo [INFO] Browser will open when the server is ready.
start "" powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command "$urls=@('http://127.0.0.1:3004/dashboard','http://localhost:3004/dashboard'); for ($i=0; $i -lt 90; $i++) { foreach ($url in $urls) { try { $response=Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 2; if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) { Start-Process $url; exit 0 } } catch {} }; Start-Sleep -Seconds 1 }; Start-Process $urls[0]"

echo [INFO] Starting server...
echo [INFO] URL: http://127.0.0.1:3004/dashboard
echo [INFO] To stop the server, press Ctrl + C in this window.
echo.

call npm run dev:local

echo.
echo [INFO] Server stopped.
pause
