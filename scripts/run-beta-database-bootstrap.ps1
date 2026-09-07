[CmdletBinding()]
param(
  [ValidateSet('Inspect','Run')][string]$Mode='Inspect',
  [string]$RuntimeStackName='skaldandstone-development-secondbreakfast-runtime',
  [string[]]$Subnets=@(),
  [int]$TimeoutSeconds=900
)
$ErrorActionPreference='Stop'
$profile_='skaldandstone-admin';$region_='us-east-2';$account_='051722405355'
$cluster_='skaldandstone-production'
function AwsJson([string[]]$Arguments) {
  $raw=& aws @Arguments --profile $profile_ --region $region_ --output json --no-cli-pager
  if($LASTEXITCODE -ne 0){throw "AWS command failed: $($Arguments[0..1] -join ' ')."}
  return ($raw|ConvertFrom-Json)
}
function OutputValue($Stack,[string]$Name) {
  $value=@($Stack.Outputs|Where-Object OutputKey -eq $Name)
  if($value.Count -ne 1 -or -not $value[0].OutputValue){throw "Runtime output $Name is unavailable."}
  return [string]$value[0].OutputValue
}
$identity=AwsJson @('sts','get-caller-identity')
if([string]$identity.Account -cne $account_){throw 'Wrong AWS account. Refusing database bootstrap.'}
if($Subnets.Count -lt 2 -or @($Subnets|Where-Object {$_ -cnotmatch '^subnet-[0-9a-f]+$'}).Count -gt 0){throw 'Supply at least two reviewed subnet IDs from account 051722405355.'}
$response=AwsJson @('cloudformation','describe-stacks','--stack-name',$RuntimeStackName)
if($response.Stacks.Count -ne 1 -or $response.Stacks[0].StackStatus -cnotin @('CREATE_COMPLETE','UPDATE_COMPLETE')){throw 'Runtime stack is unavailable or unstable.'}
$stack=$response.Stacks[0]
$tags=@{};foreach($tag in $stack.Tags){$tags[[string]$tag.Key]=[string]$tag.Value}
if($tags['SkaldAndStone:ManagedBy'] -cne 'secondbreakfast-session-expiry-v1' -or $tags['SkaldAndStone:SessionId'] -cnotmatch '^sb-[a-f0-9]{32}$' -or $tags['SkaldAndStone:ExpiresAtEpoch'] -cnotmatch '^[0-9]{10}$'){throw 'Runtime stack lacks the reviewed expiry identity.'}
$now=[DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
if([int64]$tags['SkaldAndStone:ExpiresAtEpoch'] -le $now -or [int64]$tags['SkaldAndStone:ExpiresAtEpoch'] -gt ($now+7200)){throw 'Runtime expiry is not within the active two-hour session.'}
$inventory=[ordered]@{
  Account=$account_
  Cluster=$cluster_
  RuntimeStack=$RuntimeStackName
  SessionId=$tags['SkaldAndStone:SessionId']
  ExpiresAtEpoch=[int64]$tags['SkaldAndStone:ExpiresAtEpoch']
  ProvisionTaskDefinition=(OutputValue $stack 'ProvisionTaskDefinitionArn')
  MigrationTaskDefinition=(OutputValue $stack 'MigrationTaskDefinitionArn')
  TaskSecurityGroupId=(OutputValue $stack 'TaskSecurityGroupId')
  Subnets=@($Subnets)
}
if($Subnets.Count -lt 2 -or @($Subnets|Where-Object {$_ -cnotmatch '^subnet-[0-9a-f]+$'}).Count){throw 'Supply at least two exact subnet IDs.'}
if($Mode -eq 'Inspect'){$inventory|ConvertTo-Json -Depth 5;return}
function RunOne([string]$Purpose,[string]$TaskDefinition) {
  $configuration="awsvpcConfiguration={subnets=[$($Subnets -join ',')],securityGroups=[$($inventory.TaskSecurityGroupId)],assignPublicIp=ENABLED}"
  $started=AwsJson @('ecs','run-task','--cluster',$cluster_,'--launch-type','FARGATE','--task-definition',$TaskDefinition,'--network-configuration',$configuration,'--count','1','--started-by',('sb-bootstrap-'+$inventory.SessionId))
  if($started.failures.Count -or $started.tasks.Count -ne 1){throw "$Purpose task did not start."}
  $taskArn=[string]$started.tasks[0].taskArn
  $deadline=[DateTimeOffset]::UtcNow.AddSeconds($TimeoutSeconds)
  do {
    Start-Sleep -Seconds 5
    $description=AwsJson @('ecs','describe-tasks','--cluster',$cluster_,'--tasks',$taskArn)
    if($description.failures.Count -or $description.tasks.Count -ne 1){throw "$Purpose task became unavailable."}
    $task=$description.tasks[0]
  } while($task.lastStatus -cne 'STOPPED' -and [DateTimeOffset]::UtcNow -lt $deadline)
  if($task.lastStatus -cne 'STOPPED'){throw "$Purpose task did not stop within the bounded timeout."}
  $containers=@($task.containers)
  $primaryName=if($Purpose -ceq 'migration'){'migrate'}else{$Purpose}
  $primary=@($containers|Where-Object name -eq $primaryName)
  $init=@($containers|Where-Object name -eq 'volume-init')
  if($containers.Count -ne 2 -or $primary.Count -ne 1 -or $init.Count -ne 1 -or @($containers|Where-Object exitCode -ne 0).Count -gt 0){throw "$Purpose task failed. Inspect the bounded CloudWatch stream before retrying."}
  return [ordered]@{Purpose=$Purpose;TaskArn=$taskArn;ExitCode=[int]$primary[0].exitCode;VolumeInitExitCode=[int]$init[0].exitCode;StoppedReason=[string]$task.stoppedReason}
}
$provision=RunOne 'provision' $inventory.ProvisionTaskDefinition
$migration=RunOne 'migration' $inventory.MigrationTaskDefinition
[pscustomobject]@{Account=$account_;SessionId=$inventory.SessionId;Provision=$provision;Migration=$migration;Completed=$true}|ConvertTo-Json -Depth 6
