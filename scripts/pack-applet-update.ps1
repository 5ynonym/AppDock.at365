param(
    [Parameter(Mandatory = $true)][string]$SourceDirectory,
    [Parameter(Mandatory = $true)][string]$OutputDirectory
)
$ErrorActionPreference = 'Stop'
$taskHostRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$taskSource = [IO.Path]::GetFullPath($SourceDirectory)
$taskOutput = [IO.Path]::GetFullPath($OutputDirectory)
$taskHelper = Join-Path $taskHostRoot 'artifacts\updater\AppDock.Updater.exe'
$taskProject = Join-Path $taskHostRoot 'dotnet\AppDock.Updater\AppDock.Updater.csproj'
# Incremental publishing keeps the shared packer current, including on a fresh checkout.
& dotnet publish $taskProject -c Release -o (Split-Path $taskHelper -Parent)
if ($LASTEXITCODE -ne 0) { throw "Update packer build failed ($LASTEXITCODE)" }
& $taskHelper --pack applet $taskSource unused $taskOutput
if ($LASTEXITCODE -ne 0) { throw "Applet update package failed ($LASTEXITCODE)" }
Write-Output "Update feed: $(Join-Path $taskOutput 'update.json')"
Write-Output "Update archive: $(Join-Path $taskOutput 'update.zip')"
