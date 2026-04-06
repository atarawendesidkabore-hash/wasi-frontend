@echo off
setlocal

set DESKTOP=C:\Users\KaboreTarawendesida\OneDrive\Desktop
set WASI=%DESKTOP%\WASI
set BACKEND=%DESKTOP%\wasi-backend-api

echo ============================================
echo   WASI Central Stack Launcher
echo ============================================
echo.
echo This will start:
echo  1) wasi-backend-api (FastAPI) on port 8000
echo  2) WASI frontend + banking API (Vite + Node)
echo.

start "wasi-backend-api" cmd /k "cd /d %BACKEND% && call start_server.bat"
start "WASI Fullstack" cmd /k "cd /d %WASI% && call start_fullstack.bat"

echo Launch commands sent.
echo.
echo Single URL: http://localhost:3000
echo FastAPI health: http://localhost:8000/api/health
echo Banking API health: http://localhost:8010/api/health
endlocal
