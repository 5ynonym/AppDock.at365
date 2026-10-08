$ErrorActionPreference = 'Stop'
$projectDirectory = Split-Path $PSScriptRoot -Parent
$toolchain = Get-Content -LiteralPath (Join-Path $projectDirectory 'toolchain.json') -Raw | ConvertFrom-Json
$nodeVersion = $toolchain.node
$pnpmVersion = $toolchain.pnpm
foreach ($version in @($nodeVersion, $pnpmVersion)) {
    if ($version -isnot [string] -or $version -notmatch '^\d+\.\d+\.\d+$') {
        throw 'toolchain.json must specify exact node and pnpm versions, such as 24.21.0.'
    }
}
$toolsDirectory = Join-Path $projectDirectory '.tools'
$nodeDirectory = Join-Path $toolsDirectory "node\$nodeVersion"
$pnpmDirectory = Join-Path $toolsDirectory "pnpm\$pnpmVersion"
$nodeExecutable = Join-Path $nodeDirectory 'node.exe'
$pnpmCommand = Join-Path $pnpmDirectory 'node_modules\.bin\pnpm.cmd'
New-Item -ItemType Directory -Path $toolsDirectory -Force | Out-Null

if (-not (Test-Path -LiteralPath $nodeExecutable -PathType Leaf)) {
    if (Test-Path -LiteralPath $nodeDirectory) {
        throw "The local Node folder is incomplete. Rename .tools\node\$nodeVersion and run setup again."
    }
    $archiveName = "node-v$nodeVersion-win-x64.zip"
    $downloadDirectory = Join-Path $toolsDirectory 'downloads'
    New-Item -ItemType Directory -Path $downloadDirectory -Force | Out-Null
    $archivePath = Join-Path $downloadDirectory $archiveName
    $baseUrl = "https://nodejs.org/dist/v$nodeVersion"
    [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
    Write-Output "Downloading Node.js $nodeVersion from nodejs.org..."
    $checksums = (Invoke-WebRequest -Uri "$baseUrl/SHASUMS256.txt" -UseBasicParsing).Content
    $checksumLine = @($checksums -split "`n" | Where-Object {
        $_.Trim() -match ('^[a-fA-F0-9]{64}\s+' + [regex]::Escape($archiveName) + '$')
    })
    if ($checksumLine.Count -ne 1) { throw 'Cannot find the official Node.js ZIP checksum.' }
    $expectedHash = ($checksumLine[0].Trim() -split '\s+')[0]
    if (-not (Test-Path -LiteralPath $archivePath -PathType Leaf) -or
        (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash -ne $expectedHash) {
        Invoke-WebRequest -Uri "$baseUrl/$archiveName" -OutFile $archivePath -UseBasicParsing
    }
    if ((Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash -ne $expectedHash) {
        throw 'Node.js ZIP checksum does not match the official SHA256.'
    }
    $stagingDirectory = Join-Path $toolsDirectory ('.extract-' + [guid]::NewGuid().ToString('N'))
    Expand-Archive -LiteralPath $archivePath -DestinationPath $stagingDirectory
    $extractedDirectory = Join-Path $stagingDirectory "node-v$nodeVersion-win-x64"
    if (-not (Test-Path -LiteralPath (Join-Path $extractedDirectory 'node.exe') -PathType Leaf)) {
        throw 'The Node.js archive does not contain the expected executable.'
    }
    # Both paths are fixed descendants of this project; never move an external checkout.
    $resolvedStaging = [IO.Path]::GetFullPath($extractedDirectory)
    $resolvedNode = [IO.Path]::GetFullPath($nodeDirectory)
    $allowedRoot = [IO.Path]::GetFullPath($toolsDirectory).TrimEnd('\') + '\'
    if (-not $resolvedStaging.StartsWith($allowedRoot, [StringComparison]::OrdinalIgnoreCase) -or
        -not $resolvedNode.StartsWith($allowedRoot, [StringComparison]::OrdinalIgnoreCase)) {
        throw 'Tool paths must stay within the project .tools directory.'
    }
    New-Item -ItemType Directory -Path (Split-Path $nodeDirectory -Parent) -Force | Out-Null
    Move-Item -LiteralPath $extractedDirectory -Destination $nodeDirectory
    Remove-Item -LiteralPath $stagingDirectory # Empty directory only; no recursive deletion.
}
$actualNode = & $nodeExecutable --version
if ($LASTEXITCODE -ne 0 -or $actualNode -ne "v$nodeVersion") {
    throw "Expected local Node.js v$nodeVersion; found $actualNode."
}

$originalPath = $env:Path
$originalCache = $env:npm_config_cache
try {
    $env:Path = "$nodeDirectory;$originalPath"
    $env:npm_config_cache = Join-Path $toolsDirectory 'npm-cache'
    if (-not (Test-Path -LiteralPath $pnpmCommand -PathType Leaf)) {
        Write-Output "Installing pnpm $pnpmVersion inside .tools\pnpm\$pnpmVersion..."
        & (Join-Path $nodeDirectory 'npm.cmd') install --prefix $pnpmDirectory --no-audit --no-fund --no-update-notifier --ignore-scripts --save-exact "pnpm@$pnpmVersion"
        if ($LASTEXITCODE -ne 0) { throw "Local pnpm installation failed ($LASTEXITCODE)." }
    }
    # pnpm 12 ships a native executable. Our initial npm install intentionally
    # blocks dependency scripts; run only pnpm's own binary setup, then regenerate
    # npm's Windows shims against the rewritten .exe bin entries.
    $pnpmPackageDirectory = Join-Path $pnpmDirectory 'node_modules\pnpm'
    if ([int]($pnpmVersion.Split('.')[0]) -ge 12) {
        if (-not (Test-Path -LiteralPath (Join-Path $pnpmPackageDirectory 'pnpm.exe') -PathType Leaf)) {
            & $nodeExecutable (Join-Path $pnpmPackageDirectory 'install.js')
            if ($LASTEXITCODE -ne 0) { throw "Local pnpm binary setup failed ($LASTEXITCODE)." }
        }
        & (Join-Path $nodeDirectory 'npm.cmd') rebuild --prefix $pnpmDirectory --ignore-scripts pnpm
        if ($LASTEXITCODE -ne 0) { throw "Local pnpm shim setup failed ($LASTEXITCODE)." }
    }
    $actualPnpm = & $pnpmCommand --version
    if ($LASTEXITCODE -ne 0 -or $actualPnpm -ne $pnpmVersion) {
        throw "Expected local pnpm $pnpmVersion; found $actualPnpm."
    }
} finally {
    $env:Path = $originalPath
    $env:npm_config_cache = $originalCache
}
$environment = @"
@echo off
set "APPDOCK_NODE_DIR=%~dp0node\$nodeVersion"
set "APPDOCK_PNPM_DIR=%~dp0pnpm\$pnpmVersion\node_modules\.bin"
"@
$environmentPath = Join-Path $toolsDirectory 'environment.bat'
$environmentTemp = Join-Path $toolsDirectory ('.environment-' + [guid]::NewGuid().ToString('N') + '.tmp')
$environmentText = ($environment -replace '\r?\n', "`r`n") + "`r`n"
[IO.File]::WriteAllText($environmentTemp, $environmentText, [Text.Encoding]::GetEncoding(932))
if (Test-Path -LiteralPath $environmentPath -PathType Leaf) {
    [IO.File]::Replace($environmentTemp, $environmentPath, [System.Management.Automation.Language.NullString]::Value)
} else {
    [IO.File]::Move($environmentTemp, $environmentPath)
}
Write-Output "Ready: Node.js $nodeVersion and pnpm $pnpmVersion in $toolsDirectory"
Write-Output 'Next: dev.bat install --frozen-lockfile, then publish.bat'
