param([string]$Destination)
$ErrorActionPreference = 'Stop'
$projectDirectory = Split-Path $PSScriptRoot -Parent
if (-not $Destination) {
    $configFile = Join-Path $projectDirectory 'deploy.local.txt'
    if (-not (Test-Path -LiteralPath $configFile -PathType Leaf)) { throw 'Pass a destination or create deploy.local.txt.' }
    $Destination = (Get-Content -LiteralPath $configFile -Encoding UTF8 -TotalCount 1).Trim()
}
if (-not [IO.Path]::IsPathFullyQualified($Destination)) { throw 'Destination must be an absolute path.' }
if (-not (Test-Path -LiteralPath $Destination -PathType Container)) { throw 'Destination folder must already exist.' }
$sourceFile = Join-Path $projectDirectory 'AppDock.at365.exe'
if (-not (Test-Path -LiteralPath $sourceFile -PathType Leaf)) { throw 'Published AppDock.at365.exe is missing.' }
Copy-Item -LiteralPath $sourceFile -Destination (Join-Path $Destination 'AppDock.at365.exe') -Force
if ((Get-FileHash -LiteralPath $sourceFile -Algorithm SHA256).Hash -ne
    (Get-FileHash -LiteralPath (Join-Path $Destination 'AppDock.at365.exe') -Algorithm SHA256).Hash) {
    throw 'Deployment hash mismatch.'
}
Write-Output "Deployed AppDock.at365.exe to $Destination"
