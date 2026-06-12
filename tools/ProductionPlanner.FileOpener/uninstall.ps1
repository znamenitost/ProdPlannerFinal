$ErrorActionPreference = "Stop"

$taskName = "ProductionPlanner File Opener"
Get-Process -Name "ProductionPlanner.FileOpener" -ErrorAction SilentlyContinue | Stop-Process -Force
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue

$dest = Join-Path $env:LOCALAPPDATA "ProductionPlanner\FileOpener"
if (Test-Path $dest) {
    Remove-Item -Recurse -Force $dest
}

Write-Host "Агент удалён." -ForegroundColor Green
