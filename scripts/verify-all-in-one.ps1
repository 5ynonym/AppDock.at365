param([Parameter(Mandatory = $true)][string]$Archive, [Parameter(Mandatory = $true)][string]$Destination)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$Destination = [IO.Path]::GetFullPath($Destination)
if (Test-Path -LiteralPath $Destination) { throw 'Verification destination must be new.' }
$taskZip = [IO.Compression.ZipFile]::OpenRead([IO.Path]::GetFullPath($Archive))
function Hash-Stream($Stream) {
    $taskHasher = [Security.Cryptography.SHA256]::Create()
    try { return [BitConverter]::ToString($taskHasher.ComputeHash($Stream)).Replace('-', '').ToLowerInvariant() }
    finally { $taskHasher.Dispose() }
}
try {
    $taskEntries = @{}
    foreach ($taskEntry in $taskZip.Entries) {
        $taskName = $taskEntry.FullName.Replace('\', '/')
        if ($taskName -match '(^/|:|(^|/)\.\.?(/|$)|[. ](/|$))' -or $taskName.Contains('//')) { throw "Unsafe ZIP path: $taskName" }
        if ($taskName.EndsWith('/')) { continue }
        if ($taskEntries.ContainsKey($taskName)) { throw "Duplicate ZIP path: $taskName" }
        $taskEntries[$taskName] = $taskEntry
    }
    if (-not $taskEntries.ContainsKey('bundle.json')) { throw 'Missing bundle.json' }
    $taskReader = [IO.StreamReader]::new($taskEntries['bundle.json'].Open())
    try { $taskBundle = $taskReader.ReadToEnd() | ConvertFrom-Json } finally { $taskReader.Dispose() }
    if ($taskBundle.schemaVersion -ne 1 -or @($taskBundle.applets).Count -eq 0) { throw 'Invalid bundle manifest' }
    $taskInventory = @{}
    foreach ($taskFile in $taskBundle.files) {
        if ($taskInventory.ContainsKey($taskFile.path) -or -not $taskEntries.ContainsKey($taskFile.path)) { throw "Invalid inventory: $($taskFile.path)" }
        $taskInventory[$taskFile.path] = $true
        $taskEntry = $taskEntries[$taskFile.path]
        $taskStream = $taskEntry.Open()
        try { $taskHash = Hash-Stream $taskStream } finally { $taskStream.Dispose() }
        if ($taskEntry.Length -ne $taskFile.size -or $taskHash -cne $taskFile.sha256) { throw "Bundle hash/size mismatch: $($taskFile.path)" }
    }
    if ($taskEntries.Count -ne $taskInventory.Count + 1 -or -not $taskInventory.ContainsKey('AppDock.at365.exe')) { throw 'Unlisted or missing files in bundle' }
    foreach ($taskName in $taskEntries.Keys) {
        $taskTarget = [IO.Path]::GetFullPath((Join-Path $Destination $taskName))
        if (-not $taskTarget.StartsWith($Destination + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'ZIP path escapes destination' }
        [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($taskTarget)) | Out-Null
        [IO.Compression.ZipFileExtensions]::ExtractToFile($taskEntries[$taskName], $taskTarget, $false)
    }
    Write-Output "Verified and extracted: $Destination"
} finally { $taskZip.Dispose() }
