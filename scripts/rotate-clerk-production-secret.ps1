# Rotates the Savortome Clerk PRODUCTION secret key and stores both production
# keys in AWS Secrets Manager. Nothing secret is printed.
#
# The rotate endpoint answers with the application, not a bare key: the new
# secret sits at instances[] -> secret_key for the instance that was rotated,
# and the publishable key is not in that response at all, so it is read
# separately from the application record.
#
# Run from any PowerShell with the clerk CLI logged in and the AWS admin
# profile active.
$ErrorActionPreference = 'Stop'
$app = 'app_3IOlw60gO26QYyAhTKUL84jVUZZ'
$ins = 'ins_3JA04CTgisnnvlq1nMpUQpLOvnm'
$secretName = 'dev/secondbreakfast/clerk-production'
$region = 'us-east-2'

$rotated = clerk api --platform "v1/platform/applications/$app/instances/$ins/rotate_secret_keys" -X POST -d '{}' --yes | ConvertFrom-Json
$sk = ($rotated.instances | Where-Object { $_.instance_id -eq $ins }).secret_key
if (-not $sk) { throw "rotate returned no secret_key for $ins (instances: $($rotated.instances.instance_id -join ','))" }

$appInfo = clerk api --platform "v1/platform/applications/$app" | ConvertFrom-Json
$pk = ($appInfo.instances | Where-Object { $_.instance_id -eq $ins }).publishable_key
if ($sk -notlike 'sk_live_*') { throw 'rotated secret is not a live key' }
if ($pk -notlike 'pk_live_*') { throw 'publishable key is not a live key' }

$payload = @{ CLERK_SECRET_KEY = $sk; CLERK_PUBLISHABLE_KEY = $pk } | ConvertTo-Json -Compress

$exists = $true
try { aws secretsmanager describe-secret --region $region --secret-id $secretName 2>$null | Out-Null } catch { $exists = $false }
if (-not $?) { $exists = $false }

if ($exists) {
  $out = aws secretsmanager put-secret-value --region $region --secret-id $secretName --secret-string $payload --output json | ConvertFrom-Json
} else {
  $out = aws secretsmanager create-secret --region $region --name $secretName --description 'Savortome Clerk production keys (savortome.skaldandstone.com)' --secret-string $payload --tags Key=Application,Value=savortome --output json | ConvertFrom-Json
}

Write-Host "Secret ARN:  $($out.ARN)"
Write-Host "Publishable: $pk"
Write-Host "Secret key:  rotated and stored, not printed."
