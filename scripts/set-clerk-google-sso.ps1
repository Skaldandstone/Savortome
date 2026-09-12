# Enables Google sign-in on the Savortome Clerk PRODUCTION instance.
#
# Production Clerk instances will not use Clerk's shared development OAuth
# credentials, so this needs the app's own Google client. That client already
# exists - "Savortome Production Clerk" in Google Cloud project `savortome`,
# with the Clerk callback and both origins registered. Only its secret is
# missing, and Google no longer lets anyone view an existing one: it is shown
# once, at creation.
#
# RUN THIS FIRST, THEN COPY THE SECRET. The script waits.
#
# That order matters: pasting the command to run would overwrite a secret you
# had already copied, and a masked PowerShell prompt refuses Ctrl+V in several
# terminals. So the script starts, tells you to go copy the secret, and waits
# for Enter - which needs no clipboard. It then reads the clipboard itself.
#
# While it waits:
#   1. https://console.cloud.google.com/auth/clients?project=savortome
#   2. Open "Savortome Production Clerk" -> Add secret
#   3. Click the copy button next to the value. That is the only time it is
#      visible.
#   4. Come back here and press Enter.
#
# Nothing is echoed, written to disk, or logged, and the clipboard is cleared
# once the secret has reached Clerk.
#
# If clipboard access is unavailable:
#   .\set-clerk-google-sso.ps1 -Secret 'GOCSPX-...'
param([string]$Secret)

$ErrorActionPreference = 'Stop'

$app = 'app_3IOlw60gO26QYyAhTKUL84jVUZZ'
$ins = 'ins_3JA04CTgisnnvlq1nMpUQpLOvnm'
$clientId = '439777593604-jivv0d8a0abpqdj4jvdoqhk2fdavsai0.apps.googleusercontent.com'

function Read-ClipboardSecret {
  try { return (Get-Clipboard -Raw -ErrorAction Stop) } catch { return $null }
}

$fromClipboard = $false
if ([string]::IsNullOrWhiteSpace($Secret)) {
  # Maybe it is already there - no need to make anyone do it twice.
  $candidate = ($(Read-ClipboardSecret) -replace '\s', '')
  if ($candidate -like 'GOCSPX-*') {
    $Secret = $candidate
    $fromClipboard = $true
  } else {
    Write-Host ''
    Write-Host 'Copy the Google client secret now, then come back and press Enter.' -ForegroundColor Cyan
    Write-Host '  https://console.cloud.google.com/auth/clients?project=savortome'
    Write-Host '  "Savortome Production Clerk" -> Add secret -> copy the value'
    Write-Host ''
    Write-Host 'Waiting. Nothing has changed yet; Ctrl+C here is safe.'
    [void](Read-Host 'Press Enter once it is copied')

    $Secret = ($(Read-ClipboardSecret) -replace '\s', '')
    $fromClipboard = $true
  }
}

$Secret = ($Secret -replace '\s', '')
if ([string]::IsNullOrWhiteSpace($Secret)) {
  throw 'The clipboard was empty. Copy the secret from Google, then run this again.'
}
if ($Secret -notlike 'GOCSPX-*') {
  throw ("The clipboard does not hold a Google client secret - they start with GOCSPX- and this " +
         "is $($Secret.Length) characters. Nothing was changed. Make sure you copied the secret " +
         "itself, not the client ID.")
}

Write-Host ''
Write-Host ("Using a {0}-character secret{1}." -f $Secret.Length, $(if ($fromClipboard) { ' from the clipboard' } else { '' }))

$payload = @{
  connection_oauth_google = @{
    enabled         = $true
    authenticatable = $true
    client_id       = $clientId
    client_secret   = $Secret
  }
} | ConvertTo-Json -Compress -Depth 5

# Windows PowerShell strips the inner double quotes when handing an argument to
# a native executable, so the CLI would receive malformed JSON and reject it.
# Escaping them is what survives the hand-off.
$encoded = $payload -replace '"', '\"'

try {
  clerk config patch --app $app --instance $ins --json $encoded --yes | Out-Null
} finally {
  $payload = $null
  $encoded = $null
  $Secret = $null
  [GC]::Collect()
  # It has reached Clerk; leaving it on the clipboard only widens the window
  # in which something else can read it.
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
