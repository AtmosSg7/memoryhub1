# Start the normal local Basera stack (backend :8000 + frontend :3000) using backend/.env.
# Clears E2E/pytest overlay variables so load_dotenv(override=False) can read DB_NAME=memoryhub.
$ErrorActionPreference = "Stop"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

$overlay = @(
  "DB_NAME", "E2E_DB_NAME", "ALLOW_E2E_SEED", "E2E_PROXY_TARGET", "E2E_DISABLE_RATE_LIMIT",
  "E2E_BASE_URL", "E2E_BACKEND_PORT", "E2E_FRONTEND_PORT",
  "JWT_SECRET", "INTEGRATIONS_GMAIL_PROVIDER", "INTEGRATIONS_CONTACTS_PROVIDER",
  "INTEGRATIONS_TOKEN_KEY", "ANALYZER_PROVIDER", "EMAIL_PROVIDER", "STRIPE_BACKEND",
  "ACTION_ENGINE_ENABLED", "COMMUNICATION_INTELLIGENCE_ENABLED",
  "COMMUNICATION_INTELLIGENCE_PROVIDER", "COMMUNICATION_INTELLIGENCE_AUTO_ON_INGEST",
  "CREDITS_ENFORCED", "GMAIL_AUTO_SYNC_ENABLED", "BACKEND_PUBLIC_URL", "PUBLIC_APP_URL"
)
foreach ($k in $overlay) {
  Remove-Item "Env:$k" -ErrorAction SilentlyContinue
}

$envFile = Join-Path $Root "backend\.env"
if (-not (Test-Path $envFile)) {
  throw "Missing backend/.env (expected DB_NAME=memoryhub for local dev)."
}
$dbLine = Select-String -Path $envFile -Pattern '^\s*DB_NAME\s*=' | Select-Object -First 1
Write-Host ("Using {0} from backend/.env" -f $dbLine.Line.Trim())

$backendDir = Join-Path $Root "backend"
$python = Join-Path $backendDir ".venv\Scripts\python.exe"
if (-not (Test-Path $python)) { $python = "python" }

$devDir = Join-Path $Root ".dev"
New-Item -ItemType Directory -Force -Path $devDir | Out-Null

Write-Host "==> Backend http://127.0.0.1:8000"
$backend = Start-Process -FilePath $python `
  -ArgumentList @("-m", "uvicorn", "server:app", "--reload", "--host", "127.0.0.1", "--port", "8000") `
  -WorkingDirectory $backendDir `
  -PassThru `
  -WindowStyle Hidden `
  -RedirectStandardOutput (Join-Path $devDir "backend.log") `
  -RedirectStandardError (Join-Path $devDir "backend.err.log")
Set-Content -Path (Join-Path $devDir "backend.pid") -Value $backend.Id

Write-Host "==> Frontend http://127.0.0.1:3000 (proxy -> :8000, no E2E_PROXY_TARGET)"
$savedFront = @{}
foreach ($k in @("BROWSER", "HOST", "PORT", "E2E_PROXY_TARGET")) {
  $savedFront[$k] = [Environment]::GetEnvironmentVariable($k, "Process")
}
$env:BROWSER = "none"
$env:HOST = "127.0.0.1"
$env:PORT = "3000"
Remove-Item Env:E2E_PROXY_TARGET -ErrorAction SilentlyContinue
try {
  $frontend = Start-Process -FilePath "npm.cmd" `
    -ArgumentList @("start") `
    -WorkingDirectory (Join-Path $Root "frontend") `
    -PassThru `
    -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $devDir "frontend.log") `
    -RedirectStandardError (Join-Path $devDir "frontend.err.log")
  Set-Content -Path (Join-Path $devDir "frontend.pid") -Value $frontend.Id
} finally {
  foreach ($k in $savedFront.Keys) {
    $prev = $savedFront[$k]
    if ($null -eq $prev -or $prev -eq "") { Remove-Item "Env:$k" -ErrorAction SilentlyContinue }
    else { Set-Item "Env:$k" $prev }
  }
}

$ready = $false
for ($i = 0; $i -lt 60; $i++) {
  try {
    Invoke-WebRequest -Uri "http://127.0.0.1:8000/api/health" -UseBasicParsing -TimeoutSec 2 | Out-Null
    $ready = $true
    break
  } catch { Start-Sleep -Seconds 1 }
}
if (-not $ready) { throw "Local backend did not become ready. See .dev/backend.log" }

Write-Host "Local stack ready:"
Write-Host "  backend  http://127.0.0.1:8000"
Write-Host "  frontend http://127.0.0.1:3000"
Write-Host "  login    http://localhost:3000/login"
