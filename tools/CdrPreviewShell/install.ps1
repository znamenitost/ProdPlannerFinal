$ErrorActionPreference = "Stop"

$dir = $PSScriptRoot
$dll = Join-Path $dir "CdrPreviewShell.dll"
$sharpShell = Join-Path $dir "SharpShell.dll"
$regasm = Join-Path $env:WINDIR "Microsoft.NET\Framework64\v4.0.30319\RegAsm.exe"

if (-not (Test-Path $dll)) {
    throw "CdrPreviewShell.dll не найден в $dir"
}
if (-not (Test-Path $sharpShell)) {
    throw "SharpShell.dll не найден в $dir"
}
if (-not (Test-Path $regasm)) {
    throw ".NET Framework 4.8 x64 не найден (RegAsm.exe отсутствует)"
}

Write-Host "Регистрация CDR Preview Handler..." -ForegroundColor Cyan
& $regasm /codebase $dll | Out-String | Write-Host

Write-Host "Перезапуск Проводника..." -ForegroundColor Cyan
Stop-Process -Name explorer -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1
Start-Process explorer

Write-Host ""
Write-Host "Готово. Включите: Проводник -> Вид -> Панель предпросмотра" -ForegroundColor Green
