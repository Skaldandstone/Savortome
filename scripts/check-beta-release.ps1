# Executes the real release script against strict in-process AWS/Docker mocks.
# No credentials, network, AWS executable, Docker daemon, or deployment is used.
$ErrorActionPreference='Stop'
$release=Join-Path $PSScriptRoot 'beta-release.ps1'
$testRoot=Join-Path $env:LOCALAPPDATA ('SecondBreakfastBeta\release-tests\'+[guid]::NewGuid().ToString())
New-Item -ItemType Directory -Path $testRoot -Force|Out-Null
$image='734702670689.dkr.ecr.us-east-2.amazonaws.com/skaldandstone-development-foundation/secondbreakfast-web@sha256:'+('a'*64)
$commit='d'*40
$oldImage='734702670689.dkr.ecr.us-east-2.amazonaws.com/skaldandstone-development-foundation/secondbreakfast-web@sha256:'+('b'*64)
$buildId='skaldandstone-development-foundation-secondbreakfast-web:00000000-0000-0000-0000-000000000000'
$spec='version: 0.2 # synthetic reviewed commands'
$specSha=[BitConverter]::ToString([Security.Cryptography.SHA256]::Create().ComputeHash([Text.Encoding]::UTF8.GetBytes($spec))).Replace('-','').ToLowerInvariant()
$manifestSha='c'*64
$oldArn='arn:aws:ecs:us-east-2:734702670689:task-definition/secondbreakfast-web:10'
$assertions=0
function Check([bool]$Condition,[string]$Message){if(-not $Condition){throw "FAIL $Message"};$script:assertions++;Write-Output "PASS $Message"}
function Throws([scriptblock]$Action,[string]$Pattern,[string]$Message){
  $caught=$null;try{& $Action}catch{$caught=$_.Exception.Message}
  Check ($null -ne $caught -and $caught -match $Pattern) "$Message$(if($caught -and $caught -notmatch $Pattern){': '+$caught})"
}
function Reset {
  $global:BetaReleaseMock=@{
    account='734702670689';calls=[Collections.Generic.List[object]]::new();counter=10;failUpdate=$false;dockerCalls=0;
    service=[pscustomobject]@{taskDefinition=$oldArn;desiredCount=1;runningCount=1;pendingCount=0;deploymentController=@{type='ECS'};deployments=@(@{rolloutState='COMPLETED'});deploymentConfiguration=@{maximumPercent=200;minimumHealthyPercent=100;deploymentCircuitBreaker=@{enable=$false;rollback=$false}};networkConfiguration=@{awsvpcConfiguration=@{subnets=@('subnet-existing');securityGroups=@('sg-existing');assignPublicIp='DISABLED'}};loadBalancers=@(@{targetGroupArn='existing-target';containerName='web';containerPort=3000});launchType='FARGATE';platformVersion='1.4.0';schedulingStrategy='REPLICA';enableExecuteCommand=$false};
    task=[pscustomobject]@{family='secondbreakfast-web';taskRoleArn='existing-task-role';executionRoleArn='existing-execution-role';networkMode='awsvpc';requiresCompatibilities=@('FARGATE');cpu='512';memory='1024';runtimePlatform=@{cpuArchitecture='X86_64';operatingSystemFamily='LINUX'};volumes=@();taskDefinitionArn=$oldArn;status='ACTIVE';revision=10;registeredAt='synthetic';containerDefinitions=@([pscustomobject]@{name='web';image='734702670689.dkr.ecr.us-east-2.amazonaws.com/skaldandstone-development-foundation/secondbreakfast-web:latest';portMappings=@(@{containerPort=3000});environment=@(@{name='NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY';value='pk_test_synthetic'},@{name='NODE_EXTRA_CA_CERTS';value='/etc/ssl/rds-global-bundle.pem'},@{name='KEEP_EXISTING';value='unchanged'});secrets=@(@{name='CLERK_SECRET_KEY';valueFrom='arn:existing-clerk-secret'},@{name='DATABASE_URL';valueFrom='arn:existing-db-secret'});logConfiguration=@{logDriver='awslogs';options=@{'awslogs-group'='existing-log-group'}}})};
    tags=@(@{key='Product';value='SecondBreakfast'});
    running=@([pscustomobject]@{taskDefinitionArn=$oldArn;lastStatus='RUNNING';containers=@(@{name='web';imageDigest='sha256:'+('b'*64)})});
    docker=[pscustomobject]@{RepoDigests=@($image);Config=@{Labels=@{'org.opencontainers.image.revision'=$commit;'com.secondbreakfast.public-cache-version'='3'};Env=@('NEXT_PUBLIC_ENABLE_SW=true','NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_synthetic')}};
    rollbackDocker=[pscustomobject]@{RepoDigests=@($oldImage);Config=@{Labels=@{'org.opencontainers.image.revision'=$commit;'com.secondbreakfast.public-cache-version'='3'};Env=@('NEXT_PUBLIC_ENABLE_SW=true','NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_synthetic')}};
    build=[pscustomobject]@{id=$buildId;arn="arn:aws:codebuild:us-east-2:734702670689:build/$buildId";projectName='skaldandstone-development-foundation-secondbreakfast-web';buildStatus='SUCCEEDED';sourceVersion=$commit;resolvedSourceVersion=$commit;source=@{type='GITHUB';buildspec=$spec};artifacts=@{sha256sum=''}};
    head=@{VersionId='pinned-object-version';ChecksumSHA256=[Convert]::ToBase64String([byte[]](1..32))}
  }
}
function global:aws {
  param([Parameter(ValueFromRemainingArguments=$true)][object[]]$Arguments)
  $s=$global:BetaReleaseMock;[void]$s.calls.Add(@($Arguments));$global:LASTEXITCODE=0
  switch("$($Arguments[0]) $($Arguments[1])") {
    'sts get-caller-identity' { @{Account=$s.account}|ConvertTo-Json }
    'ecs describe-services' { @{services=@($s.service);failures=@()}|ConvertTo-Json -Depth 100 }
    'ecs describe-task-definition' { @{taskDefinition=$s.task;tags=$s.tags}|ConvertTo-Json -Depth 100 }
    'ecs list-tasks' { @{taskArns=@('arn:synthetic-running-task')}|ConvertTo-Json }
    'ecs describe-tasks' { @{tasks=$s.running;failures=@()}|ConvertTo-Json -Depth 100 }
    'codebuild batch-get-builds' {
      $index=[array]::IndexOf($Arguments,'--ids');$id=$Arguments[$index+1]
      $build=if($s.buildRecords -and $s.buildRecords.ContainsKey($id)){$s.buildRecords[$id]}else{$s.build}
      @{builds=@($build);buildsNotFound=@()}|ConvertTo-Json -Depth 100
    }
    'codebuild batch-get-projects' { @{projects=@(@{name='skaldandstone-development-foundation-secondbreakfast-web';artifacts=@{type='NO_ARTIFACTS'}});projectsNotFound=@()}|ConvertTo-Json -Depth 20 }
    's3api head-object' { $s.head|ConvertTo-Json }
    'ecr batch-get-image' { $s.manifest|ConvertTo-Json -Depth 100 }
    'ecr describe-image-scan-findings' { $s.scan|ConvertTo-Json -Depth 100 }
    'ecs register-task-definition' {
      $s.counter++;@{taskDefinition=@{taskDefinitionArn="arn:aws:ecs:us-east-2:734702670689:task-definition/secondbreakfast-web:$($s.counter)"}}|ConvertTo-Json
    }
    'ecs update-service' {
      if($s.failUpdate){$global:LASTEXITCODE=1;return}
      $i=[array]::IndexOf($Arguments,'--task-definition');$s.service.taskDefinition=$Arguments[$i+1]
      @{service=@{serviceName='secondbreakfast-web'}}|ConvertTo-Json
    }
    default {throw "Unexpected AWS operation in mock: $($Arguments -join ' ')"}
  }
}
function global:docker {
  param([Parameter(ValueFromRemainingArguments=$true)][object[]]$Arguments)
  if($Arguments.Count -ne 3 -or $Arguments[0] -ne 'image' -or $Arguments[1] -ne 'inspect'){throw 'Only read-only image inspect is permitted in this mock.'}
  $global:BetaReleaseMock.dockerCalls++;$global:LASTEXITCODE=0
  $selected=if($Arguments[2] -ceq $oldImage){$global:BetaReleaseMock.rollbackDocker}else{$global:BetaReleaseMock.docker}
  ConvertTo-Json -InputObject @($selected) -Depth 100
}
function Prepare([string]$Directory,[string[]]$Ids=@('user_B','user_A','user_A')) {
  & $release -Mode Prepare -Image $image -ReviewedCommit $commit -RollbackReviewedCommit $commit -ClerkUserIds $Ids -ReleaseDirectory $Directory 6>$null
}
function Fresh {Join-Path $testRoot ([guid]::NewGuid().ToString())}
function Mutations {@($global:BetaReleaseMock.calls|Where-Object {$_[1] -in @('register-task-definition','update-service')})}
function ReportZip($Changes=@{}) {
  $report=@{schemaVersion=1;codeBuildId=$buildId;sourceVersion=$global:BetaReleaseMock.build.sourceVersion;image=$image;ociRevision=$commit;serviceWorkerBuilt=$true;publicCacheVersion=3;clerkPublishableKeySha256='e'*64}
  foreach($key in $Changes.Keys){$report[$key]=$Changes[$key]}
  $path=(Fresh)+'.zip';Add-Type -AssemblyName System.IO.Compression;Add-Type -AssemblyName System.IO.Compression.FileSystem
  $zip=[IO.Compression.ZipFile]::Open($path,[IO.Compression.ZipArchiveMode]::Create)
  try{$entry=$zip.CreateEntry('beta-image-report.json');$writer=[IO.StreamWriter]::new($entry.Open());try{$writer.Write(($report|ConvertTo-Json))}finally{$writer.Dispose()}}finally{$zip.Dispose()}
  $global:BetaReleaseMock.build.artifacts.sha256sum=(Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant();return $path
}
function RemotePrepare([string]$Zip,[string]$SourceSha='') {
  & $release -Mode Prepare -Image $image -ReviewedCommit $commit -RollbackReviewedCommit $commit -ClerkUserIds user_A -CodeBuildId $buildId -BuildArtifactZip $Zip -ReviewedBuildspecSha256 $specSha -ReviewedSourceSha256 $SourceSha -ReleaseDirectory (Fresh) 6>$null
}
function EcrConfig([hashtable]$Changes=@{}) {
  $config=@{architecture='amd64';os='linux';config=@{User='65532';Entrypoint=@('/nodejs/bin/node');Cmd=@('server.js');Env=@('NEXT_PUBLIC_ENABLE_SW=true','NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_synthetic');Labels=@{'org.opencontainers.image.revision'=$commit;'com.secondbreakfast.public-cache-version'='3';'com.skaldandstone.source-sha256'=$manifestSha}}}
  foreach($key in $Changes.Keys){$config.config.Labels[$key]=$Changes[$key]}
  $path=(Fresh)+'.json';[IO.File]::WriteAllText($path,($config|ConvertTo-Json -Depth 20 -Compress),[Text.UTF8Encoding]::new($false))
  return $path
}
function ConfigureEcrEvidence([string]$ConfigPath) {
  $configDigest='sha256:'+((Get-FileHash -LiteralPath $ConfigPath -Algorithm SHA256).Hash.ToLowerInvariant())
  $global:BetaReleaseMock.build.source.type='S3'
  $global:BetaReleaseMock.build.source.location='skald-dev-734702670689-artifacts/sources/secondbreakfast/reviewed.zip'
  $global:BetaReleaseMock.build.sourceVersion='pinned-object-version'
  $global:BetaReleaseMock.build.artifacts=@{type='NO_ARTIFACTS'}
  $global:BetaReleaseMock.manifest=@{images=@(@{imageId=@{imageDigest='sha256:'+('a'*64)};imageManifest=(@{schemaVersion=2;config=@{digest=$configDigest}}|ConvertTo-Json -Compress)});failures=@()}
  $global:BetaReleaseMock.scan=@{imageScanStatus=@{status='COMPLETE'};imageScanFindings=@{findingSeverityCounts=@{}}}
  return $configDigest
}
function InvokeEcrPrepare([string]$ConfigPath,[string]$ConfigDigest,[string]$SourceSha) {
  & $release -Mode Prepare -Image $image -ReviewedCommit $commit -RollbackReviewedCommit $commit -ClerkUserIds user_A -CodeBuildId $buildId -ImageConfigJson $ConfigPath -ExpectedConfigDigest $configDigest -ReviewedBuildspecSha256 $specSha -ReviewedSourceSha256 $SourceSha -ReviewedManifestSha256 $manifestSha -ReleaseDirectory (Fresh) 6>$null
}
function EcrPrepare([string]$ConfigPath,[string]$SourceSha) { InvokeEcrPrepare $ConfigPath (ConfigureEcrEvidence $ConfigPath) $SourceSha }

Reset;$global:BetaReleaseMock.account='000000000000'
Throws {Prepare (Fresh)} 'Wrong AWS account' 'wrong AWS identity fails before mutation'
Check ((Mutations).Count -eq 0) 'wrong account made no mutation'
Reset;$verifyConfig=(Fresh)+'.json';@{image=$oldImage}|ConvertTo-Json|Set-Content -LiteralPath $verifyConfig
$verified=& $release -Mode VerifyImages -Image $image -ReviewedCommit $commit -RollbackReviewedCommit $commit -RollbackVerificationConfig $verifyConfig 6>$null|ConvertFrom-Json
Check ($verified.Account -ceq '734702670689' -and $global:BetaReleaseMock.dockerCalls -eq 2 -and @($global:BetaReleaseMock.calls|Where-Object {$_[0] -eq 'ecs'}).Count -eq 0) 'standalone image verification is read-only and does not require an ECS service'
Reset;Throws {& $release -Mode Prepare -Image ($image -replace '@sha256:.*',':latest') -ReviewedCommit $commit -ClerkUserIds user_A -ReleaseDirectory (Fresh)} 'digest' 'mutable tag rejected'
Reset;Throws {Prepare (Fresh) @()} 'Clerk user IDs' 'empty enrollment rejected'
Reset;Throws {Prepare (Fresh) @('user_A, user_B')} 'Clerk user IDs' 'unparsed enrollment string rejected'
Reset;Throws {Prepare (Fresh) @('USER_A')} 'Clerk user IDs' 'case-sensitive Clerk prefix enforced'
Reset;$global:BetaReleaseMock.service.desiredCount=0;Throws {Prepare (Fresh)} 'asleep' 'scale-down window is preserved'
Reset;$global:BetaReleaseMock.service.pendingCount=1;Throws {Prepare (Fresh)} 'not stable' 'unstable service rejected'
Reset;$global:BetaReleaseMock.running[0].taskDefinitionArn='different-revision';Throws {Prepare (Fresh)} 'do not all match' 'mixed running revisions rejected'
Reset;$global:BetaReleaseMock.running[0].containers[0].imageDigest='';Throws {Prepare (Fresh)} 'rollback digest' 'missing rollback digest rejected'
Reset;$global:BetaReleaseMock.docker.Config.Labels.'org.opencontainers.image.revision'='e'*40;Throws {Prepare (Fresh)} 'OCI image revision' 'runtime commit cannot substitute for built revision'
Reset;$global:BetaReleaseMock.docker.RepoDigests=@('unrelated-image');Throws {Prepare (Fresh)} 'repository digest' 'local image must match reviewed digest'
Reset;$global:BetaReleaseMock.docker.Config.Env=@('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_synthetic');Throws {Prepare (Fresh)} 'service worker' 'missing worker build flag rejected'
Reset;$global:BetaReleaseMock.docker.Config.Env=@('NEXT_PUBLIC_ENABLE_SW=true');Throws {Prepare (Fresh)} 'build-time Clerk' 'missing Clerk build key rejected'
Reset;$global:BetaReleaseMock.rollbackDocker.Config.Labels.'com.secondbreakfast.public-cache-version'='1';Throws {Prepare (Fresh)} 'privacy cache policy' 'pre-beta rollback image blocks beta preparation'
Reset;$global:BetaReleaseMock.task.containerDefinitions[0].secrets+=@{name='SB_BETA_ENABLED';valueFrom='duplicate'};Throws {Prepare (Fresh)} 'also exist in secrets' 'conflicting secret beta flag rejected'

Reset;$dir=Fresh;Prepare $dir
$candidate=Get-Content (Join-Path $dir 'candidate-task.json') -Raw|ConvertFrom-Json
$rollback=Get-Content (Join-Path $dir 'rollback-task.json') -Raw|ConvertFrom-Json
$record=Get-Content (Join-Path $dir 'release.json') -Raw|ConvertFrom-Json
Check ((Mutations).Count -eq 0) 'preparation is read-only against AWS'
Check ($candidate.containerDefinitions[0].image -ceq $image) 'candidate pinned to reviewed digest'
Check ($rollback.containerDefinitions[0].image.EndsWith('@sha256:'+('b'*64))) 'rollback pinned to verified running digest'
Check (($candidate.PSObject.Properties.Name -notcontains 'revision') -and ($candidate.PSObject.Properties.Name -notcontains 'taskDefinitionArn')) 'read-only task-definition fields omitted'
Check ($candidate.cpu -eq '512' -and $candidate.memory -eq '1024' -and $candidate.taskRoleArn -eq 'existing-task-role' -and $candidate.executionRoleArn -eq 'existing-execution-role') 'capacity and IAM roles preserved'
Check ($candidate.tags[0].value -eq 'SecondBreakfast' -and $candidate.containerDefinitions[0].secrets[1].valueFrom -eq 'arn:existing-db-secret') 'tags and secret references preserved'
$envs=$candidate.containerDefinitions[0].environment
Check (($envs|Where-Object name -eq 'KEEP_EXISTING').value -eq 'unchanged' -and ($envs|Where-Object name -eq 'NODE_EXTRA_CA_CERTS').value -eq '/etc/ssl/rds-global-bundle.pem') 'unrelated environment and certificate trust preserved'
Check (($envs|Where-Object name -eq 'SB_BETA_CLERK_USER_IDS').value -ceq 'user_A,user_B' -and ($envs|Where-Object name -eq 'SB_BETA_ENABLED').value -eq 'true' -and ($envs|Where-Object name -eq 'SB_BETA_LOCAL_PREVIEW').value -eq 'false') 'cohort deduplicated and local preview disabled'
Throws {Prepare $dir} 'fresh release directory' 'previous rollback packet cannot be overwritten'
$global:BetaReleaseMock.service.networkConfiguration.awsvpcConfiguration.subnets=@('drifted-subnet')
Throws {& $release -Mode Deploy -ReleaseDirectory $dir} 'configuration changed' 'network drift blocks deployment'
Check ((Mutations).Count -eq 0) 'drift rejection preceded registration'

Reset;$dir=Fresh;Prepare $dir
Add-Content -LiteralPath (Join-Path $dir 'candidate-task.json') -Value ' '
Throws {& $release -Mode Deploy -ReleaseDirectory $dir} 'packet changed' 'edited candidate packet rejected'
Reset;$dir=Fresh;Prepare $dir
$global:BetaReleaseMock.service.taskDefinition='different-release'
Throws {& $release -Mode Deploy -ReleaseDirectory $dir} 'Service changed' 'task revision drift blocks deployment'

Reset;$dir=Fresh;Prepare $dir
& $release -Mode Deploy -ReleaseDirectory $dir 6>$null
$record=Get-Content (Join-Path $dir 'release.json') -Raw|ConvertFrom-Json
$calls=Mutations
Check ($calls.Count -eq 3 -and $calls[0][1] -eq 'register-task-definition' -and $calls[1][1] -eq 'register-task-definition' -and $calls[2][1] -eq 'update-service') 'rollback registered before candidate and rollout'
Check ($calls[2] -notcontains '--desired-count' -and $calls[2] -notcontains '--network-configuration') 'deployment does not alter capacity or network'
$deployment=Get-Content (Join-Path $dir 'deployment-configuration.json') -Raw|ConvertFrom-Json
Check ($deployment.maximumPercent -eq 200 -and $deployment.minimumHealthyPercent -eq 100 -and $deployment.deploymentCircuitBreaker.enable -and $deployment.deploymentCircuitBreaker.rollback) 'rolling configuration retained and circuit breaker enabled'
& $release -Mode Rollback -ReleaseDirectory $dir 6>$null
Check ($global:BetaReleaseMock.service.taskDefinition -eq $record.rollbackArn) 'rollback selects preserved pinned revision'
$global:BetaReleaseMock.service.taskDefinition='newer-unrelated-release'
Throws {& $release -Mode Rollback -ReleaseDirectory $dir} 'different release' 'rollback cannot displace a newer release'

Reset;$dir=Fresh;Prepare $dir;$global:BetaReleaseMock.failUpdate=$true
Throws {& $release -Mode Deploy -ReleaseDirectory $dir} 'AWS command failed' 'failed update is not reported as deployed'
Throws {& $release -Mode Deploy -ReleaseDirectory $dir} 'already registered' 'uncertain deployment cannot silently register a second candidate'

Reset;$dir=Fresh
Throws {& $release -Mode Prepare -DisableBeta -Image $image -ReleaseDirectory (Fresh)} 'cannot replace' 'kill switch cannot deploy an unreviewed replacement image'
& $release -Mode Prepare -DisableBeta -ReleaseDirectory $dir 6>$null
$candidate=Get-Content (Join-Path $dir 'candidate-task.json') -Raw|ConvertFrom-Json
$envs=$candidate.containerDefinitions[0].environment
Check (($envs|Where-Object name -eq 'SB_BETA_ENABLED').value -eq 'false' -and ($envs|Where-Object name -eq 'SB_BETA_CLERK_USER_IDS').value -eq '') 'kill switch disables beta and clears cohort'
Check ($candidate.containerDefinitions[0].image.EndsWith('@sha256:'+('b'*64))) 'kill switch keeps current image without a rebuild'
Check ((Mutations).Count -eq 0) 'kill-switch preparation has no AWS mutation'
Throws {& $release -Mode Rollback -ReleaseDirectory $dir} 'privacy-hardened' 'full rollback cannot use an unverified kill-switch prior revision'

Reset;$zip=ReportZip;RemotePrepare $zip
Check ($global:BetaReleaseMock.dockerCalls -eq 1 -and (Mutations).Count -eq 0) 'trusted remote candidate avoids local Docker and performs no mutation (rollback independently inspected)'
Reset;$zip=ReportZip;$global:BetaReleaseMock.build.buildStatus='FAILED';Throws {RemotePrepare $zip} 'successful status' 'failed CodeBuild rejected'
Reset;$zip=ReportZip;$global:BetaReleaseMock.build.projectName='other';Throws {RemotePrepare $zip} 'identity' 'untrusted CodeBuild project rejected'
Reset;$zip=ReportZip;$global:BetaReleaseMock.build.source.buildspec='changed';Throws {RemotePrepare $zip} 'buildspec differs' 'build command drift rejected'
Reset;$zip=ReportZip;$global:BetaReleaseMock.build.resolvedSourceVersion='f'*40;Throws {RemotePrepare $zip} 'reviewed commit' 'Git source revision drift rejected'
Reset;$zip=ReportZip;Add-Content -LiteralPath $zip -Value 'tampered';Throws {RemotePrepare $zip} 'ZIP does not match' 'tampered remote artifact rejected'
Reset;$zip=ReportZip @{image='wrong-digest'};Throws {RemotePrepare $zip} 'Report identity' 'digest substitution in report rejected'
Reset;$zip=ReportZip @{serviceWorkerBuilt=$false};Throws {RemotePrepare $zip} 'SW/Clerk' 'report missing SW build rejected'
Reset;$zip=ReportZip @{publicCacheVersion=1};Throws {RemotePrepare $zip} 'privacy cache policy' 'old cache policy report rejected'
Reset;$zip=ReportZip @{clerkPublishableKeySha256=''};Throws {RemotePrepare $zip} 'SW/Clerk' 'report missing Clerk build rejected'
Reset;$global:BetaReleaseMock.build.source.type='S3';$global:BetaReleaseMock.build.source.location='skald-dev-734702670689-artifacts/sources/secondbreakfast/reviewed.zip';$global:BetaReleaseMock.build.sourceVersion='pinned-object-version';$zip=ReportZip
$sourceSha=([BitConverter]::ToString([byte[]](1..32))).Replace('-','').ToLowerInvariant()
RemotePrepare $zip $sourceSha
Check (@($global:BetaReleaseMock.calls|Where-Object {$_[0] -eq 's3api' -and $_ -contains '--version-id' -and $_ -contains '--expected-bucket-owner'}).Count -eq 1) 'S3 source checked by exact version and checksum in existing account'
$global:BetaReleaseMock.head.VersionId='changed-version';Throws {RemotePrepare $zip $sourceSha} 'source version/checksum' 'S3 source version drift rejected'
$global:BetaReleaseMock.head.VersionId='pinned-object-version';Throws {RemotePrepare $zip ('f'*64)} 'source version/checksum' 'S3 source checksum mismatch rejected'
$global:BetaReleaseMock.build.sourceVersion='null';Throws {RemotePrepare $zip $sourceSha} 'pinned object version' 'unversioned S3 source refused'

Reset;$candidateZip=ReportZip
$candidateBuild=$global:BetaReleaseMock.build|ConvertTo-Json -Depth 100|ConvertFrom-Json
$rollbackBuildId='skaldandstone-development-foundation-secondbreakfast-web:11111111-1111-1111-1111-111111111111'
$rollbackZip=ReportZip @{image=$oldImage;codeBuildId=$rollbackBuildId}
$rollbackBuild=$global:BetaReleaseMock.build|ConvertTo-Json -Depth 100|ConvertFrom-Json
$rollbackBuild.id=$rollbackBuildId;$rollbackBuild.arn="arn:aws:codebuild:us-east-2:734702670689:build/$rollbackBuildId"
$global:BetaReleaseMock.buildRecords=@{$buildId=$candidateBuild;$rollbackBuildId=$rollbackBuild}
$config=(Fresh)+'.json';@{codeBuildId=$rollbackBuildId;buildArtifactZip=$rollbackZip;reviewedBuildspecSha256=$specSha}|ConvertTo-Json|Set-Content -LiteralPath $config
& $release -Mode Prepare -Image $image -ReviewedCommit $commit -RollbackReviewedCommit $commit -RollbackVerificationConfig $config -ClerkUserIds user_A -CodeBuildId $buildId -BuildArtifactZip $candidateZip -ReviewedBuildspecSha256 $specSha -ReleaseDirectory (Fresh) 6>$null
Check ($global:BetaReleaseMock.dockerCalls -eq 0 -and (Mutations).Count -eq 0) 'both candidate and rollback verified through CodeBuild without local Docker'

Reset;$sourceSha=([BitConverter]::ToString([byte[]](1..32))).Replace('-','').ToLowerInvariant();$config=EcrConfig;EcrPrepare $config $sourceSha
Check ($global:BetaReleaseMock.dockerCalls -eq 1 -and @($global:BetaReleaseMock.calls|Where-Object {$_[0] -eq 'ecr'}).Count -eq 2 -and (Mutations).Count -eq 0) 'artifact-free CodeBuild candidate verifies ECR config and zero-finding scan without mutation'
Reset;$config=EcrConfig;$digest=ConfigureEcrEvidence $config;$global:BetaReleaseMock.scan.imageScanFindings.findingSeverityCounts=@{HIGH=1};Throws {InvokeEcrPrepare $config $digest $sourceSha} 'scan is incomplete or has findings' 'artifact-free verification rejects ECR findings'
Reset;$config=EcrConfig @{'com.skaldandstone.source-sha256'='f'*64};Throws {EcrPrepare $config $sourceSha} 'labels do not prove' 'artifact-free verification rejects source-label drift'
Reset;$config=EcrConfig;$digest=ConfigureEcrEvidence $config;Add-Content -LiteralPath $config -Value ' ';Throws {InvokeEcrPrepare $config $digest $sourceSha} 'config does not match' 'artifact-free verification rejects config-blob tampering'
Write-Output "$assertions assertions passed. Strict mocked AWS/Docker execution only. Synthetic packet files: $testRoot"
