$ErrorActionPreference = "Stop"

$dest = Join-Path $env:LOCALAPPDATA "ProductionPlanner\FileOpener"
New-Item -ItemType Directory -Force -Path $dest | Out-Null

Copy-Item -Force "$PSScriptRoot\ProductionPlanner.FileOpener.exe" (Join-Path $dest "ProductionPlanner.FileOpener.exe")
if (Test-Path "$PSScriptRoot\uninstall.ps1") {
    Copy-Item -Force "$PSScriptRoot\uninstall.ps1" (Join-Path $dest "uninstall.ps1")
}

$exe = Join-Path $dest "ProductionPlanner.FileOpener.exe"
$taskName = "ProductionPlanner File Opener"

Get-Process -Name "ProductionPlanner.FileOpener" -ErrorAction SilentlyContinue | Stop-Process -Force
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue

$action = New-ScheduledTaskAction -Execute $exe
$trigger = New-ScheduledTaskTrigger -AtLogon
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -RunLevel Limited | Out-Null

Start-Process $exe
Start-Sleep -Seconds 1

try {
    Invoke-WebRequest -Uri "http://127.0.0.1:17888/health" -UseBasicParsing | Out-Null
    Write-Host "Агент установлен и работает." -ForegroundColor Green
} catch {
    Write-Host "Агент установлен. Если файлы не открываются — разрешите программе в брандмауэре Windows." -ForegroundColor Yellow
}

Read-Host "Нажмите Enter"
