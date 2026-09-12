# Rotates the Savortome Clerk PRODUCTION secret key and stores both production
# keys in a new AWS Secrets Manager secret. Nothing secret is printed.
# Run from any PowerShell with the clerk CLI logged in and AWS admin profile active.
$ErrorActionPreference = 'Stop'
$app = 'app_3IOlw60gO26QYyAhTKUL84jVUZZ'
$ins = 'ins_3JA04CTgisnnvlq1nMpUQpLOvnm'
$secretName = 'dev/secondbreakfast/clerk-production'

$rot = clerk api --platform "v1/platform/applications/$app/instances/$ins/rotate_secret_keys" -X POST -d '{}' --yes | ConvertFrom-Json
$sk = $rot.secret_key
if (-not $sk -and $rot.secret_keys) { $sk = $rot.secret_keys[0].secret }
if (-not $sk) { throw "rotate response had no secret_key (keys: $($rot.PSObject.Properties.Name -join ','))" }

$appInfo = clerk api --platform "v1/platform/applications/$app" | ConvertFrom-Json
$pk = ($appInfo.instances | Where-Object instance_id -eq $ins).publishable_key
if ($sk -notlike 'sk_live_*' -or $pk -notlike 'pk_live_*') { throw 'unexpected key prefixes' }

$payload = @{ CLERK_SECRET_KEY = $sk; CLERK_PUBLISHABLE_KEY = $pk } | ConvertTo-Json -Compress
$existing = aws secretsmanager describe-secret --region us-east-2 --secret-id $secretName 2>$null
if ($existing) {
  $out = aws secretsmanager put-secret-value --region us-east-2 --secret-id $secretName --secret-string $payload --output json | ConvertFrom-Json
} else {
  $out = aws secretsmanager create-secret --region us-east-2 --name $secretName --description 'Savortome Clerk production keys (savortome.skaldandstone.com)' --secret-string $payload --tags Key=Application,Value=savortome --output json | ConvertFrom-Json
}
Write-Host "Secret ARN: $($out.ARN)"
Write-Host "Publishable key (public): $pk"
Write-Host "Secret key: rotated and stored, not printed."
