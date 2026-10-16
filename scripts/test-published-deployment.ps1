$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'publish-paths.ps1')
$taskHost = Split-Path $PSScriptRoot -Parent
$taskRun = Join-Path $taskHost ('.artifacts\published-deployment-' + [DateTime]::Now.ToString('yyyyMMdd-HHmmss'))
$taskResults = @()
foreach ($taskRepo in Get-ChildItem -LiteralPath (Split-Path $taskHost -Parent) -Directory) {
    if (-not (Test-Path -LiteralPath (Join-Path $taskRepo.FullName 'deployment\deploy.bat'))) { continue }
    $taskPublished = Get-PublishDirectory $taskRepo.FullName
    $taskFixture = Join-Path $taskRun ($taskRepo.Name + '\発行済み with spaces')
    $taskTarget = Join-Path $taskRun ($taskRepo.Name + '\配置先 with spaces')
    New-Item -ItemType Directory -Path $taskFixture, $taskTarget -Force | Out-Null
    Copy-Item -LiteralPath (Join-Path $taskPublished 'deploy.bat') -Destination $taskFixture
    Copy-Item -LiteralPath (Join-Path $taskPublished 'scripts') -Destination $taskFixture -Recurse
    if ($taskRepo.Name -eq 'AppDock.at365') {
        $taskPayload = 'AppDock.at365.exe'
        $taskInstalled = 'AppDock.at365.exe'
    } else {
        $taskManifest = Get-Content -LiteralPath (Join-Path $taskRepo.FullName 'extension.json') -Raw -Encoding UTF8 | ConvertFrom-Json
        $taskPayload = if ($taskRepo.Name -eq 'Applet.WebApplet.at365') { 'extensions\at365.web-applet' } else { $taskRepo.Name }
        $taskInstalled = 'extensions\' + (Split-Path $taskPayload -Leaf)
    }
    $taskSource = Join-Path $taskFixture $taskPayload
    New-Item -ItemType Directory -Path (Split-Path $taskSource -Parent) -Force | Out-Null
    Copy-Item -LiteralPath (Join-Path $taskPublished $taskPayload) -Destination $taskSource -Recurse
    [IO.File]::WriteAllText((Join-Path $taskTarget 'AppDock.at365.exe'), 'fixture')
    foreach ($taskRelative in @('settings.json', 'data\keep.txt', 'extensions\unrelated\keep.txt')) {
        $taskFile = Join-Path $taskTarget $taskRelative
        New-Item -ItemType Directory -Path (Split-Path $taskFile -Parent) -Force | Out-Null
        [IO.File]::WriteAllText($taskFile, 'preserve')
    }
    $taskBatch = Join-Path $taskFixture 'deploy.bat'
    & $taskBatch $taskTarget *> (Join-Path $taskFixture 'explicit.log')
    if ($LASTEXITCODE -ne 0) { throw "Explicit deployment failed: $($taskRepo.Name)" }
    [IO.File]::WriteAllText((Join-Path $taskFixture 'deploy.local.txt'), $taskTarget, [Text.UTF8Encoding]::new($true))
    & $taskBatch *> (Join-Path $taskFixture 'config.log')
    if ($LASTEXITCODE -ne 0) { throw "UTF-8 configuration deployment failed: $($taskRepo.Name)" }
    [IO.File]::WriteAllText((Join-Path $taskFixture 'deploy.local.txt'), (Join-Path $taskRun 'missing'))
    & $taskBatch $taskTarget *> (Join-Path $taskFixture 'precedence.log')
    if ($LASTEXITCODE -ne 0) { throw "Argument precedence failed: $($taskRepo.Name)" }
    & $taskBatch *> (Join-Path $taskFixture 'invalid.log')
    if ($LASTEXITCODE -eq 0) { throw "Invalid destination was accepted: $($taskRepo.Name)" }
    $taskFiles = if (Test-Path -LiteralPath $taskSource -PathType Leaf) { @(Get-Item -LiteralPath $taskSource) } else { @(Get-ChildItem -LiteralPath $taskSource -Recurse -File) }
    foreach ($taskFile in $taskFiles) {
        $taskRelative = if ($taskFile.FullName -eq $taskSource) { '' } else { $taskFile.FullName.Substring($taskSource.Length + 1) }
        $taskDestination = Join-Path $taskTarget $taskInstalled
        if ($taskRelative) { $taskDestination = Join-Path $taskDestination $taskRelative }
        if ((Get-FileHash -LiteralPath $taskFile.FullName).Hash -ne (Get-FileHash -LiteralPath $taskDestination).Hash) { throw "Copy mismatch: $taskDestination" }
    }
    foreach ($taskRelative in @('settings.json', 'data\keep.txt', 'extensions\unrelated\keep.txt')) {
        if ([IO.File]::ReadAllText((Join-Path $taskTarget $taskRelative)) -ne 'preserve') { throw 'User data changed.' }
    }
    $taskResults += [ordered]@{ repository = $taskRepo.Name; passed = 4; hashesMatch = $true; dataPreserved = $true; detachedFromRepository = $true }
    Write-Output "PASS $($taskRepo.Name): detached deploy, UTF-8 config, argument precedence, invalid destination, hashes, data preservation"
}
if ($taskResults.Count -ne 7) { throw "Expected 7 repositories, found $($taskResults.Count)." }
$taskResults | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $taskRun 'result.json') -Encoding UTF8
Write-Output "Results: $taskRun"
