# Consolidation inventory

Reviewed 7 September 2026. This inventory closes duplicate task ownership without deleting branches, worktrees, recovery refs, or unique local changes.

## Active integration

- Canonical checkout: `C:\Users\James\Documents\GitHub\SecondBreakfast`
- Branch: `preservation/consolidation-20260907-private-beta`
- Current pushed revision: `75ee727211acc3c4469d76ed97e826d6227d6985`
- Linear execution ticket: `SSE-144`
- Codex integration task: `01a0546f-008c-7603-bacc-cf95b56a3323`

All earlier Second Breakfast implementation tasks are archived. Their handoffs, evidence, source and artifacts are consolidated here. They should not be resumed as separate owners.

## Preserved local worktrees and branches

| Path or branch | State | Disposition |
| --- | --- | --- |
| `codex/whimsical-private-beta` | Clean ancestor of integration | Historical source branch. No separate owner remains. |
| `codex/stripe-sandbox-hardening` at `001cb5a` | Clean isolated worktree | Prior Stripe handoff. Its reviewed billing work is represented in the consolidated beta source. Preserve as comparison evidence; no separate task. |
| `codex/restaurant-discovery` | Base branch plus two dirty documentation paths | Future proposal tracked by `SSE-145`. Do not mount or implement during this beta. Preserve the dirty proposal. |
| `feat/sentry-error-tracking` worktree | Three dirty dependency-manifest paths on a branch whose committed UI/icon work has already merged | Incomplete Sentry stub, outside current beta scope. Preserve without installing, merging or deleting. |
| `claude/confident-lichterman-87b9ce` | Clean worktree, open PR #77 | Relevant grocery-token AAD security change. Keep open for focused review and database-backed validation before any real grocery tokens. |
| `claude/upbeat-torvalds-0a3720` | Dirty lockfile worktree, PR #61 closed as superseded | The current integration already has the clock parameter and reviewed database connection path. Preserve local lockfile drift; no separate task. |
| `claude/affectionate-robinson-f4f547` worktree | Clean, merged PR #62 lineage | Historical. No separate task. |
| `db/rds-support` and temporary `nomnom-rds*` checkouts | Old clean branch, one orphaned Git marker and two clean detached deployment checkouts | Pre-consolidation RDS/deployment evidence. Current integration contains the later TLS/runtime work. Preserve until a separate exact-path cleanup review. |
| `sb-admin` detached temporary checkout | Clean detached deployment reference | Historical deployment evidence. Preserve until exact-path cleanup review. |
| `feat/skillet-icons` | PR #38 lineage already merged and reconciled into the woodland beta | Historical branch. Current raster/icon audit remains the acceptance evidence. |
| `recovery/*` refs | Preserved recovery history | Do not delete or rewrite based on age or naming. |

No local worktree or recovery branch was removed. Dirty worktrees were not normalized, installed, reset, staged, or committed.

## Closed duplicate work

- GitHub PR #61 was closed on 7 September 2026 as superseded. Its query clock change already exists, while its remaining script diff targets the older database layout. Branch history and the dirty worktree remain preserved.
- Six prior Second Breakfast Codex implementation tasks covering web, care/data, Android/Wispling, privacy/release, Stripe, and restaurant proposal work are archived. This task is the only active task in the Second Breakfast Codex project.

## Work still open

1. Review PR #77 and run its grocery encryption regression against a disposable PostgreSQL fixture before any real provider token exists.
2. Complete the private hosted beta work in `SSE-144`, starting with same-account build provenance and a privacy-v3 rollback image in AWS account `051722405355`.
3. Complete private Clerk request/approval and session acceptance, service-worker privacy checks, signed physical-device accessibility/lifecycle checks, current Wispling handoff acceptance, and usability/safety review.
4. Keep dining, expanded grocery rollout and live paid billing in future scope under `SSE-145` until the private beta gates pass.
