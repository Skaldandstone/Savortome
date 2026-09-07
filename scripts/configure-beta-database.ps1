[CmdletBinding()]
param(
  [ValidateSet('Inspect')][string]$Mode='Inspect',
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
$inventory|ConvertTo-Json
