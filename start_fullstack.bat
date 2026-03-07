@echo off
cd /d C:\Users\KaboreTarawendesida\OneDrive\Desktop\WASI

echo Installing dependencies if needed...
call npm install
if errorlevel 1 (
  echo npm install failed.
  pause
  exit /b 1
)

echo.
echo ============================================
echo   WASI Banking + Frontend (Full Stack)
echo ============================================
echo.
echo   Frontend: http://localhost:3000
echo   Banking API health: http://localhost:8010/api/health
echo.
echo   Banking app: http://localhost:3000/
echo   WASI terminal: http://localhost:3000/?app=wasi
echo.
echo ============================================
echo.
call npm run dev:full
pause
