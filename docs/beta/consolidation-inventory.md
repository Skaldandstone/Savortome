# Consolidation inventory

Reviewed 8 September 2026. This inventory closes duplicate task ownership without deleting branches, worktrees, recovery refs, or unique local changes.

## Active integration

- Canonical checkout: `C:\Users\James\Documents\GitHub\SecondBreakfast`
- Preserved source branch: `preservation/consolidation-20260907-private-beta`
- Preserved source revision: `1e61ed51ba5410974b60822a4e8dee69bdaf5fbc`
- Reconciliation branch: `codex/integrate-private-beta-main-20260908`
- Reconciled `origin/main`: `21608b6764a35ad58165b440f9e9fcf3b2aec48f`
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
2. Complete the private hosted beta work in `SSE-144` in the selected development account `734702670689`. Reviewed candidate and rollback images exist with privacy-v3 labels and zero-finding ECR Basic scans; a private runtime, enhanced scan and hosted acceptance remain open.
3. Complete private Clerk request/approval and session acceptance, service-worker privacy checks, signed physical-device accessibility/lifecycle checks, current Wispling handoff acceptance, and usability/safety review.
4. Keep dining, expanded grocery rollout and live paid billing in future scope under `SSE-145` until the private beta gates pass.

## Main reconciliation, 8 September 2026

The reconciliation branch merges `origin/main` at `21608b6764a35ad58165b440f9e9fcf3b2aec48f` into the preserved beta revision `1e61ed51ba5410974b60822a4e8dee69bdaf5fbc`. The original preservation branch remains unchanged and pushed.

Five textual conflicts were resolved without discarding either product intent:

- Mobile app metadata keeps owner, EAS, backup and blocked-permission controls while using the current yolk notification and adaptive-icon accent.
- Mobile buttons and callouts keep the woodland theme, 44-point targets and readable action colors while adding the current danger and error semantics.
- The web manifest keeps the privacy-safe maskable icon split while using the current theme color.
- Source URL classification retains the hostname-based lookalike protection from `main`.
- The woodland asset check now pins the reviewed mobile assets and independently verifies the intentionally optimized web derivatives against their encoding manifest.

The merge also carries `main`'s recipe-delete danger treatment and Kroger disconnect safety note. PR #77 and the `db/rds-support` worktree remain separate and untouched.

Validation on the merged tree:

- All four workspace TypeScript checks passed.
- Core passed 639 tests in 135 suites.
- The focused woodland, mobile accessibility, web UI and legal suite passed 34 tests.
- Source classification and cook-mode regressions passed 38 tests.
- Offline privacy and generated-worker parity passed 10 tests.
- Server beta authorization and image-boundary checks passed 18 tests.
- The production web build completed successfully and generated all 39 application pages.
- `git diff --cached --check` passed.

These checks establish source and build readiness for review. They do not establish hosted Clerk/account switching, physical-device, owner visual, live grocery, live Stripe, deployment or public-release acceptance.
