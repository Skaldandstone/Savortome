# Completed web UI integration, 31 August 2026

This daytime continuation follows James's renewed instruction to finish the web
UI direction. The earlier overnight execution window is not being extended or
used for new cloud/native work. Canonical checkout remains
`C:\Users\James\Documents\GitHub\SecondBreakfast`, branch
`codex/whimsical-private-beta`, base `dcb6f71`, with all intended and unrelated
existing work preserved uncommitted.

## Integrated source

The web lane's [completion handoff](web-ui-completion.md) was independently checked:
all 45 source/style-guide hashes matched on receipt. Exactly 42 existing web files
changed against the previous security checkpoint, with no undeclared changes.
New files were the server-gated `KitchenPageHeading.tsx` and the actual-component
test harness; the style guide was also updated. The original handoff and prior
security fingerprints remain immutable historical evidence.

The remaining screens now use the woodland journal treatment: server-selected
headings; flat readable forms; a wrapping planner; discovery photo rows/cards;
pantry, shopping, friends and dietary-profile panels; saved meals, shelves and
sharing; recipe nutrition/pairing panels; and existing Plans controls. No new
commercial prices or billing behavior were introduced. Standalone beta recipes
receive an h1 while embedded/legacy recipes retain h2. Native labeled controls,
real catalogue ingredients/steps, WebP art, reduced decoration and motion remain.

Reviewed behavior changes include failed-profile retry without editable empty
defaults, care feedback beside the selected action, confirmed shelf creation,
disclosure Escape/focus requests, Saved meals navigation and reduced-motion finish
scrolling. These are source and component checks, not rendered visual acceptance.

## Integration defect repaired

Review found that dietary choices were still editable while a save was pending,
although its result reset the whole profile. A later edit could therefore be
replaced by the earlier response. Integration changed only
`apps/web/modules/profile/DietaryProfileForm.tsx` and extended
`scripts/check-woodland-ui.mjs` beyond the lane handoff:

- Choices are disabled during the write; synchronous guards reject stale choice
  handlers and duplicate submission callbacks.
- Failed writes retain the submitted choices and reopen editing.
- Results and confirmation timers after unmount are ignored/cleaned up.
- Confirmed writes reopen choices, and a subsequent edit hides the saved notice.

Two new regressions failed against the frozen source before the fix; their
[failure log](checks/web-ui-integration-profile-before.txt) is retained. Three
new cases now pass, including successful-save behavior. They use deferred local
API fixtures and synthetic React boundaries; they do not write dietary settings
or establish real Clerk/account-switch behavior. Care's independent temporary
settings and authentication/save safeguards were not modified.

## Current verified build

Current local `.next-build` ID: **`RHF3PnWQrDsVQJjkCCXDQ`**. This replaces the local
output for historical `JU_bSJRJvJgnvh6kH4QVX`. All 476 prior output hashes were checked
before rebuilding. The [new source freeze](checks/web-ui-integration-source.json)
and [build fingerprint](checks/web-ui-integration-build-manifest.json) cover 337
source/config files and 476 output files. `scripts/check-web-ui-build.mjs` validates
this new snapshot without changing or relaxing the old security audit script.

| Integration check | Result and evidence |
| --- | --- |
| Actual component, library, image-handler and server-gate checks with mocked boundaries | 34 passed, [log](checks/web-ui-integration-components.txt) |
| Care return-state/privacy helpers | 4 passed, [log](checks/web-ui-integration-care.txt) |
| Regenerated offline/privacy behavior | 10 passed, [log](checks/web-ui-integration-offline.txt) |
| Web TypeScript, incremental disabled | Passed, [log](checks/web-ui-integration-typecheck.txt) |
| Production web build | Passed; 35 prerendered pages, care dynamic, [log](checks/web-ui-integration-production-build.txt) |
| Frozen source, protection and output audit | Passed, [manifest](checks/web-ui-integration-build-manifest.json) |
| Tracked web/style whitespace | Passed, [line-ending notices](checks/web-ui-integration-whitespace.txt) |

The lane's unchanged CSS also has 24 successful transforms and 22 flat-color
contrast calculations in its handoff. The production build independently compiles
the integrated styles. Those calculations do not certify textured artwork,
disabled controls, computed layouts or full accessibility compliance.

The build used direct Node entrypoints, with local env-file variables explicitly
blanked, `NODE_ENV=production`, telemetry disabled, beta/local preview/checkout/live
billing false and service-worker compilation true. There were no Clerk, database
or paid API credentials in its build configuration. Existing production app origin
was retained without contacting it. This is a keyless local build, not a hosted
invited-account container. No package install, dependency/SDK change, Android
build, database mutation, external image fetch or provider action occurred.

Both built image configurations retain unoptimized true and empty remote host
patterns. Static icon support remains enabled; both emitted icon route bodies
match the preserved skillet bytes. The vendored parser is still in the server
trace and is **not fixed**. [Image-parser risk and release requirements](image-parser-security.md)
remain applicable; that report's specific source/build fingerprint is historical.

All 36 protected source/art/dependency hashes, 161 native source hashes and all
three APK hashes match. This includes image configuration, auth/beta gates, legal
footer, core catalogue, offline worker, billing code, artwork and package/lockfiles.
Original and illustrated account/guest APKs were not overwritten or rebuilt.

Repeat from the canonical repository without pnpm:

```powershell
node --test scripts/check-woodland-ui.mjs scripts/check-woodland-library.mjs scripts/check-next-image-boundary.mjs scripts/check-beta-authorization.mjs
node packages/core/node_modules/tsx/dist/cli.mjs --test apps/web/modules/care/care-state.test.ts
node node_modules/typescript/bin/tsc --noEmit --incremental false -p apps/web/tsconfig.json
node --import ./packages/core/node_modules/tsx/dist/loader.mjs --test packages/core/test/offline-privacy.test.ts packages/core/test/offline-parity.test.ts
node scripts/check-web-ui-build.mjs
```

## Acceptance still pending

No browser navigation, alternate renderer, screenshot or URL-policy workaround was
attempted. The actual updated UI still needs permitted browser inspection across
narrow/wide screens, both themes/system appearance, text/zoom settings, keyboard,
screen reader, reduced motion/decoration and forced colors. Real focus/scroll,
new shelf/profile interactions and art performance remain unverified at runtime.

Real invited/non-invited/expired Clerk sessions, account switching, authenticated
failed writes, worker lifecycle, bidirectional current-alpha Wispling handoff,
emulator/physical-device review, approved signing and cohort enrollment remain
open. Earlier software, Stripe and Android evidence remains historical and was
not promoted into new runtime/device acceptance by this build.

No commit, push, merge, deployment, invitation, paid job or live billing change.
Release still requires the owner's visual/usability review, intended-source
commit, coordinated company-target identity/revision checks and a reviewed
rollback image retaining both privacy-v3 and the image-optimizer mitigation.
