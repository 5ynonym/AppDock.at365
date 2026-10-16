function Get-PublishDirectory([string]$Repository) {
    $taskRepository = [IO.Path]::GetFullPath($Repository)
    return [IO.Path]::GetFullPath((Join-Path $taskRepository ('..\..\40.ARTIFACT\' + (Split-Path $taskRepository -Leaf))))
}

function Install-PublishedDeployment([string]$Repository, [string]$OutputDirectory) {
    $taskOutput = [IO.Path]::GetFullPath($OutputDirectory)
    New-Item -ItemType Directory -Path $taskOutput -Force | Out-Null
    $taskTemplate = Join-Path $Repository 'deployment'
    foreach ($taskFile in Get-ChildItem -LiteralPath $taskTemplate -Recurse -File) {
        $taskRelative = $taskFile.FullName.Substring($taskTemplate.Length + 1)
        $taskDestination = Join-Path $taskOutput $taskRelative
        # Deployment files belong to the operator after the first successful publish.
        if (-not (Test-Path -LiteralPath $taskDestination)) {
            New-Item -ItemType Directory -Path (Split-Path $taskDestination -Parent) -Force | Out-Null
            Copy-Item -LiteralPath $taskFile.FullName -Destination $taskDestination
        }
    }
    $taskLocalConfig = Join-Path $Repository 'deploy.local.txt'
    $taskPublishedConfig = Join-Path $taskOutput 'deploy.local.txt'
    if ((Test-Path -LiteralPath $taskLocalConfig -PathType Leaf) -and
        -not (Test-Path -LiteralPath $taskPublishedConfig)) {
        Copy-Item -LiteralPath $taskLocalConfig -Destination $taskPublishedConfig
    }
}
