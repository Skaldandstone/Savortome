# Cook mode guidance: what other apps do, and what we should build

Historical design note. The step-focused deck, per-step allergen nudge, divided
amount handling, swipe navigation, and offline technique help are now implemented
on web and Android. Runtime visual, screen-reader, and physical-device acceptance
remain separate.
Written after a quick competitive look (SideChef, Kitchen Stories, NYT Cooking) and
an audit of what `CookMode.tsx` and the allergen/nutrition modules already do.

## What we already have

Step-by-step cook mode (`apps/web/modules/cook/CookMode.tsx`,
`apps/mobile/modules/cook/CookScreen.tsx`) is mature, not a gap:

- Tap-to-advance ("Done — next →"), Back, Skip, arrow-key navigation
- Per-step ingredient amounts, scaled to the serving count set at the top
- Divided-ingredient portions when the source states a fraction, with an explicit
  warning instead of a guessed share when it does not
- Per-step timers, started from the step that names them
- Progress bar, screen-wake-lock while cooking
- Session persistence — closing the tab and coming back resumes the exact step,
  ticked-off steps, and running timers
- A large step deck with touch swipe, button, keyboard, and assistive-technology
  navigation
- Bundled plain-language help and a short visual sequence for recognized cooking
  techniques such as blanching, braising, folding, and tempering

Nutrition (`packages/core/src/nutrition.ts`, `NutritionFacts.tsx`) is also built:
per-serving and per-ingredient figures from schema.org data, USDA FoodData
Central, or a model estimate, labeled honestly by the weakest source used. Shown
on the recipe detail page — **not** inside cook mode.

Allergen flagging (`packages/core/src/dietary.ts`, `AllergenWarning.tsx`) is
built too: a viewer's own flagged allergens are matched against a recipe's
ingredients by keyword, shown as a warning on the recipe detail page — also
and the matching warning is also repeated only on the cook step where it matters.

## What other apps do

| App | Step mode | Nutrition placement | Notable extras |
|---|---|---|---|
| SideChef | Photo/video per step, voice commands | Recipe overview, not in-step | Amazon Fresh cart handoff |
| Kitchen Stories | Photos, timers per step | Recipe overview, not in-step | HD video tutorials, smart-TV/Echo Show support |
| NYT Cooking | Always-on screen, ingredients listed per step | Recipe overview, not in-step | Adjustable font size in cook mode |

The pattern holds across all three: **nobody puts full nutrition facts inside
step-by-step mode.** It lives on the overview page you read before you start
cooking, which matches what we already do. Repeating a calorie count on every
step screen isn't standard practice and isn't obviously useful — a cook checks
that once, not step by step.

None of the three appear to track a *personal* allergen list against ingredient
names at all, let alone per step — that's not an industry-standard feature.
Sources:
- [SideChef](https://www.sidechef.com/), [SideChef App Store listing](https://apps.apple.com/us/app/side%D1%81hef-easy-cooking-recipes/id905229928)
- [Kitchen Stories app](https://pages.kitchenstories.com/en/app), [Kitchen Stories on Google Play](https://play.google.com/store/apps/details?id=com.ajnsnewmedia.kitchenstories&hl=en)
- [NYT Cooking cook mode](https://bootstrapped.ventures/cook-mode/)

## Implemented extension: a per-step allergen nudge, not a nutrition readout

Full nutrition-in-cook-mode is off the table for the reason above — it isn't
what competitors do, it isn't what a cook needs mid-step, and it would need new
per-step nutrition math we don't have (today's nutrition is whole-recipe or
whole-ingredient, not sliced by step).

The one thing worth building is narrower and genuinely differentiated: **surface
an allergen flag on the exact step it applies to**, not just once on the recipe
page before cooking starts. Nobody researched here does this, and we already
have every piece it needs:

- `flagsForRecipe(ingredients, allergens)` already returns which ingredients
  match a viewer's flagged allergens (`packages/core/src/dietary.ts`)
- `ingredientsByStep(steps, ingredients)` already maps each step to the
  ingredients used in it (`packages/core/src/step-ingredients.ts`, already
  called in `CookMode.tsx` for the per-step amounts)

Cross-referencing those two is the entire feature — no new parsing, no new
allergen logic, no new nutrition computation.

### Proposed behavior

- On `CookMode`, for the current step, check whether any of that step's
  ingredients appear in `flagsForRecipe`'s output for the signed-in viewer's
  own allergens (same "your own profile, not the recipe owner's" rule
  `AllergenWarning` already follows).
- If so, show a small callout in the step's `stepExtras` area — "Contains
  milk: heavy cream" — using the same tone and wording as the existing
  `AllergenWarning` component, not a new visual language.
- Quiet by default: nothing renders unless the viewer has allergens set *and*
  this specific step has a flagged ingredient. Matches the app's existing
  "a meter that shouts all the time reads as running on the whole app" design
  principle (see `CreditMeter`'s own reasoning).
- Same disclaimer language as `AllergenWarning` — a heads-up, not a clearance.

### Explicitly out of scope for this spec

- **Full nutrition facts in cook mode.** Not what competitors do; the pre-cook
  overview is the right place for it, and per-step nutrition doesn't exist as
  data today.
- **Voice / hands-free commands.** SideChef has this; it's a real capability
  gap, but it's a much larger lift (speech recognition, cross-platform) than a
  "reminder/guidance" feature and isn't what was asked for here.
- **Per-step photos or video.** Would require re-architecting the extraction
  pipeline to capture step-level media, which today's `Recipe`/`Step` schema
  doesn't carry.

## Estimated scope

Small. Both data functions already exist and are already called inside
`CookMode.tsx` for other purposes; this is a cross-reference plus one small UI
component, reusing `AllergenWarning`'s existing markup/CSS rather than
inventing new. Mobile's `CookScreen.tsx` would need the same change to stay
consistent with web.
