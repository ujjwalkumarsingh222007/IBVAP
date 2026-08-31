@echo off
title IBVAP Frontend Dashboard (Port 5173)
echo ===================================================
echo   Starting IBVAP Frontend Dashboard on port 5173...
echo ===================================================
cd /d "D:\IBVAP\IBVAP\ibvap\frontend"
npm run dev -- --host 0.0.0.0
pause
