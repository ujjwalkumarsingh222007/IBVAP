@echo off
title IBVAP Backend Server (Port 8000)
cd /d "%~dp0ibvap\backend"
echo ============================================================
echo Starting IBVAP Backend on http://127.0.0.1:8000
echo ============================================================
"%~dp0.venv\Scripts\python.exe" -m uvicorn app.main:app --app-dir "%~dp0ibvap\backend" --host 127.0.0.1 --port 8000
pause
