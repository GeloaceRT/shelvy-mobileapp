param(
    [switch]$RunTests
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$backendDir = Resolve-Path (Join-Path $scriptDir '..')

Write-Host "Starting backend in production mode (no emulator) from: $backendDir"

# Start server in a new window with emulator env vars removed
$svArgs = '-NoExit', '-Command', "Set-Location -Path '$backendDir'; Remove-Item -ErrorAction SilentlyContinue Env:FIREBASE_DATABASE_EMULATOR_HOST; Remove-Item -ErrorAction SilentlyContinue Env:FIREBASE_AUTH_EMULATOR_HOST; `$env:FIREBASE_PROJECT_ID='env-monitor-v2'; npm run dev"
Start-Process -FilePath 'powershell' -ArgumentList $svArgs -WindowStyle Normal

Write-Host 'Waiting for backend to listen on configured port (default 4000)...'
$port = $env:PORT
if (-not $port) { $port = 4000 }
$attempts = 0
while (-not (Test-NetConnection -ComputerName 'localhost' -Port $port -InformationLevel Quiet)) {
    Start-Sleep -Seconds 1
    $attempts++
    if ($attempts -gt 60) { Write-Warning "Backend did not appear on port $port within 60s"; break }
}
if ($attempts -le 60) { Write-Host "Backend appears up on port $port" }

if ($RunTests) {
    Write-Host 'Running ingest tests against local server (production DB)...'
    cd $backendDir
    $env:API_BASE = "http://localhost:$port"
    npx tsx scripts/test-ingest.ts
}

Write-Host 'Done. Backend started in production mode.'
