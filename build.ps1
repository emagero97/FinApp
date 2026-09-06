# FinApp standalone build script
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root

Write-Host "==> 1/4 Verifica dipendenze Python" -ForegroundColor Cyan
if (-not (Test-Path "$Root\venv\Scripts\python.exe")) {
    python -m venv venv
}
& "$Root\venv\Scripts\python.exe" -m pip install --quiet -r requirements.txt
& "$Root\venv\Scripts\python.exe" -m pip install --quiet pyinstaller

Write-Host "==> 2/4 Compilazione Frontend (Angular)" -ForegroundColor Cyan
Set-Location "$Root\frontend-app"
npm install
npm run build
if ($LASTEXITCODE -ne 0) { throw "Build di Angular fallita!" }

Write-Host "==> 3/4 Compilazione Backend e Packaging Electron" -ForegroundColor Cyan
Set-Location "$Root\electron"
npm install
npm run dist
if ($LASTEXITCODE -ne 0) { throw "Packaging Electron fallito!" }

Write-Host ""
Write-Host "==> BUILD COMPLETATA CON SUCCESSO!" -ForegroundColor Green
Write-Host "I file pronti da inviare si trovano in: $Root\electron\release" -ForegroundColor Yellow