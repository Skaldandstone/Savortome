# Deploy the web app to AWS (account 051722405355, us-east-2).
#
# !! NOT RUNNABLE YET (checked 2026-09-07). The 2026-09-07 AWS consolidation
# retired account 574921529762 and the `secondbreakfast-toolkit` profile. The
# credentials below are repointed at the surviving account, but Second
# Breakfast's build pipeline was NOT recreated there: the source bucket,
# CodeBuild project, ECS cluster and service named below do not exist (only an
# empty `secondbreakfast-web` ECR repo does). The preflight check will stop the
# script until that infrastructure is provisioned; the resource names are the
# intended convention, not verified live resources.
#
# Run from anywhere; operates on this repo's committed main branch - not your
# working tree. Requires an active `aws login --profile skaldandstone-admin`
# session.
#
# Flow: zip main -> S3 source bucket -> CodeBuild builds the Docker image
# (Dockerfile.web) -> force a new ECS deployment -> wait until stable.
# Database migrations do NOT run here; run the one-off `secondbreakfast-migrate`
# task after merging a schema change (see ECS task definitions).

$ErrorActionPreference = "Stop"
$repo = Split-Path $PSScriptRoot -Parent
$profile_ = "skaldandstone-admin"
$region = "us-east-2"
$accountId = "051722405355"
$bucket = "secondbreakfast-build-source-051722405355"
$project = "secondbreakfast-web-build"
$cluster = "skaldandstone-production"
$service = "secondbreakfast-web"

$callerAccount = aws sts get-caller-identity --profile $profile_ --query Account --output text
if ($LASTEXITCODE -ne 0) {
    throw "AWS session expired - run: aws login --region $region --profile $profile_"
}
if ($callerAccount -ne $accountId) {
    throw "Profile $profile_ resolves to $callerAccount, expected $accountId. Nothing changed."
}

# Preflight: the consolidation did not recreate this pipeline. Fail clearly
# rather than part-way through a deploy.
#
# Native stderr is swallowed deliberately: under $ErrorActionPreference = "Stop"
# a failing exe would otherwise surface as an empty NativeCommandError instead of
# the message below.
function Probe([string[]]$CliArgs) {
    $prior = $ErrorActionPreference
    try {
        $ErrorActionPreference = "Continue"
        $out = & aws @CliArgs --profile $profile_ --region $region --output text 2>&1
        return [pscustomobject]@{ Code = $LASTEXITCODE; Out = ($out -join " ").Trim() }
    } finally { $ErrorActionPreference = $prior }
}

if ((Probe @("s3api", "head-bucket", "--bucket", $bucket)).Code -ne 0) {
    throw "Source bucket '$bucket' not found in $accountId. Second Breakfast build infrastructure has not been provisioned in the consolidated account yet - provision it before deploying."
}
$cb = Probe @("codebuild", "batch-get-projects", "--names", $project, "--query", "projectsNotFound")
if ($cb.Code -ne 0 -or ($cb.Out -and $cb.Out -ne "None")) {
    throw "CodeBuild project '$project' not found in $accountId. Provision Second Breakfast build infrastructure first."
}
$svc = Probe @("ecs", "describe-services", "--cluster", $cluster, "--services", $service, "--query", "services[0].status")
if ($svc.Code -ne 0 -or $svc.Out -ne "ACTIVE") {
    throw "ECS service '$service' on cluster '$cluster' is not ACTIVE in $accountId. Provision Second Breakfast runtime infrastructure first."
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
