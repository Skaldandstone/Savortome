# Savortome™ Style Guide

Status: concept-board web system extended across existing features, 31 August 2026. Visual acceptance and release remain gated pending permitted browser, device and invited-account review. The latest web continuation is documented in `docs/beta/web-ui-completion.md`; previously built Android artifacts are preserved.

## Woodland concept implementation

The authoritative visual reference is `design/concepts/woodland-beta-board.png`. James requested a structural rebuild to match this board after reviewing the first palette-only pass. That earlier implementation and its screenshots are historical, not acceptance evidence for this revision.

The web app now uses the board's kitchen composition, dark timber, thin worn-brass frames, quiet plum actions, parchment recipe pages and labeled line-icon navigation. Library shelves occupy a desktop column beside image cards. At narrow widths the shelves wrap and recipe cards become image-and-text rows. Care uses compact illustrated choices which expand with native details controls. Recipe ingredients and method, plus active cook instructions, use legible native text over parchment.

| Token | Light | Dark (new-device default) |
| --- | --- | --- |
| Background | `#EEE3CD` | `#101514` |
| Surface | `#F8EEDB` | `#191E1B` |
| Text | `#302B21` | `#EDDFC5` |
| Muted text | `#65573F` | `#C0AF92` |
| Brass accent | `#705024` | `#E1BA7D` |
| Border | `#8A704A` | `#8E7855` |
| Primary action | `#E5DBE6` | `#3E3344` |
| Primary action text | `#493B4C` | `#F3DEBB` |
| Parchment / ink | `#E5D0A9` / `#332C20` | same |

Headings, recipe-card names and navigation use Georgia. Ingredients, forms, timers and supporting copy retain a readable system sans. Sizes use rem units. Display options retains system/light/dark, 100/125/150/200 percent text, and reduced decoration. Explicit saved light/system preferences still win over the new dark default.

Production art is separate from every label/control: `kitchen-scene.png`, `food-atlas.png`, `parchment.png`, and `timber.png` in `apps/web/public/woodland`. Preserve these full-resolution PNG masters. Web delivery uses quality-82 WebP derivatives with the same dimensions; the reproducible encoder records decoded-image error and file reduction in `docs/beta/checks/web-concept-encoding.json`. Android retains its previously verified packaged copies until a coordinated native rebuild. The four-by-four food atlas maps directly to catalogue IDs; it does not classify recipes or establish ingredients or safety. Library cards use actual recipe photos or a neutral journal illustration when no photo exists. Scene, food, and texture assets were generated with the built-in imagegen tool; prompts and file evidence are in `docs/beta/web-concept-rebuild.md`. The earlier hearth and kettle/journal assets remain preserved. The optional Wispling visitor remains comparison art only. No new character is introduced. The Savortome rebrand replaces the breakfast-specific skillet mark with the reproducible open-tome and hearth-emblem source in `scripts/make-icons.mjs`.

Frames are native CSS, iconography is native SVG, and all controls are HTML. Never crop a control, title, recipe or card from the concept image. Counts and shelves must come from actual data. The library import link expands the real import form; new shelf uses the existing authenticated API. Do not fabricate the board's recipe examples or counts.

Reduced decoration removes scene/food illustrations, paper/timber textures and ornamental rules while preserving content, navigation, controls and card boundaries. Reduced-motion CSS disables nonessential transitions. Keyboard outlines and a skip link remain visible; the dock flows into the document at 200 percent text. Print uses plain paper rather than textures. System/light layouts preserve the same composition.

Everyday screens use restrained native journal headings and flat, framed form surfaces. Do not repeat the entry scene or timber texture behind fields. Planning uses a wrapping day grid, discovery uses photo cards and narrow recipe rows, and pantry, shopping, friends, saved meals, shelves and sharing use consistent brass rules and serif section titles. All displayed counts, images and content still come from existing data. The new headings are server-gated; public legacy pages do not render them. Secondary details and companion recipe panels wrap at enlarged text sizes.

Native controls follow the chosen light/dark color scheme, including system mode. Border colors provide at least 3:1 against the three flat theme surfaces in static calculation; body and muted text retain at least 4.5:1 on those surfaces. These numbers do not certify artwork overlays, browser-rendered colors or full WCAG conformance. Paper panels use the darker brass boundary for controls. Display and navigation disclosures close on Escape with focus requested on their summary. Saved meals appears under More. Care write feedback appears next to the selected item, retaining native live status and the exact single-item action.

Every native input, select and textarea needs a visible label or an explicit
accessible name. A placeholder is supporting copy, never the only name. Repeated
controls include their object and context, such as the timer label and source
step. Failed writes and safety-check failures use alerts; routine loading and
  confirmed saves use polite status. Countdown clocks do not announce every
  second. The reusable source audit in `scripts/check-web-accessibility-source.mjs`
  enforces the native-control, image, dialog and frame naming boundary.

  Mobile follows the same naming rules. Tappable controls use a semantic role,
  duplicate recipe and avatar images stay hidden from assistive technology, and
  working controls expose at least a 44 by 44 point target. The reusable audit in
  `scripts/check-mobile-accessibility-source.mjs` checks those source boundaries;
  device TalkBack and Switch Access checks remain separate acceptance work.

The generic offline care shell stays independent of accounts and does not inherit private data. Care catalogue filtering, fixed Wispling return, temporary restrictions, saved-setting warnings, shopping confirmation and local sign-in restoration are unchanged. Color and imagery never mean a food is safe. No scores, streaks, clinical claims or completion reporting.

Source compilation cannot establish visual fidelity. The new revision still needs permitted browser inspection at narrow/wide widths, both themes, keyboard, enlarged text and reduced decoration. The existing explicit browser URL-policy block must not be bypassed. Do not describe the earlier Android APK or earlier browser screenshots as this new web revision.

## Focused cook steps

Cook mode presents one large parchment step deck at a time. The current step is
the main surface, not one card in a dense list. Each deck keeps this reading
order: step position, visual action cue, amounts to measure now, the instruction,
optional technique help, safety guidance, and timer or source-video actions.

On touch screens, a deliberate horizontal swipe left completes the current step
and advances; a swipe right returns to the previous step. Back, Done, Skip,
keyboard arrows, and screen-reader increment/decrement actions remain equivalent
controls. Vertical movement must continue to scroll. Reduced motion disables the
visual-sequence animation and other nonessential transitions.

Amounts come from the scaled recipe ingredients. When a step says half, a third,
or another supported fraction, the step card calculates that portion. A later
"remaining" amount is calculated only when all earlier allocations are known.
If a divided recipe never states the share for a step, show the recipe total and
the missing-detail warning. Never invent a division.

Recognized complex techniques appear as link-styled, keyboard-operable help
buttons. Their tooltip contains a short three-part visual sequence and a plain
language definition from the bundled offline glossary. Keep those diagrams
decorative and repeat their meaning in text. Do not generate technique media or
contact a model while someone is cooking.

## Progressive onboarding

Onboarding begins with a useful choice instead of an account questionnaire.
Each screen asks for one decision, explains why it helps, and offers a visible
way to skip or leave. Progress language stays neutral: no streaks, scores,
urgency, confetti, or claims that a person's setup is incomplete.

The first screen routes directly to saving a recipe, planning a meal, or Feed
me gently. The safety screen explains that dietary preferences and allergens
filter suggestions but cannot verify that a food is safe. Cooking confidence
uses the existing profile control so the app can tune detail without describing
the user as a beginner or expert.

Progress is stored locally under an account-scoped, non-reversible identifier.
It contains only the onboarding version, current screen, completed screens, and
finished state. Dietary choices, allergens, pantry contents, health information,
and recipe activity do not belong in onboarding storage. A storage failure must
be stated plainly and must not prevent the person from continuing.

The journey must resume after reload, remain keyboard and screen-reader
operable, fit at 200 percent text without horizontal scrolling, respect reduced
motion and reduced decoration, and keep the same woodland kitchen surfaces,
type hierarchy, brass boundaries, and native controls as the rest of the app.

## Existing public baseline

The private Android build retains the reviewed woodland scene, food atlas and
textures from its native build checkpoint. Web delivery derivatives may be
optimized independently; do not claim byte equality between current web files
and an earlier APK without rebuilding and rechecking that APK. Its library has actual recipe-image rows, neutral
journal fallbacks, shelf counts and a wider two-column arrangement. Care uses
native expandable cards with every ingredient/step available for all three slots.
Recipe and cook instructions use parchment panels with scoped dark ink; reduced
decoration retains the system-theme palette without texture. Android follows the
system light/dark preference and native text scaling. The labeled line-icon dock
wraps at enlarged text, and decorative food art drops out to make room for text.
Cook step scrolling respects reduced motion and ingredient lists are not clipped.
The old hearth/kettle assets remain preserved but are no longer the default scene.
These are source changes, not evidence of emulator or physical-device acceptance.

This guide describes the visual system already shipped in `apps/web/ui/tokens.css`. The active
The historical `Second Breakfast - UI Draft` Figma file remains a working design reference until it is renamed; changes from that file
should update this guide and the tokens together rather than creating a parallel system.

## Brand idea

Savortome is the calm, capable friend beside the chopping board. It should feel domestic,
warm, and immediately useful: a recipe card propped near the kettle, not a content feed, restaurant
menu, or glossy food-delivery app.

## Palette

| Token | Light | Dark | Meaning |
| --- | --- | --- | --- |
| Background | `#FBF8F4` | `#16130F` | Warm kitchen air |
| Surface | `#FFFFFF` | `#201B16` | Recipe cards and controls |
| Sunken surface | `#F4EFE8` | `#2A231C` | Grouped ingredients and secondary regions |
| Border | `#E6DDD1` | `#3A3129` | Quiet structure |
| Text | `#241D17` | `#F2ECE4` | Primary copy |
| Muted text | `#6F6459` | `#A89C8E` | Metadata and hints |
| Accent | `#B4451F` | `#F08D5F` | Terracotta action and appetite cue |
| Good | `#2F6B46` | `#7FC59B` | Herb green for success and status |
| Warning | `#8A6100` | `#E2B768` | Mustard for timing and attention |

The accent is for actions and key food information, not broad decorative fields. Green means a
positive state, never an allergen safety guarantee. Warning gold should remain legible without reading as an error.

## Typography and information hierarchy

- The current implementation uses a native sans stack for speed and kitchen-distance readability.
- Recipe title, yield, time, and the next action form the first reading layer.
- Ingredients and numbered steps are the second layer; source notes and metadata are the third.
- Use sentence case. Avoid tiny all-caps labels and editorial magazine typography.
- Numeric timers and quantities must use stable, easy-to-scan figures.

## Shape, spacing, and motion

- Cards use `14px` radii; compact controls use `10px`.
- Shadows are warm and shallow. Avoid glassmorphism, high-gloss highlights, and deep modal stacks.
- Motion should explain state: adding to a list, advancing a step, or confirming a timer. No ambient
  bouncing, streak celebrations, or transitions that delay cooking.
- Every essential state must work in a narrow mobile viewport and with one hand.

## Food imagery

- Prefer honest, attainable food in natural window light or warm practical kitchen light.
- Show useful texture and doneness, not luxury plating. Props should look lived-in and clean enough,
  never showroom-perfect.
- Avoid stock-photo smiles, delivery packaging, impossible ingredient abundance, and AI-perfect
  symmetrical tables.
- Images support recognition; the recipe must remain usable when images fail or are omitted.

## Print

Print is a first-class surface. Printed recipes use black on white, remove interactive controls and
screen shadows, keep headings with their content, and avoid splitting steps. A printout should work
beside the stove without account chrome or promotional material.

## Voice

Direct, warm, and non-performative. Prefer "You can swap in..." and "This will take about..." over
chef authority or lifestyle copy. Error messages should preserve the user's ingredients and effort.

## Pantry memory

Pantry rows use the same quiet parchment surfaces and native controls as recipe
forms. Put the item name and observed quantity first, then correction actions.
Use a narrow warning stripe for a produce reminder, never a red error treatment.

Write reminders as questions: "Still have those bananas?" Pair the question
with a practical next action or recipe. Do not say that the person needs a
nutrient, that the pantry count is certainly current, or that a quality window
is a safety deadline. Storage guidance belongs in a native `details` disclosure
with its source visible. Receipt and grocery-order items must appear in a
reviewable checklist before they become pantry records.

The Plan together entrance is a brass-framed journal section followed by no
more than three compact parchment cards. Each card leads with the recipe, then
one plain-language reason, time when known, a labeled native meal selector, and
the planning action. Keep pantry uncertainty and allergen limitations visible
in the section rather than hiding them in a tooltip.

