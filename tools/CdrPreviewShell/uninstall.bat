@echo off
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo Запустите uninstall.bat от имени администратора.
    pause
    exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0uninstall.ps1"
pause
