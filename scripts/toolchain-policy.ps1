function Assert-ToolchainPolicy {
    param($Policy, [string]$WorkspaceText)
    if ($Policy.nodeChannel -ne 'lts') { throw 'toolchain.json nodeChannel must be lts.' }
    if ($Policy.minimumReleaseAgeDays -isnot [int] -or $Policy.minimumReleaseAgeDays -lt 1) {
        throw 'minimumReleaseAgeDays must be a positive integer.'
    }
    $minutes = $Policy.minimumReleaseAgeDays * 1440
    if ($WorkspaceText -notmatch "(?m)^minimumReleaseAge: $minutes\s*$" -or
        $WorkspaceText -notmatch '(?m)^minimumReleaseAgeStrict: true\s*$' -or
        $WorkspaceText -notmatch '(?m)^minimumReleaseAgeIgnoreMissingTime: false\s*$') {
        throw 'pnpm-workspace.yaml must match the strict toolchain release-age policy.'
    }
    foreach ($exception in $Policy.releaseAgeExceptions) {
        if ($exception.package -notin @('node', 'pnpm', '@pnpm/exe.win32-x64') -or
            $exception.version -notmatch '^\d+\.\d+\.\d+$' -or
            [string]::IsNullOrWhiteSpace($exception.reason)) {
            throw 'Tool exceptions require an allowed package, an exact version and a reason.'
        }
    }
}

function Assert-ToolRelease {
    param($Policy, [string]$Package, [string]$Version, [string]$Published,
        [DateTimeOffset]$Now = [DateTimeOffset]::UtcNow)
    if ([string]::IsNullOrWhiteSpace($Published)) { throw "Missing publication date: $Package@$Version" }
    try {
        $publishedAt = [DateTimeOffset]::Parse($Published, [Globalization.CultureInfo]::InvariantCulture,
            [Globalization.DateTimeStyles]::AssumeUniversal)
        # Node's index has a date, not a timestamp. Wait through that entire UTC day.
        if ($Published -match '^\d{4}-\d{2}-\d{2}$') { $publishedAt = $publishedAt.AddDays(1) }
    } catch { throw "Invalid publication date: $Package@$Version" }
    if ($publishedAt -gt $Now.AddDays(-$Policy.minimumReleaseAgeDays)) {
        $exception = @($Policy.releaseAgeExceptions | Where-Object {
            $_.package -ceq $Package -and $_.version -ceq $Version
        })
        if ($exception.Count -eq 0) {
            throw "Release is too recent: $Package@$Version. Eligible after $($publishedAt.AddDays($Policy.minimumReleaseAgeDays).ToString('u'))."
        }
        Write-Warning "Release-age exception: $Package@$Version ($($exception[0].reason))"
        return $true
    }
    return $false
}

function Get-ApprovedNodeRelease {
    param($Policy, [string]$Version)
    $releases = Invoke-RestMethod -Uri 'https://nodejs.org/dist/index.json' -TimeoutSec 30
    $release = @($releases | Where-Object { $_.version -ceq "v$Version" })
    if ($release.Count -ne 1 -or $release[0].lts -isnot [string] -or
        [string]::IsNullOrWhiteSpace($release[0].lts)) {
        throw "Node.js $Version is not an official LTS release."
    }
    $null = Assert-ToolRelease $Policy 'node' $Version $release[0].date
    return $release[0]
}

function Get-ApprovedPnpmInstallArguments {
    param($Policy, [string]$Version)
    # npm bootstraps pnpm; the workspace's pnpm settings cannot govern this install.
    $metadata = Invoke-RestMethod -Uri 'https://registry.npmjs.org/pnpm' -TimeoutSec 30
    $arguments = @("--min-release-age=$($Policy.minimumReleaseAgeDays)")
    if (Assert-ToolRelease $Policy 'pnpm' $Version $metadata.time.$Version) {
        $arguments += '--min-release-age-exclude=pnpm'
    }
    if ([int]($Version.Split('.')[0]) -lt 12) { return $arguments }
    $nativeName = '@pnpm/exe.win32-x64'
    if ($metadata.versions.$Version.optionalDependencies.$nativeName -cne $Version) {
        throw 'Expected an exactly pinned Windows x64 pnpm binary dependency.'
    }
    $nativeMetadata = Invoke-RestMethod -Uri 'https://registry.npmjs.org/@pnpm%2fexe.win32-x64' -TimeoutSec 30
    if (Assert-ToolRelease $Policy $nativeName $Version $nativeMetadata.time.$Version) {
        $arguments += "--min-release-age-exclude=$nativeName"
    }
    return $arguments
}
