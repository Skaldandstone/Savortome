# Enables Sign in with Apple on the Savortome Clerk PRODUCTION instance.
#
# Everything Apple needs is already registered:
#   Services ID  com.secondbreakfast.app.signin  ("Savortome Sign in with Apple")
#   Primary App ID  BVB696HTCS.com.secondbreakfast.app
#   Domain       clerk.savortome.skaldandstone.com
#   Return URL   https://clerk.savortome.skaldandstone.com/v1/oauth_callback
#   Email source clkmail.savortome.skaldandstone.com (+ the Clerk bounces address)
#
# What is left is the signing key, because Apple lets it be downloaded exactly
# once, at creation, and it is a private key:
#   1. https://developer.apple.com/account/resources/authkeys/list
#   2. "+" -> name it "Savortome Sign in with Apple" -> tick Sign in with Apple
#      -> Configure -> primary App ID com.secondbreakfast.app -> Save
#   3. Continue -> Register -> Download. Keep the .p8 file; note the Key ID
#      shown on that page (10 characters).
#
# Then run, pointing at the file you just downloaded:
#   .\set-clerk-apple-sso.ps1 -KeyPath "$HOME\Downloads\AuthKey_ABC1234567.p8" -KeyId ABC1234567
#
# The Key ID can be omitted when the filename still has Apple's AuthKey_<id>.p8
# shape - it is read from the name.
#
# The key is read from disk, sent to Clerk, and dropped. It is never printed.
# The file itself is left alone: deleting someone's only copy of a key that
# cannot be downloaded again is not this script's decision to make.
param(
  [Parameter(Mandatory = $true)][string]$KeyPath,
  [string]$KeyId
)

$ErrorActionPreference = 'Stop'

$app = 'app_3IOlw60gO26QYyAhTKUL84jVUZZ'
$ins = 'ins_3JA04CTgisnnvlq1nMpUQpLOvnm'
$servicesId = 'com.secondbreakfast.app.signin'
$teamId = 'BVB696HTCS'
$bundleId = 'com.secondbreakfast.app'

if (-not (Test-Path -LiteralPath $KeyPath)) { throw "No file at $KeyPath" }

if ([string]::IsNullOrWhiteSpace($KeyId)) {
  $name = [IO.Path]::GetFileNameWithoutExtension($KeyPath)
  if ($name -match '^AuthKey_([A-Z0-9]{10})$') {
    $KeyId = $Matches[1]
    Write-Host "Key ID read from the filename: $KeyId"
  } else {
    throw 'Could not read a Key ID from the filename. Pass it with -KeyId.'
  }
}
if ($KeyId -notmatch '^[A-Z0-9]{10}$') { throw "A Key ID is 10 characters; got '$KeyId'." }

$privateKey = (Get-Content -LiteralPath $KeyPath -Raw)
if ($privateKey -notmatch 'BEGIN PRIVATE KEY') {
  throw 'That file does not contain a PEM private key. Apple names it AuthKey_<KeyID>.p8.'
}

$payload = @{
  connection_oauth_apple = @{
    enabled         = $true
    authenticatable = $true
    client_id       = $servicesId
    client_secret   = $privateKey
    team_id         = $teamId
    key_id          = $KeyId
    bundle_id       = $bundleId
  }
} | ConvertTo-Json -Compress -Depth 5

# Windows PowerShell strips the inner double quotes when handing an argument to
# a native executable, so the CLI would receive malformed JSON and reject it.
$encoded = $payload -replace '"', '\"'

try {
  clerk config patch --app $app --instance $ins --json $encoded --yes | Out-Null
} finally {
  $payload = $null
  $encoded = $null
  $privateKey = $null
  [GC]::Collect()
}

Write-Host ''
Write-Host 'Patched. Verifying (no key material is printed):'
$cfg = clerk config pull --app $app --instance $ins --mode agent | ConvertFrom-Json
$apple = $cfg.connection_oauth_apple
Write-Host ("  apple enabled   : {0}" -f $apple.enabled)
Write-Host ("  services id     : {0}" -f $apple.client_id)
Write-Host ("  team id         : {0}" -f $apple.team_id)
Write-Host ("  key id          : {0}" -f $apple.key_id)
Write-Host ''
Write-Host 'If enabled is True, the Apple button appears on sign-in with no redeploy.'
