@echo off
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo Run stop-handlers.bat as administrator.
    pause
    exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0stop-handlers.ps1"
pause
