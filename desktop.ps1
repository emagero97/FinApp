# FinApp desktop launcher — sets up dependencies and starts the Electron app.
# Usage:  powershell -ExecutionPolicy Bypass -File .\desktop.ps1
$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root

Write-Host "==> 1/4 Python environment"
if (-not (Test-Path "$Root\venv\Scripts\python.exe")) {
    python -m venv venv
}
& "$Root\venv\Scripts\python.exe" -m pip install --quiet -r requirements.txt
if ($LASTEXITCODE -ne 0) { throw "pip install failed" }

Write-Host "==> 2/4 Frontend dependencies"
Set-Location "$Root\frontend-app"
npm install
if ($LASTEXITCODE -ne 0) { throw "npm install (frontend) failed" }

Write-Host "==> 3/4 Frontend build"
npm run build
if ($LASTEXITCODE -ne 0) { throw "frontend build failed" }

Write-Host "==> 4/4 Electron"
Set-Location "$Root\electron"
npm install
if ($LASTEXITCODE -ne 0) { throw "npm install (electron) failed" }

Write-Host ""
Write-Host "FinApp is starting..."
npx electron .
