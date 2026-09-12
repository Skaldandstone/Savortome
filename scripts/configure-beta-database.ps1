[CmdletBinding()]
param(
  [ValidateSet('Inspect','Configure')][string]$Mode='Inspect',
  [string]$StackName='skaldandstone-development-secondbreakfast-database'
)
$ErrorActionPreference='Stop'
$profile_='skaldandstone-admin';$region_='us-east-2';$account_='051722405355'
function AwsJson([string[]]$Arguments) {
  $raw=& aws @Arguments --profile $profile_ --region $region_ --output json --no-cli-pager
  if($LASTEXITCODE -ne 0){throw "AWS command failed: $($Arguments[0..1] -join ' ')."}
  return ($raw|ConvertFrom-Json)
}
function OutputValue($Stack,[string]$Name) {
  $values=@($Stack.Outputs|Where-Object OutputKey -eq $Name)
  if($values.Count -ne 1 -or -not $values[0].OutputValue){throw "Stack output $Name is unavailable."}
  return [string]$values[0].OutputValue
}
$identity=AwsJson @('sts','get-caller-identity')
if([string]$identity.Account -cne $account_){throw 'Wrong AWS account. Refusing database configuration.'}
$response=AwsJson @('cloudformation','describe-stacks','--stack-name',$StackName)
if($response.Stacks.Count -ne 1 -or $response.Stacks[0].StackStatus -cnotin @('CREATE_COMPLETE','UPDATE_COMPLETE')){throw 'Database stack is unavailable or unstable.'}
$stack=$response.Stacks[0]
$inventory=[ordered]@{
  Account=$account_
  StackName=$StackName
  DatabaseIdentifier=(OutputValue $stack 'DatabaseIdentifier')
  Endpoint=(OutputValue $stack 'DatabaseEndpoint')
  Port=(OutputValue $stack 'DatabasePort')
  DatabaseSecurityGroupId=(OutputValue $stack 'DatabaseSecurityGroupId')
  MasterSecretArn=(OutputValue $stack 'MasterSecretArn')
  RuntimeDatabaseSecretArn=(OutputValue $stack 'RuntimeDatabaseSecretArn')
}
if($Mode -eq 'Inspect'){$inventory|ConvertTo-Json;return}
$database=(AwsJson @('rds','describe-db-instances','--db-instance-identifier',$inventory.DatabaseIdentifier)).DBInstances
if($database.Count -ne 1 -or $database[0].DBInstanceStatus -cne 'available' -or $database[0].PubliclyAccessible -ne $false -or $database[0].StorageEncrypted -ne $true){throw 'Database is unavailable or outside the reviewed private/encrypted boundary.'}
$master=(AwsJson @('secretsmanager','get-secret-value','--secret-id',$inventory.MasterSecretArn)).SecretString|ConvertFrom-Json
$runtime=(AwsJson @('secretsmanager','get-secret-value','--secret-id',$inventory.RuntimeDatabaseSecretArn)).SecretString|ConvertFrom-Json
if(-not $master.username -or -not $master.password -or $runtime.username -cne 'secondbreakfast' -or -not $runtime.password){throw 'Database secret schema is incomplete.'}
function Escape([string]$Value){return [Uri]::EscapeDataString($Value)}
$host_=$inventory.Endpoint;$port_=$inventory.Port
$adminUrl="postgresql://$(Escape $master.username):$(Escape $master.password)@${host_}:${port_}/postgres?sslmode=verify-full"
$runtimeUrl="postgresql://$(Escape $runtime.username):$(Escape $runtime.password)@${host_}:${port_}/secondbreakfast?sslmode=verify-full"
$payload=[ordered]@{username=$runtime.username;password=$runtime.password;host=$host_;port=[int]$port_;database='secondbreakfast';ADMIN_DATABASE_URL=$adminUrl;SB_DB_PASSWORD=$runtime.password;DATABASE_URL=$runtimeUrl}
$temp=Join-Path $env:TEMP ('secondbreakfast-database-secret-'+[guid]::NewGuid().ToString()+'.json')
try {
  [IO.File]::WriteAllText($temp,($payload|ConvertTo-Json -Compress),[Text.UTF8Encoding]::new($false))
  $currentSid=[Security.Principal.WindowsIdentity]::GetCurrent().User
  $privateAcl=[Security.AccessControl.FileSecurity]::new()
  $privateAcl.SetOwner($currentSid)
  $privateAcl.SetAccessRuleProtection($true,$false)
  $privateAcl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($currentSid,[Security.AccessControl.FileSystemRights]::FullControl,[Security.AccessControl.AccessControlType]::Allow))
  Set-Acl -LiteralPath $temp -AclObject $privateAcl
  $result=AwsJson @('secretsmanager','put-secret-value','--secret-id',$inventory.RuntimeDatabaseSecretArn,'--secret-string',('file://'+$temp))
  [pscustomobject]@{Account=$account_;StackName=$StackName;DatabaseIdentifier=$inventory.DatabaseIdentifier;RuntimeSecretArn=$inventory.RuntimeDatabaseSecretArn;VersionId=$result.VersionId;Configured=$true;TlsMode='verify-full'}|ConvertTo-Json
} finally {
  if(Test-Path -LiteralPath $temp){Remove-Item -LiteralPath $temp -Force}
}
