$ErrorActionPreference = "SilentlyContinue"

Write-Host "Stopping Explorer..." -ForegroundColor Cyan
Stop-Process -Name explorer -Force
Start-Sleep -Seconds 1

Write-Host "Stopping dllhost (thumbnail/preview workers)..." -ForegroundColor Cyan
Get-Process -Name dllhost -ErrorAction SilentlyContinue | Stop-Process -Force

Write-Host "Stopping prevhost (preview pane)..." -ForegroundColor Cyan
Get-Process -Name prevhost -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2

Write-Host ""
Write-Host "Handlers stopped. You can replace DLL files in this folder now." -ForegroundColor Green
Write-Host "Then run install.bat as administrator." -ForegroundColor Green
Write-Host ""
Write-Host "If files are still locked: reboot, or unpack the new ZIP into a new folder." -ForegroundColor Yellow
