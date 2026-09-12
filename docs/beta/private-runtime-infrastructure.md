# Private runtime infrastructure

> **Current target, 7 September 2026:** use only AWS account `051722405355`,
> profile `skaldandstone-admin`, region `us-east-2`. The active source contract is
> documented in [account-admission-migration.md](account-admission-migration.md).
> Commands and resource identifiers below that name `734702670689`, or that pass
> `--profile skaldandstone-dev`, are retained as historical proposal evidence and
> must not be executed. Account `734702670689` was closed on 7 September 2026 and
> the `skaldandstone-dev` profile was removed with it, so those commands cannot
> run and are not made runnable by substituting the current profile: the VPC,
> subnet, prefix list, certificate and stack names they reference did not move.
> The repository templates and checks now fail closed for the current account,
> where rollback, build provenance, secrets, prefix list, database and service
> remain absent.

This package separates the ephemeral PostgreSQL database from the reviewed web
runtime. Both templates default to a gate that creates nothing. No deployment
is authorized by a template file alone.

`infra/secondbreakfast-private-database.yaml` creates a nonpublic encrypted RDS
PostgreSQL 17.10 instance, forces TLS, generates RDS-managed master credentials
and a distinct runtime role credential, and snapshots the database on stack
deletion or replacement. The database security group has no CIDR ingress. The
web runtime adds only security-group-to-security-group access for port 5432.

After the database stack is stable, `scripts/configure-beta-database.ps1`
constructs the admin and runtime `verify-full` URLs in memory and writes them to
the runtime secret. It prints identifiers and a secret version ID, never URLs,
passwords, or secret contents. The one-shot provisioning task receives
`ADMIN_DATABASE_URL` and `SB_DB_PASSWORD`; the migration and web tasks receive
only `DATABASE_URL`.

The database must not stay allocated outside a reviewed validation session.
Delete the ephemeral stack before its expiry and confirm CloudFormation's final
RDS snapshot exists. Never delete that snapshot until its restore has been
tested and a later exact-path cleanup decision is recorded.

The web runtime remains blocked on ACM DNS validation, a Cloudflare Access
application, a proxied DNS record, and Cloudflare credentials with DNS and
Access write permission. Stripe checkout, tax, email, invitations, and beta
cohort access remain disabled during infrastructure bootstrap.

The inert AWS prerequisites were created in development account `734702670689`,
which is now closed; the resources below no longer exist and are recorded only
as evidence of what the proposal provisioned:

- customer-managed prefix list `pl-0766b29f8525ef6e0`, version 1, contains the
  15 IPv4 ranges published at `https://www.cloudflare.com/ips-v4` on 31 August;
- ACM certificate
  `arn:aws:acm:us-east-2:734702670689:certificate/f746b9e6-b4f2-48f2-b5ee-36112c7c39db`
  covers only `beta.secondbreakfast.skaldandstone.com` and is pending DNS
  validation;
- no Second Breakfast ECS service, load balancer, database, runtime stack, DNS
  record, public endpoint, or recurring application service was created.

The exact DNS validation record still required in Cloudflare is:

```text
Type: CNAME
Name: _04740d8c9af4bbb87e58cb6918dee1c9.beta.secondbreakfast.skaldandstone.com
Target: _a8e60a5b36f5ee0e0279c76e7ba0545d.jkddzztszm.acm-validations.aws
Proxy: DNS only
```

The current Wrangler OAuth token has zone read but no DNS edit or Access
application permission, so it was not used to bypass those controls. After the
certificate is issued, create the Access application and policy before adding
the proxied beta hostname. Keep the existing
`secondbreakfast.skaldandstone.com` record unchanged.

The self-contained runtime package is
`infra/secondbreakfast-private-runtime.yaml`. It starts from the exact rollback
image, desired count zero, beta disabled, and checkout disabled. Its two bounded
one-shot task definitions reuse the immutable candidate image to run the
existing RDS provisioner followed by reviewed migrations. The candidate source
archive contains those same scripts; line-ending-normalized comparisons match
the current source. `scripts/run-beta-database-bootstrap.ps1` requires the exact
account, stable tagged runtime stack, two-hour active expiry, task definitions,
security group, and two subnets before it can run them in order. It treats any
nonzero container exit as failure and never prints secret values.

`scripts/build-beta-expiry-template.ps1` embeds
`infra/secondbreakfast-expiry-handler.py` into the generated
`infra/secondbreakfast-session-expiry.yaml`. The controller defaults disabled.
When enabled for an exact session it checks the account, region, fixed stack
names, session ID, expiry, and three stack tags. It deletes the runtime first,
then the database, allowing CloudFormation to make the required final RDS
snapshot. It disables its own schedule only when both stacks are absent. The
small controller stack and retained log group still require a deliberate later
cleanup after evidence is recorded.

Every runtime and database stack creation must include these exact stack tags:

```text
SkaldAndStone:ManagedBy=secondbreakfast-session-expiry-v1
SkaldAndStone:SessionId=sb-<32 lowercase hex characters>
SkaldAndStone:ExpiresAtEpoch=<creation plus at most 7200 seconds>
```

The expiry stack must be created and enabled before either managed stack. A
failed or rollback stack state, wrong ARN, missing tag, wrong tag, expired
session, or session longer than two hours fails closed. No template or script in
this package has been deployed.

## Bounded session order

Run from PowerShell in
`C:\Users\James\Documents\GitHub\SecondBreakfast` only after the ACM certificate
is issued and the Cloudflare Access policy is ready. Generate a new session ID
and expiry for each run. Never reuse an expired session.

```powershell
Set-Location -LiteralPath 'C:\Users\James\Documents\GitHub\SecondBreakfast'
$created = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$expires = $created + 7200
$session = 'sb-' + ([guid]::NewGuid().ToString('N'))
$stackTags = @(
  'SkaldAndStone:ManagedBy=secondbreakfast-session-expiry-v1',
  "SkaldAndStone:SessionId=$session",
  "SkaldAndStone:ExpiresAtEpoch=$expires",
  'Application=secondbreakfast',
  'Environment=development'
)

powershell.exe -NoProfile -File scripts/build-beta-expiry-template.ps1
aws cloudformation deploy `
  --stack-name skaldandstone-development-secondbreakfast-expiry `
  --template-file infra/secondbreakfast-session-expiry.yaml `
  --capabilities CAPABILITY_IAM `
  --parameter-overrides SessionId=$session CreatedAtEpoch=$created ExpiresAtEpoch=$expires ControllerEnabled=true `
  --tags Application=secondbreakfast Environment=development `
  --profile skaldandstone-dev --region us-east-2

aws cloudformation deploy `
  --stack-name skaldandstone-development-secondbreakfast-database `
  --template-file infra/secondbreakfast-private-database.yaml `
  --parameter-overrides ActivationGate=REVIEWED_EPHEMERAL_DATABASE VpcId=vpc-0d22c584310bfebb4 DatabaseSubnetIds=subnet-06041fe2602a0ad47,subnet-04abce656ea3cc00a ExpiresAtEpoch=$expires `
  --tags $stackTags `
  --profile skaldandstone-dev --region us-east-2

powershell.exe -NoProfile -File scripts/configure-beta-database.ps1 -Mode Configure
```

Read the database stack outputs for `DatabaseSecurityGroupId` and
`RuntimeDatabaseSecretArn`, then create the runtime with desired count zero.
Use the exact issued certificate ARN and the prefix list ID recorded above.
Do not put a Clerk user ID in shell history; pass the empty default during
bootstrap. The runtime stack creates the exact service name expected by
`scripts/beta-release.ps1` and starts from the rollback task definition.

```powershell
$databaseStack = aws cloudformation describe-stacks --stack-name skaldandstone-development-secondbreakfast-database --profile skaldandstone-dev --region us-east-2 --output json --no-cli-pager | ConvertFrom-Json
$databaseSecurityGroupId = ($databaseStack.Stacks[0].Outputs | Where-Object OutputKey -eq 'DatabaseSecurityGroupId').OutputValue
$databaseSecretArn = ($databaseStack.Stacks[0].Outputs | Where-Object OutputKey -eq 'RuntimeDatabaseSecretArn').OutputValue

aws cloudformation deploy `
  --stack-name skaldandstone-development-secondbreakfast-runtime `
  --template-file infra/secondbreakfast-private-runtime.yaml `
  --capabilities CAPABILITY_IAM `
  --parameter-overrides ActivationGate=REVIEWED_EPHEMERAL_PRIVATE_HTTPS VpcId=vpc-0d22c584310bfebb4 PublicSubnetIds=subnet-06041fe2602a0ad47,subnet-04abce656ea3cc00a CloudflareIpv4PrefixListId=pl-0766b29f8525ef6e0 ApplicationCertificateArn=arn:aws:acm:us-east-2:734702670689:certificate/f746b9e6-b4f2-48f2-b5ee-36112c7c39db DatabaseSecurityGroupId=$databaseSecurityGroupId DatabaseSecretArn=$databaseSecretArn AdminSecretArn=$adminSecretArn DesiredCount=0 BetaEnabled=false ExpiresAtEpoch=$expires `
  --tags $stackTags `
  --profile skaldandstone-dev --region us-east-2

powershell.exe -NoProfile -File scripts/run-beta-database-bootstrap.ps1 -Mode Run
```

After bootstrap exits zero, create the Cloudflare-proxied beta CNAME to the ALB
DNS output behind the already active Access policy. Update desired count to one
while beta remains false. Verify the rollback revision, read-only root startup,
database TLS, private access denial, cache privacy and logs before using the
candidate release flow. Enroll Clerk IDs only through the existing release
script and keep Stripe checkout false.

At the end of the session, confirm the expiry controller deleted the runtime
and database stacks in order, the final RDS snapshot exists, and both hostnames
no longer resolve. Then delete the disabled expiry-controller stack after its
logs and cleanup evidence are retained. Do not delete the final database
snapshot as part of the session cleanup.
