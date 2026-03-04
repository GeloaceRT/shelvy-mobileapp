param(
    [switch]$RunTests,
    [string]$ProjectId = $env:FIREBASE_PROJECT_ID
)

if (-not $ProjectId) { $ProjectId = 'env-monitor-v2' }

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$backendDir = Resolve-Path (Join-Path $scriptDir '..')

Write-Host "Backend dir: $backendDir"

# helper: verify command available
function Ensure-Command($cmd) {
    $found = Get-Command $cmd -ErrorAction SilentlyContinue
    if (-not $found) {
        Write-Warning "Command `$cmd` not found in PATH. Some steps may fail."
    }
}

Ensure-Command java
Ensure-Command npx

Write-Host "Starting Firebase emulators (database + auth) in a new window..."
$emArgs = '-NoExit', '-Command', "Set-Location -Path '$backendDir'; npx firebase emulators:start --only database,auth --project $ProjectId"
Start-Process -FilePath 'powershell' -ArgumentList $emArgs -WindowStyle Minimized

Write-Host 'Waiting for RTDB emulator at localhost:9000...'
$attempts = 0
while (-not (Test-NetConnection -ComputerName 'localhost' -Port 9000 -InformationLevel Quiet)) {
    Start-Sleep -Seconds 1
    $attempts++
    if ($attempts -gt 60) { Write-Error 'RTDB emulator did not start within 60s'; break }
}
if ($attempts -le 60) { Write-Host 'RTDB emulator appears up.' }

Write-Host "Starting backend server in a new window (will use emulator env vars)..."
$svArgs = '-NoExit', '-Command', "Set-Location -Path '$backendDir'; `$env:FIREBASE_DATABASE_EMULATOR_HOST='localhost:9000'; `$env:FIREBASE_AUTH_EMULATOR_HOST='localhost:9099'; `$env:FIREBASE_PROJECT_ID='$ProjectId'; npm run dev"
Start-Process -FilePath 'powershell' -ArgumentList $svArgs -WindowStyle Minimized

Write-Host 'Waiting for backend to listen on configured port...'
# read PORT from env or .env; default 4000
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
    Write-Host 'Running ingest tests (single + batch)...'
    cd $backendDir
    $env:API_BASE = "http://localhost:$port"
    npx tsx scripts/test-ingest.ts
}

Write-Host 'Done. Emulator and server started in separate windows.'
Write-Host 'To stop them, close the opened windows or find their powershell processes.'
