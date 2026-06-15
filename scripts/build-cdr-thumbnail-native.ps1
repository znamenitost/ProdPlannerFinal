$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$project = Join-Path $root "CdrThumbnailNative\CdrThumbnailNative.vcxproj"
$outDir = Join-Path $root "CdrThumbnailNative\bin\x64\Release"
$previewShell = Join-Path $root "CdrPreviewShell"

if (-not (Test-Path $project)) {
    throw "Project not found: $project"
}

$msbuild = & "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe" `
    -latest -requires Microsoft.Component.MSBuild -find "MSBuild\**\Bin\MSBuild.exe" |
    Select-Object -First 1

if (-not $msbuild -or -not (Test-Path $msbuild)) {
    throw "MSBuild not found. Install Visual Studio 2022 with C++ desktop workload."
}

Write-Host "Building CdrThumbnailNative (Release x64)..." -ForegroundColor Cyan
& $msbuild $project /p:Configuration=Release /p:Platform=x64 /m | Write-Host

$dll = Join-Path $outDir "CdrThumbnailNative.dll"
if (-not (Test-Path $dll)) {
    throw "Build failed: $dll not found"
}

Copy-Item $dll (Join-Path $previewShell "CdrThumbnailNative.dll") -Force
Write-Host "Copied to $previewShell\CdrThumbnailNative.dll" -ForegroundColor Green
