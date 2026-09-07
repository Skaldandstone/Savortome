[CmdletBinding()]
param()
$ErrorActionPreference='Stop'
$profile_='skaldandstone-dev';$region_='us-east-2';$account_='734702670689'
$prefixListId_='pl-0766b29f8525ef6e0'
$certificateArn_='arn:aws:acm:us-east-2:734702670689:certificate/f746b9e6-b4f2-48f2-b5ee-36112c7c39db'
$cluster_='skaldandstone-development-foundation-cluster'
$service_='skaldandstone-development-foundation-secondbreakfast-web'
function AwsJson([string[]]$Arguments) {
  $raw=& aws @Arguments --profile $profile_ --region $region_ --output json --no-cli-pager
  if($LASTEXITCODE -ne 0){throw "AWS command failed: $($Arguments[0..1] -join ' ')."}
  return ($raw|ConvertFrom-Json)
}
$identity=AwsJson @('sts','get-caller-identity')
if([string]$identity.Account -cne $account_){throw 'Wrong AWS account.'}
$prefix=(AwsJson @('ec2','describe-managed-prefix-lists','--prefix-list-ids',$prefixListId_)).PrefixLists
if($prefix.Count -ne 1 -or $prefix[0].State -cne 'create-complete' -or $prefix[0].OwnerId -cne $account_ -or $prefix[0].PrefixListName -cne 'skaldandstone-development-cloudflare-ipv4'){throw 'Cloudflare prefix list identity or state is invalid.'}
$expected=@(Get-Content -LiteralPath 'infra/cloudflare-ipv4.txt'|Where-Object {$_ -and -not $_.StartsWith('#')}|Sort-Object)
$actual=@((AwsJson @('ec2','get-managed-prefix-list-entries','--prefix-list-id',$prefixListId_)).Entries.Cidr|Sort-Object)
if($expected.Count -ne 15 -or (Compare-Object $expected $actual)){throw 'Cloudflare prefix list differs from the reviewed official IPv4 set.'}
$certificate=(AwsJson @('acm','describe-certificate','--certificate-arn',$certificateArn_)).Certificate
if($certificate.DomainName -cne 'beta.secondbreakfast.skaldandstone.com' -or $certificate.SubjectAlternativeNames.Count -ne 1 -or $certificate.SubjectAlternativeNames[0] -cne $certificate.DomainName -or $certificate.Type -cne 'AMAZON_ISSUED' -or $certificate.KeyAlgorithm -cne 'RSA-2048'){throw 'ACM certificate identity or boundary is invalid.'}
if($certificate.Status -cnotin @('PENDING_VALIDATION','ISSUED')){throw 'ACM certificate is not pending or issued.'}
$services=AwsJson @('ecs','describe-services','--cluster',$cluster_,'--services',$service_)
if($services.services.Count -gt 1){throw 'Unexpected duplicate Second Breakfast services.'}
if($services.services.Count -eq 1 -and $services.services[0].serviceName -cne $service_){throw 'Unexpected Second Breakfast service identity.'}
$stackNames=@('skaldandstone-development-secondbreakfast-expiry','skaldandstone-development-secondbreakfast-database','skaldandstone-development-secondbreakfast-runtime')
$stacks=@()
foreach($name in $stackNames){
  $previousPreference=$ErrorActionPreference
  $ErrorActionPreference='Continue'
  $raw=& aws cloudformation describe-stacks --stack-name $name --profile $profile_ --region $region_ --output json --no-cli-pager 2>&1
  $exitCode=$LASTEXITCODE
  $ErrorActionPreference=$previousPreference
  if($exitCode -eq 0){$stack=($raw|ConvertFrom-Json).Stacks[0];$stacks+=[ordered]@{Name=$name;Status=$stack.StackStatus}}
  elseif(($raw|Out-String) -match 'does not exist'){$stacks+=[ordered]@{Name=$name;Status='ABSENT'}}
  else{throw "Could not establish stack state for $name."}
}
$dns=[ordered]@{}
foreach($name in @('beta.secondbreakfast.skaldandstone.com','origin.secondbreakfast.skaldandstone.com')){
  try {
    $records=@(Resolve-DnsName -Name $name -DnsOnly -ErrorAction Stop|Where-Object {$_.Type -in @('A','AAAA','CNAME')})
    $dns[$name]=($records.Count -gt 0)
  } catch {$dns[$name]=$false}
}
if(@($dns.Values|Where-Object {$_ -eq $true}).Count){throw 'A private runtime hostname already resolves unexpectedly.'}
[pscustomobject]@{
  CheckedAt=[DateTimeOffset]::UtcNow.ToString('o')
  Account=$account_
  Region=$region_
  PrefixList=[ordered]@{Id=$prefixListId_;State=$prefix[0].State;Version=$prefix[0].Version;Entries=$actual.Count}
  Certificate=[ordered]@{Arn=$certificateArn_;Domain=$certificate.DomainName;Status=$certificate.Status}
  ServiceCount=$services.services.Count
  Stacks=$stacks
  DnsRecordsPresent=$dns
  PublicRuntimeExists=$false
}|ConvertTo-Json -Depth 6
