# Woodland web and accessibility evidence

Historical UI revision: James subsequently requested the concept-faithful web rebuild. See [the new source handoff](web-concept-rebuild.md). UI screenshots and visual observations below predate that rebuild and do not validate its layouts. The separately owned v3 worker checks retain their stated scope.

The 31 August remaining-feature source pass is recorded in [web-ui-completion.md](web-ui-completion.md), with new component/source checks but no new browser screenshots.

30 August 2026. Lane: woodland web and accessibility. Canonical checkout: `C:\Users\James\Documents\GitHub\SecondBreakfast`, branch `codex/whimsical-private-beta`. No commit, deployment, invitations, charges, purchases, or production-data writes made by this lane.

## Implemented

- Kept the separate hearth scene, transparent kettle/journal prop, four-view concept board, optional existing-Wispling comparison, and PR #38 skillet mark. No new mascot or flattened controls.
- Added a beta-only text-on-accent token. Shared action styles retain the existing public fallback and use dark timber on brass in beta dark mode. Library, recipe/cook, account, import/credits, shopping, and plans receive the fix.
- Display options has system/light/dark, 100/125/150/200 percent text, and reduced decoration. Validated saved display values; typography, care controls, recipe instructions, quantities and buttons enlarge with rem units. Native labels/navigation stay visible. Added active-page indication and keyboard skip link. Reduced-motion CSS is scoped to beta, with print overrides last so a selected dark theme cannot make print text pale.
- Narrow library rows put rating/shelf metadata beneath the title. Recipe actions, profile actions, cooking headers/timers, shopping labels and ingredient quantities can wrap. Scrollable cooking ingredients have a named, keyboard-focusable region; cooking navigation is named. The previously corrected single-main CookMode is preserved.
- Care restore records expire in 30 minutes and reject future/malformed timestamps. The shared parser validates the allowed handoff fields and fixed return destination; local appetite/pantry values and catalogue selection IDs are separately validated. The selected idea stays in this tab and is marked visibly. It is not shown as a suggestion if changed restrictions exclude it. Nothing auto-saves after sign-in.
- Outgoing sign-in URLs contain only allowed handoff fields, never selected food, appetite, pantry, profile, restrictions, or completion data. The Wispling return remains exactly `wispling://care-return`.
- Care guest mode skips account profile/pantry requests and honestly says saved settings are not applied. Temporary restrictions remain available. Both successful and failed in-flight shopping messages are ignored after account identity changes; HTTP 401 is handled explicitly. Each shopping action names its one item and says it does not add all ingredients. Pantry copy warns that names do not establish quantity or preparation form.
- A missing-Clerk sign-in page now shows an unavailable-account message and a safe route back to care/library. The care server gate is unchanged; privacy lane confirmed ownership coordination.
- Fixed existing shared TextField/TextArea custom-class replacement. Custom classes now merge with base styles, fixing the white monospace Description box found in the dark editor. Corrected the editor's misleading pantry-presence hint to an ingredient-name-for-matching hint. Added field labels to import, pantry search/add, discovery and friend handle, indexed optional-ingredient labels, and an accessible planner-dialog name.
- Preserved the concurrent legal footer. Plans availability/Stripe code is owned by integration; only the contrast CSS was changed here, with the later availability CSS preserved.

## Browser verification completed

Used the Browser skill and in-app Chromium, initially `localhost:3094` with the disposable local database and no Clerk keys. Browser UI and DOM were inspected, not just HTTP/build output. No recipe/list/profile/friend writes were performed by this lane. Cook step changes stayed in local resume state.

| Check | Evidence and result |
| --- | --- |
| Dark filled-action defect before/after | Browser computed Import/Search text was `#FFFFFF` over `#E2B97B`, contrast 1.83:1. After: `#111E1D` over the same brass, 9.34:1. Light white-on-`#795022` is 7.04:1. [Before](web-before-dark-library.jpg), [after](web-library-desktop-dark.jpg). Ratios calculated from the observed opaque colors, not a claim of full WCAG certification. |
| Library wide/narrow | Actual 1280-wide viewport (1265 content screenshot) and 390-wide viewport (375 content screenshot). Hero, native import controls, search/shelf/sort navigation, recipe title/thumbnail/rating/status, legal footer visually inspected. [Wide](web-library-desktop-dark.jpg), [narrow](web-library-narrow-dark.jpg). |
| Care layout and restoration | Wide light, narrow dark, narrow light with 200% text, and reduced decoration inspected. 200% computed body font was 32px; viewport390/document375, no horizontal overflow; both decorative images hidden. Selected banana plus open/two-minute choices and fixed Wispling return restored through the same-tab return. [Wide](web-care-desktop-light.jpg), [200%](web-care-narrow-light-200.jpg), [sign-in selection](web-care-sign-in-selection.jpg). These captures precede the final item-specific button wording and guest-read skip; recapture after runtime recovery. |
| Strict empty state | Open-and-eat plus warm returned no choices, said restrictions were kept, and did not reintroduce the restored selection. Pantry limitation was visible. [Capture](web-care-no-match-200.jpg). |
| Sign-in local fallback | After selecting care item, clicking Sign in and return rendered the new unavailable-account message and return link. [Capture](web-sign-in-unavailable.jpg). This is not real Clerk authentication. |
| Recipe and cook | Recipe ingredient/method, shelf/rating, sharing controls visually inspected in wide light. Cook ArrowRight advanced step3 to4; ingredients toggle worked. At narrow dark200%, one main landmark and no horizontal overflow (viewport390/document375), readable quantities and controls. [Recipe](web-recipe-desktop-light.jpg), [cook200%](web-cook-narrow-dark-200.jpg), [wide cook](web-cook-desktop-dark.jpg). |
| Editor | Wide and narrow dark inspected before the textarea repair, field labels inspected (none missing in that page's input/textarea/select DOM). The unstyled Description was demonstrated. [Before narrow repair](web-editor-narrow-dark.jpg), [wide](web-editor-desktop-dark.jpg). Post-repair source checked; final runtime capture pending. |
| Keyboard | Brand focus outline visibly captured; ArrowRight cook progression exercised. Skip link, focus-visible textarea, named cooking region and planner dialog implemented. Full keyboard traversal/native screen-reader testing remains outstanding. |

JPEG bytes returned by browser.screenshot were initially saved with .png suffixes. All this lane's `web-*` captures now use truthful `.jpg` extensions without recompression. The earlier `library-desktop.png` was only375px wide and is renamed `library-narrow-legacy.jpg`; do not present it as desktop evidence. Other pre-lane captures remain historical and are not upgraded into new validation.

## Fresh service-worker v3 check

At integration's request, used a new browser tab at `http://localhost:3097/qa`, owned by privacy/release. Visible Install and test privacy reported legacy cache removal and only `seconds-public-v3` with two icons, care-offline.js and the virtual care-offline.html cache key. Update and retest reported changed-worker activation and repeated privacy checks. [Update result](web-worker-v3-update.jpg).

The harness's Test offline navigation link deliberately failed the /care network request. The worker rendered the generic offline page and current deterministic applesauce/banana/apple suggestions. Open-and-eat plus warm gave no match and explicitly retained restrictions. [Offline](web-worker-v3-offline.jpg), [no match](web-worker-v3-no-match.jpg). This simulates network failure, not physical airplane mode.

After installation, a new-tab online navigation to `/care-offline.html` failed with the browser's HTTP-response failure instead of serving the virtual cached document. The browser tool did not expose the numeric status; privacy lane separately verified404. Pre-install browser404 was not repeated because the exact requested sequence arrived after install. Harness synthetic A/B/signed-out checks are not real Clerk logout/account-switch validation. Privacy lane owns the definitive v3 report and underlying tests.

## Automated checks and limits

- Passed the web TypeScript check after initial contrast/care/layout changes (`pnpm --filter @seconds/web typecheck`). Later label/field/fallback/copy changes need final combined typecheck; parent is running it after the native install window.
- Passed all four new targeted tests in `apps/web/modules/care/care-state.test.ts`: malformed restoration/fixed destinations, expiry/future timestamps, validated local selection round-trip, outgoing-link privacy. Command used before coordinated dependency install: `pnpm --filter @seconds/core exec tsx --test ../../apps/web/modules/care/care-state.test.ts`.
- `git diff --check` on owned source changes passed (only Windows line-ending notices).
- Did not run shared DB fixtures or repeat a heavy production build. Integration owns final tests/build after native dependency work.

## Remaining validation / immediate blocker

The main preview stopped compiling during the coordinated native/lockfile update. Fresh browser at3094/plan shows: `Attempted import error: QueryBuilder is not exported from ./query-builders/index.js`, in the Drizzle pg-core module. Integration was notified; this lane did not install packages or restart the server during native's exclusive install/prebuild window.

After native released the install window, verified listener68364 and its Next CLI parent62824 belonged to the canonical checkout, stopped only those processes, and restarted direct Node on `127.0.0.1:3094` (session68708), with the disposable DB and blank Clerk/paid API keys. Next reported Ready. No generated-cache deletion was needed. The next browser reload was explicitly denied by the browser URL security policy, which prohibits workarounds; this lane stopped navigation and restored the default viewport. This policy block is now the immediate limit.

When browser access is permitted again, finish: post-fix editor capture; final care wording/guest behavior; planner dialog keyboard/focus; pantry, shopping, profile, friends, discovery, sharing and disabled Plans visuals at narrow/wide sizes and both themes. Recipe/library/care/cook have partial real browser coverage, not an exhaustive all-flow pass. Test 200% text on the remaining forms; test actual browser zoom separately from the implemented text-size preference. Native screen-reader announcements, OS reduced-motion emulation, actual print output, real invited/non-invited/expired Clerk sessions, failed authenticated writes/account switching, browser app-return launch and physical devices remain unverified by this lane. Android/Wispling device checks belong to the native lane. No rollout readiness claim is made.

## Exact lane change handoff

New: `apps/web/modules/care/care-state.ts`, `care-state.test.ts`, this report, and `docs/beta/web-*.jpg` captures.

Updated initial beta draft: `apps/web/modules/care/CareScreen.tsx`, `care.module.css`; `apps/web/modules/woodland/Woodland.tsx`; `apps/web/ui/woodland.css`; `apps/web/app/layout.tsx`; `STYLE_GUIDE.md`.

Existing feature files: `apps/web/app/sign-in/[[...sign-in]]/page.tsx`; `apps/web/ui/Button.module.css`, `Field.tsx`, `Field.module.css`; `apps/web/modules/account/account.module.css`; `modules/cook/CookMode.tsx`, `cook.module.css`; `modules/import/ImportForm.tsx`, `import.module.css`; `modules/library/LibraryItem.tsx`, `library.module.css`; `modules/list/list.module.css`; `modules/plan/AddMealDialog.tsx`, `plan.module.css`; `modules/plans/plans.module.css` (contrast only; parent later added availability CSS); `modules/profile/profile.module.css`; `modules/recipe/IngredientList.module.css`, `recipe.module.css`; `modules/editor/IngredientRows.tsx`, `editor.module.css`; `modules/pantry/PantryList.tsx`, `CookPanel.tsx`; `modules/friends/FriendsPanel.tsx`; `modules/discover/DiscoverPanel.tsx`.

No changes to core, DB, mobile, service-worker source, care authorization, billing routes/PlanTable, assets, manifests, or lockfile were authored by this lane.
