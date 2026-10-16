$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'publish-paths.ps1')
$taskRoot = Split-Path $PSScriptRoot -Parent
Install-PublishedDeployment $taskRoot (Get-PublishDirectory $taskRoot)
