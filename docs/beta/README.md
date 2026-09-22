# Savortome beta and release evidence

> **Current checkpoint, 21 September 2026:** Savortome is running on the
> existing production web service. This source candidate restores useful guest
> access to **Feed me gently** while keeping account pages and APIs protected.
> The web production build, all four workspace typechecks, 688 core tests, 15
> route-level browser tests, and 58 focused authorization, offline, receipt,
> mobile, and woodland checks pass. The current ARM64 account-preview APK was
> installed and exercised on a physical Samsung tablet; see
> [physical-device-evidence.md](physical-device-evidence.md). The production
> Clerk new-device email is now a custom Savortome woodland template whose
> checked-in body matches the provider. A new sealed web image and live route
> verification are still required before this candidate is called deployed.

The documents below retain older **Second Breakfast** names where they describe
historical resources, compatibility hosts, or evidence from before the
Savortome rename. Those names are not the current product identity.

The canonical repository is `C:\Users\James\Documents\GitHub\Savortome`.
Current source, runtime, and provider evidence supersede historical references
to the retired repository path.

The web concept rebuild passed its [integration checks](web-concept-integration.md). The [31 August follow-up](overnight-integration.md) adds secure Stripe lifecycle handling and Android concept parity with separately named review APKs. Running-UI visual acceptance is still pending. Earlier screenshots and the original Android APK remain prior-revision evidence; see [the current integration status](INTEGRATION.md).

- [Approved plan](PLAN.md) and [parallel ownership](COORDINATION.md).
- [Integrated implementation, final checks and remaining gates](INTEGRATION.md).
- [Final private-beta source, Android and handoff checkpoint](final-integration-checkpoint.md).
- [Completed web UI integration and new build checkpoint](web-ui-integration.md).
- [Focused recipe cook-step experience](cook-step-experience.md).
- [Current web functionality and woodland-theme audit](web-functional-theme-audit.md).
- [Readiness evidence and blockers](readiness-evidence.md).
- [Image parser exposure, scoped mitigation and remaining build risk](image-parser-security.md).
- [Release, enrollment, revocation and rollback runbook](release-runbook.md).
- [Current account and owner-approved admission migration](account-admission-migration.md).
- [Consolidated tasks, worktrees, branches and remaining work](consolidation-inventory.md).
- [Tester installation and feedback guide](tester-guide.md).
- [Care/data verification](care-data-evidence.md), [web evidence](web-evidence.md), [Android evidence](android-evidence.md), [Wispling handoff evidence](handoff-evidence.md), and [Stripe integration](stripe-integration-evidence.md).
- [Design package](../../design/) and [style guide](../../STYLE_GUIDE.md). Artwork and browser captures are review material, not proof of Android interaction.

The hosted redesign and `/care` require owner approval recorded in server-read Clerk metadata and are disabled by default. An exact Clerk user-ID list remains a recovery override, not the enrollment workflow. Guest care belongs to development previews and private Android builds. All matching is deterministic and local. The generic offline document has no saved profile, pantry, account, prior choice or shopping write; it offers temporary choices and explains those limits.

No invitations, purchases, real charges, runtime deployment or live billing were
performed. Read-only AWS verification proves the exact candidate was migrated
and scanned in the sole current account `051722405355`. The distinct privacy-v3
rollback image and same-account build provenance are still missing there.
Physical-device, private HTTPS runtime, live invited-account, cohort signing,
usability and safety checks remain explicit gates. Public food-support release
is outside this pass.
