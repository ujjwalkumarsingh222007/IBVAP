@echo off
title IBVAP Backend Server (Port 8000)
echo ===================================================
echo   Starting IBVAP Backend Server on port 8000...
echo ===================================================
cd /d "D:\IBVAP\IBVAP\ibvap\backend"
"D:\IBVAP\IBVAP\.venv\Scripts\python.exe" -m uvicorn app.main:app --app-dir "D:\IBVAP\IBVAP\ibvap\backend" --host 0.0.0.0 --port 8000
pause
