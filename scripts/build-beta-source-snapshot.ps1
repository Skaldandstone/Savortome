param(
    [Parameter(Mandatory = $true)]
    [ValidateScript({ Test-Path -LiteralPath $_ -PathType Container })]
    [string]$OutputDirectory,
    [string]$Application = 'secondbreakfast',
    [ValidateRange(1, 500)]
    [int]$MaximumFileSizeMb = 50
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$repo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$output = [IO.Path]::GetFullPath($OutputDirectory)
function Get-SnapshotRelativePath([string]$Root, [string]$Path) {
    $prefix = $Root.TrimEnd('\', '/') + [IO.Path]::DirectorySeparatorChar
    if (!$Path.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) { throw 'Snapshot file escaped the staging directory.' }
    return $Path.Substring($prefix.Length).Replace('\', '/')
}
$gitDir = (& git -C $repo rev-parse --git-dir).Trim()
if ($LASTEXITCODE -ne 0 -or !$gitDir) { throw 'Could not resolve the Git repository.' }
$realIndexPath = (& git -C $repo rev-parse --git-path index).Trim()
if (![IO.Path]::IsPathRooted($realIndexPath)) { $realIndexPath = Join-Path $repo $realIndexPath }
$realIndexBefore = if (Test-Path -LiteralPath $realIndexPath) { (Get-FileHash -LiteralPath $realIndexPath -Algorithm SHA256).Hash.ToLowerInvariant() } else { $null }
$head = (& git -C $repo rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0 -or $head -notmatch '^[a-f0-9]{40}$') { throw 'Could not resolve HEAD.' }

$work = Join-Path $env:TEMP ("secondbreakfast-snapshot-" + [guid]::NewGuid().ToString('N'))
$index = Join-Path $work 'index'
$staging = Join-Path $work 'staging'
$baseZip = Join-Path $work 'source.zip'
New-Item -ItemType Directory -Path $work, $staging -Force | Out-Null

$oldIndex = $env:GIT_INDEX_FILE
try {
    $env:GIT_INDEX_FILE = $index
    & git -C $repo read-tree $head
    if ($LASTEXITCODE -ne 0) { throw 'Could not initialize the temporary Git index.' }

    # Evidence, generated build trees, local environments and concept sources are
    # deliberately outside the trusted container input. The real Git index is not
    # read or changed by this operation.
    $pathspecs = @(
        '.',
        ':(exclude).aws-rebuild/**',
        ':(exclude)design/**',
        ':(exclude)docs/beta/checks/**',
        ':(exclude)docs/beta/*.png',
        ':(exclude)docs/beta/*.jpg',
        ':(exclude)docs/beta/*.jpeg',
        ':(exclude)docs/beta/*.patch'
    )
    & git -C $repo add -A -- $pathspecs
    if ($LASTEXITCODE -ne 0) { throw 'Could not stage the reviewed workspace in the temporary index.' }

    $check = & git -C $repo diff --cached --check 2>&1
    $checkViolations = @($check | Where-Object { $_ -notmatch '^apps/web/public/care-offline\.js:\d+: trailing whitespace\.$' -and $_ -notmatch '^\+\s*$' })
    if ($checkViolations.Count) { throw "Snapshot whitespace validation failed:`n$($checkViolations -join "`n")" }

    $entries = @(& git -C $repo ls-files --stage)
    if ($LASTEXITCODE -ne 0 -or $entries.Count -eq 0) { throw 'The temporary source index is empty.' }
    $symlinks = @($entries | Where-Object { $_ -match '^120000 ' })
    if ($symlinks.Count) { throw "Source snapshot contains $($symlinks.Count) symlink(s)." }

    $tree = (& git -C $repo write-tree).Trim()
    if ($LASTEXITCODE -ne 0 -or $tree -notmatch '^[a-f0-9]{40}$') { throw 'Could not write the reviewed source tree.' }
    $env:GIT_AUTHOR_NAME = 'Second Breakfast release review'
    $env:GIT_AUTHOR_EMAIL = 'release-review@invalid.local'
    $env:GIT_COMMITTER_NAME = $env:GIT_AUTHOR_NAME
    $env:GIT_COMMITTER_EMAIL = $env:GIT_AUTHOR_EMAIL
    $commit = ("Second Breakfast reviewed beta source snapshot`n" | & git -C $repo commit-tree $tree -p $head).Trim()
    if ($LASTEXITCODE -ne 0 -or $commit -notmatch '^[a-f0-9]{40}$') { throw 'Could not create the immutable local snapshot commit.' }

    & git -C $repo archive --format=zip --output=$baseZip $commit
    if ($LASTEXITCODE -ne 0) { throw 'Could not archive the immutable source tree.' }
    [IO.Compression.ZipFile]::ExtractToDirectory($baseZip, $staging)

    $files = @(Get-ChildItem -LiteralPath $staging -File -Recurse)
    $maximumBytes = $MaximumFileSizeMb * 1MB
    $large = @($files | Where-Object Length -gt $maximumBytes)
    if ($large.Count) {
        $paths = $large | ForEach-Object { Get-SnapshotRelativePath $staging $_.FullName }
        throw "Source snapshot exceeds the per-file size limit: $($paths -join ', ')"
    }

    $forbiddenNames = @($files | Where-Object {
        $relative = Get-SnapshotRelativePath $staging $_.FullName
        $name = $_.Name.ToLowerInvariant()
        (($name -eq '.env' -or $name -like '.env.*') -and $name -ne '.env.example') -or
        $name -in @('id_rsa', 'id_ed25519', 'credentials', 'credentials.json') -or
        ($name.EndsWith('.key') -and $relative -notlike 'packages/db/certs/*')
    })
    if ($forbiddenNames.Count) {
        $paths = $forbiddenNames | ForEach-Object { Get-SnapshotRelativePath $staging $_.FullName }
        throw "Credential-like filenames are not allowed in the source snapshot: $($paths -join ', ')"
    }

    $secretPatterns = [ordered]@{
        'private-key' = '-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----'
        'aws-access-key' = '(?<![A-Z0-9])(?:AKIA|ASIA)[A-Z0-9]{16}(?![A-Z0-9])'
        'stripe-live-secret' = '(?<![A-Za-z0-9])(?:sk|rk)_live_[A-Za-z0-9]{16,}'
        'webhook-signing-secret' = '(?<![A-Za-z0-9])whsec_[A-Za-z0-9]{16,}'
    }
    $findings = [System.Collections.Generic.List[string]]::new()
    foreach ($file in $files) {
        if ($file.Length -gt 5MB) { continue }
        $bytes = [IO.File]::ReadAllBytes($file.FullName)
        if ($bytes -contains 0) { continue }
        $content = [Text.Encoding]::UTF8.GetString($bytes)
        foreach ($category in $secretPatterns.Keys) {
            if ($content -match $secretPatterns[$category]) {
                $relative = Get-SnapshotRelativePath $staging $file.FullName
                $findings.Add("$relative [$category]")
            }
        }
    }
    if ($findings.Count) { throw "Potential secrets found; values were not printed:`n$($findings -join "`n")" }

    $hashes = [ordered]@{}
    foreach ($file in ($files | Sort-Object FullName)) {
        $relative = Get-SnapshotRelativePath $staging $file.FullName
        $hashes[$relative] = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
    }
    $manifest = [ordered]@{
        application = $Application
        commit = $commit
        files = $hashes
    }
    $manifestDirectory = Join-Path $staging '.aws-rebuild'
    New-Item -ItemType Directory -Path $manifestDirectory -Force | Out-Null
    $manifestPath = Join-Path $manifestDirectory 'manifest.json'
    $manifestJson = $manifest | ConvertTo-Json -Depth 6
    [IO.File]::WriteAllText($manifestPath, $manifestJson + "`n", [Text.UTF8Encoding]::new($false))

    $manifestSha = (Get-FileHash -LiteralPath $manifestPath -Algorithm SHA256).Hash.ToLowerInvariant()
    $zipPath = Join-Path $output ("secondbreakfast-beta-source-$manifestSha.zip")
    if (Test-Path -LiteralPath $zipPath) { Remove-Item -LiteralPath $zipPath -Force }
    $archive = [IO.Compression.ZipFile]::Open($zipPath, [IO.Compression.ZipArchiveMode]::Create)
    try {
        foreach ($file in (Get-ChildItem -LiteralPath $staging -File -Recurse | Sort-Object FullName)) {
            $relative = Get-SnapshotRelativePath $staging $file.FullName
            $entry = $archive.CreateEntry($relative, [IO.Compression.CompressionLevel]::Optimal)
            $inputStream = [IO.File]::OpenRead($file.FullName)
            $outputStream = $entry.Open()
            try { $inputStream.CopyTo($outputStream) }
            finally { $outputStream.Dispose(); $inputStream.Dispose() }
        }
    } finally { $archive.Dispose() }
    $zipSha = (Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash.ToLowerInvariant()
    $realIndexAfter = if (Test-Path -LiteralPath $realIndexPath) { (Get-FileHash -LiteralPath $realIndexPath -Algorithm SHA256).Hash.ToLowerInvariant() } else { $null }
    if ($realIndexAfter -ne $realIndexBefore) { throw 'The real Git index changed while the snapshot was being sealed.' }

    $report = [ordered]@{
        application = $Application
        parentHead = $head
        snapshotCommit = $commit
        sourceTree = $tree
        manifestSha256 = $manifestSha
        archiveSha256 = $zipSha
        fileCount = $files.Count
        archiveBytes = (Get-Item -LiteralPath $zipPath).Length
        archivePath = $zipPath
        realIndexChanged = $false
        realIndexSha256 = $realIndexAfter
        exclusions = @('.aws-rebuild/**', 'design/**', 'docs/beta/checks/**', 'docs/beta/*.png', 'docs/beta/*.jpg', 'docs/beta/*.jpeg', 'docs/beta/*.patch')
    }
    $reportPath = Join-Path $output 'secondbreakfast-beta-source-report.json'
    [IO.File]::WriteAllText($reportPath, (($report | ConvertTo-Json -Depth 5) + "`n"), [Text.UTF8Encoding]::new($false))
    $report | ConvertTo-Json -Depth 5
} finally {
    if ($null -eq $oldIndex) { Remove-Item Env:\GIT_INDEX_FILE -ErrorAction SilentlyContinue }
    else { $env:GIT_INDEX_FILE = $oldIndex }
    Remove-Item -LiteralPath $work -Recurse -Force -ErrorAction SilentlyContinue
}
