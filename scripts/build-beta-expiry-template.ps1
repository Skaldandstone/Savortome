[CmdletBinding()]
param(
  [string]$Template='infra/secondbreakfast-session-expiry.template.yaml',
  [string]$Handler='infra/secondbreakfast-expiry-handler.py',
  [string]$Output='infra/secondbreakfast-session-expiry.yaml'
)
$ErrorActionPreference='Stop'
$templateText=Get-Content -LiteralPath $Template -Raw
$handlerLines=Get-Content -LiteralPath $Handler
if(([regex]::Matches($templateText,'__EXPIRY_HANDLER__').Count) -ne 1){throw 'Expiry template must contain exactly one handler marker.'}
$inline=($handlerLines|ForEach-Object {'          '+$_}) -join "`n"
$rendered=$templateText.Replace('          __EXPIRY_HANDLER__',$inline)
[IO.File]::WriteAllText((Join-Path (Get-Location) $Output),$rendered,[Text.UTF8Encoding]::new($false))
$verification=Get-Content -LiteralPath $Output -Raw
if($verification.Contains('__EXPIRY_HANDLER__')){throw 'Rendered expiry template still contains its handler marker.'}
[pscustomobject]@{
  Output=(Resolve-Path -LiteralPath $Output).Path
  Sha256=(Get-FileHash -LiteralPath $Output -Algorithm SHA256).Hash.ToLowerInvariant()
  HandlerSha256=(Get-FileHash -LiteralPath $Handler -Algorithm SHA256).Hash.ToLowerInvariant()
}|ConvertTo-Json
