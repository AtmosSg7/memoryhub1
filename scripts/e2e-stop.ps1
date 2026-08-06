# Stop the isolated E2E stack only (ports 8001/3001 by default). Never touches local :8000/:3000 unless they match saved E2E PIDs.
$ErrorActionPreference = "Continue"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$e2eDir = Join-Path $Root "e2e"

foreach ($name in @(".backend.pid", ".frontend.pid")) {
  $pidFile = Join-Path $e2eDir $name
  if (Test-Path $pidFile) {
    $procId = Get-Content $pidFile | Select-Object -First 1
    if ($procId) {
      try {
        $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$procId" -ErrorAction SilentlyContinue
        if ($proc) {
          # Stop the process tree (uvicorn --reload / npm children)
          Get-CimInstance Win32_Process -Filter "ParentProcessId=$procId" -ErrorAction SilentlyContinue |
            ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
          Stop-Process -Id ([int]$procId) -Force -ErrorAction Stop
          Write-Host "Stopped E2E PID $procId"
        } else {
          Write-Host "E2E PID $procId already stopped"
        }
      } catch {
        Write-Host "E2E PID $procId already stopped"
      }
    }
    Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
  }
}

# Clear overlay vars that e2e-start may have left in an interactive shell (older script versions).
@(
  "DB_NAME", "E2E_DB_NAME", "ALLOW_E2E_SEED", "E2E_PROXY_TARGET", "E2E_DISABLE_RATE_LIMIT",
  "JWT_SECRET", "INTEGRATIONS_GMAIL_PROVIDER", "INTEGRATIONS_CONTACTS_PROVIDER",
  "ANALYZER_PROVIDER", "EMAIL_PROVIDER", "STRIPE_BACKEND", "E2E_BASE_URL"
) | ForEach-Object { Remove-Item "Env:$_" -ErrorAction SilentlyContinue }

Remove-Item (Join-Path $e2eDir ".ports") -Force -ErrorAction SilentlyContinue
Write-Host "E2E stack stopped. Local stack (:8000/:3000, DB memoryhub) was not modified."
