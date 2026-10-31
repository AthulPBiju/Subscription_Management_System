@echo off
title Brightloop Backend API
cd /d "%~dp0backend"
echo ====================================================
echo Starting Brightloop Backend API (FastAPI + Uvicorn)
echo ====================================================
call .venv\Scripts\activate.bat
"%~dp0backend\.venv\Scripts\python.exe" -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
pause
