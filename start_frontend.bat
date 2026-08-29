@echo off
title IBVAP Frontend Server (Port 5173)
cd /d "%~dp0ibvap\frontend"
echo ============================================================
echo Starting IBVAP Frontend on http://localhost:5173
echo ============================================================
npm run dev
pause
