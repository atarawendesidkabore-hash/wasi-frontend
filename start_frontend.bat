@echo off
cd /d C:\Users\KaboreTarawendesida\OneDrive\Desktop\WASI
echo Starting WASI Frontend on http://localhost:3000
echo Make sure the backend is running on http://localhost:8000
echo.
python -m http.server 3000
pause
