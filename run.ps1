$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
$nodeVersion = if (Get-Command node -ErrorAction SilentlyContinue) { [version](node -p 'process.versions.node') } else { [version]'0.0' }
if ($nodeVersion -lt [version]'22.12.0') { throw 'Node.js 22.12 or newer is required. Install Node.js, then rerun this script.' }
if (-not (Test-Path frontend/node_modules)) { Push-Location frontend; npm install; Pop-Location }
Push-Location frontend
npm run build
Pop-Location
Push-Location backend
if (-not (Test-Path .venv)) { py -3 -m venv .venv }
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
Write-Host "RIFT Arena is starting at http://127.0.0.1:8000" -ForegroundColor Cyan
Write-Host "API reference: http://127.0.0.1:8000/api/docs" -ForegroundColor DarkCyan
uvicorn main:app --reload --env-file .env --port 8000
Pop-Location
