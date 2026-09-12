# Enables Google sign-in on the Savortome Clerk PRODUCTION instance.
#
# Production Clerk instances will not use Clerk's shared development OAuth
# credentials, so this needs the app's own Google client. That client already
# exists - "Savortome Production Clerk" in Google Cloud project `savortome`,
# with the Clerk callback and both origins registered. Only its secret is
# missing, and Google no longer lets anyone view an existing one: it is shown
# once, at creation.
#
# BEFORE RUNNING, put the secret on the clipboard:
#   1. https://console.cloud.google.com/auth/clients?project=savortome
#   2. Open "Savortome Production Clerk" -> Add secret
#   3. Click the copy button next to the value it shows you. That is the only
#      time it is visible.
#
# Then run this with no arguments.
#
# It reads the clipboard rather than prompting because a masked PowerShell
# prompt refuses Ctrl+V in several terminals, and the alternative - a visible
# prompt - would leave the secret sitting in scrollback. Nothing is echoed,
# written to disk, or logged, and the clipboard is cleared afterwards.
#
# If clipboard access is unavailable, pass the secret directly instead:
#   .\set-clerk-google-sso.ps1 -Secret 'GOCSPX-...'
param([string]$Secret)

$ErrorActionPreference = 'Stop'

$app = 'app_3IOlw60gO26QYyAhTKUL84jVUZZ'
$ins = 'ins_3JA04CTgisnnvlq1nMpUQpLOvnm'
$clientId = '439777593604-jivv0d8a0abpqdj4jvdoqhk2fdavsai0.apps.googleusercontent.com'

$fromClipboard = $false
if ([string]::IsNullOrWhiteSpace($Secret)) {
  try {
    $Secret = (Get-Clipboard -Raw -ErrorAction Stop)
    $fromClipboard = $true
  } catch {
    throw 'Could not read the clipboard. Re-run with: .\set-clerk-google-sso.ps1 -Secret ''GOCSPX-...'''
  }
}

$Secret = ($Secret -replace '\s', '')
if ([string]::IsNullOrWhiteSpace($Secret)) {
  throw 'Nothing on the clipboard. Copy the secret from Google first, then re-run.'
}
if ($Secret -notlike 'GOCSPX-*') {
  throw ("What was supplied does not look like a Google client secret - they start with GOCSPX- " +
         "and this is $($Secret.Length) characters. Nothing was changed. Copy the secret itself, not the client ID.")
}

Write-Host ("Using a {0}-character secret{1}." -f $Secret.Length, $(if ($fromClipboard) { ' from the clipboard' } else { '' }))

$payload = @{
  connection_oauth_google = @{
    enabled         = $true
    authenticatable = $true
    client_id       = $clientId
    client_secret   = $Secret
  }
} | ConvertTo-Json -Compress -Depth 5

try {
  clerk config patch --app $app --instance $ins --json $payload --yes | Out-Null
} finally {
  $payload = $null
  $Secret = $null
  [GC]::Collect()
  # The secret has reached Clerk; leaving it on the clipboard only widens the
  # window in which something else can read it.
  if ($fromClipboard) { try { Set-Clipboard -Value '' } catch { } }
}

Write-Host ''
Write-Host 'Patched. Verifying (no secret is printed):'
$cfg = clerk config pull --app $app --instance $ins --mode agent | ConvertFrom-Json
$google = $cfg.connection_oauth_google
Write-Host ("  google enabled  : {0}" -f $google.enabled)
Write-Host ("  authenticatable : {0}" -f $google.authenticatable)
Write-Host ("  client id set   : {0}" -f (-not [string]::IsNullOrEmpty($google.client_id)))
Write-Host ''
Write-Host 'If enabled is True, the Google button appears on sign-in with no redeploy.'
