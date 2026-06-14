$ErrorActionPreference = "Continue"

$nativeThumbClsid = "{3f8a2c1d-4e5b-6a7c-8d9e-0f1a2b3c4d5e}"
$previewClsid = "{8f3e2a1b-4c5d-6e7f-8a9b-0c1d2e3f4a5b}"
$shellExThumb = "{E357FCCD-A995-4576-B01F-234630154E96}"
$approvedKey = "Registry::HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\Shell Extensions\Approved"

Write-Host "CDR Preview Shell diagnostics" -ForegroundColor Cyan
Write-Host ""

function Show-RegValue {
    param([string]$Label, [string]$Path)

    Write-Host $Label -ForegroundColor Yellow
    if (-not (Test-Path $Path)) {
        Write-Host "  (missing)" -ForegroundColor Red
        Write-Host ""
        return
    }

    try {
        $item = Get-ItemProperty -Path $Path -ErrorAction Stop
        $item.PSObject.Properties |
            Where-Object { $_.Name -notmatch '^PS' } |
            ForEach-Object { Write-Host ("  {0} = {1}" -f $_.Name, $_.Value) }
    }
    catch {
        Write-Host "  (unreadable)" -ForegroundColor Red
    }

    Write-Host ""
}

function Show-DefaultIconCheck {
    param([string]$Label, [string]$Path)

    Write-Host $Label -ForegroundColor Yellow
    if (-not (Test-Path $Path)) {
        Write-Host "  (missing)" -ForegroundColor Red
        Write-Host ""
        return
    }

    $value = (Get-ItemProperty -Path $Path -Name "(default)" -ErrorAction SilentlyContinue).'(default)'
    Write-Host "  (default) = $value"
    if ($value -eq "%1") {
        Write-Host "  OK" -ForegroundColor Green
    }
    else {
        Write-Host "  WRONG - must be %1 for per-file thumbnails" -ForegroundColor Red
    }

    Write-Host ""
}

$progId = (Get-ItemProperty -Path "Registry::HKEY_CLASSES_ROOT\.cdr" -Name "(default)" -ErrorAction SilentlyContinue).'(default)'
$userProgId = $null
$userChoicePath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\.cdr\UserChoice"
if (Test-Path $userChoicePath) {
    $userProgId = (Get-ItemProperty -Path $userChoicePath -Name "ProgId" -ErrorAction SilentlyContinue).ProgId
}

Write-Host "Resolved ProgIDs:" -ForegroundColor Cyan
Write-Host "  .cdr -> $progId"
Write-Host "  UserChoice -> $userProgId"
Write-Host ""

Show-DefaultIconCheck ".cdr DefaultIcon" "Registry::HKEY_CLASSES_ROOT\.cdr\DefaultIcon"
Show-DefaultIconCheck "SystemFileAssociations .cdr DefaultIcon" "Registry::HKEY_CLASSES_ROOT\SystemFileAssociations\.cdr\DefaultIcon"
if ($progId -and $progId -ne ".cdr") {
    Show-DefaultIconCheck "ProgID DefaultIcon ($progId)" "Registry::HKEY_CLASSES_ROOT\$progId\DefaultIcon"
}
if ($userProgId) {
    Show-DefaultIconCheck "User ProgID DefaultIcon ($userProgId)" "Registry::HKEY_CLASSES_ROOT\$userProgId\DefaultIcon"
}

Show-RegValue ".cdr thumbnail ShellEx" "Registry::HKEY_CLASSES_ROOT\.cdr\ShellEx\$shellExThumb"
Show-RegValue "SystemFileAssociations .cdr thumbnail" "Registry::HKEY_CLASSES_ROOT\SystemFileAssociations\.cdr\ShellEx\$shellExThumb"

if ($progId -and $progId -ne ".cdr") {
    Show-RegValue "ProgID thumbnail ($progId)" "Registry::HKEY_CLASSES_ROOT\$progId\ShellEx\$shellExThumb"
}

Show-RegValue "Native thumbnail InprocServer32" "Registry::HKEY_CLASSES_ROOT\CLSID\$nativeThumbClsid\InprocServer32"
Show-RegValue "Preview pane InprocServer32" "Registry::HKEY_CLASSES_ROOT\CLSID\$previewClsid\InprocServer32"

$inprocPath = (Get-ItemProperty -Path "Registry::HKEY_CLASSES_ROOT\CLSID\$nativeThumbClsid\InprocServer32" -Name "(default)" -ErrorAction SilentlyContinue).'(default)'
Write-Host "Native DLL path:" -ForegroundColor Yellow
Write-Host "  $inprocPath"
if ($inprocPath -match "mscoree\.dll") {
    Write-Host "  WRONG: still using .NET COM host. Re-run install.bat." -ForegroundColor Red
}
elseif ($inprocPath -match "OneDrive|Desktop|Downloads") {
    Write-Host "  WARNING: DLL is on OneDrive/Desktop. Re-run install.bat to copy to Program Files." -ForegroundColor Red
}
elseif ($inprocPath -match "CdrThumbnailNative\.dll") {
    Write-Host "  OK (native in-proc DLL)" -ForegroundColor Green
}
Write-Host ""

$installedPath = (Get-ItemProperty -Path "Registry::HKEY_LOCAL_MACHINE\SOFTWARE\CdrPreviewShell" -Name "InstallPath" -ErrorAction SilentlyContinue).InstallPath
Write-Host "InstallPath marker:" -ForegroundColor Yellow
Write-Host "  $installedPath"
Write-Host ""

Show-RegValue "Approved sample" $approvedKey

$nativeDll = Join-Path $PSScriptRoot "CdrThumbnailNative.dll"
Write-Host "Local native DLL:" -ForegroundColor Yellow
if (Test-Path $nativeDll) {
    Write-Host "  $nativeDll"
    Write-Host ("  modified: {0}" -f (Get-Item $nativeDll).LastWriteTime)
}
else {
    Write-Host "  (missing - build with scripts/build-cdr-thumbnail-native.ps1)" -ForegroundColor Red
}

Write-Host ""
Write-Host "Expected native thumbnail CLSID: $nativeThumbClsid" -ForegroundColor Green
Write-Host "Expected preview pane CLSID: $previewClsid" -ForegroundColor Green
