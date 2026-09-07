[CmdletBinding()]
param(
  [string]$CloudflareIpv4PrefixListId,
  [string]$CertificateArn='arn:aws:acm:us-east-2:051722405355:certificate/d93bcaed-e77a-4a56-b872-a6e6bf2f639e'
)
$ErrorActionPreference='Stop'
$profile_='skaldandstone-admin';$region_='us-east-2';$account_='051722405355'
$cluster_='skaldandstone-production'
$service_='secondbreakfast-web'
function AwsJson([string[]]$Arguments) {
  $raw=& aws @Arguments --profile $profile_ --region $region_ --output json --no-cli-pager
  if($LASTEXITCODE -ne 0){throw "AWS command failed: $($Arguments[0..1] -join ' ')."}
  return ($raw|ConvertFrom-Json)
}
$identity=AwsJson @('sts','get-caller-identity')
if([string]$identity.Account -cne $account_){throw 'Wrong AWS account.'}
$knownPrefixLists=@((AwsJson @('ec2','describe-managed-prefix-lists','--filters','Name=prefix-list-name,Values=secondbreakfast-cloudflare-ipv4')).PrefixLists)
if(-not $CloudflareIpv4PrefixListId){
  if($knownPrefixLists.Count -eq 0){throw 'Cloudflare IPv4 prefix list is not provisioned in account 051722405355. Supply a reviewed list before runtime deployment.'}
  if($knownPrefixLists.Count -ne 1){throw 'Expected exactly one Second Breakfast Cloudflare IPv4 prefix list.'}
  $CloudflareIpv4PrefixListId=[string]$knownPrefixLists[0].PrefixListId
}
if($CloudflareIpv4PrefixListId -cnotmatch '^pl-[0-9a-f]+$'){throw 'Cloudflare IPv4 prefix list ID is malformed.'}
$prefix=(AwsJson @('ec2','describe-managed-prefix-lists','--prefix-list-ids',$CloudflareIpv4PrefixListId)).PrefixLists
if($prefix.Count -ne 1 -or $prefix[0].State -cne 'create-complete' -or $prefix[0].OwnerId -cne $account_){throw 'Cloudflare prefix list identity or state is invalid.'}
$expected=@(Get-Content -LiteralPath 'infra/cloudflare-ipv4.txt'|Where-Object {$_ -and -not $_.StartsWith('#')}|Sort-Object)
$actual=@((AwsJson @('ec2','get-managed-prefix-list-entries','--prefix-list-id',$CloudflareIpv4PrefixListId)).Entries.Cidr|Sort-Object)
if($expected.Count -ne 15 -or (Compare-Object $expected $actual)){throw 'Cloudflare prefix list differs from the reviewed official IPv4 set.'}
$certificate=(AwsJson @('acm','describe-certificate','--certificate-arn',$CertificateArn)).Certificate
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
  PrefixList=[ordered]@{Id=$CloudflareIpv4PrefixListId;State=$prefix[0].State;Version=$prefix[0].Version;Entries=$actual.Count}
  Certificate=[ordered]@{Arn=$CertificateArn;Domain=$certificate.DomainName;Status=$certificate.Status}
  ServiceCount=$services.services.Count
  Stacks=$stacks
  DnsRecordsPresent=$dns
  PublicRuntimeExists=$false
}|ConvertTo-Json -Depth 6
