$ErrorActionPreference = "Stop"

$sourceDir = $PSScriptRoot
$installDir = Join-Path $env:ProgramFiles "CdrPreviewShell"
$installMarker = "Registry::HKEY_LOCAL_MACHINE\SOFTWARE\CdrPreviewShell"
$regasm = Join-Path $env:WINDIR "Microsoft.NET\Framework64\v4.0.30319\RegAsm.exe"
$nativeThumbClsid = "{3f8a2c1d-4e5b-6a7c-8d9e-0f1a2b3c4d5e}"
$shellExThumb = "{E357FCCD-A995-4576-B01F-234630154E96}"
$approvedKey = "Registry::HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\Shell Extensions\Approved"

if (-not (Test-Path (Join-Path $sourceDir "CdrPreviewShell.dll"))) {
    throw "CdrPreviewShell.dll not found in $sourceDir"
}
if (-not (Test-Path (Join-Path $sourceDir "CdrThumbnailNative.dll"))) {
    throw "CdrThumbnailNative.dll not found in $sourceDir. Build with scripts/build-cdr-thumbnail-native.ps1 on Windows first."
}
if (-not (Test-Path $regasm)) {
    throw ".NET Framework 4.8 x64 not found (RegAsm.exe is missing)"
}

function Set-ThumbnailAssociation {
    param([string]$ClassKey)

    if ([string]::IsNullOrWhiteSpace($ClassKey)) {
        return
    }

    $shellExPath = "Registry::HKEY_CLASSES_ROOT\$ClassKey\ShellEx\$shellExThumb"
    if (-not (Test-Path $shellExPath)) {
        New-Item -Path $shellExPath -Force | Out-Null
    }

    Set-ItemProperty -Path $shellExPath -Name "(default)" -Value $nativeThumbClsid -Force
}

function Set-DefaultIconForThumbnails {
    param([string]$ClassKey)

    if ([string]::IsNullOrWhiteSpace($ClassKey)) {
        return
    }

    $defaultIconPath = "Registry::HKEY_CLASSES_ROOT\$ClassKey\DefaultIcon"
    if (-not (Test-Path $defaultIconPath)) {
        New-Item -Path $defaultIconPath -Force | Out-Null
    }

    Set-ItemProperty -Path $defaultIconPath -Name "(default)" -Value "%1" -Force
}

function Register-CdrAssociations {
    param([string]$ClassKey)

    Set-ThumbnailAssociation $ClassKey
    Set-DefaultIconForThumbnails $ClassKey
}

function Approve-ShellExtension {
    param(
        [string]$Clsid,
        [string]$Name
    )

    if (-not (Test-Path $approvedKey)) {
        New-Item -Path $approvedKey -Force | Out-Null
    }

    Set-ItemProperty -Path $approvedKey -Name $Clsid -Value $Name -Force
}

function Stop-ShellExtensionHosts {
    Write-Host "Stopping Explorer and shell extension hosts..." -ForegroundColor Cyan
    Stop-Process -Name explorer -Force -ErrorAction SilentlyContinue
    Get-Process -Name dllhost -ErrorAction SilentlyContinue | Stop-Process -Force
    Get-Process -Name prevhost -ErrorAction SilentlyContinue | Stop-Process -Force
    Start-Sleep -Seconds 2
}

Write-Host "Preparing installation..." -ForegroundColor Cyan
Stop-ShellExtensionHosts

$existingManagedDll = Join-Path $installDir "CdrPreviewShell.dll"
$existingNativeDll = Join-Path $installDir "CdrThumbnailNative.dll"

if (Test-Path $existingManagedDll) {
    Write-Host "Unregistering previous .NET registration..." -ForegroundColor Cyan
    & $regasm /unregister $existingManagedDll 2>$null | Out-Null
    Stop-ShellExtensionHosts
}

if (Test-Path $existingNativeDll) {
    Write-Host "Unregistering previous native thumbnail handler..." -ForegroundColor Cyan
    & regsvr32 /u /s $existingNativeDll 2>$null | Out-Null
    Stop-ShellExtensionHosts
}

Write-Host "Installing to $installDir ..." -ForegroundColor Cyan
New-Item -ItemType Directory -Path $installDir -Force | Out-Null

$copyAttempt = 0
while ($copyAttempt -lt 3) {
    try {
        Get-ChildItem -Path $sourceDir -File | Copy-Item -Destination $installDir -Force
        break
    }
    catch {
        $copyAttempt++
        if ($copyAttempt -ge 3) {
            throw
        }
        Write-Host "Files are locked, stopping hosts again (attempt $copyAttempt/3)..." -ForegroundColor Yellow
        Stop-ShellExtensionHosts
    }
}

Get-ChildItem -Path $installDir -Include *.dll,*.config -File | ForEach-Object {
    Unblock-File -Path $_.FullName -ErrorAction SilentlyContinue
}

$managedDll = Join-Path $installDir "CdrPreviewShell.dll"
$nativeDll = Join-Path $installDir "CdrThumbnailNative.dll"

Write-Host "Registering CDR Preview Shell (.NET preview pane)..." -ForegroundColor Cyan
& $regasm /codebase $managedDll | Out-String | Write-Host

Write-Host "Registering CDR Native Thumbnail handler..." -ForegroundColor Cyan
& regsvr32 /s $nativeDll
if (-not $?) {
    throw "regsvr32 failed for CdrThumbnailNative.dll"
}

if (-not (Test-Path $installMarker)) {
    New-Item -Path $installMarker -Force | Out-Null
}
Set-ItemProperty -Path $installMarker -Name "InstallPath" -Value $installDir -Force

Write-Host "Approving native thumbnail shell extension..." -ForegroundColor Cyan
Approve-ShellExtension $nativeThumbClsid "CDR Native Thumbnail"

Write-Host "Registering .cdr thumbnail handler on file associations..." -ForegroundColor Cyan
$associationKeys = @(".cdr", "SystemFileAssociations\.cdr")
$progId = (Get-ItemProperty -Path "Registry::HKEY_CLASSES_ROOT\.cdr" -Name "(default)" -ErrorAction SilentlyContinue).'(default)'
if ($progId -and $progId -ne ".cdr") {
    $associationKeys += $progId
}

foreach ($key in $associationKeys) {
    Register-CdrAssociations $key
}

Write-Host "Clearing icon/thumbnail cache..." -ForegroundColor Cyan

$thumbCacheDir = Join-Path $env:LOCALAPPDATA "Microsoft\Windows\Explorer"
Get-ChildItem -Path $thumbCacheDir -Filter "thumbcache_*.db" -ErrorAction SilentlyContinue |
    Remove-Item -Force -ErrorAction SilentlyContinue
Get-ChildItem -Path $thumbCacheDir -Filter "iconcache_*.db" -ErrorAction SilentlyContinue |
    Remove-Item -Force -ErrorAction SilentlyContinue

Start-Process explorer

Write-Host ""
Write-Host "Installed to: $installDir" -ForegroundColor Green
Write-Host "Do NOT run from Desktop/OneDrive zip after install." -ForegroundColor Yellow
Write-Host "1. Open folder with .cdr files" -ForegroundColor Green
Write-Host "2. View -> Extra large icons" -ForegroundColor Green
Write-Host "3. Run diagnose.bat to verify native InprocServer32 path" -ForegroundColor Green
