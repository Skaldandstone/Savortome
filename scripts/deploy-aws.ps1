# Deploy the web app to AWS (account 574921529762).
#
# Run from anywhere; operates on this repo's committed main branch - not your
# working tree. Requires an active `aws login --profile secondbreakfast-toolkit`
# session.
#
# Flow: zip main -> S3 source bucket -> CodeBuild builds the Docker image
# (Dockerfile.web) -> force a new ECS deployment -> wait until stable.
# Database migrations do NOT run here; run the one-off `secondbreakfast-migrate`
# task after merging a schema change (see ECS task definitions).

$ErrorActionPreference = "Stop"
$repo = Split-Path $PSScriptRoot -Parent
$profile_ = "secondbreakfast-toolkit"
$region = "us-east-2"
$bucket = "secondbreakfast-build-source-574921529762"
$project = "secondbreakfast-web-build"
$cluster = "secondbreakfast-cluster"
$service = "secondbreakfast-web"

aws sts get-caller-identity --profile $profile_ | Out-Null
if ($LASTEXITCODE -ne 0) {
    throw "AWS session expired - run: aws login --region $region --profile $profile_"
}

$zip = Join-Path $env:TEMP "secondbreakfast-source.zip"
git -C $repo fetch origin
git -C $repo archive --format=zip -o $zip origin/main
Write-Host "zipped origin/main -> $zip"

aws s3 cp $zip "s3://$bucket/nomnom-source.zip" --profile $profile_ --region $region | Out-Null
$buildId = aws codebuild start-build --project-name $project --profile $profile_ --region $region --query 'build.id' --output text
Write-Host "build started: $buildId"

do {
    Start-Sleep -Seconds 20
    $status = aws codebuild batch-get-builds --ids $buildId --profile $profile_ --region $region --query 'builds[0].buildStatus' --output text
    Write-Host "  build: $status"
} while ($status -eq "IN_PROGRESS")
if ($status -ne "SUCCEEDED") { throw "build finished $status - check CodeBuild logs" }

aws ecs update-service --cluster $cluster --service $service --force-new-deployment --profile $profile_ --region $region --query 'service.serviceName' --output text | Out-Null
Write-Host "rolling ECS service..."
aws ecs wait services-stable --cluster $cluster --services $service --profile $profile_ --region $region
Write-Host "service stable."

$code = curl.exe -s -o $null -w "%{http_code}" https://secondbreakfast.skaldandstone.com/
Write-Host "https://secondbreakfast.skaldandstone.com/ -> $code"
Write-Host "(A 503 'asleep' page outside 8am-1am Pacific is the overnight scale-down, not a failure.)"
