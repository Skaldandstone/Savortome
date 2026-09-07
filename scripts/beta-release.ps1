# Uses existing ECS infrastructure only. Inspect/Prepare do not change AWS resources.
[CmdletBinding()]
param(
  [ValidateSet('Inspect','VerifyImages','Prepare','Deploy','Rollback')][string]$Mode='Inspect',
  [string]$Image,
  [string[]]$ClerkUserIds=@(),
  [switch]$DisableBeta,
  [string]$ReviewedCommit,
  [string]$CodeBuildId,
  [string]$BuildArtifactZip,
  [string]$ImageConfigJson,
  [string]$ExpectedConfigDigest,
  [string]$ReviewedSourceSha256,
  [string]$ReviewedManifestSha256,
  [string]$ReviewedBuildspecSha256,
  [string]$RollbackReviewedCommit,
  [string]$RollbackVerificationConfig,
  [string]$ReleaseDirectory=(Join-Path $env:LOCALAPPDATA 'SecondBreakfastBeta\release')
)
$ErrorActionPreference='Stop'
$profile_='skaldandstone-dev'; $region_='us-east-2'; $account_='734702670689'
$cluster_='skaldandstone-development-foundation-cluster'
$service_='skaldandstone-development-foundation-secondbreakfast-web'
$codeBuildProject_='skaldandstone-development-foundation-secondbreakfast-web'
$sourceBucket_='skald-dev-734702670689-artifacts'
$sourcePrefix_='sources/secondbreakfast/'
$repository_='skaldandstone-development-foundation/secondbreakfast-web'
$registry_="${account_}.dkr.ecr.${region_}.amazonaws.com/$repository_"
function AwsJson([string[]]$Arguments) {
  $raw=& aws @Arguments --profile $profile_ --region $region_ --output json --no-cli-pager
  if($LASTEXITCODE -ne 0){throw "AWS command failed: $($Arguments[0..1] -join ' '). No success is assumed."}
  return ($raw | ConvertFrom-Json)
}
function WriteJson($Value,[string]$Path) {
  [IO.File]::WriteAllText($Path,($Value | ConvertTo-Json -Depth 100),[Text.UTF8Encoding]::new($false))
}
function ServiceFingerprint($Value) {
  $fields=[ordered]@{}
  foreach($name in @('taskDefinition','desiredCount','deploymentController','deploymentConfiguration','networkConfiguration','loadBalancers','capacityProviderStrategy','launchType','platformVersion','schedulingStrategy','enableExecuteCommand')) {
    $fields[$name]=$Value.$name
  }
  $sha=[Security.Cryptography.SHA256]::Create()
  try { return ([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes(($fields|ConvertTo-Json -Depth 100 -Compress))))).Replace('-','').ToLowerInvariant() }
  finally { $sha.Dispose() }
}
function AssertStable($Value) {
  if($Value.desiredCount -eq 0){throw 'Service is asleep. Preserve its scale-down schedule and prepare during its normal running window.'}
  if($Value.deployments.Count -ne 1 -or $Value.deployments[0].rolloutState -ne 'COMPLETED' -or $Value.pendingCount -gt 0 -or $Value.runningCount -ne $Value.desiredCount){throw 'An existing deployment is not stable.'}
}
function PacketHash([string]$Name) { return (Get-FileHash -LiteralPath (Join-Path $ReleaseDirectory $Name) -Algorithm SHA256).Hash }
function VerifyCodeBuildReport([string]$Reference,[string]$Commit,$Remote) {
  $CodeBuildId=$Remote.codeBuildId; $BuildArtifactZip=$Remote.buildArtifactZip
  $ReviewedSourceSha256=$Remote.reviewedSourceSha256; $ReviewedBuildspecSha256=$Remote.reviewedBuildspecSha256
  $ReviewedManifestSha256=$Remote.reviewedManifestSha256
  $escapedProject=[regex]::Escape($codeBuildProject_)
  if($CodeBuildId -cnotmatch "^${escapedProject}:[a-f0-9-]{36}$"){throw 'Supply an existing trusted CodeBuild ID.'}
  if($ReviewedBuildspecSha256 -cnotmatch '^[a-f0-9]{64}$'){throw 'Supply the SHA256 of the reviewed inline buildspec.'}
  $response=AwsJson -Arguments @('codebuild','batch-get-builds','--ids',$CodeBuildId)
  if($response.builds.Count -ne 1 -or $response.buildsNotFound.Count -gt 0){throw 'Expected CodeBuild build is unavailable.'}
  $build=$response.builds[0]
  if($build.id -cne $CodeBuildId -or $build.projectName -cne $codeBuildProject_ -or $build.arn -cne "arn:aws:codebuild:${region_}:${account_}:build/$CodeBuildId" -or $build.buildStatus -cne 'SUCCEEDED'){throw 'CodeBuild identity or successful status could not be verified.'}
  $sha=[Security.Cryptography.SHA256]::Create()
  try{$specHash=([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes([string]$build.source.buildspec)))).Replace('-','').ToLowerInvariant()}finally{$sha.Dispose()}
  if($specHash -cne $ReviewedBuildspecSha256){throw 'CodeBuild buildspec differs from the reviewed inline commands.'}
  if($build.source.type -ceq 'S3'){
    if($ReviewedSourceSha256 -cnotmatch '^[a-f0-9]{64}$' -or -not $build.sourceVersion -or $build.sourceVersion -ceq 'null'){throw 'S3 source requires a pinned object version and reviewed source archive SHA256.'}
    $locationPrefix="$sourceBucket_/$sourcePrefix_"
    if(-not ([string]$build.source.location).StartsWith($locationPrefix,[StringComparison]::Ordinal)){throw 'Unexpected source bucket or application prefix.'}
    $key=([string]$build.source.location).Substring($sourceBucket_.Length+1)
    if(-not $key.EndsWith('.zip',[StringComparison]::OrdinalIgnoreCase)){throw 'Reviewed S3 source must be a ZIP archive.'}
    $head=AwsJson -Arguments @('s3api','head-object','--bucket',$sourceBucket_,'--key',$key,'--version-id',$build.sourceVersion,'--checksum-mode','ENABLED','--expected-bucket-owner',$account_)
    $sourceHash=if($head.ChecksumSHA256){([BitConverter]::ToString([Convert]::FromBase64String($head.ChecksumSHA256))).Replace('-','').ToLowerInvariant()}else{''}
    if($head.VersionId -cne $build.sourceVersion -or $sourceHash -cne $ReviewedSourceSha256){throw 'S3 source version/checksum differs from the reviewed commit archive.'}
  } elseif($build.source.type -cin @('GITHUB','CODECOMMIT','BITBUCKET','GITHUB_ENTERPRISE','GITLAB','GITLAB_SELF_MANAGED')) {
    if($build.resolvedSourceVersion -cne $Commit){throw 'CodeBuild resolved source is not the reviewed commit.'}
  } else {throw 'Unsupported source provenance. Use a pinned Git source or versioned S3 archive.'}
  if($BuildArtifactZip){
  if((Get-Item -LiteralPath $BuildArtifactZip).Length -gt 1048576){throw 'Report artifact exceeds the 1MB limit.'}
  $artifactHash=(Get-FileHash -LiteralPath $BuildArtifactZip -Algorithm SHA256).Hash.ToLowerInvariant()
  if($build.artifacts.sha256sum -cnotmatch '^[a-f0-9]{64}$' -or $artifactHash -cne $build.artifacts.sha256sum){throw 'Artifact ZIP does not match the CodeBuild-reported SHA256.'}
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $zip=[IO.Compression.ZipFile]::OpenRead((Resolve-Path -LiteralPath $BuildArtifactZip))
  try{
    if($zip.Entries.Count -ne 1 -or $zip.Entries[0].FullName -cne 'beta-image-report.json' -or $zip.Entries[0].Length -gt 65536){throw 'Artifact must contain only the bounded beta-image-report.json.'}
    $reader=[IO.StreamReader]::new($zip.Entries[0].Open())
    try{$report=$reader.ReadToEnd()|ConvertFrom-Json}finally{$reader.Dispose()}
  }finally{$zip.Dispose()}
  if($report.schemaVersion -ne 1 -or $report.codeBuildId -cne $CodeBuildId -or $report.sourceVersion -cne $build.sourceVersion -or $report.image -cne $Reference -or $report.ociRevision -cne $Commit){throw 'Report identity, image digest, source version or OCI revision does not match.'}
  if($report.serviceWorkerBuilt -cne $true -or $report.publicCacheVersion -ne 3 -or $report.clerkPublishableKeySha256 -cnotmatch '^[a-f0-9]{64}$'){throw 'Report does not prove the SW/Clerk build configuration and privacy cache policy.'}
  return [ordered]@{method='codebuild-artifact';image=$Reference;ociRevision=$Commit;serviceWorkerBuilt=$true;publicCacheVersion=3;clerkPublishableKeySha256=$report.clerkPublishableKeySha256;codeBuildId=$CodeBuildId;artifactSha256=$artifactHash;sourceVersion=$build.sourceVersion;reviewedSourceSha256=$ReviewedSourceSha256;buildspecSha256=$specHash}
  }
  $projectResponse=AwsJson -Arguments @('codebuild','batch-get-projects','--names',$codeBuildProject_)
  if($projectResponse.projects.Count -ne 1 -or $projectResponse.projectsNotFound.Count -gt 0 -or $projectResponse.projects[0].name -cne $codeBuildProject_ -or $projectResponse.projects[0].artifacts.type -cne 'NO_ARTIFACTS'){throw 'Artifact-free verification requires the reviewed NO_ARTIFACTS CodeBuild project.'}
  $ImageConfigJson=[string]$Remote.imageConfigJson
  $ExpectedConfigDigest=[string]$Remote.expectedConfigDigest
  if(-not $ImageConfigJson -or -not(Test-Path -LiteralPath $ImageConfigJson)){throw 'Supply the downloaded ECR image config JSON for artifact-free verification.'}
  if($ExpectedConfigDigest -cnotmatch '^sha256:[a-f0-9]{64}$'){throw 'Supply the expected ECR config digest.'}
  if($ReviewedManifestSha256 -cnotmatch '^[a-f0-9]{64}$'){throw 'Supply the reviewed embedded source manifest SHA256.'}
  if($Reference -cnotmatch ('^'+[regex]::Escape($registry_)+'@(sha256:[a-f0-9]{64})$')){throw 'Image must use the selected repository and an immutable digest.'}
  $imageDigest=$Matches[1]
  $manifestResponse=AwsJson -Arguments @('ecr','batch-get-image','--repository-name',$repository_,'--image-ids',"imageDigest=$imageDigest",'--accepted-media-types','application/vnd.docker.distribution.manifest.v2+json')
  if($manifestResponse.failures.Count -gt 0 -or $manifestResponse.images.Count -ne 1 -or $manifestResponse.images[0].imageId.imageDigest -cne $imageDigest){throw 'ECR did not return the exact reviewed image digest.'}
  $manifest=$manifestResponse.images[0].imageManifest|ConvertFrom-Json
  if($manifest.schemaVersion -ne 2 -or $manifest.config.digest -cne $ExpectedConfigDigest){throw 'ECR manifest config digest differs from reviewed evidence.'}
  if((Get-Item -LiteralPath $ImageConfigJson).Length -gt 131072){throw 'ECR image config exceeds the bounded size.'}
  $configHash='sha256:'+((Get-FileHash -LiteralPath $ImageConfigJson -Algorithm SHA256).Hash.ToLowerInvariant())
  if($configHash -cne $manifest.config.digest){throw 'Downloaded ECR image config does not match the manifest digest.'}
  $config=Get-Content -LiteralPath $ImageConfigJson -Raw|ConvertFrom-Json
  if($config.os -cne 'linux' -or $config.architecture -cne 'amd64' -or [string]$config.config.User -cne '65532'){throw 'Image platform or nonroot runtime identity differs from the reviewed boundary.'}
  if(@($config.config.Entrypoint).Count -ne 1 -or $config.config.Entrypoint[0] -cne '/nodejs/bin/node'){throw 'Image does not use the reviewed direct distroless Node entrypoint.'}
  if($config.config.Labels.'org.opencontainers.image.revision' -cne $Commit -or $config.config.Labels.'com.secondbreakfast.public-cache-version' -cne '3' -or $config.config.Labels.'com.skaldandstone.source-sha256' -cne $ReviewedManifestSha256){throw 'Image labels do not prove the reviewed source and privacy policy.'}
  if('NEXT_PUBLIC_ENABLE_SW=true' -cnotin $config.config.Env){throw 'Reviewed beta image does not enable the tested service worker at build time.'}
  $clerk=@($config.config.Env|Where-Object {$_ -cmatch '^NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_(test|live)_.+'})
  if($clerk.Count -ne 1){throw 'Reviewed image lacks its build-time Clerk publishable key.'}
  if(@($config.config.Env|Where-Object {$_ -cmatch '^(FFMPEG_PATH|YT_DLP_PATH)='}).Count -gt 0){throw 'Unexpected media-helper runtime path is present.'}
  $scan=AwsJson -Arguments @('ecr','describe-image-scan-findings','--repository-name',$repository_,'--image-id',"imageDigest=$imageDigest")
  $severityTotal=0
  if($scan.imageScanFindings.findingSeverityCounts){foreach($property in $scan.imageScanFindings.findingSeverityCounts.PSObject.Properties){$severityTotal += [int]$property.Value}}
  if($scan.imageScanStatus.status -cne 'COMPLETE' -or $severityTotal -ne 0){throw 'ECR BASIC scan is incomplete or has findings.'}
  $clerkHash=[BitConverter]::ToString([Security.Cryptography.SHA256]::Create().ComputeHash([Text.Encoding]::UTF8.GetBytes($clerk[0]))).Replace('-','').ToLowerInvariant()
  return [ordered]@{method='codebuild-ecr-config';image=$Reference;ociRevision=$Commit;serviceWorkerBuilt=$true;publicCacheVersion=3;clerkPublishableKeySha256=$clerkHash;codeBuildId=$CodeBuildId;configDigest=$configHash;sourceVersion=$build.sourceVersion;reviewedSourceSha256=$ReviewedSourceSha256;reviewedManifestSha256=$ReviewedManifestSha256;buildspecSha256=$specHash;basicScan='COMPLETE_ZERO_FINDINGS'}
}
function VerifyBuiltImage([string]$Reference,[string]$Commit,$Remote) {
  if($Remote.codeBuildId -or $Remote.buildArtifactZip){return (VerifyCodeBuildReport $Reference $Commit $Remote)}
  # The image must already exist locally by digest. Pull/build is a separate,
  # reviewed operation; this script never pulls an unreviewed image or tag.
  $raw=& docker image inspect $Reference
  if($LASTEXITCODE -ne 0){throw 'Cannot inspect the reviewed local image by digest. Pull that digest and verify the build first.'}
  $images=@($raw|ConvertFrom-Json)
  if($images.Count -ne 1 -or $Reference -cnotin $images[0].RepoDigests){throw 'Local image does not prove the requested immutable repository digest.'}
  $actual=$images[0].Config.Labels.'org.opencontainers.image.revision'
  if($actual -cne $Commit){throw 'OCI image revision does not match the reviewed commit.'}
  if($images[0].Config.Labels.'com.secondbreakfast.public-cache-version' -cne '3'){throw 'Image does not prove the reviewed privacy cache policy.'}
  if('NEXT_PUBLIC_ENABLE_SW=true' -cnotin $images[0].Config.Env){throw 'Reviewed beta image does not enable the tested service worker at build time.'}
  if(@($images[0].Config.Env|Where-Object {$_ -cmatch '^NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_(test|live)_.+'}).Count -ne 1){throw 'Reviewed image lacks its build-time Clerk publishable key.'}
  return [ordered]@{method='local-docker-inspect';image=$Reference;ociRevision=$actual;serviceWorkerBuilt=$true;publicCacheVersion=3}
}
function Registration($Task) {
  # These are the input fields from the installed AWS CLI registration schema.
  $allowed=@('family','taskRoleArn','executionRoleArn','networkMode','containerDefinitions','volumes','placementConstraints','requiresCompatibilities','cpu','memory','tags','pidMode','ipcMode','proxyConfiguration','inferenceAccelerators','ephemeralStorage','runtimePlatform','enableFaultInjection')
  $out=[ordered]@{}
  foreach($name in $allowed){if($Task.PSObject.Properties.Name -contains $name){$out[$name]=$Task.$name}}
  return [pscustomobject]$out
}
$identity=AwsJson -Arguments @('sts','get-caller-identity')
if($identity.Account -ne $account_){throw 'Wrong AWS account. Refusing release.'}
if($Mode -eq 'VerifyImages') {
  if($Image -cnotmatch ('^'+[regex]::Escape($registry_)+'@sha256:[a-f0-9]{64}$') -or $ReviewedCommit -cnotmatch '^[a-f0-9]{40}$'){throw 'Supply the immutable candidate image and reviewed commit.'}
  if(-not $RollbackVerificationConfig -or -not(Test-Path -LiteralPath $RollbackVerificationConfig) -or $RollbackReviewedCommit -cnotmatch '^[a-f0-9]{40}$'){throw 'Supply the rollback verification config and reviewed commit.'}
  $candidateRemote=@{codeBuildId=$CodeBuildId;buildArtifactZip=$BuildArtifactZip;imageConfigJson=$ImageConfigJson;expectedConfigDigest=$ExpectedConfigDigest;reviewedSourceSha256=$ReviewedSourceSha256;reviewedManifestSha256=$ReviewedManifestSha256;reviewedBuildspecSha256=$ReviewedBuildspecSha256}
  $rollbackRemote=Get-Content -LiteralPath $RollbackVerificationConfig -Raw|ConvertFrom-Json
  if(([string]$rollbackRemote.image) -cnotmatch ('^'+[regex]::Escape($registry_)+'@sha256:[a-f0-9]{64}$')){throw 'Rollback verification config must name an immutable image in the selected repository.'}
  $candidateEvidence=VerifyBuiltImage $Image $ReviewedCommit $candidateRemote
  $rollbackEvidence=VerifyBuiltImage ([string]$rollbackRemote.image) $RollbackReviewedCommit $rollbackRemote
  [pscustomobject]@{Account=$identity.Account;Candidate=$candidateEvidence;Rollback=$rollbackEvidence}|ConvertTo-Json -Depth 20
  return
}
$response=AwsJson -Arguments @('ecs','describe-services','--cluster',$cluster_,'--services',$service_)
if($response.failures.Count -gt 0 -or $response.services.Count -ne 1){throw 'Expected service is unavailable.'}
$service=$response.services[0]
if($service.deploymentController.type -ne 'ECS'){throw 'Only the existing ECS rolling deployment is supported.'}
$description=AwsJson -Arguments @('ecs','describe-task-definition','--task-definition',$service.taskDefinition,'--include','TAGS')
$task=$description.taskDefinition
$task|Add-Member -NotePropertyName tags -NotePropertyValue @($description.tags) -Force
if($Mode -eq 'Inspect') {
  [pscustomobject]@{Account=$identity.Account;TaskDefinition=$service.taskDefinition;DesiredCount=$service.desiredCount;RunningCount=$service.runningCount;DeploymentConfiguration=$service.deploymentConfiguration;Images=@($task.containerDefinitions|ForEach-Object{$_.image})}|ConvertTo-Json -Depth 10
  return
}
New-Item -ItemType Directory -Force -Path $ReleaseDirectory | Out-Null
$recordPath=Join-Path $ReleaseDirectory 'release.json'
$lockPath=Join-Path $ReleaseDirectory 'release.lock'
# FileShare.None prevents concurrent operators from racing task registration.
$packetLock=[IO.File]::Open($lockPath,[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
try {
if($Mode -eq 'Prepare') {
  if($DisableBeta -and $Image){throw 'Kill switch cannot replace the current image. Omit Image.'}
  if(Test-Path -LiteralPath $recordPath){throw 'Use a fresh release directory so the previous rollback record is preserved.'}
  AssertStable $service
  if(-not $DisableBeta -and ($ClerkUserIds.Count -eq 0 -or @($ClerkUserIds | Where-Object {$_ -cnotmatch '^user_[A-Za-z0-9]+$'}).Count -gt 0)){throw 'Supply exact Clerk user IDs for the reviewed cohort.'}
  if(-not $DisableBeta -and ($ReviewedCommit -cnotmatch '^[a-f0-9]{40}$')){throw 'A full reviewed commit is required.'}
  if($Image -and $Image -cnotmatch ('^'+[regex]::Escape($registry_)+'@sha256:[a-f0-9]{64}$')){throw 'Image must use a digest in the selected AWS account, region, and repository.'}
  if(-not $DisableBeta -and -not $Image){throw 'A reviewed immutable image is required.'}
  $remote=@{codeBuildId=$CodeBuildId;buildArtifactZip=$BuildArtifactZip;imageConfigJson=$ImageConfigJson;expectedConfigDigest=$ExpectedConfigDigest;reviewedSourceSha256=$ReviewedSourceSha256;reviewedManifestSha256=$ReviewedManifestSha256;reviewedBuildspecSha256=$ReviewedBuildspecSha256}
  $buildEvidence=if(-not $DisableBeta){VerifyBuiltImage $Image $ReviewedCommit $remote}else{$null}
  $taskArns=(AwsJson -Arguments @('ecs','list-tasks','--cluster',$cluster_,'--service-name',$service_)).taskArns
  if($taskArns.Count -eq 0){throw 'No running task from which to verify the rollback image.'}
  $taskResponse=AwsJson -Arguments (@('ecs','describe-tasks','--cluster',$cluster_,'--tasks')+@($taskArns))
  if($taskResponse.failures.Count -gt 0){throw 'Cannot read every running task for rollback verification.'}
  $running=$taskResponse.tasks
  if(@($running|Where-Object {$_.taskDefinitionArn -ne $service.taskDefinition -or $_.lastStatus -ne 'RUNNING'}).Count -gt 0){throw 'Running tasks do not all match the stable deployed revision.'}
  $rollback=Registration $task
  foreach($container in $rollback.containerDefinitions){
    $digests=@($running | Where-Object {$_.taskDefinitionArn -eq $service.taskDefinition} | ForEach-Object {$_.containers} | Where-Object {$_.name -eq $container.name} | ForEach-Object {$_.imageDigest} | Sort-Object -Unique)
    if($digests.Count -ne 1 -or $digests[0] -notmatch '^sha256:[a-f0-9]{64}$'){throw "Cannot verify one rollback digest for $($container.name)."}
    $repository=($container.image -split '@')[0] -replace ':[^/]+$',''
    $container.image="$repository@$($digests[0])"
  }
  $candidate=$rollback|ConvertTo-Json -Depth 100|ConvertFrom-Json
  $web=@($candidate.containerDefinitions | Where-Object {@($_.portMappings | Where-Object {$_.containerPort -eq 3000}).Count -gt 0})
  if($web.Count -ne 1){throw 'Cannot identify exactly one web container on port 3000.'}
  $rollbackBuildEvidence=$null
  if(-not $DisableBeta){
    if($RollbackReviewedCommit -cnotmatch '^[a-f0-9]{40}$'){throw 'A reviewed privacy-hardened rollback commit is required before enabling beta.'}
    $rollbackRemote=if($RollbackVerificationConfig){Get-Content -LiteralPath $RollbackVerificationConfig -Raw|ConvertFrom-Json}else{$null}
    $rollbackBuildEvidence=VerifyBuiltImage $web[0].image $RollbackReviewedCommit $rollbackRemote
  }
  if($Image){$web[0].image=$Image}
  $names=@($web[0].environment.name)+@($web[0].secrets.name)
  if(@($web[0].secrets | Where-Object {$_.name -in @('SB_BETA_ENABLED','SB_BETA_CLERK_USER_IDS','SB_BETA_LOCAL_PREVIEW')}).Count -gt 0){throw 'Beta flags also exist in secrets. Resolve duplicate definitions before release.'}
  if(-not $DisableBeta -and ('CLERK_SECRET_KEY' -notin $names -or 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY' -notin $names)){throw 'Clerk configuration is missing. Also verify the publishable key in the image build.'}
  $environment=@($web[0].environment | Where-Object {$_.name -notin @('SB_BETA_ENABLED','SB_BETA_CLERK_USER_IDS','SB_BETA_LOCAL_PREVIEW','SB_RELEASE_COMMIT')})
  $environment+=@{name='SB_BETA_ENABLED';value= $(if($DisableBeta){'false'}else{'true'})}
  $environment+=@{name='SB_BETA_CLERK_USER_IDS';value= $(if($DisableBeta){''}else{($ClerkUserIds | Sort-Object -Unique) -join ','})}
  $environment+=@{name='SB_BETA_LOCAL_PREVIEW';value='false'}
  if($ReviewedCommit){$environment+=@{name='SB_RELEASE_COMMIT';value=$ReviewedCommit}}
  $web[0] | Add-Member -NotePropertyName environment -NotePropertyValue $environment -Force
  WriteJson $candidate (Join-Path $ReleaseDirectory 'candidate-task.json')
  WriteJson $rollback (Join-Path $ReleaseDirectory 'rollback-task.json')
  WriteJson ([ordered]@{preparedAt=[DateTime]::UtcNow.ToString('o');previousTaskArn=$service.taskDefinition;reviewedCommit=$ReviewedCommit;buildEvidence=$buildEvidence;rollbackBuildEvidence=$rollbackBuildEvidence;rollbackArn=$null;candidateArn=$null;desiredCount=$service.desiredCount;serviceFingerprint=(ServiceFingerprint $service);candidateHash=(PacketHash 'candidate-task.json');rollbackHash=(PacketHash 'rollback-task.json')}) $recordPath
  Write-Host "Prepared local candidate and pinned rollback in $ReleaseDirectory. No AWS resources changed."
  return
}
if(-not(Test-Path -LiteralPath $recordPath)){throw 'Prepare a release first.'}
$record=Get-Content -LiteralPath $recordPath -Raw|ConvertFrom-Json
if((PacketHash 'candidate-task.json') -ne $record.candidateHash -or (PacketHash 'rollback-task.json') -ne $record.rollbackHash){throw 'Release packet changed after preparation. Prepare and review a new packet.'}
if($Mode -eq 'Deploy') {
  if($service.taskDefinition -ne $record.previousTaskArn){throw 'Service changed since preparation. Prepare and review a new candidate.'}
  if($record.candidateArn){throw 'Candidate was already registered. Inspect deployment status before retrying.'}
  AssertStable $service
  if((ServiceFingerprint $service) -ne $record.serviceFingerprint){throw 'Service configuration changed since preparation. Prepare and review again.'}
  if(-not $record.rollbackArn){$record.rollbackArn=(AwsJson -Arguments @('ecs','register-task-definition','--cli-input-json',('file://'+(Join-Path $ReleaseDirectory 'rollback-task.json')))).taskDefinition.taskDefinitionArn}
  WriteJson $record $recordPath
  $record.candidateArn=(AwsJson -Arguments @('ecs','register-task-definition','--cli-input-json',('file://'+(Join-Path $ReleaseDirectory 'candidate-task.json')))).taskDefinition.taskDefinitionArn
  WriteJson $record $recordPath
  $deployment=$service.deploymentConfiguration
  $deployment|Add-Member -NotePropertyName deploymentCircuitBreaker -NotePropertyValue @{enable=$true;rollback=$true} -Force
  WriteJson $deployment (Join-Path $ReleaseDirectory 'deployment-configuration.json')
  AwsJson -Arguments @('ecs','update-service','--cluster',$cluster_,'--service',$service_,'--task-definition',$record.candidateArn,'--deployment-configuration',('file://'+(Join-Path $ReleaseDirectory 'deployment-configuration.json'))) | Out-Null
  Write-Host "Deployment requested: $($record.candidateArn). Desired count, network, roles, and schedule were not changed."
} else {
  if($record.rollbackBuildEvidence.publicCacheVersion -ne 3){throw 'Full rollback lacks reviewed privacy-hardened image evidence. Use a fresh kill-switch packet on the hardened image.'}
  if(-not $record.rollbackArn){throw 'No registered rollback exists in this release record.'}
  if($service.taskDefinition -notin @($record.candidateArn,$record.previousTaskArn,$record.rollbackArn)){throw 'A different release now owns the service. Inspect before rolling back.'}
  AwsJson -Arguments @('ecs','update-service','--cluster',$cluster_,'--service',$service_,'--task-definition',$record.rollbackArn) | Out-Null
  Write-Host "Rollback requested: $($record.rollbackArn)."
}
Write-Host 'Run aws ecs wait services-stable, then verify running task digests and invited/non-invited behavior. A successful update request is not release validation.'
} finally { $packetLock.Dispose() }
