# Start isolated E2E stack on Windows (Mongo must already run locally).
# Uses dedicated ports 8001/3001 so the normal local stack (8000/3000) is never hijacked.
# Never writes backend/.env or frontend/.env. Child processes get an isolated env block.
$ErrorActionPreference = "Stop"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$e2eDir = Join-Path $Root "e2e"
New-Item -ItemType Directory -Force -Path $e2eDir | Out-Null

$E2E_DB_NAME = if ($env:E2E_DB_NAME) { $env:E2E_DB_NAME } else { "memoryhub_e2e" }
$E2E_BACKEND_PORT = if ($env:E2E_BACKEND_PORT) { $env:E2E_BACKEND_PORT } else { "8001" }
$E2E_FRONTEND_PORT = if ($env:E2E_FRONTEND_PORT) { $env:E2E_FRONTEND_PORT } else { "3001" }
$MONGO_URL = if ($env:MONGO_URL) { $env:MONGO_URL } else { "mongodb://localhost:27017" }

if ($E2E_DB_NAME -eq "memoryhub") {
  throw "Refusing to start E2E against protected DB_NAME=memoryhub"
}

# Overlay vars that must NOT leak into the caller's shell after this script.
$script:E2E_OVERLAY_KEYS = @(
  "ENV", "E2E_DB_NAME", "DB_NAME", "MONGO_URL", "JWT_SECRET", "EMAIL_PROVIDER",
  "ANALYZER_PROVIDER", "E2E_DISABLE_RATE_LIMIT", "ALLOW_E2E_SEED", "STRIPE_BACKEND",
  "INTEGRATIONS_GMAIL_PROVIDER", "INTEGRATIONS_CONTACTS_PROVIDER", "INTEGRATIONS_TOKEN_KEY",
  "ACTION_ENGINE_ENABLED", "COMMUNICATION_INTELLIGENCE_ENABLED",
  "COMMUNICATION_INTELLIGENCE_PROVIDER", "COMMUNICATION_INTELLIGENCE_AUTO_ON_INGEST",
  "CREDITS_ENFORCED", "GMAIL_AUTO_SYNC_ENABLED", "BACKEND_PUBLIC_URL", "PUBLIC_APP_URL",
  "BROWSER", "HOST", "PORT", "E2E_PROXY_TARGET", "E2E_BASE_URL"
)

$script:SavedOverlay = @{}
foreach ($k in $script:E2E_OVERLAY_KEYS) {
  $script:SavedOverlay[$k] = [Environment]::GetEnvironmentVariable($k, "Process")
}

function Restore-CallerEnv {
  foreach ($k in $script:E2E_OVERLAY_KEYS) {
    $prev = $script:SavedOverlay[$k]
    if ($null -eq $prev -or $prev -eq "") {
      Remove-Item "Env:$k" -ErrorAction SilentlyContinue
    } else {
      Set-Item "Env:$k" $prev
    }
  }
}

function Get-E2EEnvMap {
  # Inherit full process env (npm/node need PATH, APPDATA, etc.), then force E2E overlays.
  # Parent shell is restored in finally via Restore-CallerEnv.
  $map = @{}
  Get-ChildItem Env: | ForEach-Object { $map[$_.Name] = $_.Value }

  # Strip CRA/dev overlays that could point children at the local stack.
  foreach ($k in @("E2E_PROXY_TARGET", "PORT", "HOST", "BROWSER", "REACT_APP_API_URL")) {
    if ($map.ContainsKey($k)) { $map.Remove($k) }
  }

  $map["ENV"] = "development"
  $map["E2E_DB_NAME"] = $E2E_DB_NAME
  $map["DB_NAME"] = $E2E_DB_NAME
  $map["MONGO_URL"] = $MONGO_URL
  $map["JWT_SECRET"] = "e2e-jwt-secret-at-least-32-characters-long"
  $map["EMAIL_PROVIDER"] = "fake"
  $map["ANALYZER_PROVIDER"] = "mock"
  $map["E2E_DISABLE_RATE_LIMIT"] = "1"
  $map["ALLOW_E2E_SEED"] = "1"
  $map["STRIPE_BACKEND"] = "fake"
  $map["INTEGRATIONS_GMAIL_PROVIDER"] = "mock"
  $map["INTEGRATIONS_CONTACTS_PROVIDER"] = "mock"
  $map["INTEGRATIONS_TOKEN_KEY"] = "e2e-integrations-token-key-32chars!!"
  $map["ACTION_ENGINE_ENABLED"] = "true"
  $map["COMMUNICATION_INTELLIGENCE_ENABLED"] = "true"
  $map["COMMUNICATION_INTELLIGENCE_PROVIDER"] = "mock"
  $map["COMMUNICATION_INTELLIGENCE_AUTO_ON_INGEST"] = "false"
  $map["CREDITS_ENFORCED"] = "false"
  $map["GMAIL_AUTO_SYNC_ENABLED"] = "false"
  $map["BACKEND_PUBLIC_URL"] = "http://127.0.0.1:$E2E_BACKEND_PORT"
  $map["PUBLIC_APP_URL"] = "http://127.0.0.1:$E2E_FRONTEND_PORT"
  return $map
}

function Invoke-WithE2EEnv {
  param(
    [string]$FileName,
    [string]$Arguments,
    [string]$WorkingDirectory
  )
  $map = Get-E2EEnvMap
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = $FileName
  $psi.Arguments = $Arguments
  $psi.WorkingDirectory = $WorkingDirectory
  $psi.UseShellExecute = $false
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  $psi.CreateNoWindow = $true
  # Overlay onto inherited env (do not wipe PATH / SystemRoot - breaks node/npm on Windows).
  foreach ($kv in $map.GetEnumerator()) {
    $psi.Environment[$kv.Key] = [string]$kv.Value
  }
  $proc = [System.Diagnostics.Process]::Start($psi)
  $stdout = $proc.StandardOutput.ReadToEnd()
  $stderr = $proc.StandardError.ReadToEnd()
  $proc.WaitForExit()
  if ($stdout) { Write-Host $stdout }
  if ($stderr) { Write-Host $stderr }
  if ($proc.ExitCode -ne 0) {
    throw "Command failed ($($proc.ExitCode)): $FileName $Arguments"
  }
}

function Start-LoggedProcess {
  param(
    [string]$FileName,
    [string]$Arguments,
    [string]$WorkingDirectory,
    [string]$LogPath,
    [string]$PidPath,
    [hashtable]$ExtraEnv = @{}
  )
  $map = Get-E2EEnvMap
  foreach ($kv in $ExtraEnv.GetEnumerator()) {
    $map[$kv.Key] = $kv.Value
  }
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = $FileName
  $psi.Arguments = $Arguments
  $psi.WorkingDirectory = $WorkingDirectory
  $psi.UseShellExecute = $false
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  $psi.CreateNoWindow = $true
  # Overlay onto inherited env (do not wipe PATH / SystemRoot - breaks node/npm on Windows).
  foreach ($kv in $map.GetEnumerator()) {
    $psi.Environment[$kv.Key] = [string]$kv.Value
  }
  $proc = New-Object System.Diagnostics.Process
  $proc.StartInfo = $psi
  $null = $proc.Start()
  Register-ObjectEvent -InputObject $proc -EventName OutputDataReceived -Action {
    if ($EventArgs.Data) { Add-Content -Path $Event.MessageData -Value $EventArgs.Data }
  } -MessageData $LogPath | Out-Null
  Register-ObjectEvent -InputObject $proc -EventName ErrorDataReceived -Action {
    if ($EventArgs.Data) { Add-Content -Path $Event.MessageData -Value $EventArgs.Data }
  } -MessageData $LogPath | Out-Null
  $proc.BeginOutputReadLine()
  $proc.BeginErrorReadLine()
  Set-Content -Path $PidPath -Value $proc.Id
  return $proc
}

try {
  $backendDir = Join-Path $Root "backend"
  $python = Join-Path $backendDir ".venv\Scripts\python.exe"
  if (-not (Test-Path $python)) { $python = "python" }

  Write-Host "==> Reset E2E database ($E2E_DB_NAME) - never touches memoryhub"
  Invoke-WithE2EEnv -FileName $python -Arguments "scripts/clean_e2e_db.py" -WorkingDirectory $backendDir
  Invoke-WithE2EEnv -FileName $python -Arguments "scripts/seed_e2e.py" -WorkingDirectory $backendDir

  Write-Host "==> Start E2E backend on :$E2E_BACKEND_PORT (DB=$E2E_DB_NAME)"
  $backendLog = Join-Path $e2eDir ".backend.log"
  "" | Set-Content $backendLog
  $backend = Start-LoggedProcess -FileName $python `
    -Arguments "-m uvicorn server:app --host 127.0.0.1 --port $E2E_BACKEND_PORT" `
    -WorkingDirectory $backendDir -LogPath $backendLog -PidPath (Join-Path $e2eDir ".backend.pid")

  Write-Host "==> Start E2E frontend on :$E2E_FRONTEND_PORT (proxy -> :$E2E_BACKEND_PORT)"
  $frontendLog = Join-Path $e2eDir ".frontend.log"
  "" | Set-Content $frontendLog
  # Call node+craco directly - avoids broken npm.cmd shims under ProcessStartInfo.
  $node = (Get-Command node.exe -ErrorAction Stop).Source
  $craco = Join-Path $Root "frontend\node_modules\@craco\craco\dist\bin\craco.js"
  if (-not (Test-Path $craco)) { throw "Missing $craco - run npm ci in frontend/" }
  $frontend = Start-LoggedProcess -FileName $node -Arguments "`"$craco`" start" `
    -WorkingDirectory (Join-Path $Root "frontend") -LogPath $frontendLog `
    -PidPath (Join-Path $e2eDir ".frontend.pid") `
    -ExtraEnv @{
      BROWSER = "none"
      HOST = "127.0.0.1"
      PORT = "$E2E_FRONTEND_PORT"
      E2E_PROXY_TARGET = "http://127.0.0.1:$E2E_BACKEND_PORT"
    }

  Write-Host "==> Waiting for services"
  $ready = $false
  for ($i = 0; $i -lt 60; $i++) {
    try {
      Invoke-WebRequest -Uri "http://127.0.0.1:$E2E_BACKEND_PORT/api/health" -UseBasicParsing -TimeoutSec 2 | Out-Null
      $ready = $true
      break
    } catch { Start-Sleep -Seconds 1 }
  }
  if (-not $ready) { throw "E2E backend did not become ready. See $backendLog" }

  $ready = $false
  for ($i = 0; $i -lt 90; $i++) {
    try {
      Invoke-WebRequest -Uri "http://127.0.0.1:$E2E_FRONTEND_PORT/" -UseBasicParsing -TimeoutSec 2 | Out-Null
      $ready = $true
      break
    } catch { Start-Sleep -Seconds 2 }
  }
  if (-not $ready) { throw "E2E frontend did not become ready. See $frontendLog" }

  Set-Content -Path (Join-Path $e2eDir ".ports") -Value "BACKEND=$E2E_BACKEND_PORT`nFRONTEND=$E2E_FRONTEND_PORT`nDB=$E2E_DB_NAME"

  Write-Host "E2E stack ready (isolated from local :8000/:3000):"
  Write-Host "  backend  http://127.0.0.1:$E2E_BACKEND_PORT  PID=$($backend.Id)  DB=$E2E_DB_NAME"
  Write-Host "  frontend http://127.0.0.1:$E2E_FRONTEND_PORT  PID=$($frontend.Id)"
  Write-Host "  Playwright: `$env:E2E_BASE_URL='http://127.0.0.1:$E2E_FRONTEND_PORT'"
  Write-Host "  artisan-a: artisan-a@e2e.example.com / E2ePassw0rd!A"
} finally {
  Restore-CallerEnv
}
