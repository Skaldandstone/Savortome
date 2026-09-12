# Web functional and theme audit

## Implemented on 2026-09-07

- Desktop navigation now participates in the page flow, so it no longer covers
  recipe tools or the top of the library. The `More` menu opens below it on
  desktop and remains an upward-opening fixed dock on narrow layouts.
- Focused recipe cooking can use a 1080-pixel workspace, giving the step card,
  per-step amounts, technique help, and controls room to read as one module.
- The plans route now uses the same server-gated woodland page heading and
  workspace as the other beta routes. The non-beta panel title remains
  unchanged.

## Local browser evidence

The beta ran at `http://127.0.0.1:3094` with a disposable PostgreSQL database,
blank Clerk and paid-provider credentials, billing disabled, and service-worker
registration disabled. The browser pass covered the library, recipe detail,
new/edit/cook, care, cook hub, planner, shopping list, dietary profile, friends,
discovery, saved meals, plans, privacy, terms, and accessibility routes.

- Dark mode showed the common timber, parchment, brass, plum, botanical, and
  illustrated-kitchen system across those routes.
- Light mode, 200% text, and reduced decoration remained readable on the plans
  and focused-cook layouts. The enlarged layout reflowed the navigation to two
  rows instead of overlapping content.
- The desktop `More` menu exposed all five secondary destinations without
  obscuring the navigation that opened it.
- Loading states for profile, friends, discovery, templates, and shopping list
  resolved to their loaded or empty states. Development-time first compilation
  made the initial API responses take several seconds; repeat requests were
  fast.

A disposable recipe named `Woodland QA Toast` was created through `/recipe/new`,
edited to add a second ingredient and step, opened in cook mode, and deleted
through the in-page confirmation. Cook step 1 placed `2 slices bread` above
`Toast the bread until golden.` Step 2 placed `1 tbsp butter` above `Spread the
butter over the warm toast.` The library returned to its original one-recipe
state after deletion.

The existing local database predated migrations 0015 and 0016. The pass added
the missing `recipes.photos` column and current enum values only to that exact
disposable database before exercising recipe routes. A newly created fixture
through `packages/db/scripts/beta-local-schema.ts` already applies the complete
migration journal; no production schema or migration file changed.

## Automated verification

- `node --test scripts/check-woodland-ui.mjs scripts/check-woodland-library.mjs scripts/check-web-accessibility-source.mjs scripts/check-web-legal.mjs`: 26 tests passed, including 99-TSX accessibility-source coverage and 10 legal/focus/contrast contracts.
- Direct web TypeScript check: passed.
- `pnpm --filter @seconds/web build`: passed; all 39 static-generation steps and the dynamic recipe cook route completed.
- `git diff --check`: passed; line-ending notices are repository normalization warnings.

## Web completion continuation, 8 September 2026

The four woodland WebP delivery files were re-encoded at quality 82 while the
full-resolution PNG masters remained unchanged. Dimensions are preserved and
the generator now records mean absolute and root mean square decoded-channel
error instead of claiming pixel identity. The WebP total fell from 7,253,418
bytes to 725,228 bytes. A manual original-resolution review of all four current
files and a full-page running-library capture found no missing art, changed atlas
layout, color shift or objectionable artifact at the sizes used by the UI. Local
HTTP HEAD requests returned status 200, `image/webp`, and the exact generated
byte lengths for every file. This is delivery-size evidence, not a constrained
network, LCP or mobile-memory benchmark.

Visible asynchronous states now expose consistent assistive semantics:
friends, discovery, shopping and pantry loading text use polite status regions;
discovery exposes a named busy live results region; pantry errors use an alert;
and pantry results use a named polite region. The rendered-component harness
executes these four real panel bodies behind synthetic API hooks.

The browser review also caught the expanded cooking-technique guide overlaying
the next-step action. The guide now participates in the parchment card's normal
layout, expands to a readable 520-pixel maximum, and pushes the cooking controls
down. The sample recipe's `fold` step was rechecked with all three visual frames,
its text explanation, per-step amounts and divided-quantity warning visible.

The same disposable local account was used to exercise the remaining mutable
web workflows. Pantry items were added, used for a recipe search and cleared.
The sample recipe populated the shopping list; an item was toggled and the list
was cleared. A breakfast was placed on the weekly planner, copied to the
shopping list, then both the week and list were cleared. A vegetarian dietary
choice was saved and then restored to the original empty profile. A custom
`Web completion QA` shelf was created through the UI and deleted through the
same local API. The database was returned to one sample recipe, empty pantry,
empty planner/list, empty dietary choices and the three built-in shelves.

Final local checks at this continuation passed: 27 woodland, accessibility and
legal tests; 4 care-state tests; 10 offline privacy/parity tests; 18 beta
authorization/image-boundary tests; the web TypeScript check; and the production
web build with all 39 static-generation steps. Build ID:
`0BdRoV68RRei9c7VOeDWX`. The machine-readable checkpoint is
`checks/web-completion-20260908-summary.json`.

## Remaining acceptance boundaries

This is local desktop browser evidence. It does not establish a real Clerk
session, account switching, hosted service-worker behavior, a narrow physical
viewport, a screen-reader walkthrough, Android interaction, constrained-network
performance, or owner visual acceptance. Billing, grocery providers,
invitations, and deployment remained disabled.
