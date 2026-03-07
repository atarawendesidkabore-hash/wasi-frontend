Param(
  [switch]$SkipBuilds
)

$ErrorActionPreference = "Continue"

$desktop = "C:\Users\KaboreTarawendesida\OneDrive\Desktop"
$paths = @{
  WASI = Join-Path $desktop "WASI"
  WASI_BACKEND = Join-Path $desktop "wasi-backend-api"
  WASI_CLI = Join-Path $desktop "wasi-cli"
  WASI_ECOSYSTEM = Join-Path $desktop "wasi-ecosystem"
  WASI_MONOREPO = Join-Path $desktop "WASI_Ecosystem_Monorepo"
}

$results = New-Object System.Collections.Generic.List[string]
$results.Add("# Diagnostic Report")
$results.Add("Generated: $(Get-Date -Format s)")
$results.Add("")

function Add-Section([string]$title) {
  $results.Add("## $title")
}

function Add-Line([string]$line) {
  $results.Add($line)
}

function Run-Check([string]$name, [scriptblock]$action) {
  try {
    $global:LASTEXITCODE = 0
    & $action
    if ($LASTEXITCODE -ne 0) {
      throw "Exit code $LASTEXITCODE"
    }
    Add-Line("- [PASS] $name")
  }
  catch {
    Add-Line("- [FAIL] $name -> $($_.Exception.Message)")
  }
}

Add-Section "Repository Presence"
foreach ($key in $paths.Keys) {
  $exists = Test-Path $paths[$key]
  Add-Line("- ${key}: $($paths[$key]) -> $exists")
}
$results.Add("")

$diskAtStart = Get-PSDrive C
$freeSpaceBytes = [int64]$diskAtStart.Free
$minFreeForFullBuilds = 1073741824
$skipHeavyChecks = $SkipBuilds -or ($freeSpaceBytes -lt $minFreeForFullBuilds)

if ($skipHeavyChecks) {
  Add-Section "Build and Test Checks"
  if ($SkipBuilds) {
    Add-Line("- [INFO] Heavy checks skipped by user switch: -SkipBuilds")
  } else {
    Add-Line("- [WARN] Heavy checks skipped: low disk space (< 1 GB free).")
  }
} else {
  Add-Section "Build and Test Checks"
  Push-Location $paths.WASI
  Run-Check "WASI npm build" { npm run build }
  Run-Check "WASI npm test" { npm test }
  Pop-Location

  Push-Location $paths.WASI_ECOSYSTEM
  Run-Check "wasi-ecosystem npm build" { npm run build }
  Pop-Location

  Push-Location $paths.WASI_MONOREPO
  Run-Check "WASI_Ecosystem_Monorepo npm build" { npm run build }
  Pop-Location

  Push-Location $paths.WASI_BACKEND
  Run-Check "wasi-backend-api compileall src" { python -m compileall -q src }
  Run-Check "wasi-backend-api smoke test" { python -m pytest -q tests/test_api.py -k health }
  Pop-Location

  Push-Location $paths.WASI_CLI
  Run-Check "wasi-cli compileall" { python -m compileall -q wasi_cli }
  Run-Check "wasi-cli smoke tests" { python -m pytest -q tests/test_config.py tests/test_data.py }
  Pop-Location
}

$results.Add("")
Add-Section "Disk"
$drive = Get-PSDrive C
Add-Line("- Used: $($drive.Used)")
Add-Line("- Free: $($drive.Free)")

$reportPath = Join-Path $paths.WASI "WASI_Central_Diagnostic_Latest.md"
$results -join "`r`n" | Set-Content $reportPath
Write-Host "Diagnostic written to: $reportPath"
