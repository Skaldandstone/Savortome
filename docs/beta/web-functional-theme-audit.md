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

## Remaining acceptance boundaries

This is local desktop browser evidence. It does not establish a real Clerk
session, account switching, hosted service-worker behavior, a narrow physical
viewport, a screen-reader walkthrough, Android interaction, performance on the
approximately 9.6 MiB source artwork set, or owner visual acceptance. Billing,
grocery providers, invitations, and deployment remained disabled.
