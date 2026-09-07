param(
  [Parameter(Mandatory=$true)][string]$Apk,
  [Parameter(Mandatory=$true)][ValidateSet('account-preview','guest-preview')][string]$Configuration,
  [Parameter(Mandatory=$true)][string]$Report,
  [string]$SourceManifest = 'docs/beta/checks/overnight-android-source-manifest.json'
)
$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$apkPath=(Resolve-Path -LiteralPath $Apk).Path
Add-Type -AssemblyName System.IO.Compression.FileSystem
function Read-ZipBytes($entry) {
  $stream=$entry.Open();$memory=New-Object IO.MemoryStream
  try {$stream.CopyTo($memory);return ,$memory.ToArray()} finally {$stream.Dispose();$memory.Dispose()}
}
function Hash-Bytes([byte[]]$bytes) {
  $hash=[Security.Cryptography.SHA256]::Create()
  try{return ([BitConverter]::ToString($hash.ComputeHash($bytes))).Replace('-','').ToLowerInvariant()}finally{$hash.Dispose()}
}
$zip=[IO.Compression.ZipFile]::OpenRead($apkPath)
try {
  $bundleEntry=$zip.GetEntry('assets/index.android.bundle')
  if(!$bundleEntry){throw 'Packaged JavaScript bundle missing.'}
  $bundle=Read-ZipBytes $bundleEntry
  $bundleText=[Text.Encoding]::UTF8.GetString($bundle)
  $markers=@('Your woodland kitchen','View details','Sign in again before saving.','We could not confirm the list update.','Matches use ingredient names, not quantities or preparation.','Feed me gently')
  $found=foreach($marker in $markers){[pscustomobject]@{marker=$marker;present=$bundleText.Contains($marker)}}
  if(@($found|Where-Object {!$_.present}).Count){throw 'Expected native care/woodland marker missing from APK.'}
  # Only the presence boolean is written. Never print or persist the local key.
  $keyLine=Get-Content -LiteralPath (Join-Path $root 'apps/mobile/.env') | Where-Object {$_ -match '^EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY='} | Select-Object -First 1
  $localKey=if($keyLine){($keyLine -split '=',2)[1].Trim().Trim('"').Trim("'")}else{''}
  if(!$localKey){throw 'Local test publishable key is needed for the account/guest absence audit.'}
  $containsKey=$bundleText.Contains($localKey)
  if($containsKey -ne ($Configuration -eq 'account-preview')){throw 'Packaged Clerk configuration differs from requested preview.'}
  $localKey=$null;$keyLine=$null
  $imageHashes=@{}
  foreach($entry in $zip.Entries){if($entry.FullName.EndsWith('.webp')){$imageHashes[(Hash-Bytes (Read-ZipBytes $entry))]=$entry.FullName}}
  $assets=foreach($name in @('kitchen-scene','food-atlas','parchment','timber')){
    $path="apps/mobile/assets/woodland/$name.webp"
    $hash=(Get-FileHash -LiteralPath (Join-Path $root $path) -Algorithm SHA256).Hash.ToLowerInvariant()
    if(!$imageHashes.ContainsKey($hash)){throw "Packaged artwork differs or is missing: $name"}
    [pscustomobject]@{path=$path;sha256=$hash;apkEntry=$imageHashes[$hash]}
  }
  $sourcePath=if([IO.Path]::IsPathRooted($SourceManifest)){$SourceManifest}else{Join-Path $root $SourceManifest}
  $source=Get-Content -LiteralPath $sourcePath -Raw | ConvertFrom-Json
  $drift=@($source|Where-Object {(Get-FileHash -LiteralPath (Join-Path $root $_.path) -Algorithm SHA256).Hash.ToLowerInvariant() -ne $_.sha256})
  if($drift.Count){throw "Android source drift: $($drift.Count) files"}
  $result=[pscustomobject]@{
    recordedAt=[DateTimeOffset]::Now.ToString('o');configuration=$Configuration;apk=$apkPath;
    bytes=(Get-Item -LiteralPath $apkPath).Length;sha256=(Get-FileHash -LiteralPath $apkPath -Algorithm SHA256).Hash.ToLowerInvariant();
    bundleSha256=(Hash-Bytes $bundle);bundleBytes=$bundle.Length;containsConfiguredClerkTestKey=$containsKey;
    markers=$found;assets=$assets;sourceManifest=$sourcePath;sourceFiles=$source.Count;sourceDrift=$drift.Count;
    signing='Android debug certificate, local review only; see separate apksigner output';
    runtimeTested=$false;physicalDeviceTested=$false;visualAccepted=$false
  }
  $result|ConvertTo-Json -Depth 6|Set-Content -LiteralPath $Report
  [pscustomobject]@{configuration=$Configuration;sha256=$result.sha256;bytes=$result.bytes;assets=$assets.Count;sourceDrift=$drift.Count}|ConvertTo-Json -Compress
} finally {$zip.Dispose()}
