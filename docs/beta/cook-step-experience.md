# Focused cook-step experience

## Implemented

- Web and Android present one large recipe step at a time.
- A left swipe completes the visible step and advances. A right swipe returns to
  the previous step. Buttons remain visible, web retains arrow-key navigation,
  and Android exposes equivalent adjustable accessibility actions.
- Ingredients named by the step appear above its instruction. Serving scaling is
  applied before per-step amounts are calculated.
- Stated fractions such as half, thirds, and quarters are calculated from the
  scaled total. A later `remaining` instruction is calculated only when every
  earlier share is known. Ambiguous divided amounts retain the total and say
  that the step's share was not stated.
- Recognized cooking terms expose bundled, offline help. The help combines a
  plain-language definition with a short three-frame animated sequence on web
  and the same static sequence on Android. No model, remote image, health data,
  or recipe content is sent to produce it.
- The fixed web app dock is hidden on `/recipe/[id]/cook`, preventing it from
  covering the focused cooking controls.
- Reduced-motion users receive the same three frames without animation.

## Verification on 2026-09-07

- `pnpm --filter @seconds/core test`: 639 tests passed.
- `pnpm -r typecheck`: all four workspace typechecks passed.
- `node --test scripts/check-woodland-ui.mjs scripts/check-mobile-woodland.mjs`:
  31 component, accessibility, artwork, and native-source checks passed.
- `pnpm --filter @seconds/web build`: production build passed and generated the
  expected dynamic `/recipe/[id]/cook` route.
- A local desktop browser pass showed the wide parchment step deck, natural
  plural amounts, expanded braise sequence, controls, and removal of the fixed
  dock at the real recipe-cook URL shape. The temporary fixture was then removed.
- `git diff --check`: passed; line-ending notices are repository normalization
  warnings only.

## Acceptance boundaries

This evidence does not establish a physical-device or emulator interaction pass,
native screen-reader behavior, every viewport/theme/text-size combination, or
owner visual acceptance. The local recipe database was unavailable during the
browser pass, so the visual recipe was a temporary development-only fixture. No
fixture route remains in the source.
