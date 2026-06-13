$ErrorActionPreference = "Stop"

$dir = $PSScriptRoot
$dll = Join-Path $dir "CdrPreviewShell.dll"
$regasm = Join-Path $env:WINDIR "Microsoft.NET\Framework64\v4.0.30319\RegAsm.exe"

if (-not (Test-Path $dll)) {
    throw "CdrPreviewShell.dll не найден"
}
if (-not (Test-Path $regasm)) {
    throw "RegAsm.exe не найден"
}

Write-Host "Удаление CDR Preview Handler..." -ForegroundColor Cyan
& $regasm /unregister $dll | Out-String | Write-Host

Stop-Process -Name explorer -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1
Start-Process explorer

Write-Host "Удалено." -ForegroundColor Green
