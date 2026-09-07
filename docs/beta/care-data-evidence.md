# Care logic and data integrity evidence

Verified 30 August 2026 in the canonical `C:\Users\James\Documents\GitHub\SecondBreakfast` checkout, on the existing uncommitted `codex/whimsical-private-beta` branch, based on `dcb6f71`. This report covers the care/data lane, not overall release readiness. The shared disposable database reservation has been released to integration. No commits, production database connections, deployment, invitations, charges, or purchases were made by this lane.

## Implemented and audited

- The fourteen authored care ideas retain their preparation steps, ingredients, effort, time, sensory attributes, portion choices and explicit dietary tags. Suggestions require no paid classification or remote call.
- Every effort, time, sensory, appetite and dietary restriction is applied before ranking. The existing allergen detector excludes conflicts it detects. Impossible combinations and unsupported dietary certifications return no suggestions, without broadening the request.
- At most three distinct ideas occupy Right now, A little more and Future me, in ranked order. Equal-time alternatives are valid. One eligible idea produces only Right now; two produce the first two slots. Future me never bypasses a restriction.
- Opt-in pantry ranking uses the existing canonicalizer on pantry names and catalogue ingredients. Full canonical ingredient coverage precedes partial coverage, then match count, preparation time and a locale-independent ID tie-breaker. This fixes `cooked bean` versus the pantry API's canonical `bean` mismatch.
- Canonical matching changes ranking only. It does not establish quantities, available equipment, preparation form, packaged ingredients or food safety. In particular, a bean name match does not make dried beans ready-cooked. The ready-cooked bean requirement and package instructions are unchanged. Both UI owners received the request for an explicit preparation/quantity limitation.
- The link parser reads only own scalar properties for the seven documented fields: `source`, `intent`, `effort`, `time`, `temperature`, `texture`, `return_to`. It rejects malformed containers, duplicate-value arrays, unsupported values, inherited properties and arbitrary return destinations. It drops appetite, health history, medication, dietary profile, food choice and completion fields. The only accepted return is exactly `wispling://care-return`.
- The existing recipe create/import/edit transaction draft was retained and verified. Recanonicalization now encloses its entire row/index batch in a transaction, with explicit owner scoping on updates. Previously its recipe row update preceded the indexing transaction and could survive an index failure.
- The PostgreSQL URL helper now classifies the effective query-overridden host, rather than only the URL authority. It removes URL fields capable of replacing the explicit TLS object. Supported direct/traditional negotiation is preserved as an explicit option. Remote or production connections require `rejectUnauthorized: true`; plaintext is limited to the enumerated effective loopback hosts outside production. Invalid URL/negotiation errors do not echo connection input.
- Destructive beta setup/fault scripts accept only the exact documented disposable URL. Even a URL with the expected authority is rejected if it adds query overrides. Fault triggers and users are unique to the run, and injection is restricted to that run's owner.
- The existing nutrition fixture printed all passing assertions but then hit a Windows `UV_HANDLE_CLOSING` abort at forced process exit. Its script now closes the pool and sets `process.exitCode`, allowing network handles to drain. The retry exited successfully. The original failure is retained in the evidence.

## Verification results

| Check | Result | Evidence |
| --- | --- | --- |
| Care, link privacy, TLS driver and destructive URL guard | 21 tests passed | [Focused output](checks/care-data-focused.txt) |
| Full current core suite | 540 tests passed, 116 suites, no failures or skips | [Core output](checks/care-data-core-unit.txt) |
| Core typecheck | Passed | [Core typecheck](checks/care-data-core-typecheck.txt) |
| DB typecheck | Passed | [DB typecheck](checks/care-data-db-typecheck.txt) |
| Fault-injected persistence and account isolation | 10 scenarios passed, process exit 0 | [Transaction output](checks/care-data-transactions.txt) |
| Existing DB suites | 15 suites, 335 assertions passed, final process exits all 0 | [Machine-readable summary](checks/care-data-summary.json) |

Counts describe the shared checkout at this run, including other lanes' then-current core tests. They are not a substitute for integration's final tests after subsequent merges or dependency changes.

The ten transaction scenarios verify failed manual creation, edit rollback preserving full rows/timestamps/indexes, new-import rollback, failed existing-source upsert rollback, successful idempotent upsert, same-source account separation and denied cross-account read/edit/delete/nutrition writes, caller rollback across successful nested writes and empty-index deletion, successful continuation after a caught inner savepoint failure, failed recanonicalization rollback, and successful owner-only recanonicalization. The database fixture is deleted and its trigger/function removed in cleanup.

| Existing DB suite | Passing assertions | Log |
| --- | ---: | --- |
| Pantry | 34 | [Output](checks/care-data-db-pantry.txt) |
| Sharing | 27 | [Output](checks/care-data-db-sharing.txt) |
| Friends | 32 | [Output](checks/care-data-db-friends.txt) |
| Discovery | 27 | [Output](checks/care-data-db-discover.txt) |
| Recipe editor | 31 | [Output](checks/care-data-db-editor.txt) |
| Grocery connection persistence | 17 | [Output](checks/care-data-db-grocery.txt) |
| Library | 29 | [Output](checks/care-data-db-library.txt) |
| Planning | 23 | [Output](checks/care-data-db-plan.txt) |
| Dietary profile | 7 | [Output](checks/care-data-db-dietary.txt) |
| Credits | 32 | [Output](checks/care-data-db-credits.txt) |
| Billing persistence | 25 | [Output](checks/care-data-db-billing.txt) |
| Nutrition persistence | 8 | [Successful retry](checks/care-data-db-nutrition-retry.txt), [initial shutdown failure](checks/care-data-db-nutrition.txt) |
| Pairings | 9 | [Output](checks/care-data-db-pairings.txt) |
| Templates | 18 | [Output](checks/care-data-db-templates.txt) |
| Suggestions | 16 | [Output](checks/care-data-db-suggestions.txt) |

The existing nutrition script performed its public USDA lookup with a synthetic flour ingredient and reported `source: usda`. Its persistence assertions and clean retry do not validate care nutrition guidance or any payment/grocery checkout. No paid AI classification was used.

## TLS evidence boundary

Tests instantiate the installed `pg` 8.23.0 client, with `pg-connection-string` 2.14.0, and inspect its effective connection parameters without calling `connect()`. This is a demonstrated configuration parsing defect and regression check, not a live TLS handshake result.

Covered driver precedence includes query host overrides and duplicate hosts; SSL boolean/no-verification values; disabled/no-verify modes; libpq compatibility with prefer, require and verify-ca; certificate/key URL fields; direct negotiation combined with disabled modes; duplicate SSL parameters; and weakening `PGSSLMODE` defaults. Normal password decoding, port, database, application name and timeout parsing remain intact. Direct negotiation retains the explicit certificate-verifying object.

All inspected app, migration, operational and fixture PostgreSQL constructors in `packages/db` use `connectionOptions`. The retained legacy TLS/pool constants are marked deprecated because a separately supplied TLS object alone does not prevent URL overrides. The container declares the RDS CA bundle via `NODE_EXTRA_CA_CERTS`; trust-chain validity, hostname matching against a running RDS endpoint, deployed bundle freshness and production connectivity still require release verification. No production TLS was weakened to make local tests pass.

## Repeat locally

Use PowerShell in the canonical checkout. Coordinate exclusive access to the disposable fixtures with integration before rerunning the DB suites. These commands require the existing local PostgreSQL instance; do not substitute a production URL or load credentials from `.env.local`.

```powershell
Set-Location -LiteralPath 'C:\Users\James\Documents\GitHub\SecondBreakfast'
pnpm --filter @seconds/core exec node --import tsx --test test/care.test.ts test/database-tls.test.ts test/beta-database-guard.test.ts
pnpm --filter @seconds/core test
pnpm --filter @seconds/core typecheck
pnpm --filter @seconds/db typecheck

$env:DATABASE_URL = 'postgresql://sb_beta@127.0.0.1:55494/seconds_beta'
$env:NODE_ENV = 'development'
# Disposable fixture key only, never a production encryption key.
$env:GROCERY_TOKEN_ENCRYPTION_KEY = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
pnpm --filter @seconds/db exec tsx scripts/check-beta-transactions.ts
if ($LASTEXITCODE -ne 0) { throw 'Transaction checks failed' }
foreach ($suite in @('pantry','sharing','friends','discover','editor','grocery','library','plan','dietary','credits','billing','nutrition','pairings','templates','suggestions')) {
  pnpm --filter @seconds/db "check:$suite"
  if ($LASTEXITCODE -ne 0) { throw "Database suite failed: $suite" }
}
```

## Files handed to integration

This lane's substantive edits are `packages/core/src/care.ts`, `packages/core/test/care.test.ts`, `packages/core/test/database-tls.test.ts`, `packages/core/test/beta-database-guard.test.ts`, `packages/db/src/connection.ts`, `packages/db/src/queries/recipes.ts`, `packages/db/src/client.ts`, `packages/db/scripts/beta-database.ts`, `packages/db/scripts/beta-local-schema.ts`, `packages/db/scripts/check-beta-transactions.ts`, `packages/db/scripts/check-grocery.ts`, `packages/db/scripts/check-nutrition.ts`, this report and `docs/beta/checks/care-data-*`.

The pre-existing draft TLS redirections in `packages/db/src/migrate.ts`, all fifteen `check-*.ts` suites, `backfill-grocery-encryption.ts`, `demo-reset.ts` and `provision-rds.ts` were preserved and audited. Shared manifests/lockfiles, web/mobile UI, service-worker bundle, unrelated copyright files and Wispling were not edited by this lane. The parent owns final integration and commits.

## Remaining limitations and blockers

- The disposable PostgreSQL 17 schema substitutes `double precision[]` for the unused vector column. These relational checks do not establish production pgvector migration parity.
- Dietary tags are manually curated and allergen matching detects only known ingredient-name conflicts. Packaging, brands, cross-contact, preparation form and undisclosed ingredients remain unverified. Suggestions never claim verified safety.
- Browser/Android delivery must retain the new canonical pantry caveat and regenerate the offline bundle after these core changes. Both were communicated to their owners. Runtime handoff, sign-in preservation, expired sessions, failed shopping writes, screen readers, offline worker behavior and device evidence belong to those lanes.
- No live RDS TLS, actual Clerk account boundary, live Stripe/grocery purchase, Android emulator, physical device, or hosted rollout was validated here. The separately reviewed Stripe/PGlite handoff was not included in this DB run unless already present in the shared checkout; integration must rerun affected checks after applying it.
