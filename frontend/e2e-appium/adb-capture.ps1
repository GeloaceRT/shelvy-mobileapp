<#
Simple helper to disable device network, take a screenshot and collect logcat.
Usage:
  .\adb-capture.ps1 [-DeviceSerial <string>] [-Label <string>]
Examples:
  .\adb-capture.ps1 -Label error-test
  .\adb-capture.ps1 -DeviceSerial emulator-5554 -Label network-off
#>
param(
  [string]$DeviceSerial = '',
  [string]$Label = 'capture'
)
 
 # timestamp and artifacts folder
 $ts = (Get-Date).ToString('yyyyMMddHHmmss')
 $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
 $artifacts = Join-Path -Path $scriptDir -ChildPath 'artifacts'
 if (-not (Test-Path $artifacts)) { New-Item -ItemType Directory -Path $artifacts | Out-Null }

# find adb executable: prefer adb on PATH, fallback to common SDK locations
$adbCmd = $null
$cmd = Get-Command adb -ErrorAction SilentlyContinue
if ($cmd) { $adbCmd = $cmd.Source }
if (-not $adbCmd) {
   $candidates = @(
     "$env:ANDROID_SDK_ROOT\platform-tools\adb.exe",
     "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe",
     'C:\Android\platform-tools\adb.exe'
   )
   foreach ($p in $candidates) { if (Test-Path $p) { $adbCmd = $p; break } }
 }

 if (-not $adbCmd) {
   Write-Error "adb not found. Install Android platform-tools and ensure adb is on PATH or set ANDROID_SDK_ROOT."
   Write-Host "See: https://developer.android.com/studio/releases/platform-tools" -ForegroundColor Yellow
   exit 1
 }

 function adb-run([string[]]$args) {
   & $adbCmd @args
 }

 $serialArg = if ($DeviceSerial) { @('-s', $DeviceSerial) } else { @() }

 Write-Host "Using adb: $adbCmd" -ForegroundColor Cyan
 Write-Host "Using device: $DeviceSerial" -ForegroundColor Cyan
 Write-Host "Artifacts folder: $artifacts" -ForegroundColor Cyan

 # Disable wifi and data
 Write-Host "Disabling WiFi and mobile data..." -ForegroundColor Yellow
 adb-run @($serialArg + @('shell','svc','wifi','disable')) | Out-Null
 adb-run @($serialArg + @('shell','svc','data','disable')) | Out-Null
 Start-Sleep -Seconds 2

 Write-Host "Now reproduce the error on the device (perform the action in the app)." -ForegroundColor Green
 Write-Host "Press ENTER when ready to capture screenshot and logs..." -ForegroundColor Green
 Read-Host | Out-Null

 # Take screenshot on device and pull to PC
 $devicePath = "/sdcard/${Label}_$ts.png"
 $localPath = Join-Path $artifacts "${Label}_$ts.png"
 Write-Host "Capturing screenshot to device: $devicePath" -ForegroundColor Yellow
 adb-run @($serialArg + @('shell','screencap','-p',$devicePath)) | Out-Null
 Write-Host "Pulling screenshot to: $localPath" -ForegroundColor Yellow
 adb-run @($serialArg + @('pull',$devicePath,$localPath)) | Out-Null
 adb-run @($serialArg + @('shell','rm',$devicePath)) | Out-Null

 # Collect logcat
 $logOut = Join-Path $artifacts "${Label}_$ts.log"
 Write-Host "Collecting adb logcat to: $logOut" -ForegroundColor Yellow
 adb-run @($serialArg + @('logcat','-d')) | Out-File -FilePath $logOut -Encoding utf8

 # Re-enable network
 Write-Host "Re-enabling WiFi and mobile data..." -ForegroundColor Yellow
 adb-run @($serialArg + @('shell','svc','wifi','enable')) | Out-Null
 adb-run @($serialArg + @('shell','svc','data','enable')) | Out-Null

 Write-Host "Done. Artifacts saved:" -ForegroundColor Green
 Get-ChildItem -Path $artifacts -Filter "${Label}_$ts.*" | ForEach-Object { Write-Host " - $($_.Name)" }
