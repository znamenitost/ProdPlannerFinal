@echo off
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo Запустите install.bat от имени администратора.
    pause
    exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1"
pause
