@echo off
setlocal
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
echo   WASI Frontend - Dev Server
echo ============================================
echo.
echo   Single URL only: http://localhost:3000
echo.
echo ============================================
echo.
start "WASI Frontend 3000" cmd /k "cd /d C:\Users\KaboreTarawendesida\OneDrive\Desktop\WASI && npm run dev"
timeout /t 3 /nobreak >nul
start "" http://localhost:3000

echo Opened: http://localhost:3000
echo If needed, press Ctrl+F5.
echo.
endlocal
