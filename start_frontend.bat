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
echo   WASI Frontend — Dev Server
echo ============================================
echo.
echo   API fallback order:
echo     1. window.WASI_API_URL (if set)
echo     2. localStorage.WASI_API_URL (if set)
echo     3. http://localhost:8000 (if running locally)
echo     4. https://wasi-backend-api.onrender.com (auto)
echo.
echo   IMPORTANT: Always open http://localhost:3000
echo   Never open index.html directly from file explorer.
echo.
echo   To force Render backend from browser console:
echo     localStorage.setItem("WASI_API_URL","https://wasi-backend-api.onrender.com");
echo     location.reload();
echo.
echo ============================================
echo.
call npm run dev
pause
