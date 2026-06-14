$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot

Write-Host "Building native thumbnail DLL..." -ForegroundColor Cyan
& (Join-Path $PSScriptRoot "build-cdr-thumbnail-native.ps1")

Write-Host "Building preview shell ZIP..." -ForegroundColor Cyan
& bash (Join-Path $PSScriptRoot "build-cdr-preview-shell.sh")
