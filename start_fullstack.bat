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
echo   WASI Full Stack Launcher
echo ============================================
echo.
echo   Single URL: http://localhost:3000
echo   API health: http://localhost:8010/api/health
echo.
echo   Starting backend ^(8010^) and frontend ^(3000^) in separate windows...
echo ============================================
echo.

start "WASI API 8010" cmd /k "cd /d C:\Users\KaboreTarawendesida\OneDrive\Desktop\WASI && npm run server"
start "WASI Frontend 3000" cmd /k "cd /d C:\Users\KaboreTarawendesida\OneDrive\Desktop\WASI && npm run dev"

timeout /t 4 /nobreak >nul
start "" http://localhost:3000

echo.
echo Opened: http://localhost:3000
echo If the page is blank, press Ctrl+F5 in browser.
echo.
endlocal
