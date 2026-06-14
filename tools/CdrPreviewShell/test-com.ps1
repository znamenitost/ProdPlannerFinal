$ErrorActionPreference = "Continue"

function Test-ComClass {
    param(
        [string]$Label,
        [string]$Clsid
    )

    Write-Host $Label -ForegroundColor Cyan
    Write-Host "  CLSID: $Clsid"

    try {
        $type = [Type]::GetTypeFromCLSID($Clsid)
        if ($null -eq $type) {
            Write-Host "  GetTypeFromCLSID returned null" -ForegroundColor Red
            Write-Host ""
            return
        }

        Write-Host "  Type: $($type.FullName)" -ForegroundColor Green
        $obj = [Activator]::CreateInstance($type)
        Write-Host "  CreateInstance: OK" -ForegroundColor Green
        Write-Host "  Object: $($obj.GetType().FullName)" -ForegroundColor Green
    }
    catch {
        Write-Host "  FAILED: $($_.Exception.Message)" -ForegroundColor Red
        $inner = $_.Exception.InnerException
        while ($null -ne $inner) {
            Write-Host "  Inner: $($inner.Message)" -ForegroundColor Red
            $inner = $inner.InnerException
        }
    }

    Write-Host ""
}

Write-Host "COM activation test (same as Explorer would do)" -ForegroundColor Yellow
Write-Host ""

Test-ComClass "Native thumbnail handler" "{3f8a2c1d-4e5b-6a7c-8d9e-0f1a2b3c4d5e}"
Test-ComClass "Preview handler (preview pane)" "{8f3e2a1b-4c5d-6e7f-8a9b-0c1d2e3f4a5b}"

Write-Host "Send this full output if thumbnails still fail." -ForegroundColor Green
