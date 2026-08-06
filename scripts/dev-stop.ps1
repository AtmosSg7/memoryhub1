# Stop processes started by scripts/dev-start.ps1
$ErrorActionPreference = "Continue"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$devDir = Join-Path $Root ".dev"

foreach ($name in @("backend.pid", "frontend.pid")) {
  $pidFile = Join-Path $devDir $name
  if (Test-Path $pidFile) {
    $procId = Get-Content $pidFile | Select-Object -First 1
    if ($procId) {
      try {
        Get-CimInstance Win32_Process -Filter "ParentProcessId=$procId" -ErrorAction SilentlyContinue |
          ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
        Stop-Process -Id ([int]$procId) -Force -ErrorAction Stop
        Write-Host "Stopped local PID $procId"
      } catch {
        Write-Host "PID $procId already stopped"
      }
    }
    Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
  }
}
Write-Host "Local stack stopped."
