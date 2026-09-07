# Web UI continuation, 31 August 2026

Status: source complete for the remaining-feature pass and ready for parent integration. **The running UI has not received new visual acceptance.** The existing browser URL-policy rejection was respected without navigation retries, other browsers, proxies or alternate renderers. This pass did not build, deploy, commit, alter artwork or change Android.

James explicitly reopened this lane: "ok keep building the ui under the new direction until it is done". The prior `JU_bSJRJvJgnvh6kH4QVX` image-security web build is historical for this changed UI source. Its report, fingerprint and assertions are preserved unchanged.

## Completed source work

- Added native journal page headings to cooking, planning, shopping, profile, friends, discovery, saved meals and recipe new/edit/cook screens. The heading component consults the existing server beta gate. Legacy pages receive no new visual heading. Standalone beta recipe pages use their actual title as an h1; embedded recipe cards and legacy pages retain the h2 default.
- Finished the quiet treatment of existing screens: flat framed forms; a wrapping planner day grid; discovery photo cards and narrow rows; pantry results; shopping aisles; profile choices; friend/feed rows; saved meals; recipe shelves, sharing links, nutrition and meal pairings. Plans styling preserves disabled-action behavior and all server availability flags. No fake counts, recipe examples, classifications or new service calls.
- Preserved the scene-led library, real collection/shelf data, explicit woodland-only library props, actual care ingredients/steps, single-item shopping action, fixed Wispling destination, temporary care choices and original artwork. Existing WebP asset URLs remain. Form panels no longer repeat the heavy timber texture behind inputs.
- Matched native form chrome to the chosen light/dark/system theme. Strengthened the brass border to `#8E7855` dark and `#8A704A` light; parchment control boundaries use `#806742`. Removed additional ornamental shadows in reduced decoration. Added wrapping for enlarged text in planner, editor, timer, discovery and companion recipe panels, plus forced-color handling for entry/navigation elements.
- Added Saved meals to More and an active indication for its containing disclosure. Escape closes display/navigation disclosures and requests focus on their summaries. New shelf focuses its input, offers Cancel and reports success only after its existing API resolves; failed writes retain the name. Care shopping status/sign-in now appears inside the selected card next to its action, with the existing live status role and no duplicate message below the other cards.

These are implementation changes and intended responsive behavior, not claims that every rendered viewport is correct.

## Demonstrated defects repaired

1. Dietary-profile loading previously swallowed failure and presented an apparently empty editable profile. It now distinguishes loading, unavailable and successfully loaded data. An unavailable profile offers retry without editable defaults or Save. A successfully loaded empty profile remains editable. Late/unmounted responses are ignored, development-effect replay cannot overwrite a newer result, and a stale retry callback cannot replace edits after successful loading. Care's separate local temporary choices remain unchanged.
2. `FinishPanel` explicitly requested smooth scrolling regardless of reduced motion. It now checks the OS preference and requests an immediate scroll when reduction is enabled. Cooking status/rating calls were not changed.
3. Static theme borders were below 3:1 against some flat field surfaces. The strengthened values pass the recorded flat-surface checks. This does not certify text over artwork, texture variation or all UI states.
4. Care's shopping feedback sat after all suggestion cards, away from the tapped action on a narrow screen. It now stays with the selected choice; guest/offline paths still do not write, and unconfirmed writes still do not claim success.

## Validation

| Check | Result | Evidence |
| --- | --- | --- |
| Actual component bodies with mocked React/API boundaries | 12 new cases passed | [Combined test log](checks/web-ui-component-tests.txt), `scripts/check-woodland-ui.mjs` |
| Existing legacy library/server selection regressions | 4 passed | Same combined log |
| Existing image endpoint/configuration/metadata boundary tests | 8 passed, assertions unchanged | Same combined log |
| Care return/selection/privacy helpers | 4 passed | [Care log](checks/web-ui-care-state.txt) |
| Web TypeScript | Passed, direct Node, incremental disabled | [Typecheck](checks/web-ui-typecheck.txt) |
| Changed stylesheets | 24 parsed/transformed with installed Next CSS-module plugins | [Styles](checks/web-ui-css.txt) |
| Flat theme color pairs | 22 passed; body/muted/action text at least 4.5:1, borders at least 3:1 on checked theme surfaces | [Color calculations](checks/web-ui-contrast.json) |
| Source whitespace | `git diff --check` passed; Windows line-ending notices only | Run against owned web/style/test changes |
| Preservation and changed source | Recorded relative to image-security checkpoint | [Handoff fingerprint](checks/web-ui-source-manifest.json) |

The new component tests exercise server-gated headings, recipe heading levels, Saved meals navigation, Escape callback/focus requests, real catalogue ingredient/step presence, profile load failure/retry/empty state/late responses, reduced-motion scroll choice, guest/offline care feedback and shelf write outcomes. They do not run a browser, actual React effect scheduling, a real account, network integration or native assistive technology. Tests use synthetic calls only; no actual shelf, dietary profile, cooking event or shopping item was written.

Direct commands from the canonical repository:

```powershell
node --test scripts/check-woodland-ui.mjs scripts/check-woodland-library.mjs scripts/check-next-image-boundary.mjs
node packages/core/node_modules/tsx/dist/cli.mjs --test apps/web/modules/care/care-state.test.ts
node node_modules/typescript/bin/tsc --noEmit --incremental false -p apps/web/tsconfig.json
```

No pnpm/install, package/lockfile changes, full core/database suite, shared fixture mutation or production build was performed in this lane. Parent owns the fresh combined build and new integration fingerprint. Do not weaken `scripts/check-next-image-build.mjs` to validate this changed source against the old checkpoint.

## Exact handoff

The fingerprint lists every modified source file and hash: 42 existing web files changed against the prior 333-file source checkpoint. New source: `apps/web/modules/woodland/KitchenPageHeading.tsx` and `scripts/check-woodland-ui.mjs`. Also updated `STYLE_GUIDE.md`, this report, the historical web-evidence pointer and the new `checks/web-ui-*` files.

The 42 files consist of eleven route-page wrappers, six behavior/presentation components (`CareScreen`, `FinishPanel`, `NewShelf`, `DietaryProfileForm`, `RecipeCard`, `RecipeHeader`), the woodland shell component and 24 stylesheets. Guard conditions, APIs, catalogue/core, billing sources, image mitigation, offline worker and legal footer were not changed. Native source and all three APKs remain outside this lane; preservation checks are recorded in the fingerprint. Original PNGs and lossless WebP assets are untouched.

## Remaining acceptance work

There are no deliberately unfinished feature-styling areas in this source pass. It is still **not visually signed off**. Once browser access is permitted, inspect the actual library/care/recipe/cook and every everyday screen at narrow/wide widths, light/dark/system, 125/150/200-percent text, actual browser zoom, reduced decoration/motion and forced colors. Check the new planner layout, card row wrapping, large-text timer, field contrast, disclosure dismissal, shelf form focus, profile retry, care in-card status and recipe heading hierarchy with keyboard and a screen reader. Assess art loading/performance separately.

Real invited/non-invited/expired Clerk sessions, failed authenticated writes, account switching, Wispling app navigation, service-worker lifecycle and physical-device review remain separate integration requirements. The earlier account/guest Android art builds are preserved; they do not establish this new web revision's behavior. No claim of launch or cohort readiness is made.
