<#
Creates a cleaned copy of the current project (or a specified source) on the Desktop
and produces a shelvy-clean.zip. Excludes common secret files and node_modules.
Usage:
  From repo root:
    .\scripts\make-clean-package.ps1
  Or specify source/destination:
    .\scripts\make-clean-package.ps1 -Source "D:\path\to\project" -Dest "$env:USERPROFILE\Desktop\shelvy-clean"
#>

param(
    [string]$Source = (Get-Location).ProviderPath,
    [string]$Dest = (Join-Path $env:USERPROFILE "Desktop\shelvy-clean")
)

if (-not (Test-Path $Source)) {
    Write-Error "Source not found: $Source"
    exit 1
}

# Ensure Desktop exists
$desktop = Join-Path $env:USERPROFILE "Desktop"
if (-not (Test-Path $desktop)) { New-Item -ItemType Directory -Path $desktop | Out-Null }

# Remove existing destination and recreate
if (Test-Path $Dest) { Remove-Item $Dest -Recurse -Force }
New-Item -ItemType Directory -Path $Dest -Force | Out-Null

# Copy project excluding secrets and large folders. Use quoted paths to handle spaces.
$robocopySource = $Source.TrimEnd('\')
$robocopyDest = $Dest.TrimEnd('\')
robocopy "$robocopySource" "$robocopyDest" /E /XF "creds.txt" ".env" ".env.local" ".env.*" /XD ".git" "node_modules" | Out-Null

# Write .gitignore into the clean copy
$gitignore = @"
node_modules/
.env
creds.txt
dist/
.vscode/
npm-debug.log
.DS_Store
"@
Set-Content -Path (Join-Path $Dest ".gitignore") -Value $gitignore -Encoding UTF8 -Force

# Write .env.example into the clean copy
$envExample = @"
MONGO_URI=your_mongo_uri_here
JWT_SECRET=change_me_to_a_strong_secret
PORT=4000
"@
Set-Content -Path (Join-Path $Dest ".env.example") -Value $envExample -Encoding UTF8 -Force

# Create zip on Desktop
$zipPath = Join-Path $desktop "shelvy-clean.zip"
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
Compress-Archive -Path (Join-Path $Dest "*") -DestinationPath $zipPath -Force

Write-Output "Clean package created: $zipPath"
```// filepath: scripts\make-clean-package.ps1
<#
Creates a cleaned copy of the current project (or a specified source) on the Desktop
and produces a shelvy-clean.zip. Excludes common secret files and node_modules.
Usage:
  From repo root:
    .\scripts\make-clean-package.ps1
  Or specify source/destination:
    .\scripts\make-clean-package.ps1 -Source "D:\path\to\project" -Dest "$env:USERPROFILE\Desktop\shelvy-clean"
#>

param(
    [string]$Source = (Get-Location).ProviderPath,
    [string]$Dest = (Join-Path $env:USERPROFILE "Desktop\shelvy-clean")
)

if (-not (Test-Path $Source)) {
    Write-Error "Source not found: $Source"
    exit 1
}

# Ensure Desktop exists
$desktop = Join-Path $env:USERPROFILE "Desktop"
if (-not (Test-Path $desktop)) { New-Item -ItemType Directory -Path $desktop | Out-Null }

# Remove existing destination and recreate
if (Test-Path $Dest) { Remove-Item $Dest -Recurse -Force }
New-Item -ItemType Directory -Path $Dest -Force | Out-Null

# Copy project excluding secrets and large folders. Use quoted paths to handle spaces.
$robocopySource = $Source.TrimEnd('\')
$robocopyDest = $Dest.TrimEnd('\')
robocopy "$robocopySource" "$robocopyDest" /E /XF "creds.txt" ".env" ".env.local" ".env.*" /XD ".git" "node_modules" | Out-Null

# Write .gitignore into the clean copy
$gitignore = @"
node_modules/
.env
creds.txt
dist/
.vscode/
npm-debug.log
.DS_Store
"@
Set-Content -Path (Join-Path $Dest ".gitignore") -Value $gitignore -Encoding UTF8 -Force

# Write .env.example into the clean copy
$envExample = @"
MONGO_URI=your_mongo_uri_here
JWT_SECRET=change_me_to_a_strong_secret
PORT=4000
"@
Set-Content -Path (Join-Path $Dest ".env.example") -Value $envExample -Encoding UTF8 -Force

# Create zip on Desktop
$zipPath = Join-Path $desktop "shelvy-clean.zip"
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
Compress-Archive -Path (Join-Path $Dest "*") -DestinationPath $zipPath -Force

Write-Output "Clean package created: $zipPath"