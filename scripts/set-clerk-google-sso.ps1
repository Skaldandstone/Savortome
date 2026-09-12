# Enables Google sign-in on the Savortome Clerk PRODUCTION instance.
#
# Production Clerk instances will not use Clerk's shared development OAuth
# credentials, so this needs the app's own Google client. That client already
# exists - "Savortome Production Clerk" in Google Cloud project `savortome`,
# with the Clerk callback and both origins registered. Only its secret is
# missing, and Google no longer lets anyone view an existing one: it is shown
# once, at creation.
#
# BEFORE RUNNING, mint a secret to paste:
#   1. https://console.cloud.google.com/auth/clients?project=savortome
#   2. Open "Savortome Production Clerk" -> Add secret
#   3. Copy the value it shows you. That is the only time it is visible.
#
# The secret is read with a hidden prompt, held in memory, and sent straight
# to Clerk. It is never echoed, never written to disk, and never logged.
$ErrorActionPreference = 'Stop'

$app = 'app_3IOlw60gO26QYyAhTKUL84jVUZZ'
$ins = 'ins_3JA04CTgisnnvlq1nMpUQpLOvnm'
$clientId = '439777593604-jivv0d8a0abpqdj4jvdoqhk2fdavsai0.apps.googleusercontent.com'

Write-Host 'Paste the Google OAuth client secret, then press Enter. Input is hidden.'
$secure = Read-Host -AsSecureString 'Client secret'
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
  $secret = [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
}

if ([string]::IsNullOrWhiteSpace($secret)) { throw 'No secret entered; nothing was changed.' }
if ($secret -notlike 'GOCSPX-*') {
  Write-Warning 'That does not look like a Google client secret (they start with GOCSPX-). Continuing anyway.'
}

$payload = @{
  connection_oauth_google = @{
    enabled         = $true
    authenticatable = $true
    client_id       = $clientId
    client_secret   = $secret
  }
} | ConvertTo-Json -Compress -Depth 5

try {
  clerk config patch --app $app --instance $ins --json $payload --yes | Out-Null
} finally {
  # Drop every copy before anything else can run.
  $payload = $null
  $secret = $null
  [GC]::Collect()
}

Write-Host ''
Write-Host 'Patched. Verifying (no secret is printed):'
$cfg = clerk config pull --app $app --instance $ins --mode agent | ConvertFrom-Json
$google = $cfg.connection_oauth_google
Write-Host ("  google enabled   : {0}" -f $google.enabled)
Write-Host ("  authenticatable  : {0}" -f $google.authenticatable)
Write-Host ("  client id set    : {0}" -f (-not [string]::IsNullOrEmpty($google.client_id)))
Write-Host ''
Write-Host 'If enabled is True, the Google button appears on sign-in with no redeploy.'
