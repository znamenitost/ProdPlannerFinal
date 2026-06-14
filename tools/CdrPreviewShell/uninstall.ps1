$ErrorActionPreference = "Stop"

$installMarker = "Registry::HKEY_LOCAL_MACHINE\SOFTWARE\CdrPreviewShell"
$installDir = $null
if (Test-Path $installMarker) {
    $installDir = (Get-ItemProperty -Path $installMarker -Name "InstallPath" -ErrorAction SilentlyContinue).InstallPath
}
if (-not $installDir) {
    $installDir = Join-Path $env:ProgramFiles "CdrPreviewShell"
}
if (-not (Test-Path (Join-Path $installDir "CdrPreviewShell.dll"))) {
    $installDir = $PSScriptRoot
}

$managedDll = Join-Path $installDir "CdrPreviewShell.dll"
$nativeDll = Join-Path $installDir "CdrThumbnailNative.dll"
$regasm = Join-Path $env:WINDIR "Microsoft.NET\Framework64\v4.0.30319\RegAsm.exe"

if (-not (Test-Path $managedDll)) {
    throw "CdrPreviewShell.dll not found"
}
if (-not (Test-Path $regasm)) {
    throw "RegAsm.exe not found"
}

Write-Host "Stopping Explorer and shell extension hosts..." -ForegroundColor Cyan
Stop-Process -Name explorer -Force -ErrorAction SilentlyContinue
Get-Process -Name dllhost -ErrorAction SilentlyContinue | Stop-Process -Force
Get-Process -Name prevhost -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2

Write-Host "Unregistering from $installDir ..." -ForegroundColor Cyan

if (Test-Path $nativeDll) {
    & regsvr32 /u /s $nativeDll 2>$null | Out-Null
}

& $regasm /unregister $managedDll | Out-String | Write-Host

Start-Process explorer

Write-Host "Uninstalled." -ForegroundColor Green
